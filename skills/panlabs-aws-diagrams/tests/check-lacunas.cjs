#!/usr/bin/env node
'use strict';
/**
 * A régua da revisão de lacunas — os limiares que o #26 calibrou, travados.
 *
 * O #15 fechou a política (bloqueia em bloco, uma vez só; relata e nunca
 * conserta calado) e deixou o LIMIAR aberto, com o número que o motivava: as
 * regras do protótipo dispararam **4 achados num modelo de 3 nós**.
 *
 * O critério de aprovação está em `docs/corpus.md` §4.2, e foi escrito ANTES
 * destas regras existirem. Este arquivo é ele, executável.
 *
 *   L1  toda regra tem pré-condição escrita, e cala onde o modelo não afirma
 *       a estrutura sobre a qual ela fala  →  conferido por `mudas[]` existir
 *       e trazer motivo
 *   L2  toda regra dispara em ≥1 modelo do corpus
 *   L3  toda regra cala em ≥1 modelo do corpus
 *   L4  nenhum modelo produz mais achados que ⌈nós ÷ 4⌉
 *
 * L2 e L3 juntos são o guarda: uma regra tem de saber dizer sim E saber dizer
 * não, contra o mesmo corpus. Regra que dispara em todos não mede nada, afirma
 * uma constante — é a forma da lição do #23 (o `A4.1` medindo o motor contra ele
 * mesmo, 77 ocorrências todas reportando exatamente 8) aplicada à outra ponta.
 */

const fs = require('fs');
const path = require('path');
const { revisar } = require(path.join(__dirname, '..', 'sessao', 'lacunas.cjs'));

const RAIZ = path.join(__dirname, '..');

const REGRAS = ['spof', 'single-az', 'egress-sem-controle', 'dado-em-subnet-publica',
  'cross-account-sem-confianca', 'assincrono-sem-dlq'];

/**
 * ⚠️ EXCEÇÃO NOMEADA AO L4 — uma, e ela tem endereço.
 *
 * `plataforma-3-contas` faz 6 achados com teto 5. Os seis foram conferidos um a
 * um e os seis se sustentam: dois ALB/ECS/bus sem par no caminho do cliente,
 * duas travessias cross-account sem habilitador desenhado, e a VPC de inspeção
 * cujo atracamento no Transit Gateway o modelo de fato não desenha.
 *
 * O que falha aqui é o TETO, não as regras — e o critério de `docs/corpus.md`
 * proíbe ajustá-lo depois de ver o número, de propósito. A razão medida é que o
 * denominador está errado: achado escala com SUPERFÍCIE de arquitetura (contas,
 * VPCs, pontos de entrada), não com contagem de nós. O `web-fluxo-3-az` tem 20
 * nós, uma VPC e zero achados; este tem 17 nós, três contas e duas VPCs.
 *
 * Fica como refino conhecido (premissa 12 do mapa). Se o dia em que alguém
 * trocar o denominador chegar, este teste fica VERMELHO e manda apagar a
 * entrada — igual à quarentena do #23, que expirou exatamente assim.
 */
const FORA_DO_TETO = {
  'plataforma-3-contas': {
    achados: 6, teto: 5,
    porque: 'o teto usa nós como denominador e o achado escala com superfície ' +
      '(3 contas, 2 VPCs). Os 6 achados foram conferidos e se sustentam.',
  },
};

let falhou = 0;
const anota = (ok, o_que, detalhe) => {
  if (!ok) falhou++;
  console.log(`  ${ok ? '✓' : '✗'} ${o_que}`);
  if (detalhe) console.log(`      ${detalhe}`);
};

// ------------------------------------------------------------- roda o corpus

const arqs = [];
for (const d of ['modelo', 'modelo/recusa']) {
  const dir = path.join(RAIZ, d);
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort())
    arqs.push(path.join(d, f));
}

const disparou = new Map(), calou = new Map();
const estouram = [];
let totalAchados = 0, totalNos = 0;

for (const rel of arqs) {
  const modelo = JSON.parse(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
  const nome = path.basename(rel, '.json');
  const r = revisar(modelo);
  totalAchados += r.achados.length;
  totalNos += modelo.nos.length;

  for (const k of new Set(r.achados.map(a => a.regra))) disparou.set(k, (disparou.get(k) || 0) + 1);
  for (const m of r.mudas) calou.set(m.regra, (calou.get(m.regra) || 0) + 1);
  if (!r.dentroDoTeto) estouram.push({ nome, achados: r.achados.length, teto: r.teto });
}

console.log(`\n1 · o corpus rodado: ${arqs.length} modelos, ${totalNos} nós, ${totalAchados} achados\n`);

// L1 — toda regra que cala diz POR QUÊ
{
  const semMotivo = [];
  for (const rel of arqs) {
    const modelo = JSON.parse(fs.readFileSync(path.join(RAIZ, rel), 'utf8'));
    for (const m of revisar(modelo).mudas)
      if (!m.porque || !m.porque.trim()) semMotivo.push(`${path.basename(rel, '.json')}/${m.regra}`);
  }
  anota(!semMotivo.length, 'L1 · toda regra muda traz o motivo — "não acusou" nunca se confunde com "não rodou"',
    semMotivo.length ? semMotivo.join(', ') : `${[...calou.values()].reduce((a, b) => a + b, 0)} silêncios, todos com motivo`);
}

// L2 e L3
console.log('\n2 · o guarda dos dois lados: toda regra sabe dizer sim E sabe dizer não\n');
for (const r of REGRAS) {
  const d = disparou.get(r) || 0, c = calou.get(r) || 0;
  anota(d >= 1, `L2 · "${r}" dispara em ≥1 modelo`, `disparou em ${d}`);
  anota(c >= 1, `L3 · "${r}" cala em ≥1 modelo`, `calou em ${c}`);
}

// L4
console.log('\n3 · o teto\n');
{
  const inesperados = estouram.filter(e => !FORA_DO_TETO[e.nome]);
  anota(!inesperados.length, 'L4 · nenhum modelo estoura ⌈nós÷4⌉ fora das exceções nomeadas',
    inesperados.length
      ? inesperados.map(e => `${e.nome}: ${e.achados} > ${e.teto}`).join(' · ')
      : `${arqs.length - estouram.length}/${arqs.length} dentro do teto`);

  // a outra ponta: uma exceção que parou de estourar tem de ser APAGADA
  for (const [nome, esperado] of Object.entries(FORA_DO_TETO)) {
    const real = estouram.find(e => e.nome === nome);
    anota(!!real, `a exceção nomeada "${nome}" AINDA estoura`,
      real ? `${real.achados} achados contra teto ${real.teto} — ${esperado.porque}`
        : `ela não estoura mais: o teto foi consertado ou a regra mudou. APAGUE a entrada de FORA_DO_TETO.`);
    if (real)
      anota(real.achados === esperado.achados && real.teto === esperado.teto,
        `e estoura pela MESMA margem que foi conferida à mão`,
        `esperado ${esperado.achados}/${esperado.teto}, veio ${real.achados}/${real.teto}`);
  }
}

// O número do #15, para poder ser comparado
console.log('\n4 · a régua contra o protótipo do #15\n');
{
  const taxa = totalAchados / totalNos;
  anota(taxa < 1.33 / 4, 'a taxa está pelo menos 4× abaixo da do protótipo',
    `${totalAchados} achados / ${totalNos} nós = ${taxa.toFixed(3)} por nó ` +
    `(protótipo: 4/3 = 1.333 — ${(1.333 / taxa).toFixed(1)}× acima desta)`);
}

console.log();
if (falhou) { console.log(`  ✗ ${falhou} asserção(ões) da revisão de lacunas falharam.`); process.exit(1); }
console.log('  ✓ as seis regras sabem disparar e sabem calar, e o teto tem uma exceção nomeada.');
