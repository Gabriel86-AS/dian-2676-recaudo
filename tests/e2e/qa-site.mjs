// QA del sitio completo en Edge headless (CDP).
// Uso: python -m http.server 8765 (en la raíz) y luego:
//   node tests/e2e/qa-site.mjs http://localhost:8765 <carpeta-perfil-temporal> <carpeta-capturas>
// Recorre: páginas principales en 375/768/1280 px (sin desbordes horizontales), una lección completa
// por unidad en modo claro y oscuro, un mazo de tarjetas, Mis errores, el aviso «post-corte» y el uso sin conexión.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [,, SITE, PROFILE, SHOTS] = process.argv;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9334;
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, seq = 0; const pending = new Map(); const logs = [];

async function connect() {
  for (let i = 0; i < 50; i++) {
    try { const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = list.find((x) => x.type === 'page'); if (p) return p.webSocketDebuggerUrl; } catch {}
    await sleep(200);
  }
  throw new Error('Edge no respondió');
}
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq; pending.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
const until = async (expr, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return true; await sleep(100); } throw new Error(`timeout: ${expr}`); };
const shot = async (name) => { const { data } = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name), Buffer.from(data, 'base64')); };
let fails = 0;
const check = (cond, msg) => { console.log(cond ? 'OK  ' : 'FALLA', msg); if (!cond) { fails++; process.exitCode = 1; } };
const size = (width, height = 844) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
const scheme = (dark) => send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: dark ? 'dark' : 'light' }] });
const go = async (hash) => { await ev(`location.hash = ${JSON.stringify(hash)}; true`); await sleep(350); };
const overflow = () => ev(`document.documentElement.scrollWidth - window.innerWidth`);

// Recorre una lección o mazo respondiendo de forma genérica hasta la pantalla final.
async function playThrough(maxSteps = 120) {
  for (let i = 0; i < maxSteps; i++) {
    const state = await ev(`(() => {
      if (document.querySelector('.end')) return 'end';
      const grade = [...document.querySelectorAll('.self-grade [data-g], .self-grade [data-act="knew"]')].find((b) => !b.disabled && b.offsetParent);
      if (grade) { grade.click(); return 'graded'; }
      const flip = document.querySelector('[data-act="flip"]');
      if (flip && !flip.hidden) { flip.click(); return 'flip'; }
      const main = document.querySelector('.player-foot .main');
      if (main && !main.hidden && !main.disabled) { main.click(); return 'main'; }
      const opt = [...document.querySelectorAll('.step .opt')].find((b) => !b.disabled);
      if (opt) { opt.click(); return 'opt'; }
      const gaps = [...document.querySelectorAll('.step input.gap')];
      if (gaps.length) { gaps.forEach((g) => { g.value = 'x'; g.dispatchEvent(new Event('input', { bubbles: true })); }); return 'gap'; }
      const ta = document.querySelector('.step textarea');
      if (ta && !ta.value) { ta.value = 'respuesta de prueba'; ta.dispatchEvent(new Event('input', { bubbles: true })); return 'open'; }
      const lefts = [...document.querySelectorAll('.match-item[data-l]:not(.is-paired)')];
      if (lefts.length) {
        lefts[0].click();
        const r = [...document.querySelectorAll('.match-item[data-r]:not(.is-paired)')][0];
        r?.click();
        return 'match';
      }
      return 'stuck';
    })()`);
    if (state === 'end') return true;
    if (state === 'stuck') return false;
    await sleep(60);
  }
  return false;
}

try {
  ws = new WebSocket(await connect());
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); }
    if (d.method === 'Runtime.exceptionThrown') logs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text);
    if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
  });
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await size(375);
  await send('Page.navigate', { url: `${SITE}/#/` });
  await until(`!!document.querySelector('.unit-card')`);
  await ev(`localStorage.clear(); true`);
  const units = await ev(`fetch('content/manifest.json').then(r => r.json()).then(m => m.units.filter(u => !u.pending).map(u => u.id))`);
  check(!units.includes('_ejemplo'), 'la unidad demo ya no está en el manifiesto');
  check(await ev(`!!document.querySelector('.how-to[open]')`), 'Inicio: tarjeta «Cómo usar» abierta la primera vez');

  // 1. Páginas principales en 3 anchos, claro y oscuro
  const pages = ['#/', '#/repaso', '#/simulacros', '#/progreso', '#/recursos', '#/ajustes', '#/simulacro/test-examen-1', '#/simulacro/aleatorio', ...units.map((u) => `#/unidad/${u}`)];
  for (const dark of [false, true]) {
    await scheme(dark);
    for (const w of [375, 768, 1280]) {
      await size(w);
      const bad = [];
      for (const p of pages) { await go(p); await sleep(150); const o = await overflow(); if (o > 1) bad.push(`${p} (+${o}px)`); }
      check(!bad.length, `${dark ? 'oscuro' : 'claro'} ${w}px: sin desbordes en ${pages.length} páginas${bad.length ? ' → ' + bad.join(', ') : ''}`);
    }
  }
  await scheme(false); await size(375);
  await go('#/recursos');
  check(await ev(`document.querySelectorAll('.res-list').length`) >= 3, 'Recursos agrupados por secciones');
  await shot('qa-recursos.png');

  // 2. Una lección completa por unidad (claro en las impares, oscuro en las pares)
  const lessonOf = await ev(`Promise.all(${JSON.stringify(units)}.map(id => fetch('content/manifest.json').then(r => r.json()).then(m => fetch('content/' + m.units.find(u => u.id === id).file)).then(r => r.json()).then(u => [id, u.lessons[0].id])))`);
  for (const [i, [u, l]] of lessonOf.entries()) {
    await scheme(i % 2 === 1);
    await go(`#/leccion/${u}/${l}`);
    await until(`!!document.querySelector('.player .step .item, .end')`);
    let maxOver = 0;
    const ok = await playThrough();
    maxOver = Math.max(maxOver, await overflow());
    check(ok, `lección ${u}/${l} (${i % 2 ? 'oscuro' : 'claro'}) llega al final`);
    if (i === 0) await shot('qa-leccion-fin.png');
  }
  await scheme(false);

  // 3. (El sitio anterior probaba aquí el aviso «Norma posterior al corte»; esta versión no tiene ítems post-corte.)

  // 4. Mazo de tarjetas y Mis errores
  await go('#/tarjetas/recaudo');
  await until(`!!document.querySelector('[data-act="flip"]')`);
  check(await playThrough(200), 'mazo de tarjetas de recaudo completo');
  await go('#/repaso');
  await sleep(500);
  const hasMistakes = await ev(`!!document.querySelector('a[href="#/repaso/errores"]')`);
  if (hasMistakes) {
    await go('#/repaso/errores');
    await until(`!!document.querySelector('.player .step .item, .end')`);
    check(await playThrough(), 'sesión «Mis errores» completa');
  } else check(true, 'sin errores pendientes (nada que repasar)');

  // 5. Ajuste «ocultar autoinforme»: oculta solo la práctica Likert
  await go('#/unidad/comportamentales');
  await until(`!!document.querySelector('.lesson-list')`);
  const before = await ev(`document.querySelectorAll('.lesson-list li').length`);
  await ev(`(() => { const s = JSON.parse(localStorage.getItem('dian2676rc:v1')); s.settings.hideLikert = true; localStorage.setItem('dian2676rc:v1', JSON.stringify(s)); return true; })()`);
  await send('Page.reload'); await sleep(600);
  await until(`!!document.querySelector('.lesson-list')`);
  const after = await ev(`document.querySelectorAll('.lesson-list li').length`);
  const compUnit = JSON.parse(fs.readFileSync(new URL('../../content/units/comportamentales.json', import.meta.url), 'utf8'));
  const likertIds = new Set(compUnit.questions.filter((q) => q.type === 'likert').map((q) => q.id));
  const scored = compUnit.lessons.filter((l) => !l.steps.every((s) => likertIds.has(s.ref))).length;
  check(before === compUnit.lessons.length && after === scored, `ocultar autoinforme: comportamentales pasa de ${before} a ${after} lecciones (las ${scored} puntuadas siguen)`);
  await go('#/');
  await until(`!!document.querySelector('.unit-card')`);
  check(await ev(`[...document.querySelectorAll('.unit-card h3')].some(h => /Integridad/.test(h.textContent))`), 'con el ajuste activo, Integridad sigue en Inicio');

  // 6. Sin conexión: con el service worker activo, recargar y abrir otra lección
  await ev(`navigator.serviceWorker.ready.then(() => true)`);
  await sleep(1500);
  await send('Page.reload'); await sleep(800);
  check(await ev(`!!navigator.serviceWorker.controller`), 'service worker controla la página');
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send('Page.reload'); await sleep(1200);
  await until(`!!document.querySelector('.unit-card')`, 10000);
  await go('#/leccion/devoluciones/dev-02');
  await until(`!!document.querySelector('.player .step .item')`, 10000);
  check(true, 'sin conexión: recarga e inicia una lección de otra unidad');
  await go('#/simulacro/test-medio-2');
  await until(`!!document.querySelector('[data-act="start"]')`, 10000);
  check(true, 'sin conexión: abre un simulacro');
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });

  check(logs.length === 0, `sin errores de consola${logs.length ? ': ' + [...new Set(logs)].slice(0, 5).join(' | ') : ''}`);
} catch (e) {
  console.log('FALLA', e.message); process.exitCode = 1;
} finally {
  ws?.close();
  try {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const b = new WebSocket(webSocketDebuggerUrl);
    await new Promise((r) => b.addEventListener('open', r));
    b.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    await sleep(800);
  } catch { /* ya cerrado */ }
  edge.kill();
}
