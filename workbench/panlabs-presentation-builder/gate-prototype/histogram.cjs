// Colour histogram of a rendered slide, measured against the declared palette.
// Decodes the PNG inside the page itself (a data: URI does not taint a canvas),
// so no image library is needed anywhere.
const HIST_FN = (b64) => `async () => {
  const img = new Image();
  img.src = "data:image/png;base64,${b64}";
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data;
  const m = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const k = (d[i] << 16) | (d[i+1] << 8) | d[i+2];
    m.set(k, (m.get(k) || 0) + 1);
  }
  return { total: d.length / 4, w: c.width, h: c.height,
           hist: [...m.entries()].sort((a,b) => b[1]-a[1]) };
}`;

const hex = (n) => '#' + n.toString(16).padStart(6, '0').toUpperCase();
const rgb = (h) => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
const dist = (a, b) => Math.hypot(a[0]-b[0], a[1]-b[1], a[2]-b[2]);

// distance from a colour to the straight segment between two palette colours:
// antialiasing fringes and CSS gradients both live on those segments.
function segDist(p, a, b) {
  const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
  const L2 = ab[0]**2 + ab[1]**2 + ab[2]**2;
  if (L2 === 0) return dist(p, a);
  let t = ((p[0]-a[0])*ab[0] + (p[1]-a[1])*ab[1] + (p[2]-a[2])*ab[2]) / L2;
  t = Math.max(0, Math.min(1, t));
  return dist(p, [a[0]+t*ab[0], a[1]+t*ab[1], a[2]+t*ab[2]]);
}

function classify(histogram, total, palette, tol = 12) {
  const P = palette.map(rgb);
  let onToken = 0, onRamp = 0, off = 0;
  const offenders = new Map();
  for (const [key, count] of histogram) {
    const p = [(key >> 16) & 255, (key >> 8) & 255, key & 255];
    let best = Infinity;
    for (const q of P) best = Math.min(best, dist(p, q));
    if (best <= tol) { onToken += count; continue; }
    let bestSeg = Infinity;
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++)
        bestSeg = Math.min(bestSeg, segDist(p, P[i], P[j]));
    if (bestSeg <= tol) { onRamp += count; continue; }
    off += count;
    offenders.set(key, (offenders.get(key) || 0) + count);
  }
  const top = [...offenders.entries()].sort((a,b) => b[1]-a[1]).slice(0, 6)
    .map(([k, c]) => ({ hex: hex(k), pct: +(100*c/total).toFixed(3) }));
  return {
    onTokenPct: +(100*onToken/total).toFixed(3),
    onRampPct:  +(100*onRamp/total).toFixed(3),
    offPct:     +(100*off/total).toFixed(3),
    dominant:   hex(histogram[0][0]),
    dominantPct: +(100*histogram[0][1]/total).toFixed(2),
    distinct: histogram.length,
    worstOffender: top[0] || null,
    offenders: top,
  };
}

module.exports = { HIST_FN, classify, hex, rgb, dist, segDist };
