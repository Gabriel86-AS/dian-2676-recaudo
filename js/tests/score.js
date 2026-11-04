// Puntaje de simulacros. Funciones puras (probadas en tests/simulacro.test.js).

export const PASS_SCORE = 70;

/** Trunca a dos decimales, como la escala oficial (0–100 con dos decimales truncados). */
export function truncate2(correct, total) {
  if (!total) return 0;
  return Math.floor((correct * 10000) / total) / 100;
}

/** 72.5 → "72,50" */
export const fmtScore = (x) => Number(x).toFixed(2).replace('.', ',');

/**
 * @param {{id:string, answer:string, _unit:string}[]} items preguntas puntuables
 * @param {Record<string,string|null>} answers id → opción elegida
 */
export function scoreTest(items, answers) {
  const byUnit = {};
  let correct = 0;
  for (const it of items) {
    const u = (byUnit[it._unit] ||= { correct: 0, total: 0 });
    u.total += 1;
    if (answers[it.id] != null && answers[it.id] === it.answer) { correct += 1; u.correct += 1; }
  }
  const total = items.length;
  const answered = items.filter((it) => answers[it.id] != null).length;
  const score = truncate2(correct, total);
  return { correct, total, answered, score, passed: score >= PASS_SCORE, byUnit };
}

/** Tiempo restante en ms (null si no hay temporizador). */
export function remainingMs(session) {
  if (!session.minutes) return null;
  return Math.max(0, session.minutes * 60000 - session.elapsed);
}
