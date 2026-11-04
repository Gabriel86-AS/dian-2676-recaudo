// Tarjeta dentro de una lección: voltear y autoevaluar.
import { inline } from '../md.js';

export function cardHTML(card) {
  return `
    <div class="flip" tabindex="0" role="button" aria-label="Voltear tarjeta">
      <div class="flip-inner">
        <div class="flip-face front"><span class="box-lbl">Pregunta</span><p>${inline(card.front)}</p></div>
        <div class="flip-face back" aria-hidden="true"><span class="box-lbl">Respuesta</span><p>${inline(card.back)}</p>
          ${card.source ? `<p class="small muted">${inline(card.source)}</p>` : ''}</div>
      </div>
    </div>`;
}

export function flipCard(cardEl, flipped) {
  cardEl.classList.toggle('is-flipped', flipped);
  cardEl.querySelector('.front').setAttribute('aria-hidden', String(flipped));
  cardEl.querySelector('.back').setAttribute('aria-hidden', String(!flipped));
}

export function render(item, el, ctx) {
  el.innerHTML = `${cardHTML(item)}<div class="feedback" hidden></div>`;
  const card = el.querySelector('.flip');
  let flipped = false;
  card.addEventListener('click', () => { if (!flipped) ctx.submit(); });

  return {
    checkLabel: 'Voltear',
    ready: true,
    check() {
      flipped = true;
      flipCard(card, true);
      ctx.hideButton();
      const fb = el.querySelector('.feedback');
      fb.hidden = false;
      fb.innerHTML = `<div class="self-grade two">
        <button type="button" class="btn secondary" data-k="no">No lo sabía</button>
        <button type="button" class="btn" data-k="si">Lo sabía</button></div>`;
      fb.querySelector('[data-k="si"]').focus();
      return new Promise((resolve) => {
        fb.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
          fb.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          const knew = b.dataset.k === 'si';
          resolve({ correct: knew, partial: false, given: knew });
        }));
      });
    },
  };
}
