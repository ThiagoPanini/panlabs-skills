#!/usr/bin/env node
'use strict';
/**
 * Generation engine — IR › layout › mxGraph XML.
 *
 *   node engine/generate.cjs model.json --output diagram.drawio
 *   node engine/generate.cjs model.json --explain        # report only, writes nothing
 *
 * The whole pipeline, and the boundary it defends:
 *
 *   load › VALIDATE › resolve › derive › lay-out › plan › emit › CHECK
 *          ^^^^^^^^                                                ^^^^^^^^
 *          the agent stops here                                    XML + contrast
 *
 * The theme (#13) enters at `resolve` — BEFORE the layout, not after. Ten of
 * its tokens are metric (label body, grid density, two-line qualifier) and
 * move coordinates; the other seventeen are pure paint. The split is proved in
 * `workbench/panlabs-aws-diagrams/tests/check-partition.cjs`.
 *
 * Nothing between `lay-out` and `check` can be influenced by the model except
 * through semantics. It isn't discipline: the schema has nowhere to write a
 * coordinate. See `workbench/panlabs-aws-diagrams/tests/check-model-boundary.cjs`.
 */

const fs = require('fs');
const path = require('path');

const { validate } = require('./validate.cjs');
const resolveMod = require('./resolve.cjs');
const { derive } = require('./derive.cjs');
const layersMod = require('./layers.cjs');
const dispor = require('./layout.cjs');
const plan = require('./plan.cjs');
const { resolveEdgeLabelCollisions } = require('./labels.cjs');
const { emit, checkXml } = require('./emit.cjs');
const themeMod = require('../theme/theme.cjs');
const contrast = require('./contrast.cjs');
const { gate, LEVELS } = require('../validator/gate.cjs');

// The schema is UNIQUE and lives at the skill's root, not inside the engine:
// it's the contract for whoever writes the model, and the engine is only its
// first consumer.
const SCHEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schema.json'), 'utf8'));

/**
 * The detail views, one per account — and they are NOT a plan B.
 *
 * #6's `D2` is explicit, and the official SRA PPTX's structure proves it:
 * slide 3 is the consolidated one (6 accounts, ZERO connectors) and slides
 * 7–12 are one account each, with 2 to 7 intra-account connectors. Both are
 * published at the same time. The split doesn't happen "when it gets too
 * full" — it's structural.
 *
 * How they're built is the best proof that the engine's boundary is in the
 * right place: the detail view is the SAME engine running on a SUB-MODEL.
 * Nothing here knows how to draw; it slices out semantics and calls the
 * pipeline again.
 */
async function detailPages(model, d, res, opts, report) {
  const plan = require('./plan.cjs');
  const dispor = require('./layout.cjs');
  const pages = [];

  for (const account of model.nodes.filter(n => n.kind === 'account')) {
    const inside = new Set();
    (function mark(id) { inside.add(id); for (const k of d.t.filhos.get(id)) mark(k.id); })(account.id);

    // crossings become TEXT, not geometry — `E3`: "the text replaces the
    // cardinality". The detail view only carries intra-account edges.
    const incoming = d.travessias.filter(a => a.accountTo === account.id);
    const outgoing = d.travessias.filter(a => a.accountFrom === account.id);
    const accountName = id => {
      const c = d.t.byId.get(id);
      return (c && c.label) || id;
    };
    const notes = [];
    for (const a of outgoing)
      notes.push({ text: `Leaves this account: ${a.label || 'link'} → ${accountName(a.accountTo)}`, origin: 'legend' });
    for (const a of incoming)
      notes.push({ text: `Enters this account: ${a.label || 'link'} ← ${accountName(a.accountFrom)}`, origin: 'legend' });

    const sub = {
      schema: model.schema,
      id: `${model.id}-${account.id}`,
      title: `${account.label || account.id}`,
      subtitle: `Detail view · ${model.title}`,
      view: model.view,
      ...(model.genre ? { genre: model.genre } : {}),
      nodes: model.nodes
        .filter(n => inside.has(n.id))
        .map(n => (n.id === account.id ? { ...n, inside: undefined } : { ...n }))
        .map(n => { const c = { ...n }; if (c.inside === undefined) delete c.inside; return c; }),
      edges: (model.edges || []).filter(a => inside.has(a.from) && inside.has(a.to)),
      bands: (model.bands || []).filter(f => f.members.every(m => inside.has(m))),
      notes,
    };

    try {
      const v = validate(sub, SCHEMA);
      if (!v.ok) throw Object.assign(new Error(`invalid submodel (${v.fase})`), { errors: v.errors });
      const ds = derive(sub, { cat: res.cat });
      let p;
      if (ds.az.draw) {
        // Same dispatch as the top-level path below (`else if (d.az.draw)`),
        // scoped to the ACCOUNT instead of the cloud: on a detail page the
        // sub-model's only root IS the account (#137), so it stands where
        // the cloud stands in that check — the grid still refuses a node it
        // genuinely can't place, it just no longer refuses the whole page
        // over the account itself being the root.
        //
        // #190 — a regional service alongside the account's VPC (API Gateway,
        // Cognito, EventBridge, KMS, S3, SNS, SQS all reproduced it) is the
        // account-level mirror of #30's own outsider: a top-level node, sibling
        // of the VPC, that the grid's own tree has no row for. `#137` treated
        // it as a refusal because the check only knew ONE exemption — the
        // account/vpc/subnet tree itself; it now gets `#30`'s treatment too,
        // laid out on its own and stacked in a column beside the account's VPC.
        const outsiders = sub.nodes.filter(n =>
          n.inside === account.id && !['vpc', 'subnet'].includes(n.kind));
        const outsiderIds = new Set(outsiders.map(n => n.id));
        const unsupported = sub.nodes.filter(n => {
          if (['account', 'vpc', 'subnet'].includes(n.kind) || n.inside === undefined) return false;
          if (outsiderIds.has(n.id)) return false;                            // an outsider root itself
          const parent = ds.t.byId.get(n.inside);
          if (parent && parent.kind === 'subnet') return false;               // the grid's own tree
          return !ds.t.ancestrais(n).some(a => outsiderIds.has(a.id));        // nested inside an outsider
        });
        if (unsupported.length) {
          const e = new Error('the grid path cannot yet draw these nodes');
          e.errors = unsupported.map(n =>
            `"${n.id}" (${n.kind}) — a detail page's grid only models account › VPC › subnet › content, plus a column of standalone outsiders (#30)`);
          throw e;
        }
        const g = await dispor.porGrade(sub, ds, res);
        if (outsiders.length) g.outsiders = await dispor.layoutOutsiders(sub, ds, res, g, outsiders);
        p = plan.gridPlan(sub, ds, res, g, opts);
      } else {
        const layout = await dispor.porElk(sub, ds, res);
        p = plan.elkPlan(sub, ds, res, layout, opts);
      }
      pages.push(p);
    } catch (e) {
      // ALL of them — #190 found this warning quietly undercounting: `e.errors[0]`
      // reported one node while a real multi-service account had several, and
      // whoever read the warning had no way to tell it was a list, not a fact.
      const because = e.message + (e.errors && e.errors.length ? ` — ${e.errors.join('; ')}` : '');
      report.warnings.push(`detail view of "${account.id}" didn't come out: ${because}`);
      // Structured, alongside the string above — `report.warnings` is nine
      // lines deep by the time a real multi-account model runs (#137), and
      // the one thing worth knowing without reading all nine is THIS list.
      report.detailPagesMissing.push({ account: account.id, because });
    }
  }
  return pages;
}

async function generate(model, opts = {}) {
  const report = { warnings: [], steps: [], detailPagesMissing: [] };
  const milestone = (name, extra) => report.steps.push({ name, ...extra });

  const v = validate(model, SCHEMA);
  if (!v.ok) { const e = new Error(`invalid model (${v.fase})`); e.errors = v.errors; throw e; }
  report.warnings.push(...v.warnings);
  milestone('validate', { nodes: model.nodes.length, edges: (model.edges || []).length });

  // `--flow` overrides the theme token at invocation time: the same
  // architecture with the same theme may want the hot path marked in one
  // delivery and not in another. It overrides the token, and does NOT mutate
  // the caller's object — a theme is a value, and `withPatch` returns another
  // one.
  const base = (opts.theme && typeof opts.theme === 'object') ? opts.theme
    : themeMod.load(opts.theme || 'light');
  const theme = opts.flow ? themeMod.withPatch(base, { edge: { flow: opts.flow } }) : base;
  milestone('theme', { id: theme.id, background: theme.background, density: theme.tokens.gap.density, flow: theme.tokens.edge.flow });

  const res = resolveMod.create(theme, opts.catalog);

  const d = derive(model, { cat: res.cat });
  milestone('derive', { faixasAz: d.az.draw, because: d.az.because, azs: d.az.azs });

  // The network layer the engine read from the content (#22). The agent
  // didn't write any of it, except where it declared the escape hatch — and
  // that's exactly why it's worth reporting: the row order now depends on
  // this reading.
  for (const [id, c] of d.layers)
    if (c.diverge)
      report.warnings.push(`subnet "${id}": declared as layer "${c.layer}", ` +
        `but what it holds is "${c.diverge}" (${c.evidence.map(e => e.service).join(', ')}). ` +
        `The engine obeys the declaration.`);

  let layoutPlan, layoutPath;
  const pages = [];
  if (d.modo.modo !== 'none') {
    // multi-account decides the path, even where an AZ band is possible: the
    // account is the outermost level of the tree, and whoever picks the grid
    // is the outermost container that needs one. An AZ band inside an account
    // is that account's detail view's job (D2).
    layoutPath = 'accounts';
    const g = await dispor.porContas(model, d, res);
    layoutPlan = plan.accountPlan(model, d, res, g, opts);
    milestone('dispor', {
      modo: d.modo.modo, accounts: d.modo.accounts, travessias: d.modo.travessias,
      order: g.order.map(c => c.id).join('→'),
      varredura: g.varredura.varridas ? `${g.varredura.varridas} permutations, cost ${g.varredura.custo}` : 'canonical',
    });
    report.warnings.push(`mode "${d.modo.modo}": ${d.modo.because}`);
    report.warnings.push(`crossing level ${d.policy.level} (${d.policy.mechanism}): ${d.policy.because}`);
    // The trigger (`d.ou.draw`) only knows about the ACCOUNT — not the mode.
    // `plan.cjs` (§3) suppresses the band in integration mode, and the warning
    // used to be blind to that second condition: it announced the band even
    // when the `.drawio` came out with none. The warning now only asserts what
    // the drawing actually has.
    if (d.ou.draw) {
      report.warnings.push(d.modo.modo === 'integration'
        ? `OU bands: ${d.ou.because}, but integration mode doesn't draw an OU band`
        : `OU bands: ${d.ou.because}`);
    }
    pages.push(...await detailPages(model, d, res, opts, report));
  } else if (d.az.draw) {
    layoutPath = 'grade';
    // The grid path is a NETWORK view: it knows how to draw cloud › VPC ›
    // subnet › content, plus — since #30 — a COLUMN of outsiders around the
    // cloud's own box (`dispor.layoutOutsiders`): any top-level node besides
    // the cloud/VPC/subnet tree itself, leaf or container, laid out on its
    // own and stacked to the cloud's left, the entry side by #5's O19. What
    // still refuses is a node the grid genuinely can't place anywhere: not
    // inside a subnet, and not inside one of those outsiders either —
    // silencing it would produce a diagram that omits part of the
    // architecture with no warning, exactly the kind of silent lie the
    // rubric (#8) calls A4.2.
    const outsiders = model.nodes.filter(n =>
      !['cloud', 'vpc', 'subnet'].includes(n.kind) && n.inside === undefined);
    const outsiderIds = new Set(outsiders.map(n => n.id));
    const unsupported = model.nodes.filter(n => {
      if (['cloud', 'vpc', 'subnet'].includes(n.kind) || n.inside === undefined) return false;
      const parent = d.t.byId.get(n.inside);
      if (parent && parent.kind === 'subnet') return false;               // the grid's own tree
      return !d.t.ancestrais(n).some(a => outsiderIds.has(a.id));          // nested inside an outsider
    });
    if (unsupported.length) {
      const e = new Error('the grid path cannot yet draw these nodes');
      e.errors = unsupported.map(n => `"${n.id}" (${n.kind}) — the AZ grid only models cloud › VPC › subnet › content, plus a column of standalone outsiders (#30)`);
      throw e;
    }
    const g = await dispor.porGrade(model, d, res);
    if (outsiders.length) g.outsiders = await dispor.layoutOutsiders(model, d, res, g, outsiders);
    layoutPlan = plan.gridPlan(model, d, res, g, opts);
    milestone('dispor', {
      eixo: g.eixo,
      raias: g.zonas.join('/'),
      varredura: g.varreduraRaias.varridas
        ? `${g.varreduraRaias.varridas} permutations, cost ${g.varreduraRaias.custo}`
        : 'declared order',
      ...(outsiders.length ? { outsiders: outsiders.map(n => n.id).join(',') } : {}),
    });
    report.warnings.push(`grid axis "${g.eixo}": ${g.whyAxis}`);
  } else {
    layoutPath = 'elk';
    /**
     * Here the missing layer WARNS, not refuses — and the asymmetry with the
     * grid is #22's decision, not an oversight.
     *
     * The engine demands the fact where the fact IS the drawing, and warns
     * where it's only a tiebreak. In the grid, the role key alone drives the
     * row order; in ELK it only decides between siblings that no edge orders,
     * and ELK has the whole graph to drive it. Refusing here would block the
     * common case over an ambiguity that almost never reaches the drawing.
     */
    if (d.gaps.length)
      report.warnings.push('network layer missing where sibling order depends on it — ' +
        'ELK decides from the graph, the alphabet breaks the rest of the ties:\n      ' +
        layersMod.textoDaLacuna(d.gaps).join('\n      '));
    const layout = await dispor.porElk(model, d, res);
    layoutPlan = plan.elkPlan(model, d, res, layout, opts);
    milestone('dispor', { passadas: layout.passadas });
    if (layout.snap) {
      for (const a of layout.snap.applied)
        report.warnings.push(`snap: "${a.edge}" aligned by moving ${a.moved.join('+')} by ${a.delta}px`);
      for (const x of layout.snap.undone)
        report.warnings.push(`snap UNDONE on "${x.edge}" (${x.delta}px): ${x.because}`);
    }
  }
  milestone('plan', {
    path: layoutPath, cells: layoutPlan.cells.length, page: `${layoutPlan.width}×${layoutPlan.height}`,
    // Always shown once the model IS multi-account, pages.length===0
    // included: "1/3" says as much on its own as reading all nine warnings
    // does, and it says it in the one milestone nobody skips (#137).
    ...(layoutPath === 'accounts' ? { pages: `${1 + pages.length}/${1 + d.modo.accounts}` } : {}),
  });

  // #40 — a label that would collide with another's slides along its own
  // edge before the gate ever measures it. One page at a time: a label
  // clashing on the main page says nothing about a detail view's own.
  const labelMoves = [layoutPlan, ...pages].flatMap(p => resolveEdgeLabelCollisions(p));
  if (labelMoves.length)
    milestone('labels', { moved: labelMoves.length, edges: labelMoves.map(m => m.id).join(', ') });

  /**
   * THE GEOMETRIC GATE (#18) — between `plan` and `emit`, the only point where
   * the geometry already exists and the XML doesn't yet.
   *
   * #18 wrote the decision and left the graft undone on purpose ("the engine
   * is another ticket's prototype"). #23's consolidation applies it, and picks
   * the default with care:
   *
   *   THE REPORT ALWAYS COMES OUT. It travels in `report.geometry` and
   *   `--explain` prints it. A gate that only exists when someone asks for it
   *   is a gate nobody knows exists.
   *
   *   BLOCKING IS OPT-IN (`--gate`). #18 itself calls `veracidade` (truthfulness)
   *   the "recommended default for a PUBLISHING gate" — publishing, not
   *   drawing. Blocking inside `generate` would make the engine refuse
   *   `web-flow-3-az`, which is real debt, named and with a known owner (#24):
   *   generation would stop over a routing defect this ticket decided not to
   *   fix. Refusing to draw is a decision for whoever is delivering it, and it
   *   has its own moment.
   *
   *   WARNING: AND WHO DECIDES WHETHER TO BLOCK IS `gate()`, NOT THIS FILE.
   *   This section's first version called `gate(p, {level:'none'})` inside a
   *   `try` and reimplemented `LEVELS[level](report)` out here — and by doing
   *   that it swallowed #18's most important guarantee: *"an incomplete report
   *   never passes, AT NO LEVEL"*. A broken check family would turn into
   *   `{error: ...}`, the `if (!report) continue` would skip the page, and the
   *   gate would come out green over a report that measured nothing. Calling
   *   `gate()` with the requested level and letting it throw is, at the same
   *   time, the fix and the simplification.
   */
  const level = opts.gate || 'none';
  if (!(level in LEVELS)) {
    const e = new Error(`unknown gate level: "${level}"`);
    e.errors = [`levels: ${Object.keys(LEVELS).join(', ')}`];
    throw e;
  }
  const reports = [];
  for (const [i, p] of [layoutPlan, ...pages].entries()) {
    const page = p.id || `p${i}`;
    try {
      reports.push({ page, report: gate(p, { level }) });
    } catch (e) {
      e.message = `page "${page}": ${e.message}`;
      throw e;
    }
  }
  report.geometry = reports;
  const semantic = reports.flatMap(l => l.report.semantic);
  const failures = reports.flatMap(l => l.report.failures);
  milestone('geometry', {
    pages: reports.length,
    failure: failures.length,
    semantic: semantic.length,
    gate: level,
  });
  // a SEMANTIC failure is the drawing lying, and that's worth a warning even
  // when nobody asked for a gate — otherwise the engine would silently
  // deliver what the rubric calls "the validator's most severe failure family"
  for (const f of semantic)
    report.warnings.push(`⛔ ${f.id} ${f.name}: ${f.message} — the drawing asserts what the model denies`);

  const xml = emit([layoutPlan, ...pages]);

  // #19 found this the expensive way: invalid XML makes draw.io render
  // truncated and exit with code 0. If the generator doesn't check, nobody
  // does.
  const malformed = checkXml(xml);
  if (malformed.length) { const e = new Error('malformed XML — draw.io would render it truncated in silence'); e.errors = malformed; throw e; }
  /**
   * CONTRAST GATE (#13) — and it FAILS, it doesn't just warn.
   *
   * Same reason as the truncated XML above: a label that disappears throws no
   * error anywhere. The file opens, the PNG comes out, and the diagram starts
   * silently omitting information — which is rubric family A4.2 (#8), the
   * diagram lying by omission. A theme is a hypothesis; here it becomes a
   * number.
   *
   * Runs over ALL pages (`measureAll`), not just the consolidated one: with
   * #12 the file started carrying 1+N pages, and a gate that only looked at
   * the first would leave the detail views with no guard at all.
   */
  const c = contrast.measureAll([layoutPlan, ...pages]);
  report.contraste = c;
  if (!c.ok && !opts.force) {
    const e = new Error(`theme "${theme.id}" fails the contrast gate (rubric #8's A7)`);
    e.errors = [...contrast.summarize(c), '', 'to generate anyway and SEE the damage: --force'];
    throw e;
  }
  if (!c.ok) report.warnings.push(`--force: ${c.failures.length} pair(s) below the WCAG threshold, generated anyway`);
  // A7.2a is AREA: it warns and doesn't fail (see contrast.cjs's header)
  for (const l of contrast.summarize(c, c.warnings)) report.warnings.push(l);
  const n = v => Number.isFinite(v) ? v.toFixed(2) : '-';
  milestone('check', { ok: true, bytes: xml.length,
    contraste: c.ok ? 'passes' : 'FORCED',
    piorTexto: n(c.piorTexto), piorTraco: n(c.piorGrafismo), piorArea: n(c.piorArea) });

  // leaves that fell back to the generic icon are the symptom of a name the
  // catalog doesn't know — worth a warning, not worth failing
  const generic = res.used.filter(u => u.via === 'generic');
  if (generic.length)
    report.warnings.push(`${generic.length} node(s) fell back to the generic icon: ` +
      generic.map(u => `${u.id}("${u.asked}")`).join(', '));

  return { xml, layoutPlan, pages, report, resolutions: res.used, derived: d, path: layoutPath, theme };
}

// ------------------------------------------------------------------- CLI

async function main() {
  const args = process.argv.slice(2);
  const input = args.find(a => !a.startsWith('--'));
  if (!input) {
    console.error('usage: node engine/generate.cjs <model.json> [--output file.drawio] [--theme ' +
      themeMod.listAll().join('|') + '] [--flow solid|dashed|animated] [--force]\n' +
      '                            [--gate ' + Object.keys(LEVELS).join('|') + '] [--explain]');
    process.exit(2);
  }
  const iOutput = args.indexOf('--output');
  const output = iOutput >= 0 ? args[iOutput + 1] : input.replace(/\.json$/, '.drawio');
  const explain = args.includes('--explain');
  const iFlow = args.indexOf('--flow');
  const flow = iFlow >= 0 ? args[iFlow + 1] : null;
  if (flow && !['solid', 'dashed', 'animated'].includes(flow)) {
    console.error(`--flow accepts solid | dashed | animated (got "${flow}")`);
    process.exit(2);
  }
  const iTheme = args.indexOf('--theme');
  const themeName = iTheme >= 0 ? args[iTheme + 1] : 'light';
  const force = args.includes('--force');
  const iGate = args.indexOf('--gate');
  const gateLevel = iGate >= 0 ? args[iGate + 1] : 'none';

  let model;
  try { model = JSON.parse(fs.readFileSync(input, 'utf8')); }
  catch (e) { console.error(`could not read ${input}: ${e.message}`); process.exit(1); }

  let r;
  try { r = await generate(model, { flow: flow || undefined, theme: themeName, force, gate: gateLevel }); }
  catch (e) {
    console.error(`\n✗ ${e.message}`);
    for (const row of e.errors || []) console.error(`    · ${row}`);
    process.exit(1);
  }

  for (const p of r.report.steps)
    console.log(`  ${p.name.padEnd(10)} ${Object.entries(p).filter(([k]) => k !== 'name')
      .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : v}`).join('  ')}`);
  for (const a of r.report.warnings) console.log(`  ⚠ ${a}`);
  if (r.theme.tokens.edge.flow === 'animated')
    console.log('  ⚠ "animated" flow is only visible in SVG or HTML. #4 measured it and this engine confirms: ' +
      'exported to PNG it becomes a STATIC dashed line, with no error at all. Export with -f svg.');

  if (explain) {
    console.log('\n  name resolution through the catalog:');
    // the engine resolves the same node more than once (pre-measurement +
    // layout); the audit trail matters per node, not per call
    const seen = new Set();
    for (const u of r.resolutions.filter(u => !seen.has(u.id) && seen.add(u.id)))
      console.log(`    ${String(u.id).padEnd(20)} "${u.asked}" → ${u.became}  [${u.via}]` +
        (u.corrections && u.corrections.length ? `  corrections: ${u.corrections.join(', ')}` : ''));

    // The network layer is derived but invisible in the drawing — only the
    // ORDER gives it away. Without a trail, "why did the Data subnet end up at
    // the bottom?" can only be answered by rereading the code.
    if (r.derived.layers.size) {
      console.log('\n  subnet network layer (#22):');
      for (const [id, c] of r.derived.layers)
        console.log(`    ${String(id).padEnd(20)} ${String(c.layer || '—').padEnd(11)} [${c.via || 'no evidence'}]` +
          (c.evidence.length ? `  ← ${c.evidence.map(e => `${e.service}(${e.category})`).join(', ')}` : ''));
    }

    // The geometric report (#18), page by page. It shows up here because
    // `--explain` is the engine's audit trail: whoever wants to know WHY the
    // drawing came out this way wants both lists, the catalog's and the
    // rubric's.
    console.log('\n  geometric report (#18):');
    for (const { page, report } of r.report.geometry) {
      const s = report.summary;
      console.log(`    ${String(page).padEnd(38)} ${s.ok} ok · ${s.warning} warning · ${s.failure} failure · ` +
        `${s.notApplicable} n/a · ${s.skipped} from the render`);
      for (const f of report.semantic)
        console.log(`      ⛔ ${f.id} ${f.name}: ${f.message}`);
      if (report.failures.length)
        console.log(`      findings: ${report.failures.map(f => f.id).join(', ')}`);
    }
    return;
  }

  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, r.xml);
  console.log(`\n  → ${output}  (${r.xml.length} bytes, path "${r.path}")`);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });

module.exports = { generate, SCHEMA };
