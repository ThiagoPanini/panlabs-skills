#!/usr/bin/env node
'use strict';
/**
 * Paridade de campos de folha entre `modelo@1.no` e o casaco técnico de
 * `sessao@1` — o #37.
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
 * Esta checagem compara os dois conjuntos de propriedades diretamente dos
 * arquivos de esquema — não de uma lista copiada à mão, que poderia discordar
 * dos arquivos do mesmo jeito que `CAMPOS_TECNICOS` discordou do esquema uma
 * vez. `id` e `dentro` ficam de fora por construção: em `sessao@1` os dois
 * moram no `no` que ENVOLVE o casaco, não dentro dele — não é campo perdido,
 * é campo que mudou de nível.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

const ESTRUTURAIS = new Set(['id', 'dentro']);

/**
 * Diferença simétrica entre dois conjuntos de propriedades, menos as
 * ESTRUTURAIS. Função pura — nada de fs aqui — para poder rodar duas vezes:
 * uma contra os esquemas reais, outra contra uma cópia mutilada (a prova de
 * que ela sabe falhar).
 */
function divergencias(propsModelo, propsCasaco) {
  const modelo = new Set(propsModelo);
  const casaco = new Set(propsCasaco);
  const soNoModelo = [...modelo].filter(p => !casaco.has(p) && !ESTRUTURAIS.has(p));
  const soNoCasaco = [...casaco].filter(p => !modelo.has(p) && !ESTRUTURAIS.has(p));
  return { soNoModelo: soNoModelo.sort(), soNoCasaco: soNoCasaco.sort() };
}

let falhas = 0;
const ok = (cond, titulo, detalhe) => {
  console.log(`  ${cond ? '✓' : '✗'} ${titulo}${detalhe ? `  — ${detalhe}` : ''}`);
  if (!cond) falhas++;
};

const modelo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'esquema.json'), 'utf8'));
const sessao = JSON.parse(fs.readFileSync(path.join(RAIZ, 'sessao', 'esquema.json'), 'utf8'));

const propsNo = Object.keys(modelo.definitions.no.properties);
const propsCasaco = Object.keys(sessao.definitions.casacoTecnico.properties);

console.log('\n1 · o caso real — modelo@1.no contra sessao@1.casacoTecnico\n');
console.log(`  campos de modelo@1.no:              ${propsNo.length}  (${propsNo.slice().sort().join(', ')})`);
console.log(`  campos de sessao@1.casacoTecnico:   ${propsCasaco.length}  (${propsCasaco.slice().sort().join(', ')})`);
console.log(`  estruturais, de fora por construção: ${[...ESTRUTURAIS].join(', ')}`);

const real = divergencias(propsNo, propsCasaco);
ok(real.soNoModelo.length === 0,
  'nenhum campo de modelo@1.no ficou de fora de casacoTecnico',
  real.soNoModelo.length ? real.soNoModelo.join(', ') : 'nenhum');
ok(real.soNoCasaco.length === 0,
  'nenhum campo de casacoTecnico ficou de fora de modelo@1.no',
  real.soNoCasaco.length ? real.soNoCasaco.join(', ') : 'nenhum');

// ---------------------------------------------------------------------------
// 2 · a prova de controle — a checagem TEM de acusar quando um campo falta
//
// Mesmo formato do experimento de controle do #11 (check-fronteira) e do #14
// (check-projecao): sem isto, uma `divergencias()` que sempre devolve vazio
// ficaria verde por vacuidade, e o #17 já pagou essa lição uma vez.
console.log('\n2 · prova de controle — remover um campo de um dos lados, ela acusa\n');

const semQualificador = propsCasaco.filter(p => p !== 'qualificador');
const perdaDetectada = divergencias(propsNo, semQualificador);
ok(perdaDetectada.soNoModelo.includes('qualificador'),
  'CONTROLE: tirando "qualificador" do casaco simulado, a checagem acusa',
  perdaDetectada.soNoModelo.join(', '));

const comCampoOrfao = [...propsCasaco, 'inventado'];
const orfaoDetectado = divergencias(propsNo, comCampoOrfao);
ok(orfaoDetectado.soNoCasaco.includes('inventado'),
  'CONTROLE: acrescentando "inventado" só no casaco simulado, a checagem acusa',
  orfaoDetectado.soNoCasaco.join(', '));

// e o campo estrutural excluído de propósito não pode disparar sozinho —
// senão o "de fora por construção" seria decoração, não comportamento. A
// comparação é contra o resultado JÁ CONFERIDO acima (`real`), não contra
// zero: isolar exatamente o que a exclusão de "dentro" muda, sem depender de
// o corpus real estar limpo de outras divergências no momento em que isto roda.
const semDentroNoModelo = propsNo.filter(p => p !== 'dentro');
const controleEstrutural = divergencias(semDentroNoModelo, propsCasaco);
ok(!controleEstrutural.soNoModelo.includes('dentro') && !controleEstrutural.soNoCasaco.includes('dentro') &&
   controleEstrutural.soNoModelo.length === real.soNoModelo.length &&
   controleEstrutural.soNoCasaco.length === real.soNoCasaco.length,
  'CONTROLE: tirar um campo ESTRUTURAL (dentro) não soa alarme nenhum além do que já estava lá');

console.log(falhas
  ? `\n  ✗ ${falhas} falha(s) — modelo@1 e o casaco técnico de sessao@1 divergem em campo de folha.\n`
  : '\n  ✓ modelo@1.no e sessao@1.casacoTecnico têm o mesmo vocabulário de folha.\n');
process.exit(falhas ? 1 : 0);
