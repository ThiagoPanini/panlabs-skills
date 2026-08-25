#!/usr/bin/env node
'use strict';
/**
 * M2 — que granularidade de impressao serve para detectar edicao humana?
 *
 *   node tools/medir-fingerprint.cjs [binario-drawio]
 *
 * O reflexo e guardar um hash do arquivo. A medicao existe para mostrar que ele
 * nao serve, e por dois motivos distintos:
 *
 *   1. ele acusa arquivo INTOCADO — abrir e salvar no proprio draw.io reescreve
 *      o XML, e nenhum humano editou nada;
 *   2. ele nao distingue arrastar uma caixa (o modelo continua valendo) de
 *      apagar um servico (o modelo virou mentira). Sao respostas opostas.
 *
 * Dez edicoes que um humano faz de verdade, tres esquemas de impressao, e a
 * classificacao esperada de cada uma. O terceiro esquema e o adotado — e a
 * diferenca entre ele e o segundo e UM caso, que e o experimento de controle:
 * repintar uma subnet privada com o hex da publica. Elas tem o mesmo `shape` e o
 * mesmo `grIcon` (medido no catalogo do #17); a fronteira que a checagem A4.2 da
 * rubrica (#8) protege mora so na cor.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const { readPages, impressaoSemantica, appearanceFingerprint } = require('../session/fingerprint.cjs');
const { approve } = require('../session/agreement.cjs');
const { elaborate } = require('../session/elaborate.cjs');
const { draw } = require('../session/draw.cjs');

const ROOT = path.join(__dirname, '..');
const { binary } = require(path.join(__dirname, '..', 'tools', 'drawio.cjs'));
const DRAWIO = binary(process.argv[2]);

// ------------------------------------------------------------- as edicoes

/**
 * Troca dentro da PRIMEIRA celula com este id. Aqui a base e uma pagina so, entao
 * primeira e unica — o nome diz "primeira" mesmo assim, porque existe um irmao
 * deste helper em `demo-divergence.cjs` que casa a ULTIMA, e dois helpers com o
 * mesmo nome e semanticas opostas e o jeito mais barato de plantar um bug.
 */
function inFirstCell(xml, id, fn) {
  const re = new RegExp(`(<mxCell id="${id}"[\\s\\S]*?</mxCell>)`);
  const m = re.exec(xml);
  if (!m) throw new Error(`celula "${id}" nao achada`);
  return xml.replace(re, fn(m[1]));
}

const EDITS = [
  { name: 'salvar sem editar nada', expected: 'intacto', app: true,
    because: 'o codec do proprio app reescreve o arquivo; ninguem editou' },

  { name: 'arrastar uma caixa', expected: 'remanejado',
    // Ancorar em `<mxGeometry x=` e obrigatorio: um `/x="(\d+)"/` solto casa
    // dentro de `vertex="1"` e a edicao vira outra coisa. Custou uma rodada.
    faz: x => inFirstCell(x, 'processar-na-chegada',
      c => c.replace(/<mxGeometry x="(-?\d+)"/, (_, v) => `<mxGeometry x="${+v + 40}"`)) },

  { name: 'trocar a fonte de um rotulo', expected: 'remanejado',
    faz: x => inFirstCell(x, 'title', c => c.replace('fontSize=19', 'fontSize=15')) },

  { name: 'recolher um container', expected: 'remanejado',
    faz: x => inFirstCell(x, 'vpc-dados', c => c.replace('<mxCell id="vpc-dados"', '<mxCell id="vpc-dados" collapsed="1"')) },

  { name: 'reordenar celulas (ordem z)', expected: 'remanejado',
    faz: x => {
      const re = /( *<mxCell id="tratar-falha"[\s\S]*?<\/mxCell>\n)/;
      const block = re.exec(x)[1];
      return x.replace(re, '').replace(/( *<mxCell id="loja")/, block + '$1');
    } },

  { name: 'repintar subnet privada de publica', expected: 'divergente', controle: true,
    faz: x => inFirstCell(x, 'sub-app', c => c.replace('#00A4A6', '#7AA116').replace('#E6F6F7', '#F2F6E8')),
    because: 'mesma forma, mesmo grIcon — a fronteira publica/privada so existe no hex' },

  { name: 'renomear um servico', expected: 'divergente',
    faz: x => inFirstCell(x, 'reter-objeto', c => c.replace('value="S3 · zona curada"', 'value="S3 · arquivo morto"')) },

  { name: 'apagar um no', expected: 'divergente',
    faz: x => x.replace(/ *<mxCell id="papel-leitura"[\s\S]*?<\/mxCell>\n/, '') },

  { name: 'acrescentar um no', expected: 'divergente',
    faz: x => x.replace('      </root>',
      '        <mxCell id="caixa-do-humano" value="Firewall" style="rounded=0;whiteSpace=wrap;html=1;" vertex="1" parent="1">\n' +
      '          <mxGeometry x="10" y="10" width="80" height="40" as="geometry"/>\n' +
      '        </mxCell>\n      </root>') },

  { name: 'trocar o icone de um servico', expected: 'divergente',
    faz: x => inFirstCell(x, 'processar-na-chegada', c => c.replace(/resIcon=mxgraph\.aws4\.\w+/, 'resIcon=mxgraph.aws4.ec2')) },
];

// ------------------------------------------------------------- os esquemas

const shaArquivo = s => 'sha256:' + crypto.createHash('sha256').update(s, 'utf8').digest('hex');

const SCHEMAS = [
  {
    name: 'hash do arquivo inteiro',
    sealInto: xml => ({ arquivo: shaArquivo(xml) }),
    read: (xml, seal) => shaArquivo(xml) === seal.arquivo ? 'intacto' : 'divergente',
  },
  {
    name: 'semantica SEM cor + aparencia',
    sealInto: xml => { const c = readPages(xml).pages[0].celulas;
      return { s: impressaoSemantica(c, { comCor: false }), a: appearanceFingerprint(c) }; },
    read: (xml, seal) => { const c = readPages(xml).pages[0].celulas;
      if (impressaoSemantica(c, { comCor: false }) !== seal.s) return 'divergente';
      return appearanceFingerprint(c) === seal.a ? 'intacto' : 'remanejado'; },
  },
  {
    name: 'semantica COM cor + aparencia  ← adotado',
    sealInto: xml => { const c = readPages(xml).pages[0].celulas;
      return { s: impressaoSemantica(c), a: appearanceFingerprint(c) }; },
    read: (xml, seal) => { const c = readPages(xml).pages[0].celulas;
      if (impressaoSemantica(c) !== seal.s) return 'divergente';
      return appearanceFingerprint(c) === seal.a ? 'intacto' : 'remanejado'; },
  },
];

// ------------------------------------------------------------------ medida

async function main() {
  const logical = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'session', 'retail-logical.json'), 'utf8'));
  const elab = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'session', 'retail-elaboration.json'), 'utf8'));
  const technical = elaborate(approve(logical, { at: '2026-08-21' }), elab);
  const base = (await draw(technical, 'technical')).xml;

  const temApp = fs.existsSync(DRAWIO);
  const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'impressao-'));

  const selos = SCHEMAS.map(e => e.sealInto(base));
  const linhas = [];
  let bytesDoCodec = null;

  for (const ed of EDITS) {
    let depois;
    if (ed.app) {
      if (!temApp) { linhas.push({ ed, pulou: true }); continue; }
      const ent = path.join(TMP, 'e.drawio'), sai = path.join(TMP, 's.drawio');
      fs.writeFileSync(ent, base);
      execFileSync('xvfb-run', ['-a', DRAWIO, '-x', '-f', 'xml', '--no-sandbox', '--disable-gpu', '-o', sai, ent],
        { stdio: ['ignore', 'ignore', 'ignore'] });
      depois = fs.readFileSync(sai, 'utf8');
      bytesDoCodec = { antes: base.length, depois: depois.length, iguais: base === depois };
    } else {
      depois = ed.faz(base);
      if (depois === base) throw new Error(`a edicao "${ed.name}" nao mudou nada — o teste seria vazio`);
    }
    linhas.push({ ed, veredictos: SCHEMAS.map((e, i) => e.read(depois, selos[i])) });
  }

  // --------------------------------------------------------------- relatorio
  console.log('\n  Dez edicoes humanas contra tres esquemas de impressao\n');
  const larg = 34;
  console.log('    ' + 'edicao'.padEnd(larg) + 'expected'.padEnd(13) +
    SCHEMAS.map((e, i) => `[${i + 1}]`.padEnd(6)).join(''));
  console.log('    ' + '─'.repeat(larg + 13 + 6 * SCHEMAS.length));

  const erros = SCHEMAS.map(() => 0);
  for (const l of linhas) {
    if (l.pulou) { console.log(`    ${l.ed.name.padEnd(larg)}${'(precisa do app — pulada)'}`); continue; }
    const marcas = l.veredictos.map((v, i) => {
      const ok = v === l.ed.expected;
      if (!ok) erros[i]++;
      return (ok ? '✓' : '✗').padEnd(6);
    });
    console.log(`    ${l.ed.name.padEnd(larg)}${l.ed.expected.padEnd(13)}${marcas.join('')}`);
    for (const [i, v] of l.veredictos.entries())
      if (v !== l.ed.expected) console.log(`      └ [${i + 1}] disse "${v}"${l.ed.because ? ' — ' + l.ed.because : ''}`);
  }

  console.log('');
  for (const [i, e] of SCHEMAS.entries()) {
    const total = linhas.filter(l => !l.pulou).length;
    console.log(`    [${i + 1}] ${e.name.padEnd(38)} ${total - erros[i]}/${total} certo(s)`);
  }

  if (bytesDoCodec)
    console.log(`\n    Abrir e salvar sem editar: ${bytesDoCodec.antes} → ${bytesDoCodec.depois} bytes, ` +
      `arquivo ${bytesDoCodec.iguais ? 'IDENTICO' : 'DIFERENTE'}. ` +
      (bytesDoCodec.iguais ? '' : 'Hash de arquivo acusa divergencia em arquivo que ninguem editou.'));

  fs.rmSync(TMP, { recursive: true, force: true });
  const adopted = erros[SCHEMAS.length - 1];
  console.log(adopted === 0
    ? '\n  ✓ o esquema adotado classifica todas as edicoes medidas.\n'
    : `\n  ✗ o esquema adotado errou ${adopted}.\n`);
  return adopted === 0 ? 0 : 1;
}

main().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
