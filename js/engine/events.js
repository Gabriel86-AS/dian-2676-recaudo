// Bus de eventos mínimo. La fase 3 (progreso) se suscribe aquí.
// Eventos: 'answer', 'lessonComplete', 'card'.
const handlers = new Map();

export function on(name, fn) {
  if (!handlers.has(name)) handlers.set(name, new Set());
  handlers.get(name).add(fn);
  return () => handlers.get(name).delete(fn);
}

export function emit(name, payload) {
  for (const fn of handlers.get(name) || []) {
    try { fn(payload); } catch (err) { console.error(`Error en el evento ${name}`, err); }
  }
}
