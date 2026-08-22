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
 * regeneraria diferente no dia em que `claro.json` mudasse, sem aviso. Guardando os
 * tokens resolvidos, o arquivo continua sendo o próprio formato de persistência.
 *
 *   node tools/check-roundtrip-tema.cjs [binario-drawio]
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const DRAWIO = process.argv[2] || path.join(os.homedir(), '.local/opt/drawio/squashfs-root/drawio');

const ENTIDADES = { '&quot;': '"', '&#39;': "'", '&lt;': '<', '&gt;': '>', '&#xa;': '\n', '&#x9;': '\t', '&#xd;': '\r', '&amp;': '&' };
const desescapar = s => String(s).replace(/&(?:quot|#39|lt|gt|#xa|#x9|#xd|amp);/g, e => ENTIDADES[e]);
const atributo = (xml, nome) => {
  const m = new RegExp(nome + '="([^"]*)"').exec(xml);
  return m ? desescapar(m[1]) : null;
};

function main() {
  if (!fs.existsSync(DRAWIO)) {
    console.log('   draw.io headless não encontrado — round-trip pulado (premissa 8).');
    process.exit(0);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'q13-rt-'));
  let falhou = 0;

  for (const nome of ['a-claro', 'b-escuro', 'c-corporativo']) {
    const origem = path.join(RAIZ, 'saida', nome + '.drawio');
    if (!fs.existsSync(origem)) { console.log(`   ${nome}: .drawio ausente, pulado`); continue; }
    const destino = path.join(tmp, nome + '.xml');
    execFileSync('xvfb-run', ['-a', DRAWIO, '-x', '-f', 'xml', '-o', destino, origem,
      '--no-sandbox', '--disable-gpu', '--disable-update'], { stdio: 'ignore' });

    const antes = fs.readFileSync(origem, 'utf8');
    const depois = fs.readFileSync(destino, 'utf8');
    for (const attr of ['panlabsTema', 'panlabsModelo']) {
      const a = atributo(antes, attr), b = atributo(depois, attr);
      const ok = a !== null && a === b;
      if (!ok) falhou = 1;
      console.log(`   ${ok ? '✓' : '✗'} ${nome.padEnd(14)} ${attr.padEnd(14)} ${String((a || '').length).padStart(5)} bytes  ${ok ? 'idêntico' : 'DIVERGIU'}`);
    }
    // e o tema tem de reconstruir: id, fundo e os grupos de token
    const t = JSON.parse(atributo(depois, 'panlabsTema') || '{}');
    const grupos = ['pagina', 'tinta', 'texto', 'aresta', 'folga', 'nota', 'bloco', 'cartao'];
    const faltando = grupos.filter(g => !(g in (t.tokens || {})));
    if (faltando.length || !t.id || !t.fundo) {
      console.log(`   ✗ ${nome}: payload incompleto (faltam ${faltando.join(', ') || 'id/fundo'})`);
      falhou = 1;
    }
    // e NÃO pode carregar metadado do arquivo fingindo ser token
    const intrusos = ['esquema', 'id', 'rotulo', 'porque', 'herda'].filter(k => k in (t.tokens || {}));
    if (intrusos.length) {
      console.log(`   ✗ ${nome}: chave de identidade viajando como token (${intrusos.join(', ')})`);
      falhou = 1;
    }
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(falhou ? '   ROUND-TRIP DO TEMA VERMELHO' : '   ✓ o tema é o seu próprio formato de persistência');
  process.exit(falhou);
}

if (require.main === module) main();
