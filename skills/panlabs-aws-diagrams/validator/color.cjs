'use strict';
/**
 * Cor: contraste WCAG, distância perceptual e simulação de deficiência de cor.
 * Sem dependência, por premissa 7 do mapa.
 *
 * A família A7 é a única do validador que é NORMATIVA: os números vêm da WCAG
 * 2.2, não de um percentil de gosto. Isso muda o padrão de prova. Uma métrica
 * estética errada por 5% produz um aviso um pouco fora de lugar; um contraste
 * errado por 5% aprova um texto que a norma reprova, e o diagrama vai para o
 * slide com a etiqueta de acessível que ele não tem. Por isso as três contas
 * daqui são conferidas contra valor publicado em `tests/check-primitives.cjs`.
 *
 * Duas armadilhas conhecidas, e por que este módulo as evita:
 *
 *   LUMINÂNCIA NÃO É MÉDIA DE CANAL. `(R+G+B)/3` é a conta errada que passa
 *   despercebida porque devolve um número plausível. A WCAG lineariza o sRGB
 *   antes de ponderar (G18), e o degrau na linearização — 0,03928 — é onde as
 *   implementações caseiras divergem no cinza escuro.
 *
 *   ΔE00 NÃO É DISTÂNCIA EUCLIDIANA EM Lab. A CIEDE2000 tem um termo de
 *   rotação na região azul e uma média de matiz que atravessa 0°/360°. Quem
 *   implementa direto da fórmula erra o caso do azul e o do croma quase nulo —
 *   que são exatamente os dois casos que aparecem numa paleta AWS, cheia de
 *   azul-marinho e de cinza. O conjunto de teste de Sharma, Wu & Dalal (2005)
 *   existe por isso, e é contra ele que a implementação é conferida.
 */

// ------------------------------------------------------------------ hexadecimal

const clampa = v => Math.max(0, Math.min(255, Math.round(v)));
const doisDigitos = v => clampa(v).toString(16).padStart(2, '0');

/** `#abc`, `#aabbcc`, com ou sem cerquilha, para `[r, g, b]` em 0–255. */
function paraRgb(hex) {
  let s = String(hex || '').trim().replace(/^#/, '');
  if (s.length === 3) s = s.split('').map(ch => ch + ch).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(s)) return null;
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

const paraHex = ([r, g, b]) => `#${doisDigitos(r)}${doisDigitos(g)}${doisDigitos(b)}`;

/** A cor é utilizável? `none`, `transparent` e lixo devolvem `null` em `paraRgb`. */
const ehCor = hex => paraRgb(hex) !== null;

// ------------------------------------------------------------- contraste WCAG

/** sRGB 0–255 para o canal linearizado. O degrau é o da WCAG G18. */
function linearizar(canal) {
  const v = canal / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

/** Luminância relativa, WCAG G18: L = 0,2126R + 0,7152G + 0,0722B. */
function luminancia(hex) {
  const rgb = paraRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(linearizar);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Razão de contraste (L1+0,05)/(L2+0,05). Simétrica, em [1, 21]. */
function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Compõe `cima` sobre `baixo` com opacidade `alfa`.
 *
 * É o que resolve o "fundo efetivo" da decisão 4 do #18: um rótulo dentro de
 * uma AZ dentro de uma VPC dentro da nuvem não tem por fundo a cor da página —
 * tem a pilha inteira composta, e cada grupo AWS desenha com preenchimento
 * translúcido. Compor na ordem de z é a diferença entre medir o contraste que
 * o leitor vê e medir um contraste que não existe em lugar nenhum.
 */
function compor(cima, baixo, alfa) {
  const c = paraRgb(cima);
  const b = paraRgb(baixo);
  if (!c) return paraHex(b || [255, 255, 255]);
  if (!b) return paraHex(c);
  const a = Math.max(0, Math.min(1, alfa === undefined ? 1 : alfa));
  return paraHex([0, 1, 2].map(i => c[i] * a + b[i] * (1 - a)));
}

// ------------------------------------------------------------------ CIE L*a*b*

// sRGB D65 → XYZ (IEC 61966-2-1).
const M_XYZ = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.0721750],
  [0.0193339, 0.1191920, 0.9503041],
];
const BRANCO_D65 = [0.95047, 1.0, 1.08883];

const DELTA = 6 / 29;
const f = t => (t > DELTA ** 3 ? Math.cbrt(t) : t / (3 * DELTA * DELTA) + 4 / 29);

/** `#rrggbb` para `[L*, a*, b*]`. */
function paraLab(hex) {
  const rgb = paraRgb(hex);
  if (!rgb) return null;
  const lin = rgb.map(linearizar);
  const xyz = M_XYZ.map(linha => linha[0] * lin[0] + linha[1] * lin[1] + linha[2] * lin[2]);
  const [fx, fy, fz] = xyz.map((v, i) => f(v / BRANCO_D65[i]));
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

const grau = rad => rad * 180 / Math.PI;
const rad = g => g * Math.PI / 180;

/**
 * ΔE00 — CIEDE2000, na formulação de Sharma, Wu & Dalal (2005).
 *
 * Os dois pontos onde a implementação ingênua erra estão marcados abaixo: a
 * média de matiz quando os matizes estão em lados opostos de 0°, e o caso de
 * croma nulo, em que o matiz é indefinido e somar os dois é o convencionado.
 */
function deltaE00(lab1, lab2, pesos = {}) {
  const kL = pesos.kL === undefined ? 1 : pesos.kL;
  const kC = pesos.kC === undefined ? 1 : pesos.kC;
  const kH = pesos.kH === undefined ? 1 : pesos.kH;

  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cmedio = (C1 + C2) / 2;
  const C7 = Cmedio ** 7;
  const G = 0.5 * (1 - Math.sqrt(C7 / (C7 + 25 ** 7)));

  const a1l = (1 + G) * a1;
  const a2l = (1 + G) * a2;
  const C1l = Math.hypot(a1l, b1);
  const C2l = Math.hypot(a2l, b2);

  const matiz = (b, a) => {
    if (Math.abs(a) < 1e-12 && Math.abs(b) < 1e-12) return 0;
    const h = grau(Math.atan2(b, a));
    return h < 0 ? h + 360 : h;
  };
  const h1l = matiz(b1, a1l);
  const h2l = matiz(b2, a2l);

  const dLl = L2 - L1;
  const dCl = C2l - C1l;

  let dhl;
  if (C1l * C2l === 0) dhl = 0;                       // croma nulo: matiz indefinido
  else if (Math.abs(h2l - h1l) <= 180) dhl = h2l - h1l;
  else if (h2l - h1l > 180) dhl = h2l - h1l - 360;    // atravessa 0° por baixo
  else dhl = h2l - h1l + 360;                         // atravessa 0° por cima
  const dHl = 2 * Math.sqrt(C1l * C2l) * Math.sin(rad(dhl) / 2);

  const Lmedio = (L1 + L2) / 2;
  const Cmediol = (C1l + C2l) / 2;

  let hMedio;
  if (C1l * C2l === 0) hMedio = h1l + h2l;            // idem: um dos dois é 0 por convenção
  else if (Math.abs(h1l - h2l) <= 180) hMedio = (h1l + h2l) / 2;
  else if (h1l + h2l < 360) hMedio = (h1l + h2l + 360) / 2;
  else hMedio = (h1l + h2l - 360) / 2;

  const T = 1
    - 0.17 * Math.cos(rad(hMedio - 30))
    + 0.24 * Math.cos(rad(2 * hMedio))
    + 0.32 * Math.cos(rad(3 * hMedio + 6))
    - 0.20 * Math.cos(rad(4 * hMedio - 63));

  const dTheta = 30 * Math.exp(-(((hMedio - 275) / 25) ** 2));
  const Cml7 = Cmediol ** 7;
  const Rc = 2 * Math.sqrt(Cml7 / (Cml7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lmedio - 50) ** 2) / Math.sqrt(20 + (Lmedio - 50) ** 2);
  const Sc = 1 + 0.045 * Cmediol;
  const Sh = 1 + 0.015 * Cmediol * T;
  const Rt = -Math.sin(rad(2 * dTheta)) * Rc;        // o termo de rotação da região azul

  const tl = dLl / (kL * Sl);
  const tc = dCl / (kC * Sc);
  const th = dHl / (kH * Sh);
  return Math.sqrt(tl * tl + tc * tc + th * th + Rt * tc * th);
}

/** ΔE00 direto entre duas cores hexadecimais. */
function distancia(a, b) {
  const la = paraLab(a);
  const lb = paraLab(b);
  return la && lb ? deltaE00(la, lb) : null;
}

// -------------------------------------------------- deficiência de visão de cor

// Viénot, Brettel & Mollon (1999): RGB linear → LMS e a volta. As projeções
// dicromatas abaixo têm o cinza como ponto fixo — é a propriedade que
// `check-primitives.cjs` confere, porque uma matriz transposta por engano
// continua devolvendo cor plausível e deixa de colapsar vermelho com verde.
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

const PROJECAO = {
  protanopia: ([, M, S]) => [2.02344 * M - 2.52581 * S, M, S],
  deuteranopia: ([L, , S]) => [L, 0.494207 * L + 1.24827 * S, S],
  tritanopia: ([L, M]) => [L, M, -0.395913 * L + 0.801109 * M],
};

const aplica = (m, v) => m.map(linha => linha[0] * v[0] + linha[1] * v[1] + linha[2] * v[2]);
const deslinearizar = v => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055);

/** A cor como um dicromata a vê. `tipo` ∈ protanopia | deuteranopia | tritanopia. */
function simular(hex, kind) {
  const projetar = PROJECAO[kind];
  if (!projetar) throw new Error(`tipo de deficiência desconhecido: "${kind}"`);
  const rgb = paraRgb(hex);
  if (!rgb) return null;
  const lms = aplica(M_LMS, rgb.map(linearizar));
  return paraHex(aplica(M_LMS_INV, projetar(lms)).map(deslinearizar));
}

const TIPOS_DE_DEFICIENCIA = Object.keys(PROJECAO);

module.exports = {
  paraRgb, paraHex, ehCor,
  linearizar, luminancia, contraste, compor,
  paraLab, deltaE00, distancia,
  simular, TIPOS_DE_DEFICIENCIA,
};
