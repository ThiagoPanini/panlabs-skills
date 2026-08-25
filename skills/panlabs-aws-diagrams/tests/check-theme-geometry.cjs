#!/usr/bin/env node
'use strict';
/**
 * #33 — `tools/check-geometry.cjs` passa a aceitar `--tema`.
 *
 * Hoje o laudo sempre avalia o tema padrão (`claro`), que é cego para o campo
 * `qualificador` — ele só aparece no tema `corporativo`. Sem `--tema`, o
 * validador geométrico nunca vê o que `--tema corporativo` liga.
 *
 * A prova não abre o JSON do laudo (acoplaria o teste ao formato dele). Ela
 * compara STDOUT entre três chamadas:
 *
 *   · sem `--tema`                    (A, o padrão de hoje)
 *   · com `--tema claro` explícito    (B, o mesmo padrão, dito por fora)
 *   · com `--tema corporativo`        (C, liga o qualificador)
 *
 * A === B prova que a flag é reconhecida sem corromper os argumentos
 * posicionais (o bug de hoje: `--tema claro` deixa "claro" sobrar como se
 * fosse um caminho de modelo, e o CLI tenta ler o arquivo "claro"). A ≠ C
 * prova que o tema pedido de fato chega ao motor.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const CLI = path.join(RAIZ, 'tools', 'check-geometry.cjs');
// tem `qualificador` no corpus embarcado — ver #33.
const MODELO = path.join(RAIZ, 'models', 'quorum-3-az.json');

let falhas = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) falhas++;
};

function rodar(...flags) {
  try {
    return { codigo: 0, saida: execFileSync('node', [CLI, MODELO, '--json', ...flags], { encoding: 'utf8' }) };
  } catch (e) {
    return { codigo: e.status, saida: e.stdout || '', erro: e.stderr || '' };
  }
}

const semFlag = rodar();
const temaClaro = rodar('--tema', 'light');
const temaCorporativo = rodar('--tema', 'corporate');

ok(semFlag.codigo !== null && [0, 1].includes(semFlag.codigo),
  'sem --tema roda normalmente (linha de base)',
  `código=${semFlag.codigo} erro=${semFlag.erro || '(nenhum)'}`);

ok(temaClaro.codigo === semFlag.codigo && temaClaro.saida === semFlag.saida,
  '--tema claro (explícito) reproduz a linha de base — não corrompe os posicionais',
  temaClaro.erro ? `stderr: ${temaClaro.erro.slice(0, 200)}` : '');

ok(temaCorporativo.saida !== semFlag.saida,
  '--tema corporativo muda o laudo — o tema pedido chegou ao motor',
  `tamanho sem-flag=${semFlag.saida.length} corporativo=${temaCorporativo.saida.length}`);

console.log(falhas ? `\n  ✗ ${falhas} falha(s)` : '\n  ✓ check-geometry.cjs aceita --tema.');
process.exit(falhas ? 1 : 0);
