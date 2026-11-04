// Repaso espaciado Leitner de 5 cajas. Funciones puras (probadas en tests/progress.html).

// Días de espera por caja (índice = caja). Caja 1 = repasar ya.
export const INTERVAL_DAYS = [0, 0, 1, 2, 4, 7];
export const MAX_BOX = 5;
// Desde el 6 de noviembre (hora de Bogotá) el intervalo máximo es de 3 días.
export const CAP_FROM = new Date('2026-11-06T00:00:00-05:00');
export const CAP_DAYS = 3;
const DAY = 86400000;

export function intervalDays(box, now) {
  const d = INTERVAL_DAYS[Math.max(1, Math.min(MAX_BOX, box))];
  return now >= CAP_FROM ? Math.min(d, CAP_DAYS) : d;
}

/**
 * @param {{box?:number}} entry estado previo (o {} si es nuevo)
 * @param {'correct'|'partial'|'wrong'} result
 * @param {Date} now
 * @returns {{box:number, due:string}}
 */
export function schedule(entry, result, now = new Date()) {
  const prev = entry?.box || 1;
  let box = prev;
  if (result === 'correct') box = Math.min(MAX_BOX, prev + 1);
  else if (result === 'wrong') box = 1;
  const due = new Date(now.getTime() + intervalDays(box, now) * DAY);
  return { box, due: due.toISOString() };
}

export function resultOf({ correct, partial }) {
  if (correct) return 'correct';
  if (partial) return 'partial';
  return 'wrong';
}

export const isDue = (entry, now = new Date()) => !!entry?.due && new Date(entry.due) <= now;
