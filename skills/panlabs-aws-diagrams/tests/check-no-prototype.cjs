#!/usr/bin/env node
'use strict';
/**
 * A árvore de produção não alcança `prototypes/` — e a checagem é de RUNTIME,
 * não de grep.
 *
 * O critério de aceite do #23 é literal: *"`node <raiz>/engine/generate.cjs <modelo>
 * --saida <x>` funciona a partir da raiz da skill, sem depender de nada dentro de
 * `prototypes/`"*. Um grep por `prototypes` acharia o caminho escrito à mão e
 * perderia o caminho montado (`path.join(dir, '..', '..')`), que é justamente
 * como todos os protótipos se referenciavam.
 *
 * Então a régua é `require.cache`: carrega o pipeline inteiro, gera cada modelo do
 * corpus e depois pergunta ao Node QUAIS arquivos ele de fato abriu. Se algum
 * estiver sob `prototypes/`, a dependência existe — não importa como foi escrita.
 *
 * A segunda metade é o oposto e é igualmente necessária: **nada de fora da árvore
 * da skill**, exceto o próprio Node. Um `require('ajv')` passaria no teste acima e
 * quebraria a premissa 7 (zero dependência de rede ou binário em runtime).
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PROTOTIPOS = path.join(RAIZ, 'prototypes');

let falhas = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) falhas++;
};

async function main() {
  // carrega TUDO o que a skill publicada expõe, e roda o pipeline de verdade
  const { gerar } = require(path.join(RAIZ, 'engine', 'generate.cjs'));
  require(path.join(RAIZ, 'validator', 'validate-geometry.cjs'));
  require(path.join(RAIZ, 'validator', 'gate.cjs'));
  require(path.join(RAIZ, 'theme', 'theme.cjs'));
  require(path.join(RAIZ, 'session', 'draw.cjs'));
  require(path.join(RAIZ, 'session', 'open.cjs'));
  require(path.join(RAIZ, 'session', 'publish.cjs'));

  const modelos = fs.readdirSync(path.join(RAIZ, 'models')).filter(f => f.endsWith('.json')).sort();
  for (const m of modelos)
    await gerar(JSON.parse(fs.readFileSync(path.join(RAIZ, 'models', m), 'utf8')));

  const carregados = Object.keys(require.cache)
    .filter(f => !f.includes(`${path.sep}node_modules${path.sep}`))
    .filter(f => f !== __filename);

  const doProto = carregados.filter(f => f.startsWith(PROTOTIPOS + path.sep));
  ok(doProto.length === 0, 'nenhum arquivo de prototypes/ foi carregado',
    doProto.length ? doProto.map(f => path.relative(RAIZ, f)).join(', ') : `${carregados.length} módulos carregados`);

  const foraDaSkill = carregados.filter(f => !f.startsWith(RAIZ + path.sep));
  ok(foraDaSkill.length === 0, 'nem nada de fora da árvore da skill (premissa 7)',
    foraDaSkill.length ? foraDaSkill.join(', ') : 'só Node e o que a skill embarca');

  // ------------------------------------------------ e os DADOS, não só o código
  //
  // `require.cache` só vê `require`. Catálogo, correções e arquivo de tema entram
  // por `readFileSync`, e um deles apontando para o protótipo passaria
  // despercebido pela primeira asserção.
  //
  // ⚠️ O `schema.json` e o `thresholds.json` NÃO aparecem nesta lista, e não é
  // buraco: os dois são lidos no topo do módulo, na CARGA — então já foram lidos
  // quando a espia entra, e a primeira asserção (`require.cache`) é quem cobre o
  // caminho deles. Um comentário anterior os citava aqui; era falso, e a revisão
  // do #23 pegou instrumentando a espia.
  const lidos = [];
  const realFs = fs.readFileSync;
  fs.readFileSync = function (p, ...resto) { lidos.push(String(p)); return realFs.call(fs, p, ...resto); };
  try {
    delete require.cache[require.resolve(path.join(RAIZ, 'catalog', 'aws-shapes.cjs'))];
    require(path.join(RAIZ, 'catalog', 'aws-shapes.cjs')).carregar();
    await gerar(JSON.parse(realFs.call(fs, path.join(RAIZ, 'models', 'web-multi-az.json'), 'utf8')),
      { tema: 'corporate' });
  } finally { fs.readFileSync = realFs; }
  // e a espia tem de ter visto ALGUMA coisa — uma espia que não observa nada
  // torna a asserção seguinte vacuamente verdadeira
  ok(lidos.length > 0, 'a espia de `readFileSync` observou leituras',
    `${new Set(lidos).size} arquivo(s) distintos`);

  const dadosDoProto = lidos.filter(p => p.startsWith(PROTOTIPOS + path.sep));
  ok(dadosDoProto.length === 0, 'nenhum ARQUIVO DE DADOS veio de prototypes/',
    dadosDoProto.length ? dadosDoProto.map(p => path.relative(RAIZ, p)).join(', ')
      : `${new Set(lidos).size} arquivo(s) lidos, todos na árvore`);

  // --------------------------------------------- a CLI, do jeito que o AC pede
  const { execFileSync } = require('child_process');
  const os = require('os');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sem-proto-'));
  const saida = path.join(tmp, 'x.drawio');
  let cli = true;
  try {
    execFileSync(process.execPath,
      [path.join(RAIZ, 'engine', 'generate.cjs'), path.join(RAIZ, 'models', 'web-multi-az.json'), '--saida', saida],
      { stdio: 'ignore', cwd: RAIZ });
  } catch (e) { cli = false; }
  ok(cli && fs.existsSync(saida) && fs.statSync(saida).size > 0,
    'node engine/generate.cjs <modelo> --saida <x> roda a partir da raiz da skill',
    cli ? `${fs.statSync(saida).size} bytes` : 'a CLI falhou');
  fs.rmSync(tmp, { recursive: true, force: true });

  console.log(falhas
    ? '\n  ✗ a árvore de produção ainda depende do protótipo.\n'
    : '\n  ✓ a árvore de produção se sustenta sozinha.\n');
  process.exit(falhas ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
