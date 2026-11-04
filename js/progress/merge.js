// Validación, migración y fusión del estado de progreso. Funciones puras.

export const VERSION = 1;

export function emptyState(now = new Date()) {
  return {
    version: VERSION,
    createdAt: now.toISOString(),
    items: {},
    lessons: {},
    tests: [],
    studyDays: {},
    settings: { hideLikert: false, fontSize: 'normal' },
  };
}

// Lleva datos antiguos a la versión actual y completa campos faltantes.
export function migrate(data) {
  const base = emptyState();
  if (!data || typeof data !== 'object') return base;
  // (Sin versiones anteriores todavía; aquí irían los pasos v1 → v2.)
  return {
    ...base,
    ...data,
    version: VERSION,
    items: { ...(data.items || {}) },
    lessons: { ...(data.lessons || {}) },
    tests: Array.isArray(data.tests) ? [...data.tests] : [],
    studyDays: { ...(data.studyDays || {}) },
    settings: { ...base.settings, ...(data.settings || {}) },
  };
}

export function validate(data) {
  if (!data || typeof data !== 'object') return 'El archivo no contiene un objeto JSON.';
  if (typeof data.version !== 'number') return 'Falta el campo "version".';
  if (data.version > VERSION) return `El archivo es de una versión más nueva (${data.version}).`;
  if (data.items && typeof data.items !== 'object') return 'El campo "items" no es válido.';
  return null;
}

const t = (iso) => (iso ? Date.parse(iso) || 0 : 0);

// Por ítem gana más intentos; si empatan, el más reciente.
export function mergeItem(a, b) {
  if (!a) return b;
  if (!b) return a;
  if ((b.attempts || 0) !== (a.attempts || 0)) return (b.attempts || 0) > (a.attempts || 0) ? b : a;
  return t(b.lastAt) > t(a.lastAt) ? b : a;
}

export function mergeState(local, incoming) {
  const A = migrate(local);
  const B = migrate(incoming);
  const items = { ...A.items };
  for (const [id, v] of Object.entries(B.items)) items[id] = mergeItem(items[id], v);

  const lessons = { ...A.lessons };
  for (const [id, v] of Object.entries(B.lessons)) {
    const a = lessons[id];
    lessons[id] = !a ? v : {
      completedAt: t(v.completedAt) > t(a.completedAt) ? v.completedAt : a.completedAt,
      bestAccuracy: Math.max(a.bestAccuracy || 0, v.bestAccuracy || 0),
      runs: Math.max(a.runs || 0, v.runs || 0),
    };
  }

  const seen = new Set(A.tests.map((x) => `${x.id}|${x.at}`));
  const tests = [...A.tests, ...B.tests.filter((x) => !seen.has(`${x.id}|${x.at}`))]
    .sort((x, y) => t(x.at) - t(y.at));

  const studyDays = { ...A.studyDays };
  for (const [d, m] of Object.entries(B.studyDays)) studyDays[d] = Math.max(studyDays[d] || 0, m);

  return {
    ...A,
    createdAt: t(B.createdAt) && t(B.createdAt) < t(A.createdAt) ? B.createdAt : A.createdAt,
    items, lessons, tests, studyDays,
  };
}
