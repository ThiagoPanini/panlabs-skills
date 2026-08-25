#!/usr/bin/env node
'use strict';
/**
 * O modelo viaja dentro do `.drawio` — e volta inteiro?
 *
 * O #2 provou por LEITURA DE CÓDIGO que atributo de `<object>` sobrevive ao
 * round-trip, e listou como incerteza 7(a) justamente o que não pôde testar:
 *
 *   > "não abri um arquivo gerado no app real nem fiz um round-trip de gravação
 *   >  de verdade. As duas afirmações que mais mereceriam esse teste:
 *   >  (a) preservação literal de um YAML multi-linha após editar e salvar."
 *
 * O binário headless (#9/#10) fecha essa incerteza: `drawio -x -f xml` faz o
 * app decodificar e RE-SERIALIZAR o arquivo pelo próprio codec. Se o modelo
 * embutido sobrevive a isso, o `.drawio` é o seu próprio formato de
 * persistência e não existe um segundo arquivo para dessincronizar.
 *
 *   node tools/check-roundtrip.cjs [binario-drawio]
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const { binario } = require(path.join(__dirname, '..', 'tools', 'drawio.cjs'));
const DRAWIO = binario(process.argv[2]);
const TMP = process.env.TMPDIR || '/tmp';

const DESESC = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
function desescapar(s) {
  return s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, m => DESESC[m]);
}

/** Extrai o modelo embutido no atributo `panlabsModelo` do `<object>`. */
function extrair(xml) {
  const m = /panlabsModelo="([^"]*)"/.exec(xml);
  if (!m) return null;
  return JSON.parse(desescapar(m[1]));
}

const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

let falhas = 0;
const arquivos = fs.readdirSync(path.join(RAIZ, 'saida')).filter(f => f.endsWith('.drawio'));
if (!arquivos.length) { console.log('  (nenhum .drawio em saida/ — rode o motor antes)'); process.exit(1); }

const temApp = fs.existsSync(DRAWIO);
if (!temApp) console.log(`  draw.io headless ausente em ${DRAWIO} — só a camada estática.\n`);

for (const arq of arquivos) {
  const caminho = path.join(RAIZ, 'saida', arq);
  const xml = fs.readFileSync(caminho, 'utf8');
  const nome = arq.replace(/\.drawio$/, '');
  // variantes de estilo (fluxo tracejado/animado) saem do mesmo modelo com outro
  // nome de arquivo; sem modelo correspondente não há o que comparar
  const caminhoModelo = path.join(RAIZ, 'modelo', nome + '.json');
  if (!fs.existsSync(caminhoModelo)) { console.log(`  ${arq}\n    (variante sem modelo próprio — pulada)`); continue; }
  const fonte = JSON.parse(fs.readFileSync(caminhoModelo, 'utf8'));

  // 1. estática: o que foi escrito no arquivo é o modelo de origem
  const lido = extrair(xml);
  const ok1 = lido && iguais(lido, fonte);
  console.log(`  ${arq}`);
  console.log(`    extraído do arquivo          ${ok1 ? '✓' : '✗'}`);
  if (!ok1) { falhas++; if (lido) console.log(`        difere do modelo de origem`); else console.log('        atributo panlabsModelo ausente'); }

  // 2. o app decodifica e re-serializa pelo codec dele
  if (!temApp) continue;
  const saida = path.join(TMP, `rt-${nome}.drawio`);
  try {
    execFileSync('xvfb-run', ['-a', DRAWIO, '-x', '-f', 'xml', '--no-sandbox', '--disable-gpu', '-o', saida, caminho],
      { stdio: ['ignore', 'ignore', 'ignore'] });
  } catch (e) { console.log(`    round-trip pelo app          ✗ (falhou ao exportar)`); falhas++; continue; }

  const depois = fs.readFileSync(saida, 'utf8');
  const lido2 = extrair(depois);
  const ok2 = lido2 && iguais(lido2, fonte);
  console.log(`    round-trip pelo app          ${ok2 ? '✓' : '✗'}  (${depois.length} bytes, host=${/host="([^"]*)"/.exec(depois)?.[1]})`);
  if (!ok2) { falhas++; console.log(lido2 ? '        o app alterou o modelo embutido' : '        o app comeu o atributo'); }

  // 3. o dossiê — que o motor nunca lê — também volta inteiro?
  if (fonte.dossie) {
    const ok3 = lido2 && iguais(lido2.dossie, fonte.dossie);
    console.log(`    dossiê opaco intacto         ${ok3 ? '✓' : '✗'}`);
    if (!ok3) falhas++;
  }
  fs.unlinkSync(saida);
}

console.log(falhas ? `\n  ✗ ${falhas} falha(s) de round-trip` : '\n  ✓ o modelo sobrevive ao próprio codec do draw.io.');
process.exit(falhas ? 1 : 0);
