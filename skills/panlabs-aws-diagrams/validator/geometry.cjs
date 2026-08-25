'use strict';
/**
 * Primitivas geométricas do validador. Sem dependência, por premissa 7 do mapa.
 *
 * Três decisões de fronteira valem por todo o módulo, porque são a diferença
 * entre um validador que acusa o que importa e um que grita o tempo todo:
 *
 *   ENCOSTAR NÃO É SOBREPOR. Dois grupos irmãos que compartilham a borda têm
 *   interseção de área zero. O layout coloca caixas adjacentes de propósito, e
 *   um validador que chamasse adjacência de sobreposição reprovaria todo
 *   diagrama bem apertado. A área é a medida; o contato não tem área.
 *
 *   TANGENCIAR NÃO É ATRAVESSAR. Toda aresta bem ancorada (A3.6) encosta no
 *   perímetro do próprio nó. Se tocar a borda contasse como travessia, A3.5
 *   acusaria exatamente o comportamento que A3.6 exige. Por isso a travessia
 *   pede interior, não borda.
 *
 *   INCIDIR NÃO É CRUZAR. Duas arestas que saem do mesmo nó compartilham um
 *   ponto. Isso é o grafo, não um defeito do desenho — e é por isso que o
 *   c_max de A5.1 desconta C(deg(v),2). Cruzamento aqui exige interseção no
 *   interior dos dois segmentos.
 *
 * Todo ângulo entra e sai em GRAUS. A rubrica é escrita em graus, os limiares
 * são em graus, e converter no meio do caminho é como se erra o sinal.
 */

const EPS = 1e-9;

// ------------------------------------------------------------------ retângulo

const direita = r => r.x + r.w;
const baixo = r => r.y + r.h;
const centro = r => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Área da interseção. Zero quando as caixas só se encostam. */
function areaDaIntersecao(a, b) {
  const larg = Math.min(direita(a), direita(b)) - Math.max(a.x, b.x);
  const alt = Math.min(baixo(a), baixo(b)) - Math.max(a.y, b.y);
  return larg > 0 && alt > 0 ? larg * alt : 0;
}

/** `filho` cabe inteiro em `pai`, com folga opcional em todos os lados. */
function contem(pai, filho, padding = 0) {
  return filho.x >= pai.x + padding - EPS
    && filho.y >= pai.y + padding - EPS
    && direita(filho) <= direita(pai) - padding + EPS
    && baixo(filho) <= baixo(pai) - padding + EPS;
}

/**
 * Distância entre duas caixas. Positiva quando separadas, zero quando encostam,
 * NEGATIVA quando se sobrepõem — e o valor negativo é a profundidade da
 * sobreposição no eixo em que ela é menor, que é o quanto A3.1 teria de afastar.
 */
function folga(a, b) {
  const dx = Math.max(a.x - direita(b), b.x - direita(a));
  const dy = Math.max(a.y - baixo(b), b.y - baixo(a));
  if (dx > 0 && dy > 0) return Math.hypot(dx, dy);
  if (dx > 0) return dx;
  if (dy > 0) return dy;
  return Math.max(dx, dy);
}

/** Os quatro paddings internos entre o retângulo e a caixa dos filhos. */
function paddings(pai, filhos) {
  if (!filhos.length) return null;
  const cx1 = Math.min(...filhos.map(f => f.x));
  const cy1 = Math.min(...filhos.map(f => f.y));
  const cx2 = Math.max(...filhos.map(direita));
  const cy2 = Math.max(...filhos.map(baixo));
  return { esquerda: cx1 - pai.x, topo: cy1 - pai.y, direita: direita(pai) - cx2, baixo: baixo(pai) - cy2 };
}

/** A caixa que envolve todas as caixas. */
function envolvente(caixas) {
  if (!caixas.length) return null;
  const x = Math.min(...caixas.map(c => c.x));
  const y = Math.min(...caixas.map(c => c.y));
  return { x, y, w: Math.max(...caixas.map(direita)) - x, h: Math.max(...caixas.map(baixo)) - y };
}

// -------------------------------------------------------- segmento e retângulo

/**
 * O segmento passa pelo INTERIOR do retângulo.
 *
 * Recorta o segmento contra a caixa (Liang–Barsky) e confere que o pedaço que
 * sobrou tem comprimento e cai dentro, não em cima da borda. É o que separa
 * "a aresta corta a VPC" de "a aresta sai do nó que encosta na VPC".
 */
function segmentoCruzaRetangulo(p, q, r) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  let t0 = 0;
  let t1 = 1;
  const bordas = [
    [-dx, p.x - r.x],
    [dx, direita(r) - p.x],
    [-dy, p.y - r.y],
    [dy, baixo(r) - p.y],
  ];
  for (const [pk, qk] of bordas) {
    if (Math.abs(pk) < EPS) { if (qk < 0) return false; continue; }
    const t = qk / pk;
    if (pk < 0) { if (t > t1) return false; if (t > t0) t0 = t; }
    else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  if (t1 - t0 <= EPS) return false;
  const m = (t0 + t1) / 2;
  const mx = p.x + m * dx;
  const my = p.y + m * dy;
  return mx > r.x + EPS && mx < direita(r) - EPS && my > r.y + EPS && my < baixo(r) - EPS;
}

/** Qualquer segmento da polilinha passa pelo interior do retângulo. */
function polilinhaCruzaRetangulo(pontos, r) {
  for (let i = 0; i + 1 < pontos.length; i++)
    if (segmentoCruzaRetangulo(pontos[i], pontos[i + 1], r)) return true;
  return false;
}

// ---------------------------------------------------------- segmento e segmento

/**
 * Ponto de cruzamento no interior dos dois segmentos, ou `null`.
 * Extremo compartilhado devolve `null` — incidência não é cruzamento.
 */
function cruzamento(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const den = d1x * d2y - d1y * d2x;
  if (Math.abs(den) < EPS) return null;            // paralelos ou colineares
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
  if (t <= EPS || t >= 1 - EPS || u <= EPS || u >= 1 - EPS) return null;
  return { x: p1.x + t * d1x, y: p1.y + t * d1y };
}

/** Ângulo agudo entre duas retas, em graus, em [0, 90]. */
function anguloEntre(p1, p2, p3, p4) {
  const a = Math.atan2(p2.y - p1.y, p2.x - p1.x);
  const b = Math.atan2(p4.y - p3.y, p4.x - p3.x);
  let d = Math.abs((a - b) * 180 / Math.PI) % 180;
  if (d > 90) d = 180 - d;
  return d;
}

/** Ângulo interno no vértice `b`, em graus, em [0, 180]. 180 é reta. */
function anguloInterno(a, b, c) {
  const ux = a.x - b.x, uy = a.y - b.y;
  const vx = c.x - b.x, vy = c.y - b.y;
  const nu = Math.hypot(ux, uy);
  const nv = Math.hypot(vx, vy);
  if (nu < EPS || nv < EPS) return 180;            // ponto repetido: não é dobra
  const cos = Math.max(-1, Math.min(1, (ux * vx + uy * vy) / (nu * nv)));
  return Math.acos(cos) * 180 / Math.PI;
}

// ------------------------------------------------------------------- polilinha

function distanciaPontoSegmento(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const den = dx * dx + dy * dy;
  if (den < EPS) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / den));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function distanciaPontoPolilinha(p, linha) {
  let m = Infinity;
  for (let i = 0; i + 1 < linha.length; i++)
    m = Math.min(m, distanciaPontoSegmento(p, linha[i], linha[i + 1]));
  return linha.length === 1 ? Math.hypot(p.x - linha[0].x, p.y - linha[0].y) : m;
}

/**
 * Hausdorff entre duas polilinhas, amostrando os vértices de cada uma contra os
 * segmentos da outra. É a medida de A5.8: duas arestas com o mesmo par
 * origem→destino que correm juntas demais dão dois rótulos ilegíveis por cima
 * de um traço só.
 */
function hausdorff(a, b) {
  if (!a.length || !b.length) return Infinity;
  const ida = Math.max(...a.map(p => distanciaPontoPolilinha(p, b)));
  const volta = Math.max(...b.map(p => distanciaPontoPolilinha(p, a)));
  return Math.max(ida, volta);
}

function comprimento(pontos) {
  let t = 0;
  for (let i = 0; i + 1 < pontos.length; i++) t += Math.hypot(pontos[i + 1].x - pontos[i].x, pontos[i + 1].y - pontos[i].y);
  return t;
}

/** Está sobre o perímetro do retângulo, dentro da tolerância. */
function noPerimetro(p, r, tol) {
  const dentro = p.x >= r.x - tol && p.x <= direita(r) + tol && p.y >= r.y - tol && p.y <= baixo(r) + tol;
  if (!dentro) return false;
  const d = Math.min(
    Math.abs(p.x - r.x), Math.abs(p.x - direita(r)),
    Math.abs(p.y - r.y), Math.abs(p.y - baixo(r)));
  return d <= tol;
}

module.exports = {
  EPS, direita, baixo, centro,
  areaDaIntersecao, contem, folga, paddings, envolvente,
  segmentoCruzaRetangulo, polilinhaCruzaRetangulo,
  cruzamento, anguloEntre, anguloInterno,
  distanciaPontoSegmento, distanciaPontoPolilinha, hausdorff, comprimento, noPerimetro,
};
