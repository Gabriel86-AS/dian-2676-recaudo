// Genera los simulacros fijos en content/tests/ a partir del banco de preguntas.
// Uso: node tools/build-tests.mjs   (determinista: misma semilla → mismos simulacros)
// Reglas (plan/07): solo mcq/pjs de unidades funcionales; prioridad 1 ≈ 60 %, 2 ≈ 40 %;
// sin repetir ítems entre simulacros del mismo nivel. `weights` cambia ese reparto por prioridad.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

function rng(seed) { // mulberry32
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const shuffle = (arr, r) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// Reparte n en partes según pesos (mayor residuo).
function split(n, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (n * w) / total);
  const out = raw.map(Math.floor);
  let left = n - out.reduce((a, b) => a + b, 0);
  raw.map((x, i) => [x - Math.floor(x), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0) { out[i]++; left--; } });
  return out;
}

const units = manifest.units.filter((u) => !u.demo && !u.pending);
const load = (u) => JSON.parse(fs.readFileSync(path.join(ROOT, u.file), 'utf8'));
const functional = units.filter((u) => u.area === 'funcional').map((u) => ({ ...u, qs: load(u).questions.filter((q) => q.type === 'mcq' || q.type === 'pjs') }));
const likertPool = Object.fromEntries(units.filter((u) => u.area !== 'funcional').map((u) => [u.id, load(u).questions.filter((q) => q.type === 'likert').map((q) => q.id)]));

function build({ n, mix, used, seed, weights = [60, 40, 0] }) {
  const r = rng(seed);
  const pick = new Set();
  const byPriority = [1, 2, 3].map((p) => functional.filter((u) => u.priority === p));
  const quotas = split(n, weights);
  byPriority.forEach((us, pi) => {
    const q = quotas[pi];
    const diffs = shuffle(split(q, mix).flatMap((c, d) => Array(c).fill(d + 1)), r);
    const order = shuffle(us, r);
    diffs.forEach((d, k) => {
      const rot = [...order.slice(k % order.length), ...order.slice(0, k % order.length)];
      const free = (u) => u.qs.filter((x) => !used.has(x.id) && !pick.has(x.id));
      const tries = [
        ...rot.map((u) => () => free(u).filter((x) => x.difficulty === d)),
        ...rot.map((u) => () => free(u).filter((x) => Math.abs(x.difficulty - d) === 1)),
        ...rot.map((u) => () => free(u)),
        () => functional.flatMap(free),
      ];
      for (const t of tries) {
        const c = t();
        if (c.length) { pick.add(c[Math.floor(r() * c.length)].id); break; }
      }
    });
  });
  return shuffle([...pick], r);
}

const unitOf = new Map(functional.flatMap((u) => u.qs.map((q) => [q.id, q])));
const uidOf = new Map(functional.flatMap((u) => u.qs.map((q) => [q.id, u.id])));
const SPECS = [
  { group: 'basico', ids: ['test-basico-1', 'test-basico-2'], title: 'Simulacro básico', difficulty: 1, n: 30, mix: [70, 30, 0], minutes: 45, mode: 'practice' },
  { group: 'medio', ids: ['test-medio-1', 'test-medio-2'], title: 'Simulacro intermedio', difficulty: 2, n: 40, mix: [15, 70, 15], minutes: 60, mode: 'practice' },
  { group: 'avanzado', ids: ['test-avanzado-1', 'test-avanzado-2'], title: 'Simulacro avanzado', difficulty: 3, n: 40, mix: [0, 30, 70], minutes: 70, mode: 'practice' },
  { group: 'examen', ids: ['test-examen-1'], title: 'Simulación del examen', difficulty: 2, n: 60, mix: [30, 40, 30], minutes: 300, mode: 'exam', likert: { comportamentales: 25, integridad: 15 } },
  // Núcleo del empleo (ficha CT-CR-3006): 75 % prioridad 1, 25 % prioridad 2.
  { group: 'ficha', ids: ['test-ficha-1'], title: 'Simulacro núcleo recaudo y cartera', difficulty: 2, n: 40, mix: [20, 50, 30], minutes: 60, mode: 'practice', weights: [75, 25, 0] },
];

fs.mkdirSync(path.join(ROOT, 'tests'), { recursive: true });
const index = [];
let seed = 2676;
for (const s of SPECS) {
  const used = new Set();
  s.ids.forEach((id, i) => {
    const items = build({ n: s.n, mix: s.mix, used, seed: seed++, weights: s.weights });
    items.forEach((x) => used.add(x));
    const blueprint = {};
    items.forEach((x) => { const u = uidOf.get(x); blueprint[u] = (blueprint[u] || 0) + 1; });
    const diff = [1, 2, 3].map((d) => items.filter((x) => unitOf.get(x).difficulty === d).length);
    const test = {
      id, title: s.ids.length > 1 ? `${s.title} ${i + 1}` : s.title, difficulty: s.difficulty, minutes: s.minutes, mode: s.mode,
      blueprint: Object.fromEntries(functional.filter((u) => blueprint[u.id]).map((u) => [u.id, blueprint[u.id]])),
      items,
    };
    if (s.likert) {
      const r = rng(seed++);
      test.likert = Object.entries(s.likert).flatMap(([u, k]) => shuffle(likertPool[u], r).slice(0, k));
    }
    fs.writeFileSync(path.join(ROOT, 'tests', `${id}.json`), JSON.stringify(test, null, 2) + '\n');
    index.push({ id, title: test.title, difficulty: test.difficulty, minutes: test.minutes, mode: test.mode, items: items.length, likert: test.likert?.length || 0 });
    console.log(id.padEnd(16), `${items.length} ítems`, `d1/d2/d3 ${diff.join('/')}`, test.likert ? `+ ${test.likert.length} Likert` : '');
  });
}
fs.writeFileSync(path.join(ROOT, 'tests', 'index.json'), JSON.stringify({ tests: index }, null, 2) + '\n');
