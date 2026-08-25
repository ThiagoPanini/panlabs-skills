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

const { abrir } = require('../sessao/abrir.cjs');
const { canonicalizar } = require('../sessao/impressao.cjs');

const RAIZ = path.join(__dirname, '..');
const ARQ = path.join(RAIZ, 'saida', 'varejo.drawio');
const { binario } = require(path.join(__dirname, '..', 'tools', 'drawio.cjs'));
const DRAWIO = binario(process.argv[2]);

if (!fs.existsSync(ARQ)) { console.error('  rode tools/aprovar.cjs e tools/retomar.cjs antes.'); process.exit(1); }

const antes = abrir(fs.readFileSync(ARQ, 'utf8'));
let falhas = 0;
const diz = (rotulo, ok, extra = '') => {
  console.log(`    ${rotulo.padEnd(52)} ${ok ? '✓' : '✗'} ${extra}`);
  if (!ok) falhas++;
};

console.log('\n  Estatico (roda em qualquer maquina)\n');
diz('reconhecido como nosso', antes.nosso, antes.comoReconheci.join(' · '));
diz('as duas paginas trazem selo', antes.paginas.every(p => p.selo && p.selo.panlabsEsquema), `${antes.paginas.length} pagina(s)`);
diz('as copias do modelo concordam', !antes.conflitoDeCopias);
diz('todas as paginas intactas', antes.paginas.every(p => p.estado === 'intacto'),
  antes.paginas.map(p => `${p.vista}=${p.estado}`).join(' '));
diz('o dossie viajou inteiro', !!(antes.sessao.dossie && antes.sessao.dossie.acordo && antes.sessao.dossie.candidatas),
  `${(antes.sessao.dossie.candidatas || []).length} candidata(s), ${(antes.sessao.dossie.achados || []).length} achado(s)`);

if (!fs.existsSync(DRAWIO)) {
  console.log(`\n  draw.io headless ausente em ${DRAWIO} — a camada do app fica de fora (premissa 8).`);
  process.exit(falhas ? 1 : 0);
}

console.log('\n  Pelo codec do proprio app (-x -f xml)\n');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sessao-rt-'));
const saida = path.join(TMP, 'volta.drawio');

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
    execFileSync('xvfb-run', ['-a', DRAWIO, '-x', '-f', 'xml', '--no-sandbox', '--disable-gpu', '-o', saida, ARQ],
      { stdio: ['ignore', 'ignore', 'ignore'] });
  } catch (e) {
    console.log('    o app falhou ao exportar — nesta maquina o electron morre sob pressao de memoria.');
    fs.rmSync(TMP, { recursive: true, force: true });
    process.exit(falhas ? 1 : 0);
  }
  const lido = fs.readFileSync(saida, 'utf8');
  const paginas = (lido.match(/<diagram\b/g) || []).length;
  if (paginas === antes.paginas.length) { bruto = lido; break; }
  console.log(`    ⚠ tentativa ${tentativa}: o app devolveu ${paginas} de ${antes.paginas.length} pagina(s), ` +
    `${lido.length} bytes, e saiu com codigo 0. Truncou em silencio.`);
  if (tentativa === 2) bruto = lido;
}

const depois = abrir(bruto);
diz('continua reconhecido', depois.nosso, `host=${JSON.stringify(depois.host)}`);
diz('as duas paginas voltaram', depois.paginas.length === antes.paginas.length,
  `${antes.paginas.length} → ${depois.paginas.length}`);
diz('o selo sobreviveu nas duas', depois.paginas.every(p => p.selo && p.selo.panlabsEsquema));
diz('o modelo de sessao voltou identico', canonicalizar(depois.sessao) === canonicalizar(antes.sessao));
diz('o dossie opaco voltou identico',
  canonicalizar(depois.sessao && depois.sessao.dossie) === canonicalizar(antes.sessao.dossie));
diz('AINDA LE COMO INTACTO depois de o app reescrever',
  depois.paginas.every(p => p.estado === 'intacto'),
  depois.paginas.map(p => `${p.vista}=${p.estado}`).join(' '));
console.log(`\n    bytes: ${fs.statSync(ARQ).size} → ${bruto.length}` +
  `  (o app ${bruto.length === fs.statSync(ARQ).size ? 'nao mudou o tamanho' : 'reescreveu o arquivo'})`);

fs.rmSync(TMP, { recursive: true, force: true });
console.log(falhas ? `\n  ✗ ${falhas} falha(s)\n` : '\n  ✓ o .drawio de duas paginas e o seu proprio formato de persistencia.\n');
process.exit(falhas ? 1 : 0);
