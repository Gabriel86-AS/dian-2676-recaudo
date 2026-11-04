// Selección múltiple (mcq) y Prueba de Juicio Situacional (pjs).
import { esc } from '../../util.js';
import { inline, md } from '../md.js';
import { choiceGroup, LETTERS } from './choice.js';

export function render(item, el, ctx) {
  const pjs = item.type === 'pjs';
  el.innerHTML = `
    ${pjs ? `<div class="case"><span class="box-lbl">Caso</span>${md(item.case)}</div>` : ''}
    <p class="prompt">${pjs ? '<span class="box-lbl">Enunciado</span>' : ''}<strong>${inline(item.prompt)}</strong></p>
    <div class="choices"></div>
    <div class="feedback" hidden></div>`;
  const group = choiceGroup(el.querySelector('.choices'), item.options, { onSelect: () => ctx.setReady(true) });
  return {
    onKey: (n) => group.selectIndex(n - 1),
    check() {
      const chosen = group.chosen;
      const correct = chosen === item.answer;
      group.lock(item.answer);
      const letter = LETTERS[item.options.findIndex((o) => o.id === item.answer)];
      const why = !correct && item.optionWhy?.[chosen];
      const fb = el.querySelector('.feedback');
      fb.hidden = false;
      fb.innerHTML = `
        ${why ? `<p><strong>Tu opción:</strong> ${inline(why)}</p>` : ''}
        ${String(item.explain).includes('\n')
          ? `<p><strong>Respuesta ${esc(letter)}.</strong></p>${md(item.explain)}`
          : `<p><strong>Respuesta ${esc(letter)}.</strong> ${inline(item.explain)}</p>`}`;
      return { correct, partial: false, given: chosen };
    },
  };
}
