'use strict';
/**
 * Session model validation.
 *
 * Does not repeat the #11 validator — it checks what ONLY the session layer knows:
 * whether the facets close, whether the dossier is coherent, whether the agreement
 * points at something that exists. What belongs to the drawing (a subnet outside a
 * VPC, an edge ending in a container, a service in the logical view) is still the
 * engine's job, and reaches it through the projection with the messages #11 already
 * wrote. Two layers, each charging for what it can see.
 *
 * The rule that carries the ticket:
 *
 *   > Whatever exists in both layers HAS TO have both facets.
 *
 * Without it, forgetting the logical facet of an approved capability gives no error
 * at all — the capability simply vanishes from the logical projection, and the view
 * the user approved comes out showing less than they approved. Silently. That is
 * the failure #14 exists to prevent, and it is cheap to close here.
 */

const fs = require('fs');
const path = require('path');

const ENGINE_DIR = path.join(__dirname, '..', 'engine');
const { againstSchema } = require(path.join(ENGINE_DIR, 'validate.cjs'));

const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

const TECHNICAL_CONTAINERS = new Set(['cloud', 'account', 'region', 'vpc', 'subnet', 'security-group', 'group']);
const LOGICAL_CONTAINERS = new Set(['group']);

function references(m) {
  const erros = [];
  const byId = new Map();
  for (const n of m.nodes) {
    if (byId.has(n.id)) erros.push(`node "${n.id}" declared twice`);
    byId.set(n.id, n);
  }
  for (const n of m.nodes) {
    if (n.inside === undefined) continue;
    if (!byId.has(n.inside)) erros.push(`node "${n.id}": inside="${n.inside}" does not exist`);
    if (n.inside === n.id) erros.push(`node "${n.id}": contained in itself`);
  }
  // containment cycle — the list is flat (#11), so a cycle is possible
  for (const n of m.nodes) {
    const seen = new Set([n.id]);
    let c = n.inside;
    while (c !== undefined && byId.has(c)) {
      if (seen.has(c)) { erros.push(`containment cycle passing through "${n.id}"`); break; }
      seen.add(c); c = byId.get(c).inside;
    }
  }
  for (const [i, a] of (m.edges || []).entries())
    for (const p of ['from', 'to'])
      if (!byId.has(a[p])) erros.push(`edge[${i}]: ${p}="${a[p]}" does not exist`);
  for (const f of (m.bands || []))
    for (const id of f.members) if (!byId.has(id)) erros.push(`band "${f.id}": member "${id}" does not exist`);
  for (const [i, nt] of (m.notes || []).entries())
    if (nt.about !== undefined && !byId.has(nt.about)) erros.push(`note[${i}]: about="${nt.about}" does not exist`);
  return { erros, byId };
}

function facets(m, byId) {
  const erros = [], avisos = [];
  const layerOf = el => el.layer || 'both';

  const hasChild = new Set();
  for (const n of m.nodes) if (n.inside !== undefined) hasChild.add(n.inside);

  for (const n of m.nodes) {
    const layer = layerOf(n);

    if (m.stage === 'logical') {
      if (layer === 'technical')
        erros.push(`node "${n.id}": layer "technical" in a model at the logical stage. ` +
          `Infrastructure with no capability only shows up once the technical phase begins — before that it has not been decided.`);
      if (!n.logical)
        erros.push(`node "${n.id}": no "logical" facet in a model at the logical stage.`);
      if (n.technical)
        erros.push(`node "${n.id}": "technical" facet in a model at the logical stage. ` +
          `A service name said too early goes to dossier.parking (#15 §5), not into the model — ` +
          `if it lands here, it contaminates the logical view and breaks A1.10 (one level of abstraction).`);
    } else {
      if (!n.technical)
        erros.push(`node "${n.id}": no "technical" facet in a model at the technical stage.`);
      if (layer === 'both' && !n.logical)
        erros.push(`node "${n.id}": layer "both" but no "logical" facet. ` +
          `Either it exists in the logical view and needs the facet, or it is infrastructure and needs layer:"technical". ` +
          `Leaving it as is would make the capability vanish from the logical projection with no error at all.`);
      if (layer === 'technical' && n.logical)
        erros.push(`node "${n.id}": layer "technical" but has a "logical" facet — what it asserts contradicts itself.`);
    }

    // A node that contains something has to be a container in BOTH views. A leaf
    // facet on a node with children would produce a model@1 where the leaf is
    // someone's parent — and the engine would draw the child inside an icon.
    if (hasChild.has(n.id)) {
      if (n.technical && !TECHNICAL_CONTAINERS.has(n.technical.kind))
        erros.push(`node "${n.id}": contains other nodes, but the technical facet is "${n.technical.kind}", which is a leaf.`);
      if (n.logical && !LOGICAL_CONTAINERS.has(n.logical.kind)) {
        // Only counts if some descendant survives in the logical view — otherwise
        // the collapse passes right over it and nobody ends up inside anything.
        const logicalDescendants = m.nodes.some(o => {
          if (layerOf(o) === 'technical' || o.id === n.id) return false;
          let c = o.inside;
          while (c !== undefined && byId.has(c)) { if (c === n.id) return true; c = byId.get(c).inside; }
          return false;
        });
        if (logicalDescendants)
          erros.push(`node "${n.id}": contains capabilities, but the logical facet is "${n.logical.kind}". ` +
            `A responsibility boundary is kind "group" (#15 §6).`);
      }
    }
  }

  for (const [i, a] of (m.edges || []).entries()) {
    if (m.stage === 'logical' && layerOf(a) === 'technical')
      erros.push(`edge[${i}]: layer "technical" in a model at the logical stage.`);
    if (layerOf(a) === 'both') {
      const ends = [a.from, a.to].map(id => byId.get(id)).filter(Boolean);
      for (const p of ends)
        if (layerOf(p) === 'technical' && !avisos.some(x => x.includes(`"${p.id}"`)))
          avisos.push(`edge[${i}]: passes through "${p.id}", which only exists in the technical view — ` +
            `in the logical projection it will be CONTRACTED through it.`);
    }
  }

  // ------------------------------------------------- ambiguous contraction
  //
  // A node only the technical layer has is crossed by the logical projection: the
  // edge `a -> [hub] -> b` becomes `a -> b`. As long as the hub has one input OR
  // one output, the pairing is unique and the reading is obvious. With TWO inputs
  // and TWO outputs, it is no longer a single jump — it is a crossing, and the
  // contraction would produce all 4 combinations, when only 2 were asserted.
  //
  // That is the drawing lying, which is the failure this whole map exists to hunt
  // down. The fix belongs to the model's author, and it is cheap: the edges that
  // carry no logical reading get `layer: "technical"` and vanish from the
  // projection.
  for (const n of m.nodes) {
    if (layerOf(n) !== 'technical') continue;
    const incoming = (m.edges || []).filter(a => a.to === n.id && layerOf(a) === 'both');
    const outgoing = (m.edges || []).filter(a => a.from === n.id && layerOf(a) === 'both');
    if (incoming.length > 1 && outgoing.length > 1)
      erros.push(`node "${n.id}": only exists in the technical view and has ${incoming.length} input(s) and ${outgoing.length} output(s) ` +
        `that cross into the logical view. The contraction would emit ${incoming.length * outgoing.length} logical edges, ` +
        `and only ${incoming.length + outgoing.length} were asserted — the drawing would end up saying that ` +
        `"${incoming[0].from}" talks to "${outgoing[1].to}" without anyone having said so. ` +
        `Mark the edges that carry no logical reading with layer:"technical".`);
  }

  return { erros, avisos };
}

function dossier(m) {
  const erros = [], avisos = [];
  const d = m.dossier;
  if (!d) { avisos.push('no dossier — the next session resumes the drawing, but not the conversation.'); return { erros, avisos }; }

  const cands = d.candidates || [];
  if (cands.length) {
    const chosen = cands.filter(c => c.state === 'chosen');
    if (chosen.length !== 1)
      erros.push(`dossier.candidates: ${chosen.length} chosen — has to be exactly one.`);
    if (cands.length < 2)
      avisos.push('dossier.candidates: only one. #15 sets a floor of 2 — if the real space only had one, the dossier should say why.');
    if (cands.length > 3)
      avisos.push(`dossier.candidates: ${cands.length}. #15 sets a ceiling of 3.`);
    // #15 §3's distinction invariant, turned into a check: equal tuples collapse,
    // and two candidates with the same tuple are the same architecture with two
    // names — exactly the "three variations on the same thing" the protocol
    // exists to prevent.
    for (let i = 0; i < cands.length; i++)
      for (let j = i + 1; j < cands.length; j++)
        if (JSON.stringify(cands[i].tuple) === JSON.stringify(cands[j].tuple))
          erros.push(`dossier.candidates: "${cands[i].name}" and "${cands[j].name}" have the SAME E1-E5 tuple — ` +
            `they are not distinct candidates, they are the same architecture with two names.`);
  }

  const ids = new Set(m.nodes.map(n => n.id));
  for (const a of (d.findings || []))
    if (a.target !== undefined && !ids.has(a.target)) erros.push(`dossier.findings: target "${a.target}" does not exist among the nodes.`);
  for (const e of (d.parking || []))
    if (e.capability !== undefined && !ids.has(e.capability))
      erros.push(`dossier.parking: capability "${e.capability}" does not exist among the nodes.`);

  // A rejected finding that did not become a note is the failure #15 §4 names:
  // with no diff against IaC, an ignored finding turns into a diagram that misleads
  // in silence.
  for (const a of (d.findings || []).filter(x => x.state === 'rejected')) {
    if (!a.viaNote) {
      erros.push(`dossier.findings: "${a.rule}" was REJECTED and does not point at \`viaNote\`. ` +
        `The rejection has to become a mark on the diagram (#15 §4), or the drawing misleads in silence.`);
      continue;
    }
    const note = (m.notes || []).find(n => n.id === a.viaNote);
    if (!note) erros.push(`dossier.findings: "${a.rule}" points at viaNote="${a.viaNote}", which does not exist among the notes.`);
    else if (note.origin !== 'rejected-finding')
      erros.push(`dossier.findings: "${a.rule}" points at note "${a.viaNote}", whose origin is "${note.origin}" and not "rejected-finding".`);
    else if ((note.layer || 'both') !== 'both')
      erros.push(`dossier.findings: note "${a.viaNote}" only appears in the technical view — the rejection vanishes from the logical view, which is the one that was approved.`);
  }

  if (d.agreement && d.agreement.candidate && !cands.some(c => c.id === d.agreement.candidate))
    erros.push(`dossier.agreement: candidate "${d.agreement.candidate}" is not in dossier.candidates.`);

  if (m.stage === 'technical' && !d.agreement)
    erros.push('stage "technical" with no dossier.agreement. Assumption 2 places approval of the logical view ' +
      'BETWEEN the two phases — elaborating technically without it skips the heart of the product.');

  return { erros, avisos };
}

function validate(model) {
  const schemaErrors = againstSchema(model, SCHEMA, SCHEMA);
  if (schemaErrors.length) return { ok: false, fase: 'schema', erros: schemaErrors, avisos: [] };

  const { erros: refErrors, byId } = references(model);
  if (refErrors.length) return { ok: false, fase: 'references', erros: refErrors, avisos: [] };

  const c = facets(model, byId);
  const d = dossier(model);
  const erros = [...c.erros, ...d.erros];
  const avisos = [...c.avisos, ...d.avisos];
  if (erros.length) return { ok: false, fase: 'session', erros, avisos };
  return { ok: true, fase: null, erros: [], avisos, byId };
}

module.exports = { validate, SCHEMA };
