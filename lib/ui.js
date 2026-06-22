// UI helpers: item picker and recipe picker
function createItemPicker1(title='选择物品', items=[], onSelect=()=>{}, position='absolute'){
  // items: [{name,cate}, ...]
  const container = document.createElement('div');
  container.className = 'inline-middle';
  const btn = document.createElement('button'); btn.textContent = title; btn.type='button'; btn.className = 'btn';
  const display = document.createElement('span'); display.className = 'picker-display';
  container.appendChild(btn); container.appendChild(display);

  const popup = document.createElement('div');
  popup.style.position = position; popup.className = 'popup popup-wide modal-999'; popup.style.display = 'none';

  // group items by cate
  const groups = {};
  for (const it of items) { groups[it.cate] = groups[it.cate] || []; groups[it.cate].push(it.name); }
  for (const g of Object.keys(groups)){
    const gdiv = document.createElement('div');
    const title = document.createElement('div'); title.textContent = g; title.className = 'group-title'; gdiv.appendChild(title);
    const list = document.createElement('div'); list.className = 'grid-2col';
    for (const name of groups[g]){
      const b = document.createElement('button'); b.type='button'; b.textContent = name; b.className = 'btn btn-block';
      b.addEventListener('click', ()=>{
        display.textContent = name; popup.style.display='none';
        removeDocListener();
        if (onSelect) onSelect(name);
      });
      list.appendChild(b);
    }
    gdiv.appendChild(list);
    popup.appendChild(gdiv);
  }
  document.body.appendChild(popup);

  let docListener = null;
  function removeDocListener(){ if (docListener) { document.removeEventListener('click', docListener); docListener = null; } }

  display.addEventListener('dblclick', (ev)=>{
    ev.stopPropagation();
    const name = '';
    display.textContent = name;
    if (onSelect) onSelect(name);
  });
  btn.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const r = btn.getBoundingClientRect(); popup.style.top = (r.bottom+4)+'px'; popup.style.left = (r.left)+'px'; popup.style.display = popup.style.display==='none' ? 'block' : 'none';
    removeDocListener();
    docListener = (e)=>{ if (!popup.contains(e.target) && e.target !== btn) { popup.style.display='none'; removeDocListener(); } };
    document.addEventListener('click', docListener);
  });

  return {el: container, setValue: v=>{display.textContent=v;}, getValue: ()=>display.textContent || ''};
}

function createItemPicker2(title='选择物品', items=[], onSelect=()=>{}, position='absolute'){
  const container = document.createElement('div');
  container.className='inline-middle';
  const btn = document.createElement('button'); btn.textContent=title; btn.type='button'; btn.className='btn';
  const display = document.createElement('span'); display.className='picker-display';
  container.appendChild(btn); container.appendChild(display);

  const popup = document.createElement('div');
  popup.style.position=position; popup.className='popup popup-narrow modal-999'; popup.style.display = 'none';
  for (const b of items){
    const bt = document.createElement('button'); bt.type='button'; bt.textContent=b; bt.className='btn btn-block';
    bt.addEventListener('click', ()=>{
      display.textContent=b; popup.style.display='none';
      removeDocListener();
      if (onSelect) onSelect(b);
    });
    popup.appendChild(bt);
  }
  document.body.appendChild(popup);

  let docListener = null;
  function removeDocListener(){ if (docListener) { document.removeEventListener('click', docListener); docListener = null; } }

  display.addEventListener('dblclick', (ev)=>{
    ev.stopPropagation();
    const name = '';
    display.textContent = name;
    if (onSelect) onSelect(name);
  });
  btn.addEventListener('click', (ev)=>{
    ev.stopPropagation();
    const r=btn.getBoundingClientRect(); popup.style.top=(r.bottom+4)+'px'; popup.style.left=(r.left)+'px'; popup.style.display = popup.style.display==='none' ? 'block' : 'none';
    removeDocListener();
    docListener = (e)=>{ if (!popup.contains(e.target) && e.target !== btn) { popup.style.display='none'; removeDocListener(); } };
    document.addEventListener('click', docListener);
  });

  return {el: container, setValue: v=>{display.textContent=v;}, getValue: ()=>display.textContent || ''};
}

export function createItemPicker(title='选择物品', items=[], onSelect=()=>{}, position='absolute') {
  if (items.length == 0 || typeof items[0] === 'string') return createItemPicker2(title, items, onSelect, position);
  return createItemPicker1(title, items, onSelect, position);
}

export function createRecipePicker(recipes, itemName, onSelect){
  const container = document.createElement('div');
  const list = document.createElement('div');
  list.className = 'vlist';
  const filtered = recipes.filter(r=> r.output1===itemName || r.output2===itemName || r.output3===itemName );
  if (filtered.length===0){ list.textContent='无可用配方'; }
  for (let i=0;i<filtered.length;i++){
    const r=filtered[i];
    const b = document.createElement('button'); b.type='button';
    const outs = [];
    if (r.output1) outs.push(`${r.output1} x${r.output1num||1}`);
    if (r.output2) outs.push(`${r.output2} x${r.output2num||1}`);
    if (r.output3) outs.push(`${r.output3} x${r.output3num||1}`);
    b.textContent = `${r.building||''} → ${outs.join(', ')}`;
    b.addEventListener('click', ()=> onSelect(r)); b.className='btn';
    list.appendChild(b);
  }
  container.appendChild(list);
  return container;
}

// Create a simple select-based I/O row (used by index.js)
export function mkRow(items, isInput, idx){
  const wrap = document.createElement('div');
  wrap.className = 'row';
  const sel = document.createElement('select');
  const emptyOpt = document.createElement('option'); emptyOpt.value=''; emptyOpt.textContent='—'; sel.appendChild(emptyOpt);
  for (const it of items) { const o = document.createElement('option'); o.value = it.name; o.textContent = it.name; sel.appendChild(o); }
  sel.id = `${isInput?'input':'output'}${idx}`;
  const num = document.createElement('input'); num.type = 'text'; num.className = 'small'; num.id = `${isInput?'input':'output'}${idx}num`;
  wrap.appendChild(sel);
  wrap.appendChild(num);
  return wrap;
}

// Create I/O rows using item pickers (used by make_recipe.js)
export function mkIORows(items, inputsDiv, outputsDiv, position='absolute'){
  inputsDiv.innerHTML = '';
  outputsDiv.innerHTML = '';
  const maxRows = 3;
  const setValues = [];
  const getValues = [];
  for (let i=1;i<=maxRows;i++){
    const wrapIn = document.createElement('div'); wrapIn.className='row';
    const pickerIn = createItemPicker('选择物品', items, ()=>{}, position);
    const numIn = document.createElement('input'); numIn.type='text'; numIn.className='small'; numIn.id=`input${i}num`;
    pickerIn.el.className = pickerIn.el.className ? pickerIn.el.className + ' inline-middle' : 'inline-middle';
    wrapIn.appendChild(pickerIn.el); wrapIn.appendChild(numIn);
    inputsDiv.appendChild(wrapIn);

    const wrapOut = document.createElement('div'); wrapOut.className='row';
    const pickerOut = createItemPicker('选择物品', items, ()=>{}, position);
    const numOut = document.createElement('input'); numOut.type='text'; numOut.className='small'; numOut.id=`output${i}num`;
    pickerOut.el.className = pickerOut.el.className ? pickerOut.el.className + ' inline-middle' : 'inline-middle';
    wrapOut.appendChild(pickerOut.el); wrapOut.appendChild(numOut);
    outputsDiv.appendChild(wrapOut);
    setValues.push((values)=>{
      pickerIn.setValue(values[`input${i}`] || '');
      numIn.value = values[`input${i}num`] || '';
      pickerOut.setValue(values[`output${i}`] || '');
      numOut.value = values[`output${i}num`] || '';
    });
    getValues.push(()=>({
      [`input${i}`]: pickerIn.getValue(),
      [`input${i}num`]: numIn.value,
      [`output${i}`]: pickerOut.getValue(),
      [`output${i}num`]: numOut.value,
    }));
  }
  const setValue = (values)=>{
    for (const f of setValues) f(values);
  };
  const getValue = ()=>{
    return Object.assign({}, ...getValues.map(f=>f()));
  }
  return {setValue, getValue};
}

/** Create a simple table element.
 * @param {string[]} headers - array of header strings
 * @param {Array<Array<HTMLElement|string>>} rows - array of arrays (each row array length should match headers)
 * @param {{compact?: boolean, ratio?: number[]}} opts - options object
 */
export function createTable(headers, rows, opts={}){
  const table = document.createElement('table');
  if (opts.compact) table.className = 'compact-table';
  if (opts.ratio){
    table.style.gridTemplateColumns = opts.ratio.map(r=>r+'fr').join(' ');
  } else {
    table.style.gridTemplateColumns = headers.map(r=>'1fr').join(' ');
  }
  const thead = document.createElement('thead');
  const htr = document.createElement('tr');
  for (const h of headers){
    const th = document.createElement('th');
    th.textContent = h; th.className = 'bb';
    htr.appendChild(th);
  }
  thead.appendChild(htr); table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows){
    const tr = document.createElement('tr'); tr.className = 'bb';
    for (const cell of row){
      if (cell instanceof HTMLTableCellElement) { tr.appendChild(cell); continue; }
      const td = document.createElement('td');
      if (cell instanceof Node) td.appendChild(cell);
      else td.textContent = (cell===undefined||cell===null)?'':String(cell);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  return table;
}

export function createButton(text, listener=()=>{}, opts={}){
  const res = document.createElement('button');
  res.type='button'; res.textContent=text;
  if (listener) res.addEventListener('click', listener);
  if (opts.className) res.className = opts.className;
  if (opts.style) Object.assign(res.style, opts.style);
  res.classList.add('btn');
  return res;
}

/**
 * 
 * @template {keyof HTMLElementTagNameMap} K
 * @param {[HTMLElement|String]} children 
 * @param {{tagName: K, className?: string, style?: Partial<CSSStyleDeclaration>, preprocess?: function(HTMLElement|String): (HTMLElement|String|void)}} opts 
 * @returns {HTMLElementTagNameMap[K]}
 */
export function createDiv(children=[], opts={tagName:'div'}){
  const res = document.createElement(opts.tagName || 'div');
  for (const c of children) {
    const node = opts.preprocess ? (opts.preprocess(c) ?? c) : c;
    if (node instanceof Node) res.appendChild(node);
    else res.textContent += String(node);
  }
  if (opts.className) res.className = opts.className;
  if (opts.style) Object.assign(res.style, opts.style);
  return res;
}
