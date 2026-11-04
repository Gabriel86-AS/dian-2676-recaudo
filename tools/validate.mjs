// Valida el contenido: node tools/validate.mjs [unidad...]
// Revisa IDs únicos, campos por tipo, respuestas, fuentes, referencias y el manifiesto,
// e imprime estadísticas de volumen y equilibrio de opciones por unidad.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '..');
const C = (p) => path.join(ROOT, 'content', p);
const PREFIX = {
  recaudo: 'rec', 'recepcion-declaraciones': 'decl', 'entidades-recaudadoras': 'erec', 'extincion-obligaciones': 'ext',
  'titulos-ejecutivos': 'tit', devoluciones: 'dev', 'principios-contables': 'cont', 'analitica-datos': 'dat',
  estructura: 'estr', misionalidad: 'mis', razonamiento: 'raz', comportamentales: 'comp', integridad: 'integ', _ejemplo: 'ej',
};
const TYPES = ['concept', 'mcq', 'pjs', 'truefalse', 'open', 'order', 'match', 'cloze', 'likert', 'flashcard'];
const errors = [];
const warns = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warns.push(`${where}: ${msg}`);
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

const manifest = JSON.parse(fs.readFileSync(C('manifest.json'), 'utf8'));
const only = process.argv.slice(2);
const seen = new Map(); // id → dónde

function claim(id, where) {
  if (!nonEmpty(id)) return err(where, 'id vacío');
  if (seen.has(id)) err(where, `id duplicado "${id}" (también en ${seen.get(id)})`);
  seen.set(id, where);
}

function checkItem(it, where, prefix) {
  if (!TYPES.includes(it.type)) return err(where, `tipo desconocido "${it.type}"`);
  if (it.type !== 'concept' && !nonEmpty(it.source)) err(where, 'falta source');
  if (!it.id?.startsWith(`${prefix}-`)) err(where, `id "${it.id}" no usa el prefijo ${prefix}-`);
  if (it.type !== 'flashcard' && it.type !== 'concept' && ![1, 2, 3].includes(it.difficulty)) err(where, 'difficulty debe ser 1, 2 o 3');
  const need = (...fields) => fields.forEach((f) => {
    const v = it[f];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) err(where, `falta ${f}`);
  });
  switch (it.type) {
    case 'concept': need('title', 'body'); break;
    case 'mcq': case 'pjs': {
      need('prompt', 'options', 'answer', 'explain');
      if (it.type === 'pjs') {
        need('case');
        if (it.options?.length !== 3) err(where, 'pjs debe tener exactamente 3 opciones');
        if (it.options && it.options.map((o) => o.id).join('') !== 'abc') err(where, 'pjs: ids de opciones deben ser a, b, c');
      }
      const ids = (it.options || []).map((o) => o.id);
      if (new Set(ids).size !== ids.length) err(where, 'ids de opciones repetidos');
      if (!ids.includes(it.answer)) err(where, `answer "${it.answer}" no está entre las opciones`);
      (it.options || []).forEach((o) => { if (!nonEmpty(o.text)) err(where, `opción ${o.id} sin texto`); });
      for (const id of ids) if (id !== it.answer && !nonEmpty(it.optionWhy?.[id])) err(where, `falta optionWhy.${id}`);
      break;
    }
    case 'truefalse': need('statement', 'explain'); if (typeof it.answer !== 'boolean') err(where, 'answer debe ser true/false'); break;
    case 'open':
      need('prompt', 'modelAnswer', 'keyPoints', 'keywords');
      if (it.keywords && it.keywords.some((k) => k !== k.toLowerCase())) err(where, 'keywords deben ir en minúsculas');
      if (it.minKeywords > (it.keywords?.length || 0)) err(where, 'minKeywords mayor que el número de keywords');
      break;
    case 'order': need('prompt', 'items'); if ((it.items?.length || 0) < 3) err(where, 'order necesita ≥ 3 elementos'); break;
    case 'match': need('prompt', 'pairs'); if ((it.pairs?.length || 0) < 3) err(where, 'match necesita ≥ 3 parejas'); break;
    case 'cloze': {
      need('text');
      const gaps = [...String(it.text).matchAll(/\{\{(.+?)\}\}/g)].length;
      if (!gaps) err(where, 'cloze sin huecos {{…}}');
      break;
    }
    case 'likert': need('statement', 'competency'); break;
    case 'flashcard': need('front', 'back'); break;
  }
}

const report = [];
for (const entry of manifest.units) {
  const file = C(entry.file);
  const exists = fs.existsSync(file);
  if (exists && entry.pending) err(`manifest ${entry.id}`, 'tiene archivo pero sigue con "pending": true');
  if (!exists && !entry.pending) err(`manifest ${entry.id}`, `falta ${entry.file} (márcalo "pending": true)`);
  if (!exists || (only.length && !only.includes(entry.id))) continue;

  let unit;
  try { unit = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { err(entry.file, `JSON inválido: ${e.message}`); continue; }
  const prefix = PREFIX[entry.id];
  const U = entry.id;
  if (unit.id !== entry.id) err(U, `id de la unidad "${unit.id}" ≠ manifiesto "${entry.id}"`);
  for (const f of ['title', 'area', 'summary']) if (!nonEmpty(unit[f])) err(U, `falta ${f}`);
  if (![1, 2, 3].includes(unit.priority)) err(U, 'priority debe ser 1–3');

  const bank = new Map();
  for (const q of unit.questions || []) { claim(q.id, `${U}/questions`); checkItem(q, `${U}/${q.id}`, prefix); bank.set(q.id, q); }
  for (const c of unit.flashcards || []) {
    claim(c.id, `${U}/flashcards`);
    checkItem({ type: 'flashcard', ...c }, `${U}/${c.id}`, prefix);
    bank.set(c.id, { type: 'flashcard', ...c });
  }
  const lessonStats = [];
  for (const l of unit.lessons || []) {
    claim(l.id, `${U}/lessons`);
    if (!l.id?.startsWith(`${prefix}-`)) err(`${U}/${l.id}`, 'id de lección sin prefijo');
    if (!nonEmpty(l.title)) err(`${U}/${l.id}`, 'lección sin título');
    let items = 0;
    for (const s of l.steps || []) {
      if (s.ref) {
        if (!bank.has(s.ref)) err(`${U}/${l.id}`, `ref inexistente "${s.ref}"`);
        else if (bank.get(s.ref).type !== 'concept') items++;
        continue;
      }
      claim(s.id, `${U}/${l.id}`);
      checkItem(s, `${U}/${l.id}/${s.id}`, prefix);
      if (s.type !== 'concept') items++;
    }
    const n = (l.steps || []).length;
    lessonStats.push({ id: l.id, n, items });
    if (n < 6 || n > 10) warn(`${U}/${l.id}`, `${n} pasos (se piden 6–10)`);
    if (n && items / n < 0.5) warn(`${U}/${l.id}`, `solo ${items}/${n} pasos son ítems (se pide ≥ 50 %)`);
  }

  // Estadísticas del banco
  const qs = unit.questions || [];
  const by = (t) => qs.filter((q) => q.type === t).length;
  const diff = [1, 2, 3].map((d) => qs.filter((q) => q.difficulty === d).length);
  const choice = qs.filter((q) => q.type === 'mcq' || q.type === 'pjs');
  const longest = choice.filter((q) => {
    const len = (o) => o.text.length;
    const right = q.options.find((o) => o.id === q.answer);
    return q.options.every((o) => o === right || len(right) > len(o) * 1.1);
  }).length;
  const pos = {};
  choice.forEach((q) => { pos[q.answer] = (pos[q.answer] || 0) + 1; });
  report.push({
    unit: U, lessons: (unit.lessons || []).length, flashcards: (unit.flashcards || []).length, questions: qs.length,
    pjs: by('pjs'), pjsPct: qs.length ? Math.round((by('pjs') / qs.length) * 100) : 0, open: by('open'),
    'd1/d2/d3 %': diff.map((d) => (qs.length ? Math.round((d / qs.length) * 100) : 0)).join('/'),
    'correcta más larga': `${longest}/${choice.length}`, claves: Object.entries(pos).sort().map(([k, v]) => `${k}:${v}`).join(' '),
  });
  if (choice.length && longest / choice.length > 0.35) warn(U, `la opción correcta es claramente la más larga en ${longest}/${choice.length} preguntas`);
}

// Simulacros (solo en la validación completa): IDs del banco, tipos, duplicados y blueprint.
const TESTS = C('tests');
if (!only.length && fs.existsSync(TESTS)) {
  const bankAll = new Map();
  for (const e of manifest.units) {
    if (e.pending || !fs.existsSync(C(e.file))) continue;
    for (const q of JSON.parse(fs.readFileSync(C(e.file), 'utf8')).questions || []) bankAll.set(q.id, { type: q.type, unit: e.id });
  }
  const idx = fs.existsSync(path.join(TESTS, 'index.json')) ? JSON.parse(fs.readFileSync(path.join(TESTS, 'index.json'), 'utf8')).tests : [];
  for (const f of fs.readdirSync(TESTS).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
    const where = `tests/${f}`;
    const t = JSON.parse(fs.readFileSync(path.join(TESTS, f), 'utf8'));
    if (`${t.id}.json` !== f) err(where, `id "${t.id}" no coincide con el archivo`);
    if (!['practice', 'exam'].includes(t.mode)) err(where, 'mode debe ser practice o exam');
    if (!(t.minutes > 0)) err(where, 'minutes debe ser > 0');
    if (!idx.some((x) => x.id === t.id && x.items === t.items.length)) err(where, 'falta en index.json o el número de ítems no coincide');
    if (new Set(t.items).size !== t.items.length) err(where, 'ítems repetidos');
    const count = {};
    for (const id of t.items) {
      const b = bankAll.get(id);
      if (!b) { err(where, `ítem inexistente "${id}"`); continue; }
      if (b.type !== 'mcq' && b.type !== 'pjs') err(where, `"${id}" no es mcq/pjs`);
      count[b.unit] = (count[b.unit] || 0) + 1;
    }
    const bp = t.blueprint || {};
    for (const u of new Set([...Object.keys(bp), ...Object.keys(count)])) {
      if ((bp[u] || 0) !== (count[u] || 0)) err(where, `blueprint ${u}: ${bp[u] || 0} ≠ ${count[u] || 0} ítems`);
    }
    for (const id of t.likert || []) if (bankAll.get(id)?.type !== 'likert') err(where, `"${id}" no es Likert del banco`);
  }
}

if (report.length) console.table(report);
warns.forEach((w) => console.log('AVISO ', w));
errors.forEach((e) => console.log('ERROR ', e));
console.log(errors.length ? `\n${errors.length} errores` : '\nSin errores.');
process.exitCode = errors.length ? 1 : 0;
