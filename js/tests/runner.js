// Simulacros: lista, simulacro aleatorio, ejecución tipo examen (sin retroalimentación hasta entregar),
// resultados y reanudación tras recargar.
import { esc, shuffle, formatTime, postCorte } from '../util.js';
import { inline, md } from '../engine/md.js';
import { loadJSON } from '../content.js';
import { choiceGroup } from '../engine/items/choice.js';
import { LIKERT, likertReflection } from '../engine/items/likert.js';
import { explainHTML } from '../engine/player.js';
import { emit } from '../engine/events.js';
import { recordTest } from '../progress/store.js';
import { loadData } from '../screens/data.js';
import { scoreTest, fmtScore, remainingMs, PASS_SCORE } from './score.js';

const KEY = 'dian2676rc:simulacro';
const CHOICE = new Set(['mcq', 'pjs']);
const DIFF_LABEL = { 1: 'Básico', 2: 'Intermedio', 3: 'Avanzado' };

// ---------- Sesión guardada ----------
function loadSession() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
function saveSession(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sin almacenamiento: la sesión vive en memoria */ }
}
function clearSession() {
  try { localStorage.removeItem(KEY); } catch { /* nada */ }
}

function newSession(test, { layout = 'one' } = {}) {
  const now = Date.now();
  return {
    id: test.id, title: test.title, mode: test.mode || 'practice', minutes: test.minutes || 0,
    items: [...test.items], likert: [...(test.likert || [])],
    answers: {}, flags: [], times: {}, elapsed: 0, startedAt: now, lastTick: now,
    idx: 0, focus: null, layout, paused: false, timeUpShown: false,
  };
}

// ---------- Lista ----------
export async function renderSimulacros(view) {
  view.innerHTML = '<h1>Simulacros</h1><p class="muted">Cargando…</p>';
  const [{ tests }, { state }, res] = await Promise.all([
    loadJSON('content/tests/index.json'),
    loadData(),
    loadJSON('content/resources.json').catch(() => ({ links: [], videos: [] })),
  ]);
  const saved = loadSession();
  const best = (id) => {
    const runs = state.tests.filter((t) => t.id === id);
    return runs.length ? Math.max(...runs.map((t) => t.score)) : null;
  };
  const card = (t) => {
    const b = best(t.id);
    return `<li class="card test-card">
      <div class="tc-head"><h3>${esc(t.title)}</h3>${t.mode === 'exam' ? '<span class="tag">Modo examen</span>' : `<span class="tag">${esc(DIFF_LABEL[t.difficulty] || '')}</span>`}</div>
      <p class="small muted">${t.items} preguntas${t.likert ? ` + ${t.likert} afirmaciones de autoinforme` : ''} · ${t.minutes >= 120 ? `${t.minutes / 60} h` : `${t.minutes} min`}</p>
      ${b != null ? `<p class="small">Mejor puntaje: <strong>${fmtScore(b)}</strong></p>` : ''}
      <a class="btn small-btn" href="#/simulacro/${esc(t.id)}">${b != null ? 'Repetir' : 'Empezar'}</a>
    </li>`;
  };
  const ext = (res.links || []).filter((l) => l.simulacro).concat((res.videos || []).filter((v) => v.simulacro));
  view.innerHTML = `
    <h1>Simulacros</h1>
    <p class="muted">Sin retroalimentación hasta entregar. Puntaje de 0 a 100 con dos decimales; para aprobar la prueba funcional se necesita <strong>${fmtScore(PASS_SCORE)}</strong>. Tus errores pasan solos a Repaso.</p>
    ${saved ? `<section class="card notice resume">
      <h2>Simulacro en curso</h2>
      <p>${esc(saved.title)} · ${Object.keys(saved.answers).length} de ${saved.items.length + saved.likert.length} respondidas</p>
      <div class="actions"><a class="btn" href="#/simulacro/${esc(saved.id)}">Continuar simulacro</a>
      <button type="button" class="btn secondary" data-act="discard">Descartar</button></div>
    </section>` : ''}
    <ul class="test-list">${tests.map(card).join('')}
      <li class="card test-card">
        <div class="tc-head"><h3>Simulacro aleatorio</h3><span class="tag">A tu medida</span></div>
        <p class="small muted">Eliges unidades, número de preguntas y dificultad.</p>
        <a class="btn small-btn secondary" href="#/simulacro/aleatorio">Configurar</a>
      </li>
    </ul>
    ${ext.length ? `<section class="card"><h2>Simulacros externos gratuitos</h2>
      <p class="small muted">Se abren en otra pestaña. No son oficiales.</p>
      <ul class="ext-list">${ext.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a>${r.note ? ` <span class="small muted">· ${esc(r.note)}</span>` : ''}</li>`).join('')}</ul>
    </section>` : ''}`;
  view.querySelector('[data-act="discard"]')?.addEventListener('click', () => {
    if (confirm('¿Descartar el simulacro en curso? Se perderán sus respuestas.')) { clearSession(); renderSimulacros(view); }
  });
}

// ---------- Simulacro ----------
export async function renderSimulacro(view, id) {
  cleanupHolder.fn = null;
  const data = await loadData();
  const saved = loadSession();
  if (saved && saved.id === id) return run(view, saved, data);
  if (id === 'aleatorio') return randomForm(view, data, saved);
  const test = await loadJSON(`content/tests/${id}.json`);
  return intro(view, test, data, saved);
}

function savedNotice(saved) {
  return saved ? `<div class="card notice"><p>Tienes otro simulacro en curso (<strong>${esc(saved.title)}</strong>). Si empiezas este, se descartará.
    <a href="#/simulacro/${esc(saved.id)}">Continuarlo</a></p></div>` : '';
}

function layoutPicker() {
  return `<fieldset class="field"><legend>Vista</legend>
    <label class="radio"><input type="radio" name="layout" value="one" checked> Una pregunta por pantalla</label>
    <label class="radio"><input type="radio" name="layout" value="sheet"> Hoja completa (todas en una página)</label>
  </fieldset>`;
}

function intro(view, test, data, saved) {
  const hideLikert = data.state.settings?.hideLikert;
  const likert = hideLikert ? [] : test.likert || [];
  const exam = test.mode === 'exam';
  view.innerHTML = `
    <h1>${esc(test.title)}</h1>
    ${savedNotice(saved)}
    <section class="card">
      <ul class="facts">
        <li><strong>${test.items.length}</strong> preguntas de competencias funcionales (puntúan)</li>
        ${likert.length ? `<li><strong>${likert.length}</strong> afirmaciones de autoinforme comportamental e integridad (no puntúan)</li>` : ''}
        <li>Tiempo: <strong>${test.minutes >= 120 ? `${test.minutes / 60} horas` : `${test.minutes} minutos`}</strong>${exam ? ', sin pausa, como en la prueba real' : ' (puedes pausar)'}</li>
        <li>No verás si aciertas hasta entregar. Puedes marcar preguntas para revisarlas.</li>
        <li>Para aprobar se necesita <strong>${fmtScore(PASS_SCORE)}</strong>.</li>
      </ul>
      ${exam ? '<p class="small muted">El día de la prueba no hay calculadora ni celular. Practica igual: lápiz y papel.</p>' : ''}
      ${layoutPicker()}
      <button type="button" class="btn big" data-act="start">Empezar</button>
    </section>`;
  view.querySelector('[data-act="start"]').addEventListener('click', () => {
    const layout = view.querySelector('input[name="layout"]:checked').value;
    const s = newSession({ ...test, likert }, { layout });
    saveSession(s);
    cleanupHolder.fn = run(view, s, data);
  });
  return () => cleanupHolder.fn?.();
}
const cleanupHolder = { fn: null };

function randomForm(view, data, saved) {
  const units = data.all.filter(({ entry, unit }) => unit && !entry.demo
    && (unit.questions || []).some((q) => CHOICE.has(q.type)));
  view.innerHTML = `
    <h1>Simulacro aleatorio</h1>
    ${savedNotice(saved)}
    <form class="card random-form">
      <fieldset class="field"><legend>Unidades</legend>
        <p class="small"><button type="button" class="link" data-act="all">Todas</button> · <button type="button" class="link" data-act="none">Ninguna</button> · <button type="button" class="link" data-act="func">Solo funcionales</button></p>
        ${units.map(({ entry, unit }) => `<label class="check"><input type="checkbox" name="u" value="${esc(unit.id)}" data-area="${esc(entry.area)}" ${entry.area === 'funcional' ? 'checked' : ''}>
          ${esc(entry.title)} <span class="small muted">(${unit.questions.filter((q) => CHOICE.has(q.type)).length})</span></label>`).join('')}
      </fieldset>
      <label class="field">Número de preguntas
        <select name="n">${[10, 20, 30, 40, 60].map((n) => `<option ${n === 20 ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field">Dificultad
        <select name="d"><option value="0">Mezclada</option><option value="1">Básica</option><option value="2">Intermedia</option><option value="3">Avanzada</option></select></label>
      <label class="check"><input type="checkbox" name="timer" checked> Con temporizador (1,5 min por pregunta)</label>
      ${layoutPicker()}
      <p class="form-msg small" role="alert"></p>
      <button type="submit" class="btn big">Empezar</button>
    </form>`;
  const form = view.querySelector('form');
  const boxes = [...form.querySelectorAll('input[name="u"]')];
  const set = (fn) => boxes.forEach((b) => { b.checked = fn(b); });
  form.querySelector('[data-act="all"]').addEventListener('click', () => set(() => true));
  form.querySelector('[data-act="none"]').addEventListener('click', () => set(() => false));
  form.querySelector('[data-act="func"]').addEventListener('click', () => set((b) => b.dataset.area === 'funcional'));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const chosen = new Set(boxes.filter((b) => b.checked).map((b) => b.value));
    const n = Number(form.n.value);
    const d = Number(form.d.value);
    const pool = units.filter(({ unit }) => chosen.has(unit.id))
      .flatMap(({ unit }) => unit.questions.filter((q) => CHOICE.has(q.type) && (!d || q.difficulty === d)).map((q) => q.id));
    const msg = form.querySelector('.form-msg');
    if (!pool.length) { msg.textContent = 'No hay preguntas con esa combinación. Elige más unidades o cambia la dificultad.'; return; }
    const items = shuffle(pool).slice(0, n);
    const test = { id: 'aleatorio', title: `Simulacro aleatorio (${items.length})`, mode: 'practice', minutes: form.timer.checked ? Math.ceil(items.length * 1.5) : 0, items };
    const s = newSession(test, { layout: form.querySelector('input[name="layout"]:checked').value });
    saveSession(s);
    cleanupHolder.fn = run(view, s, data);
  });
  return () => cleanupHolder.fn?.();
}

// ---------- Ejecución ----------
function run(view, s, data) {
  const get = (id) => data.index.get(id)?.item;
  const all = [...s.items, ...s.likert].filter((id) => get(id));
  const nFunc = s.items.filter((id) => get(id)).length;
  if (!all.length) { clearSession(); view.innerHTML = '<div class="card notice"><p>Este simulacro no tiene preguntas disponibles.</p><a class="btn" href="#/simulacros">Volver</a></div>'; return () => {}; }
  s.idx = Math.min(s.idx, all.length - 1);
  // Al reanudar: en modo examen el reloj siguió corriendo; en práctica, quedó en pausa.
  const now = Date.now();
  if (s.mode === 'exam') s.elapsed += Math.max(0, now - s.lastTick);
  s.lastTick = now;
  let done = false;

  document.body.classList.add('in-lesson');
  view.innerHTML = `
    <div class="runner">
      <header class="rn-top">
        <a class="close" href="#/simulacros" aria-label="Salir del simulacro (se guarda)">✕</a>
        <div class="rn-title"><strong>${esc(s.title)}</strong><span class="small muted rn-count"></span></div>
        <span class="rn-timer" aria-live="off"></span>
      </header>
      <div class="rn-tools">
        ${s.mode === 'practice' && s.minutes ? '<button type="button" class="btn small-btn secondary" data-act="pause">Pausar</button>' : ''}
        <button type="button" class="btn small-btn secondary" data-act="layout"></button>
        <button type="button" class="btn small-btn secondary" data-act="nav" aria-expanded="false">Navegador</button>
      </div>
      <nav class="rn-nav" hidden aria-label="Navegador de preguntas">
        <p class="small muted">Verde: respondida · ⚑: marcada para revisar</p>
        <div class="rn-grid"></div>
      </nav>
      <div class="rn-body"></div>
      <div class="rn-pause card" hidden><p><strong>Simulacro en pausa.</strong> El tiempo está detenido.</p><button type="button" class="btn" data-act="resume">Continuar</button></div>
      <footer class="rn-foot"><button type="button" class="btn big" data-act="submit">Entregar simulacro</button></footer>
    </div>`;
  const $ = (sel) => view.querySelector(sel);
  const body = $('.rn-body');
  const grid = $('.rn-grid');

  const isLikert = (id) => get(id).type === 'likert';
  const flagged = (id) => s.flags.includes(id);
  const persist = () => saveSession(s);

  function card(id, i) {
    const it = get(id);
    const likertStart = i === nFunc && s.likert.length;
    return `${likertStart ? '<h2 class="rn-part">Parte 2 · Autoinforme comportamental e integridad <span class="small muted">(no puntúa)</span></h2>' : ''}
      <article class="card rn-q" data-id="${esc(id)}" id="q-${i + 1}">
        <div class="rn-q-head"><span class="rn-num">Pregunta ${i + 1}</span>
          <button type="button" class="link rn-flag" data-flag="${esc(id)}" aria-pressed="${flagged(id)}">${flagged(id) ? '⚑ Marcada' : '⚐ Marcar para revisar'}</button></div>
        ${postCorte(it)}
        ${it.type === 'likert'
          ? `<p class="statement">${inline(it.statement)}</p>`
          : `${it.type === 'pjs' ? `<div class="case"><span class="box-lbl">Caso</span>${md(it.case)}</div>` : ''}
             <p class="prompt">${it.type === 'pjs' ? '<span class="box-lbl">Enunciado</span>' : ''}<strong>${inline(it.prompt)}</strong></p>`}
        <div class="choices${it.type === 'likert' ? ' likert' : ''}"></div>
      </article>`;
  }

  function mountChoices(root) {
    root.querySelectorAll('.rn-q').forEach((el) => {
      const id = el.dataset.id;
      const it = get(id);
      const opts = it.type === 'likert' ? LIKERT.map((text, i) => ({ id: String(i + 1), text })) : it.options;
      const g = choiceGroup(el.querySelector('.choices'), opts, {
        label: `Opciones de la pregunta`, letters: it.type !== 'likert',
        onSelect: (v) => { if (done) return; s.answers[id] = v; s.focus = id; persist(); updateMeta(); },
      });
      const prev = s.answers[id];
      if (prev != null) { const k = opts.findIndex((o) => String(o.id) === String(prev)); if (k >= 0) g.selectIndex(k); }
      el._group = g;
    });
    root.querySelectorAll('[data-flag]').forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.flag;
      s.flags = flagged(id) ? s.flags.filter((x) => x !== id) : [...s.flags, id];
      b.setAttribute('aria-pressed', String(flagged(id)));
      b.textContent = flagged(id) ? '⚑ Marcada' : '⚐ Marcar para revisar';
      persist(); updateMeta();
    }));
  }

  function renderBody() {
    $('[data-act="layout"]').textContent = s.layout === 'one' ? 'Ver hoja completa' : 'Una por pantalla';
    if (s.layout === 'sheet') {
      body.innerHTML = all.map(card).join('');
    } else {
      const i = s.idx;
      body.innerHTML = `${card(all[i], i)}
        <div class="rn-pager">
          <button type="button" class="btn secondary" data-act="prev" ${i === 0 ? 'disabled' : ''}>← Anterior</button>
          <button type="button" class="btn" data-act="next" ${i === all.length - 1 ? 'disabled' : ''}>Siguiente →</button>
        </div>`;
      body.querySelector('[data-act="prev"]').addEventListener('click', () => go(i - 1));
      body.querySelector('[data-act="next"]').addEventListener('click', () => go(i + 1));
    }
    mountChoices(body);
    updateMeta();
  }

  function go(i, scroll = true) {
    if (i < 0 || i >= all.length) return;
    s.idx = i;
    persist();
    if (s.layout === 'one') { renderBody(); window.scrollTo(0, 0); }
    else { updateMeta(); if (scroll) document.getElementById(`q-${i + 1}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
  }

  function updateMeta() {
    const answered = all.filter((id) => s.answers[id] != null).length;
    $('.rn-count').textContent = `${answered} de ${all.length} respondidas`;
    grid.innerHTML = all.map((id, i) => `<button type="button" class="rn-cell${s.answers[id] != null ? ' is-done' : ''}${flagged(id) ? ' is-flag' : ''}${i === s.idx && s.layout === 'one' ? ' is-current' : ''}${isLikert(id) ? ' is-likert' : ''}"
      data-go="${i}" aria-label="Pregunta ${i + 1}${s.answers[id] != null ? ', respondida' : ''}${flagged(id) ? ', marcada' : ''}">${i + 1}${flagged(id) ? '⚑' : ''}</button>`).join('');
  }
  grid.addEventListener('click', (e) => {
    const b = e.target.closest('[data-go]');
    if (b) go(Number(b.dataset.go));
  });

  function paintTimer() {
    const left = remainingMs(s);
    const el = $('.rn-timer');
    if (left == null) { el.textContent = `⏱ ${clock(s.elapsed)}`; return; }
    el.textContent = `⏳ ${clock(left)}`;
    el.classList.toggle('is-low', left < 5 * 60000);
    el.setAttribute('aria-label', `Tiempo restante: ${clock(left)}`);
  }

  // Reloj: suma tiempo solo si no está en pausa; reparte el tiempo a la pregunta visible o a la última tocada.
  let ticks = 0;
  const timer = setInterval(() => {
    const t = Date.now();
    const dt = Math.max(0, Math.min(t - s.lastTick, 5000));
    s.lastTick = t;
    if (s.paused || done) return;
    s.elapsed += dt;
    const cur = s.layout === 'one' ? all[s.idx] : s.focus;
    if (cur) s.times[cur] = (s.times[cur] || 0) + dt;
    paintTimer();
    if (++ticks % 5 === 0) persist();
    const left = remainingMs(s);
    if (left === 0) {
      if (s.mode === 'exam') { alert('Se acabó el tiempo. El simulacro se entregará ahora.'); submit(true); }
      else if (!s.timeUpShown) { s.timeUpShown = true; persist(); alert('Se cumplió el tiempo sugerido. Puedes terminar y entregar cuando quieras.'); }
    }
  }, 1000);

  $('[data-act="pause"]')?.addEventListener('click', () => setPaused(true));
  $('[data-act="resume"]').addEventListener('click', () => setPaused(false));
  function setPaused(p) {
    s.paused = p;
    s.lastTick = Date.now();
    $('.rn-pause').hidden = !p;
    body.hidden = p;
    $('.rn-nav').hidden = true;
    persist();
  }
  $('[data-act="layout"]').addEventListener('click', () => { s.layout = s.layout === 'one' ? 'sheet' : 'one'; persist(); renderBody(); });
  $('[data-act="nav"]').addEventListener('click', (e) => {
    const nav = $('.rn-nav');
    nav.hidden = !nav.hidden;
    e.currentTarget.setAttribute('aria-expanded', String(!nav.hidden));
  });
  $('[data-act="submit"]').addEventListener('click', () => submit(false));

  function onKey(e) {
    if (done || s.paused || s.layout !== 'one' || e.altKey || e.ctrlKey || e.metaKey) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4) body.querySelector('.rn-q')?._group?.selectIndex(n - 1);
    else if (e.key === 'ArrowRight') go(s.idx + 1);
    else if (e.key === 'ArrowLeft') go(s.idx - 1);
  }
  document.addEventListener('keydown', onKey);
  const onUnload = () => { s.lastTick = Date.now(); persist(); };
  window.addEventListener('beforeunload', onUnload);

  function submit(forced) {
    if (done) return;
    const pending = all.filter((id) => s.answers[id] == null).length;
    if (!forced) {
      const flags = s.flags.length;
      const msg = [pending ? `Tienes ${pending} sin responder.` : '', flags ? `Tienes ${flags} marcadas para revisar.` : '', '¿Entregar el simulacro?'].filter(Boolean).join(' ');
      if (!confirm(msg)) return;
    }
    done = true;
    clearInterval(timer);
    finish(view, s, data, all, nFunc);
  }

  if (s.paused) setPaused(true);
  paintTimer();
  renderBody();
  persist();

  return function cleanup() {
    clearInterval(timer);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('beforeunload', onUnload);
    document.body.classList.remove('in-lesson');
    if (!done) { s.lastTick = Date.now(); persist(); }
  };
}

function clock(ms) {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const sec = t % 60;
  const p = (x) => String(x).padStart(2, '0');
  return h ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

// ---------- Resultados ----------
function finish(view, s, data, all, nFunc) {
  const get = (id) => data.index.get(id)?.item;
  const funcItems = all.slice(0, nFunc).map(get);
  const likertIds = all.slice(nFunc);
  const r = scoreTest(funcItems, s.answers);

  // Alimenta el progreso: cada respuesta cuenta como intento (los errores van a Repaso).
  for (const it of funcItems) {
    const given = s.answers[it.id] ?? null;
    emit('answer', { itemId: it.id, unitId: it._unit, type: it.type, correct: given === it.answer, partial: false, ms: s.times[it.id] || 0, given });
  }
  for (const id of likertIds) {
    if (s.answers[id] != null) { const it = get(id); emit('answer', { itemId: id, unitId: it._unit, type: 'likert', correct: null, partial: false, ms: s.times[id] || 0, given: Number(s.answers[id]) }); }
  }
  recordTest({
    id: s.id, title: s.title, at: new Date().toISOString(), score: r.score, ms: s.elapsed,
    byUnit: Object.fromEntries(Object.entries(r.byUnit).map(([u, x]) => [u, { correct: x.correct, total: x.total }])),
    answers: Object.fromEntries(funcItems.map((it) => [it.id, s.answers[it.id] ?? null])),
  });
  clearSession();
  document.body.classList.remove('in-lesson');

  const title = (u) => data.all.find((x) => x.entry.id === u)?.entry.title || u;
  const wrong = funcItems.filter((it) => s.answers[it.id] !== it.answer);
  const avg = nFunc ? s.elapsed / nFunc : 0;
  const letter = (it, id) => { const k = it.options.findIndex((o) => o.id === id); return k >= 0 ? `${'ABCDEFGH'[k]}. ${it.options[k].text}` : null; };
  view.innerHTML = `
    <div class="end results">
      <h1>Resultado: ${esc(s.title)}</h1>
      <div class="score-box ${r.passed ? 'is-pass' : 'is-notyet'}">
        <span class="score-n">${fmtScore(r.score)}</span>
        <span class="score-l">${r.passed ? 'Aprobado (≥ 70,00)' : 'Aún no: la meta es 70,00'}</span>
      </div>
      <div class="stats">
        <div class="stat"><span class="stat-n">${r.correct}/${r.total}</span><span class="stat-l">correctas</span></div>
        <div class="stat"><span class="stat-n">${formatTime(s.elapsed)}</span><span class="stat-l">tiempo total</span></div>
        <div class="stat"><span class="stat-n">${formatTime(avg)}</span><span class="stat-l">promedio por pregunta</span></div>
        ${r.total - r.answered ? `<div class="stat"><span class="stat-n">${r.total - r.answered}</span><span class="stat-l">sin responder</span></div>` : ''}
      </div>
      <section class="card">
        <h2>Por unidad</h2>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>Unidad</th><th>Aciertos</th><th>%</th></tr></thead>
          <tbody>${Object.entries(r.byUnit).sort((a, b) => a[1].correct / a[1].total - b[1].correct / b[1].total)
            .map(([u, x]) => `<tr><td>${esc(title(u))}</td><td>${x.correct}/${x.total}</td><td>${Math.round((x.correct / x.total) * 100)} %</td></tr>`).join('')}</tbody>
        </table></div>
      </section>
      ${wrong.length ? `<section class="card">
        <h2>Para repasar (${wrong.length})</h2>
        <p class="small muted">Ya se añadieron a <a href="#/repaso/errores">Mis errores</a>.</p>
        ${wrong.map((it) => {
          const i = all.indexOf(it.id);
          const given = s.answers[it.id];
          return `<details class="missed"><summary><span>${i + 1}. ${esc(it.prompt)}</span><span class="small link">Ver explicación</span></summary>
            ${it.case ? `<div class="case"><span class="box-lbl">Caso</span>${md(it.case)}</div>` : ''}
            <p class="small">Tu respuesta: <strong>${given != null ? esc(letter(it, given)) : 'sin responder'}</strong></p>
            ${given != null && it.optionWhy?.[given] ? `<p class="small">${inline(it.optionWhy[given])}</p>` : ''}
            ${explainHTML(it)}
            <p class="small muted">Fuente: ${esc(it.source || '')} · ${esc(title(it._unit))} · ${s.times[it.id] ? formatTime(s.times[it.id]) : '—'}</p>
          </details>`;
        }).join('')}
      </section>` : '<div class="card"><p>Ninguna pregunta fallada. ¡Excelente!</p></div>'}
      ${likertReflection(likertIds.map((id) => Number(s.answers[id])).filter(Boolean))}
      <div class="actions">
        ${wrong.length ? '<a class="btn" href="#/repaso/errores">Repasar mis errores</a>' : ''}
        <a class="btn secondary" href="#/simulacros">Volver a simulacros</a>
        <a class="btn secondary" href="#/progreso">Ver progreso</a>
      </div>
    </div>`;
  window.scrollTo(0, 0);
}
