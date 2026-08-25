#!/usr/bin/env node
'use strict';
/**
 * O arquivo de DUAS paginas sobrevive ao codec do proprio draw.io?
 *
 *   node tools/check-roundtrip.cjs [binario-drawio]
 *
 * O #11 ja tinha fechado a incerteza 7(a) do #2 para um arquivo de uma pagina
 * so. Aqui ha tres coisas novas que aquele teste nao alcanca, e todas as tres
 * sao decisao deste ticket:
 *
 *   1. o selo sobrevive nas DUAS paginas, nao so na primeira;
 *   2. as duas copias do modelo continuam concordando depois do round-trip;
 *   3. — o que mais importa — depois de o app reescrever o arquivo, ele ainda le
 *      como INTACTO. Se a re-serializacao do app mexesse em qualquer coisa que a
 *      impressao olha, todo usuario que abrisse e salvasse o arquivo receberia
 *      um alarme falso na sessao seguinte. Alarme que dispara a toa e alarme que
 *      o usuario aprende a ignorar.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { open } = require('../session/open.cjs');
const { canonicalize } = require('../session/fingerprint.cjs');

const ROOT = path.join(__dirname, '..');
const FILE = path.join(ROOT, 'output', 'retail.drawio');
const { binary } = require(path.join(__dirname, '..', 'tools', 'drawio.cjs'));
const DRAWIO = binary(process.argv[2]);

if (!fs.existsSync(FILE)) { console.error('  rode tools/approve.cjs e tools/resume.cjs antes.'); process.exit(1); }

const antes = open(fs.readFileSync(FILE, 'utf8'));
let falhas = 0;
const diz = (label, ok, extra = '') => {
  console.log(`    ${label.padEnd(52)} ${ok ? '✓' : '✗'} ${extra}`);
  if (!ok) falhas++;
};

console.log('\n  Estatico (roda em qualquer maquina)\n');
diz('reconhecido como nosso', antes.ours, antes.howIRecognized.join(' · '));
diz('as duas paginas trazem selo', antes.pages.every(p => p.seal && p.seal.panlabsSchema), `${antes.pages.length} pagina(s)`);
diz('as copias do modelo concordam', !antes.copyConflict);
diz('todas as paginas intactas', antes.pages.every(p => p.state === 'intacto'),
  antes.pages.map(p => `${p.view}=${p.state}`).join(' '));
diz('o dossie viajou inteiro', !!(antes.session.dossier && antes.session.dossier.agreement && antes.session.dossier.candidates),
  `${(antes.session.dossier.candidates || []).length} candidata(s), ${(antes.session.dossier.findings || []).length} achado(s)`);

if (!fs.existsSync(DRAWIO)) {
  console.log(`\n  draw.io headless ausente em ${DRAWIO} — a camada do app fica de fora (premissa 8).`);
  process.exit(falhas ? 1 : 0);
}

console.log('\n  Pelo codec do proprio app (-x -f xml)\n');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sessao-rt-'));
const output = path.join(TMP, 'volta.drawio');

/**
 * O #19 achou que XML invalido faz o draw.io RENDERIZAR truncado com codigo de
 * saida 0. Aqui apareceu o irmao disso, e custou uma execucao vermelha para ser
 * entendido: sob pressao de memoria o app **exporta XML com paginas a menos** e
 * tambem sai com 0. Medido nesta maquina — o mesmo arquivo de duas paginas
 * voltou com 2 numa execucao (69.149 bytes) e com 1 na seguinte (25.588), sem
 * erro nenhum nas duas.
 *
 * A licao vale para o motor de verdade, nao so para este teste: **quem chama o
 * app tem de conferir o que voltou**, porque o codigo de saida nao conta. Por
 * isso a tentativa e repetida antes de acusar falha de projeto — senao uma
 * maquina carregada produz um vermelho que nao e sobre o codigo.
 */
let bruto = null;
for (let tentativa = 1; tentativa <= 2 && bruto === null; tentativa++) {
  try {
    execFileSync('xvfb-run', ['-a', DRAWIO, '-x', '-f', 'xml', '--no-sandbox', '--disable-gpu', '-o', output, FILE],
      { stdio: ['ignore', 'ignore', 'ignore'] });
  } catch (e) {
    console.log('    o app falhou ao exportar — nesta maquina o electron morre sob pressao de memoria.');
    fs.rmSync(TMP, { recursive: true, force: true });
    process.exit(falhas ? 1 : 0);
  }
  const readBack = fs.readFileSync(output, 'utf8');
  const pages = (readBack.match(/<diagram\b/g) || []).length;
  if (pages === antes.pages.length) { bruto = readBack; break; }
  console.log(`    ⚠ tentativa ${tentativa}: o app devolveu ${pages} de ${antes.pages.length} pagina(s), ` +
    `${readBack.length} bytes, e saiu com codigo 0. Truncou em silencio.`);
  if (tentativa === 2) bruto = readBack;
}

const depois = open(bruto);
diz('continua reconhecido', depois.ours, `host=${JSON.stringify(depois.host)}`);
diz('as duas paginas voltaram', depois.pages.length === antes.pages.length,
  `${antes.pages.length} → ${depois.pages.length}`);
diz('o selo sobreviveu nas duas', depois.pages.every(p => p.seal && p.seal.panlabsSchema));
diz('o modelo de sessao voltou identico', canonicalize(depois.session) === canonicalize(antes.session));
diz('o dossie opaco voltou identico',
  canonicalize(depois.session && depois.session.dossier) === canonicalize(antes.session.dossier));
diz('AINDA LE COMO INTACTO depois de o app reescrever',
  depois.pages.every(p => p.state === 'intacto'),
  depois.pages.map(p => `${p.view}=${p.state}`).join(' '));
console.log(`\n    bytes: ${fs.statSync(FILE).size} → ${bruto.length}` +
  `  (o app ${bruto.length === fs.statSync(FILE).size ? 'nao mudou o tamanho' : 'reescreveu o arquivo'})`);

fs.rmSync(TMP, { recursive: true, force: true });
console.log(falhas ? `\n  ✗ ${falhas} falha(s)\n` : '\n  ✓ o .drawio de duas paginas e o seu proprio formato de persistencia.\n');
process.exit(falhas ? 1 : 0);
