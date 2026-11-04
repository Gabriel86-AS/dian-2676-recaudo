// Estadísticas derivadas del progreso + contenido.
import { isDue } from './scheduler.js';

export const MASTERY_BOX = 3;
const PRIORITY_WEIGHT = { 1: 3, 2: 2, 3: 1 };

export function unitStats(entry, unit, index, state, now = new Date()) {
  const ids = [...index.values()].filter((x) => x.unitId === entry.id);
  const questions = ids.filter((x) => x.kind === 'question');
  const scored = ids.filter((x) => x.kind !== 'likert');
  let attempts = 0, correct = 0, seen = 0, mastered = 0, mistakes = 0, due = 0;
  for (const x of scored) {
    const e = state.items[x.item.id];
    if (!e) continue;
    seen++;
    attempts += e.attempts || 0;
    correct += e.correct || 0;
    if (e.inMistakes) mistakes++;
    if (isDue(e, now)) due++;
  }
  for (const x of questions) if ((state.items[x.item.id]?.box || 0) >= MASTERY_BOX) mastered++;
  const lessons = unit?.lessons || [];
  const done = lessons.filter((l) => state.lessons[l.id]?.completedAt).length;
  const next = lessons.find((l) => !state.lessons[l.id]?.completedAt) || null;
  return {
    id: entry.id, entry, hasContent: !!unit,
    total: scored.length, questions: questions.length, seen, attempts, correct,
    accuracy: attempts ? correct / attempts : null,
    mastery: questions.length ? mastered / questions.length : 0,
    mistakes, due, lessonsDone: done, lessonsTotal: lessons.length, next,
  };
}

export function allUnitStats(all, index, state, now = new Date()) {
  return all.map(({ entry, unit }) => unitStats(entry, unit, index, state, now));
}

// Estimación ponderada (prioridad 1 ×3, 2 ×2, 3 ×1) del dominio funcional, 0–100.
export function readiness(stats) {
  let w = 0, s = 0;
  for (const u of stats) {
    if (u.entry.area !== 'funcional' || u.entry.demo) continue;
    const k = PRIORITY_WEIGHT[u.entry.priority] || 1;
    w += k;
    s += k * u.mastery;
  }
  return w ? Math.round((s / w) * 1000) / 10 : 0;
}

export function weakest(stats, n = 3, minAttempts = 5) {
  return stats.filter((u) => u.attempts >= minAttempts && !u.entry.demo)
    .sort((a, b) => a.accuracy - b.accuracy).slice(0, n);
}

export function overall(index, state) {
  const scored = [...index.values()].filter((x) => x.kind !== 'likert');
  const seen = scored.filter((x) => state.items[x.item.id]);
  const first = seen.filter((x) => state.items[x.item.id].firstCorrect).length;
  return {
    total: scored.length,
    seen: seen.length,
    firstTryAccuracy: seen.length ? first / seen.length : null,
    lessonsDone: Object.values(state.lessons).filter((l) => l.completedAt).length,
    minutes: Object.values(state.studyDays).reduce((a, b) => a + b, 0),
  };
}

// Pendientes: errores abiertos (más antiguo primero) y repasos vencidos (prioridad alta primero).
export function mistakeItems(index, state) {
  return [...index.values()]
    .filter((x) => x.kind !== 'likert' && state.items[x.item.id]?.inMistakes)
    .sort((a, b) => Date.parse(state.items[a.item.id].wrongAt || 0) - Date.parse(state.items[b.item.id].wrongAt || 0));
}

export function dueItems(index, state, now = new Date()) {
  return [...index.values()]
    .filter((x) => x.kind !== 'likert' && isDue(state.items[x.item.id], now))
    .sort((a, b) => (a.entry.priority - b.entry.priority)
      || (Date.parse(state.items[a.item.id].due) - Date.parse(state.items[b.item.id].due)));
}

// Las unidades siempre se ven: «ocultar autoinforme» solo oculta la práctica Likert (sin puntaje),
// no las lecciones puntuadas de comportamentales e integridad.
export function visibleEntry() {
  return true;
}

/** Lección compuesta solo por afirmaciones Likert (práctica de autoinforme). */
export function isLikertLesson(unit, lesson) {
  const types = new Map((unit.questions || []).map((q) => [q.id, q.type]));
  const steps = lesson.steps || [];
  return steps.length > 0 && steps.every((s) => (s.ref ? types.get(s.ref) : s.type) === 'likert');
}

export const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)} %`);
