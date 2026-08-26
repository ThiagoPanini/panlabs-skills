'use strict';
/**
 * The briefing — how the next session "recovers the context of the previous
 * conversation", which is one of #14's literal questions.
 *
 * The answer that does NOT work is keeping the transcript. A transcript is
 * expensive, ages badly, and forces the next session to reread a conversation to
 * discover three facts. What gets recovered is the DOSSIER, and the briefing is
 * that dossier rendered: what was decided, what was rejected and why, what is
 * parked waiting for the technical phase, and whether the agreement still holds.
 *
 * This is what the agent reads when reopening the file. It is not an execution
 * log — it is the place it resumes the conversation from, without asking the user
 * to repeat anything.
 */

const { policy } = require('./open.cjs');

const head = t => ['', `  ${t}`, `  ${'─'.repeat(Math.max(8, t.length))}`];

function briefing(opened, extra = {}) {
  const L = [];
  const s = opened.session;

  L.push('', '  ┌─ RESUMING ' + '─'.repeat(52));
  if (!opened.ours) {
    L.push(`  │ This file is not mine: ${opened.because}`);
    L.push('  └' + '─'.repeat(63));
    return L;
  }
  L.push(`  │ Recognized by: ${opened.howIRecognized.join(' · ')}`);
  L.push(`  │ Case: ${s.title}`);
  L.push(`  │ Model stage: ${s.stage}   ·   ${s.nodes.length} nodes, ${(s.edges || []).length} edges`);
  L.push('  └' + '─'.repeat(63));

  // ---------------------------------------------------------- page states
  L.push(...head('Pages, and what the human did to them'));
  for (const p of opened.pages) {
    const mark = policy(p.state).glifo;
    L.push(`    ${mark} ${String(p.name || p.id).padEnd(34)} view=${p.view || '—'}  ${p.state}`);
    if (p.because) L.push(`        ${p.because}`);
  }
  if (opened.copyConflict)
    L.push(`    ⚠ the pages carry ${opened.copyConflict.count} DIFFERENT copies of the model — ` +
      'someone pasted a page from another file in here.');

  // ------------------------------------------------------------ the agreement
  const agreement = s.dossier && s.dossier.agreement;
  L.push(...head('The agreement'));
  if (!agreement) {
    L.push('    (none) — the logical view has not been approved. The technical phase does not start.');
  } else {
    L.push(`    approved ${agreement.at || '(no date)'}${agreement.by ? ' by ' + agreement.by : ''}` +
      `${agreement.candidate ? ', candidate ' + agreement.candidate : ''}`);
    L.push(`    covers ${agreement.snapshot.nodes.length} capabilities, ${agreement.snapshot.edges.length} flows, ${agreement.snapshot.notes.length} note(s)`);
    if (extra.agreement)
      L.push(extra.agreement.ok
        ? "    ✓ today's logical projection still matches the approved one"
        : `    ✗ ${extra.agreement.motivo}`);
    for (const d of (extra.agreement && extra.agreement.diferencas) || []) L.push(`        · ${d.text}`);
  }

  // ------------------------------------------------------------ the candidates
  const d = s.dossier || {};
  if (d.candidates && d.candidates.length) {
    L.push(...head('Candidates — the chosen one and the discarded ones'));
    for (const c of d.candidates) {
      const mark = c.state === 'chosen' ? '►' : '·';
      L.push(`    ${mark} ${c.name}${c.differsIn ? `   (differs in ${c.differsIn.join(', ')})` : ''}`);
      L.push(`        E1–E5: ${c.tuple.join(' | ')}`);
      if (c.because) L.push(`        ${c.because}`);
    }
    L.push('    The discarded ones stay so they are not re-proposed, and to answer "why not B?".');
  }

  // -------------------------------------------------------------- the findings
  if (d.findings && d.findings.length) {
    L.push(...head('Gap review — what was accepted and what was rejected'));
    for (const a of d.findings) {
      const mark = { accepted: '+', rejected: '✗', resolved: '✓' }[a.state] || '·';
      L.push(`    ${mark} ${String(a.rule).padEnd(28)} ${a.target || ''}  ${a.note || ''}`);
    }
    const rejected = d.findings.filter(a => a.state === 'rejected');
    if (rejected.length)
      L.push(`    ${rejected.length} rejection(s) travel to the drawing as a note — that is how "known and accepted SPOF" survives.`);
  }

  // --------------------------------------------------------------- the parking
  if (d.parking && d.parking.length) {
    L.push(...head('Parking — service names said too early'));
    for (const e of d.parking)
      L.push(`    ${e.state === 'returned' ? '↩' : '⏸'} ${String(e.name).padEnd(12)} → ${e.capability || ''}   ${e.note || ''}`);
    const parked = d.parking.filter(e => e.state === 'parked');
    if (parked.length)
      L.push(`    ${parked.length} waiting for the technical phase: they come back as an inferred SUGGESTION against the capability, to confirm.`);
  }

  // ----------------------------------------------------------------- the facts
  if (d.facts && d.facts.length) {
    const inferred = d.facts.filter(f => f.provenance === 'inferred');
    const unconfirmed = d.facts.filter(f => !f.confirmed);
    L.push(...head('Facts'));
    L.push(`    ${d.facts.length} facts · ${inferred.length} inferred · ${unconfirmed.length} still unconfirmed`);
    for (const f of unconfirmed) L.push(`    ⚠ unconfirmed: ${f.fact}`);
  }

  return L;
}

module.exports = { briefing };
