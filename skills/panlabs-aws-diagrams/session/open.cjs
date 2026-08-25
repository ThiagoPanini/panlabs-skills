'use strict';
/**
 * Opening — what the skill does when it receives a `.drawio` and needs to know
 * whether it is its own, and whether the model that came inside still holds.
 *
 * Three of #14's questions are answered here:
 *
 *   1. How the skill RECOGNIZES a diagram it generated itself.
 *   2. How it RECOVERS the context of the previous conversation.
 *   3. What happens when the human EDITED the file between the two sessions.
 *
 * The three possible states of a page, and why they are three and not two:
 *
 *   INTACT       both fingerprints match. The model is the truth; regenerating is safe.
 *   MOVED        the semantics match, the geometry does not. The human DRAGGED
 *                things. The model still holds — but regenerating throws their
 *                work away, and doing that in silence is the worst thing the skill
 *                can do to someone who spent half an hour tidying a drawing.
 *   DIVERGENT    the semantics do not match. The human added, deleted or renamed.
 *                The model now ASSERTS a different architecture from the drawn
 *                one, and there is no way to know which of the two the user calls
 *                true.
 *
 * Two states would not do: collapsing moved into intact loses the manual work;
 * collapsing moved into divergent blocks someone who only moved a box, and a
 * block that fires for nothing is a block the user learns to ignore.
 */

const { readPages, impressaoSemantica, appearanceFingerprint, diferenca, classify } = require('./fingerprint.cjs');
const { SEAL_SCHEMA } = require('./save.cjs');
const { PUBLISHED_SCHEMA } = require('./publish.cjs');

/**
 * @returns {{ours, howIRecognized, host, pages, session, copyConflict}}
 */
function open(xml) {
  const { host, pages } = readPages(xml);
  const howIRecognized = [];

  const sealed = pages.filter(p => p.seal && p.seal.panlabsSchema);
  if (sealed.length) howIRecognized.push(`seal on ${sealed.length}/${pages.length} page(s)`);
  // The `host` is the weak mark: it is an attribute of the APP, not ours, and
  // whoever saves the file last writes their own name into it. Good for
  // explaining, never for deciding. Measured in `tools/measure-host.cjs`.
  if (host === 'panlabs-aws-diagrams') howIRecognized.push('host="panlabs-aws-diagrams" (weak mark)');

  /**
   * THE PUBLISHED COPY DECLARES ITSELF, and this is the point where it does.
   *
   * Without this it would arrive here as a file of ours with a mutilated dossier,
   * and the skill would say "discarded candidates: none" — which is false, and
   * goes silent exactly where the #23 decision meant to speak. A file that lost
   * its deliberation on purpose has to say it lost it, and say where it is.
   */
  const publishedPages = sealed.filter(p => p.seal.panlabsSchema === PUBLISHED_SCHEMA);
  if (publishedPages.length === sealed.length && publishedPages.length) {
    howIRecognized.push(`PUBLISHED copy (${PUBLISHED_SCHEMA}) — does not resume`);
    return { ours: true, published: true, howIRecognized, host, pages: [], session: null, copyConflict: null,
      because: publishedPages[0].seal.panlabsPorque ||
        'published copy: the deliberation was pruned on purpose. Resume from the working file.' };
  }
  if (publishedPages.length)
    howIRecognized.push(`⚠ ${publishedPages.length} of ${sealed.length} page(s) are a published copy — ` +
      'someone pasted a page from a copy into the working file');

  const foreign = sealed.filter(p => p.seal.panlabsSchema !== SEAL_SCHEMA && p.seal.panlabsSchema !== PUBLISHED_SCHEMA);
  if (foreign.length)
    howIRecognized.push(`⚠ ${foreign.length} page(s) with schema "${foreign[0].seal.panlabsSchema}", not "${SEAL_SCHEMA}"`);

  if (!sealed.length)
    return { ours: false, howIRecognized, host, pages: [], session: null, copyConflict: null,
      because: 'no page carries the seal — either the file is not ours, or the page that had it was deleted' };

  // The per-page copies have to agree. Disagreeing only happens if someone pasted
  // a page from ANOTHER file in here — which is information, not an error.
  const copies = [...new Set(sealed.map(p => p.seal.panlabsSessao))];
  const copyConflict = copies.length > 1
    ? { quantas: copies.length, pages: sealed.map(p => ({ page: p.id, view: p.seal.panlabsVista })) }
    : null;

  let session = null;
  try { session = JSON.parse(sealed[0].seal.panlabsSessao); }
  catch (e) { return { ours: true, howIRecognized, host, pages: [], session: null, copyConflict,
    because: `the seal exists but is not valid JSON: ${e.message}` }; }

  const analysed = pages.map(p => {
    if (!p.seal || !p.seal.panlabsSchema)
      return { ...p, view: null, state: 'sem-selo', because: 'page with no seal — added by hand, or ours with the seal deleted' };
    const semNow = impressaoSemantica(p.celulas);
    const appNow = appearanceFingerprint(p.celulas);
    const semMatches = semNow === p.seal.panlabsSemantica;
    const appMatches = appNow === p.seal.panlabsAparencia;
    return {
      ...p,
      view: p.seal.panlabsVista,
      state: !semMatches ? 'divergente' : appMatches ? 'intacto' : 'remanejado',
      impressoes: { semAgora: semNow, apaAgora: appNow, semSelada: p.seal.panlabsSemantica, apaSelada: p.seal.panlabsAparencia },
      engine: p.seal.panlabsMotor,
    };
  });

  return { ours: true, howIRecognized, host, pages: analysed, session, copyConflict, because: null };
}

/**
 * Does the page ask for a view the recovered model knows how to produce?
 *
 * A mismatch is possible: a file with a technical page whose embedded model is at
 * the logical stage only exists if someone edited the seal by hand. Rare, but the
 * error `project` throws in that case talks about facets, and whoever is reading
 * wants to hear about the file.
 */
function canRegenerate(session, view) {
  if (view === 'technical' && session.stage !== 'technical')
    return { pode: false, because: 'the page says it is the technical view, but the sealed model is at the logical stage — ' +
      'the seal and the pages did not come from the same save.' };
  if (!view) return { pode: false, because: 'the page does not say which view it is.' };
  return { pode: true };
}

/**
 * The exact difference, when the page is divergent.
 *
 * The "before" does not come from the file — it comes from REGENERATING the
 * model. #11 proved the engine is deterministic (row order falls out of exposure
 * + label, not out of file order), so regenerating the sealed model reproduces
 * exactly the cells that were saved. That is why the seal carries a hash and not
 * the list of cells: the list is recomputable, and keeping the output next to the
 * source is buying one more pair that can drift apart.
 *
 * The honest caveat: if the ENGINE changed between the two sessions, regenerating
 * may give different geometry without anyone having touched the file. That is
 * what the seal carries `panlabsMotor` for — geometric divergence becomes
 * explainable rather than mysterious.
 */
function differ(page, referenceCells) {
  const findings = classify(diferenca(referenceCells, page.celulas));
  const only = t => findings.filter(a => a.kind === t).length;
  return {
    findings,
    resumo: {
      sumiram: only('sumiu'), apareceram: only('apareceu'), rotulos: only('label'),
      pais: only('mudou-de-pai'), formas: only('forma'), extremos: only('extremos'),
    },
    absorviveis: findings.filter(a => a.classe === 'absorvivel').length,
    opacas: findings.filter(a => a.classe === 'opaca').length,
  };
}

/**
 * The policy. Kept apart from detection on purpose: detecting is measurement,
 * deciding is product, and #15 already fixed the doctrine — *report, propose,
 * never fix in silence* and *block in one batch, once*.
 *
 * The glyph lives here with the rest. It used to sit in a loose table in the
 * briefing, and a new state would mean remembering two places — this is the only
 * one that knows what each state means.
 */
function policy(state) {
  switch (state) {
    case 'intacto':
      return { glifo: '✓', regerarEhSeguro: true, bloqueia: false,
        diga: 'the drawing is what the model produces. Carrying on.' };
    case 'remanejado':
      return { glifo: '~', regerarEhSeguro: true, bloqueia: false, avisa: true,
        diga: 'you moved things in this drawing. The model still holds, but regenerating restores the engine layout and loses your adjustment — confirm first.' };
    case 'divergente':
      return { glifo: '✗', regerarEhSeguro: false, bloqueia: true,
        diga: 'the drawing asserts an architecture the model does not. I will not regenerate over it: I would erase your edit, and I do not know which of the two versions you call true.' };
    default:
      return { glifo: '?', regerarEhSeguro: false, bloqueia: true,
        diga: 'page with no seal — I do not know what it asserts nor who drew it.' };
  }
}

module.exports = { open, differ, policy, canRegenerate };
