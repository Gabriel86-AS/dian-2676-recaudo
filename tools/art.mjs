// Imprime el texto de uno o varios artículos del paquete de fuentes, sin rótulos de notas.
// Uso: node tools/art.mjs <archivo> <art> [art...] [--max=N]
//   <archivo>: prefijo del archivo en dian_2676_recursos/dian_material/ (01, 02, 03, 04, 06, 08…)
//   Ej.: node tools/art.mjs 01 705 707 --max=800   ·   node tools/art.mjs 15 2.2.1.1.1.4.1
// Sin artículos, lista los encabezados encontrados.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const DIR = path.join(ROOT, 'dian_2676_recursos', 'dian_material');
const args = process.argv.slice(2);
const max = Number((args.find((a) => a.startsWith('--max=')) || '--max=1800').slice(6));
const [prefix, ...arts] = args.filter((a) => !a.startsWith('--'));
const file = fs.readdirSync(DIR).find((f) => f.startsWith(`${prefix}_`));
if (!file) { console.error(`No hay archivo que empiece por "${prefix}_" en ${DIR}`); process.exit(1); }

const lines = fs.readFileSync(path.join(DIR, file), 'utf8').split(/\r?\n/);
const HEAD = /^[\s ]*(?:ART[IÍ]CULO|Art[ií]culo)[\s ]*(\d+(?:[.-]\d+)*)\s*[.°ºo]?/u;
const idx = [];
lines.forEach((l, i) => { const m = l.normalize('NFC').match(HEAD); if (m) idx.push([m[1], i]); });
// Rótulos del compilador que no son texto del artículo.
const LABEL = /^(Notas de Vigencia|Notas del Editor|Legislación Anterior|Jurisprudencia|Concordancias|Doctrina Concordante)/i;

if (!arts.length) { console.log(idx.map(([a, i]) => `${a} (línea ${i + 1})`).join('\n')); process.exit(0); }
for (const a of arts) {
  const k = idx.findIndex(([x]) => x === a);
  if (k < 0) { console.log(`=== ${a}: NO ENCONTRADO en ${file}\n`); continue; }
  const end = k + 1 < idx.length ? idx[k + 1][1] : lines.length;
  const text = lines.slice(idx[k][1], end).map((l) => l.trim()).filter((l) => l && !(LABEL.test(l) && l.length < 40)).join(' ').replace(/\s+/g, ' ');
  console.log(`=== ${a} (${file}, línea ${idx[k][1] + 1})\n${text.length > max ? `${text.slice(0, max)} […]` : text}\n`);
}
