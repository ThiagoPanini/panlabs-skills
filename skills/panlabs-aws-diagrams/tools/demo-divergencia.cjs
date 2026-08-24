#!/usr/bin/env node
'use strict';
/**
 * O caso que o #14 pergunta em voz alta:
 *
 *   > O que acontece quando o humano editou o `.drawio` a mao entre as duas
 *   > sessoes — o modelo ainda vale? A skill detecta divergencia?
 *
 *   node tools/demo-divergencia.cjs
 *
 * Faz o que um humano faz de verdade num diagrama que recebeu: arrasta uma
 * caixa, renomeia um servico que estava com o nome errado, apaga um que nao
 * existe mais e desenha um que faltava. Depois grava e manda de volta.
 *
 * Sao dois arquivos de saida, e a diferenca entre eles e a decisao deste ticket:
 *
 *   saida/varejo-so-remanejado.drawio   — so arrastou. O modelo continua valendo.
 *   saida/varejo-editado-a-mao.drawio   — mexeu no conteudo. O modelo virou mentira.
 */

const fs = require('fs');
const path = require('path');

const { abrir, diferir, politica, podeRegerar } = require('../sessao/abrir.cjs');
const { desenhar } = require('../sessao/desenhar.cjs');
const { lerPaginas } = require('../sessao/impressao.cjs');

const RAIZ = path.join(__dirname, '..');
const ARQ = path.join(RAIZ, 'saida', 'varejo.drawio');

/**
 * Aplica uma troca na ULTIMA celula com este id — o arquivo tem duas paginas e o
 * mesmo id aparece nas duas; a ultima e a tecnica.
 *
 * O recorte e por INDICE, nao por `String.replace(texto, ...)`: replace com
 * padrao de string troca a PRIMEIRA ocorrencia do texto, entao ele so acertaria
 * a pagina tecnica enquanto as duas celulas diferissem em algum byte. Casar por
 * acaso e pior do que errar: funciona ate o dia em que as duas paginas
 * desenham a celula igual.
 */
function naUltimaCelula(xml, id, fn) {
  const re = new RegExp(`<mxCell id="${id}"[\\s\\S]*?</mxCell>`, 'g');
  const todas = [...xml.matchAll(re)];
  if (!todas.length) throw new Error(`celula "${id}" nao achada`);
  const m = todas[todas.length - 1];
  return xml.slice(0, m.index) + fn(m[0]) + xml.slice(m.index + m[0].length);
}

const SO_ARRASTOU = xml =>
  naUltimaCelula(xml, 'reter-objeto', c => c.replace(/<mxGeometry x="(-?\d+)" y="(-?\d+)"/,
    (_, x, y) => `<mxGeometry x="${+x + 60}" y="${+y + 24}"`));

const MEXEU_NO_CONTEUDO = xml => {
  let x = SO_ARRASTOU(xml);
  x = naUltimaCelula(x, 'tratar-falha', c => c.replace('value="SQS · fila de falha"', 'value="SQS · quarentena"'));
  // apagou o papel de leitura e a aresta que ia nele
  x = x.replace(/ *<mxCell id="papel-leitura"[\s\S]*?<\/mxCell>\n/, '');
  x = x.replace(/ *<mxCell id="a-confia"[\s\S]*?<\/mxCell>\n/, '');
  // desenhou uma caixa que ninguem perguntou, na pagina tecnica (a ultima)
  const ultimo = x.lastIndexOf('        <object id="panlabs-modelo"');
  return x.slice(0, ultimo) + (
    '        <mxCell id="waf-do-arquiteto" value="WAF" ' +
    'style="sketch=0;outlineConnect=0;fontColor=#232F3E;fillColor=#DD344C;strokeColor=#ffffff;dashed=0;' +
    'verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;aspect=fixed;' +
    'shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.waf;" vertex="1" parent="1">\n' +
    '          <mxGeometry x="40" y="700" width="78" height="78" as="geometry"/>\n' +
    '        </mxCell>\n') + x.slice(ultimo);
};

async function relatar(rotulo, arquivo) {
  console.log(`\n  ══ ${rotulo}`);
  const aberto = abrir(fs.readFileSync(arquivo, 'utf8'));
  console.log(`     reconheci: ${aberto.comoReconheci.join(' · ')}`);
  for (const p of aberto.paginas) {
    const pol = politica(p.estado);
    console.log(`     pagina vista=${p.vista}  →  ${p.estado.toUpperCase()}`);
    console.log(`       ${pol.diga}`);
    if (p.estado !== 'divergente') continue;
    const pode = podeRegerar(aberto.sessao, p.vista);
    if (!pode.pode) { console.log(`       ${pode.porque}`); continue; }
    const ref = await desenhar(aberto.sessao, p.vista);
    const d = diferir(p, lerPaginas(ref.xml).paginas[0].celulas);
    console.log(`       ${d.achados.length} diferenca(s) — ${d.absorviveis} absorvivel(is), ${d.opacas} opaca(s):`);
    for (const a of d.achados)
      console.log(`         · ${String(a.tipo).padEnd(14)} ${String(a.id).padEnd(20)} ` +
        `${a.era !== undefined && a.virou !== undefined
            ? `"${String(a.era).slice(0, 24)}" → "${String(a.virou).slice(0, 24)}"`
            : a.era !== undefined ? `era "${String(a.era).slice(0, 32)}"`
            : `veio "${String(a.virou).slice(0, 32)}"`}` +
        `  [${a.classe}${a.onde ? ': ' + a.onde : ''}]`);
  }
}

async function main() {
  if (!fs.existsSync(ARQ)) { console.error('  rode tools/aprovar.cjs e tools/retomar.cjs antes.'); process.exit(1); }
  const base = fs.readFileSync(ARQ, 'utf8');

  const a = path.join(RAIZ, 'saida', 'varejo-so-remanejado.drawio');
  const b = path.join(RAIZ, 'saida', 'varejo-editado-a-mao.drawio');
  fs.writeFileSync(a, SO_ARRASTOU(base));
  fs.writeFileSync(b, MEXEU_NO_CONTEUDO(base));

  await relatar('O humano so ARRASTOU uma caixa', a);
  await relatar('O humano MEXEU NO CONTEUDO', b);

  console.log('\n  A diferenca entre os dois nao e de grau, e de resposta:');
  console.log('  no primeiro a skill segue e avisa que regerar apaga o ajuste dele;');
  console.log('  no segundo ela para, porque nao sabe qual das duas versoes o usuario considera verdade.\n');
}

main().catch(e => { console.error(e); process.exit(1); });
