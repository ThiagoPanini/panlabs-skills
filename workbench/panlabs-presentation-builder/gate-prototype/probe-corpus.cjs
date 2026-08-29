const { launch, withNodes } = require('./cdp.cjs');
const GEOM = `() => {
  const out = { bleeds: [], collisions: [], illegible: [], slide: null };
  const s = [...document.querySelectorAll('.slide')].find(e => getComputedStyle(e).display !== 'none');
  if (!s) return out;
  out.slide = s.id || '(first)';
  const R = s.getBoundingClientRect();
  const sel = e => e.tagName.toLowerCase() + (e.id ? '#'+e.id : '') +
    (e.className && typeof e.className === 'string' && e.className.trim()
      ? '.' + e.className.trim().split(/\\s+/)[0] : '');
  // stop the walk AT the stage: the stage's own overflow:hidden is not an excuse
  const clipped = e => { for (let p = e.parentElement; p && p !== s; p = p.parentElement) {
      const o = getComputedStyle(p); if (o.overflow !== 'visible' || o.overflowX !== 'visible' || o.overflowY !== 'visible') return true; }
    return false; };
  const vis = [];
  for (const e of s.querySelectorAll('*')) {
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect();
    if (r.width < 3 || r.height < 3) continue;
    // 1. INK painted outside the fixed 1600x900 screen. The box is not the ink:
    //    a container with trailing padding sticks past the edge drawing nothing.
    const inky = [...e.childNodes].some(n => n.nodeType===3 && n.textContent.trim().length>1)
      || cs.borderBottomWidth !== '0px' || cs.borderTopWidth !== '0px'
      || (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent')
      || e.tagName === 'IMG' || e.tagName === 'svg' || e.tagName === 'SVG';
    if (inky && !clipped(e) && (r.right > R.right+1 || r.left < R.left-1 || r.bottom > R.bottom+1 || r.top < R.top-1))
      out.bleeds.push(sel(e) + ' [' + Math.round(r.left-R.left) + ',' + Math.round(r.top-R.top) + ' ' +
        Math.round(r.width) + 'x' + Math.round(r.height) + '] vs screen ' + Math.round(R.width) + 'x' + Math.round(R.height));
    // collect only ABSOLUTE boxes carrying text: flow boxes overlap by design
    if (cs.position !== 'absolute') continue;
    // union of the boxes of this block's text-bearing descendants = its ink
    let u = null;
    for (const t of [e, ...e.querySelectorAll('*')]) {
      if (![...t.childNodes].some(n => n.nodeType===3 && n.textContent.trim().length>1)) continue;
      const tr = t.getBoundingClientRect();
      if (tr.width < 3 || tr.height < 3) continue;
      u = u ? { left: Math.min(u.left,tr.left), top: Math.min(u.top,tr.top),
                right: Math.max(u.right,tr.right), bottom: Math.max(u.bottom,tr.bottom) } : tr;
    }
    if (u) vis.push({ k: sel(e), r: u, n: e });
  }
  // 2. two absolutely-positioned text boxes overlapping: nothing reflows, nobody complains
  for (let i = 0; i < vis.length; i++) for (let j = i+1; j < vis.length; j++) {
    const a = vis[i].r, b = vis[j].r;
    // a block always overlaps its own descendants: only siblings can collide
    if (vis[i].n.contains(vis[j].n) || vis[j].n.contains(vis[i].n)) continue;
    const ox = Math.min(a.right,b.right) - Math.max(a.left,b.left);
    const oy = Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top);
    if (ox > 2 && oy > 2)
      out.collisions.push(vis[i].k + ' overlaps ' + vis[j].k + ' by ' + Math.round(ox) + 'x' + Math.round(oy) + 'px');
  }
  return out;
}`;
(async () => {
  const file = process.argv[2];
  const b = await withNodes(await launch({ width: 1600, height: 900 }));
  const off = [];
  await b.send('Network.enable');
  b.onAny(m => { if (m.method === 'Network.requestWillBeSent' &&
    !/^(file|data|blob|about|chrome):/.test(m.params.request.url)) off.push(m.params.request.url); });
  await b.goto('file://' + require('path').resolve(file));
  const ids = await b.evaluate(`()=>[...document.querySelectorAll('.slide')].map(e=>e.id)`);
  for (const id of ids) {
    await b.evaluate(`()=>{location.hash='${id}'; return 1}`);
    await new Promise(r => setTimeout(r, 180));
    const g = await b.evaluate(GEOM);
    const fonts = await b.platformFontsAll('.slide:target .display, .slide:target h1, .slide:target h2');
    const bad = fonts.filter(f => f && f.length && f[0].familyName !== 'Anton');
    const line = [];
    if (g.bleeds.length) line.push('BLEED: ' + g.bleeds.slice(0,2).join(' ; '));
    if (g.collisions.length) line.push('COLLISION: ' + g.collisions.slice(0,2).join(' ; '));
    if (bad.length) line.push('FONT: ' + bad.map(f=>f[0].familyName).join(','));
    console.log('  ' + (id||'(first)').padEnd(10) + (line.length ? line.join(' | ') : 'clean'));
  }
  console.log('  network: ' + (off.length ? [...new Set(off)].join(', ') : 'no request left the machine'));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
