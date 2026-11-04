// Respuesta abierta: pista por palabras clave + autoevaluación (la que cuenta).
import { esc, normalize } from '../../util.js';
import { inline } from '../md.js';

export function keywordHits(text, keywords = []) {
  const t = ` ${normalize(text)} `;
  return keywords.filter((k) => t.includes(normalize(k)));
}

export function render(item, el, ctx) {
  const id = `open-${item.id}`;
  el.innerHTML = `
    <label class="prompt" for="${esc(id)}"><strong>${inline(item.prompt)}</strong></label>
    <textarea id="${esc(id)}" class="answer-box" rows="5" placeholder="Escribe tu respuesta con tus palabras…"></textarea>
    <p class="small muted kbd-hint">Ctrl + Enter para comprobar.</p>
    <div class="feedback" hidden></div>`;
  const ta = el.querySelector('textarea');
  ta.addEventListener('input', () => ctx.setReady(ta.value.trim().length > 0));

  return {
    check() {
      const text = ta.value;
      ta.readOnly = true;
      const kws = item.keywords || [];
      const hits = keywordHits(text, kws);
      const min = item.minKeywords ?? Math.ceil(kws.length / 2);
      const enough = hits.length >= min;
      const fb = el.querySelector('.feedback');
      fb.hidden = false;
      fb.innerHTML = `
        ${kws.length ? `<p class="hint ${enough ? 'ok' : ''}"><strong>Pista:</strong> tu respuesta menciona ${hits.length} de ${kws.length} ideas clave
          (orientativo; se sugieren al menos ${min}).${hits.length ? ` Encontradas: ${hits.map(esc).join(', ')}.` : ''}</p>` : ''}
        <div class="model"><span class="box-lbl">Respuesta modelo</span><p>${inline(item.modelAnswer)}</p></div>
        ${item.keyPoints?.length ? `<p><strong>¿Tu respuesta incluye…?</strong></p>
          <ul class="checklist">${item.keyPoints.map((k, i) => `<li><label><input type="checkbox" id="${esc(id)}-kp${i}"> ${inline(k)}</label></li>`).join('')}</ul>` : ''}
        <p><strong>¿Cómo te fue?</strong></p>
        <div class="self-grade">
          <button type="button" class="btn secondary" data-g="si">Lo tenía</button>
          <button type="button" class="btn secondary" data-g="parcial">Parcial</button>
          <button type="button" class="btn secondary" data-g="no">No lo tenía</button>
        </div>`;
      ctx.hideButton();
      fb.querySelector('.self-grade button').focus();
      return new Promise((resolve) => {
        fb.querySelectorAll('.self-grade button').forEach((b) => b.addEventListener('click', () => {
          fb.querySelectorAll('.self-grade button').forEach((x) => { x.disabled = true; x.classList.toggle('is-picked', x === b); });
          const g = b.dataset.g;
          resolve({ correct: g === 'si', partial: g === 'parcial', given: { text, grade: g, keywordHits: hits.length } });
        }));
      });
    },
  };
}
