// Utilidades compartidas.

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Aviso para ítems basados en documentos posteriores al corte normativo de la convocatoria.
export const postCorte = (item) => (item?.tags?.includes('post-corte')
  ? '<p class="post-corte" title="Este contenido se apoya en un documento expedido después del 19 de junio de 2026, fecha de corte de la GOA.">ⓘ Norma posterior al corte (19-jun-2026)</p>'
  : '');

// Minúsculas, sin tildes ni puntuación, espacios simples.
export function normalize(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Baraja garantizando un orden distinto al original cuando es posible.
export function shuffleDifferent(arr) {
  if (arr.length < 2) return [...arr];
  let a;
  do { a = shuffle(arr); } while (a.every((x, i) => x === arr[i]));
  return a;
}

export function formatTime(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m} min ${s % 60} s` : `${s} s`;
}
