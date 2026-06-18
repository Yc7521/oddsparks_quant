import { stringifyCSV } from './lib/csv.js';
import { createItemPicker, mkIORows } from './lib/ui.js';
import { parseNumber, parsePercent, round } from './lib/utils.js';
import { loadItems, loadRecipes as fetchRecipes } from './lib/data.js';

const RECIPES_CSV = 'data/recipes.csv';
const headers = ['building','tempture','input1','input1num','input2','input2num','input3','input3num','output1','output1num','output2','output2num','output3','output3num','time','percent'];

let recipes = [];
let itemsList = [];
const tableBody = document.querySelector('#recipesTable tbody');
const csvPreview = document.getElementById('csvPreview');
const modalRoot = document.getElementById('modalRoot');
const filterBuildingRoot = document.getElementById('filterBuildingRoot');
const filterItem = document.getElementById('filterItem');
const filterItemPickerRoot = document.getElementById('filterItemPickerRoot');
const filterItemClear = document.getElementById('filterItemClear');
const filterTemp = document.getElementById('filterTemp');
const resetFiltersBtn = document.getElementById('resetFilters');

let currentFilters = { building: '', item: '', temp: 'all' };

let buildingPickerFilter = null;
let itemPickerFilter = null;

document.getElementById('reloadBtn').addEventListener('click', loadRecipes);
document.getElementById('downloadBtn').addEventListener('click', downloadCSV);

async function loadRecipes(){
  const [r, items] = await Promise.all([fetchRecipes(), loadItems()]);
  recipes = r || [];
  itemsList = items || [];
  buildFilterOptions();
  buildItemFilterPicker();
  renderTable();
  updateCSVPreview();
}

function buildFilterOptions(){
  // populate building picker with unique buildings
  const set = new Set();
  recipes.forEach(r=>{ if(r.building) set.add(r.building); });
  const vals = Array.from(set).sort();
  // recreate picker
  if (buildingPickerFilter && buildingPickerFilter.el) { buildingPickerFilter.el.remove(); buildingPickerFilter = null; }
  buildingPickerFilter = createItemPicker('选择建筑', vals, (b)=>{ currentFilters.building = b; renderTable(); });
  filterBuildingRoot.innerHTML = '';
  filterBuildingRoot.appendChild(buildingPickerFilter.el);
}

filterItem.addEventListener('input', ()=>{ currentFilters.item = filterItem.value.trim(); renderTable(); });
filterTemp.addEventListener('change', ()=>{ currentFilters.temp = filterTemp.value; renderTable(); });
filterItemClear.addEventListener('click', ()=>{ filterItem.value=''; currentFilters.item=''; if(itemPickerFilter) itemPickerFilter.setValue(''); renderTable(); });
resetFiltersBtn.addEventListener('click', ()=>{ currentFilters = {building:'',item:'',temp:'all'}; if(buildingPickerFilter) buildingPickerFilter.setValue(''); if(itemPickerFilter) itemPickerFilter.setValue(''); filterItem.value=''; filterTemp.value='all'; renderTable(); });

function buildItemFilterPicker(){
  if(itemPickerFilter && itemPickerFilter.el){ itemPickerFilter.el.remove(); itemPickerFilter=null; }
  // itemsList expected as [{name,cate},...]
  itemPickerFilter = createItemPicker('选择物品', itemsList, (name)=>{ filterItem.value = name; currentFilters.item = name; renderTable(); });
  filterItemPickerRoot.innerHTML = '';
  filterItemPickerRoot.appendChild(itemPickerFilter.el);
}

function updateCSVPreview(){
  csvPreview.value = stringifyCSV(recipes, headers, {percentWithPercent:true});
}

function renderTable(){
  tableBody.innerHTML = '';
  const list = applyFilters(recipes);
  list.forEach((r, idx) => {
    const tr = document.createElement('tr');

    const tdBuilding = document.createElement('td');
    tdBuilding.textContent = r.building || '';
    tr.appendChild(tdBuilding);

    const tdOutputs = document.createElement('td');
    tdOutputs.innerHTML = formatOutputsPerMin(r);
    tr.appendChild(tdOutputs);

    const tdInputs = document.createElement('td');
    tdInputs.innerHTML = formatInputsPerMin(r);
    tr.appendChild(tdInputs);

    const tdTemp = document.createElement('td');
    tdTemp.textContent = r.tempture || '';
    tr.appendChild(tdTemp);

    const tdPercent = document.createElement('td');
    tdPercent.textContent = r.percent || '';
    tr.appendChild(tdPercent);

    const tdActions = document.createElement('td');
    tdActions.className = 'actions';
    const editBtn = document.createElement('button'); editBtn.textContent = '修改';
    const delBtn = document.createElement('button'); delBtn.textContent = '删除';
    const copyBtn = document.createElement('button'); copyBtn.textContent = '复制';

    // edit/delete/copy operate on original recipes array; find original index
    editBtn.addEventListener('click', ()=> openEditModal(getOriginalIndex(r)));
    delBtn.addEventListener('click', ()=> { if(confirm('确认删除该配方？')){ const oi=getOriginalIndex(r); if(oi>=0){ recipes.splice(oi,1); buildFilterOptions(); renderTable(); updateCSVPreview(); } } });
    copyBtn.addEventListener('click', ()=> { const clone = JSON.parse(JSON.stringify(r||{})); const oi=getOriginalIndex(r); recipes.splice(oi+1,0,clone); buildFilterOptions(); renderTable(); updateCSVPreview(); });

    tdActions.appendChild(editBtn);
    tdActions.appendChild(delBtn);
    tdActions.appendChild(copyBtn);
    tr.appendChild(tdActions);

    tableBody.appendChild(tr);
  });
}

function getOriginalIndex(r){
  // find by object identity or deep-equal fallback
  const idx = recipes.indexOf(r);
  if(idx>=0) return idx;
  for(let i=0;i<recipes.length;i++){
    if(JSON.stringify(recipes[i])===JSON.stringify(r)) return i;
  }
  return -1;
}

function applyFilters(list){
  return list.filter(r=>{
    // building
    if(currentFilters.building){ if((r.building||'') !== currentFilters.building) return false; }
    // item (in inputs or outputs)
    if(currentFilters.item){ const q = currentFilters.item.toLowerCase(); let found=false; for(let i=1;i<=3;i++){ if((r[`input${i}`]||'').toLowerCase().includes(q)) found=true; if((r[`output${i}`]||'').toLowerCase().includes(q)) found=true; } if(!found) return false; }
    // temp
    if(currentFilters.temp && currentFilters.temp!=='all'){
      const t = parseNumber(r.tempture);
      if(currentFilters.temp==='zero' && !(t===0)) return false;
      if(currentFilters.temp==='positive' && !(t>0)) return false;
      if(currentFilters.temp==='negative' && !(t<0)) return false;
    }
    return true;
  });
}

function formatOutputsPerMin(r){
  const t = parseNumber(r.time) || 60;
  const parts = [];
  for(let i=1;i<=3;i++){
    const name = r[`output${i}`];
    const num = parseNumber(r[`output${i}num`]);
    if(name && num){
      const perMin = (num * 60 / t);
      parts.push(`${name} (${round(perMin)}/min)`);
    }
  }
  return parts.join('<br>');
}

function formatInputsPerMin(r){
  const t = parseNumber(r.time) || 60;
  const parts = [];
  for(let i=1;i<=3;i++){
    const name = r[`input${i}`];
    const num = parseNumber(r[`input${i}num`]);
    if(name && num){
      const perMin = (num * 60 / t);
      parts.push(`${name} (${round(perMin)}/min)`);
    }
  }
  return parts.join('<br>');
}

function openEditModal(idx){
  const r = recipes[idx] || {};
  // overlay
  const overlay = document.createElement('div'); overlay.className='overlay';
  const modal = document.createElement('div'); modal.className='center-modal modal-100';

  modal.innerHTML = `
    <h2>编辑配方</h2>
    <div class="row"><div class="label">建筑</div><div id="m_building_picker_root"></div></div>
    <div class="row"><div class="label">温度</div><input id="m_tempture" /></div>
    <div class="row"><div class="label">制作时间(秒)</div><input id="m_time" class="small" type="number" /></div>
    <div class="row"><div class="label">百分比</div><input id="m_percent" class="small" /></div>
    <fieldset>
      <legend>输入 (最多 3)</legend>
      <div id="inputs"></div>
    </fieldset>
    <fieldset>
      <legend>输出 (最多 3)</legend>
      <div id="outputs"></div>
    </fieldset>
    <div class="mt-12 text-right">
      <button id="cancelBtn">取消</button>
      <button id="saveBtn">确认</button>
    </div>
  `;

  modalRoot.appendChild(overlay);
  modalRoot.appendChild(modal);

  // fill values
  // create building picker inside modal
  const m_building_root = modal.querySelector('#m_building_picker_root');
  const buildingVals = Array.from(new Set(recipes.map(x=>x.building).filter(Boolean))).sort();
  const buildingPickerModal = createItemPicker('选择建筑', buildingVals, (b)=>{/* selection handled on save via getValue */}, 'fixed');
  m_building_root.appendChild(buildingPickerModal.el);
  buildingPickerModal.setValue(r.building || '');
  modal.querySelector('#m_tempture').value = r.tempture || '';
  modal.querySelector('#m_tempture').value = r.tempture || '';
  modal.querySelector('#m_time').value = r.time || '';
  modal.querySelector('#m_percent').value = r.percent ? String(r.percent).replace('%','') : '';

  const inputsDiv = modal.querySelector('#inputs');
  const outputsDiv = modal.querySelector('#outputs');
  const ioRows = mkIORows(itemsList, inputsDiv, outputsDiv, 'fixed');
  ioRows.setValue(r);

  modal.querySelector('#cancelBtn').addEventListener('click', ()=>{ overlay.remove(); modal.remove(); });

  modal.querySelector('#saveBtn').addEventListener('click', ()=>{
    // gather
    const nb = {};
    nb.building = (buildingPickerModal && buildingPickerModal.getValue()) || '';
    nb.tempture = modal.querySelector('#m_tempture').value || '';
    nb.time = modal.querySelector('#m_time').value || '';
    const pct = modal.querySelector('#m_percent').value || '';
    nb.percent = pct===''? '': (String(pct).endsWith('%')? pct : pct + '%');

    Object.assign(nb, ioRows.getValue());

    // replace
    recipes[idx] = nb;
    overlay.remove(); modal.remove();
    renderTable(); updateCSVPreview();
  });
}

function downloadCSV(){
  const text = stringifyCSV(recipes, headers, {percentWithPercent:true});
  const blob = new Blob([text], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'recipes.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

// initial load
loadRecipes();
