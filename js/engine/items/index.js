// Registro de renderizadores.
//
// Contrato: render(item, el, ctx) → { check(), onKey?(n), checkLabel?, ready? }
//   ctx.setReady(bool)  habilita o deshabilita el botón principal.
//   ctx.hideButton()    oculta el botón principal (autoevaluación con botones propios).
//   ctx.submit()        equivale a pulsar el botón principal.
// check() devuelve (o promete) { correct: bool|null, partial: bool, given, neutral?: bool }.
// `neutral` = sin respuesta correcta (likert); no cuenta como acierto ni error.
import * as concept from './concept.js';
import * as mcq from './mcq.js';
import * as truefalse from './truefalse.js';
import * as open from './open.js';
import * as order from './order.js';
import * as match from './match.js';
import * as cloze from './cloze.js';
import * as flashcard from './flashcard.js';
import * as likert from './likert.js';

export const renderers = { concept, mcq, pjs: mcq, truefalse, open, order, match, cloze, flashcard, likert };

export const isScored = (item) => item.type !== 'concept' && item.type !== 'likert';
