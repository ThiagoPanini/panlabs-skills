'use strict';
/**
 * THE GAP REVIEW — protocol phase 5 (#15), in code.
 *
 *   node tools/review-gaps.cjs <model.json>
 *   const { review } = require('./session/gaps.cjs')
 *
 * #15 closed the POLICY and left the THRESHOLD open, and said why: the
 * prototype's rules fired **4 findings on a 3-node model**. Too trigger-happy.
 * #26 closes the threshold, and what closes it isn't a magic number — it's a
 * shape.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE SHAPE: precondition, measure, threshold. And the precondition is the
 * calibration.
 *
 * The prototype's flaw wasn't each rule's threshold; it was that three of its
 * four rules fired on ABSENCE:
 *
 *     "no component declares redundancy"            → SPOF
 *     "multi-account with no trust path"             → TRUST
 *     "asynchronous with no dead letter queue"        → DLQ
 *
 * A rule that fires on absence fires on every small model, because every
 * small model is almost all absence. Hence 4 findings in 3 nodes.
 *
 * The rule here:
 *
 *   > **A finding is only born over a fact the model ASSERTS, never over a
 *   > fact it doesn't mention.**
 *
 * Each rule declares the structure that needs to exist for it to have
 * anything to say. Where the model doesn't assert that structure, the rule
 * stays MUTE — which isn't the same as passing. It's the same move #22 made
 * with the AWS category that doesn't speak to network tier: *whoever stays
 * silent doesn't get a vote*. A mute rule shows up in `mudas[]` with the
 * reason, so "found nothing" never gets confused with "didn't run".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE DOES NOT DO
 *
 * It doesn't fix. Nor does it suggest a fix to the model. #15 is explicit,
 * and it's the rule that holds up the whole product: **report, propose, and
 * fix only what the user asks to be fixed.** Fixing a muted SPOF produces a
 * pretty diagram of an architecture that doesn't exist — and since diffing
 * against IaC is out of scope, nothing downstream catches it.
 *
 * It doesn't block on its own, either. What blocks is the arc (step 4 of
 * `SKILL.md`), in one batch, once.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHERE THE FACTS COME FROM
 *
 * Nowhere new. `stateful` is `CATEGORY_LAYER[category] === 'data'`, the same
 * table #22 uses to decide a subnet's tier; `egress` is the
 * `network_content_delivery` category; `asynchronous transport` is
 * `application_integration`. No list is invented for this review — if #22's
 * table is wrong, it's wrong in both places, and it's fixed in one.
 */

const path = require('path');
const { CATEGORY_LAYER, categoriaDoNo, chaveDePapel } = require(path.join(__dirname, '..', 'engine', 'layers.cjs'));
const { arvore, contaDe, travessias } = require(path.join(__dirname, '..', 'engine', 'derive.cjs'));

const CATALOG = path.join(__dirname, '..', 'catalog', 'aws-shapes.cjs');
let _cat = null;
const defaultCatalog = () => (_cat = _cat || require(CATALOG).load());

/** Guards what it guards: `data` in #22's table is exactly "has state". */
const isStateful = (node, cat) => CATEGORY_LAYER[categoriaDoNo(node, cat)] === 'data';

/** Controlled exit from the network: NAT, VPC endpoint, transit/internet gateway. */
const isEgress = (node, cat) => categoriaDoNo(node, cat) === 'network_content_delivery';

/** Asynchronous transport: queue, topic, bus. */
const isAsynchronous = (node, cat) => categoriaDoNo(node, cat) === 'application_integration';

/** Whoever computes — and so whoever FAILS while processing a message. */
const isCompute = (node, cat) => ['compute', 'containers'].includes(categoriaDoNo(node, cat));

const finding = (rule, target, because) => ({ rule, target, because });
const silence = (rule, because) => ({ rule, because });

// ---------------------------------------------------------------- graph

/** UNDIRECTED neighborhood over the leaves — the path exists in both directions. */
function adjacency(model) {
  const adj = new Map();
  const touch = id => { if (!adj.has(id)) adj.set(id, new Set()); return adj.get(id); };
  for (const a of model.edges || []) { touch(a.from).add(a.to); touch(a.to).add(a.from); }
  return adj;
}

/** Reachable from `root`, optionally without passing through `except`. */
function reach(adj, root, except = null) {
  const seen = new Set();
  const queue = [root];
  while (queue.length) {
    const id = queue.pop();
    if (id === except || seen.has(id)) continue;
    seen.add(id);
    for (const v of adj.get(id) || []) if (v !== except && !seen.has(v)) queue.push(v);
  }
  seen.delete(root);
  return seen;
}

// ---------------------------------------------------------------- the six rules

/**
 * `spof` — a single point on the path of whoever is outside.
 *
 * PRECONDITION: there's an actor, and there's an edge. With no actor there's
 * no "outside"; with no edge the model is inventory, and inventory has no
 * path to break.
 *
 * MEASURE: a node whose removal takes something an actor used to reach out of
 * that actor's reach — an articulation point, measured, not guessed.
 *
 * TWO THRESHOLDS, both calibrated against the corpus in #26:
 *
 *   1. THE PAIR. A node with a pair isn't a single point, and "pair" is a
 *      fact the model asserts: another node with the same `service`, or the
 *      node being a member of a band (this engine's way of saying "N of
 *      these"). Without this clause, every ALB in a multi-AZ drawing becomes
 *      a finding — and that's exactly the drawing that's already right.
 *
 *   2. ORPHANED ≥2. A bottleneck is somewhere ≥2 things pass through. In a
 *      chain A→B→C, B "separates" C — but saying B is C's single point of
 *      failure only says C has ONE neighbor, which is an assertion about C,
 *      not about a shared path.
 *
 *      Measured: without this clause `orders-serverless` flags the VPC
 *      endpoint ("the only path from client to ddb" — orphans exactly 1),
 *      and `logical-support` flags the audit trail for separating only the
 *      retention policy.
 *
 *   3. ONLY THE MAXIMAL ONES. A bottleneck whose orphans are ALL contained in
 *      another one's orphans is the same cut, counted again, deeper down. In
 *      a linear chain `A→B→C→D` every link is an articulation point and the
 *      sets nest — reporting all four says, four times over, *"this chain has
 *      no pair anywhere"*.
 *
 *      Measured on #26's end-to-end case: `predictive-fleet` is an
 *      end-to-end chain and used to flag SIX `spof`s on an 11-node model —
 *      worse than the #15 prototype that motivated this whole calibration.
 *      With the clause, two: the intake (everything is behind it, seen from
 *      the truck) and the alert (everything is behind it, seen from the
 *      shop) — which are in fact the two ends.
 *
 *      No information is lost: the `because` text says how many single
 *      points sit BEHIND what was reported. Fixing the outer one doesn't fix
 *      the inner ones, and the text says so instead of hiding it.
 */
const MIN_ORPHANS = 2;

function ruleSpof(model, ctx) {
  const actors = model.nodes.filter(n => n.kind === 'actor');
  const edges = model.edges || [];
  if (!actors.length || !edges.length)
    return { findings: [], silent: silence('spof', !actors.length
      ? 'nenhum ator: o modelo não afirma ninguém de fora, e sem fora não há caminho de entrada'
      : 'nenhuma aresta: é vista de inventário, e inventário não tem caminho para quebrar') };

  const adj = adjacency(model);
  const bandMembers = new Set((model.bands || []).flatMap(f => f.members || []));
  const byService = new Map();
  for (const n of model.nodes) {
    if (!n.service) continue;
    byService.set(n.service, (byService.get(n.service) || 0) + 1);
  }
  const hasPair = n => bandMembers.has(n.id) || (n.service && byService.get(n.service) > 1);

  const candidates = [];
  const alreadySeen = new Set();
  for (const actor of actors) {
    const base = reach(adj, actor.id);
    for (const cand of base) {
      if (alreadySeen.has(cand)) continue;
      const node = ctx.t.byId.get(cand);
      if (!node || node.kind === 'actor') continue;
      if (hasPair(node)) continue;
      const withoutCand = reach(adj, actor.id, cand);
      // lost someone besides the candidate itself: it was in the middle of the path
      const orphaned = new Set([...base].filter(x => x !== cand && !withoutCand.has(x)));
      if (orphaned.size < MIN_ORPHANS) continue;
      alreadySeen.add(cand);
      candidates.push({ id: cand, actor: actor.id, orphans: orphaned });
    }
  }

  // ...and now only the MAXIMAL ones: drop whoever's orphans are all inside another's.
  const contained = (a, b) => a.size < b.size && [...a].every(x => b.has(x));
  const maximal = candidates.filter(c => !candidates.some(o => o !== c && contained(c.orphans, o.orphans)));

  const findings = maximal.map(c => {
    const behind = candidates.filter(o => o !== c && contained(o.orphans, c.orphans)).length;
    return finding('spof', c.id,
      `sem par, e é o único caminho de "${c.actor}" até ${c.orphans.size} outros componentes` +
      (behind ? ` — e ${behind} deles também não tem par, atrás deste` : ''));
  });
  return { findings, silent: null };
}

/**
 * `single-az` — whatever holds state lives in a single zone.
 *
 * PRECONDITION: some subnet declares `az`. A model that doesn't speak of
 * zones gets no finding about zones — that was exactly the prototype's
 * absence-triggered firing.
 *
 * MEASURE: the subnet's ROLE (the same `chaveDePapel` that becomes a grid
 * row, and that #19's trigger uses) shows up in how many zones?
 *
 * THRESHOLD: one. And the subject is whatever holds state, not any node: a
 * Lambda in a single AZ isn't a finding, it's how Lambda works.
 */
function ruleSingleAz(model, ctx) {
  const subnets = model.nodes.filter(n => n.kind === 'subnet');
  const withAz = subnets.filter(s => s.az);
  if (!withAz.length)
    return { findings: [], silent: silence('single-az', 'nenhuma subnet declara `az`: o modelo não fala de zona') };

  const zonesByRole = new Map();
  for (const s of withAz) {
    const k = chaveDePapel(s, ctx.t);
    if (!zonesByRole.has(k)) zonesByRole.set(k, new Set());
    zonesByRole.get(k).add(s.az);
  }

  const findings = [];
  for (const s of withAz) {
    const zones = zonesByRole.get(chaveDePapel(s, ctx.t));
    if (zones.size >= 2) continue;
    for (const child of ctx.t.filhos.get(s.id) || [])
      if (isStateful(child, ctx.cat))
        findings.push(finding('single-az', child.id,
          `guarda estado e a subnet "${s.id}" existe só em ${s.az} — nenhuma outra zona tem o mesmo papel`));
  }
  return { findings, silent: null };
}

/**
 * `egress-sem-controle` — private subnet with content and no declared exit.
 *
 * PRECONDITION: there's a private subnet WITH content, inside a VPC. An
 * empty private subnet has nowhere to exit from.
 *
 * MEASURE: does the VPC have a controlled exit — INSIDE it or DOCKED to it?
 *
 * ⚠️ The second half arrived in #26, by measuring. The first version only
 * looked at the VPC's own content, and `hub-tgw-3-accounts` flagged BOTH
 * spoke VPCs: in a hub-and-spoke, the Transit Gateway is exactly the
 * controlled exit, and it lives OUTSIDE the VPCs it serves — it's a separate
 * network account. The rule was failing the drawing for the very reason that
 * makes it correct.
 *
 * So a docked exit counts too: some edge between a node inside the VPC and a
 * service in the `network_content_delivery` category. That's the docking,
 * and the docking is what the model has to assert "this is where it exits".
 *
 * THRESHOLD: zero. A single endpoint already answers the question — the
 * finding is about the exit not existing, not about it being sufficient.
 * Sizing egress is an audit, and formal audits are out of the map's scope.
 */
function ruleEgress(model, ctx) {
  const privateSubnets = model.nodes.filter(n => n.kind === 'subnet' && n.access === 'private'
    && (ctx.t.filhos.get(n.id) || []).length);
  if (!privateSubnets.length)
    return { findings: [], silent: silence('egress-sem-controle',
      'nenhuma subnet privada com conteúdo: não há de onde sair') };

  const findings = [];
  const alreadySeen = new Set();
  for (const s of privateSubnets) {
    const vpc = ctx.t.ancestrais(s).find(a => a.kind === 'vpc');
    if (!vpc || alreadySeen.has(vpc.id)) continue;
    const insideVpc = model.nodes.filter(n => n === vpc || ctx.t.ancestrais(n).some(a => a.id === vpc.id));
    if (insideVpc.some(n => isEgress(n, ctx.cat))) continue;
    // ...or DOCKED to one: the docking at the network account's Transit Gateway
    const ids = new Set(insideVpc.map(n => n.id));
    const docked = (model.edges || []).some(a => {
      const [x, y] = [ctx.t.byId.get(a.from), ctx.t.byId.get(a.to)];
      if (!x || !y) return false;
      return (ids.has(x.id) && isEgress(y, ctx.cat)) || (ids.has(y.id) && isEgress(x, ctx.cat));
    });
    if (docked) continue;
    alreadySeen.add(vpc.id);
    findings.push(finding('egress-sem-controle', vpc.id,
      `a VPC tem subnet privada com conteúdo e nenhum NAT, endpoint ou gateway — ` +
      `a saída existe na conta e não está no desenho, ou não existe`));
  }
  return { findings, silent: null };
}

/**
 * `dado-em-subnet-publica` — whatever holds state in a subnet the street can reach.
 *
 * PRECONDITION: there's a public subnet. (Here the precondition barely
 * filters anything, and that's how it has to be: the structure the rule
 * talks about IS the public subnet, and it either exists or it doesn't.)
 */
function ruleDataPublic(model, ctx) {
  const publicSubnets = model.nodes.filter(n => n.kind === 'subnet' && n.access === 'public');
  if (!publicSubnets.length)
    return { findings: [], silent: silence('dado-em-subnet-publica', 'nenhuma subnet pública declarada') };

  const findings = [];
  for (const s of publicSubnets)
    for (const child of ctx.t.filhos.get(s.id) || [])
      if (isStateful(child, ctx.cat))
        findings.push(finding('dado-em-subnet-publica', child.id,
          `guarda estado e está em "${s.id}", que é pública`));
  return { findings, silent: null };
}

/**
 * `cross-account-sem-confianca` — a crossing with no one drawn to authorize it.
 *
 * PRECONDITION: ≥2 accounts AND ≥1 crossing. Two accounts with no crossing is
 * an inventory view (#12's mode), and inventory asserts no access at all.
 *
 * MEASURE: does the crossing have an enabler (`enables`, #6's E9) at either
 * end? An IAM role, a bucket policy, an event bus policy.
 */
function ruleTrust(model, ctx) {
  const accounts = model.nodes.filter(n => n.kind === 'account');
  const crossings = accounts.length >= 2 ? travessias(model.edges || [], ctx.t) : [];
  if (accounts.length < 2 || !crossings.length)
    return { findings: [], silent: silence('cross-account-sem-confianca', accounts.length < 2
      ? `${accounts.length} conta(s): não há travessia possível`
      : `${accounts.length} contas e nenhuma travessia: é mapa de colocação, não afirma acesso`) };

  const authorized = new Set(model.nodes.filter(n => n.enables).map(n => n.enables));
  const findings = [];
  for (const a of crossings) {
    if (authorized.has(a.from) || authorized.has(a.to)) continue;
    findings.push(finding('cross-account-sem-confianca', a.id || `${a.from}→${a.to}`,
      `"${a.contaDe}" alcança "${a.contaPara}" e nenhum habilitador está desenhado nas pontas`));
  }
  return { findings, silent: null };
}

/**
 * `assincrono-sem-dlq` — a queue consumer with no destination for failures.
 *
 * PRECONDITION: some edge LEAVES an asynchronous integration service. With no
 * asynchronous transport there's no message that can die — and this was the
 * prototype's third absence-triggered firing.
 *
 * MEASURE: is the consumer COMPUTE (it's the one that fails while
 * processing; the bus → queue hop is fan-out, not consumption), and does it
 * write to some other node of the SAME service that feeds it? A dead letter
 * queue is a queue.
 *
 * THRESHOLD: zero destinations of that kind. And the same-service test is
 * derived, not a list: there's no "list of services that are a DLQ", there's
 * "whatever receives a queue's refuse is another queue".
 */
function ruleDlq(model, ctx) {
  const edges = model.edges || [];
  const feeds = edges.filter(a => {
    const q = ctx.t.byId.get(a.from);
    return q && isAsynchronous(q, ctx.cat);
  });
  if (!feeds.length)
    return { findings: [], silent: silence('assincrono-sem-dlq',
      'nenhuma aresta sai de fila, tópico ou barramento: não há caminho assíncrono') };

  const findings = [];
  const alreadySeen = new Set();
  for (const a of feeds) {
    const consumer = ctx.t.byId.get(a.to);
    const queue = ctx.t.byId.get(a.from);
    if (!consumer || !isCompute(consumer, ctx.cat)) continue;
    if (alreadySeen.has(consumer.id)) continue;
    const hasFailureDestination = edges.some(x => {
      if (x.from !== consumer.id) return false;
      const target = ctx.t.byId.get(x.to);
      return target && target.id !== queue.id && target.service === queue.service;
    });
    if (hasFailureDestination) continue;
    alreadySeen.add(consumer.id);
    findings.push(finding('assincrono-sem-dlq', consumer.id,
      `consome de "${queue.id}" e não escreve em nenhuma outra fila — ` +
      `a mensagem que ele não conseguir processar não tem para onde ir`));
  }
  return { findings, silent: null };
}

const RULES = [ruleSpof, ruleSingleAz, ruleEgress, ruleDataPublic, ruleTrust, ruleDlq];

/**
 * The names, in a single list — because the ruler and the CLI need the SAME
 * list.
 *
 * They used to be written by hand in both consumers, and a seventh rule would
 * demand three edits across three files, with a real chance the ruler starts
 * expecting five while the module delivers six. One list, one place.
 */
const NAMES = ['spof', 'single-az', 'egress-sem-controle', 'dado-em-subnet-publica',
  'cross-account-sem-confianca', 'assincrono-sem-dlq'];

/**
 * The corpus models, in order — and it lives here, alongside the rules, for a
 * reason of correctness, not tidiness: the criterion's `L2`/`L3` (*every rule
 * fires in ≥1 model AND stays mute in ≥1*) only means something if whoever
 * measures it sweeps **the whole corpus**, not a hand-copied subset. Until
 * #44 this was shared with `tools/review-gaps.cjs --corpus`, which moved out
 * with the corpus itself; the one caller left is the workbench ruler
 * (`check-gaps.cjs`), and this stays the single list either way.
 */
const CORPUS_DIRS = ['models', 'models/refusal'];

function arquivosDoCorpus(root) {
  const fs = require('fs');
  const output = [];
  for (const d of CORPUS_DIRS) {
    const dir = path.join(root, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort())
      output.push(path.join(d, f));
  }
  return output;
}

/**
 * Runs the six against a `model@1`. Pure function.
 *
 * @returns {{findings: Array, mudas: Array, ceiling: number, dentroDoTeto: boolean}}
 */
function review(model, opts = {}) {
  const cat = opts.cat || defaultCatalog();
  const ctx = { cat, t: arvore(model) };

  const findings = [], mudas = [];
  for (const rule of RULES) {
    const r = rule(model, ctx);
    findings.push(...r.findings);
    if (r.silent) mudas.push(r.silent);
  }
  findings.sort((a, b) => a.rule.localeCompare(b.rule) || String(a.target).localeCompare(String(b.target)));

  // The approval criterion's ceiling, computed right here so it doesn't turn into prose.
  const ceiling = Math.ceil(model.nodes.length / 4);
  return { findings, mudas, ceiling, dentroDoTeto: findings.length <= ceiling };
}

module.exports = {
  review, RULES, NAMES, arquivosDoCorpus, CORPUS_DIRS,
  isStateful, isEgress, isAsynchronous, isCompute,
};
