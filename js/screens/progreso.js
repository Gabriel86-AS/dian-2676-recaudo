// Pantalla Progreso: resumen, preparación estimada, minutos por día, unidades e historial.
import { esc, formatTime } from '../util.js';
import { allUnitStats, readiness, weakest, overall, visibleEntry, pct } from '../progress/stats.js';
import { dayKey } from '../progress/store.js';
import { loadData } from './data.js';
import { fmtScore } from '../tests/score.js';

const PASS = 70;
const CHART_DAYS = 14;

// Tendencia de puntajes de simulacros (últimos 12), con la línea de aprobación en 70.
function trendSVG(tests) {
  const runs = tests.slice(-12);
  if (runs.length < 2) return '';
  const W = 336, H = 150, L = 26, R = 8, T = 10, B = 20;
  const x = (i) => L + (i * (W - L - R)) / (runs.length - 1);
  const y = (v) => T + ((100 - v) * (H - T - B)) / 100;
  const pts = runs.map((t, i) => `${x(i).toFixed(1)},${y(t.score).toFixed(1)}`).join(' ');
  const ticks = [0, 50, 100].map((v) => `<text x="${L - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`).join('');
  return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="Puntajes de los últimos ${runs.length} simulacros: ${runs.map((t) => fmtScore(t.score)).join(', ')}">
    ${ticks}<line class="pass" x1="${L}" x2="${W - R}" y1="${y(PASS)}" y2="${y(PASS)}"/><text x="${W - R}" y="${y(PASS) - 4}" text-anchor="end">70</text>
    <polyline class="line" points="${pts}"/>
    ${runs.map((t, i) => `<circle class="dot" cx="${x(i).toFixed(1)}" cy="${y(t.score).toFixed(1)}" r="3.5"><title>${esc(t.title || t.id)}: ${fmtScore(t.score)}</title></circle>`).join('')}
  </svg>`;
}

function chartSVG(studyDays) {
  const days = [];
  const today = new Date();
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    days.push({ d, k: dayKey(d), m: studyDays[dayKey(d)] || 0 });
  }
  const max = Math.max(30, ...days.map((x) => x.m));
  const W = 336, H = 140, top = 16, bottom = 22, gap = 4;
  const bw = (W - gap * (days.length - 1)) / days.length;
  const total = Math.round(days.reduce((a, x) => a + x.m, 0));
  const bars = days.map((x, i) => {
    const h = x.m ? Math.max(2, ((H - top - bottom) * x.m) / max) : 0;
    const xPos = i * (bw + gap);
    const label = i % 2 === (days.length - 1) % 2 ? `<text x="${xPos + bw / 2}" y="${H - 6}" class="ax">${x.d.getDate()}</text>` : '';
    return `<g><title>${x.k}: ${Math.round(x.m)} min</title>
      <rect x="${xPos}" y="${H - bottom - h}" width="${bw}" height="${h}" rx="3" class="bar-rect"/>
      ${x.m >= 1 ? `<text x="${xPos + bw / 2}" y="${H - bottom - h - 4}" class="val">${Math.round(x.m)}</text>` : ''}${label}</g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Minutos estudiados en los últimos ${CHART_DAYS} días: ${total} en total">
    <line x1="0" x2="${W}" y1="${H - bottom}" y2="${H - bottom}" class="axis"/>${bars}</svg>`;
}

export async function renderProgreso(view) {
  view.innerHTML = '<h1>Progreso</h1><p class="muted">Cargando…</p>';
  const { all, index, state } = await loadData();
  const stats = allUnitStats(all, index, state).filter((u) => visibleEntry(u.entry, state.settings));
  const o = overall(index, state);
  const ready = readiness(stats);
  const weak = weakest(stats);
  const fmtDate = (iso) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  view.innerHTML = `
    <h1>Progreso</h1>
    <div class="stats">
      <div class="stat"><span class="stat-n">${o.seen}/${o.total}</span><span class="stat-l">ítems vistos</span></div>
      <div class="stat"><span class="stat-n">${pct(o.firstTryAccuracy)}</span><span class="stat-l">acierto a la primera</span></div>
      <div class="stat"><span class="stat-n">${Math.round(o.minutes)}</span><span class="stat-l">minutos estudiados</span></div>
      <div class="stat"><span class="stat-n">${o.lessonsDone}</span><span class="stat-l">lecciones completadas</span></div>
    </div>

    <section class="card">
      <h2>Preparación para la prueba funcional</h2>
      <div class="ready" aria-label="Preparación estimada ${ready} de 100; mínimo aprobatorio ${PASS}">
        <div class="ready-fill ${ready >= PASS ? 'ok' : ''}" style="width:${Math.min(100, ready)}%"></div>
        <div class="ready-mark" style="left:${PASS}%"><span>${PASS}</span></div>
      </div>
      <p><strong>${ready}/100</strong> <span class="small muted">· estimación, no oficial</span></p>
      <p class="small muted">Promedio ponderado del dominio de las unidades funcionales (prioridad 1 ×3, 2 ×2, 3 ×1). Una pregunta cuenta como dominada cuando la has acertado al menos dos veces seguidas en el repaso espaciado.</p>
    </section>

    <section class="card">
      <h2>Minutos por día</h2>
      ${chartSVG(state.studyDays)}
    </section>

    ${weak.length ? `<section class="card"><h2>Temas más débiles</h2>
      <ul class="plain">${weak.map((u) => `<li><a href="#/unidad/${esc(u.id)}">${esc(u.entry.title)}</a> <span class="muted small">· ${pct(u.accuracy)} de acierto</span></li>`).join('')}</ul>
    </section>` : ''}

    <section class="card">
      <h2>Por unidad</h2>
      <ul class="unit-stats">${stats.map((u) => `
        <li>
          <div class="us-head"><a href="#/unidad/${esc(u.id)}">${esc(u.entry.title)}</a><span class="small muted">${u.hasContent ? `${pct(u.mastery)} dominio` : 'sin contenido aún'}</span></div>
          <div class="progress"><span style="width:${Math.round(u.mastery * 100)}%"></span></div>
          ${u.hasContent ? `<div class="us-meta small muted">
            <span>Acierto: ${pct(u.accuracy)}</span><span>Errores abiertos: ${u.mistakes}</span><span>Lecciones: ${u.lessonsDone}/${u.lessonsTotal}</span>
            ${u.questions ? `<a href="#/practicar/${esc(u.id)}">Practicar esta unidad</a>` : ''}
          </div>` : ''}
        </li>`).join('')}
      </ul>
    </section>

    <section class="card">
      <h2>Historial de simulacros</h2>
      ${trendSVG(state.tests)}
      ${state.tests.length ? `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>Fecha</th><th>Simulacro</th><th>Puntaje</th><th>Tiempo</th></tr></thead>
        <tbody>${[...state.tests].reverse().map((t) => `<tr><td>${esc(fmtDate(t.at))}</td><td>${esc(t.title || t.id)}</td>
          <td>${esc(fmtScore(t.score))}</td><td>${t.ms ? esc(formatTime(t.ms)) : '—'}</td></tr>`).join('')}</tbody>
      </table></div>` : '<p class="muted">Aún no has presentado simulacros.</p>'}
    </section>`;
}
