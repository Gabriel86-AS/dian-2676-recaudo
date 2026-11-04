// Pantalla Repaso: mis errores, repaso del día, filtros y explicaciones.
import { esc } from '../util.js';
import { md } from '../engine/md.js';
import { playLesson, itemLabel, explainHTML } from '../engine/player.js';
import { mistakeItems, dueItems, visibleEntry } from '../progress/stats.js';
import { loadData, TYPE_LABEL } from './data.js';

const MAX_MISTAKES = 15;
const MAX_DUE = 20;
const FKEY = 'dian2676rc:repaso-filtro';

let filter = readFilter();
function readFilter() {
  try { return JSON.parse(sessionStorage.getItem(FKEY)) || { unit: 'all', type: 'all' }; }
  catch { return { unit: 'all', type: 'all' }; }
}
function setFilter(f) {
  filter = { ...filter, ...f };
  try { sessionStorage.setItem(FKEY, JSON.stringify(filter)); } catch { /* opcional */ }
}

const passes = (x) => (filter.unit === 'all' || x.unitId === filter.unit) && (filter.type === 'all' || x.item.type === filter.type);

async function lists() {
  const data = await loadData();
  const vis = (x) => visibleEntry(x.entry, data.state.settings);
  return {
    ...data,
    mistakes: mistakeItems(data.index, data.state).filter(vis).filter(passes),
    due: dueItems(data.index, data.state).filter(vis).filter(passes),
  };
}

export async function renderRepaso(view, presetUnit) {
  if (presetUnit) setFilter({ unit: presetUnit, type: 'all' });
  view.innerHTML = '<h1>Repaso</h1><p class="muted">Cargando…</p>';
  const { all, index, state, mistakes, due } = await lists();

  const units = all.filter(({ entry, unit }) => unit && visibleEntry(entry, state.settings));
  const types = [...new Set([...index.values()].filter((x) => x.kind !== 'likert').map((x) => x.item.type))];
  const chip = (group, value, label) =>
    `<button type="button" class="chip" data-g="${group}" data-v="${esc(value)}" aria-pressed="${filter[group] === value}">${esc(label)}</button>`;

  view.innerHTML = `
    <h1>Repaso</h1>
    <div class="chips" role="group" aria-label="Filtrar por unidad">
      ${chip('unit', 'all', 'Todas las unidades')}${units.map(({ entry }) => chip('unit', entry.id, entry.title)).join('')}
    </div>
    <div class="chips" role="group" aria-label="Filtrar por tipo">
      ${chip('type', 'all', 'Todos los tipos')}${types.map((t) => chip('type', t, TYPE_LABEL[t] || t)).join('')}
    </div>
    <div class="review-grid">
      <section class="card">
        <h2>Mis errores <span class="count">${mistakes.length}</span></h2>
        <p class="small muted">Hasta ${MAX_MISTAKES} ítems, los más antiguos primero. Cada uno sale de la lista tras 2 aciertos seguidos.</p>
        ${mistakes.length ? '<a class="btn" href="#/repaso/errores">Practicar mis errores</a>' : '<p>No tienes errores pendientes con este filtro.</p>'}
      </section>
      <section class="card">
        <h2>Repaso del día <span class="count">${due.length}</span></h2>
        <p class="small muted">Preguntas y tarjetas que toca repasar hoy según el repaso espaciado. Primero las unidades de mayor prioridad.</p>
        ${due.length ? '<a class="btn" href="#/repaso/dia">Empezar repaso</a>' : '<p>Nada pendiente por ahora.</p>'}
      </section>
    </div>
    ${mistakes.length ? `<section class="card">
      <h2>Errores abiertos</h2>
      ${mistakes.map((x) => `<details class="missed">
        <summary><span>${esc(itemLabel(x.item))}<br><span class="small muted">${esc(x.entry.title)} · ${esc(TYPE_LABEL[x.item.type] || x.item.type)}</span></span><span class="small link">Ver explicación</span></summary>
        ${x.item.case ? `<div class="case"><span class="box-lbl">Caso</span>${md(x.item.case)}</div>` : ''}
        ${explainHTML(x.item)}
        ${x.item.source ? `<p class="small muted">Fuente: ${esc(x.item.source)}</p>` : ''}
      </details>`).join('')}
    </section>` : ''}`;

  view.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    setFilter({ [b.dataset.g]: b.dataset.v });
    renderRepaso(view);
  }));
}

export async function renderSession(view, kind) {
  const { mistakes, due } = await lists();
  const picks = kind === 'errores' ? mistakes.slice(0, MAX_MISTAKES) : due.slice(0, MAX_DUE);
  const lesson = {
    id: `repaso-${kind}`,
    title: kind === 'errores' ? 'Mis errores' : 'Repaso del día',
    virtual: true,
    steps: picks.map((x) => x.item),
  };
  return playLesson({ unit: { id: 'repaso', title: 'Repaso' }, lesson, el: view, backHref: '#/repaso' });
}
