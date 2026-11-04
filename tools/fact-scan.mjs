// Busca en todo el contenido las frases que mencionan hechos de alto riesgo y muestra el fragmento,
// para revisar que no haya contradicciones. Uso: node tools/fact-scan.mjs [tema]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));

// Cada tema: patrón del tema y patrón de las cifras que deben aparecer cerca.
const TOPICS = {
  'emplazamiento-corregir': [/emplazamiento para corregir/i, /\b(mes|meses|días)\b/i],
  'requerimiento-especial': [/requerimiento especial/i, /\b(años?|meses)\b/i],
  'liquidacion-revision': [/liquidaci[oó]n de revisi[oó]n/i, /\b(meses|años?)\b/i],
  firmeza: [/firmeza|en firme/i, /\b(años?)\b/i],
  aforo: [/aforo/i, /\b(años?)\b/i],
  extemporaneidad: [/extemporaneidad|extempor[aá]ne/i, /%|por ciento/i],
  inexactitud: [/inexactitud/i, /%|por ciento/i],
  gradualidad: [/gradualidad|art\. 640|artículo 640/i, /%|por ciento/i],
  caducidad: [/caducidad/i, /\b(años?)\b/i],
  uvt: [/\bUVT\b.{0,30}(2026|\$)/i, /\d/],
  examen: [/(\d|cinco|cuatro)\s*horas|8:00|1:00 p|70,00|70\.00|mínimo aprobatorio|tres opciones|4 niveles|cuatro niveles/i, /./],
};
const only = process.argv[2];

function* texts(obj, where) {
  if (typeof obj === 'string') { yield [where, obj]; return; }
  if (Array.isArray(obj)) { for (const x of obj) yield* texts(x, where); return; }
  if (obj && typeof obj === 'object') {
    const id = obj.id || where;
    for (const [k, v] of Object.entries(obj)) if (!['id', 'ref', 'type', 'answer', 'source'].includes(k)) yield* texts(v, id);
  }
}

const files = manifest.units.filter((u) => !u.pending).map((u) => u.file);
for (const [topic, [re, near]] of Object.entries(TOPICS)) {
  if (only && only !== topic) continue;
  console.log(`\n===== ${topic} =====`);
  const seen = new Set();
  for (const f of files) {
    const unit = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    for (const [id, s] of texts(unit, unit.id)) {
      for (const sentence of s.split(/(?<=[.;])\s+|\n/)) {
        if (re.test(sentence) && near.test(sentence)) {
          const key = id + sentence;
          if (seen.has(key)) continue;
          seen.add(key);
          console.log(`${id.padEnd(14)} ${sentence.trim().slice(0, 220)}`);
        }
      }
    }
  }
}
