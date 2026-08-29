// Minimal Chrome DevTools Protocol client. Zero npm dependencies: Node >= 22
// ships a global WebSocket and a global fetch, and Chromium ships with the
// browser -- the render gate's only dependency is "a Chromium binary on
// disk", never a node_modules tree. #157, lifted and hardened from the
// prototype at gate-prototype/cdp.cjs (#93).
//
// Navigation is caller-driven and reload-based: the skeleton's own `?still`
// (freeze animations/transitions -- #99) and `?only=N` (isolate one beat,
// with its figure/lit state already resolved -- #105's fix for the headless
// compositor not rasterising a scrolled page outside the initial viewport)
// query params are baked into the URL by the caller. There is no key-press
// navigation here: walking a document of unknown scrollable length with
// ArrowRight is exactly the mechanism #105 found broken.
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Version directories rot the moment either tool updates; globbing the
// version-numbered directory instead of pinning one exact string is what
// keeps this working after `npx puppeteer browsers install` bumps a patch.
const CACHES = [
  [path.join(os.homedir(), '.cache', 'ms-playwright'), /^chromium-\d+$/],
  [path.join(os.homedir(), '.cache', 'puppeteer', 'chrome'), /^linux-[\d.]+$/],
];

function findChrome() {
  const candidates = [];
  for (const [base, re] of CACHES) {
    if (!fs.existsSync(base)) continue;
    for (const name of fs.readdirSync(base)) {
      if (re.test(name)) candidates.push(path.join(base, name, 'chrome-linux64', 'chrome'));
    }
  }
  if (process.env.CHROME_BIN) candidates.push(process.env.CHROME_BIN);
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      try { fs.accessSync(c, fs.constants.X_OK); return c; } catch (_) { /* not executable */ }
    }
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch({ width = 1600, height = 900 } = {}) {
  const bin = findChrome();
  if (!bin) throw Object.assign(new Error('no-chrome'), { code: 'NO_CHROME' });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'panlabs-render-gate-'));
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
      const line = fs.readFileSync(portFile, 'utf8').split('\n')[0];
      if (line && line.trim()) port = Number(line.trim());
    }
  }
  if (!port) { proc.kill('SIGKILL'); throw new Error('chrome did not open a debugging port'); }

  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let nextId = 0;
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
    const id = ++nextId; pending.set(id, { res, rej });
    ws.send(JSON.stringify({ id, method, params }));
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
    async gotoWatched(fileUrl, onRequest) {
      await send('Network.enable');
      persistent.push((m) => {
        if (m.method === 'Network.requestWillBeSent') onRequest(m.params.request.url);
      });
      return api.goto(fileUrl);
    },
    async goto(fileUrl) {
      const loaded = once('Page.loadEventFired');
      await send('Page.navigate', { url: fileUrl });
      await Promise.race([loaded, sleep(15000)]);
      // Measuring before the embedded font decodes measures the fallback
      // face on a page nobody will ever see rendered that way (#99).
      await send('Runtime.evaluate', { expression: 'document.fonts.ready', awaitPromise: true });
      await sleep(250);
    },
    async evaluate(fnSource) {
      const r = await send('Runtime.evaluate',
        { expression: `(${fnSource})()`, returnByValue: true, awaitPromise: true });
      if (r.exceptionDetails) {
        const desc = r.exceptionDetails.exception && r.exceptionDetails.exception.description;
        throw new Error(`${r.exceptionDetails.text} ${desc || ''}`.trim());
      }
      return r.result.value;
    },
    async shot(clip) {
      const params = { format: 'png' };
      if (clip) params.clip = { ...clip, scale: 1 };
      const r = await send('Page.captureScreenshot', params);
      return r.data;
    },
    // The one thing page JS cannot answer: which platform face actually
    // painted, and how many glyphs of it. getComputedStyle only ever
    // reports what CSS asked for.
    async platformFontsAll(selector) {
      const doc = await send('DOM.getDocument', { depth: 1 });
      const r = await send('DOM.querySelectorAll', { nodeId: doc.root.nodeId, selector });
      const out = [];
      for (const nodeId of r.nodeIds) {
        try {
          const f = await send('CSS.getPlatformFontsForNode', { nodeId });
          out.push(f.fonts);
        } catch (_) { out.push(null); }
      }
      return out;
    },
    async close() {
      try { ws.close(); } catch (_) { /* already closed */ }
      proc.kill('SIGKILL');
      await sleep(80);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* best effort */ }
    },
  };
  return api;
}

module.exports = { launch, findChrome };
