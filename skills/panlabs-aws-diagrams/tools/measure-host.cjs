#!/usr/bin/env node
'use strict';
/**
 * M1 — WHERE, inside a `.drawio`, does a piece of metadata survive?
 *
 *   node tools/measure-host.cjs [drawio-binary]
 *
 * #2 proved by reading code that an `<object>` attribute round-trips, and #11
 * confirmed it with the binary. Neither tested the ALTERNATIVES — and #14 puts
 * three persistence options on the table, so the choice deserves a measurement
 * rather than an inheritance.
 *
 * Seven candidate hosts, the same payload in all of them, one round-trip through
 * the app's own codec (`drawio -x -f xml`, which decodes and re-serialises).
 * Whatever comes back, works. Whatever vanishes, does not.
 *
 * It also measures two things that only show up with more than one page:
 *   · does the metadata survive on the SECOND page, or only on the first?
 *   · does the `<mxfile>` `host` survive? (it is the weak recognition mark)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { sweep, acharTodos } = require('../session/fingerprint.cjs');

const { binary } = require(path.join(__dirname, 'drawio.cjs'));
const DRAWIO = binary(process.argv[2]);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'host-'));

// Payload carrying the traps #2 §7 names: newline, tab, quotes, `&`, `<` —
// everything XML attribute normalisation tends to eat.
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

/** Looks for the attribute on any element of the tree. */
function locate(root, attr) {
  const stack = [root];
  while (stack.length) {
    const n = stack.pop();
    if (n.attrs && n.attrs[attr] !== undefined) return { valor: n.attrs[attr], at: n.name };
    for (const f of n.filhos || []) stack.push(f);
  }
  return null;
}

const HOSTS = [
  ['mxfileAttr', 'attribute on <mxfile>'],
  ['diagramAttr', 'attribute on <diagram>'],
  ['modelAttr', 'attribute on <mxGraphModel>'],
  ['camadaAttr', '<object> wrapping the LAYER (id=1)'],
  ['objectAttr', '<object> on a hidden cell'],
  ['userObjectAttr', '<UserObject> on a hidden cell'],
  ['segundaPaginaAttr', 'hidden <object> on the SECOND page'],
];

function main() {
  const input = path.join(TMP, 'probe.drawio');
  fs.writeFileSync(input, FILE_PATH);

  if (!fs.existsSync(DRAWIO)) {
    console.log(`  draw.io headless missing at ${DRAWIO} — this measurement NEEDS the app and does not run without it.`);
    console.log('  (the rest of the suite runs on any machine; see assumption 8 of #1)');
    return 0;
  }

  // The app dying is not a failure of this measurement — it is the machine. On
  // this one, under memory pressure, electron is killed with no message and
  // `execFileSync` throws; letting it throw turns a loaded machine into a red
  // that says nothing about the code. Two attempts, and after that the
  // measurement declares itself impossible rather than failed.
  const output = path.join(TMP, 'back.drawio');
  let raw = null;
  for (let attempt = 1; attempt <= 2 && raw === null; attempt++) {
    try {
      execFileSync('xvfb-run', ['-a', DRAWIO, '-x', '-f', 'xml', '--no-sandbox', '--disable-gpu', '-o', output, input],
        { stdio: ['ignore', 'ignore', 'ignore'] });
      raw = fs.readFileSync(output, 'utf8');
    } catch (e) {
      console.log(`  attempt ${attempt}: the app did not export (${e.status === undefined ? e.message : 'exited with ' + e.status}).`);
    }
  }
  if (raw === null) {
    console.log('  draw.io headless exists but could not export — on this machine that is\n' +
      '  memory pressure, not a result. Measurement not performed.');
    fs.rmSync(TMP, { recursive: true, force: true });
    return 0;
  }
  const after = sweep(raw);

  console.log("\n  Round-trip through draw.io's own codec (-x -f xml)\n");
  console.log('    host                                    survived    intact');
  console.log('    ' + '─'.repeat(66));
  const outcome = [];
  for (const [attr, name] of HOSTS) {
    const finding = locate(after, attr);
    const intact = finding ? finding.valor === LOAD : false;
    outcome.push({ attr, name, survived: !!finding, intact });
    console.log(`    ${name.padEnd(40)} ${(finding ? 'yes' : 'NO').padEnd(11)} ${finding ? (intact ? 'yes' : 'ALTERED') : '—'}`);
  }

  const mx = acharTodos(after, 'mxfile')[0];
  const pages = acharTodos(after, 'diagram');
  console.log('');
  console.log(`    host= came back as ................ ${JSON.stringify(mx && mx.attrs.host)}`);
  console.log(`    pages after the round-trip ........ ${pages.length}`);

  const winners = outcome.filter(r => r.survived && r.intact);
  console.log(`\n  ${winners.length}/${HOSTS.length} hosts preserve the payload byte for byte.`);
  for (const r of outcome.filter(r => !r.survived || !r.intact))
    console.log(`    ✗ ${r.name}`);

  // The seal has to live in a host that survived; that is what the decision uses.
  const chosen = outcome.find(r => r.attr === 'objectAttr');
  const second = outcome.find(r => r.attr === 'segundaPaginaAttr');
  console.log('');
  console.log(`  Decision: the seal lives in ${chosen.survived && chosen.intact ? 'a hidden <object> — CONFIRMED' : '??? — the chosen host did NOT survive'}.`);
  console.log(`  Copy per page: ${second.survived && second.intact ? 'viable — the second page preserves it the same' : 'NOT VIABLE — only the first page preserves it'}.`);

  fs.rmSync(TMP, { recursive: true, force: true });
  return (chosen.survived && chosen.intact) ? 0 : 1;
}

process.exit(main());
