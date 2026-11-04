// Mazo de tarjetas (#/tarjetas/:unit). Las que no sabías vuelven al final.
// La programación espaciada llega en la fase 3; aquí solo hay una pila "otra vez" en memoria.
import { esc, shuffle, postCorte } from '../util.js';
import { cardHTML, flipCard } from './items/flashcard.js';
import { emit } from './events.js';

export function playDeck({ unit, cards, el, backHref }) {
  let queue = shuffle(cards);
  const knewFirst = new Set();
  const seen = new Set();
  let flipped = false;
  let done = false;
  let tCard = 0;

  document.body.classList.add('in-lesson');

  function show() {
    if (!queue.length) return finish();
    flipped = false;
    tCard = Date.now();
    const card = queue[0];
    el.innerHTML = `
      <div class="player deck">
        <div class="player-top">
          <a class="close" href="${esc(backHref)}" aria-label="Salir de las tarjetas">✕</a>
          <span class="deck-count">Quedan ${queue.length}</span>
        </div>
        <div class="step">${postCorte(card)}${cardHTML(card)}
          <p class="small muted deck-hint">Toca la tarjeta o pulsa Espacio para voltearla. Después desliza → si la sabías, ← para repasarla.</p>
        </div>
        <div class="player-foot">
          <button type="button" class="btn big main" data-act="flip">Voltear</button>
          <div class="self-grade two" hidden>
            <button type="button" class="btn secondary" data-act="again">Repasar</button>
            <button type="button" class="btn" data-act="knew">Lo sabía</button>
          </div>
        </div>
      </div>`;
    const cardEl = el.querySelector('.flip');
    cardEl.addEventListener('click', flip);
    el.querySelector('[data-act="flip"]').addEventListener('click', flip);
    el.querySelector('[data-act="again"]').addEventListener('click', () => grade(false));
    el.querySelector('[data-act="knew"]').addEventListener('click', () => grade(true));
    addSwipe(cardEl);
    cardEl.focus({ preventScroll: true });
  }

  function flip() {
    if (flipped) return;
    flipped = true;
    flipCard(el.querySelector('.flip'), true);
    el.querySelector('[data-act="flip"]').hidden = true;
    el.querySelector('.self-grade').hidden = false;
    el.querySelector('[data-act="knew"]').focus({ preventScroll: true });
  }

  function grade(knew) {
    if (!flipped) return;
    const card = queue.shift();
    if (!seen.has(card.id) && knew) knewFirst.add(card.id);
    seen.add(card.id);
    emit('card', { cardId: card.id, unitId: card._unit || unit.id, knew, ms: Date.now() - tCard });
    if (!knew) queue.push(card);
    show();
  }

  function addSwipe(cardEl) {
    let x0 = null;
    cardEl.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
    cardEl.addEventListener('pointerup', (e) => {
      if (x0 === null) return;
      const dx = e.clientX - x0;
      x0 = null;
      if (flipped && Math.abs(dx) > 60) grade(dx > 0);
    });
  }

  function finish() {
    done = true;
    document.body.classList.remove('in-lesson');
    el.innerHTML = `
      <div class="end">
        <h1>Mazo completado</h1>
        <div class="stats">
          <div class="stat"><span class="stat-n">${knewFirst.size}/${cards.length}</span><span class="stat-l">sabías a la primera</span></div>
        </div>
        <div class="actions">
          <button type="button" class="btn" data-act="restart">Repetir mazo</button>
          <a class="btn secondary" href="${esc(backHref)}">Volver a la unidad</a>
        </div>
      </div>`;
    el.querySelector('[data-act="restart"]').addEventListener('click', () => {
      cleanup();
      active = playDeck({ unit, cards, el, backHref });
    });
  }

  function onKey(e) {
    if (done || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.tagName === 'A') return;
    if (e.key === ' ' || (e.key === 'Enter' && !flipped)) { e.preventDefault(); flip(); }
    else if (e.key === 'ArrowRight' || e.key === '2') grade(true);
    else if (e.key === 'ArrowLeft' || e.key === '1') grade(false);
  }

  document.addEventListener('keydown', onKey);
  const cleanup = () => {
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('in-lesson');
  };

  let active = cleanup;

  if (!cards.length) {
    el.innerHTML = `<div class="card"><p>Esta unidad aún no tiene tarjetas.</p><a class="btn secondary" href="${esc(backHref)}">Volver</a></div>`;
    cleanup();
  } else {
    show();
  }
  return () => active();
}
