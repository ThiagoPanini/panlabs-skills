'use strict';
/**
 * Projection — `session@1` + view  ->  `model@1` (what the #11 engine eats).
 *
 * This file is the entire answer to #14's first question ("one IR or two?"). The
 * ticket stated the trade-off as *traceability vs simplicity*: two models linked by
 * an explicit mapping trace better; a single model is simpler. **The trade-off is
 * false**, and the reason is in here:
 *
 *   with a single IR, traceability is not a lookup table someone maintains — it is
 *   a FUNCTION. `project(technical, 'logical')` reconstructs the logical view from
 *   the technical model, and comparing the result with what was approved is a
 *   string equality.
 *
 * With two models, the same question ("is what I am drawing still what you
 * approved?") requires the mapping to be correct — and nothing guarantees that.
 * With one model, the question answers itself.
 *
 * Two mechanics make the projection work:
 *
 * 1. CONTAINMENT COLLAPSE. `inside` always points to the finest-grained parent the
 *    model knows. To find the parent in a coarser view, walk up to the first
 *    ancestor that exists in that view. That is what lets the technical phase slot
 *    a VPC and a subnet in between the leaf and the boundary WITHOUT TOUCHING what
 *    was approved: the leaf's `inside` changes, the logical projection changes
 *    nothing.
 *
 * 2. EDGE CONTRACTION. A node only the technical layer has (a VPC endpoint, an IAM
 *    role, an event bus) sits in the MIDDLE of a logical path. The logical edge is
 *    the contraction of the path: `process -> endpoint -> table` projects to
 *    `process -> table`, with the first edge's label.
 *
 * The #11 engine did not change a single line for this to happen — and that is not
 * a coincidence: what comes out of here is a valid `model@1`, and the engine
 * remains a renderer of ONE view. The one who knows two exist is the session layer.
 */

const VIEWS = ['logical', 'technical'];

/**
 * Fields the technical facet forwards straight onto the model@1 node.
 *
 * WARNING: THIS LIST AND `session/schema.json` ARE THE SAME DECISION WRITTEN
 * TWICE, and the day they disagree the field vanishes with no error at all — that
 * is what happened with `qualifier`, `ou` and `enables` until #29: all three
 * existed in `model@1` and did not exist here, so whoever went through the
 * TWO-VIEW ARC lost the three of them while whoever wrote `model@1` directly kept
 * them. `ou` was the most costly: without it, multi-account through the arc could
 * not express a single organizational unit — the skill's two flags did not combine.
 *
 * `tests/check-technical-parity.cjs` (#37) measures two parities, not one:
 * model@1.node against session@1.technicalFacet (the two SCHEMAS), and this list
 * against session@1.technicalFacet (the schema against whoever actually PROJECTS).
 * The first alone would not have caught the gap that `layer` (#22) had here until
 * #37: the field could be in both schemas and still never reach the projected
 * model@1, if this list forgot it. Exported for that reason — the check reads the
 * real list, not a copy of it.
 */
const TECHNICAL_FIELDS = ['service', 'az', 'access', 'cidr', 'account', 'note',
                         'qualifier', 'ou', 'enables', 'layer'];

/** The same, on the logical side. `note` was already there; `qualifier` came in with #29. */
const LOGICAL_FIELDS = ['note', 'qualifier'];

const existsIn = (el, view) =>
  view === 'technical' ? true : (el.layer || 'both') !== 'technical';

/**
 * @param {object} session  `session@1` model
 * @param {'logical'|'technical'} view
 * @returns {{model: object, trail: object}}
 */
function project(session, view) {
  if (!VIEWS.includes(view)) throw new Error(`view "${view}" — expected "logical" or "technical"`);
  if (view === 'technical' && session.stage !== 'technical')
    throw new Error('a model at the "logical" stage does not emit a technical view: no node has a technical facet yet');

  const byId = new Map(session.nodes.map(n => [n.id, n]));
  const trail = { collapsed: [], contracted: [], discarded: [] };

  // ------------------------------------------------------- 1. who survives
  const alive = new Set();
  for (const n of session.nodes) {
    if (!existsIn(n, view)) { trail.discarded.push({ kind: 'node', id: n.id, because: 'only exists in the technical view' }); continue; }
    alive.add(n.id);
  }

  // ------------------------------------------------- 2. collapsed containment
  /** Walks up through `inside` until it finds an ancestor that exists in this view. */
  function parentInView(node) {
    let current = node.inside, jumps = 0;
    while (current !== undefined) {
      if (alive.has(current)) return { parent: current, jumps };
      const parentNode = byId.get(current);
      if (!parentNode) return { parent: undefined, jumps };   // broken reference — the validator complains first
      current = parentNode.inside; jumps++;
    }
    return { parent: undefined, jumps };
  }

  const nodes = [];
  for (const n of session.nodes) {
    if (!alive.has(n.id)) continue;
    const facet = view === 'logical' ? n.logical : n.technical;
    if (!facet) throw new Error(`node "${n.id}" has no "${view}" facet — the session validator should have caught this`);

    const { parent, jumps } = parentInView(n);
    if (jumps > 0) trail.collapsed.push({ id: n.id, from: n.inside, to: parent, jumps });

    const output = { id: n.id, kind: facet.kind };
    const label = facet.label !== undefined ? facet.label : n.label;
    if (label !== undefined) output.label = label;
    if (parent !== undefined) output.inside = parent;
    // These braces are not decoration: without them the `else` sticks to the `if`
    // inside the `for` and the LOGICAL projection never copies `note` — the
    // logical facet declares the field, the schema documents it, and it vanishes
    // with no error at all.
    if (view === 'technical') {
      for (const c of TECHNICAL_FIELDS) if (facet[c] !== undefined) output[c] = facet[c];
    } else {
      for (const c of LOGICAL_FIELDS) if (facet[c] !== undefined) output[c] = facet[c];
    }
    nodes.push(output);
  }

  // ---------------------------------------------------- 3. edges
  const viewEdges = (session.edges || []).filter(a => existsIn(a, view));
  for (const a of (session.edges || []))
    if (!existsIn(a, view))
      trail.discarded.push({ kind: 'edge', id: a.id || `${a.from}->${a.to}`, because: 'only exists in the technical view' });

  const outgoingFrom = new Map();
  for (const a of viewEdges) {
    if (!outgoingFrom.has(a.from)) outgoingFrom.set(a.from, []);
    outgoingFrom.get(a.from).push(a);
  }

  /**
   * Walks forward across nodes that do not exist in this view, and returns the
   * live nodes it reaches. A technical endpoint with two outputs produces two
   * logical edges — which is the correct reading: whoever sends to the bus sends
   * to both of its consumers.
   */
  function reachable(startId, visited) {
    if (alive.has(startId)) return [{ id: startId, by: [] }];
    if (visited.has(startId)) return [];
    visited.add(startId);
    const out = [];
    for (const next of (outgoingFrom.get(startId) || []))
      for (const target of reachable(next.to, visited))
        out.push({ id: target.id, by: [startId, ...target.by] });
    return out;
  }

  const edges = [];
  const alreadySeenSet = new Set();
  for (const a of viewEdges) {
    if (!alive.has(a.from)) continue;   // a path that starts in infrastructure has no logical reading

    // The targets all have to be known BEFORE emitting, because the outgoing id
    // depends on how many there are. Without this the contracted edge lost the
    // approved edge's id, the engine fell back to the derived id, and the SAME
    // logical view came out with different cell ids after the technical
    // elaboration — a full-blown divergence on a drawing that had not changed at
    // all. Cost a bench round to find.
    const targets = [];
    const seen = new Set();
    for (const target of reachable(a.to, new Set())) {
      if (target.id === a.from) continue;                          // contraction closed a loop
      if (seen.has(target.id)) continue;
      // The key carries the SOURCE EDGE, not just the (from, to) pair. Without
      // this, two DISTINCT approved edges between the same pair — "send request"
      // and "confirm receipt" between the same two blocks — would collapse into
      // one, and both ends of the agreement comparison would lose the same one,
      // leaving the check blind to the loss. `seen` keeps deduplicating the
      // fan-out of ONE edge, which is the case contraction actually creates.
      const key = `${a.id || `${a.from}>${a.to}`}#${target.id}`;
      if (alreadySeenSet.has(key)) continue;
      alreadySeenSet.add(key); seen.add(target.id);
      targets.push(target);
    }

    for (const target of targets) {
      const facet = (view === 'logical' ? a.logical : a.technical) || {};
      const e = { from: a.from, to: target.id };
      // The contracted edge REMAINS the approved edge — it has just started being
      // drawn through the short path, which is why it inherits the id. When a
      // jump fans out (a bus with several consumers), the target breaks the tie.
      if (a.id !== undefined) e.id = targets.length > 1 ? `${a.id}--${target.id}` : a.id;
      const label = facet.label !== undefined ? facet.label : a.label;
      if (label !== undefined) e.label = label;
      const protocol = facet.protocol !== undefined ? facet.protocol : a.protocol;
      if (protocol !== undefined) e.protocol = protocol;
      if (a.data !== undefined) e.data = a.data;
      const order = facet.order !== undefined ? facet.order : a.order;
      if (order !== undefined) e.order = order;
      edges.push(e);

      if (target.by.length)
        trail.contracted.push({ from: a.from, to: target.id, by: target.by, label });
    }
  }

  // ---------------------------------------------------- 4. bands and notes
  // A band is a topology concept (#19) — the logical view has nothing to cross.
  const bands = view === 'technical'
    ? (session.bands || []).filter(f => f.members.every(m => alive.has(m)))
    : [];

  const notes = [];
  for (const nt of (session.notes || [])) {
    if (!existsIn(nt, view)) { trail.discarded.push({ kind: 'note', id: nt.id || nt.text.slice(0, 24), because: 'only exists in the technical view' }); continue; }
    if (nt.about !== undefined && !alive.has(nt.about)) {
      // A note anchored to a node that vanished in the projection. Re-anchoring it
      // on the ancestor would change what it asserts; dropping it in silence would
      // be A4.2. It becomes a footnote, and the trail records the move.
      trail.discarded.push({ kind: 'note-anchor', id: nt.about, because: 'note became a footnote in this view' });
      const { about, layer, ...rest } = nt;
      notes.push(rest);
      continue;
    }
    const { layer, ...rest } = nt;
    notes.push(rest);
  }

  const ap = (session.vistas && session.vistas[view]) || {};
  const model = {
    schema: 'panlabs-aws-diagrams/model@1',
    id: `${session.id}-${view}`,
    title: ap.title || session.title,
    view,
    nodes, edges,
  };
  const sub = ap.subtitle !== undefined ? ap.subtitle : session.subtitle;
  if (sub) model.subtitle = sub;
  if (ap.genre) model.genre = ap.genre;
  if (bands.length) model.bands = bands;
  if (notes.length) model.notes = notes;

  return { model, trail };
}

/**
 * THE AGREEMENT: the slice of the projected model that the approval covers.
 *
 * Not the whole model. Title, subtitle and genre are presentation — changing the
 * subtitle after approval does not undo the agreement, and an approval scheme that
 * breaks over that turns into noise the user learns to ignore. What the agreement
 * covers is what was DISCUSSED: which capabilities exist, inside which boundary,
 * who talks to whom, and the notes — including the rejected-finding one, which is
 * how "known and accepted SPOF" (#15 §4) survives.
 */
function agreementSlice(logicalModel) {
  // The sort keys carry a separator and the label. Concatenating `from + to` raw
  // makes ("a","bc") and ("ab","c") collide into the same key; and the label is
  // there because, with parallel edges between the same pair, without it the order
  // would depend on whoever arrived first in the list — and the agreement
  // fingerprint would stop being stable.
  const edgeKey = a => `${a.from} ${a.to} ${a.label || ''}`;
  const cmp = (x, y) => x < y ? -1 : x > y ? 1 : 0;
  return {
    nodes: logicalModel.nodes.map(n => ({ id: n.id, kind: n.kind, label: n.label, inside: n.inside, note: n.note }))
      .sort((a, b) => cmp(a.id, b.id)),
    edges: (logicalModel.edges || []).map(a => ({ from: a.from, to: a.to, label: a.label, data: a.data }))
      .sort((x, y) => cmp(edgeKey(x), edgeKey(y))),
    notes: (logicalModel.notes || []).map(n => ({ text: n.text, about: n.about, origin: n.origin }))
      .sort((a, b) => cmp(a.text, b.text)),
  };
}

module.exports = { project, agreementSlice, VIEWS, TECHNICAL_FIELDS, LOGICAL_FIELDS };
