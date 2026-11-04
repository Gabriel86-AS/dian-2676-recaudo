// Completar huecos: "texto {{respuesta}} texto".
import { esc, normalize } from '../../util.js';

export function parseCloze(text) {
  return String(text).split(/\{\{(.+?)\}\}/);
}

export function isAccepted(given, answer, alternatives = {}) {
  const g = normalize(given);
  return [answer, ...(alternatives[answer] || [])].some((a) => normalize(a) === g);
}

export function render(item, el, ctx) {
  const parts = parseCloze(item.text);
  let gap = 0;
  const html = parts.map((p, i) => {
    if (i % 2 === 0) return esc(p);
    const w = Math.max(4, p.length + 2);
    return `<input type="text" class="gap" data-i="${i}" autocomplete="off" autocapitalize="off" spellcheck="false"
      aria-label="Hueco ${++gap}" style="width:${w}ch">`;
  }).join('');
  el.innerHTML = `
    <p class="prompt muted small">Completa los espacios.</p>
    <p class="cloze-text">${html}</p>
    <div class="feedback" hidden></div>`;
  const inputs = [...el.querySelectorAll('.gap')];
  const update = () => ctx.setReady(inputs.every((x) => x.value.trim()));
  inputs.forEach((x) => x.addEventListener('input', update));

  return {
    check() {
      const given = inputs.map((x) => x.value);
      let all = true;
      inputs.forEach((x) => {
        const ans = parts[Number(x.dataset.i)];
        const ok = isAccepted(x.value, ans, item.alternatives);
        all &&= ok;
        x.readOnly = true;
        x.classList.add(ok ? 'is-correct' : 'is-wrong');
        if (!ok) x.insertAdjacentHTML('afterend', ` <span class="gap-fix">${esc(ans)}</span>`);
      });
      if (item.explain) {
        const fb = el.querySelector('.feedback');
        fb.hidden = false;
        fb.innerHTML = `<p>${esc(item.explain)}</p>`;
      }
      return { correct: all, partial: false, given };
    },
  };
}
