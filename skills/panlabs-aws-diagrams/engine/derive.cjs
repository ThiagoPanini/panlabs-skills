'use strict';
/**
 * Derivation: what the engine figures out on its own from the model.
 *
 * Everything here exists so the agent does NOT have to decide it. The AZ band
 * is the exemplary case: #19 decided that the AZ is a dimension of the subnet,
 * never a container, and that it becomes a drawn band only when the
 * architecture actually asserts zonal redundancy. That's an executable rule —
 * so it belongs to the engine, and the model has nowhere to write it and no
 * way to force it.
 */

const path = require('path');
const {
  camadasDeSubnets, layerGaps, layerOrder, ordemDeAcesso, chaveDePapel,
} = require('./layers.cjs');

const CATALOG_PATH = path.join(__dirname, '..', 'catalog', 'aws-shapes.cjs');
let _catalog = null;

/**
 * Derivation started depending on the catalog because of #22.
 *
 * Until now `derive` was a function of the model's semantics alone. A
 * subnet's network layer comes from the AWS CATEGORY of what it holds, and the
 * catalog (#17) is who knows the category — so it enters here. The dependency
 * is injectable (`opts.cat`) so the ruler suite can run against a test
 * catalog, and memoized because `require` already is, but building the index
 * is not.
 */
function defaultCatalog() {
  if (!_catalog) _catalog = require(CATALOG_PATH).load();
  return _catalog;
}

/**
 * SIBLING order is derived, not inherited from the file.
 *
 * #11 derived the grid ROW order for this same reason (uncertainty 4 of #7:
 * whoever writes the model is an agent, and no LLM emits the same list twice
 * in the same order). What went unnoticed there is that the CHILDREN list has
 * the same problem, and it only shows up when a container has siblings that no
 * edge connects: ELK lays out layer by layer starting from the edges, and
 * where there's no edge the tiebreak is entry order.
 *
 * Measured in the landing-zone model: the Org Management account has
 * Organizations and Control Tower with no edge between them, and shuffling
 * `nodes` swapped the two. With an edge, ELK decides and this criterion only
 * breaks ties.
 *
 * Criterion: exposure first (public before private, the deck's reading
 * order), then the NETWORK LAYER, then what's written in the box.
 *
 * #22 removed the placeholder that used to live here: the middle tiebreak was
 * alphabetical and it broke `Web · Data` and `Ingest · Core`. Now what
 * tiebreaks is the layer the subnet occupies, read from what it holds
 * (`layers.cjs`). The alphabet survived as the LAST tiebreak, and its role
 * changed: it no longer carries any meaning, it just guarantees a total order
 * among things semantics tied — which is what determinism needs.
 *
 * Exposure stays in front, and that's a decision, not inertia: a PUBLIC subnet
 * that only hosts compute still sits above a PRIVATE subnet that hosts a
 * Transit Gateway. Public on top is the deck's reading order, and the layer
 * orders within it.
 *
 * WARNING, worth saying out loud: since only a subnet has a layer, the second
 * key defaults to `NO_LAYER` for everything else, and that makes a
 * container's subnets come BEFORE the loose services that share the container
 * with them. It's a consequence, not something #22 asked for — but it's a
 * good one (in a VPC, reading the network before the loose stuff), it's
 * deterministic, and it keeps the comparator a TOTAL order. Skipping the key
 * when one of the two isn't a subnet would leave the comparator intransitive,
 * which is worse than the asymmetry.
 */
function siblingKey(n, layerOf) {
  return [
    ordemDeAcesso(n.access),
    layerOrder(layerOf(n.id)),      // only a subnet has a layer; everything else falls to the floor
    String(n.label || n.service || n.id),
    String(n.id),
  ];
}

function compareSiblings(a, b, layerOf) {
  const ka = siblingKey(a, layerOf), kb = siblingKey(b, layerOf);
  return ka[0] - kb[0] || ka[1] - kb[1] ||
    ka[2].localeCompare(kb[2], 'pt') || ka[3].localeCompare(kb[3]);
}

/**
 * Containment tree from the flat list.
 *
 * `layerOf` is optional because the tree is built TWICE: the first time with
 * no layer at all, just so it can navigate down to each subnet's descendants
 * (that's where the layer comes from); the second time already knowing the
 * layer, which is what orders the siblings. The first pass is only used to
 * query ancestry, which doesn't depend on order.
 */
function arvore(model, layerOf = () => null) {
  const byId = new Map(model.nodes.map(n => [n.id, n]));
  const filhos = new Map(model.nodes.map(n => [n.id, []]));
  const raizes = [];
  for (const n of model.nodes) {
    if (n.inside === undefined) raizes.push(n);
    else filhos.get(n.inside).push(n);
  }
  const cmp = (a, b) => compareSiblings(a, b, layerOf);
  raizes.sort(cmp);
  for (const list of filhos.values()) list.sort(cmp);
  const parent = n => n.inside === undefined ? null : byId.get(n.inside);
  const ancestrais = n => { const o = []; let c = parent(n); while (c) { o.push(c); c = parent(c); } return o; };
  const depth = n => ancestrais(n).length;
  return { byId, filhos, raizes, parent, ancestrais, depth };
}

/**
 * #19's trigger, ported to the flat IR.
 *
 *   draw = ≥2 distinct AZs AND some subnet ROLE present in ≥2 AZs
 *
 * The role is scoped by VPC: "private subnet" in VPC A and in VPC B are
 * different networks, and the repetition between them asserts no zonal
 * redundancy at all.
 */
function gatilhoAz(model, t) {
  const subnets = model.nodes.filter(n => n.kind === 'subnet');
  const azs = [...new Set(subnets.map(s => s.az).filter(Boolean))].sort();
  if (azs.length < 2)
    return { draw: false, azs, because: `only ${azs.length} distinct AZ declared` };

  // the role key is `layers.cjs`'s — the same one that becomes a grid ROW. It
  // used to be written here by hand too, and a role is a concept with one owner.
  const byRole = new Map();
  for (const s of subnets) {
    if (!s.az) continue;
    const k = chaveDePapel(s, t);
    if (!byRole.has(k))
      byRole.set(k, {
        vpc: (t.ancestrais(s).find(a => a.kind === 'vpc') || {}).id,
        access: s.access || '?',
        zones: new Set(),
      });
    byRole.get(k).zones.add(s.az);
  }
  const redundant = [...byRole.values()].filter(p => p.zones.size >= 2);
  if (!redundant.length)
    return { draw: false, azs, because: `${azs.length} AZs, but no subnet role repeats across them` };

  return {
    draw: true, azs,
    because: `${redundant.length} role(s) in ≥2 AZs: ` +
      redundant.map(p => `${p.vpc}/${p.access}×${p.zones.size}`).join(', '),
  };
}

// ------------------------------------------------------------------ multi-account

/** Nearest account in the ancestor chain. `null` = the node lives in no account at all. */
function accountFrom(no, t) {
  if (!no) return null;
  if (no.kind === 'account') return no;
  return t.ancestrais(no).find(a => a.kind === 'account') || null;
}

/**
 * The OU trigger — the exact sibling of the AZ trigger, and for the same
 * reason.
 *
 * #19 decided that the AZ is a DIMENSION of the subnet, never a container, and
 * that it becomes a drawn band only when the architecture actually asserts
 * zonal redundancy. #6's measurement says the same thing about the OU by a
 * different route: `AWS account` is an official group icon, `Organizational
 * unit` is NOT — the OU shows up as an icon+label pair floating above the
 * first member, with no box at all (G2).
 *
 * So the OU is a dimension of the account, and the trigger asks the same
 * question: does the declaration GROUP something, or does it just repeat what
 * the account's own label already says?
 *
 *   draw = some OU with ≥2 accounts   AND   some account OUTSIDE that OU
 *
 * The two clauses echo #19's exactly (≥2 zones AND a role repeated between
 * them), and each one kills a concrete case:
 *
 *   without the 1st   two OUs with one account each would get two labels that
 *                     group nothing — the account's name already tells them
 *                     apart.
 *   without the 2nd   a whole diagram inside a single OU would get one
 *                     constant label, which is a subtitle, not grouping. A
 *                     band with no contrast isn't a band.
 *
 * An account with NO OU doesn't become an anonymous OU, but it COUNTS as
 * contrast: it's the Management case, which `P2` puts on top and outside any
 * OU, and it's exactly against it that "OU – Security" means something.
 */
function gatilhoOu(model, t) {
  const accounts = model.nodes.filter(n => n.kind === 'account');
  const byOu = new Map();
  for (const c of accounts) {
    if (!c.ou) continue;
    if (!byOu.has(c.ou)) byOu.set(c.ou, []);
    byOu.get(c.ou).push(c.id);
  }
  const ous = [...byOu.keys()].sort();
  const group = ous.filter(o => byOu.get(o).length >= 2);

  if (!group.length)
    return {
      draw: false, ous,
      because: ous.length
        ? `${ous.length} OU(s), none with ≥2 accounts — the account's label already tells them apart`
        : 'no OU declared',
    };

  const outsideTheLargest = accounts.filter(c => !group.includes(c.ou));
  if (!outsideTheLargest.length && group.length < 2)
    return {
      draw: false, ous,
      because: `every account is in "${group[0]}" — a constant label is a subtitle, not a band`,
    };

  // The TRIGGER is decided by the OUs that group; the DRAWING covers all the
  // declared ones. Labeling "Security" and leaving "Workloads" bare would read
  // as if the second weren't an OU — and the SRA labels `OU – Workloads` even
  // with a single member account. Once the dimension becomes a drawing, it
  // becomes the whole drawing.
  return {
    draw: true, ous, agrupam: group, porOu: byOu,
    because: `${group.length} OU(s) with ≥2 accounts: ` +
      group.map(o => `${o}×${byOu.get(o).length}`).join(', '),
  };
}

/** Edges whose two ends live in DIFFERENT accounts. Coming in from outside doesn't count. */
function travessias(edges, t) {
  return edges.filter(a => {
    const ca = accountFrom(t.byId.get(a.from), t);
    const cb = accountFrom(t.byId.get(a.to), t);
    return ca && cb && ca.id !== cb.id;
  }).map(a => ({
    ...a,
    accountFrom: accountFrom(t.byId.get(a.from), t).id,
    accountTo: accountFrom(t.byId.get(a.to), t).id,
  }));
}

/**
 * Which of the two modes the drawing is in — and this is NOT asked of the
 * agent.
 *
 * #6 §6.7 is explicit: the INTEGRATION view (2–4 accounts, the subject is the
 * crossing) obeys different rules than the INVENTORY view (the placement map,
 * "which service lives in which account"). A generator needs to know which one
 * it's in, because the two contradict each other: the inventory one suppresses
 * every cross-account edge (`E1`, the sovereign rule — AWS's flagship diagram
 * has ZERO connectors), and the integration one exists to draw it.
 *
 * Both limits are measured, not chosen:
 *
 *   accounts 2..4  `X1` — the corpus's integration view is always this size.
 *   crossings ≤7   the official per-account views carry 2 to 7 connectors
 *                  (§4.3). Above that there's no official example, and `D1`
 *                  says what overflows the page is the EDGE count, not the
 *                  account count. So the engine falls back to inventory and
 *                  decomposes.
 */
const MAX_INTEGRATION_ACCOUNTS = 4;
const MAX_TRAVERSALS = 7;

function modoDeContas(model, t, edges) {
  const accounts = model.nodes.filter(n => n.kind === 'account');
  if (accounts.length < 2)
    return { modo: 'none', accounts: accounts.length, travessias: 0, because: `${accounts.length} account in the model` };

  const cross = travessias(edges || model.edges || [], t);
  if (!cross.length)
    return {
      modo: 'inventory', accounts: accounts.length, travessias: 0,
      because: `${accounts.length} accounts, no crossing — this is a placement map`,
    };
  if (accounts.length > MAX_INTEGRATION_ACCOUNTS)
    return {
      modo: 'inventory', accounts: accounts.length, travessias: cross.length,
      because: `${accounts.length} accounts is above the ${MAX_INTEGRATION_ACCOUNTS} the integration view holds (X1)`,
    };
  if (cross.length > MAX_TRAVERSALS)
    return {
      modo: 'inventory', accounts: accounts.length, travessias: cross.length,
      because: `${cross.length} crossings is above the ${MAX_TRAVERSALS} the official corpus shows (D1)`,
    };
  return {
    modo: 'integration', accounts: accounts.length, travessias: cross.length,
    because: `${accounts.length} accounts and ${cross.length} crossing(s) — the crossing is the subject`,
  };
}

/**
 * #6 §6.4's 6-level fallback hierarchy, applied in order, stopping at the
 * first one that fits. It's the measured answer to the ticket's question —
 * "dedicated lane? jumpStyle at the crossing? central bus?".
 *
 *   1. don't draw                    consolidated view (E1)
 *   2. numbered callout, no line     sequential, narratable relationship (E2)
 *   3. aggregated edge + label       N→1 fan-in (E3)
 *   4. lane / bus                    N siblings receiving the same link (E4)
 *   5. central hub + spokes          N→M with a real central entity
 *   6. direct edge with a lane node  exactly 2 accounts (E10)
 *
 * Level 2 is left out of the automatic choice on purpose: "narratable" isn't a
 * fact of the model, it's a judgment about the prose that goes with the
 * figure, and the IR doesn't have — and shouldn't have — anywhere to assert it.
 */
/**
 * SAME ORIGIN ISN'T ENOUGH — the edges have to be the SAME RELATIONSHIP.
 *
 * This condition wasn't in #6's initial reading and showed up in the first
 * round of cases, with the three-account model: ECS talks to the Transit
 * Gateway (VPC attachment) and to the event bus (PutEvents). Same origin, two
 * destination accounts — the naive rule would fire a bus.
 *
 * And a bus LIES here. `E4` comes from the MALZ, where the bar carries a
 * single link ("these accounts belong to this OU"), and 1 line + N stubs is
 * faithful because the link really is the same thing. Drawing a bar
 * connecting a VPC attachment and PutEvents would assert that both accounts
 * receive the same thing. `E3` has the same problem from the other side:
 * collapsing a fan-in into one labeled edge is only honest if the label's text
 * holds for every origin.
 *
 * What the IR already has to answer this is the (label, protocol) pair — which
 * is semantics, not geometry.
 */
function sameRelation(edges) {
  const key = a => `${a.label || ''}|${a.protocol || ''}`;
  return new Set(edges.map(key)).size === 1;
}

function politicaDeTravessia(modo, cross, t) {
  if (modo !== 'integration')
    return { level: 1, mechanism: 'suppress', groups: [], because: 'inventory view — E1 suppresses every crossing' };

  // fan-in: ≥2 origin accounts carrying THE SAME THING to the same destination node
  const byDestination = new Map();
  for (const a of cross) {
    if (!byDestination.has(a.to)) byDestination.set(a.to, []);
    byDestination.get(a.to).push(a);
  }
  const fanIn = [...byDestination.entries()]
    .filter(([, as]) => new Set(as.map(a => a.accountFrom)).size >= 2 && sameRelation(as));
  if (fanIn.length)
    return {
      level: 3, mechanism: 'aggregated',
      groups: fanIn.map(([to, as]) => ({ to, accounts: [...new Set(as.map(a => a.accountFrom))].sort() })),
      because: `fan-in of ${new Set(fanIn[0][1].map(a => a.accountFrom)).size} accounts into "${fanIn[0][0]}" ` +
        `with the same relationship — E3 collapses into one labeled edge`,
    };

  // bus: the SAME origin carrying THE SAME LINK to ≥2 sibling accounts
  const byOrigin = new Map();
  for (const a of cross) {
    if (!byOrigin.has(a.from)) byOrigin.set(a.from, []);
    byOrigin.get(a.from).push(a);
  }
  const bus = [...byOrigin.entries()]
    .filter(([, as]) => new Set(as.map(a => a.accountTo)).size >= 2 && sameRelation(as));
  if (bus.length)
    return {
      level: 4, mechanism: 'bus',
      groups: bus.map(([from, as]) => ({ from, accounts: [...new Set(as.map(a => a.accountTo))].sort() })),
      because: `"${bus[0][0]}" carries the same link to ` +
        `${new Set(bus[0][1].map(a => a.accountTo)).size} accounts — E4 routes through a bus, 1 line + N stubs`,
    };

  return {
    level: 6, mechanism: 'direct', groups: cross.map(a => ({ edge: a.id })),
    because: `${cross.length} crossing(s) between distinct pairs — E10 draws direct, no ceremony at the border (E8)`,
  };
}

/**
 * Where to hang each edge.
 *
 * #2 proved that a waypoint lives in the space of the edge's PARENT and that
 * the official XSD is wrong to call it absolute. There are two coherent ways
 * out: parent it to the common ancestor and emit in that space, or hang
 * everything off the root layer and emit absolute. I pick the second — with
 * `elk.json.edgeCoords: ROOT`, ELK itself already returns absolute, and #2
 * says explicitly that there the XSD's divergence is harmless. One rule, one
 * coordinate system, no conversion.
 */
function edgeParent() { return '1'; }

/** Nearest common ancestor — not used for parenting, but the layout needs to know it. */
function ancestralComum(a, b, t) {
  const ca = new Set([a.id, ...t.ancestrais(a).map(n => n.id)]);
  for (const n of [b, ...t.ancestrais(b)]) if (ca.has(n.id)) return n;
  return null;
}

function derive(model, opts = {}) {
  const cat = opts.cat || defaultCatalog();

  /**
   * The subnets' network layer, and where its absence changes the drawing
   * (#22).
   *
   * Two passes over the tree: the first just to navigate (the layer comes from
   * the subnet's DESCENDANTS, so the tree has to exist first), the second
   * already holding the layer, which is what orders the siblings.
   */
  const nav = arvore(model);
  const layers = camadasDeSubnets(model, nav, cat);
  const gaps = layerGaps(model, nav, layers);
  const layerOf = id => (layers.get(id) || {}).layer || null;

  const t = arvore(model, layerOf);
  const az = gatilhoAz(model, t);

  // AZ bands never come from the model — they're built here, one per zone, and
  // each one's box is the union of its members (#19 showed the asymmetry
  // resolving itself: the zone with fewer members shrinks).
  const faixasAz = az.draw
    ? az.azs.map(z => ({
        id: `az-${z}`,
        derived: true,
        label: `Availability Zone · ${z}`,
        members: model.nodes.filter(n => n.az === z).map(n => n.id),
      }))
    : [];

  /**
   * EDGE ORDER IS ALSO DERIVED — and this was found by measuring.
   *
   * #11 had already derived the grid ROW order for the same reason
   * (uncertainty 4 of #7): whoever writes the model is an agent, and no LLM
   * emits the same list twice in the same order. What went unnoticed there is
   * that the edge list has the same problem, and it only shows up on the paths
   * that emit edges by iterating the model — the ELK path escaped it because
   * the one returning the edge list is ELK, in its own order.
   *
   * The geometry doesn't change; what changes is the ORDER OF THE CELLS in the
   * file. And that costs two concrete things: the `.drawio` diff comes out
   * dirty with not a single pixel having moved, and document order is Z order
   * — two edges that cross swap "who's drawn on top" between runs.
   *
   * Criterion: the numbered step first (it's the order the reader sees), then
   * the endpoints. Pure semantics, like everything else the engine derives.
   */
  const edges = (model.edges || []).map((a, i) => ({
    ...a,
    id: a.id || `e-${a.from}-${a.to}${i}`,
    parent: edgeParent(),
    comum: ancestralComum(t.byId.get(a.from), t.byId.get(a.to), t),
  })).sort((a, b) =>
    (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
    String(a.from).localeCompare(String(b.from)) ||
    String(a.to).localeCompare(String(b.to)));

  // multi-account (#12) — same shape as the AZ: derived trigger, built band
  const ou = gatilhoOu(model, t);
  const modo = modoDeContas(model, t, edges);
  const cross = travessias(edges, t);
  const policy = politicaDeTravessia(modo.modo, cross, t);

  // The OU band comes from the SAME constructor as the AZ band — union of the
  // members — and differs in one field: `render`. #6 G2 measured that the OU
  // gets no box in an architecture diagram (there's no official shape for it),
  // so it's a label floating above the first member. The constructor is
  // agnostic; this line is what decides whether the union becomes a rectangle
  // or just a label anchor.
  const faixasOu = ou.draw
    ? ou.ous.map(o => ({
        id: `ou-${o.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        derived: true,
        render: 'label',
        label: `OU – ${o}`,
        members: model.nodes.filter(n => n.kind === 'account' && n.ou === o).map(n => n.id),
      }))
    : [];

  // permission enabler (E9): attached node, short arrow pointing INTO whoever
  // it authorizes — never an edge label
  const habilitadores = model.nodes
    .filter(n => n.enables)
    .map(n => ({ id: n.id, target: n.enables }));

  // same reason for the bands (their order is the Z order between bands) and
  // for the enablers (they become edges)
  const bands = [...(model.bands || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  habilitadores.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return {
    t, az, faixasAz, edges, bands,
    ou, faixasOu, modo, travessias: cross, policy, habilitadores,
    layers, gaps,
  };
}

module.exports = {
  derive, arvore, gatilhoAz, ancestralComum,
  accountFrom, gatilhoOu, travessias, modoDeContas, politicaDeTravessia,
  MAX_INTEGRATION_ACCOUNTS, MAX_TRAVERSALS,
};
