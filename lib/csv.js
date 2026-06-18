export async function fetchCSV(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  return parseCSV(text);
}

export function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").split('\n').filter((l,i)=>!(l.trim()==='' && i>0));
  if (lines.length === 0) return [];
  const headers = splitLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = splitLine(line);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = parts[j] !== undefined ? parts[j] : '';
    }
    rows.push(obj);
  }
  return rows;
}

function splitLine(line) {
  // Simple CSV splitter that supports quoted fields
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out.map(s=>s.trim());
}

export function stringifyCSV(rows, headers, {percentWithPercent=false} = {}) {
  const cols = headers || (rows.length ? Object.keys(rows[0]) : []);
  const esc = v => {
    if (v === null || v === undefined) v = '';
    v = String(v);
    if (v.indexOf(',') !== -1 || v.indexOf('"') !== -1 || v.indexOf('\n') !== -1) {
      return '"' + v.replace(/"/g, '""') + '"';
    }
    return v;
  };
  const lines = [];
  lines.push(cols.join(','));
  for (const r of rows) {
    const parts = cols.map(c => {
      let v = r[c] !== undefined ? r[c] : '';
      if (percentWithPercent && c === 'percent') {
        v = String(v).replace(/%$/, '') + '%';
      }
      return esc(v);
    });
    lines.push(parts.join(','));
  }
  return lines.join('\n');
}
