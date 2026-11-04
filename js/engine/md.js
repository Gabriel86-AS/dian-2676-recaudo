// Markdown mínimo y seguro: escapa todo el HTML y luego aplica
// **negrita**, *cursiva*, `código`, listas, tablas y títulos (##).
import { esc } from '../util.js';

export function inline(s) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(«"])\*([^*\s][^*]*?)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}

function kind(line) {
  if (!line.trim()) return 'blank';
  if (/^\s*[-*] /.test(line)) return 'ul';
  if (/^\s*\d+[.)] /.test(line)) return 'ol';
  if (/^\s*\|/.test(line)) return 'table';
  if (/^#{1,4} /.test(line)) return 'h';
  return 'p';
}

function table(lines) {
  const rows = lines.map((l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
  const isSep = (r) => r.every((c) => /^:?-{2,}:?$/.test(c));
  const head = rows[0];
  const body = rows.slice(rows[1] && isSep(rows[1]) ? 2 : 1);
  return `<div class="table-wrap"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>`
    + `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

export function md(src) {
  const lines = String(src ?? '').replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const k = kind(lines[i]);
    if (k === 'blank') { i++; continue; }
    if (k === 'h') { out.push(`<h3>${inline(lines[i].replace(/^#+ /, ''))}</h3>`); i++; continue; }
    const group = [];
    while (i < lines.length && kind(lines[i]) === k) group.push(lines[i++]);
    if (k === 'ul') out.push(`<ul>${group.map((l) => `<li>${inline(l.replace(/^\s*[-*] /, ''))}</li>`).join('')}</ul>`);
    else if (k === 'ol') out.push(`<ol>${group.map((l) => `<li>${inline(l.replace(/^\s*\d+[.)] /, ''))}</li>`).join('')}</ol>`);
    else if (k === 'table') out.push(table(group));
    else out.push(`<p>${group.map(inline).join(' ')}</p>`);
  }
  return out.join('');
}
