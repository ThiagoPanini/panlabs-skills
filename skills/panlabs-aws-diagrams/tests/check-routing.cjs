#!/usr/bin/env node
'use strict';
/**
 * O ORÇAMENTO DE ROTEAMENTO DO #24 — e ele mede o desenho que reprovou.
 *
 * A inspeção humana do #14 reprovou a vista técnica por setas em cima dos
 * ícones; o validador do #18 nomeou o que o olho viu; o motor do #12 melhorou e
 * não fechou a conta. Este arquivo é a conta, e ela tem duas partes.
 *
 *   ┌ A VERACIDADE, no corpus inteiro. `A5.5` é a aresta que atravessa uma
 *   │ fronteira de rede de que ela não sai nem para onde vai — o desenho
 *   │ afirmando um caminho que o modelo nega. A rubrica (#8) põe tolerância
 *   │ ZERO nela, e o #18 confirmou. Vale para toda página de todo modelo, e
 *   │ não só para a vista técnica: uma travessia espúria não fica menos
 *   │ mentirosa por estar num diagrama que ninguém olhou.
 *   │
 *   └ A LEGIBILIDADE, na vista técnica. `A3.5` (aresta por cima de ícone) e
 *     `A3.4` (aresta por cima de rótulo) são o sintoma que a inspeção humana
 *     enxergou sem ver número nenhum, e `A5.1` é o cruzamento, que tem
 *     orçamento em vez de tolerância zero — a rubrica aceita 2.
 *
 * ⚠️ O QUE ESTE ARQUIVO NÃO É: um segundo validador. Ele não mede nada por
 * conta própria — chama o do #18 e compara com um orçamento escrito. A decisão
 * 2 do #18 continua valendo: quem corrige é `dispor`/`alinhar`, quem julga é o
 * validador, e um número num teste não é um laço de correção.
 *
 * ⚠️ E ele é EXATO, não "menos ou igual": um orçamento que aceita qualquer
 * coisa abaixo do teto deixa uma melhora passar sem ser registrada, e o ticket
 * pede o número. Quando o desenho melhorar, este arquivo tem de ser atualizado
 * de propósito — que é o mesmo contrato da quarentena do `check-good.cjs`.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const { gerar } = require(path.join(RAIZ, 'engine', 'generate.cjs'));
const { validarGeometria } = require(path.join(RAIZ, 'validator', 'validate-geometry.cjs'));
const { aprovar } = require(path.join(RAIZ, 'session', 'agreement.cjs'));
const { elaborar } = require(path.join(RAIZ, 'session', 'elaborate.cjs'));
const { projetar } = require(path.join(RAIZ, 'session', 'project.cjs'));

/**
 * A VISTA TÉCNICA NÃO É UM `models/*.json`.
 *
 * Ela nasce da sessão do #14 — `retail-logical` aprovada, `retail-elaboration`
 * aplicada por cima, e a projeção recortando a camada técnica. Medir só o
 * corpus deixaria de fora exatamente o desenho que este ticket existe para
 * consertar, e foi por isso que a suíte do #14 ficou verde sobre um desenho
 * que a inspeção humana reprovou: ela media a projeção, não o traçado.
 */
function vistaTecnica() {
  const ler = f => JSON.parse(fs.readFileSync(path.join(RAIZ, 'models', 'session', f), 'utf8'));
  const aprovado = aprovar(ler('retail-logical.json'), { at: '2026-08-21', by: 'usuario', candidate: 'cand-a' });
  return projetar(elaborar(aprovado, ler('retail-elaboration.json')), 'technical').modelo;
}

/** O orçamento do ticket, somado sobre TODAS as páginas da vista técnica. */
const ORCAMENTO_TECNICA = {
  'A5.5': 0,   // tolerância zero — é veracidade, não gosto
  'A3.5': 0,   // a seta por cima do ícone que o humano viu
  'A3.4': 0,   // e a seta por cima do rótulo
};

function occurrences(laudo, id) {
  const x = [...laudo.resultados, ...laudo.extras].find(r => r.id === id);
  return x ? { n: x.occurrences.length, state: x.state, det: x.occurrences.map(o => o.o_que) } : null;
}

/**
 * A PRIMITIVA, contra casos escritos à mão.
 *
 * `corredorLivre` é a alavanca nova do #24, e ela é pura: faixa + obstáculos +
 * preferência entram, uma coordenada sai. Conferi-la só pelo desenho inteiro
 * seria conferir a soma de dez decisões — e quando o número mudasse, ninguém
 * saberia qual delas mudou. Os casos abaixo são os que o motor de fato encontra,
 * reduzidos ao mínimo que os distingue.
 */
function primitiva() {
  const { corredorLivre } = require(path.join(RAIZ, 'engine', 'layout.cjs'));
  const caixa = (ini, fim, lo, hi) => ({ ini, fim, lo, hi });

  // as três colunas do `web-flow-3-az`, na faixa que a perna atravessa
  const grade = [caixa(48, 248, 0, 800), caixa(339, 539, 0, 800), caixa(630, 830, 0, 800)];

  const casos = [
    { name: 'preferência já livre passa intacta',
      r: corredorLivre([100, 300], grade, 584.5), espera: 584.5 },
    { name: 'preferência DENTRO de coluna cai no vão vizinho',
      r: corredorLivre([100, 300], grade, 538), espera: 584.5 },
    { name: 'e escolhe o vão do lado da origem, não o mais largo',
      r: corredorLivre([100, 300], grade, 350), espera: 293.5 },
    { name: 'obstáculo que não cruza a faixa não conta',
      r: corredorLivre([0, 50], [caixa(339, 539, 100, 800)], 400), espera: 400 },
    { name: 'rente à borda não é atravessar',
      r: corredorLivre([100, 300], grade, 539), espera: 539 },
    { name: 'sem obstáculo nenhum devolve a preferência',
      r: corredorLivre([100, 300], [], 42), espera: 42 },
    // a garantia que faz o retorno ser sempre um número: as margens externas
    // estão livres por construção, então a busca nunca volta de mãos vazias
    { name: 'tudo bloqueado sai pela margem mais perto',
      r: corredorLivre([100, 300], [caixa(0, 1000, 0, 800)], 400), espera: -24 },
    { name: 'e pela margem da DIREITA quando a preferência está desse lado',
      r: corredorLivre([100, 300], [caixa(0, 1000, 0, 800)], 900), espera: 1024 },
  ];

  let falhou = 0;
  console.log('\n  corredorLivre — a alavanca que o desvio não tinha\n');
  for (const c of casos) {
    const ok = Math.abs(c.r - c.espera) < 0.001;
    if (!ok) falhou = 1;
    console.log(`  ${ok ? '✓' : '✗'} ${c.name}` + (ok ? '' : `  — esperava ${c.espera}, veio ${c.r}`));
  }
  return falhou;
}

async function main() {
  let falhou = primitiva();

  // ---------------------------------------------------- 1 · a veracidade, no corpus
  console.log('\n  A5.5 — aresta atravessando fronteira alheia (tolerância zero, todo o corpus)\n');
  const corpus = fs.readdirSync(path.join(RAIZ, 'models')).filter(f => f.endsWith('.json')).sort();
  const entradas = [
    ...corpus.map(f => ({ name: path.basename(f, '.json'),
      modelo: JSON.parse(fs.readFileSync(path.join(RAIZ, 'models', f), 'utf8')) })),
    { name: 'vista técnica (sessão do #14)', modelo: vistaTecnica() },
  ];

  let travessias = 0;
  for (const { name, modelo } of entradas) {
    const r = await gerar(modelo);
    for (const p of [r.plano, ...r.paginas]) {
      const a55 = occurrences(validarGeometria(p), 'A5.5');
      if (!a55) { falhou = 1; console.log(`  ‼ ${name}: A5.5 não rodou`); continue; }
      if (!a55.n) continue;
      falhou = 1; travessias += a55.n;
      console.log(`  ✗ ${name} · página "${p.id}": A5.5 ×${a55.n}`);
      for (const o of a55.det) console.log(`      · ${o}`);
    }
  }
  console.log(`  ${travessias ? '✗' : '✓'} ${travessias} travessia(s) espúria(s) no corpus — o orçamento é 0`);

  // ------------------------------------------- 2 · a legibilidade, na vista técnica
  //
  // ⚠️ TODAS AS PÁGINAS DA VISTA, não só a consolidada.
  //
  // Desde o #12 a vista técnica multi-conta é 1+N páginas (`D2` do #6), e a
  // primeira versão deste arquivo media só a primeira. Passava — e o
  // `retail-300-stores-tecnica-processamento` ainda carregava `A3.4` ×1. Medir a
  // página consolidada e dizer "a vista técnica" é o mesmo erro de escopo que
  // deixou a suíte do #14 verde sobre um desenho reprovado a olho: o recorte da
  // medição não era o recorte da entrega.
  console.log('\n  a vista técnica do #14 — o desenho que a inspeção humana reprovou\n');
  const rt = await gerar(vistaTecnica());
  const paginas = [rt.plano, ...rt.paginas];
  const laudos = paginas.map(p => ({ page: p.id, laudo: validarGeometria(p) }));

  for (const [id, teto] of Object.entries(ORCAMENTO_TECNICA)) {
    let total = 0, faltou = false;
    const det = [];
    for (const { page, laudo: l } of laudos) {
      const x = occurrences(l, id);
      if (!x) { faltou = true; console.log(`  ‼ ${id} não rodou em "${page}"`); continue; }
      total += x.n;
      for (const o of x.det) det.push(`${page}: ${o}`);
    }
    const ok = !faltou && total === teto;
    if (!ok) falhou = 1;
    console.log(`  ${ok ? '✓' : '✗'} ${id} ×${total} nas ${paginas.length} páginas  (orçamento ${teto})`);
    if (!ok) for (const o of det.slice(0, 4)) console.log(`      · ${o}`);
  }
  const laudo = laudos[0].laudo;   // `A5.1` é da consolidada — ver abaixo

  /**
   * `A5.1` é a única do ticket que tem ORÇAMENTO em vez de tolerância zero, e a
   * régua é a da própria rubrica: o validador já sabe quantos cruzamentos ele
   * tolera antes de virar falha (`orcamento_de_falha` na medida). Reimplementar
   * o número aqui seria uma segunda cópia do limiar — e o #18 mediu o preço de
   * ter duas cópias de um limiar.
   */
  const a51 = occurrences(laudo, 'A5.1');
  const medida = [...laudo.resultados].find(r => r.id === 'A5.1');
  const inside = a51 && a51.state !== 'falha';
  if (!inside) falhou = 1;
  console.log(`  ${inside ? '✓' : '✗'} A5.1 ${medida ? `${medida.medida.cruzamentos} cruzamento(s), orçamento ${medida.medida.orcamento_de_falha}` : '—'}` +
    ` → ${a51 ? a51.state : 'não rodou'}`);

  console.log(falhou
    ? '\n  ✗ o roteamento da vista técnica está fora do orçamento do #24\n'
    : '\n  ✓ o roteamento cabe no orçamento: nenhuma travessia espúria, nenhuma seta por cima de ícone ou rótulo.\n');
  process.exit(falhou ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
