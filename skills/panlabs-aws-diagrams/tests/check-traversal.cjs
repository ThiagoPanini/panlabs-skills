#!/usr/bin/env node
'use strict';
/**
 * As decisões do #12, conferidas NO ARQUIVO — não na prosa.
 *
 * Cada checagem aqui corresponde a uma regra medida na pesquisa de multi-conta
 * que originou o #12. A diferença entre "decidimos suprimir a aresta
 * cross-account" e "o arquivo não tem aresta cross-account" é a diferença entre
 * uma nota de reunião e um motor.
 *
 *   node tools/check-traversal.cjs
 */

const fs = require('fs');
const path = require('path');
const { gerar } = require('../engine/generate.cjs');

const AQUI = path.join(__dirname, '..');
let falhas = 0;

function ok(name, condicao, detail) {
  if (condicao) { console.log(`  ✓ ${name}${detail ? `  (${detail})` : ''}`); return; }
  falhas++;
  console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ''}`);
}

/** Só a primeira página: é ela a vista consolidada. */
function paginaConsolidada(xml) {
  const m = /<diagram\b[\s\S]*?<\/diagram>/.exec(xml);
  return m ? m[0] : xml;
}

function celulasDeAresta(page) {
  return [...page.matchAll(/<mxCell([^>]*edge="1"[^>]*)>/g)].map(m => m[1]);
}

function atributo(tag, name) {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : null;
}

/**
 * Quantas vezes uma travessia entra no interior de uma conta que não é nem a
 * origem nem o destino dela. É `A5.5` da rubrica (#8) — aresta cortando faixa
 * alheia — e é a diferença entre "desenhei a aresta" e "desenhei bem".
 */
function contarInvasoes(celulas, travessias, caixaDaConta) {
  let n = 0;
  for (const cel of celulas) {
    const t = travessias.find(x => x.id === cel.id);
    if (!t) continue;
    const pts = cel.pontos || [];
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      for (const [id, cx] of caixaDaConta) {
        if (id === t.contaDe || id === t.contaPara) continue;
        const inside = p => p.x > cx.x && p.x < cx.x + cx.w && p.y > cx.y && p.y < cx.y + cx.h;
        // segmento ortogonal: pontas dentro, ou o segmento varando o retângulo
        const cruzaH = a.y === b.y && a.y > cx.y && a.y < cx.y + cx.h &&
          Math.min(a.x, b.x) < cx.x + cx.w && Math.max(a.x, b.x) > cx.x;
        const cruzaV = a.x === b.x && a.x > cx.x && a.x < cx.x + cx.w &&
          Math.min(a.y, b.y) < cx.y + cx.h && Math.max(a.y, b.y) > cx.y;
        if (inside(a) || inside(b) || cruzaH || cruzaV) n++;
      }
    }
  }
  return n;
}

async function main() {
  const modelo = f => JSON.parse(fs.readFileSync(path.join(AQUI, 'models', f), 'utf8'));

  // ---------------------------------------------------------------- E1
  console.log('\n1. E1 — a regra soberana: a vista consolidada de inventário não tem travessia');
  const inv = modelo('landing-zone-6-accounts.json');
  const rInv = await gerar(inv);
  // conta de cada nó, subindo a cadeia de `dentro` — sem depender do motor,
  // para a checagem não conferir o motor contra ele mesmo
  const porId = new Map(inv.nodes.map(n => [n.id, n]));
  const contaDoNo = new Map();
  for (const n of inv.nodes) {
    let c = n, achou = null;
    while (c) {
      if (c.kind === 'account') { achou = c.id; break; }
      c = c.inside ? porId.get(c.inside) : null;
    }
    contaDoNo.set(n.id, achou);
  }

  const cruzamNoModelo = (inv.edges || []).filter(a =>
    contaDoNo.get(a.from) && contaDoNo.get(a.to) && contaDoNo.get(a.from) !== contaDoNo.get(a.to));
  ok('o modelo declara travessias', cruzamNoModelo.length > 0, `${cruzamNoModelo.length} no modelo`);

  const arestasDesenhadas = celulasDeAresta(paginaConsolidada(rInv.xml))
    .map(t => ({ from: atributo(t, 'source'), to: atributo(t, 'target') }));
  const cruzamDesenhadas = arestasDesenhadas.filter(a =>
    a.from && a.to && contaDoNo.get(a.from) && contaDoNo.get(a.to) &&
    contaDoNo.get(a.from) !== contaDoNo.get(a.to));
  ok('nenhuma delas foi desenhada na consolidada', cruzamDesenhadas.length === 0,
    cruzamDesenhadas.length ? `${cruzamDesenhadas.length} vazaram` : 'zero conectores cross-account');
  ok('as arestas INTRA-conta continuam desenhadas', arestasDesenhadas.length > 0,
    `${arestasDesenhadas.length} arestas na página`);

  // ---------------------------------------------------------------- G2
  console.log('\n2. G2 — a OU não é container: rótulo flutuante, sem caixa');
  ok('o motor decidiu desenhar faixas de OU', rInv.derived.ou.desenhar, rInv.derived.ou.because);
  const celulasOu = rInv.plano.celulas.filter(c => String(c.id).startsWith('ou-'));
  ok('há uma célula por OU declarada', celulasOu.length === rInv.derived.ou.ous.length,
    `${celulasOu.length} células para ${rInv.derived.ou.ous.length} OUs`);
  ok('nenhuma delas é container', celulasOu.every(c => !/container=1/.test(c.style)),
    'sem container=1 — o deck não tem shape de Organizational unit');
  ok('nenhuma delas tem borda', celulasOu.every(c => !/strokeColor=#/.test(c.style)),
    'sem strokeColor — o agrupamento é feito pelo contraste de gap 1:4 (S3)');

  // ---------------------------------------------------------------- S3
  console.log('\n3. S3 — o contraste de gap 1:4 entre irmãs e grupos de OU');
  const colunas = [];
  for (const c of rInv.plano.celulas) {
    if (!/grIcon=mxgraph\.aws4\.group_account/.test(c.style || '')) continue;
    colunas.push({ id: c.id, x: c.geo.x, y: c.geo.y, w: c.geo.w, h: c.geo.h });
  }
  const porColuna = new Map();
  for (const c of colunas) {
    if (!porColuna.has(c.x)) porColuna.set(c.x, []);
    porColuna.get(c.x).push(c);
  }
  let gapIrma = Infinity;
  for (const lista of porColuna.values()) {
    lista.sort((a, b) => a.y - b.y);
    for (let i = 1; i < lista.length; i++)
      gapIrma = Math.min(gapIrma, lista[i].y - (lista[i - 1].y + lista[i - 1].h));
  }
  const xs = [...porColuna.keys()].sort((a, b) => a - b);
  let gapOu = Infinity;
  for (let i = 1; i < xs.length; i++) {
    const fimAnterior = Math.max(...porColuna.get(xs[i - 1]).map(c => c.x + c.w));
    gapOu = Math.min(gapOu, xs[i] - fimAnterior);
  }
  ok('gap entre grupos de OU ≈ 4× o gap entre irmãs',
    Number.isFinite(gapIrma) && Number.isFinite(gapOu) && Math.abs(gapOu / gapIrma - 4) < 0.5,
    `irmãs ${gapIrma}px · OU ${gapOu}px · razão ${(gapOu / gapIrma).toFixed(2)}`);

  // ---------------------------------------------------------------- D2
  console.log('\n4. D2 — uma vista de detalhe por conta, SEMPRE (não é fallback)');
  const paginas = [...rInv.xml.matchAll(/<diagram id="([^"]+)"/g)].map(m => m[1]);
  const contas = inv.nodes.filter(n => n.kind === 'account');
  ok('há 1 consolidada + 1 página por conta', paginas.length === 1 + contas.length,
    `${paginas.length} páginas para ${contas.length} contas`);
  ok('cada conta tem a sua', contas.every(c => paginas.includes(`${inv.id}-${c.id}`)),
    paginas.slice(1).join(', '));

  // ------------------------------------------------------- X1 / E8 / E10
  console.log('\n5. X1/E8/E10 — na vista de integração a travessia é desenhada, e não vira espaguete');
  const integ = modelo('platform-3-accounts.json');
  const rInt = await gerar(integ);
  ok('o motor entrou no modo de integração', rInt.derived.modo.modo === 'integracao', rInt.derived.modo.because);
  ok('escolheu um nível da hierarquia do #6 §6.4', rInt.derived.politica.nivel > 1,
    `nível ${rInt.derived.politica.nivel} — ${rInt.derived.politica.mecanismo}`);

  const idsTravessia = new Set(rInt.derived.travessias.map(t => t.id));
  const desenhadas = rInt.plano.celulas.filter(c => c.kind === 'edge' && idsTravessia.has(c.id));
  ok('toda travessia declarada foi desenhada', desenhadas.length === idsTravessia.size,
    `${desenhadas.length}/${idsTravessia.size}`);

  /**
   * E8: nada de cerimônia na borda — nenhum marcador de travessia.
   *
   * ⚠️ `jumpStyle` SAIU desta lista na recertificação do #23, e a razão é que ele
   * nunca pertenceu a ela. O `E8` do #6 fala de marcador NA FRONTEIRA DA CONTA:
   * "a linha simplesmente passa por cima da borda magenta — não existe convenção
   * AWS de porta, gateway, losango ou marcador de travessia". `jumpStyle` no
   * mxGraph não marca borda nenhuma: é o salto que uma aresta dá ao cruzar OUTRA
   * ARESTA, para o leitor ver que as duas não se ligam.
   *
   * Enquanto o motor nunca emitia `jumpStyle`, proibir a família inteira era o
   * jeito barato de escrever "sem cerimônia" e não custava nada. O tema do #13
   * tem o token `aresta.saltos` (default `arc`, "ganho de legibilidade alto,
   * custo zero"), e a partir do momento em que os dois rodam juntos a regra larga
   * passou a reprovar uma coisa que o `E8` não proíbe. Estreitar a checagem para
   * o que o `E8` diz é a correção; afrouxar o token seria obedecer ao teste.
   */
  const CERIMONIA = /startArrow=diamond|endArrow=diamond|startArrow=oval|endArrow=oval/;
  ok('nenhuma cerimônia na borda da conta (E8)',
    desenhadas.every(c => !CERIMONIA.test(c.style)),
    'sem losango nem marcador de travessia na ponta');
  /**
   * CONTROLE, nos dois sentidos. Sem ele, trocar a regex por `/$^/` deixaria a
   * linha acima verde para sempre — e foi assim que a versão anterior ficou:
   * ela também casava `shape=…gateway`, que NUNCA aparece numa aresta, e a
   * alternativa morta passou despercebida porque nada exercitava a regra.
   */
  const COM_LOSANGO = 'edgeStyle=orthogonalEdgeStyle;html=1;endArrow=diamond;endFill=1;';
  const LIMPA = 'edgeStyle=orthogonalEdgeStyle;html=1;endArrow=blockThin;endFill=1;jumpStyle=arc;';
  ok('e a regra ACUSA um losango na ponta (controle)', CERIMONIA.test(COM_LOSANGO),
    'a mesma regra, sobre um estilo com losango, reprova');
  ok('e NÃO acusa `jumpStyle`, que é salto entre ARESTAS e não marcador de borda',
    !CERIMONIA.test(LIMPA),
    'o E8 do #6 fala de porta/losango na fronteira da conta, não de cruzamento de linha');

  // e o anti-espaguete: a linha não pode atravessar o INTERIOR de uma conta que
  // não é a dela. É a checagem que separa "desenhei a aresta" de "desenhei bem".
  const caixaDaConta = new Map();
  for (const c of rInt.plano.celulas) {
    if (!/grIcon=mxgraph\.aws4\.group_account/.test(c.style || '')) continue;
    const pai = rInt.plano.celulas.find(x => x.id === c.pai);
    const base = pai ? { x: pai.geo.x, y: pai.geo.y } : { x: 0, y: 0 };
    caixaDaConta.set(c.id, { x: base.x + c.geo.x, y: base.y + c.geo.y, w: c.geo.w, h: c.geo.h });
  }
  const invasoes = contarInvasoes(desenhadas, rInt.derived.travessias, caixaDaConta);
  ok('nenhuma travessia corta o interior de uma conta alheia (A5.5)', invasoes === 0,
    invasoes ? `${invasoes} invasão(ões)` : 'as calhas e a canaleta seguraram');

  // EXPERIMENTO DE CONTROLE. Uma checagem geométrica que só sabe passar não
  // prova nada — pode estar medindo a coisa errada e concordando consigo mesma.
  // Aqui a mesma rotina recebe a rota INGÊNUA (linha reta de ponta a ponta, que
  // é o que o motor fazia antes da canaleta) e tem de acusar.
  const primeira = rInt.derived.travessias[0];
  const oAbs = rInt.plano.celulas.find(c => c.id === primeira.from);
  const dAbs = rInt.plano.celulas.find(c => c.id === primeira.to);
  if (oAbs && dAbs) {
    const meio = [...caixaDaConta.entries()].find(([id]) =>
      id !== primeira.contaDe && id !== primeira.contaPara);
    if (meio) {
      const [, cx] = meio;
      const y = cx.y + cx.h / 2;
      const reta = [{
        id: primeira.id, kind: 'edge',
        pontos: [{ x: cx.x - 60, y }, { x: cx.x + cx.w + 60, y }],
      }];
      const acusou = contarInvasoes(reta, rInt.derived.travessias, caixaDaConta);
      ok('e a checagem ACUSA quando a rota é a ingênua (controle)', acusou > 0,
        acusou ? `${acusou} invasão(ões) detectada(s) na reta` : 'a checagem não viu — ela não mede o que diz medir');
    }
  }

  // ---------------------------------------------------------------- #34
  console.log('\n6. #34 — o relatório não pode anunciar faixa de OU que o desenho não tem');
  // `platform-3-accounts` é o mesmo modelo da seção 5: 3 contas, `Workloads`
  // com DUAS (c-workload e c-dados) e `c-rede` fora dela — o contraste que
  // dispara `gatilhoOu` — e modo integração, onde `plan.cjs` suprime a
  // faixa. É o caso do corpus com OU em integração que o #34 pediu.
  ok('o gatilho de OU disparou (contraste real: Workloads×2 fora de Infrastructure)',
    rInt.derived.ou.desenhar, rInt.derived.ou.because);
  const ouNoXml = (rInt.xml.match(/OU – /g) || []).length;
  ok('a faixa de OU não está no .drawio (modo integração suprime)', ouNoXml === 0,
    `${ouNoXml} ocorrência(s) de "OU – " na saída`);
  const avisoOu = rInt.relatorio.avisos.find(a => a.startsWith('faixas de OU'));
  ok('existe aviso sobre a faixa de OU', Boolean(avisoOu), avisoOu);
  ok('o aviso DIZ que o modo integração não desenha — não afirma o que o XML nega',
    Boolean(avisoOu) && /não desenha faixa de OU/.test(avisoOu), avisoOu);

  console.log();
  if (falhas) { console.log(`${falhas} checagem(ns) falharam`); process.exit(1); }
  console.log('as decisões do #12 estão no arquivo, não só no README.');
}

main().catch(e => { console.error(e); process.exit(1); });
