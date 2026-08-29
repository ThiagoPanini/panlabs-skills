'use strict';
/**
 * Color: WCAG contrast, perceptual distance and color-deficiency simulation.
 * No dependency, per premise 7 of the map.
 *
 * Family A7 is the validator's only NORMATIVE family: the numbers come from
 * WCAG 2.2, not from a taste percentile. That changes the standard of proof. An
 * aesthetic metric that's off by 5% produces a slightly-out-of-place warning; a
 * contrast that's off by 5% passes a text the norm fails, and the diagram goes
 * to the slide wearing an "accessible" label it hasn't earned. That's why the
 * three computations here are checked against a published value in
 * `workbench/panlabs-aws-diagrams/tests/check-primitives.cjs`.
 *
 * Two known traps, and why this module avoids them:
 *
 *   LUMINANCE IS NOT A CHANNEL AVERAGE. `(R+G+B)/3` is the wrong sum that goes
 *   unnoticed because it returns a plausible number. WCAG linearizes sRGB
 *   before weighting it (G18), and the step in the linearization — 0.03928 —
 *   is where homegrown implementations diverge in dark gray.
 *
 *   ΔE00 IS NOT EUCLIDEAN DISTANCE IN Lab. CIEDE2000 has a rotation term in the
 *   blue region and a hue mean that crosses 0°/360°. Anyone implementing it
 *   straight from the formula gets the blue case and the near-zero-chroma case
 *   wrong — which happen to be exactly the two cases that show up in an AWS
 *   palette, full of navy blue and gray. Sharma, Wu & Dalal's (2005) test set
 *   exists for this, and the implementation is checked against it.
 */

// ---------------------------------------------------------------------- hex

const clampa = v => Math.max(0, Math.min(255, Math.round(v)));
const twoDigits = v => clampa(v).toString(16).padStart(2, '0');

/** `#abc`, `#aabbcc`, with or without the hash, to `[r, g, b]` in 0-255. */
function paraRgb(hex) {
  let s = String(hex || '').trim().replace(/^#/, '');
  if (s.length === 3) s = s.split('').map(ch => ch + ch).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

const paraHex = ([r, g, b]) => `#${twoDigits(r)}${twoDigits(g)}${twoDigits(b)}`;

/** Is the color usable? `none`, `transparent` and garbage return `null` from `paraRgb`. */
const ehCor = hex => paraRgb(hex) !== null;

// --------------------------------------------------------------- WCAG contrast

/** sRGB 0-255 to the linearized channel. The step is WCAG G18's. */
function linearize(channel) {
  const v = channel / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Relative luminance, WCAG G18: L = 0.2126R + 0.7152G + 0.0722B. */
function luminance(hex) {
  const rgb = paraRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio (L1+0.05)/(L2+0.05). Symmetric, in [1, 21]. */
function contraste(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Composites `top` over `bottom` with opacity `alpha`.
 *
 * This is what resolves the "effective background" from decision 4 of #18: a
 * label inside an AZ inside a VPC inside the cloud does not have the page
 * color as its background — it has the whole stack composited, and every AWS
 * group draws with translucent fill. Compositing in z-order is the difference
 * between measuring the contrast the reader sees and measuring a contrast that
 * exists nowhere.
 */
function compor(top, bottom, alpha) {
  const c = paraRgb(top);
  const b = paraRgb(bottom);
  if (!c) return paraHex(b || [255, 255, 255]);
  if (!b) return paraHex(c);
  const a = Math.max(0, Math.min(1, alpha === undefined ? 1 : alpha));
  return paraHex([0, 1, 2].map(i => c[i] * a + b[i] * (1 - a)));
}

// ------------------------------------------------------------------- CIE L*a*b*

// sRGB D65 → XYZ (IEC 61966-2-1).
const M_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
];
const WHITE_D65 = [0.95047, 1.0, 1.08883];

const DELTA = 6 / 29;
const f = t => (t > DELTA ** 3 ? Math.cbrt(t) : t / (3 * DELTA * DELTA) + 4 / 29);

/** `#rrggbb` to `[L*, a*, b*]`. */
function paraLab(hex) {
  const rgb = paraRgb(hex);
  if (!rgb) return null;
  const lin = rgb.map(linearize);
  const xyz = M_XYZ.map(row => row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]);
  const [fx, fy, fz] = xyz.map((v, i) => f(v / WHITE_D65[i]));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const deg = rad => rad * 180 / Math.PI;
const rad = g => g * Math.PI / 180;

/**
 * ΔE00 — CIEDE2000, following Sharma, Wu & Dalal's (2005) formulation.
 *
 * The two spots where a naive implementation gets it wrong are marked below:
 * the hue mean when the two hues sit on opposite sides of 0°, and the
 * zero-chroma case, where hue is undefined and adding the two is the convention.
 */
function deltaE00(lab1, lab2, weights = {}) {
  const kL = weights.kL === undefined ? 1 : weights.kL;
  const kC = weights.kC === undefined ? 1 : weights.kC;
  const kH = weights.kH === undefined ? 1 : weights.kH;

  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const C7 = Cbar ** 7;
  const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + 25 ** 7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const hueOf = (b, a) => {
    if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) return 0;
    const h = deg(Math.atan2(b, a));
    return h < 0 ? h + 360 : h;
  };
  const h1p = hueOf(b1, a1p);
  const h2p = hueOf(b2, a2p);

  const dLp = L2 - L1;
  const dCp = C2p - C1p;

  let dhp;
  if (C1p * C2p === 0) dhp = 0;                       // zero chroma: hue undefined
  else if (Math.abs(h2p - h1p) <= 180) dhp = h2p - h1p;
  else if (h2p - h1p > 180) dhp = h2p - h1p - 360;    // crosses 0° from below
  else dhp = h2p - h1p + 360;                         // crosses 0° from above
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp) / 2);

  const Lbar = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;

  let hBarp;
  if (C1p * C2p === 0) hBarp = h1p + h2p;            // same: one of the two is 0 by convention
  else if (Math.abs(h1p - h2p) <= 180) hBarp = (h1p + h2p) / 2;
  else if (h1p + h2p < 360) hBarp = (h1p + h2p + 360) / 2;
  else hBarp = (h1p + h2p - 360) / 2;

  const T = 1
    - 0.17 * Math.cos(rad(hBarp - 30))
    + 0.24 * Math.cos(rad(2 * hBarp))
    + 0.32 * Math.cos(rad(3 * hBarp + 6))
    - 0.20 * Math.cos(rad(4 * hBarp - 63));

  const dTheta = 30 * Math.exp(-(((hBarp - 275) / 25) ** 2));
  const Cbarp7 = Cbarp ** 7;
  const Rc = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;        // the blue-region rotation term

  const tl = dLp / (kL * Sl);
  const tc = dCp / (kC * Sc);
  const th = dHp / (kH * Sh);
  return Math.sqrt(tl * tl + tc * tc + th * th + Rt * tc * th);
}

/** Direct ΔE00 between two hex colors. */
function distance(a, b) {
  const la = paraLab(a);
  const lb = paraLab(b);
  return la && lb ? deltaE00(la, lb) : null;
}

// ------------------------------------------------------------- color-vision deficiency

// Viénot, Brettel & Mollon (1999): linear RGB → LMS and back. The dichromat
// projections below have gray as a fixed point — the property
// `check-primitives.cjs` checks, because a matrix transposed by mistake still
// returns a plausible color and fails to collapse red into green.
const M_LMS = [
  [17.8824, 43.5161, 4.11935],
  [3.45565, 27.1554, 3.86714],
  [0.0299566, 0.184309, 1.46709],
];
const M_LMS_INV = [
  [0.0809444479, -0.130504409, 0.116721066],
  [-0.0102485335, 0.0540193266, -0.113614708],
  [-0.000365296938, -0.00412161469, 0.693511405],
];

const PROJECTION = {
  protanopia: ([, M, S]) => [2.02344 * M - 2.52581 * S, M, S],
  deuteranopia: ([L, , S]) => [L, 0.494207 * L + 1.24827 * S, S],
  tritanopia: ([L, M]) => [L, M, -0.395913 * L + 0.801109 * M],
};

const aplica = (m, v) => m.map(row => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
const delinearize = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055);

/** The color as a dichromat sees it. `kind` ∈ protanopia | deuteranopia | tritanopia. */
function simulate(hex, kind) {
  const project = PROJECTION[kind];
  if (!project) throw new Error(`unknown deficiency kind: "${kind}"`);
  const rgb = paraRgb(hex);
  if (!rgb) return null;
  const lms = aplica(M_LMS, rgb.map(linearize));
  return paraHex(aplica(M_LMS_INV, project(lms)).map(delinearize));
}

const DEFICIENCY_KINDS = Object.keys(PROJECTION);

module.exports = {
  paraRgb, paraHex, ehCor,
  linearize, luminance, contraste, compor,
  paraLab, deltaE00, distance,
  simulate, DEFICIENCY_KINDS,
};
