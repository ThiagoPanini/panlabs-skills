#!/usr/bin/env node
'use strict';
/**
 * Paridade de campos de folha entre `modelo@1.no`, o casaco técnico de
 * `sessao@1` e a lista que projeta um no outro — o #37.
 *
 * `qualificador`, `ou` e `habilita` existiam em `modelo@1` e não em `sessao@1`
 * até o #29 (ver `sessao/projetar.cjs`, CAMPOS_TECNICOS): quem escrevia
 * `modelo@1` direto tinha os três; quem passava pelo ARCO DE DUAS VISTAS — o
 * caminho principal do SKILL.md — perdia os três, sem erro nenhum. Nada
 * mecânico impedia a próxima divergência da mesma forma: um campo nasce em um
 * contrato e alguém esquece o outro, e o esquecimento não avisa porque
 * `additionalProperties:false` só reclama de campo A MAIS, nunca de campo QUE
 * FALTA.
 *
 * DUAS paridades, não uma — porque o incidente do #29 tinha DOIS jeitos de
 * acontecer, e um esquema batendo com o outro só prova o primeiro:
 *
 *   1. os dois ESQUEMAS divergem (`modelo@1.no` × `sessao@1.casacoTecnico`);
 *   2. os esquemas BATEM, mas `sessao/projetar.cjs` esquece de repassar um
 *      campo do casaco para o `modelo@1` projetado — o campo existe nos dois
 *      contratos e ainda assim não atravessa o arco de duas vistas, porque
 *      `CAMPOS_TECNICOS` é uma lista escrita à mão que pode discordar dos
 *      esquemas do mesmo jeito que discordou uma vez.
 *
 * A distinção não é hipotética: rodando a seção 1 pela primeira vez, ela achou
 * `camada` (#22) faltando em `casacoTecnico`. Consertado só ali, a seção 1
 * ficaria verde de novo e a seção 2 continuaria vermelha até `camada` entrar
 * também em `CAMPOS_TECNICOS` — a seção 1 sozinha nunca teria pego essa
 * segunda metade, porque só compara esquema com esquema.
 *
 * As duas comparações vêm dos arquivos de verdade — nenhuma lista copiada à
 * mão. `id` e `dentro` ficam de fora da paridade de esquema por construção:
 * em `sessao@1` os dois moram no `no` que ENVOLVE o casaco, não dentro dele —
 * não é campo perdido, é campo que mudou de nível. `tipo` e `rotulo` ficam de
 * fora da paridade de projeção pelo mesmo motivo, um nível abaixo:
 * `projetar.cjs` os copia direto, antes do laço de `CAMPOS_TECNICOS` — não
 * faltar na lista não é bug, é a lista não ser o lugar deles.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

const ESTRUTURAIS = new Set(['id', 'dentro']);
const COPIADOS_DIRETO = new Set(['tipo', 'rotulo']);

/**
 * Diferença simétrica entre dois conjuntos de propriedades, menos as `fora`.
 * Função pura — nada de fs aqui — para poder rodar duas vezes: uma contra os
 * arquivos reais, outra contra uma cópia mutilada (a prova de que ela sabe
 * falhar).
 */
function divergencias(propsA, propsB, fora = ESTRUTURAIS) {
  const a = new Set(propsA);
  const b = new Set(propsB);
  const soEmA = [...a].filter(p => !b.has(p) && !fora.has(p));
  const soEmB = [...b].filter(p => !a.has(p) && !fora.has(p));
  return { soEmA: soEmA.sort(), soEmB: soEmB.sort() };
}

let falhas = 0;
const ok = (cond, titulo, detalhe) => {
  console.log(`  ${cond ? '✓' : '✗'} ${titulo}${detalhe ? `  — ${detalhe}` : ''}`);
  if (!cond) falhas++;
};

const { CAMPOS_TECNICOS } = require(path.join(RAIZ, 'sessao', 'projetar.cjs'));

const modelo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'esquema.json'), 'utf8'));
const sessao = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sessao', 'esquema.json'), 'utf8'));

const propsNo = Object.keys(modelo.definitions.no.properties);
const propsCasaco = Object.keys(sessao.definitions.casacoTecnico.properties);

console.log('\n1 · os dois ESQUEMAS — modelo@1.no contra sessao@1.casacoTecnico\n');
console.log(`  campos de modelo@1.no:              ${propsNo.length}  (${propsNo.slice().sort().join(', ')})`);
console.log(`  campos de sessao@1.casacoTecnico:   ${propsCasaco.length}  (${propsCasaco.slice().sort().join(', ')})`);
console.log(`  estruturais, de fora por construção: ${[...ESTRUTURAIS].join(', ')}`);

const realEsquema = divergencias(propsNo, propsCasaco);
ok(realEsquema.soEmA.length === 0,
  'nenhum campo de modelo@1.no ficou de fora de casacoTecnico',
  realEsquema.soEmA.length ? realEsquema.soEmA.join(', ') : 'nenhum');
ok(realEsquema.soEmB.length === 0,
  'nenhum campo de casacoTecnico ficou de fora de modelo@1.no',
  realEsquema.soEmB.length ? realEsquema.soEmB.join(', ') : 'nenhum');

console.log('\n2 · o esquema contra quem de fato PROJETA — casacoTecnico × CAMPOS_TECNICOS\n');
console.log(`  CAMPOS_TECNICOS (projetar.cjs):     ${CAMPOS_TECNICOS.length}  (${CAMPOS_TECNICOS.slice().sort().join(', ')})`);
console.log(`  copiados direto, fora da lista:      ${[...COPIADOS_DIRETO].join(', ')}`);

const realProjecao = divergencias(propsCasaco, CAMPOS_TECNICOS, COPIADOS_DIRETO);
ok(realProjecao.soEmA.length === 0,
  'todo campo de casacoTecnico (além de tipo/rotulo) está em CAMPOS_TECNICOS — atravessa a projeção',
  realProjecao.soEmA.length ? realProjecao.soEmA.join(', ') : 'nenhum');
ok(realProjecao.soEmB.length === 0,
  'CAMPOS_TECNICOS não tem entrada que casacoTecnico não declare',
  realProjecao.soEmB.length ? realProjecao.soEmB.join(', ') : 'nenhum');

// ---------------------------------------------------------------------------
// 3 · a prova de controle — a checagem TEM de acusar quando um campo falta
//
// Mesmo formato do experimento de controle do #11 (check-fronteira) e do #14
// (check-projecao): sem isto, uma `divergencias()` que sempre devolve vazio
// ficaria verde por vacuidade, e o #17 já pagou essa lição uma vez. Provada
// uma vez sobre a paridade de esquema, a mesma função pura vale para a de
// projeção — o comportamento sob teste é `divergencias()`, não qual par de
// listas ela recebe.
console.log('\n3 · prova de controle — remover um campo de um dos lados, ela acusa\n');

const semQualificador = propsCasaco.filter(p => p !== 'qualificador');
const perdaDetectada = divergencias(propsNo, semQualificador);
ok(perdaDetectada.soEmA.includes('qualificador'),
  'CONTROLE: tirando "qualificador" do casaco simulado, a paridade de esquema acusa',
  perdaDetectada.soEmA.join(', '));

const comCampoOrfao = [...propsCasaco, 'inventado'];
const orfaoDetectado = divergencias(propsNo, comCampoOrfao);
ok(orfaoDetectado.soEmB.includes('inventado'),
  'CONTROLE: acrescentando "inventado" só no casaco simulado, a paridade de esquema acusa',
  orfaoDetectado.soEmB.join(', '));

// e o campo estrutural excluído de propósito não pode disparar sozinho —
// senão o "de fora por construção" seria decoração, não comportamento. A
// comparação é contra o resultado JÁ CONFERIDO acima, não contra zero: isolar
// exatamente o que a exclusão de "dentro" muda, sem depender de o corpus real
// estar limpo de outras divergências no momento em que isto roda.
const semDentroNoModelo = propsNo.filter(p => p !== 'dentro');
const controleEstrutural = divergencias(semDentroNoModelo, propsCasaco);
ok(!controleEstrutural.soEmA.includes('dentro') && !controleEstrutural.soEmB.includes('dentro') &&
   controleEstrutural.soEmA.length === realEsquema.soEmA.length &&
   controleEstrutural.soEmB.length === realEsquema.soEmB.length,
  'CONTROLE: tirar um campo ESTRUTURAL (dentro) não soa alarme nenhum além do que já estava lá');

// a mesma prova, do lado da PROJEÇÃO: tirar "camada" de CAMPOS_TECNICOS tem
// de acusar — é o exato incidente que a seção 2 existe para nunca mais deixar
// passar calado.
const semCamadaNaLista = CAMPOS_TECNICOS.filter(c => c !== 'camada');
const perdaNaProjecao = divergencias(propsCasaco, semCamadaNaLista, COPIADOS_DIRETO);
ok(perdaNaProjecao.soEmA.includes('camada'),
  'CONTROLE: tirando "camada" de CAMPOS_TECNICOS simulado, a paridade de projeção acusa',
  perdaNaProjecao.soEmA.join(', '));

console.log(falhas
  ? `\n  ✗ ${falhas} falha(s) — modelo@1, o casaco técnico de sessao@1 e/ou CAMPOS_TECNICOS divergem em campo de folha.\n`
  : '\n  ✓ modelo@1.no, sessao@1.casacoTecnico e CAMPOS_TECNICOS têm o mesmo vocabulário de folha, ponta a ponta.\n');
process.exit(falhas ? 1 : 0);
