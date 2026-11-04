// Reproductor de lecciones: un paso por pantalla, sin vidas ni temporizadores.
// Un ítem fallado se repite una vez al final ("Repasemos esta").
import { esc, formatTime, postCorte } from '../util.js';
import { inline, md } from './md.js';
import { renderers, isScored } from './items/index.js';
import { LETTERS } from './items/choice.js';
import { likertReflection } from './items/likert.js';
import { emit } from './events.js';

// Resuelve los pasos de una lección: ítems completos o { ref } al banco.
export function resolveSteps(unit, steps) {
  const bank = new Map([...(unit.questions || []), ...(unit.flashcards || []).map((c) => ({ type: 'flashcard', ...c }))]
    .map((q) => [q.id, q]));
  return steps.map((s) => {
    const item = s.ref ? bank.get(s.ref) : s;
    if (!item) console.warn(`Paso con referencia inexistente: ${s.ref}`);
    else if (!renderers[item.type]) console.warn(`Tipo de ítem desconocido: ${item.type} (${item.id})`);
    return item && renderers[item.type] ? item : null;
  }).filter(Boolean);
}

export function itemLabel(item) {
  const t = item.prompt || item.statement || item.front || item.title || String(item.text || '').replace(/\{\{.+?\}\}/g, '___');
  return t.length > 140 ? `${t.slice(0, 137)}…` : t;
}

// Explicación breve para la pantalla final.
export function explainHTML(item) {
  switch (item.type) {
    case 'mcq':
    case 'pjs': {
      const i = item.options.findIndex((o) => o.id === item.answer);
      return `<p><strong>${LETTERS[i]}. ${esc(item.options[i]?.text)}</strong></p>${md(item.explain)}`;
    }
    case 'truefalse': return `<p><strong>${item.answer ? 'Verdadero' : 'Falso'}.</strong> ${inline(item.explain)}</p>`;
    case 'open': return `<p>${inline(item.modelAnswer)}</p>`;
    case 'order': return `<ol>${item.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>${item.explain ? `<p>${inline(item.explain)}</p>` : ''}`;
    case 'match': return `<ul>${item.pairs.map((p) => `<li>${esc(p.left)} → ${esc(p.right)}</li>`).join('')}</ul>`;
    case 'cloze': return `<p>${esc(item.text).replace(/\{\{(.+?)\}\}/g, '<strong>$1</strong>')}</p>`;
    case 'flashcard': return `<p>${inline(item.back)}</p>`;
    default: return '';
  }
}

/**
 * @param {{unit, lesson:{id,title,steps}, el:HTMLElement, backHref:string}} opts
 * @returns {() => void} limpieza
 */
export function playLesson({ unit, lesson, el, backHref }) {
  const items = resolveSteps(unit, lesson.steps || []);
  const queue = items.map((item) => ({ item, retry: false }));
  const retried = new Set();
  const first = new Map(); // id → primer resultado
  const tStart = Date.now();
  let idx = 0;
  let state = 'answer';
  let current = null;
  let tItem = 0;

  document.body.classList.add('in-lesson');
  el.innerHTML = `
    <div class="player">
      <div class="player-top">
        <a class="close" href="${esc(backHref)}" aria-label="Salir de la lección">✕</a>
        <div class="bar" role="progressbar" aria-label="Avance de la lección" aria-valuemin="0" aria-valuemax="100"><span></span></div>
      </div>
      <div class="step"></div>
      <div class="player-foot">
        <div class="banner" role="status" hidden></div>
        <button type="button" class="btn big main">Comprobar</button>
      </div>
    </div>`;
  const stepEl = el.querySelector('.step');
  const bar = el.querySelector('.bar');
  const banner = el.querySelector('.banner');
  const main = el.querySelector('.main');

  const ctx = {
    setReady: (b) => { if (state === 'answer') main.disabled = !b; },
    hideButton: () => { main.hidden = true; },
    submit: () => onMain(),
  };

  function setProgress() {
    const pct = queue.length ? Math.round((idx / queue.length) * 100) : 100;
    bar.firstElementChild.style.width = `${pct}%`;
    bar.setAttribute('aria-valuenow', String(pct));
  }

  function show() {
    setProgress();
    if (idx >= queue.length) return finish();
    const { item, retry } = queue[idx];
    state = 'answer';
    banner.hidden = true;
    banner.className = 'banner';
    stepEl.innerHTML = `${retry ? '<p class="retry-tag">Repasemos esta</p>' : ''}${postCorte(item)}<div class="item item-${esc(item.type)}"></div>`;
    current = renderers[item.type].render(item, stepEl.querySelector('.item'), ctx);
    main.hidden = false;
    main.textContent = current.checkLabel || 'Comprobar';
    main.disabled = !current.ready;
    tItem = Date.now();
    stepEl.scrollIntoView?.({ block: 'start' });
    window.scrollTo(0, 0);
    (stepEl.querySelector('textarea, input') || stepEl.querySelector('.opt, .flip, .order-item, .match-item'))?.focus({ preventScroll: true });
  }

  async function onMain() {
    if (state === 'next') { idx++; return show(); }
    if (state !== 'answer' || main.disabled) return;
    const { item } = queue[idx];
    if (item.type === 'concept') { emit('time', { ms: Date.now() - tItem }); idx++; return show(); }
    state = 'checking';
    main.disabled = true;
    const res = await current.check();
    record(item, res);
    state = 'next';
    main.hidden = false;
    main.disabled = false;
    main.textContent = 'Continuar';
    main.focus({ preventScroll: true });
  }

  function record(item, res) {
    const ms = Date.now() - tItem;
    emit('answer', { itemId: item.id, unitId: item._unit || unit.id, type: item.type, correct: res.correct, partial: !!res.partial, ms, given: res.given });
    if (!first.has(item.id)) first.set(item.id, { item, ...res });
    const scored = isScored(item);
    let requeued = false;
    if (scored && res.correct === false && !res.partial && !retried.has(item.id)) {
      retried.add(item.id);
      queue.push({ item, retry: true });
      requeued = true;
    }
    let cls = 'neutral';
    let msg = 'Respuesta registrada.';
    if (scored) {
      if (res.correct) { cls = 'ok'; msg = '¡Correcto!'; }
      else if (res.partial) { cls = 'warn'; msg = 'Parcialmente.'; }
      else { cls = 'bad'; msg = requeued ? 'No esta vez. La repasaremos al final.' : 'No esta vez. Revisa la explicación.'; }
    }
    banner.className = `banner ${cls}`;
    banner.innerHTML = `<strong>${msg}</strong>${item.source ? `<span class="src">Fuente: ${esc(item.source)}</span>` : ''}`;
    banner.hidden = false;
  }

  function finish() {
    state = 'done';
    const results = [...first.values()].filter((r) => isScored(r.item));
    const correctFirstTry = results.filter((r) => r.correct).length;
    const total = results.length;
    const ms = Date.now() - tStart;
    emit('lessonComplete', { unitId: unit.id, lessonId: lesson.id, correctFirstTry, total, ms, virtual: !!lesson.virtual });
    const missed = results.filter((r) => !r.correct);
    const pct = total ? Math.round((correctFirstTry / total) * 100) : 100;
    const givens = [...first.values()].filter((r) => r.item.type === 'likert' && r.given).map((r) => Number(r.given));
    document.body.classList.remove('in-lesson');
    el.innerHTML = `
      <div class="end">
        <h1>Lección terminada</h1>
        <p class="muted">${esc(lesson.title)}</p>
        <div class="stats">
          ${total ? `<div class="stat"><span class="stat-n">${pct} %</span><span class="stat-l">a la primera (${correctFirstTry}/${total})</span></div>`
            : `<div class="stat"><span class="stat-n">${givens.length}</span><span class="stat-l">afirmaciones respondidas</span></div>`}
          <div class="stat"><span class="stat-n">${formatTime(ms)}</span><span class="stat-l">tiempo</span></div>
        </div>
        ${missed.length ? `<section class="card"><h2>Para repasar</h2>
          ${missed.map((r) => `<details class="missed"><summary><span>${esc(itemLabel(r.item))}</span><span class="small link">Ver explicación</span></summary>
            ${explainHTML(r.item)}${r.item.source ? `<p class="small muted">Fuente: ${esc(r.item.source)}</p>` : ''}</details>`).join('')}
          </section>` : total ? '<div class="card"><p>Todo correcto a la primera. ¡Muy bien!</p></div>' : ''}
        ${likertReflection(givens)}
        <div class="actions">
          <button type="button" class="btn" data-act="again">Repetir lección</button>
          <a class="btn secondary" href="${esc(backHref)}">Volver a la unidad</a>
        </div>
      </div>`;
    el.querySelector('[data-act="again"]').addEventListener('click', () => {
      cleanup();
      active = playLesson({ unit, lesson, el, backHref });
    });
    el.querySelector('h1').focus?.();
  }

  function onKey(e) {
    if (state === 'done' || e.altKey) return;
    const tag = e.target.tagName;
    const typing = tag === 'TEXTAREA' || tag === 'INPUT';
    if (e.key === 'Enter') {
      if (tag === 'TEXTAREA' && !(e.ctrlKey || e.metaKey)) return;
      if (tag === 'A' || tag === 'SUMMARY') return;
      if (main.hidden) return; // autoevaluación con sus propios botones
      e.preventDefault();
      onMain();
    } else if (!typing && /^[1-9]$/.test(e.key) && state === 'answer' && current?.onKey) {
      current.onKey(Number(e.key));
    }
  }

  main.addEventListener('click', onMain);
  document.addEventListener('keydown', onKey);
  const cleanup = () => {
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('in-lesson');
  };
  // Al repetir, la limpieza pasa a la nueva instancia.
  let active = cleanup;

  if (!queue.length) {
    stepEl.innerHTML = '<p>Esta lección aún no tiene pasos.</p>';
    main.hidden = true;
  } else {
    show();
  }
  return () => active();
}
