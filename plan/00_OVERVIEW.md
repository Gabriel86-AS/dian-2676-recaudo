# DIAN 2676 Study Site (recaudo y cartera) — Master Plan

Read this first in every session, then `current_state.md` and `plan/PROGRESS_LOG.md`.

## Goal
A static, mobile-first study site (Spanish, Colombia) for one applicant to the **DIAN 2676 written exam**: **Gestor III, código 303 grado 03, nivel Profesional, OPEC 236842**, ficha **CT-CR-3006** (proceso misional *Cumplimiento de obligaciones tributarias*; subprocesos *Administración de cartera* y *Recaudo-Devoluciones*). Exam: **Sunday 8 Nov 2026, 8:00 a.m.–1:00 p.m.**

This repo started as a copy of the Gestor I/III study site (`dian-2676-estudio`). The engine (lessons, flashcards, spaced review, mistakes, mock tests, export/import) was kept; content was rebuilt around this applicant's official indicator list.

Applicant documents are in `ASPIRANT INFO/` (gitignored: it holds the inscription number). Do not commit them or put the person's name or inscription number in the site.

## Hard constraints
- Static site, no build step: HTML + CSS + vanilla JS ES modules; content in JSON. GitHub Pages from `main` root.
- Progress in `localStorage` under the prefix **`dian2676rc`** (other DIAN sites live on the same `github.io` origin; never reuse their keys or delete their caches).
- Every item cites a legal or official source. Never invent articles, deadlines or figures: grep `dian_2676_recursos/` (`node tools/art.mjs <file> <art>`).
- No gamified punishments.

## Exam facts (Guía de Orientación al Aspirante, 19-10-2026)
- Functional test: eliminatory, minimum 70.00; PJS format (case + statement + 3 options A–C).
- Behavioral and integrity tests: 4-point Likert self-report, no right answers, two control subscales.
- Normative cutoff: norms in force and issued **up to 19 Jun 2026**.

## Indicators of OPEC 236842 (official list) → units
| Indicator | Unit id | Prefix | Priority |
|---|---|---|---|
| Proceso de recaudo | `recaudo` | `rec` | 1 |
| Generalidades de recepción de declaraciones tributarias y aduaneras | `recepcion-declaraciones` | `decl` | 1 |
| Régimen sancionatorio de entidades autorizadas a recaudar | `entidades-recaudadoras` | `erec` | 1 |
| Extinción de las obligaciones tributarias, aduaneras y cambiarias | `extincion-obligaciones` | `ext` | 1 |
| Títulos ejecutivos de cobro de competencia de la DIAN | `titulos-ejecutivos` | `tit` | 1 |
| Devoluciones de impuestos y de tributos aduaneros | `devoluciones` | `dev` | 1 |
| Principios financieros y contables aplicables a la gestión tributaria | `principios-contables` | `cont` | 2 |
| Analítica de datos | `analitica-datos` | `dat` | 2 |
| Estructura organizacional de la DIAN | `estructura` | `estr` | 2 |
| Misionalidad de la DIAN | `misionalidad` | `mis` | 2 |
| Razonamiento analítico | `razonamiento` | `raz` | 2 |
| Adaptabilidad 1 y 3 · Comportamiento ético 1 y 4 · Comunicación efectiva 1 y 3 · Orientación al logro 1 · Orientación al usuario 1 · Trabajo en equipo 1 y 3 | `comportamentales` | `comp` | 2 |
| Compromiso, Diligencia, Honestidad, Justicia, Respeto | `integridad` | `integ` | 2 |

Priority 1 = the ficha's core functions (cartera, recaudo, devoluciones). Priority 2 = the rest of the indicator list.

## Sources for the new units (`dian_2676_recursos/dian_material/`)
- `01_` ET Libro V up to art. 807: declarations (574–580-1), entidades recaudadoras sanctions (674–676), intereses (634–635), pago (800–807), contabilidad (772–777).
- `20_` ET arts. 808–881 (Senado, pr033–pr035, 04-11-2026): facilidades, compensación, prescripción, remisión, cobro coactivo, títulos ejecutivos, procesos concursales, devoluciones.
- `21_` D1165/2019 arts. 13–19 (obligación aduanera, pago, extinción), 176–188 (presentación, aceptación y firmeza de la declaración), 727–733 (devolución aduanera).
- `08_` DL 2245/2011 arts. 37–41 (prescripción y cobro cambiario).
- `22_` Ley 1314/2009 (principios y normas de contabilidad).
- `23_` CONPES 3920/2018 (política de explotación de datos).
- `04_` D1742/2020 (estructura; Subdirecciones de Recaudo 15, Devoluciones 19, Cobranzas 20; seccionales 65).

## Session protocol
1. Build one unit at a time; `node tools/validate.mjs <unit>`; remove `"pending": true` from its manifest entry.
2. When the bank changes: `node tools/build-tests.mjs`, then `node tools/validate.mjs`.
3. If `index.html`, `css` or `js` change, bump `VERSION` in `sw.js`.
4. Commit; update `current_state.md` and `plan/PROGRESS_LOG.md`.
