'use strict';
/**
 * Fingerprints — what answers "did the human touch the file?".
 *
 * There are THREE fingerprints, and the reason there are three is #14's question:
 *
 *   > What happens when the human edited the `.drawio` by hand between the two
 *   > sessions — is the model still valid? Does the skill detect divergence?
 *
 * "Detecting divergence" with a hash of the whole file does not work, and this is
 * MEASURED in `workbench/panlabs-aws-diagrams/tests/check-fingerprint.cjs`, not assumed: opening and saving in
 * draw.io itself, without touching anything, already rewrites the XML. A file hash
 * flags an untouched file. And, worse, it does not distinguish moving a box
 * (harmless) from deleting a service (the model became a lie).
 *
 *   DRAWING fingerprint, semantic    — what the cells ASSERT: shape identity,
 *                                      label, parent, edge endpoints.
 *   DRAWING fingerprint, appearance  — how they APPEAR: geometry, z-order and
 *                                      everything else in the style.
 *   AGREEMENT fingerprint            — the logical projection that was approved.
 *
 * The first two separate "touched" from "just tidied up". The third is a different
 * question: not "did the human edit the file", but "does the technical elaboration
 * still serve what was approved".
 *
 * The boundary between the first two is not geometry against everything else — it
 * is ASSERTION against APPEARANCE, and the difference cost a measurement: changing
 * the font or collapsing a container does not touch a single coordinate, and in the
 * first version the file came out INTACT — meaning "regenerate at will" — over an
 * adjustment someone made by hand.
 *
 * ---------------------------------------------------------------------------
 * COLOR AND SEMANTICS IN AN AWS DIAGRAM.
 *
 * The reflex is to classify color as cosmetic. Measured against the #17 catalog,
 * that is wrong: `Public subnet` and `Private subnet` have the SAME `shape` and the
 * SAME `grIcon` (`mxgraph.aws4.group` + `group_security_group`) and differ ONLY in
 * hex (green #7AA116 against turquoise #00A4A6). The public/private boundary — the
 * exact one the rubric's A4.2 check (#8) exists to protect — lives in the color and
 * nowhere else. A fingerprint that ignores color would let someone repaint a
 * private subnet as public and still call the file untouched.
 *
 * That is why the semantic slice of the style includes `strokeColor` and
 * `fillColor`. The control experiment in `workbench/panlabs-aws-diagrams/tests/check-fingerprint.cjs` proves that
 * the slice without color lets this case slip through.
 */

const crypto = require('crypto');
const path = require('path');
const { esc, checkXml, stripGremlins } = require(path.join(__dirname, '..', 'engine', 'emit.cjs'));

const sha = s => 'sha256:' + crypto.createHash('sha256').update(s, 'utf8').digest('hex');

/** JSON with keys in order — the hash only holds if the serialization is unique. */
function canonicalize(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canonicalize).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + canonicalize(v[k])).join(',') + '}';
}

// --------------------------------------------------------------- XML -> cells

const UNESC = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
function unescape(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, m => UNESC[m]);
}

/**
 * XML sweep good enough for `.drawio`. Not a general parser: there is no DTD,
 * namespace, or mixed text in an mxfile. It has to tolerate what the app's own
 * codec writes back, which differs from what the engine wrote — attribute order,
 * quoting, a tag that closes itself.
 */
function sweep(xml) {
  const root = { name: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/([A-Za-z_][\w.-]*)\s*>|<([A-Za-z_][\w.-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith('<!') || m[0].startsWith('<?')) continue;
    if (m[1]) { if (stack.length > 1) stack.pop(); continue; }
    const attrs = {};
    for (const a of String(m[3] || '').matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
      attrs[a[1]] = unescape(a[2] !== undefined ? a[2] : a[3]);
    const node = { name: m[2], attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!m[4]) stack.push(node);
  }
  return root;
}

function findAll(node, name, out = []) {
  for (const f of node.children) { if (f.name === name) out.push(f); findAll(f, name, out); }
  return out;
}

const PREFIX = 'panlabs';
const SEAL_ID = 'panlabs-modelo';

/**
 * Reads the pages of a `.drawio`. Each page becomes `{ id, name, seal, cells }`.
 * The seal cell does NOT enter `cells`: it carries the drawing's own fingerprint,
 * and a fingerprint that includes itself never settles.
 */
function readPages(xml) {
  const root = sweep(xml);
  const mxfile = findAll(root, 'mxfile')[0];
  const pages = [];

  for (const diagram of findAll(root, 'diagram')) {
    const model = findAll(diagram, 'mxGraphModel')[0];
    const cells = [];
    let seal = null;

    const container = model ? findAll(model, 'root')[0] : null;
    for (const child of (container ? container.children : [])) {
      let id, value, data = null, mx;
      if (child.name === 'object' || child.name === 'UserObject') {
        id = child.attrs.id;
        value = child.attrs.label;
        data = child.attrs;
        mx = child.children.find(f => f.name === 'mxCell');
      } else if (child.name === 'mxCell') {
        id = child.attrs.id; value = child.attrs.value; mx = child;
      } else continue;
      if (!mx) continue;

      // The seal identifies itself by id OR by the schema attribute — and nothing
      // else. Accepting any attribute starting with "panlabs" would open a way for
      // a cell to VANISH from the fingerprints: naming any attribute `panlabsX`
      // would let that cell's edit slip by unnoticed. In a divergence detector
      // that is not a detail.
      if (id === SEAL_ID || (data && data.panlabsSchema !== undefined)) {
        seal = {};
        for (const [k, v] of Object.entries(data || {})) if (k.startsWith(PREFIX)) seal[k] = v;
        continue;
      }
      if (id === '0' || id === '1') continue;

      const geo = mx.children.find(f => f.name === 'mxGeometry');
      const points = geo ? findAll(geo, 'mxPoint').map(p => ({ x: +p.attrs.x || 0, y: +p.attrs.y || 0 })) : [];
      cells.push({
        id,
        value: value === undefined ? '' : value,
        style: mx.attrs.style || '',
        parent: mx.attrs.parent,
        from: mx.attrs.source, to: mx.attrs.target,
        edge: mx.attrs.edge === '1',
        visible: mx.attrs.visible !== '0',
        // `collapsed` is neither style nor geometry, and a collapsed container hides
        // what is inside it. It stays in the appearance fingerprint: whoever
        // collapsed it wants the drawing this way, and regenerating over it would
        // undo that.
        collapsed: mx.attrs.collapsed === '1',
        geo: geo ? { x: +geo.attrs.x || 0, y: +geo.attrs.y || 0, w: +geo.attrs.width || 0, h: +geo.attrs.height || 0 } : null,
        points,
      });
    }
    pages.push({ id: diagram.attrs.id, name: diagram.attrs.name, seal, cells });
  }
  return { host: mxfile ? mxfile.attrs.host : undefined, pages };
}

// ------------------------------------------------------------- the fingerprints

const styleKeys = s => {
  const out = {};
  for (const p of String(s).split(';')) {
    if (!p) continue;
    const i = p.indexOf('=');
    if (i < 0) out[p] = '1'; else out[p.slice(0, i)] = p.slice(i + 1);
  }
  return out;
};

/** What the style ASSERTS — shape identity and color, which in AWS carries the boundary. */
const SEMANTIC_VERTEX = ['shape', 'resIcon', 'grIcon', 'container', 'strokeColor', 'fillColor', 'dashed'];
/** On an edge, color is decoration; the arrowhead is an assertion of direction. */
const SEMANTIC_EDGE = ['startArrow', 'endArrow', 'startFill', 'endFill'];

function semanticSlice(c, withColor = true) {
  const k = styleKeys(c.style);
  const keys = (c.edge ? SEMANTIC_EDGE : SEMANTIC_VERTEX)
    .filter(x => withColor || !/Color$/.test(x));
  const shape = {};
  for (const x of keys) if (k[x] !== undefined) shape[x] = k[x];
  return {
    id: c.id, value: c.value, parent: c.parent, edge: c.edge,
    from: c.from, to: c.to, visible: c.visible, shape,
  };
}

/**
 * Everything that is NOT assertion: geometry, order in the document (which is the
 * z-order) and everything else in the style.
 *
 * The first version called this the "geometric fingerprint" and only looked at
 * x/y/w/h. The measurement in `workbench/panlabs-aws-diagrams/tests/check-fingerprint.cjs` brought that down:
 * changing the font or collapsing a container does not touch a single coordinate,
 * and the file came out as INTACT — meaning "regenerate at will" — silently
 * discarding the human's adjustment.
 *
 * The right boundary is not geometry against everything else. It is **what the
 * cell ASSERTS** against **how it APPEARS**. Two different questions, two hashes:
 * the assertion changed -> the model became a lie; only the appearance changed ->
 * someone tidied the drawing and regenerating erases their work.
 */
function appearanceSlice(c, i) {
  const r = n => Math.round(n);
  const k = styleKeys(c.style);
  const semanticKeys = new Set(c.edge ? SEMANTIC_EDGE : SEMANTIC_VERTEX);
  const rest = {};
  for (const [key, v] of Object.entries(k)) if (!semanticKeys.has(key)) rest[key] = v;
  return {
    id: c.id,
    // z-order = position AMONG SIBLINGS, not index in the flat list. See
    // `appearanceFingerprint`, which is what computes the number.
    zOrder: i,
    parent: c.parent === undefined || c.parent === null ? null : String(c.parent),
    collapsed: !!c.collapsed,
    geo: c.geo ? { x: r(c.geo.x), y: r(c.geo.y), w: r(c.geo.w), h: r(c.geo.h) } : null,
    points: c.points.map(p => ({ x: r(p.x), y: r(p.y) })),
    rest,
  };
}

const sortBy = cs => [...cs].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function semanticFingerprint(cells, opts = {}) {
  return sha(canonicalize(sortBy(cells).map(c => semanticSlice(c, opts.withColor !== false))));
}

/**
 * Document order is z-order, so it enters BEFORE sorting by id.
 *
 * WARNING: the order that counts is AMONG SIBLINGS, not the index in the flat
 * list — fixed in the #23 recertification, with measurement.
 *
 * In mxGraph the z-order IS the order of children inside their parent: whoever
 * comes later in that parent's child list sits on top. The absolute index in the
 * serialization is a different thing — it is the order in which the generator
 * wrote the cells to the file, which can change without anything ending up on top
 * of anything else.
 *
 * While the engine had a single path, the two numbers moved together and the
 * difference did not show. With the multi-account path from #12, the engine emits
 * in blocks (OU labels, then accounts, then edges, then enablers) and draw.io's own
 * codec rewrites depth-first — MEASURED: opening and saving the three-account
 * technical view swaps 22 positions in the flat list and ZERO in sibling order,
 * across all 7 parents. With the absolute index, a file nobody touched read as
 * `moved`, which is the skill warning "regenerating erases your adjustment" over an
 * adjustment that does not exist.
 *
 * The control case is still kept: `workbench/panlabs-aws-diagrams/tests/check-fingerprint.cjs` moves a cell to
 * another position AMONG SIBLINGS and requires `moved`.
 */
function appearanceFingerprint(cells) {
  const siblingIndex = new Map();
  const withOrder = cells.map(c => {
    const key = c.parent === undefined || c.parent === null ? '?' : String(c.parent);
    const n = siblingIndex.get(key) || 0;
    siblingIndex.set(key, n + 1);
    return { c, i: n };
  });
  withOrder.sort((a, b) => a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0);
  return sha(canonicalize(withOrder.map(({ c, i }) => appearanceSlice(c, i))));
}

/**
 * REWRITE THE SEAL ON EVERY PAGE — a single place, because these are two
 * operations with the same mechanics and the same invariant.
 *
 * `save.sealInto` swaps the cell the engine emitted for the session seal;
 * `publish.publish` swaps the session seal for the pruned seal. Both walk the same
 * occurrences, count the same pages and demand the same equality at the end. They
 * had the same regex written three times, next to an imported and unused
 * `SEAL_ID`: renaming the constant would leave both matching nothing, and the
 * pruning would turn into a silent no-op until it blew up in the count.
 *
 * Here the regex is BUILT FROM `SEAL_ID`, so renaming it breaks loudly.
 *
 * @param {string} xml
 * @param {(page, i) => object} make  that page's seal attributes
 * @returns {string}
 */
function reescreverSelos(xml, make) {
  const { pages } = readPages(xml);
  if (!pages.length) throw new Error('XML with no page at all');
  const re = new RegExp(`[ \\t]*<object id="${SEAL_ID}"[\\s\\S]*?</object>\\n?`, 'g');
  let i = 0;
  const output = xml.replace(re, () => {
    const p = pages[i] || pages[pages.length - 1];
    const attrs = Object.entries(make(p, i))
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}="${esc(stripGremlins(v))}"`).join(' ');
    i += 1;
    return `        <object id="${SEAL_ID}" label="" ${attrs}>\n` +
      `          <mxCell style="text;html=1;" vertex="1" parent="1" visible="0">\n` +
      `            <mxGeometry x="0" y="0" width="1" height="1" as="geometry"/>\n` +
      `          </mxCell>\n` +
      `        </object>\n`;
  });
  if (i === 0) throw new Error(`the XML did not carry a single ${SEAL_ID} cell to swap`);
  if (i !== pages.length)
    throw new Error(`the XML has ${pages.length} page(s) but ${i} ${SEAL_ID} cell(s) — ` +
      'some page was left without a seal');
  const errors = checkXml(output);
  if (errors.length) { const e = new Error('rewriting the seal produced malformed XML'); e.errors = errors; throw e; }
  return { xml: output, pages };
}

/** The fingerprint the approval hangs onto: the agreement slice, canonicalized. */
const agreementFingerprint = snapshot => sha(canonicalize(snapshot));

// ----------------------------------------------------------------- the difference

/**
 * Cell-by-cell difference. It exists because "divergent" alone is not actionable:
 * #15's rule is *report, propose, never fix in silence*, and reporting requires
 * saying WHAT changed. Since every cell the engine emits carries the id of a model
 * element, the difference comes out in the model's vocabulary, not the XML's.
 */
function difference(before, after) {
  const beforeMap = new Map(before.map(c => [c.id, c]));
  const afterMap = new Map(after.map(c => [c.id, c]));
  const findings = [];

  for (const [id, c] of beforeMap)
    if (!afterMap.has(id)) findings.push({ kind: 'gone', id, entity: c.edge ? 'edge' : 'node', was: c.value });

  for (const [id, c] of afterMap) {
    if (!beforeMap.has(id)) { findings.push({ kind: 'appeared', id, entity: c.edge ? 'edge' : 'node', became: c.value }); continue; }
    const previous = beforeMap.get(id);
    const fa = semanticSlice(previous), fd = semanticSlice(c);
    if (fa.value !== fd.value) findings.push({ kind: 'label', id, was: fa.value, became: fd.value });
    if (fa.parent !== fd.parent) findings.push({ kind: 'reparented', id, was: fa.parent, became: fd.parent });
    if (fa.from !== fd.from || fa.to !== fd.to)
      findings.push({ kind: 'endpoints', id, was: `${fa.from}->${fa.to}`, became: `${fd.from}->${fd.to}` });
    if (fa.visible !== fd.visible) findings.push({ kind: 'visibility', id, was: fa.visible, became: fd.visible });
    if (canonicalize(fa.shape) !== canonicalize(fd.shape))
      findings.push({ kind: 'shape', id, was: canonicalize(fa.shape), became: canonicalize(fd.shape) });
  }
  return findings;
}

/**
 * What the divergence COSTS to fix. The classification does not fix anything — it
 * says whether the model has somewhere to hold what the human drew.
 *
 * `absorbable`: a field exists in `session@1` that expresses the change. The skill
 *               can propose absorbing it — next step, a confirmation.
 * `opaque`:     the human drew something the model has no way to say. There is
 *               nothing to absorb; either they describe what they did, or the
 *               drawing is the truth and the model was abandoned.
 */
function classify(findings) {
  const WHERE = {
    label: 'field `label`',
    gone: 'remove the element from the model',
    appeared: 'new node — but the skill does not know WHAT capability it serves; absorbing costs a question',
    reparented: 'field `inside`',
    endpoints: 'fields `from` / `to`',
  };
  return findings.map(a => {
    let where = WHERE[a.kind] || null;
    // Swapping the icon is expressible: it is another catalog `service`. Swapping
    // the style for something with no icon at all is not — the model has no
    // vocabulary for "a box the user drew their own way".
    if (a.kind === 'shape' && /Icon/.test(String(a.became))) where = 'field `service` or `kind`';
    return { ...a, category: where ? 'absorbable' : 'opaque', where };
  });
}

module.exports = {
  sha, canonicalize, sweep, findAll, readPages, unescape,
  semanticFingerprint, appearanceFingerprint, agreementFingerprint,
  semanticSlice, appearanceSlice, difference, classify, styleKeys,
  SEAL_ID, PREFIX, reescreverSelos,
};
