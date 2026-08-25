#!/usr/bin/env node
'use strict';
/**
 * As quatro células do #12 saem de TOKEN, e o tema `claro` reconstrói os literais.
 *
 * Quando o multi-conta entrou no motor, o #13 ainda não existia ali: `planejar.cjs`
 * ganhou quatro estilos escritos à mão — o rótulo de OU, a linha do barramento, o
 * stub e o habilitador de permissão — com hex dentro. Enquanto o motor só desenhava
 * no branco isso não custava nada. No instante em que os dois passaram a rodar
 * juntos passou a custar o deck escuro: barramento `#232F3E` sobre fundo `#1C1C1C`.
 *
 * A consolidação trocou os quatro literais por construtores de tema. A afirmação
 * que essa troca faz — e que esta checagem mede — é forte e vale escrever:
 *
 *   **o #12 já estava usando os tokens do #13, escrevendo os valores deles à mão.**
 *
 * Se for verdade, o tema `claro` reconstrói cada literal chave por chave. Onde não
 * reconstruir, a divergência aparece nomeada aqui em vez de virar diferença
 * silenciosa de desenho — que é o que a consolidação existe para não deixar acontecer.
 *
 * A segunda metade é o portão: no tema ESCURO os mesmos quatro estilos têm de
 * passar no contraste. É a prova de que a troca comprou alguma coisa.
 */

const path = require('path');

const RAIZ = path.join(__dirname, '..');
const temaMod = require(path.join(RAIZ, 'tema', 'tema.cjs'));
const { razao, limiarDeTexto } = require(path.join(RAIZ, 'motor', 'contraste.cjs'));

let falhas = 0;
const ok = (cond, titulo, detalhe) => {
  console.log(`  ${cond ? '✓' : '✗'} ${titulo}${detalhe ? `  — ${detalhe}` : ''}`);
  if (!cond) falhas++;
};

/** Os literais como o #12 os escreveu, copiados do `planejar.cjs` daquele ticket. */
const LITERAIS = {
  ou: 'text;html=1;fontSize=13;fontStyle=1;fontColor=#232F3E;align=left;verticalAlign=middle;',
  barramento: 'endArrow=none;html=1;strokeColor=#232F3E;strokeWidth=1.6;',
  stub: 'edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#232F3E;strokeWidth=1.6;' +
    'endArrow=blockThin;endFill=1;endSize=6;fontSize=10;fontColor=#232F3E;labelBackgroundColor=#FFFFFF;',
  habilitador: 'edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=#5A6C86;strokeWidth=1.4;dashed=1;' +
    'dashPattern=6 4;endArrow=blockThin;endFill=1;endSize=6;',
};

/**
 * ACRÉSCIMO ESPERADO, e o esperado é uma lista fechada de propósito: qualquer
 * chave nova fora dela é diferença de desenho que ninguém decidiu.
 *
 * `fontFamily` entra porque `texto.familia` é token de verdade — o `corporativo`
 * troca Arial,Helvetica por Arial e todo o resto do desenho acompanha. Deixar
 * estes quatro estilos fora seria a única tipografia da página fora do tema.
 */
const ACRESCIMOS = { ou: ['fontFamily'], barramento: [], stub: ['fontFamily'], habilitador: [] };

const chaves = s => Object.fromEntries(
  String(s).split(';').filter(Boolean).map(p => {
    const i = p.indexOf('=');
    return i < 0 ? [p, true] : [p.slice(0, i), p.slice(i + 1)];
  }));

console.log('\n1 · o tema `claro` reconstrói os quatro literais do #12\n');
const claro = temaMod.carregar('claro');
for (const [nome, literal] of Object.entries(LITERAIS)) {
  const a = chaves(literal), b = chaves(claro[nome]());
  const perdidas = Object.keys(a).filter(k => a[k] !== b[k]);
  const novas = Object.keys(b).filter(k => !(k in a));
  const inesperadas = novas.filter(k => !ACRESCIMOS[nome].includes(k));
  ok(perdidas.length === 0 && inesperadas.length === 0, `${nome}`,
    perdidas.length ? `divergiu em ${perdidas.map(k => `${k}: ${a[k]} → ${b[k]}`).join(', ')}`
      : inesperadas.length ? `chave nova não prevista: ${inesperadas.join(', ')}`
        : `${Object.keys(a).length} chaves idênticas` + (novas.length ? ` + ${novas.join(', ')}` : ''));
}

console.log('\n2 · o mapeamento token → literal, uma asserção por linha\n');
const t = claro.tokens;
/**
 * ⚠️ ISTO ERA UM `console.log` E SÓ — uma seção numerada que não sabia falhar,
 * pega na revisão do #23. Ela imprimia os valores dos tokens e chamava aquilo de
 * prova; o que ela precisa afirmar é que **o valor do token é o valor que o #12
 * escreveu à mão**, e isso é uma comparação.
 */
for (const [token, valor, estilo, chave] of [
  ['tinta.forte', t.tinta.forte, 'ou', 'fontColor'],
  ['tinta.fraca', t.tinta.fraca, 'habilitador', 'strokeColor'],
  ['tinta.halo', t.tinta.halo, 'stub', 'labelBackgroundColor'],
  ['aresta.cor', t.aresta.cor, 'barramento', 'strokeColor'],
  ['aresta.espessura', t.aresta.espessura, 'barramento', 'strokeWidth'],
  ['aresta.ponta', t.aresta.ponta, 'stub', 'endArrow'],
  ['texto.aresta', t.texto.aresta, 'stub', 'fontSize'],
  ['texto.grupo + 1', t.texto.grupo + 1, 'ou', 'fontSize'],
]) {
  const noLiteral = chaves(LITERAIS[estilo])[chave];
  ok(String(valor) === String(noLiteral), `${String(token).padEnd(18)} → S_${estilo.toUpperCase()}.${chave}`,
    `token ${valor} · literal do #12 ${noLiteral}`);
}

console.log('\n3 · e no deck escuro os quatro passam no contraste — o que a troca comprou\n');
const escuro = temaMod.carregar('escuro');
const fundo = escuro.tokens.pagina.cor;
/**
 * QUAIS dos quatro o literal do #12 teria QUEBRADO no escuro — e o número está
 * escrito porque o valor da troca é ele.
 *
 * `habilitador` é o que NÃO quebraria: `#5A6C86` dá 3,18:1, um triz acima do
 * piso de grafismo. Deixar isso implícito faria a seção vender a troca melhor do
 * que ela é; a asserção abaixo cobra os três E cobra que o quarto passe, para
 * que o dia em que a paleta mudar apareça aqui em vez de sumir.
 */
const QUEBRARIAM = new Set(['ou', 'barramento', 'stub']);
for (const nome of Object.keys(LITERAIS)) {
  const antes = chaves(LITERAIS[nome]).strokeColor || chaves(LITERAIS[nome]).fontColor;
  const depois = (k => k.strokeColor || k.fontColor)(chaves(escuro[nome]()));
  const rAntes = razao(antes, fundo), rDepois = razao(depois, fundo);
  // rótulo é texto (WCAG 1.4.3) e traço é grafismo (1.4.11) — o piso do texto sai
  // de `limiarDeTexto`, que já conhece o corte de 24px/18,5px em negrito
  const piso = nome === 'ou' ? limiarDeTexto(escuro.ou()) : 3.0;
  ok(rDepois >= piso, `${nome} no escuro passa por token`,
    `${depois} = ${rDepois.toFixed(2)}:1 (piso ${piso}:1)`);
  ok((rAntes < piso) === QUEBRARIAM.has(nome),
    `e o literal do #12 ${QUEBRARIAM.has(nome) ? 'QUEBRARIA' : 'passaria'} — como esperado`,
    `${antes} = ${rAntes.toFixed(2)}:1`);
}

console.log(falhas
  ? '\n  ✗ os estilos do #12 não são reconstrutíveis a partir do tema.\n'
  : '\n  ✓ o #12 já escrevia os tokens do #13 à mão — agora escreve o nome deles.\n');
process.exit(falhas ? 1 : 0);
