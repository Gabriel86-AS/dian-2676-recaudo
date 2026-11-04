// Ordenar: toca dos elementos para intercambiarlos.
import { esc, shuffleDifferent } from '../../util.js';
import { inline } from '../md.js';

export function render(item, el) {
  let current = shuffleDifferent(item.items.map((_, i) => i));
  let picked = null;
  let locked = false;
  el.innerHTML = `
    <p class="prompt"><strong>${inline(item.prompt)}</strong></p>
    <p class="small muted">Toca un elemento y luego otro para intercambiarlos.</p>
    <ol class="order-list"></ol>
    <div class="feedback" hidden></div>`;
  const list = el.querySelector('.order-list');

  const draw = () => {
    list.innerHTML = current.map((idx, pos) => `
      <li><button type="button" class="order-item ${picked === pos ? 'is-picked' : ''}" data-pos="${pos}"
        aria-pressed="${picked === pos}" ${locked ? 'disabled' : ''}>
        <span class="order-n" aria-hidden="true">${pos + 1}</span><span>${esc(item.items[idx])}</span></button></li>`).join('');
  };
  list.addEventListener('click', (e) => {
    const b = e.target.closest('.order-item');
    if (!b || locked) return;
    const pos = Number(b.dataset.pos);
    if (picked === null) picked = pos;
    else {
      if (picked !== pos) [current[picked], current[pos]] = [current[pos], current[picked]];
      picked = null;
    }
    draw();
    list.querySelector(`[data-pos="${pos}"]`)?.focus();
  });
  draw();

  return {
    ready: true,
    check() {
      locked = true;
      picked = null;
      draw();
      const correct = current.every((idx, pos) => idx === pos);
      list.querySelectorAll('.order-item').forEach((b, pos) => b.classList.add(current[pos] === pos ? 'is-correct' : 'is-wrong'));
      const fb = el.querySelector('.feedback');
      fb.hidden = false;
      fb.innerHTML = `
        ${correct ? '' : `<p><strong>Orden correcto:</strong></p><ol>${item.items.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>`}
        ${item.explain ? `<p>${inline(item.explain)}</p>` : ''}`;
      return { correct, partial: false, given: current.map((i) => item.items[i]) };
    },
  };
}
