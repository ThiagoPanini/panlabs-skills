'use strict';
/**
 * A subnet's network layer — the fact the IR was missing (#22).
 *
 * The ticket's question: what decides that the "Data subnet" sits BELOW the
 * "App subnet"? Until now the order fell out of exposure + label, and the
 * alphabetical tiebreak was an assumed placeholder: it got `App · Data` right
 * by coincidence of the alphabet and got `Web · Data` and `Ingest · Core`
 * wrong, pushing the data layer up top — exactly the reading the network
 * convention doesn't want.
 *
 * The answer:
 *
 *   > What puts the data subnet at the bottom is WHAT IT HOLDS.
 *
 * It isn't a new fact asked of the agent: the catalog (#17) already knows the
 * AWS CATEGORY of every service, and the category already tells the floor.
 * `rds` is `database`, `ecs` is `containers`, `nat gateway` is
 * `network_content_delivery`. The layer is a reading of the content, and the
 * agent doesn't answer anything extra — map premise 11 (maximum AFK) stays
 * intact.
 *
 * The `layer` field exists in the schema, but as an ESCAPE HATCH, not as a
 * question: it covers what the content can't say (an empty subnet) and what it
 * would say wrong. It's semantic — it names a network floor, not a position —
 * so #11's boundary stays standing and `check-fronteira` stays green.
 *
 * What this module does NOT do is guess. With no evidence it returns `null`,
 * and whoever is drawing decides what to do with the `null`: the grid refuses
 * (there, the row order IS the drawing), the ELK path warns (there it's only a
 * tiebreak, and ELK has the edges to decide on its own).
 */

/**
 * Catalog category -> network floor.
 *
 * The table is short on purpose. It maps the categories that DO carry floor
 * meaning when the resource sits inside a subnet, and stays silent on the
 * other 21 — `management_governance`, `artificial_intelligence`,
 * `internet_of_things` and friends don't say whether the box is edge or
 * back-end, and pretending they do would trade an alphabetical placeholder for
 * a taxonomic one.
 *
 * Whoever stays silent doesn't vote. A subnet whose members all stay silent
 * ends up with no layer, and that's the same state as an empty subnet — which
 * is the case the ticket asked to surface.
 *
 * The loosest line is `security_identity_compliance`, and it's worth saying
 * why: the category as a whole isn't edge (IAM, KMS and Secrets Manager are in
 * it), but this module's scope is what lives INSIDE a subnet, and there what
 * shows up is inspection appliances — Network Firewall, WAF. A regional
 * service doesn't go inside a subnet.
 */
const CATEGORY_LAYER = {
  // edge — the floor that faces something from outside the subnet
  network_content_delivery: 'edge',
  security_identity_compliance: 'edge',

  // application — the floor that computes
  compute: 'application',
  containers: 'application',
  application_integration: 'application',
  front_end_web_mobile: 'application',

  // data — the floor that stores
  database: 'data',
  storage: 'data',
  analytics: 'data',
};

/** Top to bottom. This is the network view's reading order, and only that. */
const LAYERS = ['edge', 'application', 'data'];

/** No layer goes to the end of the exposure group — see `siblingKey` in derive.cjs. */
const NO_LAYER = 9;

function layerOrder(c) {
  const i = LAYERS.indexOf(c);
  return i < 0 ? NO_LAYER : i;
}

/**
 * Exposure, which remains the FIRST key — public on top, which is the deck's
 * reading order (#5 `O1`). The layer orders within it.
 *
 * It lives here together with the layer because the two are the same ordering
 * key split in half, and it used to be written in three places — `derive`,
 * `layout` and the rulers —, with one of them mapping "absent" to 2 and the
 * others to 9. They tied in practice (both go after `private`), but two tables
 * for one rule is one too many.
 */
const ACCESS_ORDER = { public: 0, private: 1 };

function ordemDeAcesso(a) {
  return ACCESS_ORDER[a] ?? 9;
}

/**
 * The layer of a set: the DEEPEST one it contains; whoever has none doesn't
 * vote. This is the blending rule, and it applies at both levels where we
 * aggregate — the members inside a subnet, and the subnets inside a grid row.
 */
function camadaDeGrupo(list) {
  const idx = list.map(c => LAYERS.indexOf(c)).filter(i => i >= 0);
  return idx.length ? LAYERS[Math.max(...idx)] : null;
}

/** AWS category of a leaf node, or null if it doesn't resolve to a service. */
function categoriaDoNo(no, cat) {
  const key = no.service || (no.kind === 'actor' ? 'users' : null);
  if (!key) return null;
  const s = cat.service(key);
  return s ? (s.palette || null) : null;
}

/**
 * The layer of a subnet, from what it holds.
 *
 * BLENDING RULE: the DEEPEST member wins. A subnet holding both an ALB and an
 * RDS reads as the data layer.
 *
 * It isn't taste — it's the rule protecting the invariant it exists to
 * protect. What the network convention forbids is a subnet with a database
 * ending up above a subnet without one; taking the SHALLOWEST member would
 * allow exactly that (just hang a load balancer off the database's subnet and
 * it would float up). Taking the deepest makes the invariant impossible to
 * violate: if it holds data, it doesn't rise.
 *
 * The price is known and it's in the README: an ingestion subnet that hosts
 * the brokers (MSK is `analytics`) reads as data, and the architect who wants
 * it on top declares `layer: "edge"`. The escape hatch exists for this.
 */
function camadaDaSubnet(subnet, descendants, cat) {
  const evidence = [];
  for (const n of descendants) {
    const category = categoriaDoNo(n, cat);
    const layer = category ? (CATEGORY_LAYER[category] || null) : null;
    if (layer) evidence.push({ id: n.id, service: n.service || n.kind, category, layer });
  }

  const declared = subnet.layer || null;
  const derived = camadaDeGrupo(evidence.map(e => e.layer));

  if (declared) {
    return {
      layer: declared,
      via: 'declared',
      derived,
      evidence,
      // Declaring against the content itself is a statement about the
      // architecture, not a typo — the engine obeys and reports it. Same
      // policy #16 uses for a conflict with a corporate premise: obey and
      // flag, never stay silent.
      diverge: derived && derived !== declared ? derived : null,
    };
  }
  return { layer: derived, via: derived ? 'derived' : null, derived, evidence, diverge: null };
}

/**
 * The layer of every subnet in the model, indexed by id.
 *
 * `t` is `derive.cjs`'s tree. DESCENDANT, not direct child: a service inside a
 * security group inside the subnet still counts as something the subnet holds.
 */
function camadasDeSubnets(model, t, cat) {
  const bySubnet = new Map();
  const descendantsOf = new Map();

  for (const n of model.nodes) {
    const sub = t.ancestrais(n).find(a => a.kind === 'subnet');
    if (!sub) continue;
    if (!descendantsOf.has(sub.id)) descendantsOf.set(sub.id, []);
    descendantsOf.get(sub.id).push(n);
  }

  for (const s of model.nodes.filter(n => n.kind === 'subnet'))
    bySubnet.set(s.id, camadaDaSubnet(s, descendantsOf.get(s.id) || [], cat));

  return bySubnet;
}

/**
 * THE ROLE — the unit the grid stacks, and therefore the unit that gets
 * ordered.
 *
 * Two subnets with the same label, in the same VPC and the same exposure,
 * become ONE grid row, one cell per zone (#11). So the layer that orders is
 * the role's, not the subnet's: if `data-a` holds an RDS and `data-b` is
 * empty, the row holds an RDS.
 *
 * The key is the same one `layout.cjs` uses to turn a role into a row — on
 * purpose. Having two definitions of "role" would mean having two grids.
 */
function chaveDePapel(subnet, t) {
  const vpc = (t.ancestrais(subnet).find(a => a.kind === 'vpc') || {}).id;
  return `${vpc}|${subnet.access || '?'}|${subnet.label || ''}`;
}

function papeisDeSubnet(model, t, layers) {
  const papeis = new Map();
  for (const s of model.nodes.filter(n => n.kind === 'subnet')) {
    const key = chaveDePapel(s, t);
    if (!papeis.has(key))
      // the fields come from the SUBNET, not from slicing the key back apart:
      // the key is an identifier, and reading data out of it is what breaks
      // silently the day a label contains `|`
      papeis.set(key, {
        key,
        vpc: (t.ancestrais(s).find(a => a.kind === 'vpc') || {}).id,
        access: s.access || null,
        label: s.label || '',
        subnets: [], layer: null,
      });
    papeis.get(key).subnets.push(s.id);
  }
  for (const p of papeis.values())
    p.layer = camadaDeGrupo(p.subnets.map(id => (layers.get(id) || {}).layer || null));
  return papeis;
}

/**
 * Where the missing fact changes the drawing.
 *
 * The order only IS the drawing when there's more than one ROLE to stack
 * within the same exposure, in the same VPC. A single role has nothing to be
 * ordered against, and then a subnet with no layer costs nothing — the refusal
 * doesn't fire.
 *
 * Returns one gap per group (vpc × exposure), with the orphaned roles.
 */
function layerGaps(model, t, layers) {
  const groups = new Map();
  for (const p of papeisDeSubnet(model, t, layers).values()) {
    const key = `${p.vpc}|${p.access}`;
    if (!groups.has(key)) groups.set(key, { vpc: p.vpc, access: p.access, papeis: [] });
    groups.get(key).papeis.push(p);
  }

  const gaps = [];
  for (const { vpc, access, papeis } of groups.values()) {
    if (papeis.length < 2) continue;                     // nothing to order
    const orfaos = papeis.filter(p => !p.layer);
    if (!orfaos.length) continue;
    gaps.push({
      vpc, access: access || 'no declared exposure', papeis: papeis.length,
      orfaos: orfaos.map(o => ({
        papel: o.label || `(no label: ${o.subnets.join(', ')})`,
        subnets: o.subnets,
        vazio: o.subnets.every(id => !((layers.get(id) || {}).evidence || []).length),
      })).sort((a, b) => a.papel.localeCompare(b.papel, 'pt')),
    });
  }
  return gaps.sort((a, b) => a.vpc.localeCompare(b.vpc) || a.access.localeCompare(b.access));
}

/**
 * What the engine says when the order depends on the fact that's missing.
 *
 * Returns LINES, with no marker at all: whoever presents them decides the
 * marker. The CLI puts `· ` on each error; the ELK path's warning indents.
 * Baking the bullet in here would double it in one of the two.
 */
function textoDaLacuna(gaps) {
  const lines = [];
  for (const l of gaps)
    for (const o of l.orfaos)
      lines.push(`VPC "${l.vpc}" · ${l.access}s: "${o.papel}" (${o.subnets.join(', ')}) ` +
        `doesn't say which network layer it occupies — ${o.vazio ? 'empty, nothing to infer' : 'what it holds has no network floor'}` +
        ` (${l.papeis} roles to stack)`);
  lines.push('declare `layer` ("edge" | "application" | "data") on those subnets, or put inside them the service they host');
  return lines;
}

module.exports = {
  CATEGORY_LAYER, LAYERS,
  layerOrder, ordemDeAcesso, camadaDeGrupo, categoriaDoNo, camadasDeSubnets,
  chaveDePapel, papeisDeSubnet, layerGaps, textoDaLacuna,
};
