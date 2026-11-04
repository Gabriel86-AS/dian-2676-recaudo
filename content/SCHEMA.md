# Esquema de contenido

Todo el contenido vive en JSON bajo `content/`. Sin paso de compilación: el navegador lee los archivos directamente.

- `content/manifest.json`: lista de unidades y simulacros.
- `content/units/<unit-id>.json`: una unidad.
- `content/tests/<test-id>.json`: un simulacro (fase 7).
- `content/resources.json`: videos y enlaces externos.

Plantilla completa con un ítem de cada tipo: `content/units/_ejemplo.json` (no aparece en el manifiesto).

## Reglas de contenido

1. **Cada ítem cita su fuente** en `source` (p. ej. `"ET art. 707"`). Nunca inventar artículos, plazos ni cifras: verificar con `grep` en `dian_2676_recursos/`.
2. **Los IDs son permanentes.** El progreso se guarda por ID; nunca renumerar ni reutilizar un ID borrado.
3. Convención de IDs: `<prefijo>-<tipo>-<nnn>`.
   - Lecciones: `<prefijo>-<nn>` (`sanc-01`).
   - Preguntas: `<prefijo>-q-<nnn>` (`sanc-q-014`).
   - Tarjetas: `<prefijo>-fc-<nnn>` (`sanc-fc-003`).
   - Conceptos: `<prefijo>-c-<nnn>`.
4. **Opciones equilibradas.** En `mcq` y `pjs`, la correcta no debe ser la más larga ni la más detallada. Todas las opciones deben tener longitud parecida y ser plausibles; repartir la clave entre A, B, C (y D).
5. `pjs` imita el formato oficial: caso + enunciado + **3 opciones A–C**, una sola correcta. Las incorrectas suelen ser acciones de otra etapa del procedimiento.
6. Texto en español de Colombia. No copiar texto de sitios de preparación; las normas y documentos oficiales sí pueden citarse.

Prefijos por unidad: `rec` recaudo · `decl` recepcion-declaraciones · `erec` entidades-recaudadoras · `ext` extincion-obligaciones · `tit` titulos-ejecutivos · `dev` devoluciones · `cont` principios-contables · `dat` analitica-datos · `cpi` cobro-persuasivo-insolvencia · `cbg` buen-gobierno · `hinf` herramientas-informaticas · `sist` sistema-tributario · `proc` procedimiento-administrativo · `const` constitucion-transparencia · `mipg` mipg · `gdoc` gestion-documental · `estr` estructura · `mis` misionalidad · `raz` razonamiento · `comp` comportamentales · `integ` integridad.

## Manifiesto

```json
{
  "units": [
    { "id": "fiscalizacion", "file": "units/fiscalizacion.json", "title": "Fiscalización y liquidación tributaria y aduanera", "area": "funcional", "priority": 1 }
  ],
  "tests": [
    { "id": "test-basico-1", "file": "tests/test-basico-1.json", "title": "Básico 1", "level": "basico" }
  ]
}
```

`area`: `funcional` | `comportamental` | `integridad`. `priority`: 1 (más alta) a 3. `demo: true` marca entradas temporales que se quitan antes del lanzamiento. `pending: true` indica que el archivo de la unidad aún no existe (la app no lo pide); **al crear el archivo de una unidad, quitar `pending`**. Si el archivo de una unidad aún no existe, la app muestra un aviso en vez de fallar.

## Unidad

```json
{
  "id": "fiscalizacion",
  "title": "Fiscalización y liquidación tributaria y aduanera",
  "area": "funcional",
  "priority": 1,
  "summary": "2–3 líneas.",
  "sources": ["ET arts. 683–719-2", "Ley 2586/2026 arts. 3–12, 56–75"],
  "lessons": [
    { "id": "fisc-01", "title": "Requerimiento especial", "minutes": 6, "steps": [] }
  ],
  "flashcards": [
    { "id": "fisc-fc-001", "front": "¿Plazo para responder el requerimiento especial?", "back": "3 meses desde su notificación.", "source": "ET art. 707" }
  ],
  "questions": []
}
```

- `lessons[].steps`: lista ordenada de pasos. Cada paso es un ítem completo **o** una referencia `{ "ref": "<id>" }` a una pregunta de `questions` (así una pregunta se usa en la lección y también en repaso y simulacros sin duplicarla).
- `flashcards`: mazo de la unidad (repaso espaciado).
- `questions`: banco de preguntas de la unidad (repaso, errores y simulacros).

## Campos comunes de todo ítem

| Campo | Tipo | Notas |
|---|---|---|
| `id` | string | Permanente. |
| `type` | string | Uno de los tipos de abajo. |
| `difficulty` | 1–3 | 1 recordar, 2 aplicar, 3 caso complejo. |
| `source` | string | Fuente legal u oficial. Obligatorio. |
| `tags` | string[] | Opcional. |

## Tipos de ítem

### `concept`
Pantalla de explicación. `body` admite Markdown básico: `**negrita**`, listas con `-`, tablas con `|` y párrafos separados por línea en blanco. `example` es opcional.

```json
{
  "id": "ej-c-001", "type": "concept", "difficulty": 1, "source": "ET arts. 703, 705, 707",
  "title": "¿Qué es el requerimiento especial?",
  "body": "Antes de la **liquidación de revisión**, la DIAN envía **por una sola vez** un requerimiento especial (art. 703).\n\n- Se notifica a más tardar **3 años** después del vencimiento del plazo para declarar (art. 705).\n- Se responde dentro de los **3 meses** siguientes a su notificación (art. 707).",
  "example": "Si el plazo para declarar venció el 15 de abril de 2024, el requerimiento debe notificarse a más tardar el 15 de abril de 2027."
}
```

### `mcq`
Selección múltiple. `answer` es el `id` de la opción correcta. `explain` dice por qué es correcta; `optionWhy` explica por qué falla **cada** opción incorrecta.

```json
{
  "id": "ej-q-001", "type": "mcq", "difficulty": 1, "source": "ET art. 707",
  "prompt": "¿De cuánto tiempo dispone el contribuyente para responder el requerimiento especial?",
  "options": [
    { "id": "a", "text": "1 mes desde su notificación" },
    { "id": "b", "text": "3 meses desde su notificación" },
    { "id": "c", "text": "6 meses desde su notificación" },
    { "id": "d", "text": "3 años desde su notificación" }
  ],
  "answer": "b",
  "explain": "El art. 707 da 3 meses, contados desde la notificación.",
  "optionWhy": {
    "a": "El art. 707 no fija un mes: el plazo es de 3 meses.",
    "c": "No existe un plazo de 6 meses para esta respuesta.",
    "d": "Los 3 años son el término para notificar el requerimiento (art. 705)."
  }
}
```

### `pjs`
Prueba de Juicio Situacional, como en el examen: `case` (situación), `prompt` (enunciado) y siempre **3 opciones** con ids `a`, `b`, `c`. Resto de campos igual que `mcq`.

```json
{
  "id": "ej-q-002", "type": "pjs", "difficulty": 2, "source": "ET arts. 709 y 713",
  "case": "Una contribuyente recibe un requerimiento especial. En su respuesta acepta parte de los hechos y corrige su declaración con los mayores valores aceptados.",
  "prompt": "¿Cómo debe tratarse la sanción por inexactitud sobre los hechos aceptados?",
  "options": [
    { "id": "a", "text": "Reducirla a la cuarta parte de la planteada por la DIAN (art. 709)." },
    { "id": "b", "text": "Reducirla a la mitad de la planteada por la DIAN (art. 713)." },
    { "id": "c", "text": "Mantenerla completa hasta la liquidación de revisión (art. 703)." }
  ],
  "answer": "a",
  "explain": "La aceptación ocurre al responder el requerimiento: aplica el art. 709.",
  "optionWhy": {
    "b": "La mitad (art. 713) aplica al aceptar los hechos de la liquidación de revisión.",
    "c": "La ley sí premia la aceptación en esta etapa."
  }
}
```

### `truefalse`

```json
{
  "id": "ej-q-003", "type": "truefalse", "difficulty": 1, "source": "ET art. 708",
  "statement": "La DIAN puede ampliar el requerimiento especial tantas veces como lo necesite.",
  "answer": false,
  "explain": "Falso. El art. 708 permite la ampliación por una sola vez."
}
```

### `open`
Respuesta abierta. Se autoevalúa con `keyPoints` (rúbrica) y se da una pista automática contando `keywords` presentes (minúsculas; se ignoran tildes). Se considera suficiente si aparecen al menos `minKeywords`.

```json
{
  "id": "ej-q-004", "type": "open", "difficulty": 2, "source": "ET arts. 709 y 713",
  "prompt": "Explica la diferencia entre la reducción del art. 709 y la del art. 713.",
  "modelAnswer": "El 709 reduce la sanción a la cuarta parte al aceptar los hechos del requerimiento; el 713, a la mitad al aceptar los de la liquidación de revisión.",
  "keyPoints": ["709 → cuarta parte", "713 → mitad", "Hay que corregir la declaración"],
  "keywords": ["cuarta parte", "mitad", "requerimiento", "liquidacion de revision"],
  "minKeywords": 3
}
```

### `order`
`items` se escribe en el orden correcto; la app lo baraja al mostrarlo.

```json
{
  "id": "ej-q-005", "type": "order", "difficulty": 2, "source": "ET arts. 703, 707, 708",
  "prompt": "Ordena las actuaciones del proceso de revisión.",
  "items": ["Notificación del requerimiento especial", "Respuesta del contribuyente", "Ampliación del requerimiento (si se ordena)", "Liquidación de revisión"],
  "explain": "El requerimiento es requisito previo de la liquidación de revisión (art. 703)."
}
```

### `match`
Parejas correctas en `pairs`; la app baraja la columna derecha.

```json
{
  "id": "ej-q-006", "type": "match", "difficulty": 2, "source": "ET arts. 705, 707, 709, 713",
  "prompt": "Relaciona cada artículo con su regla.",
  "pairs": [
    { "left": "Art. 705", "right": "3 años para notificar el requerimiento" },
    { "left": "Art. 707", "right": "3 meses para responderlo" },
    { "left": "Art. 709", "right": "Sanción reducida a la cuarta parte" },
    { "left": "Art. 713", "right": "Sanción reducida a la mitad" }
  ],
  "explain": "Plazos y reducciones del proceso de revisión."
}
```

### `cloze`
Huecos con `{{respuesta}}`. `alternatives` lista otras respuestas aceptadas para cada hueco (comparación sin tildes ni mayúsculas).

```json
{
  "id": "ej-q-007", "type": "cloze", "difficulty": 1, "source": "ET art. 705",
  "text": "El requerimiento especial debe notificarse dentro de los {{3}} años siguientes al vencimiento del plazo para declarar.",
  "alternatives": { "3": ["tres"] }
}
```

### `likert`
Autoinforme de 4 niveles (Totalmente en desacuerdo · En desacuerdo · De acuerdo · Totalmente de acuerdo). **No tiene respuesta correcta** y no cuenta como error. `insight` indica la conducta observable de la Res. DIAN 65/2024 que mide.

```json
{
  "id": "ej-q-008", "type": "likert", "difficulty": 1, "source": "Res. DIAN 65/2024, Adaptabilidad",
  "statement": "Cuando cambian las herramientas de mi trabajo, dedico tiempo a aprenderlas aunque eso alargue mi jornada.",
  "competency": "Adaptabilidad",
  "level": 1,
  "insight": "Conducta observable: «Integra con facilidad nuevas perspectivas, aprendizajes y tecnologías que le permitan cumplir con su labor»."
}
```

### `flashcard`
Tarjeta dentro de una lección. Las del mazo de la unidad (`flashcards[]`) usan los mismos campos sin `type`.

```json
{
  "id": "ej-fc-001", "type": "flashcard", "difficulty": 1, "source": "ET art. 707",
  "front": "¿Plazo para responder el requerimiento especial?",
  "back": "3 meses desde su notificación."
}
```

## Recursos (`content/resources.json`)

```json
{
  "videos": [{ "title": "…", "url": "https://www.youtube.com/watch?v=…", "unit": "sanciones", "note": "…" }],
  "links":  [{ "title": "Guía de orientación al aspirante (CNSC)", "url": "https://…", "note": "…" }]
}
```

## Simulacros (`content/tests/<id>.json` + `content/tests/index.json`)

Se generan con `node tools/build-tests.mjs` (con semilla fija: siempre salen iguales). No se editan a mano.

```json
{
  "id": "test-medio-1", "title": "Simulacro intermedio 1", "difficulty": 2, "minutes": 60, "mode": "practice",
  "blueprint": { "fiscalizacion": 7, "sanciones": 7 },
  "items": ["fisc-q-012", "sanc-q-003"],
  "likert": ["comp-q-031"]
}
```
- `items`: solo IDs `mcq`/`pjs` del banco de unidades funcionales. Los errores alimentan el mismo banco de Repaso.
- `blueprint`: número de ítems por unidad. El validador comprueba que coincida con `items`.
- `mode`: `practice` (se puede pausar) o `exam` (sin pausa; al agotarse el tiempo se entrega solo).
- `likert`: opcional y solo en modo examen. No puntúa; al final se muestra la reflexión.
- `index.json`: `{ "tests": [{ id, title, difficulty, minutes, mode, items, likert }] }` para la lista.
- Recursos externos con `"simulacro": true` en `resources.json` aparecen también en la página Simulacros.
