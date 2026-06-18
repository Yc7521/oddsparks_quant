import { fetchCSV } from './csv.js';

export async function loadItems(){
  const itemsData = await fetchCSV('data/items.csv');
  return (itemsData || []).map(r=>({name: r.name, cate: r.cate}));
}

export async function loadBuildings(){
  const bdata = await fetchCSV('data/buildings.csv');
  return (bdata || []).map(r=>({name: r.name, cate: r.cate}));
}

export async function loadRecipes(){
  try{
    return await fetchCSV('data/recipes.csv');
  }catch(e){
    return [];
  }
}

export async function loadAll(){
  const [items, buildings, recipes] = await Promise.all([
    loadItems(), loadBuildings(), loadRecipes()
  ]);
  return {items, buildings, recipes};
}
