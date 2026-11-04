// Shell de la app: enrutador por hash y pantallas.
import { loadUnit, loadJSON } from './content.js';
import { esc, shuffle } from './util.js';
import { playLesson } from './engine/player.js';
import { playDeck } from './engine/flashcards.js';
import { initProgress, getState, isPersistent } from './progress/store.js';
import { allUnitStats, dueItems, visibleEntry, isLikertLesson } from './progress/stats.js';
import { loadData } from './screens/data.js';
import { renderRepaso, renderSession } from './screens/repaso.js';
import { renderProgreso } from './screens/progreso.js';
import { renderAjustes, applySettings } from './screens/ajustes.js';
import { renderSimulacros, renderSimulacro } from './tests/runner.js';

const view = document.getElementById('view');
// 8 nov 2026, 8:00 a. m. hora de Bogotá (UTC−5).
const EXAM_DATE = new Date('2026-11-08T08:00:00-05:00');
const PRACTICE_SIZE = 10;

const AREA_LABEL = { funcional: 'Funcional', comportamental: 'Comportamental', integridad: 'Integridad' };

initProgress();
applySettings();
if (!isPersistent()) {
  document.querySelector('.topbar').insertAdjacentHTML('afterend',
    '<p class="storage-warn" role="alert">El progreso no se guardará en este navegador.</p>');
}

let cleanup = null;
function onLeave(fn) { cleanup = fn; }

// ---------- Rutas ----------
const routes = [
  { re: /^\/?$/, tab: 'inicio', render: home },
  { re: /^\/unidad\/([\w-]+)$/, tab: 'inicio', render: unitPage },
  { re: /^\/leccion\/([\w-]+)\/([\w-]+)$/, tab: 'inicio', render: lessonPage },
  { re: /^\/practicar\/([\w-]+)$/, tab: 'inicio', render: practicePage },
  { re: /^\/tarjetas\/([\w-]+)$/, tab: 'inicio', render: deckPage },
  { re: /^\/repaso$/, tab: 'repaso', render: () => renderRepaso(view) },
  { re: /^\/repaso\/unidad\/([\w-]+)$/, tab: 'repaso', render: (id) => renderRepaso(view, id) },
  { re: /^\/repaso\/(errores|dia)$/, tab: 'repaso', render: async (kind) => onLeave(await renderSession(view, kind)) },
  { re: /^\/simulacros$/, tab: 'simulacros', render: () => renderSimulacros(view) },
  { re: /^\/simulacro\/([\w-]+)$/, tab: 'simulacros', render: async (id) => onLeave(await renderSimulacro(view, id)) },
  { re: /^\/progreso$/, tab: 'progreso', render: () => renderProgreso(view) },
  { re: /^\/recursos$/, tab: 'recursos', render: recursos },
  { re: /^\/ajustes$/, tab: 'ajustes', render: () => renderAjustes(view) },
];

async function router() {
  if (cleanup) { cleanup(); cleanup = null; }
  const path = decodeURIComponent(location.hash.replace(/^#/, '')) || '/';
  const route = routes.find((r) => r.re.test(path));
  setActiveTab(route?.tab);
  try {
    if (!route) notFound();
    else await route.render(...path.match(route.re).slice(1));
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card notice"><h1>Algo salió mal</h1><p>${esc(err.message)}</p><a class="btn" href="#/">Volver al inicio</a></div>`;
  }
  if (!document.body.classList.contains('in-lesson')) view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function setActiveTab(tab) {
  document.querySelectorAll('[data-tab]').forEach((a) => {
    if (a.dataset.tab === tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
}

// ---------- Inicio ----------
async function home() {
  view.innerHTML = `
    <section class="card countdown" aria-labelledby="cd-title">
      <h1 id="cd-title">Prueba escrita DIAN 2676</h1>
      <p>Domingo 8 de noviembre de 2026 · 8:00 a. m. a 1:00 p. m.</p>
      <div class="cd-grid" id="cd" role="timer" aria-live="off"></div>
      <p class="small">Competencias funcionales: eliminatoria, mínimo 70/100.</p>
    </section>
    <div id="due-chip"></div>
    <details class="card how-to" ${getState().lessons && Object.keys(getState().lessons).length ? '' : 'open'}>
      <summary><h2>Cómo usar este sitio</h2></summary>
      <ol>
        <li>Haz primero las lecciones de <strong>prioridad 1</strong>: el núcleo del empleo (recaudo, declaraciones, entidades recaudadoras, extinción de obligaciones, cobro y devoluciones).</li>
        <li>Las de <strong>prioridad 2</strong> completan los indicadores de tu OPEC: contabilidad, analítica, estructura, misionalidad, razonamiento, comportamentales e integridad, más cobro persuasivo e insolvencia.</li>
        <li>Las de <strong>prioridad 3</strong> son temas básicos de la ficha que no están en tu lista de indicadores (CPACA, Constitución, MIPG, gestión documental, sistema tributario y contrabando): estúdialas si te sobra tiempo.</li>
        <li>Cada día, repasa <a href="#/repaso">tus errores</a> y las tarjetas que tocan.</li>
        <li><strong>Jueves:</strong> un <a href="#/simulacros">simulacro intermedio</a>. <strong>Viernes:</strong> la simulación del examen.</li>
        <li><strong>Sábado:</strong> solo repaso de errores y tarjetas. Descansa.</li>
      </ol>
      <p class="small muted">Tu progreso se guarda en este navegador. Puedes exportarlo en <a href="#/ajustes">Ajustes</a>.</p>
    </details>
    <h2 class="section-title">Unidades</h2>
    <div class="unit-grid" id="units"><p class="muted">Cargando unidades…</p></div>`;

  const cd = document.getElementById('cd');
  const tick = () => { cd.innerHTML = countdownHTML(EXAM_DATE - Date.now()); };
  tick();
  const timer = setInterval(tick, 1000);
  onLeave(() => clearInterval(timer));

  const box = document.getElementById('units');
  try {
    const { all, index, state } = await loadData();
    const stats = allUnitStats(all, index, state).filter((u) => visibleEntry(u.entry, state.settings));
    box.innerHTML = stats.map(unitCard).join('');
    const due = dueItems(index, state).filter((x) => visibleEntry(x.entry, state.settings)).length;
    if (due) document.getElementById('due-chip').innerHTML = `<a class="due-chip" href="#/repaso">Repaso pendiente: ${due}</a>`;
  } catch (err) {
    box.innerHTML = `<div class="card notice"><p>No se pudo cargar la lista de unidades. ${esc(err.message)}</p></div>`;
  }
}

function countdownHTML(ms) {
  if (ms <= 0) return '<p style="grid-column:1/-1">¡Llegó el día! Mucha calma y éxito.</p>';
  const s = Math.floor(ms / 1000);
  const parts = [
    [Math.floor(s / 86400), 'días'],
    [Math.floor((s % 86400) / 3600), 'horas'],
    [Math.floor((s % 3600) / 60), 'min'],
    [s % 60, 'seg'],
  ];
  return parts.map(([n, l]) => `<div class="cd-cell"><span class="cd-num">${n}</span><span class="cd-lbl">${l}</span></div>`).join('');
}

function unitCard(s) {
  const u = s.entry;
  const m = Math.round(s.mastery * 100);
  return `
    <div class="card unit-card">
      <h3><a class="unit-link" href="#/unidad/${esc(u.id)}">${esc(u.title)}</a></h3>
      <div class="progress" role="img" aria-label="Dominio de la unidad: ${m} %"><span style="width:${m}%"></span></div>
      <p class="small muted unit-sub">${s.hasContent
        ? `${m} % dominio · ${s.lessonsDone}/${s.lessonsTotal} lecciones${s.mistakes ? ` · ${s.mistakes} por repasar` : ''}`
        : 'Contenido en preparación'}</p>
      <div class="unit-meta">
        <span class="badge">${esc(AREA_LABEL[u.area] || u.area)}</span>
        <span class="badge p${u.priority}">Prioridad ${u.priority}</span>
        ${s.next ? `<a class="btn small-btn continue" href="#/leccion/${esc(u.id)}/${esc(s.next.id)}">Continuar</a>` : ''}
      </div>
    </div>`;
}

// ---------- Unidad ----------
async function requireUnit(id) {
  view.innerHTML = '<p class="muted">Cargando…</p>';
  const { entry, unit } = await loadUnit(id);
  if (!entry) { notFound(); return null; }
  if (!unit) {
    view.innerHTML = `<a class="back" href="#/">← Unidades</a><h1>${esc(entry.title)}</h1>
      <div class="card notice"><p>Esta unidad todavía no tiene contenido. Se está preparando; vuelve pronto.</p></div>`;
    return null;
  }
  return unit;
}

async function unitPage(id) {
  const unit = await requireUnit(id);
  if (!unit) return;
  const hideLikert = getState().settings?.hideLikert;
  const lessons = (unit.lessons || []).filter((l) => !(hideLikert && isLikertLesson(unit, l)));
  const nQ = (unit.questions || []).filter((q) => q.type !== 'likert').length;
  const nC = deckCards(unit).length;
  const done = getState().lessons;
  view.innerHTML = `
    <a class="back" href="#/">← Unidades</a>
    <h1>${esc(unit.title)}</h1>
    ${unit.summary ? `<p class="muted">${esc(unit.summary)}</p>` : ''}
    ${unit.sources?.length ? `<p class="small muted">Fuentes: ${unit.sources.map(esc).join(' · ')}</p>` : ''}
    <div class="unit-actions">
      ${nC ? `<a class="btn secondary" href="#/tarjetas/${esc(unit.id)}">Tarjetas (${nC})</a>` : ''}
      ${nQ ? `<a class="btn secondary" href="#/practicar/${esc(unit.id)}">Practicar preguntas</a>` : ''}
      <a class="btn secondary" href="#/repaso/unidad/${esc(unit.id)}">Mis errores en esta unidad</a>
    </div>
    <section class="card">
      <h2>Lecciones</h2>
      ${lessons.length ? `<ul class="lesson-list">${lessons.map((l) => {
        const d = done[l.id];
        return `
        <li><a href="#/leccion/${esc(unit.id)}/${esc(l.id)}">
          <span>${d?.completedAt ? '<span class="done" aria-label="Completada">✓</span> ' : ''}${esc(l.title)}</span>
          <span class="muted small">${d?.completedAt ? `mejor ${Math.round(d.bestAccuracy * 100)} % · ` : ''}${l.minutes ? `${l.minutes} min` : ''}</span></a></li>`;
      }).join('')}
      </ul>` : '<p class="muted">Aún no hay lecciones.</p>'}
    </section>`;
}

async function lessonPage(unitId, lessonId) {
  const unit = await requireUnit(unitId);
  if (!unit) return;
  const lesson = unit.lessons?.find((l) => l.id === lessonId);
  if (!lesson) return notFound();
  onLeave(playLesson({ unit, lesson, el: view, backHref: `#/unidad/${unit.id}` }));
}

async function practicePage(unitId) {
  const unit = await requireUnit(unitId);
  if (!unit) return;
  const picks = shuffle((unit.questions || []).filter((q) => q.type !== 'likert')).slice(0, PRACTICE_SIZE);
  const lesson = { id: 'practica', virtual: true, title: `Práctica · ${unit.title}`, steps: picks.map((q) => ({ ref: q.id })) };
  onLeave(playLesson({ unit, lesson, el: view, backHref: `#/unidad/${unit.id}` }));
}

// Mazo = tarjetas de la unidad + tarjetas sueltas dentro de las lecciones.
function deckCards(unit) {
  const inline = (unit.lessons || []).flatMap((l) => (l.steps || []).filter((s) => s.type === 'flashcard'));
  const seen = new Set();
  return [...(unit.flashcards || []), ...inline].filter((c) => !seen.has(c.id) && seen.add(c.id));
}

async function deckPage(unitId) {
  const unit = await requireUnit(unitId);
  if (!unit) return;
  onLeave(playDeck({ unit, cards: deckCards(unit), el: view, backHref: `#/unidad/${unit.id}` }));
}

// ---------- Otras ----------
async function recursos() {
  view.innerHTML = '<h1>Recursos</h1><p class="muted">Cargando…</p>';
  let data = { videos: [], links: [] };
  try { data = await loadJSON('content/resources.json'); } catch { /* sin recursos aún */ }
  const links = data.links || [];
  const groups = [
    ['Documentos oficiales del concurso', links.filter((r) => r.group === 'oficiales')],
    ['Normas y fuentes', links.filter((r) => r.group === 'normas')],
    ['Simulacros externos (no oficiales)', links.filter((r) => r.group === 'simulacros')],
    ['Videos', data.videos || []],
  ].filter(([, list]) => list.length);
  const li = (r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}<span class="sr-only"> (se abre en otra pestaña)</span></a>${r.note ? `<p class="small muted">${esc(r.note)}</p>` : ''}</li>`;
  view.innerHTML = `<h1>Recursos</h1>
    <p class="muted">Enlaces verificados el 3-nov-2026. Se abren en otra pestaña.</p>
    ${groups.length ? groups.map(([title, list]) => `<section class="card"><h2>${esc(title)}</h2><ul class="res-list">${list.map(li).join('')}</ul></section>`).join('')
      : '<div class="card"><p class="muted">Pronto encontrarás aquí videos y enlaces oficiales.</p></div>'}`;
}

function notFound() {
  view.innerHTML = `<h1>Página no encontrada</h1><div class="card"><a class="btn" href="#/">Volver al inicio</a></div>`;
}

window.addEventListener('hashchange', router);
router();

// Uso sin conexión: registra el service worker (solo en http/https).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Sin modo offline:', err?.message)));
}
