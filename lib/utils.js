export function parseNumber(v){
  if (v == null || v === '') return 0;
  return Number(String(v).replace('%','')) || 0;
}

export function parsePercent(v){
  if (v == null || v === '') return 1;
  const n = Number(String(v).replace('%',''));
  if (isNaN(n)) return 1;
  return n / 100;
}

export function formatPercent(v){
  if (v == null || v === '') return '';
  return String(v).replace(/%$/,'') + '%';
}

export function round(n){
  return Math.round(n * 100) / 100;
}

export function escapeHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
