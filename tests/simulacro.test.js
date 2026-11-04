// Pruebas del puntaje de simulacros. Node: node tests/simulacro.test.js
import fs from 'node:fs';
import { truncate2, fmtScore, scoreTest, remainingMs } from '../js/tests/score.js';

let pass = 0, fail = 0;
function test(name, fn) {
  try { fn(); pass++; console.log('OK  ', name); } catch (e) { fail++; console.log('FALLA', name, '→', e.message); }
}
const eq = (a, b) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`); };

test('trunca, no redondea: 2/3 → 66,66', () => eq(truncate2(2, 3), 66.66));
test('29/30 → 96,66', () => eq(truncate2(29, 30), 96.66));
test('21/30 → 70,00 exacto', () => eq(truncate2(21, 30), 70));
test('sin preguntas → 0', () => eq(truncate2(0, 0), 0));
test('formato con coma y dos decimales', () => { eq(fmtScore(70), '70,00'); eq(fmtScore(66.66), '66,66'); });
test('tiempo restante nunca negativo', () => { eq(remainingMs({ minutes: 1, elapsed: 90000 }), 0); eq(remainingMs({ minutes: 0, elapsed: 5 }), null); });

// Respuestas hechas a mano sobre test-basico-1: 21 correctas, 3 incorrectas, 6 sin responder.
const read = (p) => JSON.parse(fs.readFileSync(new URL(`../content/${p}`, import.meta.url), 'utf8'));
const manifest = read('manifest.json');
const bank = new Map();
for (const u of manifest.units) {
  if (u.pending) continue;
  for (const q of read(u.file).questions) bank.set(q.id, { ...q, _unit: u.id });
}
const t = read('tests/test-basico-1.json');
const items = t.items.map((id) => bank.get(id));
const answers = {};
items.forEach((it, i) => {
  if (i < 21) answers[it.id] = it.answer;
  else if (i < 24) answers[it.id] = it.options.find((o) => o.id !== it.answer).id;
});
const r = scoreTest(items, answers);
test('test-basico-1: 21/30 = 70,00 y aprueba', () => { eq([r.correct, r.total, r.answered], [21, 30, 24]); eq(r.score, 70); eq(r.passed, true); });
test('desglose por unidad suma el total y coincide con el blueprint', () => {
  eq(Object.values(r.byUnit).reduce((a, x) => a + x.total, 0), 30);
  eq(Object.values(r.byUnit).reduce((a, x) => a + x.correct, 0), 21);
  for (const [u, n] of Object.entries(t.blueprint)) eq(r.byUnit[u].total, n);
});
test('una correcta menos (20/30) → 66,66 y no aprueba', () => {
  const a2 = { ...answers, [items[0].id]: null };
  const r2 = scoreTest(items, a2);
  eq(r2.score, 66.66); eq(r2.passed, false);
});

console.log(`\n${pass}/${pass + fail} pruebas superadas`);
process.exitCode = fail ? 1 : 0;
