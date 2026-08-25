#!/usr/bin/env node
'use strict';
/**
 * Paridade de campos de folha entre `model@1.no`, o casaco técnico de
 * `session@1` e a lista que projeta um no outro — o #37.
 *
 * `qualificador`, `ou` e `habilita` existiam em `model@1` e não em `session@1`
 * até o #29 (ver `session/project.cjs`, CAMPOS_TECNICOS): quem escrevia
 * `model@1` direto tinha os três; quem passava pelo ARCO DE DUAS VISTAS — o
 * caminho principal do SKILL.md — perdia os três, sem erro nenhum. Nada
 * mecânico impedia a próxima divergência da mesma forma: um campo nasce em um
 * contrato e alguém esquece o outro, e o esquecimento não avisa porque
 * `additionalProperties:false` só reclama de campo A MAIS, nunca de campo QUE
 * FALTA.
 *
 * DUAS paridades, não uma — porque o incidente do #29 tinha DOIS jeitos de
 * acontecer, e um esquema batendo com o outro só prova o primeiro:
 *
 *   1. os dois ESQUEMAS divergem (`model@1.no` × `session@1.casacoTecnico`);
 *   2. os esquemas BATEM, mas `session/project.cjs` esquece de repassar um
 *      campo do casaco para o `model@1` projetado — o campo existe nos dois
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
 * em `session@1` os dois moram no `no` que ENVOLVE o casaco, não dentro dele —
 * não é campo perdido, é campo que mudou de nível. `tipo` e `rotulo` ficam de
 * fora da paridade de projeção pelo mesmo motivo, um nível abaixo:
 * `project.cjs` os copia direto, antes do laço de `CAMPOS_TECNICOS` — não
 * faltar na lista não é bug, é a lista não ser o lugar deles.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const STRUCTURAL = new Set(['id', 'inside']);
const COPIED_VERBATIM = new Set(['kind', 'label']);

/**
 * Diferença simétrica entre dois conjuntos de propriedades, menos as `fora`.
 * Função pura — nada de fs aqui — para poder rodar duas vezes: uma contra os
 * arquivos reais, outra contra uma cópia mutilada (a prova de que ela sabe
 * falhar).
 */
function divergences(propsA, propsB, fora = STRUCTURAL) {
  const a = new Set(propsA);
  const b = new Set(propsB);
  const soEmA = [...a].filter(p => !b.has(p) && !fora.has(p));
  const soEmB = [...b].filter(p => !a.has(p) && !fora.has(p));
  return { soEmA: soEmA.sort(), soEmB: soEmB.sort() };
}

let falhas = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) falhas++;
};

const { TECHNICAL_FIELDS } = require(path.join(ROOT, 'session', 'project.cjs'));

const model = JSON.parse(fs.readFileSync(path.join(ROOT, 'schema.json'), 'utf8'));
const session = JSON.parse(fs.readFileSync(path.join(ROOT, 'session', 'schema.json'), 'utf8'));

const nodeProps = Object.keys(model.definitions.node.properties);
const propsCasaco = Object.keys(session.definitions.technicalFacet.properties);

console.log('\n1 · os dois ESQUEMAS — model@1.no contra session@1.casacoTecnico\n');
console.log(`  campos de model@1.no:              ${nodeProps.length}  (${nodeProps.slice().sort().join(', ')})`);
console.log(`  campos de session@1.casacoTecnico:   ${propsCasaco.length}  (${propsCasaco.slice().sort().join(', ')})`);
console.log(`  estruturais, de fora por construção: ${[...STRUCTURAL].join(', ')}`);

const realEsquema = divergences(nodeProps, propsCasaco);
ok(realEsquema.soEmA.length === 0,
  'nenhum campo de model@1.no ficou de fora de casacoTecnico',
  realEsquema.soEmA.length ? realEsquema.soEmA.join(', ') : 'none');
ok(realEsquema.soEmB.length === 0,
  'nenhum campo de casacoTecnico ficou de fora de model@1.no',
  realEsquema.soEmB.length ? realEsquema.soEmB.join(', ') : 'none');

console.log('\n2 · o esquema contra quem de fato PROJETA — casacoTecnico × CAMPOS_TECNICOS\n');
console.log(`  CAMPOS_TECNICOS (project.cjs):     ${TECHNICAL_FIELDS.length}  (${TECHNICAL_FIELDS.slice().sort().join(', ')})`);
console.log(`  copiados direto, fora da lista:      ${[...COPIED_VERBATIM].join(', ')}`);

const realProjection = divergences(propsCasaco, TECHNICAL_FIELDS, COPIED_VERBATIM);
ok(realProjection.soEmA.length === 0,
  'todo campo de casacoTecnico (além de tipo/rotulo) está em CAMPOS_TECNICOS — atravessa a projeção',
  realProjection.soEmA.length ? realProjection.soEmA.join(', ') : 'none');
ok(realProjection.soEmB.length === 0,
  'CAMPOS_TECNICOS não tem entrada que casacoTecnico não declare',
  realProjection.soEmB.length ? realProjection.soEmB.join(', ') : 'none');

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

const semQualificador = propsCasaco.filter(p => p !== 'qualifier');
const lossDetected = divergences(nodeProps, semQualificador);
ok(lossDetected.soEmA.includes('qualifier'),
  'CONTROLE: tirando "qualificador" do casaco simulado, a paridade de esquema acusa',
  lossDetected.soEmA.join(', '));

const withOrphanField = [...propsCasaco, 'inventado'];
const orphanDetected = divergences(nodeProps, withOrphanField);
ok(orphanDetected.soEmB.includes('inventado'),
  'CONTROLE: acrescentando "inventado" só no casaco simulado, a paridade de esquema acusa',
  orphanDetected.soEmB.join(', '));

// e o campo estrutural excluído de propósito não pode disparar sozinho —
// senão o "de fora por construção" seria decoração, não comportamento. A
// comparação é contra o resultado JÁ CONFERIDO acima, não contra zero: isolar
// exatamente o que a exclusão de "dentro" muda, sem depender de o corpus real
// estar limpo de outras divergências no momento em que isto roda.
const semDentroNoModelo = nodeProps.filter(p => p !== 'inside');
const controleEstrutural = divergences(semDentroNoModelo, propsCasaco);
ok(!controleEstrutural.soEmA.includes('inside') && !controleEstrutural.soEmB.includes('inside') &&
   controleEstrutural.soEmA.length === realEsquema.soEmA.length &&
   controleEstrutural.soEmB.length === realEsquema.soEmB.length,
  'CONTROLE: tirar um campo ESTRUTURAL (dentro) não soa alarme nenhum além do que já estava lá');

// a mesma prova, do lado da PROJEÇÃO: tirar "camada" de CAMPOS_TECNICOS tem
// de acusar — é o exato incidente que a seção 2 existe para nunca mais deixar
// passar calado.
const withoutLayerInList = TECHNICAL_FIELDS.filter(c => c !== 'layer');
const lossInProjection = divergences(propsCasaco, withoutLayerInList, COPIED_VERBATIM);
ok(lossInProjection.soEmA.includes('layer'),
  'CONTROLE: tirando "camada" de CAMPOS_TECNICOS simulado, a paridade de projeção acusa',
  lossInProjection.soEmA.join(', '));

console.log(falhas
  ? `\n  ✗ ${falhas} falha(s) — model@1, o casaco técnico de session@1 e/ou CAMPOS_TECNICOS divergem em campo de folha.\n`
  : '\n  ✓ model@1.no, session@1.casacoTecnico e CAMPOS_TECNICOS têm o mesmo vocabulário de folha, ponta a ponta.\n');
process.exit(falhas ? 1 : 0);
