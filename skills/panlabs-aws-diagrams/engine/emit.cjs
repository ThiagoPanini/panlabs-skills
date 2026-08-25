'use strict';
/**
 * Emission — plan -> mxGraph XML.
 *
 * This module knows nothing of ELK, nothing of the grid, nothing of AWS. It
 * receives a PLAN (an ordered list of cells with geometry already resolved) and
 * writes the file following the recipe of #2 §8. Document order is z order:
 * whatever comes first sits behind.
 *
 * The final check is not diligence: #19 found that invalid XML makes draw.io
 * render TRUNCATED with exit code 0. The renderer does not complain, so the one
 * who has to complain is the generator.
 */

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** mxUtils' htmlEntities, the same set (#2 §7.3): & < > " ' \n \t \r */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/[&<>"']/g, c => ESC[c])
    .replace(/\n/g, '&#xa;')
    .replace(/\t/g, '&#x9;')
    .replace(/\r/g, '&#xd;');
}

/** zapGremlins: control characters illegal in XML, and orphan surrogates. */
function stripGremlins(s) {
  let out = '';
  for (const ch of String(s)) {
    const c = ch.codePointAt(0);
    if ((c >= 32 || c === 9 || c === 10 || c === 13) && c !== 0xFFFF && c !== 0xFFFE) out += ch;
  }
  return out;
}

const r = n => Math.round(n);

function geometry(g, extra = '') {
  return `<mxGeometry x="${r(g.x)}" y="${r(g.y)}" width="${r(g.w)}" height="${r(g.h)}" as="geometry"${extra ? '>' + extra + '</mxGeometry>' : '/>'}`;
}

function vertex(c, ind) {
  const p = ' '.repeat(ind);
  const attrs = `id="${esc(c.id)}" value="${esc(c.label || '')}" style="${esc(c.style)}" vertex="1" parent="${esc(c.parent)}"` +
    (c.visivel === false ? ' visible="0"' : '');
  return `${p}<mxCell ${attrs}>\n${p}  ${geometry(c.geo)}\n${p}</mxCell>`;
}

/**
 * A cell with metadata. The inner `<mxCell>` carries NO id — the wrapper does
 * (#2 §7.2). An attribute name has to be an NCName: no `:`, which would become a
 * namespace.
 */
function vertexWithData(c, ind) {
  const p = ' '.repeat(ind);
  const data = Object.entries(c.data)
    .map(([k, v]) => `${k}="${esc(stripGremlins(v))}"`).join(' ');
  return `${p}<object id="${esc(c.id)}" label="${esc(c.label || '')}" ${data}>\n` +
    `${p}  <mxCell style="${esc(c.style)}" vertex="1" parent="${esc(c.parent)}"${c.visivel === false ? ' visible="0"' : ''}>\n` +
    `${p}    ${geometry(c.geo)}\n` +
    `${p}  </mxCell>\n${p}</object>`;
}

/**
 * An edge. One end may be LOOSE — with no node on the other side.
 *
 * The `E4` bus (#6) is literally that: a segment parallel to the row of accounts
 * that leaves nowhere and arrives nowhere; what enters the accounts are the
 * perpendicular stubs. In mxGraph an end with no `source`/`target` only stays
 * where it was put if the geometry carries `sourcePoint`/`targetPoint` — without
 * that the edge collapses to the origin, and draw.io does not complain.
 */
function edge(c, ind) {
  const p = ' '.repeat(ind);
  const points = (c.pontos || []).map(pt => `\n${p}      <mxPoint x="${r(pt.x)}" y="${r(pt.y)}"/>`).join('');
  const arr = points ? `\n${p}    <Array as="points">${points}\n${p}    </Array>` : '';

  const loose = c.solta || {};
  const tip = (name, x, y) =>
    `\n${p}    <mxPoint x="${r(x)}" y="${r(y)}" as="${name}"/>`;
  const looseEnds =
    (c.from ? '' : (loose.x1 !== undefined ? tip('sourcePoint', loose.x1, loose.y1) : '')) +
    (c.to ? '' : (loose.x2 !== undefined ? tip('targetPoint', loose.x2, loose.y2) : ''));

  const body = arr + looseEnds;
  const geo = body
    ? `<mxGeometry relative="1" as="geometry">${body}\n${p}  </mxGeometry>`
    : `<mxGeometry relative="1" as="geometry"/>`;

  return `${p}<mxCell id="${esc(c.id)}" value="${esc(c.label || '')}" style="${esc(c.style)}" edge="1" ` +
    `parent="${esc(c.parent)}"${c.from ? ` source="${esc(c.from)}"` : ''}${c.to ? ` target="${esc(c.to)}"` : ''}>\n` +
    `${p}  ${geo}\n${p}</mxCell>`;
}

function page(layoutPlan) {
  const body = layoutPlan.celulas.map(c =>
    c.kind === 'edge' ? edge(c, 8)
      : c.data ? vertexWithData(c, 8)
      : vertex(c, 8)).join('\n');

  return `  <diagram id="${esc(layoutPlan.id)}" name="${esc(layoutPlan.name || layoutPlan.title)}">
    <mxGraphModel dx="0" dy="0" grid="0" gridSize="10" guides="1" tooltips="1" connect="1"
        arrows="1" fold="1" page="1" pageScale="1" pageWidth="${r(layoutPlan.larg)}" pageHeight="${r(layoutPlan.alt)}"
        math="0" shadow="0"${layoutPlan.background ? ` background="${esc(layoutPlan.background)}"` : ''}>
      <root>
        <mxCell id="0"/>
        <mxCell id="1" parent="0"/>
${body}
      </root>
    </mxGraphModel>
  </diagram>`;
}

/**
 * An `<mxfile>` with N pages.
 *
 * The `D2` decomposition of #6 is not a saturation fallback: "ALWAYS emit one
 * detail view per account, alongside the consolidated one". The structure of the
 * official SRA PPTX is exactly that — slide 3 consolidated (0 connectors) and
 * slides 7–12 one account each (2 to 7 intra-account connectors). And `.drawio`
 * supports it natively: a repeated `<diagram>` is a page tab in the app.
 *
 * The id of each page is derived from the domain, never drawn at random — it is
 * what makes the file version with a clean diff (#11).
 */
function emit(plans) {
  const list = Array.isArray(plans) ? plans : [plans];
  return `<mxfile host="panlabs-aws-diagrams" compressed="false">
${list.map(page).join('\n')}
</mxfile>
`;
}

// ------------------------------------------------------------ the XML check

/**
 * A minimal well-formedness parser. It does not validate against the XSD — it
 * validates that the file is XML, which is the failure draw.io swallows in
 * silence.
 */
function checkXml(xml) {
  const errors = [];
  const stack = [];
  const re = /<\/?([A-Za-z_][\w.-]*)((?:\s+[\w.:-]+\s*=\s*"[^"]*")*)\s*(\/?)>/g;
  let m, pos = 0;

  while ((m = re.exec(xml))) {
    const between = xml.slice(pos, m.index);
    if (between.includes('<')) errors.push(`stray '<' outside a tag near offset ${pos + between.indexOf('<')}`);
    // a malformed entity (`&nbsp` with no `;`, a raw `&`) is invalid XML
    for (const raw of between.matchAll(/&(?!#\d+;|#x[0-9A-Fa-f]+;|amp;|lt;|gt;|quot;|apos;)/g))
      errors.push(`unescaped '&' in text, offset ${pos + raw.index}`);
    pos = m.index + m[0].length;

    const [, name, attrs, selfClosing] = m;
    if (m[0].startsWith('</')) {
      const top = stack.pop();
      if (top !== name) errors.push(`</${name}> closes <${top || 'nothing'}>`);
    } else if (!selfClosing) {
      stack.push(name);
    }
    // an attribute value with a raw '<' or a stray '&'
    for (const a of attrs.matchAll(/([\w.:-]+)\s*=\s*"([^"]*)"/g)) {
      if (a[2].includes('<')) errors.push(`attribute ${a[1]} contains a raw '<'`);
      for (const raw of a[2].matchAll(/&(?!#\d+;|#x[0-9A-Fa-f]+;|amp;|lt;|gt;|quot;|apos;)/g))
        errors.push(`attribute ${a[1]} has an unescaped '&'`);
    }
  }
  if (stack.length) errors.push(`tags opened and never closed: ${stack.join(', ')}`);
  return errors;
}

module.exports = { emit, esc, checkXml, stripGremlins };
