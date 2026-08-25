'use strict';
/**
 * Emissão — plano -> mxGraph XML.
 *
 * Este módulo não conhece ELK, não conhece grade, não conhece AWS. Recebe um
 * PLANO (lista ordenada de células com geometria já resolvida) e escreve o
 * arquivo seguindo a receita do #2 §8. A ordem do documento é a ordem z: quem
 * vem antes fica atrás.
 *
 * A checagem final não é zelo: o #19 descobriu que XML inválido faz o draw.io
 * renderizar TRUNCADO com código de saída 0. O renderizador não reclama, então
 * quem tem de reclamar é o gerador.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** htmlEntities do mxUtils, mesmo conjunto (#2 §7.3): & < > " ' \n \t \r */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/[&<>"']/g, c => ESC[c])
    .replace(/\n/g, '&#xa;')
    .replace(/\t/g, '&#x9;')
    .replace(/\r/g, '&#xd;');
}

/** zapGremlins: caracteres de controle ilegais em XML e surrogates órfãos. */
function limparGremlins(s) {
  let out = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if ((c >= 32 || c === 9 || c === 10 || c === 13) && c !== 0xFFFF && c !== 0xFFFE) out += ch;
  }
  return out;
}

const r = n => Math.round(n);

function geometria(g, extra = '') {
  return `<mxGeometry x="${r(g.x)}" y="${r(g.y)}" width="${r(g.w)}" height="${r(g.h)}" as="geometry"${extra ? '>' + extra + '</mxGeometry>' : '/>'}`;
}

function vertice(c, ind) {
  const p = ' '.repeat(ind);
  const attrs = `id="${esc(c.id)}" value="${esc(c.rotulo || '')}" style="${esc(c.style)}" vertex="1" parent="${esc(c.pai)}"` +
    (c.visivel === false ? ' visible="0"' : '');
  return `${p}<mxCell ${attrs}>\n${p}  ${geometria(c.geo)}\n${p}</mxCell>`;
}

/**
 * Célula com metadados. O `<mxCell>` interno NÃO leva id — o wrapper carrega
 * (#2 §7.2). Nome de atributo tem de ser NCName: sem `:`, que viraria namespace.
 */
function verticeComDados(c, ind) {
  const p = ' '.repeat(ind);
  const dados = Object.entries(c.dados)
    .map(([k, v]) => `${k}="${esc(limparGremlins(v))}"`).join(' ');
  return `${p}<object id="${esc(c.id)}" label="${esc(c.rotulo || '')}" ${dados}>\n` +
    `${p}  <mxCell style="${esc(c.style)}" vertex="1" parent="${esc(c.pai)}"${c.visivel === false ? ' visible="0"' : ''}>\n` +
    `${p}    ${geometria(c.geo)}\n` +
    `${p}  </mxCell>\n${p}</object>`;
}

/**
 * Aresta. Uma ponta pode ser SOLTA — sem nó do outro lado.
 *
 * O barramento do `E4` (#6) é literalmente isso: um segmento paralelo à fileira
 * de contas que não sai de lugar nenhum nem chega em lugar nenhum; quem entra
 * nas contas são os stubs perpendiculares. No mxGraph uma ponta sem `source`/
 * `target` só fica onde foi posta se a geometria trouxer `sourcePoint`/
 * `targetPoint` — sem isso a aresta colapsa na origem, e o draw.io não reclama.
 */
function aresta(c, ind) {
  const p = ' '.repeat(ind);
  const pontos = (c.pontos || []).map(pt => `\n${p}      <mxPoint x="${r(pt.x)}" y="${r(pt.y)}"/>`).join('');
  const arr = pontos ? `\n${p}    <Array as="points">${pontos}\n${p}    </Array>` : '';

  const solta = c.solta || {};
  const ponta = (nome, x, y) =>
    `\n${p}    <mxPoint x="${r(x)}" y="${r(y)}" as="${nome}"/>`;
  const soltas =
    (c.de ? '' : (solta.x1 !== undefined ? ponta('sourcePoint', solta.x1, solta.y1) : '')) +
    (c.para ? '' : (solta.x2 !== undefined ? ponta('targetPoint', solta.x2, solta.y2) : ''));

  const corpo = arr + soltas;
  const geo = corpo
    ? `<mxGeometry relative="1" as="geometry">${corpo}\n${p}  </mxGeometry>`
    : `<mxGeometry relative="1" as="geometry"/>`;

  return `${p}<mxCell id="${esc(c.id)}" value="${esc(c.rotulo || '')}" style="${esc(c.style)}" edge="1" ` +
    `parent="${esc(c.pai)}"${c.de ? ` source="${esc(c.de)}"` : ''}${c.para ? ` target="${esc(c.para)}"` : ''}>\n` +
    `${p}  ${geo}\n${p}</mxCell>`;
}

function pagina(plano) {
  const corpo = plano.celulas.map(c =>
    c.tipo === 'aresta' ? aresta(c, 8)
      : c.dados ? verticeComDados(c, 8)
      : vertice(c, 8)).join('\n');

  return `  <diagram id="${esc(plano.id)}" name="${esc(plano.nome || plano.titulo)}">
    <mxGraphModel dx="0" dy="0" grid="0" gridSize="10" guides="1" tooltips="1" connect="1"
        arrows="1" fold="1" page="1" pageScale="1" pageWidth="${r(plano.larg)}" pageHeight="${r(plano.alt)}"
        math="0" shadow="0"${plano.fundo ? ` background="${esc(plano.fundo)}"` : ''}>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${corpo}
      </root>
    </mxGraphModel>
  </diagram>`;
}

/**
 * Um `<mxfile>` com N páginas.
 *
 * A decomposição do #6 `D2` não é fallback de saturação: "emita SEMPRE uma
 * vista de detalhe por conta, em paralelo à consolidada". A estrutura do PPTX
 * oficial do SRA é exatamente essa — slide 3 consolidado (0 conectores) e
 * slides 7–12 uma conta cada (2 a 7 conectores intra-conta). E o `.drawio`
 * suporta isso nativamente: `<diagram>` repetido é aba de página no app.
 *
 * O id de cada página é derivado do domínio, nunca sorteado — é o que faz o
 * arquivo versionar com diff limpo (#11).
 */
function emitir(planos) {
  const lista = Array.isArray(planos) ? planos : [planos];
  return `<mxfile host="panlabs-aws-diagrams" compressed="false">
${lista.map(pagina).join('\n')}
</mxfile>
`;
}

// ------------------------------------------------------- checagem do XML

/**
 * Parser mínimo de boa-formação. Não valida contra o XSD — valida que o
 * arquivo é XML, que é a falha que o draw.io engole em silêncio.
 */
function conferirXml(xml) {
  const erros = [];
  const pilha = [];
  const re = /<\/?([A-Za-z_][\w.-]*)((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  let m, pos = 0;

  while ((m = re.exec(xml))) {
    const entre = xml.slice(pos, m.index);
    if (entre.includes('<')) erros.push(`'<' solto fora de tag perto do offset ${pos + entre.indexOf('<')}`);
    // uma entidade mal formada (`&nbsp` sem `;`, `&` cru) é XML inválido
    for (const bruto of entre.matchAll(/&(?!#\d+;|#x[0-9A-Fa-f]+;|amp;|lt;|gt;|quot;|apos;)/g))
      erros.push(`'&' não escapado no texto, offset ${pos + bruto.index}`);
    pos = m.index + m[0].length;

    const [, nome, attrs, fechaSozinha] = m;
    if (m[0].startsWith('</')) {
      const topo = pilha.pop();
      if (topo !== nome) erros.push(`</${nome}> fecha <${topo || 'nada'}>`);
    } else if (!fechaSozinha) {
      pilha.push(nome);
    }
    // valor de atributo com '<' cru ou '&' solto
    for (const a of attrs.matchAll(/([\w.:-]+)\s*=\s*"([^"]*)"/g)) {
      if (a[2].includes('<')) erros.push(`atributo ${a[1]} contém '<' cru`);
      for (const bruto of a[2].matchAll(/&(?!#\d+;|#x[0-9A-Fa-f]+;|amp;|lt;|gt;|quot;|apos;)/g))
        erros.push(`atributo ${a[1]} tem '&' não escapado`);
    }
  }
  if (pilha.length) erros.push(`tags abertas e nunca fechadas: ${pilha.join(', ')}`);
  return erros;
}

module.exports = { emitir, esc, conferirXml, limparGremlins };
