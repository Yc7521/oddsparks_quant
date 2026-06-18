import { createItemPicker, createRecipePicker } from './lib/ui.js';
import { solveSelectedRecipes } from './lib/calc.js';
import { parseNumber, parsePercent } from './lib/utils.js';
import { loadItems, loadRecipes as fetchRecipes } from './lib/data.js';

let items = [];
let recipes = [];
let selectedRecipesList = [];
let currentExternalDemand = {};

const itemPickerContainer = document.getElementById('itemPickerContainer');
const targetRateInput = document.getElementById('targetRate');
const addTargetBtn = document.getElementById('addTargetRecipe');
const selectedRecipesDiv = document.getElementById('selectedRecipes');
const calcResultDiv = document.getElementById('calcResult');

async function loadData(){
  items = await loadItems();
  recipes = await fetchRecipes();
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
  const table = document.createElement('table'); table.style.width='100%'; table.style.borderCollapse='collapse';
  const thead = document.createElement('thead'); const htr = document.createElement('tr'); ['','建筑','配方','倍率','操作'].forEach(h=>{ const th = document.createElement('th'); th.textContent = h; th.style.borderBottom='1px solid #ccc'; th.style.textAlign='left'; th.style.padding='6px'; htr.appendChild(th); }); thead.appendChild(htr); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  selectedRecipesList.forEach((r, idx)=>{
    const tr = document.createElement('tr'); tr.style.borderBottom='1px solid #eee';
    // controls
    const ctrlTd = document.createElement('td'); ctrlTd.style.padding='6px';
    const topBtn = document.createElement('button'); topBtn.type='button'; topBtn.textContent='置顶'; topBtn.addEventListener('click', ()=>{ moveRecipe(idx,0); renderSelected(); solveAndRender(); });
    const upBtn = document.createElement('button'); upBtn.type='button'; upBtn.textContent='上移'; upBtn.addEventListener('click', ()=>{ moveRecipe(idx, idx-1); renderSelected(); solveAndRender(); });
    const downBtn = document.createElement('button'); downBtn.type='button'; downBtn.textContent='下移'; downBtn.addEventListener('click', ()=>{ moveRecipe(idx, idx+1); renderSelected(); solveAndRender(); });
    const bottomBtn = document.createElement('button'); bottomBtn.type='button'; bottomBtn.textContent='置底'; bottomBtn.addEventListener('click', ()=>{ moveRecipe(idx, selectedRecipesList.length-1); renderSelected(); solveAndRender(); });
    [topBtn, upBtn, downBtn, bottomBtn].forEach(b=>{ b.style.marginRight='4px'; ctrlTd.appendChild(b); });
    tr.appendChild(ctrlTd);
    // building
    const btd = document.createElement('td'); btd.style.padding='6px'; btd.textContent = r.building || ''; tr.appendChild(btd);
    // recipe details (inputs and outputs)
    const rtd = document.createElement('td'); rtd.style.padding='6px';
    const outs = [];
    for (let k=1;k<=3;k++) if (r[`output${k}`]) outs.push(`${r[`output${k}`]} x${r[`output${k}num`]||1}`);
    const ins = [];
    for (let k=1;k<=3;k++) if (r[`input${k}`]) ins.push(`${r[`input${k}`]} x${r[`input${k}num`]||1}`);
    rtd.innerHTML = `<div><b>输出:</b> ${outs.join(', ')}</div><div><b>输入:</b> ${ins.join(', ')}</div>`;
    tr.appendChild(rtd);
    // multiplier controls
    const mtd = document.createElement('td'); mtd.style.padding='6px';
    const dec = document.createElement('button'); dec.type='button'; dec.textContent='-';
    const inc = document.createElement('button'); inc.type='button'; inc.textContent='+';
    const inp = document.createElement('input'); inp.type='number'; inp.step='0.5'; inp.min='0.5'; inp.max='5'; inp.style.width='60px'; inp.value = (r.speedMultiplier===undefined?2:r.speedMultiplier);
    dec.addEventListener('click', ()=>{ const cur = parseFloat(inp.value)||2; let v = cur - 0.5; if (v < 0.5) v = 0.5; v = Math.round(v*2)/2; inp.value = v; r.speedMultiplier = parseFloat(inp.value); renderSelected(); solveAndRender(); });
    inc.addEventListener('click', ()=>{ const cur = parseFloat(inp.value)||2; let v = cur + 0.5; if (v > 5) v = 5; v = Math.round(v*2)/2; inp.value = v; r.speedMultiplier = parseFloat(inp.value); renderSelected(); solveAndRender(); });
    inp.addEventListener('change', ()=>{ let v = parseFloat(inp.value)||2; if (isNaN(v)) v = 2; if (v < 0.5) v = 0.5; if (v > 5) v = 5; v = Math.round(v*2)/2; inp.value = v; r.speedMultiplier = v; renderSelected(); solveAndRender(); });
    [dec, inp, inc].forEach(e=>{ e.style.marginRight='4px'; mtd.appendChild(e); });
    tr.appendChild(mtd);
    // remove
    const rmd = document.createElement('td'); rmd.style.padding='6px'; const rem = document.createElement('button'); rem.type='button'; rem.textContent='移除'; rem.addEventListener('click', ()=>{ selectedRecipesList.splice(idx,1); renderSelected(); solveAndRender(); }); rmd.appendChild(rem); tr.appendChild(rmd);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  selectedRecipesDiv.appendChild(table);
}

function renderResult(res){
  calcResultDiv.innerHTML='';
  if (!res) { calcResultDiv.textContent='无法求解或未选择配方'; return; }
  // table-like layout header
  const header = document.createElement('div'); header.style.display='grid'; header.style.gridTemplateColumns='2fr 1fr 3fr 3fr'; header.style.fontWeight='700'; header.style.gap='8px';
  header.innerHTML = '<div>建筑</div><div>数量</div><div>输出 (每分钟)</div><div>输入 (每分钟)</div>';
  calcResultDiv.appendChild(header);
  // per-recipe rows
  for (let j=0;j<selectedRecipesList.length;j++){
    const r = selectedRecipesList[j];
    const runs = res.runs[j] || 0;
    const aruns = res.actualRuns[j] || 0;
    const buildingCount = res.buildings[j] || 0;
    const outs = document.createElement('div');
    outs.style.whiteSpace='pre-wrap';
    const mult = parseNumber(r.speedMultiplier || 2) || 1;
    for (let k=1;k<=3;k++){ if (r[`output${k}`]) { const v = parseNumber(r[`output${k}num`]) * parsePercent(r.percent) * mult; outs.appendChild(document.createTextNode(`${r[`output${k}`]}: ${aruns * v}(${(runs * v).toFixed(2)})\n`)); } }
    const ins = document.createElement('div'); ins.style.whiteSpace='pre-wrap';
    for (let k=1;k<=3;k++){ if (r[`input${k}`]) { const v = parseNumber(r[`input${k}num`]) * mult; ins.appendChild(document.createTextNode(`${r[`input${k}`]}: ${aruns * v}(${(runs * v).toFixed(2)})\n`)); } }
    const row = document.createElement('div'); row.style.display='grid'; row.style.gridTemplateColumns='2fr 1fr 3fr 3fr'; row.style.gap='8px'; row.style.alignItems='start';
    const title = document.createElement('div'); title.textContent = r.building || '';
    const count = document.createElement('div'); count.textContent = `${Math.ceil(buildingCount)}(${buildingCount.toFixed(2)})`;
    row.appendChild(title); row.appendChild(count); row.appendChild(outs); row.appendChild(ins);
    calcResultDiv.appendChild(row);
  }

  // show aggregated actual outputs and needed external inputs side-by-side
  const aggWrap = document.createElement('div'); aggWrap.style.display='flex'; aggWrap.style.gap='12px'; aggWrap.style.marginTop='12px';
  const outBox = document.createElement('div'); outBox.style.flex='1'; outBox.innerHTML = '<b>实际输出产品 (每分钟)</b>';
  const reqBox = document.createElement('div'); reqBox.style.flex='1'; reqBox.innerHTML = '<b>需要的外部输入 (每分钟)</b>';
  const actualOut = res.actualOut || {};
  const outTable = document.createElement('table'); outTable.style.width='100%';
  for (const k of Object.keys(actualOut)){
    const v = actualOut[k]; if (Math.abs(v) < 1e-9) continue;
    const tr = document.createElement('tr'); const td1 = document.createElement('td'); td1.textContent = k; const td2 = document.createElement('td'); td2.textContent = v.toFixed(2); tr.appendChild(td1); tr.appendChild(td2); outTable.appendChild(tr);
  }
  const keys = Object.keys(res.softIn||{});
  const reqTable = document.createElement('table'); reqTable.style.width='100%';
  if (keys.length===0){ const tr = document.createElement('tr'); const td = document.createElement('td'); td.colSpan = 3; td.textContent='（无）'; tr.appendChild(td); reqTable.appendChild(tr); }
  for (const k of keys){
    const v = res.softIn[k];
    const tr = document.createElement('tr');
    const td1 = document.createElement('td'); td1.textContent = k; td1.style.padding='6px';
    const td2 = document.createElement('td'); td2.textContent = v.toFixed(2); td2.style.padding='6px';
    const td3 = document.createElement('td'); td3.style.padding='6px';
    const btn = document.createElement('button'); btn.type='button'; btn.textContent='为此选择配方'; btn.addEventListener('click', ()=>{ openRecipePickerFor(k); });
    td3.appendChild(btn);
    tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
    reqTable.appendChild(tr);
  }
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
  const picker = createItemPicker('选择物品', items, ()=>{});
  itemPickerContainer.appendChild(picker.el);

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
      renderSelected(); solveAndRender();
    });
  });

  targetRateInput.addEventListener('input', ()=>{
    const itemName = picker.getValue(); if (!itemName) { currentExternalDemand = {}; solveAndRender(); return; }
    const targetRate = Number(targetRateInput.value || 0);
    if (targetRate && targetRate > 0) currentExternalDemand = { [itemName]: targetRate };
    else currentExternalDemand = {};
    solveAndRender();
  });

  renderSelected();
}

init();
