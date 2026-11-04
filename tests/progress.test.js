// Pruebas del repaso espaciado y la fusión de progreso. Sin framework.
// Navegador: abrir tests/progress.html. Node: node tests/progress.test.js
import { schedule, intervalDays, resultOf, isDue, CAP_FROM } from '../js/progress/scheduler.js';
import { mergeState, mergeItem, migrate, validate, emptyState } from '../js/progress/merge.js';

const DAY = 86400000;
const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); }
  catch (err) { results.push({ name, ok: false, err: err.message }); }
}
function eq(a, b, msg = '') {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error(`${msg} esperado ${B}, obtenido ${A}`);
}

const early = new Date('2026-11-03T15:00:00-05:00');
const late = new Date('2026-11-06T10:00:00-05:00');
const days = (iso, from) => Math.round((Date.parse(iso) - from.getTime()) / DAY);

test('ítem nuevo correcto pasa a caja 2 (1 día)', () => {
  const r = schedule({}, 'correct', early);
  eq(r.box, 2); eq(days(r.due, early), 1);
});
test('correcto sube de caja; intervalos 2, 4 y 7 días', () => {
  eq(days(schedule({ box: 2 }, 'correct', early).due, early), 2);
  eq(days(schedule({ box: 3 }, 'correct', early).due, early), 4);
  eq(days(schedule({ box: 4 }, 'correct', early).due, early), 7);
});
test('la caja no pasa de 5', () => eq(schedule({ box: 5 }, 'correct', early).box, 5));
test('incorrecto vuelve a caja 1, vence ya', () => {
  const r = schedule({ box: 4 }, 'wrong', early);
  eq(r.box, 1); eq(Date.parse(r.due), early.getTime());
});
test('parcial se queda en la caja', () => eq(schedule({ box: 3 }, 'partial', early).box, 3));
test('desde el 6-nov el intervalo máximo es 3 días', () => {
  eq(intervalDays(5, late), 3);
  eq(intervalDays(3, late), 2);
  eq(intervalDays(5, new Date(CAP_FROM.getTime() - 1)), 7);
});
test('resultOf', () => {
  eq(resultOf({ correct: true }), 'correct');
  eq(resultOf({ correct: false, partial: true }), 'partial');
  eq(resultOf({ correct: false }), 'wrong');
});
test('isDue', () => {
  eq(isDue({ due: early.toISOString() }, late), true);
  eq(isDue({ due: late.toISOString() }, early), false);
  eq(isDue(undefined), false);
});

test('mergeItem: gana más intentos', () => {
  eq(mergeItem({ attempts: 3, lastAt: '2026-11-01' }, { attempts: 5, lastAt: '2026-10-01' }).attempts, 5);
});
test('mergeItem: empate → el más reciente', () => {
  eq(mergeItem({ attempts: 2, lastAt: '2026-11-01T00:00:00Z', box: 1 }, { attempts: 2, lastAt: '2026-11-02T00:00:00Z', box: 3 }).box, 3);
});
test('mergeState combina ítems, lecciones, simulacros y días', () => {
  const a = { ...emptyState(), items: { x: { attempts: 1 }, y: { attempts: 4 } }, lessons: { l1: { completedAt: '2026-11-01T00:00:00Z', bestAccuracy: 0.5, runs: 1 } },
    tests: [{ id: 't1', at: '2026-11-01T00:00:00Z', score: 60 }], studyDays: { '2026-11-01': 10 } };
  const b = { ...emptyState(), items: { x: { attempts: 3 }, z: { attempts: 1 } }, lessons: { l1: { completedAt: '2026-11-02T00:00:00Z', bestAccuracy: 0.9, runs: 2 } },
    tests: [{ id: 't1', at: '2026-11-01T00:00:00Z', score: 60 }, { id: 't2', at: '2026-11-02T00:00:00Z', score: 80 }], studyDays: { '2026-11-01': 5, '2026-11-02': 20 } };
  const m = mergeState(a, b);
  eq(Object.keys(m.items).sort(), ['x', 'y', 'z']);
  eq(m.items.x.attempts, 3);
  eq(m.items.y.attempts, 4);
  eq(m.lessons.l1, { completedAt: '2026-11-02T00:00:00Z', bestAccuracy: 0.9, runs: 2 });
  eq(m.tests.map((t) => t.id), ['t1', 't2']);
  eq(m.studyDays, { '2026-11-01': 10, '2026-11-02': 20 });
});
test('mergeState es idempotente', () => {
  const a = { ...emptyState(), items: { x: { attempts: 2, lastAt: '2026-11-01T00:00:00Z' } }, tests: [{ id: 't', at: '2026-11-01T00:00:00Z' }] };
  const m = mergeState(a, a);
  eq(m.items, a.items); eq(m.tests.length, 1);
});
test('migrate completa campos y ajustes', () => {
  const m = migrate({ version: 1, items: { a: {} } });
  eq(m.settings, { hideLikert: false, fontSize: 'normal' }); eq(Array.isArray(m.tests), true);
});
test('validate rechaza datos inválidos', () => {
  eq(validate(null) !== null, true);
  eq(validate({}) !== null, true);
  eq(validate({ version: 99 }) !== null, true);
  eq(validate({ version: 1, items: {} }), null);
});

export { results };

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'OK  ' : 'FALLA'} ${r.name}${r.ok ? '' : ` → ${r.err}`}`);
console.log(`${results.length - failed.length}/${results.length} pruebas superadas`);
if (typeof process !== 'undefined' && failed.length) process.exitCode = 1;
