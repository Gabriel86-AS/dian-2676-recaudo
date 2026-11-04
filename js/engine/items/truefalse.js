import { inline } from '../md.js';
import { choiceGroup } from './choice.js';

export function render(item, el, ctx) {
  el.innerHTML = `
    <p class="prompt muted small">¿Verdadero o falso?</p>
    <p class="statement">${inline(item.statement)}</p>
    <div class="choices tf"></div>
    <div class="feedback" hidden></div>`;
  const group = choiceGroup(el.querySelector('.choices'),
    [{ id: 'true', text: 'Verdadero' }, { id: 'false', text: 'Falso' }],
    { onSelect: () => ctx.setReady(true), label: 'Verdadero o falso', letters: false });
  return {
    onKey: (n) => group.selectIndex(n - 1),
    check() {
      const given = group.chosen === 'true';
      const correct = given === item.answer;
      group.lock(String(item.answer));
      const fb = el.querySelector('.feedback');
      fb.hidden = false;
      fb.innerHTML = `<p>${inline(item.explain)}</p>`;
      return { correct, partial: false, given };
    },
  };
}
