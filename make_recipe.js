import { fetchCSV, parseCSV, stringifyCSV } from './lib/csv.js';
import { createItemPicker, mkIORows } from './lib/ui.js';
import { parseNumber, parsePercent } from './lib/utils.js';
import { loadItems, loadBuildings, loadRecipes as fetchRecipes } from './lib/data.js';

const headers = ['building','tempture','input1','input1num','input2','input2num','input3','input3num','output1','output1num','output2','output2num','output3','output3num','time','percent'];

const inputsDiv = document.getElementById('inputs');
const outputsDiv = document.getElementById('outputs');
const recipesCsvTa = document.getElementById('recipesCsv');
const addBtn = document.getElementById('addRecipe');
const importBtn = document.getElementById('importRecipes');

let items = [];
let buildings = [];
let recipes = [];
let ioRows;

async function loadLookups(){
  items = await loadItems();
  buildings = await loadBuildings();
  // building picker
  const bp = createItemPicker('选择建筑', buildings, ()=>{});
  document.getElementById('buildingPicker').appendChild(bp.el);
}

async function loadRecipes(){
  recipes = await fetchRecipes();
  updateTextarea();
}

function updateTextarea(){
  recipesCsvTa.value = stringifyCSV(recipes, headers, {percentWithPercent:true});
}

function gatherForm(){
  const obj = {};
  const buildingDisplay = document.querySelector('#buildingPicker span');
  obj.building = buildingDisplay ? buildingDisplay.textContent || '' : '';
  obj.tempture = document.getElementById('tempture').value || '0';
  if (ioRows) {
    Object.assign(obj, ioRows.getValue());
  }
  obj.time = document.getElementById('time').value || '';
  obj.percent = document.getElementById('percent').value || '100';
  return obj;
}

addBtn.addEventListener('click', ()=>{
  const r = gatherForm();
  const ordered = {};
  for (const h of headers) ordered[h] = r[h] !== undefined ? r[h] : '';
  recipes.push(ordered);
  updateTextarea();
});

importBtn.addEventListener('click', ()=> loadRecipes());

async function init(){
  await loadLookups();
  ioRows = mkIORows(items, inputsDiv, outputsDiv);
  await loadRecipes();
}

init();
