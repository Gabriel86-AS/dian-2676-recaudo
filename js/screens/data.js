// Contenido completo + índice (en caché) y estado de progreso actual.
import { loadAllUnits, buildIndex } from '../content.js';
import { getState } from '../progress/store.js';

let cached = null;

export async function loadData() {
  if (!cached) {
    cached = loadAllUnits().then((all) => ({ all, index: buildIndex(all) }));
    cached.catch(() => { cached = null; });
  }
  const { all, index } = await cached;
  return { all, index, state: getState() };
}

export const TYPE_LABEL = {
  mcq: 'Selección múltiple', pjs: 'Juicio situacional', truefalse: 'Verdadero/falso', open: 'Abierta',
  order: 'Ordenar', match: 'Relacionar', cloze: 'Completar', flashcard: 'Tarjeta',
};
