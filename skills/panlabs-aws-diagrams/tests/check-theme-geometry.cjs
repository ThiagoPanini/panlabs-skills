#!/usr/bin/env node
'use strict';
/**
 * #33 — `tools/check-geometry.cjs` passa a aceitar `--theme`.
 *
 * Hoje o laudo sempre avalia o tema padrão (`claro`), que é cego para o campo
 * `qualificador` — ele só aparece no tema `corporativo`. Sem `--theme`, o
 * validador geométrico nunca vê o que `--theme corporate` liga.
 *
 * A prova não abre o JSON do laudo (acoplaria o teste ao formato dele). Ela
 * compara STDOUT entre três chamadas:
 *
 *   · sem `--theme`                    (A, o padrão de hoje)
 *   · com `--theme light` explícito    (B, o mesmo padrão, dito por fora)
 *   · com `--theme corporate`        (C, liga o qualificador)
 *
 * A === B prova que a flag é reconhecida sem corromper os argumentos
 * posicionais (o bug de hoje: `--theme light` deixa "claro" sobrar como se
 * fosse um caminho de modelo, e o CLI tenta ler o arquivo "claro"). A ≠ C
 * prova que o tema pedido de fato chega ao motor.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'tools', 'check-geometry.cjs');
// tem `qualificador` no corpus embarcado — ver #33.
const MODEL = path.join(ROOT, 'models', 'quorum-3-az.json');

let falhas = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) falhas++;
};

function run(...flags) {
  try {
    return { codigo: 0, output: execFileSync('node', [CLI, MODEL, '--json', ...flags], { encoding: 'utf8' }) };
  } catch (e) {
    return { codigo: e.status, output: e.stdout || '', erro: e.stderr || '' };
  }
}

const semFlag = run();
const temaClaro = run('--theme', 'light');
const temaCorporativo = run('--theme', 'corporate');

ok(semFlag.codigo !== null && [0, 1].includes(semFlag.codigo),
  'sem --theme roda normalmente (linha de base)',
  `código=${semFlag.codigo} erro=${semFlag.erro || '(nenhum)'}`);

ok(temaClaro.codigo === semFlag.codigo && temaClaro.output === semFlag.output,
  '--theme light (explícito) reproduz a linha de base — não corrompe os posicionais',
  temaClaro.erro ? `stderr: ${temaClaro.erro.slice(0, 200)}` : '');

ok(temaCorporativo.output !== semFlag.output,
  '--theme corporate muda o laudo — o tema pedido chegou ao motor',
  `tamanho sem-flag=${semFlag.output.length} corporativo=${temaCorporativo.output.length}`);

console.log(falhas ? `\n  ✗ ${falhas} falha(s)` : '\n  ✓ check-geometry.cjs aceita --theme.');
process.exit(falhas ? 1 : 0);
