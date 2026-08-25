#!/usr/bin/env node
'use strict';
/**
 * As primitivas, contra valores publicados.
 *
 * Geometria e cor são onde um validador erra sem avisar: a conta roda, devolve
 * um número, e o número está errado. Um retângulo que se acha disjunto do
 * vizinho não acusa A3.1, e a suíte fica verde por não ter achado nada.
 *
 * Por isso as asserções aqui não são "o resultado parece razoável" — são contra
 * NÚMERO DE FORA:
 *
 *   · contraste WCAG contra os pares canônicos da própria norma (21:1 no extremo,
 *     1:1 na identidade, e #767676 sobre branco, que é o par com que a W3C ilustra
 *     a fronteira de 4,5:1);
 *   · CIEDE2000 contra o conjunto de teste de Sharma, Wu & Dalal (2005) — os 34
 *     pares que existem justamente porque a fórmula tem descontinuidades no
 *     ângulo de matiz que quase toda implementação erra na primeira tentativa.
 *
 * Se estes passam, o resto do validador está medindo o que diz medir.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'validator', 'geometry.cjs'));
const c = require(path.join(__dirname, '..', 'validator', 'color.cjs'));

const falhas = [];
const casos = [];

function ok(name, condicao, detail) {
  casos.push(name);
  if (!condicao) falhas.push(`${name}${detail ? ` — ${detail}` : ''}`);
}
function perto(name, got, expected, tol) {
  const d = Math.abs(got - expected);
  ok(name, d <= tol, `esperava ${expected} (±${tol}), veio ${Number(got.toFixed(4))}`);
}

// ------------------------------------------------------------------ geometria

const r = (x, y, w, h) => ({ x, y, w, h });

perto('área de interseção de retângulos que se cruzam', g.intersectionArea(r(0, 0, 10, 10), r(5, 5, 10, 10)), 25, 1e-9);
perto('área de interseção de retângulos disjuntos', g.intersectionArea(r(0, 0, 10, 10), r(20, 20, 5, 5)), 0, 1e-9);
// Encostar não é sobrepor: dois grupos irmãos que compartilham a borda têm
// interseção de área zero, e A4.3 não pode acusar isso como sobreposição.
perto('área de interseção de retângulos que só se encostam', g.intersectionArea(r(0, 0, 10, 10), r(10, 0, 10, 10)), 0, 1e-9);

ok('contém: filho dentro do pai com folga', g.contem(r(0, 0, 100, 100), r(20, 20, 10, 10)));
ok('contém: filho estourando a borda', !g.contem(r(0, 0, 100, 100), r(95, 20, 10, 10)));
perto('folga entre retângulos separados no eixo x', g.gap(r(0, 0, 10, 10), r(18, 0, 10, 10)), 8, 1e-9);
ok('folga entre retângulos sobrepostos é negativa', g.gap(r(0, 0, 10, 10), r(5, 5, 10, 10)) < 0,
  `veio ${g.gap(r(0, 0, 10, 10), r(5, 5, 10, 10))}`);
perto('folga entre retângulos que se encostam é zero', g.gap(r(0, 0, 10, 10), r(10, 0, 10, 10)), 0, 1e-9);

// segmento × retângulo — o coração de A3.5 e A5.5
ok('segmento atravessando o retângulo', g.segmentCrossesRect({ x: -5, y: 5 }, { x: 15, y: 5 }, r(0, 0, 10, 10)));
ok('segmento passando ao largo', !g.segmentCrossesRect({ x: -5, y: 50 }, { x: 15, y: 50 }, r(0, 0, 10, 10)));
ok('segmento inteiramente dentro do retângulo', g.segmentCrossesRect({ x: 2, y: 2 }, { x: 8, y: 8 }, r(0, 0, 10, 10)));
// A aresta que ENCOSTA na borda do próprio dono não pode contar como travessia,
// senão toda aresta bem ancorada (A3.6) viraria uma violação de A3.5.
ok('segmento tangente à borda não é travessia', !g.segmentCrossesRect({ x: 10, y: -5 }, { x: 10, y: 15 }, r(0, 0, 10, 10)));

const x1 = g.crossing({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 });
ok('cruzamento em X é detectado', !!x1);
if (x1) {
  perto('ponto de cruzamento em X', x1.x, 5, 1e-9);
  perto('ângulo de cruzamento em X', g.anguloEntre({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }), 90, 1e-9);
}
ok('segmentos paralelos não cruzam', !g.crossing({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 5 }, { x: 10, y: 5 }));
// Duas arestas que saem do mesmo nó compartilham um ponto. Isso é incidência,
// não cruzamento — e contar como cruzamento estouraria A5.1 em todo diagrama
// com um nó de grau 2. É por isso que c_max desconta C(deg(v),2).
ok('encontro num extremo comum não é cruzamento', !g.crossing({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 10 }));

perto('ângulo raso entre segmentos', g.anguloEntre({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }, { x: 10, y: 1 }), 5.7106, 1e-3);
perto('ângulo interno de dobra em L é 90°', g.anguloInterno({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }), 90, 1e-9);
perto('ângulo interno de dobra que volta sobre si é 0°', g.anguloInterno({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 0 }), 0, 1e-9);
perto('ângulo interno de segmento reto é 180°', g.anguloInterno({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 0 }), 180, 1e-9);

perto('Hausdorff entre polilinhas coincidentes', g.hausdorff([{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 0 }, { x: 10, y: 0 }]), 0, 1e-9);
perto('Hausdorff entre polilinhas paralelas a 5px', g.hausdorff([{ x: 0, y: 0 }, { x: 10, y: 0 }], [{ x: 0, y: 5 }, { x: 10, y: 5 }]), 5, 1e-9);

// ----------------------------------------------------------------------- cor

perto('contraste preto sobre branco', c.contraste('#000000', '#FFFFFF'), 21, 1e-9);
perto('contraste de uma cor contra ela mesma', c.contraste('#4A7EBB', '#4A7EBB'), 1, 1e-9);
// O par com que a W3C ilustra a fronteira do SC 1.4.3: #767676 é o cinza mais
// claro que ainda passa 4,5:1 sobre branco.
perto('contraste #767676 sobre branco (fronteira do SC 1.4.3)', c.contraste('#767676', '#FFFFFF'), 4.54, 5e-3);
perto('contraste é simétrico', c.contraste('#FFFFFF', '#767676'), c.contraste('#767676', '#FFFFFF'), 1e-9);

ok('hex de 3 dígitos é aceito', Math.abs(c.contraste('#000', '#FFF') - 21) < 1e-9);

// Composição alpha — o que resolve o "fundo efetivo" da decisão 4 do #18.
ok('composição opaca devolve a cor de cima', c.compor('#FF0000', '#00FF00', 1) === '#ff0000');
ok('composição transparente devolve a cor de baixo', c.compor('#FF0000', '#00FF00', 0) === '#00ff00');
ok('composição a 50% fica no meio', c.compor('#000000', '#FFFFFF', 0.5) === '#808080');

// CIEDE2000 — conjunto de teste de Sharma, Wu & Dalal (2005), Tabela 1.
// Os pares escolhidos cobrem as descontinuidades: matiz cruzando 0°/360°,
// croma quase nulo, e o termo de rotação na região azul.
const SHARMA = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.0200], [50, 0, -82.7485], 3.4412],
  [[50, -1.3802, -84.2814], [50, 0, -82.7485], 1.0000],
  [[50, -1.1848, -84.8006], [50, 0, -82.7485], 1.0000],
  [[50, -0.9009, -85.5211], [50, 0, -82.7485], 1.0000],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, -1, 2], [50, 0, 0], 2.3669],
  // Estes quatro existem na tabela de Sharma por um motivo só: entre b=0,0010 e
  // b=0,0011 a média de matiz troca de ramo, e o ΔE00 SALTA de 7,1792 para
  // 7,2195. Não é ruído numérico — é a descontinuidade que a fórmula tem, e
  // reproduzi-la é a prova de que o caso `h1+h2 < 360` está do lado certo.
  // Uma implementação que devolva 7,1792 nos quatro está com o ramo errado.
  [[50, 2.49, -0.001], [50, -2.49, 0.0009], 7.1792],
  [[50, 2.49, -0.001], [50, -2.49, 0.0010], 7.1792],
  [[50, 2.49, -0.001], [50, -2.49, 0.0011], 7.2195],
  [[50, 2.49, -0.001], [50, -2.49, 0.0012], 7.2195],
  [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.2630],
  [[22.7233, 20.0904, -46.6940], [23.0331, 14.9730, -42.5619], 2.0373],
  [[2.0776, 0.0795, -1.1350], [0.9033, -0.0636, -0.5514], 0.9082],
];
for (const [lab1, lab2, expected] of SHARMA)
  perto(`ΔE00 de Sharma (${lab1.join(',')}) vs (${lab2.join(',')})`, c.deltaE00(lab1, lab2), expected, 1e-4);

// sRGB → Lab, ida e volta pelo que se pode conferir de cabeça.
const labBranco = c.paraLab('#FFFFFF');
perto('L* do branco', labBranco[0], 100, 1e-3);
perto('a* do branco', labBranco[1], 0, 1e-3);
perto('b* do branco', labBranco[2], 0, 1e-3);
perto('L* do preto', c.paraLab('#000000')[0], 0, 1e-3);

// Simulação de deficiência de cor: o cinza é o ponto fixo das três matrizes —
// se uma simulação mexe num cinza, ela está errada.
for (const kind of ['protanopia', 'deuteranopia', 'tritanopia']) {
  const simulated = c.simulate('#808080', kind);
  ok(`${kind} não mexe no cinza`, c.deltaE00(c.paraLab(simulated), c.paraLab('#808080')) < 1.5, `virou ${simulated}`);
}
// E o que ela tem de fazer: vermelho e verde colapsam sob protanopia. Se a
// distância entre eles não cair muito, a matriz está inerte e A7.4 nunca acusa.
const dNormal = c.deltaE00(c.paraLab('#D62728'), c.paraLab('#2CA02C'));
const dProtan = c.deltaE00(c.paraLab(c.simulate('#D62728', 'protanopia')), c.paraLab(c.simulate('#2CA02C', 'protanopia')));
ok('vermelho e verde colapsam sob protanopia', dProtan < dNormal / 2,
  `normal ΔE00=${dNormal.toFixed(1)}, protanopia ΔE00=${dProtan.toFixed(1)}`);

// ------------------------------------------------------------------ relatório

console.log(`  asserções: ${casos.length}`);
if (falhas.length) {
  console.log(`\n  ✗ ${falhas.length}/${casos.length} falharam:`);
  for (const f of falhas) console.log(`      · ${f}`);
  process.exit(1);
}
console.log('\n  ✓ geometria e cor batem com os valores publicados.');
