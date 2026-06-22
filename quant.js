import { createItemPicker, createRecipePicker, createTable, createButton, createDiv } from './lib/ui.js';
import { solveSelectedRecipes } from './lib/calc.js';
import { parseNumber, parsePercent } from './lib/utils.js';
import { loadItems, loadRecipes as fetchRecipes } from './lib/data.js';

let items = [];
let recipes = [];
let selectedRecipesList = [];
let currentExternalDemand = {};
const STORAGE_KEY_SELECTED = 'quant:selectedRecipes';
const STORAGE_KEY_DEMAND = 'quant:externalDemand';

const itemPickerContainer = document.getElementById('itemPickerContainer');
const targetRateInput = document.getElementById('targetRate');
const addTargetBtn = document.getElementById('addTargetRecipe');
const selectedRecipesDiv = document.getElementById('selectedRecipes');
const calcResultDiv = document.getElementById('calcResult');

async function loadData(){
  items = await loadItems();
  recipes = await fetchRecipes();
}

function saveState(){
  try{
    const data = selectedRecipesList.map(r=>({
      building: r.building,
      output1: r.output1, output1num: r.output1num,
      output2: r.output2, output2num: r.output2num,
      output3: r.output3, output3num: r.output3num,
      input1: r.input1, input1num: r.input1num,
      input2: r.input2, input2num: r.input2num,
      input3: r.input3, input3num: r.input3num,
      speedMultiplier: r.speedMultiplier,
      fixedRuns: r.fixedRuns,
      _isTarget: r._isTarget,
      percent: r.percent
    }));
    localStorage.setItem(STORAGE_KEY_SELECTED, JSON.stringify(data));
    localStorage.setItem(STORAGE_KEY_DEMAND, JSON.stringify(currentExternalDemand || {}));
  }catch(e){ console.warn('saveState failed', e); }
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY_SELECTED);
    const demandRaw = localStorage.getItem(STORAGE_KEY_DEMAND);
    if (demandRaw) currentExternalDemand = JSON.parse(demandRaw) || {};
    if (!raw) return;
    const arr = JSON.parse(raw) || [];
    selectedRecipesList = [];
    for (const s of arr){
      // try to match to fetched recipes by building+outputs
      let found = recipes.find(r=>{
        if ((r.building||'') !== (s.building||'')) return false;
        for (let k=1;k<=3;k++){
          if ((r[`output${k}`]||'') !== (s[`output${k}`]||'')) return false;
          const rn = Number(r[`output${k}num`]||0), sn = Number(s[`output${k}num`]||0);
          if (rn !== sn) return false;
        }
        return true;
      });
      if (found){
        // copy user-overrides
        if (s.speedMultiplier !== undefined) found.speedMultiplier = s.speedMultiplier;
        if (s.fixedRuns !== undefined) found.fixedRuns = s.fixedRuns;
        if (s._isTarget) found._isTarget = true;
        if (s.percent !== undefined) found.percent = s.percent;
        selectedRecipesList.push(found);
      }else{
        // fallback: keep saved object
        selectedRecipesList.push(s);
      }
    }
  }catch(e){ console.warn('loadState failed', e); }
}

function moveRecipe(from, to){
  if (from < 0 || from >= selectedRecipesList.length) return;
  if (to < 0) to = 0; if (to >= selectedRecipesList.length) to = selectedRecipesList.length-1;
  const [item] = selectedRecipesList.splice(from,1);
  selectedRecipesList.splice(to,0,item);
}

function renderSelected(){
  selectedRecipesDiv.innerHTML = '';
  if (selectedRecipesList.length === 0){ selectedRecipesDiv.textContent = '（未选择配方）'; return; }
  const headers = ['','建筑','配方','倍率','操作'];
  const rows = selectedRecipesList.map((r, idx)=>{
    // controls
    const topBtn = createButton('置顶', ()=>{ moveRecipe(idx,0); renderSelected(); solveAndRender(); });
    const upBtn = createButton('上移', ()=>{ moveRecipe(idx, idx-1); renderSelected(); solveAndRender(); });
    const downBtn = createButton('下移', ()=>{ moveRecipe(idx, idx+1); renderSelected(); solveAndRender(); });
    const bottomBtn = createButton('置底', ()=>{ moveRecipe(idx, selectedRecipesList.length-1); renderSelected(); solveAndRender(); });
    const ctrltd = createDiv([topBtn, upBtn, downBtn, bottomBtn], {tagName: 'td', className: 'ctrl-div'});

    const btd = createDiv([r.building||''], {tagName: 'td'});

    const rtd = createDiv([], {tagName: 'td'});
    const outs = []; for (let k=1;k<=3;k++) if (r[`output${k}`]) outs.push(`${r[`output${k}`]} x${r[`output${k}num`]||1}`);
    const ins = []; for (let k=1;k<=3;k++) if (r[`input${k}`]) ins.push(`${r[`input${k}`]} x${r[`input${k}num`]||1}`);
    rtd.innerHTML = `<div><b>输出:</b> ${outs.join(', ')}</div><div><b>输入:</b> ${ins.join(', ')}</div>`;

    const inp = document.createElement('input'); inp.type='number'; inp.step='0.5'; inp.min='0.5'; inp.max='5'; inp.className='small'; inp.value = (r.speedMultiplier===undefined?2:r.speedMultiplier);
    const normalizeAndSet = (diff)=>{
      return ()=>{
        let v = parseFloat(inp.value)||2;
        if (isNaN(v)) v = 2;
        v += diff||0;
        if (v < 0.5) v = 0.5; if (v > 5) v = 5; v = Math.round(v*2)/2;
        inp.value = v;
        r.speedMultiplier = v;
        renderSelected(); solveAndRender();
      }
    }
    inp.addEventListener('change', normalizeAndSet(0));
    const dec = createButton('-', normalizeAndSet(-0.5));
    const inc = createButton('+', normalizeAndSet(0.5));
    const mtd = createDiv([dec, inp, inc], {tagName: 'td', className: 'ctrl-div'});

    const rem = createButton('移除', ()=>{ selectedRecipesList.splice(idx,1); renderSelected(); solveAndRender(); });
    const remtd = createDiv([rem], {tagName: 'td'});

    return [ctrltd, btd, rtd, mtd, remtd];
  });
  const table = createTable(headers, rows, {ratio:[2,2,4,2,1]});
  selectedRecipesDiv.appendChild(table);
  // persist
  saveState();
}

function renderResult(res){
  calcResultDiv.innerHTML='';
  if (!res) { calcResultDiv.textContent='无法求解或未选择配方'; return; }
  if (selectedRecipesList.length===0){ calcResultDiv.textContent = '（未选择配方）'; return; }
  // per-recipe table showing fractional (soft) factory counts
  const headers = ['建筑','数量','输出 (每分钟)','输入 (每分钟)'];
  const rows = selectedRecipesList.map((r,j)=>{
    const runs = res.runs[j] || 0; // soft runs
    const aruns = res.actualRuns[j] || 0;
    const buildingCount = res.buildings[j] || 0; // soft building count (may be fractional)
    const mult = parseNumber(r.speedMultiplier || 2) || 1;
    const idx = [1,2,3];
    const outs = createDiv(
      idx.map(k=>{
        if (r[`output${k}`]){
          const v = parseNumber(r[`output${k}num`]) * parsePercent(r.percent) * mult;
          return document.createTextNode(`${r[`output${k}`]}: ${aruns * v}(${(runs * v).toFixed(2)})\n`);
        }
        return null;
      }).filter(Boolean),
      {style:{whiteSpace:'pre-wrap'}}
    );
    const ins = createDiv(
      idx.map(k=>{
        if (r[`input${k}`]){
          const v = parseNumber(r[`input${k}num`]) * mult;
          return document.createTextNode(`${r[`input${k}`]}: ${aruns * v}(${(runs * v).toFixed(2)})\n`);
        }
        return null;
      }).filter(Boolean),
      {style:{whiteSpace:'pre-wrap'}}
    );
    const title = createDiv([r.building || '']);
    const count = createDiv([`${Math.ceil(buildingCount)}(${buildingCount.toFixed(2)})`]);
    return [title, count, outs, ins];
  });
  const table = createTable(headers, rows, {ratio: [2,1,3,3]});
  calcResultDiv.appendChild(table);

  // show aggregated actual outputs and needed external inputs side-by-side
  const aggWrap = document.createElement('div'); aggWrap.style.display='flex'; aggWrap.style.gap='12px'; aggWrap.style.marginTop='12px';
  const outBox = document.createElement('div'); outBox.style.flex='1'; outBox.innerHTML = '<b>实际输出产品 (每分钟)</b>';
  const reqBox = document.createElement('div'); reqBox.style.flex='1'; reqBox.innerHTML = '<b>需要的外部输入 (每分钟)</b>';
  // prefer showing fractional (soft) outputs/inputs
  const softOut = res.softOut || {};
  const outRows = [];
  for (const k of Object.keys(softOut)){
    const v = softOut[k]; if (Math.abs(v) < 1e-9) continue;
    if (Math.abs(v) < 1e-9) continue;
    outRows.push([k, v.toFixed(2)]);
  }
  const outTable = createTable(['物品','每分钟'], outRows, {compact:true});
  const keys = Object.keys(res.softIn||{});
  const reqRows = [];
  if (keys.length===0){ reqRows.push(['（无）','']); }
  for (const k of keys){
    const v = res.softIn[k];
    const btn = createButton('为此选择配方', ()=>{ openRecipePickerFor(k); });
    if (Math.abs(v) < 1e-9) continue;
    reqRows.push([k, v.toFixed(2), btn]);
  }
  const reqTable = createTable(['物品','每分钟',''], reqRows, {compact:true});
  outBox.appendChild(outTable); reqBox.appendChild(reqTable); aggWrap.appendChild(outBox); aggWrap.appendChild(reqBox);
  calcResultDiv.appendChild(aggWrap);
}

function solveAndRender(){
  const res = solveSelectedRecipes(selectedRecipesList, currentExternalDemand);
  renderResult(res);
}

function openRecipePickerFor(itemName, onSelect){
  const rp = createRecipePicker(recipes, itemName, (r)=>{
    if (r.speedMultiplier === undefined) r.speedMultiplier = 2;
    selectedRecipesList.push(r);
    renderSelected(); solveAndRender();
    saveState();
    if (onSelect) onSelect(r);
    if (modal) document.body.removeChild(modal);
    if (overlay) document.body.removeChild(overlay);
  });
  const overlay = document.createElement('div'); overlay.className = 'overlay modal-9999';
  const modal = document.createElement('div'); modal.className = 'center-modal modal-9999';
  const close = document.createElement('button'); close.type='button'; close.className='btn'; close.textContent='关闭';
  close.addEventListener('click', ()=>{
    if (modal) document.body.removeChild(modal);
    if (overlay) document.body.removeChild(overlay);
  });
  modal.appendChild(rp); modal.appendChild(close);
  document.body.appendChild(overlay); document.body.appendChild(modal);
}

async function init(){
  await loadData();
  // load saved selected recipes + demand
  loadState();
  const picker = createItemPicker('选择物品', items, ()=>{});
  itemPickerContainer.appendChild(picker.el);
  // restore picker value and target input from loaded demand
  try{
    const dk = Object.keys(currentExternalDemand||{})[0];
    if (dk){ picker.setValue(dk); targetRateInput.value = currentExternalDemand[dk]; }
  }catch(e){/* ignore */}

  // reset button to clear selections and storage
  try{
    const resetBtn = createButton('重置', ()=>{
      selectedRecipesList = [];
      currentExternalDemand = {};
      localStorage.removeItem(STORAGE_KEY_SELECTED);
      localStorage.removeItem(STORAGE_KEY_DEMAND);
      renderSelected(); solveAndRender();
    }, {className: 'btn btn-outline'});
    // append reset button next to selectedRecipesDiv
    if (selectedRecipesDiv && selectedRecipesDiv.parentElement) selectedRecipesDiv.parentElement.appendChild(resetBtn);
  }catch(e){console.warn(e)}

  addTargetBtn.addEventListener('click', ()=>{
    const itemName = picker.getValue(); if (!itemName) return alert('请选择主要输出物品');
    const targetRate = parseNumber(targetRateInput.value || 0); if (!targetRate || targetRate<=0) return alert('请输入目标每分钟产量');
    currentExternalDemand = { [itemName]: targetRate };
    // open recipe picker to select which recipe produces this item
    openRecipePickerFor(itemName, (r)=>{
      // compute outputs per run for selected recipe for the target item
      let outPerRun = 0;
      for (let k=1;k<=3;k++){ if (r[`output${k}`]===itemName) outPerRun += parseNumber(r[`output${k}num`]); }
        const pct = parsePercent(r.percent);
        const mult = parseNumber(r.speedMultiplier || 2) || 1;
        const outAdj = outPerRun * pct * mult;
      if (!outAdj || outAdj <= 0) { alert('所选配方对该物品每次产量为0，无法作为主产'); renderSelected(); solveAndRender(); return; }
      const runsNeeded = targetRate / outAdj;
      r.fixedRuns = runsNeeded;
      // mark this recipe as the target recipe so future target edits update it
      r._isTarget = true;
      renderSelected(); solveAndRender();
    });
  });

  targetRateInput.addEventListener('input', ()=>{
    const itemName = picker.getValue(); if (!itemName) { currentExternalDemand = {}; solveAndRender(); return; }
    const targetRate = Number(targetRateInput.value || 0);
    if (targetRate && targetRate > 0) currentExternalDemand = { [itemName]: targetRate };
    else currentExternalDemand = {};
    // update any previously selected recipe that was marked as the target
    for (const r of selectedRecipesList){
      if (!r || !r._isTarget) continue;
      // compute outputs per run for this recipe for the target item
      let outPerRun = 0;
      for (let k=1;k<=3;k++){ if (r[`output${k}`]===itemName) outPerRun += parseNumber(r[`output${k}num`]); }
      const pct = parsePercent(r.percent);
      const mult = parseNumber(r.speedMultiplier || 2) || 1;
      const outAdj = outPerRun * pct * mult;
      if (!outAdj || outAdj <= 0) { delete r.fixedRuns; }
      else {
        if (targetRate && targetRate > 0) r.fixedRuns = targetRate / outAdj;
        else delete r.fixedRuns;
      }
    }
    renderSelected(); solveAndRender();
    saveState();
  });

  renderSelected();
  // after restoring selections/demand, compute and show results
  solveAndRender();
}

init();
