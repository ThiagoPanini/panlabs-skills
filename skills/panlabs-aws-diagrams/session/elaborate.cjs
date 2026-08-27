'use strict';
/**
 * Elaboration — the technical phase applied on top of the model the previous
 * session approved.
 *
 * Session 2 does NOT rewrite the logical model. It applies a DELTA on top of the
 * model it recovered from inside the `.drawio`, and the delta has no way to reach
 * a logical facet — there is no field for that in the elaboration, and the guard
 * at the end checks that none was touched. Same move as #11: the rule becomes
 * grammar instead of discipline.
 *
 * Until #37, `elaboration@1` had no schema file: the only way to catch the delta's
 * SHAPE being wrong (a typo'd field, the wrong `schema`, a new node with no
 * `layer`) was to fall straight into the domain errors below, or not even that.
 * Now the shape is checked first, against the same schema
 * `tests/check-single-schema.cjs` started sweeping.
 *
 * What the delta can do:
 *   nodes         add infrastructure (mandatory "technical" layer)
 *   facets        dress an approved node in an AWS service
 *   inside        reparent an approved node into a new level     ← the risky operation
 *   refines       turn an approved edge into a technical PATH
 *   edges         add an edge only the technical layer has
 *   facetEdges    give an approved edge a technical label
 *   notes, dossier  add
 *
 * `refines` deserves the explanation. Technically, "store-raw notifies arrival to
 * process-on-arrival" goes through an event bus. The reflex is to delete the
 * approved edge and write two new ones — and then the approved endpoint depends on
 * someone rewriting it correctly. By declaring the JUMPS, the endpoints stay the
 * same objects as before: the first edge is still the approved one, with its
 * logical label intact, and the projection's contraction reconstructs the original
 * pair.
 */

const fs = require('fs');
const path = require('path');
const { againstSchema } = require(path.join(__dirname, '..', 'engine', 'validate.cjs'));

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'elaboration.schema.json'), 'utf8'));

const clone = o => JSON.parse(JSON.stringify(o));

function elaborate(base, el) {
  const schemaErrors = againstSchema(el, SCHEMA, SCHEMA);
  if (schemaErrors.length) { const e = new Error('elaboration is out of schema'); e.errors = schemaErrors; throw e; }

  if (el.about && el.about !== base.id)
    throw new Error(`elaboration is about "${el.about}", the model is "${base.id}"`);

  const m = clone(base);
  const errors = [];
  const byId = new Map(m.nodes.map(n => [n.id, n]));
  const byEdgeId = new Map((m.edges || []).filter(a => a.id).map(a => [a.id, a]));

  // 1 · new nodes --------------------------------------------------------------
  for (const n of (el.nodes || [])) {
    if (byId.has(n.id)) { errors.push(`new node "${n.id}" already exists in the approved model`); continue; }
    if (n.logical)
      errors.push(`new node "${n.id}" carries a logical facet. The technical phase does not invent capability: ` +
        `if it really is new, the logical view changed and needs a fresh approval, not one more facet.`);
    if ((n.layer || 'both') !== 'technical')
      errors.push(`new node "${n.id}" with no "technical" layer — everything the elaboration adds is infrastructure.`);
    const copy = clone(n);
    m.nodes.push(copy); byId.set(copy.id, copy);
  }

  // 2 · technical facets ---------------------------------------------------------
  for (const [id, facet] of Object.entries(el.facets || {})) {
    const n = byId.get(id);
    if (!n) { errors.push(`facet for "${id}", which does not exist`); continue; }
    if (n.technical) errors.push(`node "${id}" already had a technical facet`);
    n.technical = clone(facet);
  }

  // 3 · reparent ----------------------------------------------------------------
  for (const [id, parent] of Object.entries(el.inside || {})) {
    const n = byId.get(id);
    if (!n) { errors.push(`reparents "${id}", which does not exist`); continue; }
    if (!byId.has(parent)) { errors.push(`reparents "${id}" into "${parent}", which does not exist`); continue; }
    n.inside = parent;
  }

  // 4 · refine an edge into a path -----------------------------------------------
  for (const [id, r] of Object.entries(el.refines || {})) {
    const a = byEdgeId.get(id);
    if (!a) { errors.push(`refines edge "${id}", which does not exist`); continue; }
    const jumps = r.by || [];
    for (const s of jumps) if (!byId.has(s)) errors.push(`refines "${id}" through "${s}", which does not exist`);
    // `labels` lives inside a map the schema leaves open (`refines` is
    // `additionalProperties: true`), so nothing but this line validates the
    // name: a delta spelling it any other way parses clean and silently draws
    // unlabelled segments. #124 renamed it from `rotulos` on BOTH ends at once
    // — here, the schema's `description`, and the shipped example.
    const labels = r.labels || [];
    if (labels.length && labels.length !== jumps.length + 1)
      errors.push(`refines "${id}": ${jumps.length} jump(s) require ${jumps.length + 1} label(s), got ${labels.length}`);

    const chain = [a.from, ...jumps, a.to];
    // The first segment REMAINS the approved edge: same object, same id, same
    // logical label. Only the target changes and gains a technical facet.
    a.to = chain[1];
    if (labels[0] !== undefined) a.technical = { ...(a.technical || {}), label: labels[0] };
    for (let k = 1; k < chain.length - 1; k++) {
      const seg = { id: `${id}-s${k}`, from: chain[k], to: chain[k + 1], layer: 'both' };
      // The jump does NOT inherit `data` or `protocol`: it is plumbing, and the
      // approved edge (the first segment) is what carries the assertion.
      // Inheriting `data: "both"` would make the bus come out with a double
      // arrow, asserting a return path that runs somewhere else.
      if (labels[k] !== undefined) seg.label = labels[k];
      m.edges.push(seg); byEdgeId.set(seg.id, seg);
    }
  }

  // 5 · new edges and edge facets ------------------------------------------------
  for (const a of (el.edges || [])) {
    if (a.id && byEdgeId.has(a.id)) { errors.push(`new edge "${a.id}" already exists`); continue; }
    const copy = clone(a);
    m.edges.push(copy); if (copy.id) byEdgeId.set(copy.id, copy);
  }
  for (const [id, facet] of Object.entries(el.facetEdges || {})) {
    const a = byEdgeId.get(id);
    if (!a) { errors.push(`facet for edge "${id}", which does not exist`); continue; }
    a.technical = { ...(a.technical || {}), ...clone(facet) };
  }

  // 6 · notes and dossier ---------------------------------------------------------
  m.notes = [...(m.notes || []), ...clone(el.notes || [])];
  if (el.dossier) {
    m.dossier = m.dossier || {};
    for (const e of (el.dossier.parking || [])) {
      const l = m.dossier.parking || (m.dossier.parking = []);
      const i = l.findIndex(x => x.name === e.name);
      if (i >= 0) l[i] = clone(e); else l.push(clone(e));
    }
    for (const a of (el.dossier.findings || [])) {
      const l = m.dossier.findings || (m.dossier.findings = []);
      const i = l.findIndex(x => x.rule === a.rule && x.target === a.target);
      if (i >= 0) l[i] = clone(a); else l.push(clone(a));
    }
  }

  m.stage = 'technical';
  if (el.title) m.title = el.title;
  if (el.subtitle) m.subtitle = el.subtitle;

  // 7 · the guard -----------------------------------------------------------------
  // Not paranoia: it is the same control experiment as #11. The elaboration has NO
  // field that reaches a logical facet, and the check exists anyway, because that
  // is how #17 learned that 24 green checks did not catch the wrong icon. Cheap,
  // and it closes the door the schema would leave ajar if someone added a field
  // tomorrow.
  const before = new Map(base.nodes.map(n => [n.id, JSON.stringify(n.logical)]));
  for (const [id, logical] of before) {
    const now = byId.get(id);
    if (!now) { errors.push(`approved node "${id}" vanished during elaboration`); continue; }
    if (JSON.stringify(now.logical) !== logical)
      errors.push(`the elaboration touched the logical facet of "${id}" — that changes what was approved`);
  }

  if (errors.length) { const e = new Error('invalid elaboration'); e.errors = errors; throw e; }
  return m;
}

module.exports = { elaborate, SCHEMA };
