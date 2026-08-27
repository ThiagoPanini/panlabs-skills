'use strict';
/**
 * #42 — the dossier, rendered for the HUMAN deciding whether to trust the
 * drawing. Five sections, fixed order, because the ticket's acceptance is
 * only checkable if the reader always finds the same thing in the same
 * place: the case verbatim, what was asked vs. inferred, the candidate that
 * won and why not the others, the resource names that need confirming, and
 * what still deserves attention.
 *
 * This is NOT `briefing.cjs`. That one recovers a conversation for the AGENT
 * reopening a session; this one is the artifact a HUMAN reads once, without
 * opening the .drawio.
 *
 * Pure: session (+ the semantic failures `tools/case.cjs` already collected
 * from drawing both views) in, a markdown string out. No `fs` — a hand-built
 * session object is enough to exercise every branch.
 *
 * WHAT STAYS OUT ON PURPOSE. `A1.2`/`A1.3` (no legend) and `A1.11` (no
 * freshness metadata) fail on every page of the corpus today — #11's engine
 * doesn't emit a legend, and `model@1` has nowhere to write a date. Nobody
 * reading a case can fix either, so section 5 never reaches for
 * `report.failures` or `report.warnings` (which carry all three): it reaches
 * only for `report.semantic` — the drawing asserting what the model
 * denies, the one family the index marks `semantica: true` — which
 * structurally never contains them.
 *
 * A DETAIL PAGE THAT DIDN'T COME OUT IS THE EXCEPTION (#137). It also
 * arrives through `report.warnings` today — one string among nine on a real
 * multi-account model — but it isn't a permanent floor like the two above:
 * it's a model an agent can fix. `tools/case.cjs` lifts it out into its own
 * structured list (`detailPagesMissing`) before it ever reaches
 * `report.warnings`'s undifferentiated pile, and section 5 gets a third
 * bullet block for it.
 */

const bullets = (items, empty) => (items.length ? items : [empty]);

function section(n, title, body) {
  return [`## ${n}. ${title}`, '', ...body, ''];
}

function factsBlock(facts) {
  const asked = facts.filter(f => f.provenance === 'asked');
  // `from-candidate` (schema.json's third provenance value) has no producer
  // anywhere in this skill today, but it is not "asked" either — it goes in
  // the same bucket as `inferred` deliberately, not by falling through a
  // catch-all, so a future producer doesn't silently misfile here.
  const inferred = facts.filter(f => f.provenance === 'inferred' || f.provenance === 'from-candidate');
  return [
    '**Asked**',
    ...bullets(asked.map(f => `- ${f.fact}`), '_(nothing was asked directly)_'),
    '',
    '**Inferred**',
    ...bullets(
      inferred.map(f => `- ${f.fact}${f.from ? ` — source: ${f.from}` : ''}`),
      '_(nothing was inferred — every fact above was asked directly)_'
    ),
  ];
}

function decisionsBlock(candidates) {
  const chosen = candidates.find(c => c.state === 'chosen');
  const discarded = candidates.filter(c => c.state === 'discarded');
  return [
    chosen
      ? `**Chosen:** ${chosen.name}${chosen.because ? ` — ${chosen.because}` : ''}`
      : '_(no candidate is recorded as chosen)_',
    '',
    '**Discarded**',
    ...bullets(
      discarded.map(c => `- ${c.name}${c.because ? ` — ${c.because}` : ''}`),
      '_(no alternative was discarded — this was the only shape considered)_'
    ),
  ];
}

// Every resource name is an inference by construction (#35's journey never asks
// about one directly — see #42's user stories 32-34) — so every node that carries
// one belongs here, with none left for a separate "asked" bucket.
function inferredResourcesBlock(nodes) {
  const named = nodes.filter(n => n.technical && n.technical.resource);
  return bullets(
    named.map(n => `- ${n.label || n.id} (\`${n.id}\`): "${n.technical.resource}"`),
    '_No resource name was inferred for this drawing._'
  );
}

function attentionBlock(semanticFailures, findings, detailPagesMissing) {
  return [
    '**Semantic failures**',
    ...bullets(
      semanticFailures.map(f => `- ${f.id} ${f.name} (${f.view}): ${f.message}`),
      '_None — the drawing does not assert anything the model denies._'
    ),
    '',
    '**Gap findings**',
    ...bullets(
      findings.map(a => `- [${a.state}] ${a.rule}${a.target ? ` on \`${a.target}\`` : ''}${a.note ? ` — ${a.note}` : ''}`),
      '_No gap review was recorded for this case._'
    ),
    '',
    '**Detail views that didn\'t come out**',
    ...bullets(
      detailPagesMissing.map(m => `- "${m.account}" (${m.view}): ${m.because}`),
      '_None — every account got its own detail page._'
    ),
  ];
}

/**
 * @param {object} session                    session@1, technical stage
 * @param {object} opts
 * @param {string} opts.brief                 the original prose description, verbatim
 * @param {Array}  [opts.semanticFailures]     `{id, name, message, view}[]`, already
 *                                             flattened across both views and every
 *                                             page by the caller (`tools/case.cjs`)
 * @param {Array}  [opts.detailPagesMissing]   `{account, because, view}[]`, same
 *                                             flattening, from `report.detailPagesMissing` (#137)
 * @returns {string} `case.md`'s content
 */
function caseNotes(session, opts = {}) {
  const brief = opts.brief;
  if (!brief || !String(brief).trim())
    throw new Error('case-notes needs the original brief, verbatim — pass opts.brief');

  const d = session.dossier || {};
  const L = [`# ${session.title}`, ''];
  L.push(...section(1, 'The case', [String(brief).trim()]));
  L.push(...section(2, 'What I understood', factsBlock(d.facts || [])));
  L.push(...section(3, 'The decisions', decisionsBlock(d.candidates || [])));
  L.push(...section(4, 'What I inferred — please check', inferredResourcesBlock(session.nodes || [])));
  L.push(...section(5, 'What deserves attention',
    attentionBlock(opts.semanticFailures || [], d.findings || [], opts.detailPagesMissing || [])));

  return L.join('\n').replace(/\n+$/, '\n');
}

module.exports = { caseNotes };
