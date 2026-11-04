# Progress log

**Regla permanente:** al terminar cada ejecución, `current_state.md` y este log deben quedar al día, de modo que se pueda retomar solo con estos archivos.

## 2026-11-04 — Repo nuevo para la OPEC 236842 (Gestor III, recaudo y cartera)
- Copia del sitio `dian-2676-estudio` (commit 3375041) con historial git nuevo.
- Se conservan el motor completo y las unidades `estructura`, `misionalidad`, `razonamiento`, `comportamentales` e `integridad`.
- Se borraron 13 unidades fuera de los indicadores de esta OPEC (mercancías, CPACA, contratación, gestión documental, Constitución/transparencia, MIPG, fiscalización, sanciones, obligaciones, liquidación, lavado, cambiaria, auditoría) y los planes de fase del sitio anterior.
- `comportamentales`: fuera Innovación y Solución de problemas; Adaptabilidad y Comunicación efectiva pasan a niveles 1 y 3; Autoinforme D con los niveles específicos de esta OPEC.
- Claves de `localStorage` y caché del service worker con prefijo `dian2676rc` para no chocar con los otros sitios del mismo dominio `github.io`.
- Fuentes nuevas: `20_` ET arts. 808–881, `21_` D1165 (pago, declaración, devolución aduanera), `22_` Ley 1314/2009, `23_` CONPES 3920.
- Ocho unidades nuevas en el manifiesto (ver `plan/00_OVERVIEW.md`).

## 2026-11-04 — Unidades nuevas y QA
- Ocho unidades nuevas, una por indicador: `recaudo` (26 preguntas), `recepcion-declaraciones` (26), `entidades-recaudadoras` (24), `extincion-obligaciones` (25), `titulos-ejecutivos` (27), `devoluciones` (25), `principios-contables` (23), `analitica-datos` (25). Todas con 4 lecciones, tarjetas, ~30 % PJS y claves repartidas; ninguna con la correcta como opción más larga por encima del umbral.
- `estructura`: lección `estr-05` (Dirección de Gestión de Impuestos: Recaudo, Devoluciones, Cobranzas; Grandes Contribuyentes).
- Motor: las preguntas de relacionar dan por buena cualquier derecha con el mismo texto (antes, «10 UVT» repetido marcaba error).
- E2E: se quitó la prueba del aviso post-corte (no hay ítems post-corte) y se apuntó a `recaudo` y `devoluciones`.
- Publicado: repo público `Gabriel86-AS/dian-2676-recaudo`, Pages desde `main`; https://gabriel86-as.github.io/dian-2676-recaudo/ responde con las 13 unidades.
