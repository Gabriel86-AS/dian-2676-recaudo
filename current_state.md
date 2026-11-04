# Current State (2026-11-04)

**Sitio completo para la OPEC 236842 (Gestor III, recaudo y cartera), sin publicar todavía.** Repo git nuevo (rama `main`), sin remoto: falta crear el repositorio en GitHub, hacer `git push` y activar Pages.

- **13 unidades**, una por indicador oficial (ver `plan/00_OVERVIEW.md`): 8 nuevas (`recaudo`, `recepcion-declaraciones`, `entidades-recaudadoras`, `extincion-obligaciones`, `titulos-ejecutivos`, `devoluciones`, `principios-contables`, `analitica-datos`) y 5 conservadas (`estructura` con la nueva lección `estr-05`, `misionalidad`, `razonamiento`, `comportamentales` con los niveles de esta OPEC, `integridad`).
- Simulacros regenerados (`node tools/build-tests.mjs`); `test-ficha-1` es ahora «Simulacro núcleo recaudo y cartera» (75 % prioridad 1).
- Pruebas: `node tools/validate.mjs` sin errores; `progress.test.js` 14/14; `simulacro.test.js` 9/9; E2E `qa-site` (30 OK), `simulacro-basico` y `simulacro-examen` OK.
- `localStorage` y caché del service worker usan el prefijo `dian2676rc` (no chocan con los otros sitios DIAN en `gabriel86-as.github.io`). `sw.js` en `dian2676rc-v2`.
- Las preguntas de relacionar aceptan derechas con el mismo texto (`js/engine/items/match.js`).
- Fuentes nuevas en `dian_2676_recursos/dian_material/`: `20_` (ET 808–881), `21_` (D1165 pago, declaración, devolución aduanera), `22_` (Ley 1314), `23_` (CONPES 3920, UTF-8), `24_` (Ley 962 art. 43), `25_` (ET arts. 1–40).
- `ASPIRANT INFO/` está en `.gitignore` (tiene el número de inscripción).

**Siguiente (opcional):** publicar; más PJS de dificultad 3 en las unidades nuevas; cobro persuasivo y procesos de insolvencia (Ley 1116) si hay tiempo. Al cambiar contenido: `node tools/validate.mjs`; si cambia el banco, `node tools/build-tests.mjs`; si cambian `index.html`, `css` o `js`, subir `VERSION` en `sw.js`.
