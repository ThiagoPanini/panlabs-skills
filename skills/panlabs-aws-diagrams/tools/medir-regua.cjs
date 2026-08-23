#!/usr/bin/env node
'use strict';
/**
 * A RÉGUA DO FUNDO — até onde a paleta oficial da AWS aguenta a página mudar de cor.
 *
 * Esta medição é o achado que reescreveu o terceiro tema do #13. A pergunta que
 * a gente ia responder por gosto ("qual fundo para o tema corporativo?") tem
 * resposta por número, e a resposta é: quase nenhum.
 *
 * Método: WCAG 2.2 SC 1.4.11 exige 3:1 entre "the important parts of a more
 * complex diagram" e a cor adjacente. A borda de grupo é a fronteira desenhada —
 * é o que o leitor precisa ver. Para cada cor normativa, varremos os 256 cinzas
 * neutros e achamos o mais escuro (vindo do branco) e o mais claro (vindo do
 * preto) que ainda entregam 3:1.
 *
 *   node tools/medir-regua.cjs
 */

const { razao, luminancia } = require('../motor/contraste.cjs');
const cat = require('../catalog/aws-shapes.cjs').carregar();
const tema = require('../tema/tema.cjs');

const cinza = g => '#' + Math.max(0, Math.min(255, g)).toString(16).padStart(2, '0').repeat(3).toUpperCase();

function limites(cor, alvo = 3) {
  let claro = null, escuro = null;
  for (let g = 255; g >= 0; g--) { if (razao(cor, cinza(g)) < alvo) { claro = g + 1; break; } }
  for (let g = 0; g <= 255; g++) { if (razao(cor, cinza(g)) < alvo) { escuro = g - 1; break; } }
  return { claro: claro === null ? 0 : claro, escuro: escuro === null ? 255 : escuro };
}

function corDaBorda(style) { return (/(?:^|;)strokeColor=(#[0-9A-Fa-f]{6})/.exec(style) || [])[1]; }

function main() {
  const bordas = new Map();
  for (const t of cat.grupos()) {
    const c = corDaBorda(cat.grupo(t).style);
    if (!c) continue;
    if (!bordas.has(c)) bordas.set(c, []);
    bordas.get(c).push(t);
  }

  console.log('\n=== 1. BORDA DE GRUPO vs. FUNDO NEUTRO (WCAG 1.4.11, alvo 3:1) ===\n');
  console.log('cor      vs branco  fundo claro mais ESCURO que passa   fundo escuro mais CLARO que passa   grupos');
  const linhas = [...bordas.entries()].sort((a, b) => razao(a[0], '#FFFFFF') - razao(b[0], '#FFFFFF'));
  for (const [c, grupos] of linhas) {
    const l = limites(c);
    console.log(`${c}   ${razao(c, '#FFFFFF').toFixed(2).padStart(5)}   ` +
      `${(l.claro > 255 ? 'NENHUM' : cinza(l.claro)).padEnd(30)} ` +
      `${(l.escuro < 0 ? 'NENHUM' : cinza(l.escuro)).padEnd(30)} ${grupos.slice(0, 2).join(', ')}`);
  }

  // O AWS Cloud sai da conta do fundo escuro porque ele é justamente a cor que o
  // deck escuro INVERTE — medi-lo como se não invertesse tornaria a régua inútil.
  const semNuvem = linhas.filter(([c]) => c !== '#232F3E');
  const teto = Math.max(...linhas.map(([c]) => limites(c).claro));
  const piso = Math.min(...semNuvem.map(([c]) => limites(c).escuro));
  console.log(`\n  → o fundo CLARO não pode ser mais escuro que ${cinza(teto)} (quem manda: ` +
    linhas.filter(([c]) => limites(c).claro === teto).map(([c]) => c).join(', ') + ')');
  console.log(`  → o fundo ESCURO não pode ser mais claro que ${cinza(piso)} (quem manda: ` +
    semNuvem.filter(([c]) => limites(c).escuro === piso).map(([c]) => c).join(', ') +
    ') — já com o AWS Cloud invertido, como manda o deck escuro');
  console.log('\n  Não existe faixa no meio. O "off-white corporativo" — #F7F8FA, #F2F3F5,');
  console.log('  #FAFAFA — cai fora do teto. A margem estética da casa não está no fundo.');

  console.log('\n=== 2. O QUE O DECK ESCURO DA AWS MUDA, DERIVADO DA MEDIÇÃO ===\n');
  console.log('A AWS publica dois decks e o escuro muda a borda/ícone do AWS Cloud e os');
  console.log('callouts, nada mais (#5 §2.1 leitura 2). Medindo contra um fundo escuro:\n');
  const escuro = tema.PADRAO.escuro.pagina.cor;
  const reprovam = [];
  for (const [c, grupos] of linhas) {
    const r = razao(c, escuro);
    const marca = r >= 3 ? ' ' : '✗';
    if (r < 3) reprovam.push(c);
    console.log(`  ${marca} ${c}  ${r.toFixed(2).padStart(5)}:1 sobre ${escuro}   ${grupos.slice(0, 2).join(', ')}`);
  }
  console.log(`\n  → reprovam: ${reprovam.join(', ') || 'nenhuma'}. A lista da medição e a lista`);
  console.log('    do deck escuro são a MESMA. O deck escuro é a edição mínima que a WCAG exige.');

  console.log('\n=== 3. PALETA DE CATEGORIA (quadrado do service icon) ===\n');
  const fills = new Map();
  for (const [k, v] of Object.entries(cat.categorias())) {
    if (!v.fill) continue;
    if (!fills.has(v.fill)) fills.set(v.fill, []);
    fills.get(v.fill).push(k);
  }
  console.log('cor      vs branco  vs escuro  glifo branco sobre ela  categorias');
  for (const [c, cats] of [...fills.entries()].sort((a, b) => razao(a[0], '#FFFFFF') - razao(b[0], '#FFFFFF')))
    console.log(`${c}   ${razao(c, '#FFFFFF').toFixed(2).padStart(5)}     ${razao(c, escuro).toFixed(2).padStart(5)}` +
      `      ${razao(c, '#FFFFFF').toFixed(2).padStart(5)}                ${cats.slice(0, 3).join(', ')}`);
  console.log('\n  O glifo é branco sobre o quadrado, então "vs branco" e "glifo" são a mesma');
  console.log('  conta — e é por isso que a paleta inteira encosta em 3:1: ela foi calibrada');
  console.log('  para o glifo branco caber, não para a página.');

  console.log('\n=== 4. QUE SERVIÇO O TEMA ESCURO NÃO SUPORTA ===\n');
  const porCategoria = new Map();
  for (const s of cat.catalogo.services) {
    if (!porCategoria.has(s.palette)) porCategoria.set(s.palette, 0);
    porCategoria.set(s.palette, porCategoria.get(s.palette) + 1);
  }
  let reprovados = 0, total = 0;
  const lista = [];
  for (const [pal, n] of porCategoria) {
    const fill = (cat.categorias()[pal] || {}).fill;
    total += n;
    if (!fill) continue;
    // as paletas monocromáticas são justamente as que a AWS entrega em Light/Dark;
    // o tema inverte e elas saem em branco. Fora da conta.
    if (tema.PALETAS_MONO.has(pal)) continue;
    const r = razao(fill, escuro);
    if (r < 3) { reprovados += n; lista.push(`${pal} (${fill}, ${r.toFixed(2)}:1, ${n} ícones)`); }
  }
  if (lista.length) {
    console.log('  O deck escuro da AWS diz que a cor de categoria não muda. A medição');
    console.log('  discorda em duas categorias — e é por isso que o portão roda sobre o');
    console.log('  PLANO, não sobre o tema: se o diagrama não usa esses serviços, passa.\n');
    for (const l of lista) console.log('  ✗ ' + l);
    console.log(`\n  → ${reprovados} de ${total} service icons ficam abaixo de 3:1 no fundo escuro.`);
  } else {
    console.log('  Nenhuma categoria reprova no fundo escuro.');
  }

  console.log('\n=== 5. VEREDITO POR TEMA ===\n');
  for (const id of tema.listar()) {
    let t; try { t = tema.carregar(id); } catch (e) { console.log(`  ${id.padEnd(14)} não carrega: ${e.message}`); continue; }
    const f = t.tokens.pagina.cor;
    // aplica a inversão normativa antes de medir: é o que o tema de fato emite
    const cores = linhas.map(([c]) => c === '#232F3E' ? t.normativo.nuvem : c);
    const pior = Math.min(...cores.map(c => razao(c, f)));
    const quem = cores.find(c => razao(c, f) === pior);
    const lum = luminancia(f);
    const ok = pior >= 3;
    console.log(`  ${ok ? '✓' : '✗'} ${id.padEnd(14)} fundo ${f}  luminância ${lum.toFixed(4)}  ` +
      `pior borda de grupo ${pior.toFixed(2)}:1 (${quem})  ${ok ? '' : '← REPROVA'}`);
  }
  console.log('');
}

if (require.main === module) main();
module.exports = { limites, cinza };
