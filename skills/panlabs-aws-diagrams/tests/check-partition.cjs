#!/usr/bin/env node
'use strict';
/**
 * PINTURA × MÉTRICA — o tema não é downstream do layout, e isto prova.
 *
 * A intuição confortável é que estilo entra no fim: o layout resolve onde tudo
 * fica e o tema só pinta. É falso, e o #13 mediu onde:
 *
 *   MÉTRICA  corpo do rótulo, corpo do rótulo de grupo, densidade da grade,
 *            qualificador em duas linhas (O21) e a linha de revisão do bloco de
 *            título. Todos alimentam o layout — o texto reserva espaço, e o
 *            espaço é geometria.
 *   PINTURA  cor de página, tinta, halo, cor/ponta/canto/salto/fluxo de aresta,
 *            cores da nota e do bloco lógico. Nenhum move uma coordenada.
 *
 * A checagem perturba UM token por vez e regenera:
 *
 *   token de PINTURA  -> mesmas células, geometria IDÊNTICA. Se mover, está
 *                        classificado errado (ou o motor tem acoplamento escondido).
 *   token de MÉTRICA  -> alguma coisa TEM de se mexer. Se não mexer, o motor está
 *                        ignorando o token — foi assim que se descobriu que a faixa
 *                        de título não olhava para `texto.grupo`.
 *
 *   node tools/check-partition.cjs
 */

const fs = require('fs');
const path = require('path');
const { gerar } = require('../engine/generate.cjs');
const temaMod = require('../theme/theme.cjs');

const ler = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'models', f), 'utf8'));
const MODELO = ler('orders-serverless.json');

/**
 * DOIS modelos, e o segundo não é zelo.
 *
 * Os tokens `bloco.*` pintam a caixa da VISTA LÓGICA — o único lugar do produto
 * onde a casa escolhe cor de caixa sem contrariar a AWS. Num modelo técnico não
 * existe nenhum `bloco`, então eles não têm o que pintar e a checagem os acusa de
 * inertes. O acusado certo, nesse caso, não é o token: é o modelo.
 *
 * É o mesmo caso do `texto.qualificador`, que também saiu inerte até o modelo
 * ganhar qualificadores. A lição que sobra para o motor de verdade: **um token de
 * estilo pode depender de um fato do modelo**, e uma bateria de um modelo só não
 * distingue "token morto" de "modelo que não exercita o token".
 */
const LOGICO = ler('logical-orders.json');

const PINTURA = [
  ['pagina.cor', { page: { color: '#FAFAFA' } }],
  ['tinta.forte', { ink: { strong: '#111111' } }],
  ['tinta.fraca', { ink: { weak: '#444444' } }],
  ['tinta.halo', { ink: { halo: '#FFFFF0' } }],
  ['aresta.cor', { edge: { color: '#545B64' } }],
  ['aresta.espessura', { edge: { thickness: 2.4 } }],
  ['aresta.ponta', { edge: { tip: 'open' } }],
  ['aresta.cantos', { edge: { corners: 0 } }],
  ['aresta.saltos', { edge: { jumps: 'none' } }],
  ['aresta.fluxo', { edge: { flow: 'dashed' } }],
  ['nota.fundo', { note: { background: '#EEEEEE' } }],
  ['nota.borda', { note: { edge: '#555555' } }],
  ['nota.tinta', { note: { ink: '#000000' } }],

  // PINTURA por uma razão medida, não por natureza: Arial e Helvetica têm as
  // mesmas larguras de avanço, então dentro do enum de três a métrica não muda.
  // Foi esta checagem que fechou o enum — com Verdana no lugar, ela acusava
  // "não moveu nada", que era o motor dimensionando a faixa para a fonte errada.
  ['texto.familia', { text: { family: 'Helvetica' } }],
];

/** Pintura que só existe na vista lógica — medida contra o modelo lógico. */
const PINTURA_LOGICA = [
  ['bloco.fundo', { block: { background: '#F5F5F5' } }],
  ['bloco.borda', { block: { edge: '#777777' } }],
  ['bloco.cantos', { block: { corners: 0 } }],
];

const METRICA = [
  // margem da página não move nada DENTRO do desenho, mas desloca o desenho
  // inteiro e muda a caixa da página — geometria, portanto métrica
  ['pagina.margem', { page: { margin: 56 } }],
  ['texto.rotulo', { text: { label: 16 } }],
  ['texto.grupo', { text: { group: 18 } }],
  ['texto.aresta', { text: { edge: 16 } }],
  ['texto.titulo', { text: { title: 30 } }],
  ['texto.subtitulo', { text: { subtitle: 18 } }],
  ['texto.qualificador', { text: { qualifier: true } }],
  ['folga.base', { gap: { base: 4 } }],
  ['folga.densidade', { gap: { density: 1.6 } }],
  // não move ninguém de lugar, mas ACRESCENTA célula ao bloco de título — e é por
  // isso que não é pintura: muda o conjunto de células, não só a cor delas
  ['cartao.revisao', { card: { revision: 'Revisado em 2026-08-21' } }],
];

/**
 * O XML sem o payload do tema.
 *
 * A primeira versão comparava `r.xml === base.xml` cru — e essa comparação NUNCA
 * podia dar verdadeiro, porque `comPatch` renomeia o tema para `claro+patch` e o
 * `panlabsTema` embutido carrega o `id`. Era uma condição que não sabia disparar:
 * exatamente o defeito que esta ferramenta existe para pegar nos tokens, dentro
 * da própria ferramenta. Tirando o payload, "o token não pintou nada" volta a ser
 * detectável.
 */
function semPayload(xml) {
  return xml.replace(/panlabsTema="[^"]*"/, 'panlabsTema=""');
}

/** Assinatura de geometria: id -> x,y,w,h. Pintura não pode mudar nenhuma. */
function geometry(plano) {
  const m = new Map();
  for (const c of plano.celulas) {
    if (c.kind === 'edge') { m.set(c.id, JSON.stringify(c.pontos || [])); continue; }
    m.set(c.id, `${Math.round(c.geo.x)},${Math.round(c.geo.y)},${Math.round(c.geo.w)},${Math.round(c.geo.h)}`);
  }
  return m;
}

function diferencas(a, b) {
  const out = [];
  for (const [id, v] of a) if (!b.has(id)) out.push(`${id}: sumiu`);
  for (const [id, v] of b) {
    if (!a.has(id)) out.push(`${id}: apareceu`);
    else if (a.get(id) !== v) out.push(`${id}: ${a.get(id)} -> ${v}`);
  }
  return out;
}

async function main() {
  const base = await gerar(MODELO, { tema: 'light', force: true });
  const g0 = geometry(base.plano);
  const baseLog = await gerar(LOGICO, { tema: 'light', force: true });
  const gLog = geometry(baseLog.plano);
  let falhou = 0;

  console.log(`referência: tema "claro" · técnico ${g0.size} células · lógico ${gLog.size} células\n`);
  console.log('PINTURA — não pode mover coordenada');
  for (const [name, patch, ehLogico] of [...PINTURA, ...PINTURA_LOGICA.map(p => [...p, true])]) {
    const modelo = ehLogico ? LOGICO : MODELO;
    const ref = ehLogico ? gLog : g0;
    const refXml = ehLogico ? baseLog.xml : base.xml;
    const r = await gerar(modelo, { tema: temaMod.comPatch('light', patch), force: true });
    const d = diferencas(ref, geometry(r.plano));
    const inerte = semPayload(r.xml) === semPayload(refXml);
    if (d.length) {
      console.log(`  ✗ ${name.padEnd(20)} moveu ${d.length} célula(s): ${d.slice(0, 2).join(' · ')}`);
      falhou = 1;
    } else if (inerte) {
      // pintura que não move coordenada E não muda o XML é token morto
      console.log(`  ✗ ${name.padEnd(20)} não moveu nem pintou — token inerte`);
      falhou = 1;
    } else {
      console.log(`  ✓ ${name.padEnd(20)} geometria idêntica, style mudou${ehLogico ? '  (vista lógica)' : ''}`);
    }
  }

  console.log('\nMÉTRICA — tem de mover alguma coisa');
  for (const [name, patch] of METRICA) {
    const r = await gerar(MODELO, { tema: temaMod.comPatch('light', patch), force: true });
    const d = diferencas(g0, geometry(r.plano));
    if (!d.length) { console.log(`  ✗ ${name.padEnd(20)} NÃO moveu nada — o motor está ignorando o token`); falhou = 1; }
    else console.log(`  ✓ ${name.padEnd(20)} moveu ${String(d.length).padStart(2)} célula(s)`);
  }

  console.log(falhou ? '\nPARTIÇÃO QUEBRADA' : '\npartição íntegra: pintura pinta, métrica mede');
  process.exit(falhou);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
