// Uso: python -m http.server 8765 (en la raíz) y luego: node tests/e2e/<archivo> http://localhost:8765 <carpeta-perfil-temporal> <carpeta-capturas>
// E2E del simulacro con Edge headless por CDP: responde test-basico-1 (21 bien, 3 mal, 6 vacías),
// recarga a mitad para probar la reanudación, entrega y verifica puntaje y desglose.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [,, SITE, PROFILE, SHOTS] = process.argv;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9333;
const edge = spawn(EDGE, ['--headless=new', '--disable-gpu', `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${port}`, '--window-size=390,844', 'about:blank'], { stdio: 'ignore' });
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
const until = async (expr, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await ev(expr)) return; await sleep(100); } throw new Error(`timeout: ${expr}`); };
const shot = async (name) => { const { data } = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(SHOTS, name), Buffer.from(data, 'base64')); };
const check = (cond, msg) => { console.log(cond ? 'OK  ' : 'FALLA', msg); if (!cond) process.exitCode = 1; };

try {
  ws = new WebSocket(await connect());
  await new Promise((r) => ws.addEventListener('open', r));
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { const p = pending.get(d.id); pending.delete(d.id); d.error ? p.rej(new Error(d.error.message)) : p.res(d.result); } if (d.method === 'Runtime.exceptionThrown') logs.push(d.params.exceptionDetails.exception?.description); if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') logs.push(d.params.args.map((a) => a.value ?? a.description).join(' ')); });
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: `${SITE}/#/simulacros` });
  await until(`!!document.querySelector('.test-card')`);
  await ev(`localStorage.clear(); true`);
  await shot('e2e-1-lista.png');
  const nTests = JSON.parse(fs.readFileSync(new URL('../../content/tests/index.json', import.meta.url), 'utf8')).tests.length;
  check(await ev(`document.querySelectorAll('.test-card').length`) === nTests + 1, `lista: ${nTests} simulacros + aleatorio`);
  check(await ev(`document.querySelectorAll('.ext-list li').length`) >= 5, 'lista: enlaces externos de simulacros');

  // Respuestas esperadas
  const t = JSON.parse(fs.readFileSync('content/tests/test-basico-1.json', 'utf8'));
  const bank = new Map();
  for (const u of JSON.parse(fs.readFileSync('content/manifest.json', 'utf8')).units) if (!u.pending) for (const q of JSON.parse(fs.readFileSync(`content/${u.file}`, 'utf8')).questions) bank.set(q.id, q);
  const plan = t.items.map((id, i) => { const q = bank.get(id); return i < 21 ? q.answer : i < 24 ? q.options.find((o) => o.id !== q.answer).id : null; });

  await ev(`location.hash = '#/simulacro/test-basico-1'; true`);
  await until(`!!document.querySelector('[data-act="start"]')`);
  await ev(`document.querySelector('[data-act="start"]').click(); true`);
  await until(`!!document.querySelector('.rn-q')`);
  await shot('e2e-2-pregunta.png');
  check(await ev(`!document.querySelector('.feedback') && !document.querySelector('.is-correct')`), 'sin retroalimentación al responder');

  const answerCurrent = async (i) => {
    const want = plan[i];
    if (want) await ev(`(() => { const b = document.querySelector('.rn-q .opt[data-id="${want}"]'); b.click(); return true; })()`);
  };
  for (let i = 0; i < 15; i++) { await answerCurrent(i); if (i < 14) await ev(`document.querySelector('[data-act="next"]').click(); true`); }
  // Marcar la 15 para revisar
  await ev(`document.querySelector('.rn-flag').click(); true`);
  await sleep(1200);
  // Recarga a mitad
  await send('Page.reload');
  await sleep(500);
  await until(`!!document.querySelector('.rn-q')`);
  const resumed = await ev(`[document.querySelector('.rn-num').textContent, document.querySelector('.rn-count').textContent, document.querySelector('.rn-flag').getAttribute('aria-pressed')]`);
  check(resumed[0] === 'Pregunta 15' && resumed[1].startsWith('15 de 30') && resumed[2] === 'true', `reanuda tras recargar: ${resumed.join(' · ')}`);
  // Resto en vista de hoja completa
  await ev(`document.querySelector('[data-act="layout"]').click(); true`);
  await until(`document.querySelectorAll('.rn-q').length === 30`);
  for (let i = 15; i < 30; i++) if (plan[i]) await ev(`document.querySelector('#q-${i + 1} .opt[data-id="${plan[i]}"]').click(); true`);
  await ev(`document.querySelector('[data-act="nav"]').click(); true`);
  check(await ev(`document.querySelectorAll('.rn-cell.is-done').length`) === 24, 'navegador: 24 respondidas');
  check(await ev(`document.querySelectorAll('.rn-cell.is-flag').length`) === 1, 'navegador: 1 marcada');
  await shot('e2e-3-hoja.png');
  await ev(`window.confirm = () => true; document.querySelector('[data-act="submit"]').click(); true`);
  await until(`!!document.querySelector('.score-n')`);
  const res = await ev(`({ score: document.querySelector('.score-n').textContent, label: document.querySelector('.score-l').textContent,
    rows: [...document.querySelectorAll('.results table.tbl tbody tr')].map(r => r.children[1].textContent),
    missed: document.querySelectorAll('.results .missed').length,
    saved: JSON.parse(localStorage.getItem('dian2676rc:v1')).tests.at(-1), session: localStorage.getItem('dian2676rc:simulacro'),
    mistakes: Object.values(JSON.parse(localStorage.getItem('dian2676rc:v1')).items).filter(x => x.inMistakes).length })`);
  check(res.score === '70,00', `puntaje 70,00 (obtenido ${res.score})`);
  check(/Aprobado/.test(res.label), 'etiqueta Aprobado');
  const sum = res.rows.reduce((a, s) => { const [c, n] = s.split('/').map(Number); return [a[0] + c, a[1] + n]; }, [0, 0]);
  check(sum[0] === 21 && sum[1] === 30, `desglose por unidad suma 21/30 (${sum.join('/')})`);
  check(res.missed === 9, `9 preguntas para repasar (3 mal + 6 vacías): ${res.missed}`);
  check(res.saved?.id === 'test-basico-1' && res.saved.score === 70, 'guardado en progress.tests');
  check(res.session === null, 'sesión en curso eliminada');
  check(res.mistakes === 9, `9 ítems en Mis errores: ${res.mistakes}`);
  await shot('e2e-4-resultado.png');
  await ev(`location.hash = '#/progreso'; true`);
  await until(`!!document.querySelector('.tbl')`);
  check(await ev(`[...document.querySelectorAll('.tbl td')].some(td => td.textContent === '70,00')`), 'Progreso muestra 70,00 en el historial');
  check(logs.length === 0, `sin errores de consola${logs.length ? ': ' + logs.join(' | ') : ''}`);
} catch (e) {
  console.log('FALLA', e.message); process.exitCode = 1;
} finally {
  ws?.close();
  // Cierra el navegador completo (el proceso lanzado delega en hijos que no cuelgan de su PID).
  try {
    const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const b = new WebSocket(webSocketDebuggerUrl);
    await new Promise((r) => b.addEventListener('open', r));
    b.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    await sleep(800);
  } catch { /* ya cerrado */ }
  edge.kill();
}
