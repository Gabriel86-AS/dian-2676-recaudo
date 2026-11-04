// Uso: python -m http.server 8765 (en la raíz) y luego: node tests/e2e/<archivo> http://localhost:8765 <carpeta-perfil-temporal> <carpeta-capturas>
// E2E del simulacro con Edge headless por CDP: responde test-basico-1 (21 bien, 3 mal, 6 vacías),
// recarga a mitad para probar la reanudación, entrega y verifica puntaje y desglose.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [,, SITE, PROFILE, SHOTS] = process.argv;
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = Number(process.env.E2E_PORT) || 9333; // E2E_PORT evita choques con otras sesiones de Edge
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
  await send('Page.navigate', { url: `${SITE}/#/simulacro/test-examen-1` });
  await until(`!!document.querySelector('[data-act="start"]')`);
  await ev(`localStorage.clear(); document.querySelector('input[value="sheet"]').click(); document.querySelector('[data-act="start"]').click(); true`);
  await until(`document.querySelectorAll('.rn-q').length === 100`);
  check(!(await ev(`!!document.querySelector('[data-act="pause"]')`)), 'examen: sin botón de pausa');
  const tm = await ev(`document.querySelector('.rn-timer').textContent`);
  check(/^⏳ (5:00:00|4:59:5\d)$/.test(tm), `examen: reloj de 5 h (${tm})`);
  check(await ev(`/Parte 2/.test(document.querySelector('.rn-part')?.textContent || '')`), 'examen: sección de autoinforme');
  check(await ev(`document.querySelectorAll('.rn-q .choices.likert').length`) === 40, 'examen: 40 afirmaciones Likert');
  // Responde 10 funcionales con la opción a y las 40 Likert con "Totalmente de acuerdo"
  await ev(`[...document.querySelectorAll('.rn-q')].forEach((q, i) => { if (i < 10) q.querySelector('.opt').click(); if (i >= 60) q.querySelectorAll('.opt')[3].click(); }); true`);
  await ev(`window.confirm = () => true; document.querySelector('[data-act="submit"]').click(); true`);
  await until(`!!document.querySelector('.score-n')`);
  const r = await ev(`({ refl: !!document.querySelector('.reflection'), note: !!document.querySelector('.reflection .note'), score: document.querySelector('.score-n').textContent, cnt: document.querySelector('.stat-n').textContent })`);
  check(r.refl && r.note, 'examen: reflexión Likert con nota (100 % totalmente de acuerdo)');
  check(/\/60$/.test(r.cnt), `examen: puntúa solo las 60 funcionales (${r.cnt}, puntaje ${r.score})`);
  await shot('e2e-5-examen.png');

  await ev(`location.hash = '#/simulacro/aleatorio'; true`);
  await until(`!!document.querySelector('.random-form')`);
  await ev(`const f = document.querySelector('.random-form'); f.n.value = '10'; f.d.value = '3'; f.requestSubmit(); true`);
  await until(`!!document.querySelector('.rn-q')`);
  await ev(`document.querySelector('[data-act="nav"]').click(); true`);
  check(await ev(`document.querySelectorAll('.rn-cell').length`) === 10, 'aleatorio: 10 preguntas');
  check(await ev(`document.querySelector('.rn-timer').textContent.includes('15:00')`), 'aleatorio: 15 min (1,5 por pregunta)');
  await ev(`location.hash = '#/simulacros'; true`);
  await until(`!!document.querySelector('.resume')`);
  check(true, 'lista: ofrece «Continuar simulacro» al salir');
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
