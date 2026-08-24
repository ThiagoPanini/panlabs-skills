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
const { revisar, NOMES, arquivosDoCorpus } =
  require(path.join(__dirname, '..', 'sessao', 'lacunas.cjs'));

const RAIZ = path.join(__dirname, '..');

/**
 * ⚠️ EXCEÇÕES NOMEADAS AO L4 — nenhuma, e a lista vazia é resultado, não descuido.
 *
 * Ela teve uma, e a história dela é o mecanismo funcionando. `plataforma-3-contas`
 * fazia 6 achados com teto 5, os seis foram conferidos à mão, e a entrada ficou
 * aqui com o motivo medido: o denominador do teto é contagem de nós, e achado
 * escala com SUPERFÍCIE de arquitetura.
 *
 * Aí o caso ponta a ponta do #26 achou a cláusula que faltava no `spof` — só os
 * estrangulamentos MAXIMAIS, porque numa cadeia linear toda ligação é ponto de
 * articulação — e a exceção expirou sozinha: este teste ficou vermelho com a
 * mensagem que ele mesmo tinha preparado (*"ela não estoura mais: APAGUE a
 * entrada"*), e a entrada foi apagada. É a mesma trajetória da quarentena do #23,
 * que o #24 fez expirar do mesmo jeito.
 *
 * A observação sobre o denominador continua valendo e continua registrada em
 * `docs/corpus.md` — ela só não tem mais nenhum modelo do corpus para provar.
 */
const FORA_DO_TETO = {};

let falhou = 0;
const anota = (ok, o_que, detalhe) => {
  if (!ok) falhou++;
  console.log(`  ${ok ? '✓' : '✗'} ${o_que}`);
  if (detalhe) console.log(`      ${detalhe}`);
};

// ------------------------------------------------------------- roda o corpus

// A MESMA varredura que a CLI usa — se fossem duas, `L2`/`L3` poderiam ficar
// verdes contra metade do corpus.
const arqs = arquivosDoCorpus(RAIZ);

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
for (const r of NOMES) {
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
console.log(`  ✓ as seis regras sabem disparar e sabem calar, e ${Object.keys(FORA_DO_TETO).length
  ? `o teto tem ${Object.keys(FORA_DO_TETO).length} exceção(ões) nomeada(s)`
  : 'nenhum modelo estoura o teto'}.`);
