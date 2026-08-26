'use strict';
/**
 * The agreement — approval of the logical view turned into a checkable fact.
 *
 * Assumption 2 of #1 puts approval BETWEEN the two phases, and calls the
 * progression the heart of the product. What this file does is refuse to let
 * that approval be a boolean.
 *
 *   `approved: true` survives anything. You approve the logical view, the next
 *   session elaborates it technically, someone adds a capability that was never
 *   discussed, and the boolean keeps saying yes. The technical diagram comes out
 *   stamped approved over an architecture nobody approved.
 *
 * The agreement keeps the SNAPSHOT of the approved logical projection. Rechecking
 * means reprojecting today's model and comparing. If it matches, the technical
 * elaboration is faithful; if it does not, the difference comes out in the
 * vocabulary of the conversation — "you approved 12 capabilities, the technical
 * model serves 11" — and not as hash against hash.
 */

const { project, agreementSlice } = require('./project.cjs');
const { agreementFingerprint, canonicalize } = require('./fingerprint.cjs');

/** Seals the approval into the dossier. Changes nothing else in the model. */
function approve(session, who = {}) {
  const { model } = project(session, 'logical');
  const snapshot = agreementSlice(model);
  const output = JSON.parse(JSON.stringify(session));
  output.dossier = output.dossier || {};
  output.dossier.agreement = {
    view: 'logical',
    fingerprint: agreementFingerprint(snapshot),
    snapshot,
    ...(who.at ? { at: who.at } : {}),
    ...(who.by ? { by: who.by } : {}),
    ...(who.candidate ? { candidate: who.candidate } : {}),
  };
  return output;
}

/**
 * Does today's model still serve what was approved?
 *
 * This is the traceability #14 feared losing by using a single IR. With two
 * models linked by a mapping, answering this requires the mapping to be right —
 * and nothing guarantees it is. With one IR, the answer is a projection and a
 * string comparison.
 */
function check(session) {
  const agreement = session.dossier && session.dossier.agreement;
  if (!agreement) return { ok: false, motivo: 'no agreement', diferencas: [] };

  const { model } = project(session, 'logical');
  const now = agreementSlice(model);
  const fingerprint = agreementFingerprint(now);
  if (fingerprint === agreement.fingerprint) return { ok: true, fingerprint, diferencas: [] };

  return { ok: false, motivo: "today's logical projection differs from the approved one", fingerprint,
    esperada: agreement.fingerprint, diferencas: snapshotDiff(agreement.snapshot, now) };
}

/** The difference in the vocabulary of the conversation, not that of the XML. */
function snapshotDiff(before, after) {
  const out = [];
  const byId = l => new Map((l || []).map(x => [x.id, x]));
  const a = byId(before.nodes), d = byId(after.nodes);

  for (const [id, n] of a) if (!d.has(id))
    out.push({ o: 'capability', kind: 'gone', id, text: `"${n.label || id}" was approved and the technical model does not serve it` });
  for (const [id, n] of d) if (!a.has(id))
    out.push({ o: 'capability', kind: 'appeared', id, text: `"${n.label || id}" was not in the approved view` });
  for (const [id, n] of d) {
    const v = a.get(id); if (!v) continue;
    if (v.label !== n.label) out.push({ o: 'capability', kind: 'label', id, text: `"${v.label}" became "${n.label}"` });
    if (v.inside !== n.inside) out.push({ o: 'capability', kind: 'boundary', id, text: `"${v.label || id}" changed boundary: ${v.inside || '(root)'} → ${n.inside || '(root)'}` });
    if (v.kind !== n.kind) out.push({ o: 'capability', kind: 'kind', id, text: `"${v.label || id}" changed kind: ${v.kind} → ${n.kind}` });
  }

  const key = e => `${e.from}→${e.to}`;
  const ea = new Map((before.edges || []).map(e => [key(e), e]));
  const ed = new Map((after.edges || []).map(e => [key(e), e]));
  for (const [k, e] of ea) if (!ed.has(k)) out.push({ o: 'flow', kind: 'gone', id: k, text: `flow ${k} ("${e.label || ''}") was approved and no longer exists` });
  for (const [k, e] of ed) if (!ea.has(k)) out.push({ o: 'flow', kind: 'appeared', id: k, text: `flow ${k} ("${e.label || ''}") was not in the approved view` });
  for (const [k, e] of ed) {
    const v = ea.get(k); if (!v) continue;
    if (v.label !== e.label) out.push({ o: 'flow', kind: 'label', id: k, text: `${k}: "${v.label}" became "${e.label}"` });
    if ((v.data || 'out') !== (e.data || 'out')) out.push({ o: 'flow', kind: 'direction', id: k, text: `${k}: data direction ${v.data || 'out'} → ${e.data || 'out'}` });
  }

  const na = new Set((before.notes || []).map(canonicalize));
  const nd = new Set((after.notes || []).map(canonicalize));
  for (const n of na) if (!nd.has(n)) out.push({ o: 'note', kind: 'gone', id: n.slice(0, 40), text: `an approved note is gone — if it was the rejected-finding one, the drawing goes back to misleading in silence (#15 §4)` });
  for (const n of nd) if (!na.has(n)) out.push({ o: 'note', kind: 'appeared', id: n.slice(0, 40), text: 'new note on the logical view' });

  return out;
}

module.exports = { approve, check, snapshotDiff };
