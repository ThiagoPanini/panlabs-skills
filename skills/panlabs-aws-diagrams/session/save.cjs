'use strict';
/**
 * Saving — how the session ends up INSIDE the `.drawio`.
 *
 * #14 put three persistence options on the table: a `.yaml` sidecar versioned
 * alongside, embedded in the file itself via `<object>`, or multiple `<diagram>`
 * pages. **They are not alternatives: the last two are the same answer on
 * different axes**, and the first is the only one that can be discarded by
 * argument rather than measurement.
 *
 *   WHERE the model lives -> embedded (`<object>`), not a sidecar.
 *   HOW the views live    -> two `<diagram>` pages of the SAME file.
 *
 * The sidecar falls for one reason only, and it is the same reason #11 used for
 * not having a second file: **two files drift apart**. A `.drawio` without its
 * `.yaml` beside it is an orphan diagram; a `.yaml` without its `.drawio` is a
 * model nobody approved. The user drags the `.drawio` into Slack and the pair
 * breaks the first time. None of this is hypothetical: it is the normal way a
 * file travels inside a company.
 *
 * Two pages instead of two files is the same argument one level up.
 *
 * The model is written on EVERY page, not only the first. It costs bytes
 * (measured in `tools/measure-host.cjs`) and buys something concrete: deleting a
 * page is the most banal operation in the world in draw.io, and with a single
 * copy it deletes the whole session along with it. Divergent copies become, in
 * themselves, a signal of divergence at read time.
 *
 * What the seal does NOT carry: a clock. #11 measured that regenerating the same
 * model must produce the same file byte for byte, and a generation timestamp
 * breaks that on every run. The date that exists in the seal is a DOMAIN date —
 * when the human approved — which comes from the dossier and not from the system.
 */

const path = require('path');

const ENGINE_DIR = path.join(__dirname, '..', 'engine');
const { esc, checkXml } = require(path.join(ENGINE_DIR, 'emit.cjs'));
const { impressaoSemantica, appearanceFingerprint, reescreverSelos } = require('./fingerprint.cjs');

/** Recognition mark. See `open.cjs` for why the `host` alone is not enough. */
const SEAL_SCHEMA = 'panlabs-aws-diagrams/session@1';

/**
 * Who drew it. It was `'q11'` — the name of the PROTOTYPE — while the engine
 * lived inside `prototypes/`. In the production tree the engine no longer has a
 * ticket number: it is the engine, and what the seal needs to say is "it was this
 * binary", not "it was such-and-such experiment". `open.cjs` uses this field only
 * to explain geometric divergence that did not come from a human edit.
 */
const ENGINE = 'panlabs-aws-diagrams/engine@1';

/**
 * Swaps the metadata cell the #11 engine emitted for the session seal.
 *
 * The engine writes there the `model@1` it received itself — which, here, is a
 * PROJECTION. Keeping the projection would be keeping the output instead of the
 * source: the next session needs the session model, with both facets and the
 * dossier, or there is nothing to resume.
 */
function sealInto(xml, session, view, opts = {}) {
  /**
   * ⚠️ ONE ENGINE CALL MAY RETURN N PAGES — and until the #23 recertification
   * this function said `seal expects one page, got N` and died.
   *
   * The assumption came from the engine #14 measured: one `generate` = one page,
   * and the two views became two calls stitched here. #12 added the structural
   * decomposition of `D2` — consolidated plus one per account — and the TECHNICAL
   * view of a multi-account model became 1+N pages from a single call. No suite
   * caught it because none ran the two things together.
   *
   * The fix does not change #14's decision, it fulfils it: *one copy of the seal
   * per page*, chosen there so that deleting a page in draw.io — the most banal
   * operation in the world — does not take the session with it. With 1+N pages
   * that matters even more: the page the user is most likely to delete is a
   * detail view, not the consolidated one.
   *
   * The FINGERPRINTS are per page, not per file: they answer "did the human touch
   * THIS page?", and `open.cjs` already classified page by page.
   */
  // The engine emits the model cell last on EVERY page, in the same order as the
  // pages — so the nth occurrence belongs to the nth page. What walks the
  // occurrences, checks the count and the XML on the way back is
  // `reescreverSelos` (fingerprint.cjs); the #19 trap — malformed XML renders
  // TRUNCATED with code 0 — is guarded there, and the seal is precisely where
  // arbitrary user text enters an attribute.
  return reescreverSelos(xml, p => ({
    panlabsSchema: SEAL_SCHEMA,
    panlabsVista: view,
    panlabsSemantica: impressaoSemantica(p.celulas),
    panlabsAparencia: appearanceFingerprint(p.celulas),
    panlabsMotor: opts.engine || ENGINE,
    panlabsSessao: JSON.stringify(session),
  })).xml;
}

/**
 * Joins the VIEWS of a `.drawio` into a single file.
 *
 * Each entry arrives from an independent engine run. Stitching here instead of
 * teaching the engine to serve both views is deliberate: the engine renders ONE
 * view, and the one who knows two exist is this layer. See `project.cjs`.
 *
 * ⚠️ One run is NO LONGER one page. Since #12 the technical view of a
 * multi-account model already arrives here with 1+N `<diagram>` inside — the
 * consolidated one plus one per account (`D2` of #6). That is why the slice is by
 * individual `<diagram>` and not "the block from the first to the last": the
 * greedy regex from before merged the N pages of one run into a single chunk,
 * which by luck produced valid XML, and the duplicate-id check right below then
 * looked only at the first id.
 */
function stitch(xmlsPerPage, opts = {}) {
  const diagrams = xmlsPerPage.flatMap(xml => {
    const findings = [...xml.matchAll(/[ \t]*<diagram\b[\s\S]*?<\/diagram>/g)].map(m => m[0]);
    if (!findings.length) throw new Error('XML with no <diagram> to stitch');
    return findings;
  });

  const ids = diagrams.map(d => /<diagram id="([^"]*)"/.exec(d)?.[1]);
  const repeated = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (repeated.length) throw new Error(`pages with the same id: ${repeated.join(', ')}`);

  const output = `<mxfile host="${esc(opts.host || 'panlabs-aws-diagrams')}" compressed="false">\n` +
    diagrams.join('\n') + '\n</mxfile>\n';

  const errors = checkXml(output);
  if (errors.length) { const e = new Error('the stitch produced malformed XML'); e.erros = errors; throw e; }
  return output;
}

module.exports = { sealInto, stitch, SEAL_SCHEMA };
