'use strict';
/**
 * The copy that CIRCULATES — and why it's a different file from the one that resumes.
 *
 * The ⚠️ the map carried without a verdict: the `.drawio` file the user emails
 * out carries inside it, in text readable by anyone via *Extras › Edit
 * Diagram*, the discarded candidates with the reason they were discarded, the
 * findings the team REJECTED along with the justification, the thing someone
 * said in the meeting, and the name of whoever approved it. #14 put all of
 * that there by measurement — a sidecar goes out of sync — and the
 * measurement is still right. What was missing was recognizing that **the
 * file that resumes and the file that circulates are not the same file**.
 *
 * ## The decision
 *
 * Two outputs, one format. `draw` keeps writing the whole dossier: it's the
 * WORKING file, and it's what the next session is born from. `publish`
 * produces the copy that leaves the house, without the deliberation, and its
 * seal **says it does not resume** — instead of looking like a corrupted
 * working file.
 *
 * Why not always strip it: stripping by default undoes #14 entirely. The
 * session disappears on the first save and the skill goes back to depending
 * on someone remembering.
 *
 * Why not always keep it: the exposure is real, and today the user has no way
 * to even see it. "It's hidden in an attribute" isn't a security property —
 * it's a two-click menu.
 *
 * Why a VERB and not a generation option: sending the file to someone is an
 * act, and acts have a moment. A generation-time option would force deciding
 * on privacy at the wrong moment — when the drawing is born, not when it goes
 * out.
 *
 * ## The rule for what leaves
 *
 * **What leaves is whatever is about PEOPLE and about PATHS NOT TAKEN. What
 * stays is whatever is about the architecture that got drawn.**
 *
 * The rule has a consequence worth saying out loud: almost nothing that stays
 * is secret, because almost everything that stays is already in the drawing.
 * The model IS the architecture, and the architecture is in the PNG. What
 * leaves is the conversation that led to it.
 *
 * | field | in the copy | why |
 * |---|---|---|
 * | `nodes`/`edges`/`bands`/`notes` | stays | it's the drawing in text; whoever sees the image already knows |
 * | `dossier.axes` | stays | describes the CHOSEN architecture, which is drawn |
 * | discarded `candidates` | **leaves** | internal deliberation: "why not B" is an in-house conversation |
 * | chosen `candidates` | stays minus `because`/`pays`/`buys`/`chooseIf`/`wrongIf`/`differsIn` | the name and the tuple describe the drawing; the rest is the argument |
 * | `findings[].note` | **leaves** | this is where "the team accepted it for budget reasons" lives |
 * | `findings[]` rule/target/state | stays | WHAT was found is technical, and the rejection already travels as a note on the drawing (#14) |
 * | `parking` | **leaves whole** | it's something a person said in a meeting, in quotes |
 * | `facts[].from` | **leaves** | the citation. The `fact` stays: it's the architecture's premise |
 * | `agreement.by` | **leaves** | a person's name |
 * | `agreement.snapshot` | **leaves** | it's the approved logical view, i.e., phase 1's deliberation |
 * | `agreement.fingerprint`/`at`/`view` | stays | they prove THAT it was approved and WHEN, without saying by whom or what |
 *
 * ## What the copy does NOT try to be
 *
 * It isn't anonymization and it isn't encryption. A node's label can say
 * "RDS · customer X's card data" and that stays in the drawing, because it IS
 * the drawing. The rule here is a single one: **whatever the PNG's reader
 * already sees can stay; whatever only existed in the conversation, cannot.**
 */

const { reescreverSelos } = require('./fingerprint.cjs');

const PUBLISHED_SCHEMA = 'panlabs-aws-diagrams/published@1';

/**
 * THE RULE, AS DATA — a single list, and it's what the three things that need
 * to agree come from: what the pruning strips, what the warning counts, and
 * what the check plants.
 *
 * Writing the rule three times is the mistake this file made in its first
 * version, and that review caught: the pruning stripped `buys` and
 * `differsIn`, the counter didn't look at them, and a session whose only
 * deliberation was a `buys` field got pruned while the CLI said *"nothing —
 * the file already carried no deliberation"*. With the list living here,
 * drifting apart requires touching all three at once.
 *
 * `onde` is the path in the dossier; `campos` is what leaves each item;
 * `filtro` (when present) says which ITEMS disappear whole.
 */
const DELIBERATION = [
  { onde: 'candidates', filtro: c => c.state === 'discarded',
    campos: ['because', 'pays', 'buys', 'chooseIf', 'wrongIf', 'differsIn'],
    because: 'as candidatas descartadas somem; da escolhida sobra o que descreve o desenho' },
  { onde: 'findings', campos: ['note'],
    because: 'o QUE foi achado é técnico; o texto costuma citar a conversa' },
  { onde: 'parking', filtro: () => true, campos: ['note'],
    because: 'é fala de pessoa em reunião, com aspas' },
  { onde: 'facts', campos: ['from'],
    because: 'a citação sai; o fato fica, é premissa da arquitetura' },
  { onde: 'agreement', campos: ['by', 'snapshot'],
    because: 'nome de pessoa, e a deliberação da fase lógica' },
];

const listOf = (d, key) => (Array.isArray(d[key]) ? d[key] : d[key] ? [d[key]] : []);

/** The session without the deliberation. Pure function: returns another one, doesn't mutate the one inside. */
function prune(session) {
  const s = JSON.parse(JSON.stringify(session));
  const d = s.dossier;
  if (!d) return s;

  for (const r of DELIBERATION) {
    if (d[r.onde] === undefined) continue;
    const isList = Array.isArray(d[r.onde]);
    let items = listOf(d, r.onde);
    if (r.filtro) items = items.filter(x => !r.filtro(x));
    // `parking` disappears whole: its filter matches every item
    if (r.filtro && !items.length && isList && r.onde === 'parking') { delete d[r.onde]; continue; }
    for (const it of items) for (const c of r.campos) delete it[c];
    d[r.onde] = isList ? items : items[0];
  }
  return s;
}

/** How many deliberation items a session still carries. Same list as the pruning. */
function countDeliberation(session) {
  const d = (session && session.dossier) || {};
  let n = 0;
  for (const r of DELIBERATION) {
    for (const it of listOf(d, r.onde)) {
      // an item the rule sends away WHOLE counts once, not once per field
      // inside it — otherwise a discarded candidate with a `because` would
      // show up as two items
      if (r.filtro && r.filtro(it)) { n += 1; continue; }
      if (r.campos.some(c => it[c] !== undefined)) n += 1;
    }
  }
  return n;
}

/**
 * Rewrites the seal on every page for the publishable version.
 *
 * The FINGERPRINTS stay, on purpose: they're hashes of the DRAWING, not of
 * the dossier, and they're what lets whoever receives the file prove that the
 * PNG they're looking at is what came out of here. Removing them wouldn't
 * protect anything, and it would take away the only guarantee the copy can
 * still give.
 */
const DEFAULT_BECAUSE =
  'copia publicada: a deliberacao da sessao (candidatas descartadas, motivo das recusas, ' +
  'estacionamento, quem aprovou) foi podada. Retome a partir do arquivo de trabalho.';

function publish(xml) {
  const r = reescreverSelos(xml, p => {
    const seal = p.seal || {};
    let session = null;
    try { session = JSON.parse(seal.panlabsSessao); } catch (e) { session = null; }
    return {
      panlabsSchema: PUBLISHED_SCHEMA,
      panlabsVista: seal.panlabsVista,
      panlabsSemantica: seal.panlabsSemantica,
      panlabsAparencia: seal.panlabsAparencia,
      panlabsMotor: seal.panlabsMotor,
      panlabsRetomavel: 'nao',
      panlabsPorque: DEFAULT_BECAUSE,
      panlabsSessao: session ? JSON.stringify(prune(session)) : '',
    };
  });
  if (r.pages.every(p => !p.seal || !p.seal.panlabsSessao))
    throw new Error('no page carries a session seal — there is no dossier to prune');
  return r.xml;
}

/**
 * The one-line warning, in the pattern #16 fixed: it warns, doesn't block,
 * and names what to do. It lives here and not in `save.cjs` because this
 * module is the one that knows what counts as deliberation — the rule lives
 * in one place.
 */
function dossierWarning(session) {
  /**
   * Counts PRESENT DELIBERATION, using the SAME list the pruning uses.
   *
   * Two traps #23's review caught, and both were the same mistake — the rule
   * written twice:
   *
   *   · counting by STATE made the pruned copy warn about deliberation it no
   *     longer carries (it keeps that a finding was rejected — a technical
   *     fact — but not the reason);
   *   · counting by state AND by field double-counted the same candidate.
   */
  const count = countDeliberation(session);
  if (!count) return null;
  return `este arquivo carrega ${count} item(ns) de deliberacao no selo — candidata descartada, ` +
    'recusa com motivo, estacionamento ou quem aprovou. Legiveis em Extras > Editar diagrama. ' +
    'Para mandar para fora, gere a copia publicada (session/publish.cjs).';
}

// ------------------------------------------------------------------- CLI

function main() {
  const fs = require('fs');
  const path = require('path');
  // ⚠️ `--output x.drawio y.drawio` — a flag's value is NOT the input. The
  // first version used `args.find(a => !a.startsWith('--'))`, and with the
  // flag up front, it published the OUTPUT file.
  const args = process.argv.slice(2);
  const iOutput = args.indexOf('--output');
  if (iOutput >= 0 && args[iOutput + 1] === undefined) {
    console.error('--output needs a path');
    process.exit(2);
  }
  // ⚠️ `i !== iOutput + 1` skips `--output`'s value — but with `iOutput = -1`
  // it was skipping INDEX 0, which is exactly the positional argument for the
  // form without `--output`. `node session/publish.cjs output/retail.drawio`
  // answered with the usage text, which makes the README's line look wrong
  // when the guard is what's actually wrong. Found in #24, while regenerating
  // the published copy.
  const input = args.find((a, i) => !a.startsWith('--') && !(iOutput >= 0 && i === iOutput + 1));
  if (!input) {
    console.error('usage: node session/publish.cjs <working.drawio> [--output <copy>.drawio]');
    console.error('  Produces the copy that CIRCULATES: no discarded candidates, no rejection');
    console.error('  reasons, no parking, and no approver. It does NOT resume the session.');
    process.exit(2);
  }
  const output = iOutput >= 0 ? args[iOutput + 1] : input.replace(/\.drawio$/, '') + '.published.drawio';
  const xml = fs.readFileSync(input, 'utf8');
  let copy;
  try { copy = publish(xml); }
  catch (e) { console.error(`\n✗ ${e.message}`); for (const l of e.erros || []) console.error(`    · ${l}`); process.exit(1); }

  let session = null;
  try {
    session = JSON.parse(require('./fingerprint.cjs').readPages(xml).pages[0].seal.panlabsSessao);
  } catch (e) { /* no readable seal */ }
  const before = session ? countDeliberation(session) : 0;

  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, copy);
  console.log(`  → ${output}  (${copy.length} bytes, was ${xml.length})`);
  console.log(before
    ? `  pruned: ${before} deliberation item(s) — ` +
      DELIBERATION.map(r => r.onde).join(', ')
    : '  pruned: nothing — the file already carried no deliberation');
  console.log('  this copy does NOT resume the session. Keep the working file.');
}

if (require.main === module) main();

module.exports = { publish, prune, dossierWarning, countDeliberation, PUBLISHED_SCHEMA, DELIBERATION };
