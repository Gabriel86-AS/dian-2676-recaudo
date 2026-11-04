// Auditoría de hechos: toma ~15 % de los ítems puntuables de cada unidad (muestra fija por semilla),
// busca el artículo citado en el paquete de fuentes y marca las cifras de la explicación
// que no aparecen en ese texto. Uso: node tools/audit-sample.mjs [--pct=15] [--all]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pct = Number((process.argv.find((a) => a.startsWith('--pct=')) || '--pct=15').slice(6));
const showAll = process.argv.includes('--all');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'manifest.json'), 'utf8'));

let seed = 2676;
const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

// Fuente → [prefijo de archivo, artículos]
const LAWS = [
  [/\bET\b|Estatuto Tributario/i, '01'], [/D(ecreto)?\s?1165/i, '02'], [/Ley 2586/i, '03'],
  [/D(ecreto)?\s?1742/i, '04'], [/D(L|ecreto Ley|ecreto)?\s?2245/i, '08'],
];
const cache = new Map();
function article(prefix, art) {
  const k = `${prefix}:${art}`;
  if (!cache.has(k)) {
    try { cache.set(k, execFileSync('node', [path.join(ROOT, 'tools', 'art.mjs'), prefix, art, '--max=100000'], { encoding: 'utf8' })); }
    catch { cache.set(k, ''); }
  }
  return cache.get(k);
}
function sourceText(source) {
  const law = LAWS.find(([re]) => re.test(source));
  if (!law) return null;
  const arts = [...source.matchAll(/\b(?:arts?\.?|art[ií]culos?)\s*([\d\-–,y\s]+)/gi)]
    .flatMap((m) => m[1].split(/[,y\s]+/)).flatMap((t) => {
      const r = t.match(/^(\d+)[–-](\d+)$/);
      if (r && Number(r[2]) > Number(r[1]) && Number(r[2]) - Number(r[1]) < 15) return Array.from({ length: Number(r[2]) - Number(r[1]) + 1 }, (_, i) => String(Number(r[1]) + i));
      return /^\d+(-\d+)?$/.test(t) ? [t] : [];
    });
  if (!arts.length) return null;
  return arts.map((a) => article(law[1], a)).join(' ');
}
const WORDS = { 1: 'un', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez', 15: 'quince', 20: 'veinte', 30: 'treinta' };
const textOf = (q) => [q.explain, q.statement, q.text, q.modelAnswer, q.back].filter(Boolean).join(' ');
// Cifras normativas (plazos y porcentajes), no datos de ejemplos.
const claims = (s) => [...s.matchAll(/(\d+(?:[.,]\d+)?)\s*(%|años?|meses|mes|días(?: hábiles)?|UVT)/gi)].map((m) => [m[1], m[2]]);

let total = 0, flagged = 0;
for (const u of manifest.units.filter((x) => !x.pending && !x.demo)) {
  const unit = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', u.file), 'utf8'));
  const items = [...unit.questions.filter((q) => q.type !== 'likert'), ...(unit.flashcards || [])];
  const n = Math.max(2, Math.round((items.length * pct) / 100));
  const sample = [...items].sort(() => rnd() - 0.5).slice(0, n);
  console.log(`\n### ${u.id} (${n} de ${items.length})`);
  for (const q of sample) {
    total++;
    const src = q.source || '';
    const law = sourceText(src);
    const t = textOf(q);
    let note = 'revisión manual (fuente no articulada)';
    if (law === '') note = 'ARTÍCULO NO ENCONTRADO';
    else if (law) {
      const plain = law.replace(/\./g, '');
      const miss = claims(t).filter(([num]) => {
        const n0 = num.replace(/\./g, '');
        return !plain.includes(`(${n0}`) && !new RegExp(`\\b${n0}\\b`).test(plain) && !(WORDS[n0] && new RegExp(`\\b${WORDS[n0]}\\b`, 'i').test(plain));
      });
      note = miss.length ? `REVISAR: ${miss.map((m) => m.join(' ')).join(', ')} no aparece en el artículo` : 'cifras OK';
    }
    if (/REVISAR|NO ENCONTRADO/.test(note)) flagged++;
    if (showAll || !/cifras OK/.test(note)) console.log(`${q.id} | ${src} | ${note}\n    ${t.slice(0, 260)}`);
  }
}
console.log(`\nMuestra: ${total} ítems · marcados para revisar: ${flagged}`);
