#!/usr/bin/env node
'use strict';
/**
 * PASSO 5 DO ARCO — acorda a vista logica e grava o `.drawio` que retoma.
 *
 *   node tools/approve.cjs <sessao-logica.json> --por <quem> --candidata <id> \
 *        [--em AAAA-MM-DD] [--saida x.drawio]
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

const RAIZ = path.join(__dirname, '..');
const { validar } = require(path.join(RAIZ, 'session', 'validate.cjs'));
const { aprovar, conferir } = require(path.join(RAIZ, 'session', 'agreement.cjs'));
const { desenhar } = require(path.join(RAIZ, 'session', 'draw.cjs'));

const AJUDA = `
  node tools/approve.cjs <sessao-logica.json> [opcoes]

    --por <quem>          quem aprovou            (default: "usuario")
    --candidata <id>      qual candidata venceu   (default: a de estado "escolhida",
                          ou a unica do dossie)
    --em <AAAA-MM-DD>     data do acordo          (default: hoje)
    --saida <x.drawio>    onde gravar             (default: output/<id-do-modelo>.drawio)

  Sem argumento nenhum, roda o caso do corpus (models/session/retail-logical.json).
`;

// Uma passada so, para o posicional nao poder ser confundido com o VALOR de uma
// opcao — `--por Thiago x.json` tem de deixar `x.json` como posicional e nao
// como um segundo `--por`.
const COM_VALOR = ['by', 'candidate', 'at', 'saida'];

function parse(args) {
  const opts = {}; const soltos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) { soltos.push(a); continue; }
    const name = a.slice(2);
    if (COM_VALOR.includes(name)) { opts[name] = args[++i]; continue; }
    opts[name] = true;
  }
  return { opts, soltos };
}

// Sem --candidata o agente teria de repetir uma informacao que o proprio dossie
// ja carrega. A sabatina marca a escolhida com `estado: "escolhida"` no passo 3;
// ler dali e o unico jeito de o comando nao pedir de volta o que ele recebeu.
function candidataDoDossie(sessao) {
  const cs = (sessao.dossier && sessao.dossier.candidates) || [];
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
  if (opts.help || opts.h) { console.log(AJUDA); return; }

  const entrada = soltos[0] || path.join(RAIZ, 'models', 'session', 'retail-logical.json');

  if (!fs.existsSync(entrada)) {
    console.error(`\n  ✗ nao achei ${entrada}`);
    console.error(AJUDA);
    process.exit(1);
  }

  const sessao = JSON.parse(fs.readFileSync(entrada, 'utf8'));
  console.log(`\n  APROVAR · ${sessao.title}\n`);

  const v = validar(sessao);
  for (const a of v.avisos) console.log(`  ⚠ ${a}`);
  if (!v.ok) {
    console.error(`\n  ✗ modelo invalido (${v.fase})`);
    for (const e of v.erros) console.error(`      · ${e}`);
    process.exit(1);
  }
  console.log(`  validar     ok · estagio=${sessao.stage} · ${sessao.nodes.length} nos · ${sessao.edges.length} arestas`);

  const candidate = opts.candidate || candidataDoDossie(sessao);
  if (!candidate) {
    console.error('\n  ✗ nao sei qual candidata foi aprovada.');
    console.error('    Nenhuma tem `estado: "escolhida"` no dossie e ha mais de uma.');
    console.error('    Passe --candidata <id>, ou marque a escolhida no dossie (passo 3 do arco).\n');
    process.exit(1);
  }

  // A aprovacao nao muda um no nem uma aresta — o que muda e o dossie ganhando
  // o RECORTE da projecao logica. `conferir()` reprojeta e compara depois.
  const aprovado = aprovar(sessao, {
    em: opts.at || hoje(),
    por: opts.by || 'usuario',
    candidate,
  });
  const ac = aprovado.dossier.agreement;
  console.log(`  aprovar     candidata="${candidate}" por="${ac.by}" em=${ac.at}`);
  console.log(`              impressao ${ac.fingerprint.slice(0, 23)}…  ` +
    `(${ac.snapshot.nodes.length} capacidades, ${ac.snapshot.edges.length} fluxos)`);

  const d = conferir(aprovado);
  console.log(`  conferir    ${d.ok ? '✓ o acordo confere' : '✗ ' + d.motivo}`);
  if (!d.ok) { for (const x of d.diferencas) console.error(`      · ${x.text}`); process.exit(2); }

  const r = await desenhar(aprovado, 'logical');
  for (const a of r.relatorio.avisos) console.log(`  ⚠ ${a}`);
  console.log(`  desenhar    caminho="${r.caminho}" · ${r.modelo.nodes.length} nos projetados`);

  const saida = opts.saida || path.join(RAIZ, 'output', `${sessao.id}.drawio`);
  fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
  fs.writeFileSync(saida, r.xml);
  console.log(`\n  → ${path.relative(process.cwd(), saida)}  (${r.xml.length} bytes, 1 pagina)`);
  console.log('    dentro dele: o modelo de sessao, o dossie, o acordo e as duas impressoes do desenho.');
  console.log('    A conversa pode acabar aqui. Nada do que foi decidido depende de eu lembrar.\n');
}

main().catch(e => {
  console.error(`\n  ✗ ${e.message}`);
  for (const l of e.erros || []) console.error(`      · ${l}`);
  process.exit(1);
});
