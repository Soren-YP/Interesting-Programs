// 用 DevTools 协议驱动无头 Edge 截图
// node shoot.mjs <url> <out.png> <width> <height> [hoverSelector] [dark] [clickSelector]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [url, out, width = '1440', height = '900', hover = '', scheme = '', click = ''] = process.argv.slice(2);
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const profile = mkdtempSync(join(tmpdir(), 'edge-shot-'));
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`, '--no-first-run', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i += 1) {
  await sleep(200);
  try {
    const list = await fetch(`http://127.0.0.1:${port}/json`).then((r) => r.json());
    target = list.find((t) => t.type === 'page');
  } catch {}
}
if (!target) { edge.kill(); throw new Error('Edge did not start'); }

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((resolve) => {
  const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params }));
});

await send('Emulation.setDeviceMetricsOverride', {
  width: +width, height: +height, deviceScaleFactor: 1, mobile: +width < 768,
});
if (scheme) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
await send('Page.enable');
await send('Page.navigate', { url });
await sleep(4000);

if (hover) {
  const res = await send('Runtime.evaluate', {
    expression: `(() => { const r = document.querySelector(${JSON.stringify(hover)}).getBoundingClientRect(); return JSON.stringify({ x: r.left + r.width * 0.4, y: r.top + r.height / 2 }); })()`,
    returnByValue: true,
  });
  const { x, y } = JSON.parse(res.result.result.value);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await sleep(600);
}

if (click) {
  await send('Runtime.evaluate', { expression: `document.querySelector(${JSON.stringify(click)}).click()` });
  await sleep(600);
}

const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('saved', out);
ws.close();
edge.kill();
process.exit(0);
