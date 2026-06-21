// Linear solver for selected recipes
import { parsePercent, parseNumber } from './utils.js';

export function buildMatrix(selectedRecipes){
  // gather items
  const itemsSet = new Set();
  for (const r of selectedRecipes){
    for (let i=1;i<=3;i++){ if (r[`output${i}`]) itemsSet.add(r[`output${i}`]); if (r[`input${i}`]) itemsSet.add(r[`input${i}`]); }
  }
    const items = Array.from(itemsSet);
  const m = items.length; const n = selectedRecipes.length;
  const A = Array.from({length:m}, ()=>Array(n).fill(0));
  for (let j=0;j<n;j++){
    const r = selectedRecipes[j];
    const pct = parsePercent(r.percent);
    const mult = parseNumber(r.speedMultiplier) || 1;
    for (let i=1;i<=3;i++){
        const out = r[`output${i}`]; const outn = Number(r[`output${i}num`]||0) * pct * mult;
        if (out) {
          const row = items.indexOf(out);
          if (row>=0) A[row][j] += outn;
        }
        const inp = r[`input${i}`]; const inn = Number(r[`input${i}num`]||0) * mult;
      if (inp){
        const row = items.indexOf(inp);
        if (row>=0) A[row][j] -= inn; // consumed
      }
    }
  }
  return {A, items};
}

function transpose(M){ return M[0].map((_,i)=>M.map(row=>row[i])); }

function matMul(A,B){ // A m x p, B p x n -> m x n
  const m = A.length; const p = A[0].length; const n = B[0].length;
  const C = Array.from({length:m}, ()=>Array(n).fill(0));
  for (let i=0;i<m;i++) for (let k=0;k<p;k++) if (A[i][k]!=0) for (let j=0;j<n;j++) C[i][j]+=A[i][k]*B[k][j];
  return C;
}

function vecMulMat(vec, M){ // vec length m, M m x n -> length n
  const m = vec.length; const n = M[0].length; const out = Array(n).fill(0);
  for (let i=0;i<m;i++) for (let j=0;j<n;j++) out[j]+=vec[i]*M[i][j];
  return out;
}

function gaussianSolve(mat, rhs){
  const n = mat.length;
  // augment
  const A = mat.map((r,i)=>r.concat([rhs[i]]));
  const m = A.length; const cols = A[0].length;
  let row=0;
  for (let col=0; col<cols-1 && row<m; col++){
    // pivot
    let sel = row; while (sel<m && Math.abs(A[sel][col])<1e-12) sel++;
    if (sel===m) continue;
    [A[row],A[sel]] = [A[sel],A[row]];
    const inv = 1/A[row][col];
    for (let j=col;j<cols;j++) A[row][j]*=inv;
    for (let i=0;i<m;i++) if (i!==row){
      const f = A[i][col]; if (Math.abs(f)<1e-12) continue;
      for (let j=col;j<cols;j++) A[i][j]-=f*A[row][j];
    }
    row++;
  }
  // extract solution for first n variables (if square)
  const sol = Array(cols-1).fill(0);
  for (let i=0;i<m;i++){
    // find leading one
    let lead = -1; for (let j=0;j<cols-1;j++){ if (Math.abs(A[i][j]-1)<1e-9){ lead=j; break;} if (Math.abs(A[i][j])>1e-12){ lead=-2; break; } }
    if (lead>=0) sol[lead]=A[i][cols-1];
  }
  return sol.slice(0, cols-1);
}

export function solveSelectedRecipes(selectedRecipes, externalDemand){
  // Propagation-based solver: given selectedRecipes and external demand (item -> amount/min),
  // propagate requirements down chosen recipes to compute runs per recipe, building counts,
  // external requirements (items not producible), and aggregated actual inputs/outputs.
  // externalDemand: {itemName: amountPerMinute}
  // Build quick lookup of producers and recipe data
  const producers = {}; // item -> list of {idx, outPerRun}
  const recipeData = selectedRecipes.map((r, idx)=>{
    const pct = parsePercent(r.percent);
    const mult = parseNumber(r.speedMultiplier) || 1;
    const outputs = [];
    const inputs = [];
    for (let k=1;k<=3;k++){ if (r[`output${k}`]) outputs.push({name: r[`output${k}`], num: Number(r[`output${k}num`]||0) * pct * mult}); if (r[`input${k}`]) inputs.push({name: r[`input${k}`], num: Number(r[`input${k}num`]||0) * mult}); }
    for (const o of outputs){ producers[o.name] = producers[o.name] || []; producers[o.name].push({idx, outPerRun: o.num}); }
    return {outputs, inputs, time: Number(r.time)||0};
  });

  const runs = Array(selectedRecipes.length).fill(0);
  const required = Object.assign({}, externalDemand || {}); // item -> needed per minute
  const supplied = {}; // track supplied outputs per item
  const externalReq = {};

  // apply fixedRuns if any (pre-seeded runs)
  for (let j=0;j<selectedRecipes.length;j++){
    const r = selectedRecipes[j]; if (r && typeof r.fixedRuns === 'number'){
      const f = r.fixedRuns || 0; if (f <= 0) continue; runs[j] = (runs[j]||0) + f;
      const rec = recipeData[j];
      for (const out of rec.outputs) supplied[out.name] = (supplied[out.name]||0) + out.num * f;
      for (const inp of rec.inputs) required[inp.name] = (required[inp.name]||0) + inp.num * f;
    }
  }

  const eps = 1e-9;
  let iter = 0;
  const maxIter = 2000;
  // loop until no change
  while (iter++ < maxIter){
    let changed = false;
    // for each required item, try to satisfy from producers
    const keys = Object.keys(required);
    for (const item of keys){
      const needTotal = (required[item] || 0) - (supplied[item] || 0);
      if (needTotal <= eps) continue;
      const pls = producers[item] || [];
      if (!pls.length){
        // cannot produce: must be external
        externalReq[item] = (externalReq[item]||0) + needTotal;
        supplied[item] = (supplied[item]||0); // no change
        continue;
      }
      // greedily use producers in order: consume need from earlier producers first
      let remaining = needTotal;
      for (const p of pls){
        if (remaining <= eps) break;
        const rec = recipeData[p.idx];
        const outPerRun = p.outPerRun;
        if (outPerRun <= eps) continue;
        const runsNeeded = remaining / outPerRun;
        // assign all needed to this producer (greedy)
        const addRuns = runsNeeded;
        runs[p.idx] = (runs[p.idx] || 0) + addRuns;
        // add this recipe's inputs to required
        for (const inp of rec.inputs){ required[inp.name] = (required[inp.name]||0) + inp.num * addRuns; }
        // add all outputs of this recipe to supplied
        for (const out of rec.outputs){ supplied[out.name] = (supplied[out.name]||0) + out.num * addRuns; }
        // reduce remaining by produced amount
        remaining -= outPerRun * addRuns;
      }
      if (remaining > eps) {
        // couldn't satisfy fully
        externalReq[item] = (externalReq[item]||0) + remaining;
      }
      changed = true;
    }
    if (!changed) break;
  }

  // compute buildings per recipe (round up) and actual runs based on integer buildings
  const buildings = runs.map((r, j)=>{ const t = recipeData[j].time || 0; return t>0 ? r * t / 60 : 0; });
  const actualRuns = Array(selectedRecipes.length).fill(0);
  const softRuns = Array(selectedRecipes.length).fill(0);
  for (let j=0;j<selectedRecipes.length;j++){
    const t = recipeData[j].time || 0;
    if (t > 0) actualRuns[j] = Math.ceil(buildings[j]) * (60 / t);
    else actualRuns[j] = 0;
    if (t > 0) softRuns[j] = buildings[j] * (60 / t);
    else softRuns[j] = 0;
  }

  // compute actual aggregated outputs and inputs from integer buildings
  const totalsOut = {};
  const totalsIn = {};
  const softTOut = {};
  const softTIn = {};
  for (let j=0;j<selectedRecipes.length;j++){
    const rec = recipeData[j];
    const run = actualRuns[j] || 0;
    for (const out of rec.outputs) totalsOut[out.name] = (totalsOut[out.name]||0) + out.num * run;
    for (const inp of rec.inputs) totalsIn[inp.name] = (totalsIn[inp.name]||0) + inp.num * run;
    const _run = softRuns[j] || 0;
    for (const out of rec.outputs) softTOut[out.name] = (softTOut[out.name]||0) + out.num * _run;
    for (const inp of rec.inputs) softTIn[inp.name] = (softTIn[inp.name]||0) + inp.num * _run;
  }
  // net = outputs - inputs
  const net = {};
  const softNet = {};
  const allItems = new Set([...Object.keys(totalsOut), ...Object.keys(totalsIn)]);
  for (const it of allItems){ net[it] = (totalsOut[it]||0) - (totalsIn[it]||0); }
  for (const it of allItems){ softNet[it] = (softTOut[it]||0) - (softTIn[it]||0); }
  const actualOut = {};
  const actualIn = {};
  for (const k of Object.keys(net)){
    if (net[k] > 1e-12) actualOut[k] = net[k];
    else if (net[k] < -1e-12) actualIn[k] = -net[k];
  }
  const softOut = {};
  const softIn = {};
  for (const k of Object.keys(softNet)){
    if (softNet[k] > 1e-12) softOut[k] = softNet[k];
    else if (softNet[k] < -1e-12) softIn[k] = -softNet[k];
  }

  // final external requirements = net consumptions after integer buildings
  const finalExternalReq = Object.assign({}, actualIn);

  return {runs: softRuns, actualRuns: actualRuns, buildings, items: Object.keys(producers).concat(Object.keys(required)).filter((v,i,a)=>a.indexOf(v)===i), externalReq: externalReq, softOut, softIn};
}

function solveNNLS(A, b){
  // Projected gradient descent for NNLS
  const m = A.length; const n = A[0].length;
  const At = transpose(A);
  // Lipschitz estimate: L = max_j sum_i A[i][j]^2
  let L = 0;
  for (let j=0;j<n;j++){ let s=0; for (let i=0;i<m;i++) s += A[i][j]*A[i][j]; if (s> L) L = s; }
  const alpha = 1 / (L + 1e-6);
  let x = Array(n).fill(0);
  // initialize with positive part of At * b
  const Atb = vecMulMat(b, A); // length n
  for (let j=0;j<n;j++) x[j] = Math.max(0, Atb[j] * alpha);
  const maxIter = 500;
  for (let it=0; it<maxIter; it++){
    // compute Ax - b
    const Ax_minus_b = Array(m).fill(0);
    for (let i=0;i<m;i++){
      for (let j=0;j<n;j++) Ax_minus_b[i] += A[i][j] * x[j];
      Ax_minus_b[i] -= b[i] || 0;
    }
    // gradient = A^T (Ax - b)
    const grad = vecMulMat(Ax_minus_b, A);
    let maxUpdate = 0;
    for (let j=0;j<n;j++){
      const nx = x[j] - alpha * grad[j];
      const px = nx < 0 ? 0 : nx;
      maxUpdate = Math.max(maxUpdate, Math.abs(px - x[j]));
      x[j] = px;
    }
    if (maxUpdate < 1e-9) break;
  }
  return x;
}
