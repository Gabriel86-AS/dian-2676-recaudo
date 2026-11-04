// Relacionar: toca un elemento de la izquierda y luego uno de la derecha.
import { esc, shuffleDifferent } from '../../util.js';
import { inline } from '../md.js';

export function render(item, el, ctx) {
  const n = item.pairs.length;
  const rightOrder = shuffleDifferent(item.pairs.map((_, i) => i));
  const pairOf = new Map(); // izquierda → derecha (índices de pairs)
  let activeLeft = null;
  let locked = false;

  el.innerHTML = `
    <p class="prompt"><strong>${inline(item.prompt)}</strong></p>
    <p class="small muted">Toca un elemento de la izquierda y luego su pareja. Tócalo de nuevo para deshacer.</p>
    <div class="match-grid">
      <div class="match-col" data-side="l"></div>
      <div class="match-col" data-side="r"></div>
    </div>
    <div class="feedback" hidden></div>`;
  const colL = el.querySelector('[data-side="l"]');
  const colR = el.querySelector('[data-side="r"]');

  const leftFor = (r) => [...pairOf].find(([, rr]) => rr === r)?.[0];
  const tag = (l) => (l === undefined ? '' : `<span class="pair-tag" aria-hidden="true">${l + 1}</span>`);

  const draw = () => {
    colL.innerHTML = item.pairs.map((p, l) => `
      <button type="button" class="match-item ${activeLeft === l ? 'is-picked' : ''} ${pairOf.has(l) ? 'is-paired' : ''}"
        data-l="${l}" aria-pressed="${activeLeft === l}" ${locked ? 'disabled' : ''}>
        ${tag(pairOf.has(l) ? l : undefined)}<span>${esc(p.left)}</span></button>`).join('');
    colR.innerHTML = rightOrder.map((r) => {
      const l = leftFor(r);
      return `<button type="button" class="match-item ${l !== undefined ? 'is-paired' : ''}" data-r="${r}" ${locked ? 'disabled' : ''}
        aria-label="${esc(item.pairs[r].right)}${l !== undefined ? `, unido con ${esc(item.pairs[l].left)}` : ''}">
        ${tag(l)}<span>${esc(item.pairs[r].right)}</span></button>`;
    }).join('');
    ctx.setReady(pairOf.size === n);
  };

  el.querySelector('.match-grid').addEventListener('click', (e) => {
    if (locked) return;
    const b = e.target.closest('.match-item');
    if (!b) return;
    if (b.dataset.l !== undefined) {
      const l = Number(b.dataset.l);
      if (pairOf.has(l)) { pairOf.delete(l); activeLeft = null; }
      else activeLeft = activeLeft === l ? null : l;
    } else {
      const r = Number(b.dataset.r);
      const owner = leftFor(r);
      if (owner !== undefined) pairOf.delete(owner);
      if (activeLeft !== null) { pairOf.set(activeLeft, r); activeLeft = null; }
    }
    draw();
  });
  draw();

  return {
    check() {
      locked = true;
      activeLeft = null;
      draw();
      // Dos derechas con el mismo texto son intercambiables (p. ej. «10 UVT» en dos filas).
      const ok = (l, r) => r !== undefined && (l === r || item.pairs[l].right === item.pairs[r].right);
      const correct = [...pairOf].every(([l, r]) => ok(l, r));
      colL.querySelectorAll('.match-item').forEach((b) => {
        const l = Number(b.dataset.l);
        b.classList.add(ok(l, pairOf.get(l)) ? 'is-correct' : 'is-wrong');
      });
      const fb = el.querySelector('.feedback');
      fb.hidden = false;
      fb.innerHTML = `
        ${correct ? '' : `<p><strong>Parejas correctas:</strong></p><ul>${item.pairs.map((p) => `<li>${esc(p.left)} → ${esc(p.right)}</li>`).join('')}</ul>`}
        ${item.explain ? `<p>${inline(item.explain)}</p>` : ''}`;
      return { correct, partial: false, given: [...pairOf].map(([l, r]) => [item.pairs[l].left, item.pairs[r].right]) };
    },
  };
}
