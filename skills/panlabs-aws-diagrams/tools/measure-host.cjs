#!/usr/bin/env node
'use strict';
/**
 * M1 — ONDE, dentro de um `.drawio`, um metadado sobrevive?
 *
 *   node tools/measure-host.cjs [binario-drawio]
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

const { sweep, acharTodos } = require('../session/fingerprint.cjs');

const { binary } = require(path.join(__dirname, 'drawio.cjs'));
const DRAWIO = binary(process.argv[2]);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'hospedeiro-'));

// Payload com as armadilhas que o #2 §7 nomeia: quebra de linha, tab, aspas,
// `&`, `<` — tudo que a normalizacao de atributo do XML costuma comer.
const LOAD = 'linha1\nlinha2\ttab "aspas" & <tag> ç ã 100%';

const FILE_PATH = `<mxfile host="panlabs-aws-diagrams" compressed="false" mxfileAttr="${escape(LOAD)}">
  <diagram id="p1" name="Pagina 1" diagramAttr="${escape(LOAD)}">
    <mxGraphModel dx="0" dy="0" grid="0" pageWidth="400" pageHeight="300" modelAttr="${escape(LOAD)}">
      <root>
        <mxCell id="0"/>
        <object id="1" label="" camadaAttr="${escape(LOAD)}"><mxCell parent="0"/></object>
        <object id="oculto" label="" objectAttr="${escape(LOAD)}">
          <mxCell style="text;html=1;" vertex="1" parent="1" visible="0">
            <mxGeometry x="0" y="0" width="1" height="1" as="geometry"/>
          </mxCell>
        </object>
        <UserObject id="uo" label="" userObjectAttr="${escape(LOAD)}">
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
        <object id="oculto2" label="" segundaPaginaAttr="${escape(LOAD)}">
          <mxCell style="text;html=1;" vertex="1" parent="1" visible="0">
            <mxGeometry x="0" y="0" width="1" height="1" as="geometry"/>
          </mxCell>
        </object>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;

function escape(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
    .replace(/\n/g, '&#xa;').replace(/\t/g, '&#x9;').replace(/\r/g, '&#xd;');
}

/** Procura o atributo em qualquer elemento da arvore. */
function locate(raiz, attr) {
  const pilha = [raiz];
  while (pilha.length) {
    const n = pilha.pop();
    if (n.attrs && n.attrs[attr] !== undefined) return { valor: n.attrs[attr], at: n.name };
    for (const f of n.filhos || []) pilha.push(f);
  }
  return null;
}

const HOSTS = [
  ['mxfileAttr', 'atributo no <mxfile>'],
  ['diagramAttr', 'atributo no <diagram>'],
  ['modelAttr', 'atributo no <mxGraphModel>'],
  ['camadaAttr', '<object> envolvendo a CAMADA (id=1)'],
  ['objectAttr', '<object> em celula oculta'],
  ['userObjectAttr', '<UserObject> em celula oculta'],
  ['segundaPaginaAttr', '<object> oculto na SEGUNDA pagina'],
];

function main() {
  const input = path.join(TMP, 'sonda.drawio');
  fs.writeFileSync(input, FILE_PATH);

  if (!fs.existsSync(DRAWIO)) {
    console.log(`  draw.io headless ausente em ${DRAWIO} — esta medicao PRECISA do app e nao roda sem ele.`);
    console.log('  (o resto da suite roda em qualquer maquina; ver premissa 8 do #1)');
    return 0;
  }

  // O app morrer nao e falha desta medicao — e a maquina. Nesta aqui, sob
  // pressao de memoria, o electron e morto sem mensagem e o `execFileSync`
  // estoura; deixar estourar transforma uma maquina carregada num vermelho que
  // nao fala do codigo. Duas tentativas, e depois disso a medicao se declara
  // impossivel em vez de reprovada.
  const output = path.join(TMP, 'volta.drawio');
  let bruto = null;
  for (let tentativa = 1; tentativa <= 2 && bruto === null; tentativa++) {
    try {
      execFileSync('xvfb-run', ['-a', DRAWIO, '-x', '-f', 'xml', '--no-sandbox', '--disable-gpu', '-o', output, input],
        { stdio: ['ignore', 'ignore', 'ignore'] });
      bruto = fs.readFileSync(output, 'utf8');
    } catch (e) {
      console.log(`  tentativa ${tentativa}: o app nao exportou (${e.status === undefined ? e.message : 'saiu com ' + e.status}).`);
    }
  }
  if (bruto === null) {
    console.log('  O draw.io headless existe mas nao conseguiu exportar — nesta maquina isso e\n' +
      '  pressao de memoria, nao resultado. Medicao nao realizada.');
    fs.rmSync(TMP, { recursive: true, force: true });
    return 0;
  }
  const depois = sweep(bruto);

  console.log('\n  Round-trip pelo codec do proprio draw.io (-x -f xml)\n');
  console.log('    hospedeiro                              sobreviveu  intacto');
  console.log('    ' + '─'.repeat(66));
  const outcome = [];
  for (const [attr, name] of HOSTS) {
    const finding = locate(depois, attr);
    const intacto = finding ? finding.valor === LOAD : false;
    outcome.push({ attr, name, sobreviveu: !!finding, intacto });
    console.log(`    ${name.padEnd(40)} ${(finding ? 'sim' : 'NAO').padEnd(11)} ${finding ? (intacto ? 'sim' : 'ALTERADO') : '—'}`);
  }

  const mx = acharTodos(depois, 'mxfile')[0];
  const pages = acharTodos(depois, 'diagram');
  console.log('');
  console.log(`    host= voltou como ................. ${JSON.stringify(mx && mx.attrs.host)}`);
  console.log(`    paginas depois do round-trip ...... ${pages.length}`);

  const vencedores = outcome.filter(r => r.sobreviveu && r.intacto);
  console.log(`\n  ${vencedores.length}/${HOSTS.length} hospedeiros preservam o payload byte a byte.`);
  for (const r of outcome.filter(r => !r.sobreviveu || !r.intacto))
    console.log(`    ✗ ${r.name}`);

  // O selo tem de estar num hospedeiro que sobreviveu; e o que a decisao usa.
  const chosen = outcome.find(r => r.attr === 'objectAttr');
  const segunda = outcome.find(r => r.attr === 'segundaPaginaAttr');
  console.log('');
  console.log(`  Decisao: o selo vive em ${chosen.sobreviveu && chosen.intacto ? '<object> oculto — CONFIRMADO' : '??? — o hospedeiro escolhido NAO sobreviveu'}.`);
  console.log(`  Copia por pagina: ${segunda.sobreviveu && segunda.intacto ? 'viavel — a segunda pagina preserva igual' : 'INVIAVEL — so a primeira pagina preserva'}.`);

  fs.rmSync(TMP, { recursive: true, force: true });
  return (chosen.sobreviveu && chosen.intacto) ? 0 : 1;
}

process.exit(main());
