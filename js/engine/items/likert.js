// Autoinforme Likert de 4 niveles. Nunca hay respuesta correcta.
import { esc } from '../../util.js';
import { inline } from '../md.js';
import { choiceGroup } from './choice.js';

export const LIKERT = ['Totalmente en desacuerdo', 'En desacuerdo', 'De acuerdo', 'Totalmente de acuerdo'];

/**
 * Pantalla de reflexión tras un bloque de autoinforme: distribución de las respuestas.
 * Nunca dice qué respuesta "puntúa más".
 * @param {number[]} givens respuestas 1–4
 */
export function likertReflection(givens) {
  const n = givens.length;
  if (!n) return '';
  const counts = [1, 2, 3, 4].map((v) => givens.filter((g) => g === v).length);
  const pct = (c) => Math.round((c / n) * 100);
  const extreme = counts[3] / n > 0.8;
  return `
    <section class="card reflection">
      <h2>Tu autoinforme</h2>
      <p class="muted small">Cómo se repartieron tus ${n} respuestas.</p>
      <ul class="likert-dist">
        ${LIKERT.map((label, i) => `
          <li><span class="ld-label">${label}</span>
            <span class="ld-bar" role="img" aria-label="${label}: ${counts[i]} de ${n}"><span style="width:${pct(counts[i])}%"></span></span>
            <span class="ld-n">${counts[i]} · ${pct(counts[i])} %</span></li>`).join('')}
      </ul>
      ${extreme ? `<p class="note">Marcaste «Totalmente de acuerdo» en más del 80 % de las afirmaciones.
        La prueba real incluye subescalas de control que detectan patrones de respuesta exageradamente favorables.
        Lo que mejor funciona es responder con honestidad y de forma coherente con lo que de verdad haces.</p>` : ''}
      <p class="small muted">No hay respuestas correctas ni incorrectas: esta práctica sirve para conocer el formato y reflexionar sobre tus conductas.</p>
    </section>`;
}

export function render(item, el, ctx) {
  el.innerHTML = `
    <p class="prompt muted small">Autoinforme · ${esc(item.competency)}${item.level ? ` · nivel ${esc(item.level)}` : ''}</p>
    <p class="statement">${inline(item.statement)}</p>
    <div class="choices likert"></div>
    <div class="feedback neutral" hidden></div>`;
  const group = choiceGroup(el.querySelector('.choices'), LIKERT.map((text, i) => ({ id: String(i + 1), text })),
    { onSelect: () => ctx.setReady(true), label: 'Grado de acuerdo', letters: false });

  return {
    checkLabel: 'Responder',
    onKey: (n) => group.selectIndex(n - 1),
    check() {
      const given = Number(group.chosen);
      group.lock(null);
      const fb = el.querySelector('.feedback');
      fb.hidden = false;
      fb.innerHTML = `
        ${item.insight ? `<p><strong>Qué observa este enunciado:</strong> ${inline(item.insight)}</p>` : ''}
        <p class="small">No hay respuestas correctas o incorrectas. Responde con honestidad y coherencia:
        las subescalas de control detectan respuestas exageradamente favorables, como marcar siempre el extremo.</p>`;
      return { neutral: true, correct: null, partial: false, given };
    },
  };
}
