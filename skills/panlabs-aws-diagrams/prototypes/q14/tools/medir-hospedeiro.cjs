#!/usr/bin/env node
'use strict';
/**
 * M1 — ONDE, dentro de um `.drawio`, um metadado sobrevive?
 *
 *   node tools/medir-hospedeiro.cjs [binario-drawio]
 *
 * O #2 provou por leitura de codigo que atributo de `<object>` faz round-trip, e
 * o #11 confirmou com o binario. Nenhum dos dois testou as ALTERNATIVAS — e o
 * #14 poe tres opcoes de persistencia na mesa, entao a escolha merece medicao em
 * vez de heranca.
 *
 * Sete hospedeiros candidatos, o mesmo payload em todos, um round-trip pelo
 * codec do proprio app (`drawio -x -f xml`, que decodifica e re-serializa). O
 * que voltar, serve. O que sumir, nao.
 *
 * Mede tambem duas coisas que so aparecem com mais de uma pagina:
 *   · o metadado sobrevive na SEGUNDA pagina, ou so na primeira?
 *   · o `host` do `<mxfile>` sobrevive? (e a marca de reconhecimento fraca)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { varrer, acharTodos } = require('../sessao/impressao.cjs');

const DRAWIO = process.argv[2] || path.join(process.env.HOME, '.local/opt/drawio/squashfs-root/AppRun');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'q14-hosp-'));

// Payload com as armadilhas que o #2 §7 nomeia: quebra de linha, tab, aspas,
// `&`, `<` — tudo que a normalizacao de atributo do XML costuma comer.
const CARGA = 'linha1\nlinha2\ttab "aspas" & <tag> ç ã 100%';

const ARQUIVO = `<mxfile host="panlabs-aws-diagrams" compressed="false" mxfileAttr="${escapar(CARGA)}">
  <diagram id="p1" name="Pagina 1" diagramAttr="${escapar(CARGA)}">
    <mxGraphModel dx="0" dy="0" grid="0" pageWidth="400" pageHeight="300" modelAttr="${escapar(CARGA)}">
      <root>
        <mxCell id="0"/>
        <object id="1" label="" camadaAttr="${escapar(CARGA)}"><mxCell parent="0"/></object>
        <object id="oculto" label="" objectAttr="${escapar(CARGA)}">
          <mxCell style="text;html=1;" vertex="1" parent="1" visible="0">
            <mxGeometry x="0" y="0" width="1" height="1" as="geometry"/>
          </mxCell>
        </object>
        <UserObject id="uo" label="" userObjectAttr="${escapar(CARGA)}">
          <mxCell style="text;html=1;" vertex="1" parent="1" visible="0">
            <mxGeometry x="0" y="0" width="1" height="1" as="geometry"/>
          </mxCell>
        </UserObject>
        <mxCell id="visivel" value="uma caixa" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">
          <mxGeometry x="40" y="40" width="160" height="60" as="geometry"/>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
  <diagram id="p2" name="Pagina 2">
    <mxGraphModel dx="0" dy="0" grid="0" pageWidth="400" pageHeight="300">
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
        <object id="oculto2" label="" segundaPaginaAttr="${escapar(CARGA)}">
          <mxCell style="text;html=1;" vertex="1" parent="1" visible="0">
            <mxGeometry x="0" y="0" width="1" height="1" as="geometry"/>
          </mxCell>
        </object>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;

function escapar(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    .replace(/\n/g, '&#xa;').replace(/\t/g, '&#x9;').replace(/\r/g, '&#xd;');
}

/** Procura o atributo em qualquer elemento da arvore. */
function achar(raiz, attr) {
  const pilha = [raiz];
  while (pilha.length) {
    const n = pilha.pop();
    if (n.attrs && n.attrs[attr] !== undefined) return { valor: n.attrs[attr], em: n.nome };
    for (const f of n.filhos || []) pilha.push(f);
  }
  return null;
}

const HOSPEDEIROS = [
  ['mxfileAttr', 'atributo no <mxfile>'],
  ['diagramAttr', 'atributo no <diagram>'],
  ['modelAttr', 'atributo no <mxGraphModel>'],
  ['camadaAttr', '<object> envolvendo a CAMADA (id=1)'],
  ['objectAttr', '<object> em celula oculta'],
  ['userObjectAttr', '<UserObject> em celula oculta'],
  ['segundaPaginaAttr', '<object> oculto na SEGUNDA pagina'],
];

function main() {
  const entrada = path.join(TMP, 'sonda.drawio');
  fs.writeFileSync(entrada, ARQUIVO);

  if (!fs.existsSync(DRAWIO)) {
    console.log(`  draw.io headless ausente em ${DRAWIO} — esta medicao PRECISA do app e nao roda sem ele.`);
    console.log('  (o resto da suite roda em qualquer maquina; ver premissa 8 do #1)');
    return 0;
  }

  const saida = path.join(TMP, 'volta.drawio');
  execFileSync('xvfb-run', ['-a', DRAWIO, '-x', '-f', 'xml', '--no-sandbox', '--disable-gpu', '-o', saida, entrada],
    { stdio: ['ignore', 'ignore', 'ignore'] });
  const depois = varrer(fs.readFileSync(saida, 'utf8'));

  console.log('\n  Round-trip pelo codec do proprio draw.io (-x -f xml)\n');
  console.log('    hospedeiro                              sobreviveu  intacto');
  console.log('    ' + '─'.repeat(66));
  const resultado = [];
  for (const [attr, nome] of HOSPEDEIROS) {
    const achado = achar(depois, attr);
    const intacto = achado ? achado.valor === CARGA : false;
    resultado.push({ attr, nome, sobreviveu: !!achado, intacto });
    console.log(`    ${nome.padEnd(40)} ${(achado ? 'sim' : 'NAO').padEnd(11)} ${achado ? (intacto ? 'sim' : 'ALTERADO') : '—'}`);
  }

  const mx = acharTodos(depois, 'mxfile')[0];
  const paginas = acharTodos(depois, 'diagram');
  console.log('');
  console.log(`    host= voltou como ................. ${JSON.stringify(mx && mx.attrs.host)}`);
  console.log(`    paginas depois do round-trip ...... ${paginas.length}`);

  const vencedores = resultado.filter(r => r.sobreviveu && r.intacto);
  console.log(`\n  ${vencedores.length}/${HOSPEDEIROS.length} hospedeiros preservam o payload byte a byte.`);
  for (const r of resultado.filter(r => !r.sobreviveu || !r.intacto))
    console.log(`    ✗ ${r.nome}`);

  // O selo tem de estar num hospedeiro que sobreviveu; e o que a decisao usa.
  const escolhido = resultado.find(r => r.attr === 'objectAttr');
  const segunda = resultado.find(r => r.attr === 'segundaPaginaAttr');
  console.log('');
  console.log(`  Decisao: o selo vive em ${escolhido.sobreviveu && escolhido.intacto ? '<object> oculto — CONFIRMADO' : '??? — o hospedeiro escolhido NAO sobreviveu'}.`);
  console.log(`  Copia por pagina: ${segunda.sobreviveu && segunda.intacto ? 'viavel — a segunda pagina preserva igual' : 'INVIAVEL — so a primeira pagina preserva'}.`);

  fs.rmSync(TMP, { recursive: true, force: true });
  return (escolhido.sobreviveu && escolhido.intacto) ? 0 : 1;
}

process.exit(main());
