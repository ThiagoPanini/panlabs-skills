// Minimal Chrome DevTools Protocol client. Zero npm dependencies:
// Node >= 22 ships a global WebSocket, and Chromium ships with the browser.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CANDIDATES = [
  '/home/paninit/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome',
  '/home/paninit/.cache/puppeteer/chrome/linux-148.0.7778.97/chrome-linux64/chrome',
  process.env.CHROME_BIN,
];

function findChrome() {
  for (const c of CANDIDATES) {
    if (c && fs.existsSync(c)) { try { fs.accessSync(c, fs.constants.X_OK); return c; } catch (_) {} }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch({ width = 1600, height = 900 } = {}) {
  const bin = findChrome();
  if (!bin) throw Object.assign(new Error('no-chrome'), { code: 'NO_CHROME' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-'));
  const proc = spawn(bin, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`,
    '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--disable-lcd-text',
    '--font-render-hinting=none',
    `--window-size=${width},${height}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  let port = null;
  const portFile = path.join(dir, 'DevToolsActivePort');
  for (let i = 0; i < 200 && port === null; i++) {
    await sleep(50);
    if (fs.existsSync(portFile)) {
      const t = fs.readFileSync(portFile, 'utf8').split('\n');
      if (t[0] && t[0].trim()) port = Number(t[0].trim());
    }
  }
  if (!port) { proc.kill('SIGKILL'); throw new Error('chrome did not open a debugging port'); }

  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const persistent = [];
  const pending = new Map();
  const events = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    } else if (m.method) {
      persistent.forEach((f) => f(m));
      if (events.has(m.method)) {
        events.get(m.method).forEach((f) => f(m.params));
        events.set(m.method, []);
      }
    }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const i = ++id; pending.set(i, { res, rej });
    ws.send(JSON.stringify({ id: i, method, params }));
  });
  const once = (method) => new Promise((res) => {
    if (!events.has(method)) events.set(method, []);
    events.get(method).push(res);
  });

  await send('Page.enable');
  await send('DOM.enable');
  await send('CSS.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: 1, mobile: false });

  const api = {
    send, once, bin,
    onAny(fn) { persistent.push(fn); },
    async gotoWatched(fileUrl, onReq) {
      persistent.push((m) => {
        if (m.method === 'Network.requestWillBeSent') onReq(m.params.request.url);
      });
      return api.goto(fileUrl);
    },
    async goto(fileUrl) {
      const loaded = once('Page.loadEventFired');
      await send('Page.navigate', { url: fileUrl });
      await Promise.race([loaded, sleep(15000)]);
      await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
      await sleep(250);
    },
    async evaluate(fnSource) {
      const r = await send('Runtime.evaluate',
        { expression: `(${fnSource})()`, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' +
        JSON.stringify(r.exceptionDetails.exception && r.exceptionDetails.exception.description));
      return r.result.value;
    },
    async key(k) {
      const base = { key: k, code: k, windowsVirtualKeyCode: { ArrowRight: 39, ArrowLeft: 37 }[k] || 0 };
      await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
      await sleep(120);
    },
    async shot() {
      const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      return r.data;
    },
    // The one thing page JS cannot answer: which platform face actually rendered.
    async platformFonts(selector) {
      const doc = await send('DOM.getDocument', { depth: 1 });
      const n = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
      if (!n.nodeId) return null;
      const r = await send('CSS.getPlatformFontsForNode', { nodeId: n.nodeId });
      return r.fonts;
    },
    async close() { try { ws.close(); } catch (_) {} proc.kill('SIGKILL'); await sleep(80);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} },
  };
  return api;
}

module.exports = { launch, findChrome };

// appended: node-level helpers for the identity probe
module.exports.withNodes = async function (api) {
  api.platformFontsAll = async function (selector) {
    const doc = await api.send('DOM.getDocument', { depth: 1 });
    const r = await api.send('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector });
    const out = [];
    for (const nodeId of r.nodeIds) {
      try {
        const f = await api.send('CSS.getPlatformFontsForNode', { nodeId });
        out.push(f.fonts);
      } catch (_) { out.push(null); }
    }
    return out;
  };
  return api;
};
