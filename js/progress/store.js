// Progreso en localStorage (clave única). Si no hay almacenamiento, queda en memoria.
import { on } from '../engine/events.js';
import { schedule, resultOf } from './scheduler.js';
import { emptyState, migrate, mergeState, validate } from './merge.js';

export const KEY = 'dian2676rc:v1';
const MAX_STEP_MS = 3 * 60 * 1000; // tope por paso para no contar tiempo inactivo

let state = null;
let persistent = true;
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    state = migrate(raw ? JSON.parse(raw) : null);
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.warn('Progreso solo en memoria:', err?.message);
    persistent = false;
    state = state || emptyState();
  }
}

function save() {
  if (persistent) {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (err) { persistent = false; console.warn('No se pudo guardar el progreso:', err?.message); }
  }
  listeners.forEach((fn) => fn(state));
}

export function getState() { if (!state) load(); return state; }
export const isPersistent = () => { getState(); return persistent; };
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function addTime(ms, now) {
  if (!ms || ms < 0) return;
  const k = dayKey(now);
  const min = Math.min(ms, MAX_STEP_MS) / 60000;
  state.studyDays[k] = Math.round(((state.studyDays[k] || 0) + min) * 100) / 100;
}

export function recordAnswer({ itemId, unitId, type, correct, partial, ms, given }, now = new Date()) {
  getState();
  const e = state.items[itemId] || { unit: unitId, type, attempts: 0, correct: 0, partial: 0, streak: 0, inMistakes: false };
  e.unit = unitId;
  e.type = type;
  e.lastAt = now.toISOString();
  e.attempts += 1;
  addTime(ms, now);
  if (type === 'likert') { // sin respuesta correcta: solo se guarda lo marcado
    e.lastGiven = given;
    state.items[itemId] = e;
    return save();
  }
  const res = resultOf({ correct, partial });
  if (e.attempts === 1) e.firstCorrect = res === 'correct';
  if (res === 'correct') e.correct += 1;
  if (res === 'partial') e.partial += 1;
  e.avgMs = Math.round(((e.avgMs || 0) * (e.attempts - 1) + (ms || 0)) / e.attempts);
  e.lastResult = res;
  if (res === 'correct') {
    e.streak = (e.streak || 0) + 1;
    if (e.inMistakes && e.streak >= 2) e.inMistakes = false;
  } else {
    e.streak = 0;
    e.inMistakes = true;
    e.wrongAt = now.toISOString();
  }
  Object.assign(e, schedule(e, res, now));
  state.items[itemId] = e;
  save();
}

export function recordLesson({ lessonId, correctFirstTry, total, virtual }, now = new Date()) {
  getState();
  if (virtual) return;
  const prev = state.lessons[lessonId] || { runs: 0, bestAccuracy: 0 };
  const acc = total ? correctFirstTry / total : 1;
  state.lessons[lessonId] = {
    completedAt: now.toISOString(),
    bestAccuracy: Math.max(prev.bestAccuracy || 0, Math.round(acc * 1000) / 1000),
    runs: (prev.runs || 0) + 1,
  };
  save();
}

export function recordTest(entry) {
  getState();
  state.tests.push(entry);
  save();
}

export function recordTime(ms, now = new Date()) {
  getState();
  addTime(ms, now);
  save();
}

export function setSetting(key, value) {
  getState();
  state.settings[key] = value;
  save();
}

export function exportJSON() {
  return JSON.stringify(getState(), null, 2);
}

/** @returns {string|null} mensaje de error o null si se importó */
export function importJSON(text) {
  let data;
  try { data = JSON.parse(text); } catch { return 'El archivo no es JSON válido.'; }
  const err = validate(data);
  if (err) return err;
  state = mergeState(getState(), data);
  save();
  return null;
}

export function resetProgress() {
  const settings = getState().settings;
  state = emptyState();
  state.settings = settings;
  save();
}

// Conecta el progreso a los eventos del motor.
export function initProgress() {
  getState();
  on('answer', (e) => recordAnswer(e));
  on('card', (e) => recordAnswer({ itemId: e.cardId, unitId: e.unitId, type: 'flashcard', correct: e.knew, partial: false, ms: e.ms, given: e.knew }));
  on('lessonComplete', (e) => recordLesson(e));
  on('time', (e) => recordTime(e.ms));
}
