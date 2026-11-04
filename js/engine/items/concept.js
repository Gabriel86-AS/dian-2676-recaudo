import { esc } from '../../util.js';
import { md } from '../md.js';

export function render(item, el) {
  el.innerHTML = `
    <h2 class="step-title">${esc(item.title)}</h2>
    <div class="prose">${md(item.body)}</div>
    ${item.example ? `<div class="example"><span class="box-lbl">Ejemplo</span>${md(item.example)}</div>` : ''}`;
  return { checkLabel: 'Entendido', ready: true, check: () => ({ neutral: true, correct: null, partial: false }) };
}
