#!/usr/bin/env node
'use strict';
/**
 * PASSO 5 DO ARCO — acorda a vista logica e grava o `.drawio` que retoma.
 *
 *   node tools/approve.cjs <sessao-logica.json> --by <quem> --candidate <id> \
 *        [--at AAAA-MM-DD] [--output x.drawio]
 *
 * Come um `session@1` no estagio logico. Sai um `.drawio` de uma pagina que
 * carrega TUDO que a proxima sessao vai precisar — o modelo, o dossie, o acordo
 * e as duas impressoes do desenho. Nao ha um segundo arquivo, e nao ha nada que
 * so exista na memoria do agente.
 *
 * ⚠️ ESTE ARQUIVO EXISTE PORQUE A ALTERNATIVA ERA PIOR.
 *
 * Ate o #29 o `SKILL.md` mandava o agente GRAVAR um driver de vinte linhas na
 * raiz da skill e rodar `node approve.cjs`. Tres coisas quebravam:
 *
 *   1. o diretorio da skill acumulava um `.cjs` por sessao, e quem instalasse a
 *      skill herdava o entulho de quem a usou antes;
 *   2. skill instalada e frequentemente SO-LEITURA — a doc oficial de autoria
 *      diz isso em voz alta —, e ali o arco simplesmente nao rodava;
 *   3. vinte linhas reescritas a cada sessao sao vinte linhas para errar. O
 *      motivo de existir um motor deterministico e nao reescrever o que ja
 *      esta certo.
 *
 * Sem argumento nenhum ele roda o caso do corpus (`retail`), que e o que a
 * camada 6 da suite exercita.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { validate } = require(path.join(ROOT, 'session', 'validate.cjs'));
const { approve, check } = require(path.join(ROOT, 'session', 'agreement.cjs'));
const { draw } = require(path.join(ROOT, 'session', 'draw.cjs'));

const HELP = `
  node tools/approve.cjs <sessao-logica.json> [opcoes]

    --by <quem>          quem aprovou            (default: "usuario")
    --candidate <id>      qual candidata venceu   (default: a de estado "escolhida",
                          ou a unica do dossie)
    --at <AAAA-MM-DD>     data do acordo          (default: hoje)
    --output <x.drawio>    onde gravar             (default: output/<id-do-modelo>.drawio)

  Sem argumento nenhum, roda o caso do corpus (models/session/retail-logical.json).
`;

// Uma passada so, para o posicional nao poder ser confundido com o VALOR de uma
// opcao — `--by Thiago x.json` tem de deixar `x.json` como posicional e nao
// como um segundo `--by`.
const WITH_VALUE = ['by', 'candidate', 'at', 'output'];

function parse(args) {
  const opts = {}; const soltos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) { soltos.push(a); continue; }
    const name = a.slice(2);
    if (WITH_VALUE.includes(name)) { opts[name] = args[++i]; continue; }
    opts[name] = true;
  }
  return { opts, soltos };
}

// Sem --candidate o agente teria de repetir uma informacao que o proprio dossie
// ja carrega. A sabatina marca a escolhida com `estado: "escolhida"` no passo 3;
// ler dali e o unico jeito de o comando nao pedir de volta o que ele recebeu.
function candidataDoDossie(session) {
  const cs = (session.dossier && session.dossier.candidates) || [];
  const chosen = cs.find(c => c.state === 'chosen');
  if (chosen) return chosen.id;
  if (cs.length === 1) return cs[0].id;
  return null;
}

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const { opts, soltos } = parse(process.argv.slice(2));
  if (opts.help || opts.h) { console.log(HELP); return; }

  const input = soltos[0] || path.join(ROOT, 'models', 'session', 'retail-logical.json');

  if (!fs.existsSync(input)) {
    console.error(`\n  ✗ nao achei ${input}`);
    console.error(HELP);
    process.exit(1);
  }

  const session = JSON.parse(fs.readFileSync(input, 'utf8'));
  console.log(`\n  APROVAR · ${session.title}\n`);

  const v = validate(session);
  for (const a of v.avisos) console.log(`  ⚠ ${a}`);
  if (!v.ok) {
    console.error(`\n  ✗ modelo invalido (${v.fase})`);
    for (const e of v.erros) console.error(`      · ${e}`);
    process.exit(1);
  }
  console.log(`  validar     ok · estagio=${session.stage} · ${session.nodes.length} nos · ${session.edges.length} arestas`);

  const candidate = opts.candidate || candidataDoDossie(session);
  if (!candidate) {
    console.error('\n  ✗ nao sei qual candidata foi aprovada.');
    console.error('    Nenhuma tem `estado: "escolhida"` no dossie e ha mais de uma.');
    console.error('    Passe --candidate <id>, ou marque a escolhida no dossie (passo 3 do arco).\n');
    process.exit(1);
  }

  // A aprovacao nao muda um no nem uma aresta — o que muda e o dossie ganhando
  // o RECORTE da projecao logica. `conferir()` reprojeta e compara depois.
  const approved = approve(session, {
    at: opts.at || hoje(),
    by: opts.by || 'usuario',
    candidate,
  });
  const ac = approved.dossier.agreement;
  console.log(`  aprovar     candidata="${candidate}" por="${ac.by}" em=${ac.at}`);
  console.log(`              impressao ${ac.fingerprint.slice(0, 23)}…  ` +
    `(${ac.snapshot.nodes.length} capacidades, ${ac.snapshot.edges.length} fluxos)`);

  const d = check(approved);
  console.log(`  conferir    ${d.ok ? '✓ o acordo confere' : '✗ ' + d.motivo}`);
  if (!d.ok) { for (const x of d.diferencas) console.error(`      · ${x.text}`); process.exit(2); }

  const r = await draw(approved, 'logical');
  for (const a of r.relatorio.avisos) console.log(`  ⚠ ${a}`);
  console.log(`  desenhar    caminho="${r.caminho}" · ${r.model.nodes.length} nos projetados`);

  const output = opts.output || path.join(ROOT, 'output', `${session.id}.drawio`);
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, r.xml);
  console.log(`\n  → ${path.relative(process.cwd(), output)}  (${r.xml.length} bytes, 1 pagina)`);
  console.log('    dentro dele: o modelo de sessao, o dossie, o acordo e as duas impressoes do desenho.');
  console.log('    A conversa pode acabar aqui. Nada do que foi decidido depende de eu lembrar.\n');
}

main().catch(e => {
  console.error(`\n  ✗ ${e.message}`);
  for (const l of e.erros || []) console.error(`      · ${l}`);
  process.exit(1);
});
