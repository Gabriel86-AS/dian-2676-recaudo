// Carga de contenido JSON con caché en memoria.
const cache = new Map();

export async function loadJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const p = fetch(path, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(`No se pudo cargar ${path} (${r.status})`);
    return r.json();
  });
  cache.set(path, p);
  p.catch(() => cache.delete(path));
  return p;
}

export const loadManifest = () => loadJSON('content/manifest.json');

// Unidades con "pending": true aún no tienen archivo; no se piden.
export async function loadUnit(id) {
  const manifest = await loadManifest();
  const entry = manifest.units.find((u) => u.id === id);
  if (!entry) return { entry: null, unit: null };
  if (entry.pending) return { entry, unit: null };
  try {
    return { entry, unit: await loadJSON(`content/${entry.file}`) };
  } catch {
    return { entry, unit: null };
  }
}

export async function loadAllUnits() {
  const { units } = await loadManifest();
  return Promise.all(units.map((e) => loadUnit(e.id)));
}

const SCORED = new Set(['mcq', 'pjs', 'truefalse', 'open', 'order', 'match', 'cloze']);

/**
 * Índice de todo lo repasable: id → { item, unitId, kind: 'question'|'card'|'likert' }.
 * Incluye el banco de preguntas, las tarjetas y los ítems escritos dentro de las lecciones.
 */
export function buildIndex(all) {
  const index = new Map();
  for (const { entry, unit } of all) {
    if (!unit) continue;
    const add = (item, kind) => {
      if (!item?.id || index.has(item.id)) return;
      index.set(item.id, { item: { ...item, _unit: unit.id }, unitId: unit.id, entry, kind });
    };
    for (const q of unit.questions || []) add(q, q.type === 'likert' ? 'likert' : 'question');
    for (const c of unit.flashcards || []) add({ type: 'flashcard', ...c }, 'card');
    for (const l of unit.lessons || []) {
      for (const s of l.steps || []) {
        if (s.ref || !s.type) continue;
        if (s.type === 'flashcard') add(s, 'card');
        else if (s.type === 'likert') add(s, 'likert');
        else if (SCORED.has(s.type)) add(s, 'question');
      }
    }
  }
  return index;
}
