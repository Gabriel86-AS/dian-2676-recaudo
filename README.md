# DIAN 2676 · Estudio (recaudo y cartera)

Sitio de estudio para la prueba escrita **DIAN 2676 – Gestor III, código 303 grado 03 (nivel Profesional, OPEC 236842, ficha CT-CR-3006: recaudo, administración de cartera y devoluciones)**, domingo **8 de noviembre de 2026**, 8:00 a. m.–1:00 p. m.

**En vivo:** https://gabriel86-as.github.io/dian-2676-recaudo/ · Repo: https://github.com/Gabriel86-AS/dian-2676-recaudo

HTML, CSS y JavaScript sin frameworks ni paso de compilación; contenido en JSON; pensado primero para el celular.

## Qué incluye
- **19 unidades**: una por indicador de la OPEC (recaudo, recepción de declaraciones, régimen sancionatorio de entidades recaudadoras, extinción de obligaciones, títulos ejecutivos y cobro, devoluciones, principios contables, analítica de datos, estructura, misionalidad, razonamiento, competencias comportamentales e integridad), más cobro persuasivo e insolvencia y, como prioridad 3, los temas básicos de la ficha (CPACA, Constitución y PQRSF, MIPG, gestión documental, sistema tributario y contrabando). Lecciones cortas, tarjetas y banco de preguntas (selección múltiple, juicio situacional, V/F, relacionar, ordenar, completar y abiertas). Cada ítem cita su fuente legal.
- **Repaso espaciado** (Leitner, 5 cajas) y **Mis errores**.
- **Simulacros**: 8 fijos (básico, intermedio, avanzado, uno centrado en el núcleo de recaudo y cartera, y la simulación del examen de 5 h con autoinforme Likert) y uno aleatorio. Puntaje 0–100 truncado a dos decimales, meta 70,00.
- **Autoinforme comportamental e integridad** (Likert, sin puntaje) con pantalla de reflexión.
- Funciona **sin conexión** después de la primera visita (service worker, red primero).

## Progreso
Se guarda solo en `localStorage` del navegador (clave `dian2676rc:v1`, distinta de los otros sitios DIAN del mismo dominio). En **Ajustes** se puede **exportar** a un archivo JSON e **importarlo** en otro dispositivo; al importar se combinan ambos registros.

## Añadir o cambiar contenido
1. Lee `content/SCHEMA.md` (formato de unidades, ítems y simulacros).
2. Edita la unidad en `content/units/<id>.json` y regístrala en `content/manifest.json`.
3. Valida: `node tools/validate.mjs`.
4. Si cambió el banco, regenera los simulacros: `node tools/build-tests.mjs`.
5. Si cambian archivos del shell (`index.html`, `css`, `js`), sube la versión en `sw.js` (`VERSION`).

Herramientas de revisión (requieren el paquete de fuentes `dian_2676_recursos/`, que no está en el repo): `node tools/art.mjs <archivo> <art…>` imprime un artículo (por ejemplo, `node tools/art.mjs 20 817`).

## Pruebas
- `node tests/progress.test.js` · `node tests/simulacro.test.js`
- Navegador (Edge headless, Windows): sirve la raíz con `python -m http.server 8765` y ejecuta `node tests/e2e/qa-site.mjs http://localhost:8765 <perfil-temporal> <capturas>` (y `simulacro-basico.mjs` y `simulacro-examen.mjs`).

## Publicación
GitHub Pages desde la rama `main` (raíz). Basta `git push`.

## Aviso
Material de estudio no oficial. Normas vigentes y expedidas hasta el 19-jun-2026, según la Guía de Orientación al Aspirante.
