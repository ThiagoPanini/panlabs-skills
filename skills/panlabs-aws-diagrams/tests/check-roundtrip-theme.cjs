#!/usr/bin/env node
'use strict';
/**
 * O TEMA VIAJA RESOLVIDO — e volta intacto pelo codec do próprio draw.io.
 *
 * O #11 provou que o modelo embutido faz round-trip byte a byte por
 * `drawio -x -f xml`, que é o app DECODIFICANDO e RE-SERIALIZANDO. Esta checagem
 * estende a prova ao `panlabsTema`, e o que está em jogo não é simetria: é a razão
 * de guardar TOKENS e não o NOME do tema.
 *
 * O #4 §7 mediu por que `style="<nome>"` no `<mxGraphModel>` é inútil — nome só
 * resolve contra o que a outra ponta tem. Um `.drawio` que guardasse `tema=claro`
 * regeneraria diferente no dia em que `light.json` mudasse, sem aviso. Guardando os
 * tokens resolvidos, o arquivo continua sendo o próprio formato de persistência.
 *
 *   node tools/check-roundtrip-theme.cjs [binario-drawio]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * O export headless falha de formas que não são falha DESTE teste: outro
 * processo draw.io pendurado na máquina derruba qualquer export posterior (ver
 * `tools/renderizar.sh`). Uma exceção crua aqui viraria um stack trace de
 * `execFileSync` no meio da suite, sem dizer o que aconteceu — então a chamada é
 * embrulhada, com uma retentativa depois de ceifar pendurado.
 */
function exportarXml(origin, destino, perfil) {
  const args = ['-a', DRAWIO, '-x', '-f', 'xml', '-o', destino, origin,
    '--no-sandbox', '--disable-gpu', '--disable-update', '--user-data-dir=' + perfil];
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    try {
      execFileSync('xvfb-run', args, { stdio: 'ignore' });
      if (fs.existsSync(destino) && fs.statSync(destino).size > 0) return true;
    } catch (e) { /* cai na retentativa */ }
    try {
      execFileSync('bash', ['-c',
        "ps -o pid,etimes -C drawio --no-headers | awk '$2>180 {print $1}' | xargs -r kill -9"],
        { stdio: 'ignore' });
    } catch (e) { /* sem processo pendurado, ótimo */ }
  }
  return false;
}

const RAIZ = path.join(__dirname, '..');
const { binario } = require(path.join(__dirname, '..', 'tools', 'drawio.cjs'));
const DRAWIO = binario(process.argv[2]);

const ENTIDADES = { '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&#xa;': '\n', '&#x9;': '\t', '&#xd;': '\r', '&amp;': '&' };
const desescapar = s => String(s).replace(/&(?:quot|#39|lt|gt|#xa|#x9|#xd|amp);/g, e => ENTIDADES[e]);
const atributo = (xml, name) => {
  const m = new RegExp(name + '="([^"]*)"').exec(xml);
  return m ? desescapar(m[1]) : null;
};

/**
 * ⚠️ A checagem GERA os arquivos que confere, em vez de esperar que alguém tenha
 * gerado antes. Enquanto ela dependia de arquivos deixados por outro passo, a
 * ausência deles saía como "pulado" e a suíte ficava verde tendo conferido zero
 * — uma checagem que não sabe falhar. Agora ela falha se conferiu nada.
 */
const VARIANTES = [
  { name: 'a-claro' }, { name: 'b-escuro' }, { name: 'c-corporativo' },
  { name: 'g-vista-logica' },
  // multi-conta: a página consolidada MAIS as de detalhe, que é onde o #12 e o
  // #13 se encontram e onde ninguém tinha medido round-trip de tema
  { name: 'h-contas-escuro' },
];

/** Quem sabe construir as variantes é `tools/generate-themes.cjs` — um lugar só. */
async function gerarVariantes() {
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [path.join(RAIZ, 'tools', 'generate-themes.cjs')], { stdio: 'ignore' });
  return path.join(RAIZ, 'output', 'themes');
}

async function main() {
  if (!fs.existsSync(DRAWIO)) {
    console.log('   draw.io headless não encontrado — round-trip pulado (premissa 8).');
    process.exit(0);
  }
  const dirVariantes = await gerarVariantes();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tema-rt-'));
  let falhou = 0, conferidos = 0;

  for (const { name } of VARIANTES) {
    const origin = path.join(dirVariantes, name + '.drawio');
    if (!fs.existsSync(origin)) { console.log(`   ✗ ${name}: .drawio ausente`); falhou = 1; continue; }
    conferidos++;
    const destino = path.join(tmp, name + '.xml');
    if (!exportarXml(origin, destino, tmp)) {
      console.log(`   ✗ ${name.padEnd(14)} o export headless não produziu XML (ver tools/renderizar.sh)`);
      falhou = 1;
      continue;
    }

    const antes = fs.readFileSync(origin, 'utf8');
    const depois = fs.readFileSync(destino, 'utf8');
    for (const attr of ['panlabsTema', 'panlabsModelo']) {
      const a = atributo(antes, attr), b = atributo(depois, attr);
      const ok = a !== null && a === b;
      if (!ok) falhou = 1;
      console.log(`   ${ok ? '✓' : '✗'} ${name.padEnd(14)} ${attr.padEnd(14)} ${String((a || '').length).padStart(5)} bytes  ${ok ? 'idêntico' : 'DIVERGIU'}`);
    }
    // e o tema tem de reconstruir: id, fundo e os grupos de token
    const t = JSON.parse(atributo(depois, 'panlabsTema') || '{}');
    const grupos = ['page', 'ink', 'text', 'aresta', 'gap', 'note', 'block', 'card'];
    const faltando = grupos.filter(g => !(g in (t.tokens || {})));
    if (faltando.length || !t.id || !t.background) {
      console.log(`   ✗ ${name}: payload incompleto (faltam ${faltando.join(', ') || 'id/fundo'})`);
      falhou = 1;
    }
    // e NÃO pode carregar metadado do arquivo fingindo ser token
    const intrusos = ['schema', 'id', 'label', 'because', 'inherits'].filter(k => k in (t.tokens || {}));
    if (intrusos.length) {
      console.log(`   ✗ ${name}: chave de identidade viajando como token (${intrusos.join(', ')})`);
      falhou = 1;
    }
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  if (!conferidos) { console.log('   ✗ nenhuma variante conferida — a checagem não mediu nada'); falhou = 1; }
  console.log(falhou ? '   ROUND-TRIP DO TEMA VERMELHO'
    : `   ✓ o tema é o seu próprio formato de persistência (${conferidos} variantes)`);
  process.exit(falhou);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
