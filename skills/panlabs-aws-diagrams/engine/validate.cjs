'use strict';
/**
 * Model validation — three layers, and the order between them matters.
 *
 *   1. schema       — shape. A hand-written draft-07 subset validator.
 *   2. references   — `inside`, `from`/`to`, `members`, `about` point to nodes that exist,
 *                     and containment really is a tree.
 *   3. domain       — what only makes sense in AWS architecture: subnet outside a VPC,
 *                     service in the logical view, AZ asserted on something that isn't a subnet.
 *
 * Why a hand-written validator instead of `ajv`: premise 7 of the map requires the
 * skill to be self-contained, with no `npm install` at runtime. Every embedded
 * dependency is weight the skill carries forever. `elkjs` (1.6 MB) pays its own
 * price because layout is math that can't be improvised; a validator for the
 * subset THIS schema uses fits in ~150 lines and doesn't cost the same.
 */

const RESERVED = new Set(['definitions', '$schema', '$id', 'title', 'description', 'default']);

// ----------------------------------------------------------- 1. schema

function resolveRef(ref, root) {
  if (!ref.startsWith('#/')) throw new Error('external $ref not supported: ' + ref);
  return ref.slice(2).split('/').reduce((o, k) => o[k], root);
}

/** Validates `data` against `schema`. Returns a list of errors (empty = valid). */
function againstSchema(data, schema, root, path = '') {
  const errors = [];
  const where = path || '(root)';

  if (schema.$ref) return againstSchema(data, resolveRef(schema.$ref, root), root, path);

  if (schema.const !== undefined && data !== schema.const)
    errors.push(`${where}: expected the literal ${JSON.stringify(schema.const)}, got ${JSON.stringify(data)}`);

  if (schema.enum && !schema.enum.includes(data))
    errors.push(`${where}: ${JSON.stringify(data)} is not in [${schema.enum.join(', ')}]`);

  if (schema.type) {
    const typeOf = v => Array.isArray(v) ? 'array' : v === null ? 'null'
      : Number.isInteger(v) ? 'integer' : typeof v;
    const t = typeOf(data);
    // `type` as a LIST is legitimate draft-07 and #11 didn't need it; the theme
    // schema does (`revision` is string or null). A union of types passes if any
    // member passes.
    const accepts = target => target === 'integer' ? t === 'integer'
      : target === 'number' ? (t === 'integer' || t === 'number')
      : t === target;
    const targets = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!targets.some(accepts)) {
      errors.push(`${where}: expected ${targets.join(' or ')}, got ${t}`);
      return errors;   // without the right type, the checks below only produce noise
    }
  }

  if (typeof data === 'string') {
    if (schema.minLength !== undefined && data.length < schema.minLength)
      errors.push(`${where}: string is empty or too short (minimum ${schema.minLength})`);
    if (schema.maxLength !== undefined && data.length > schema.maxLength)
      errors.push(`${where}: string is too long (maximum ${schema.maxLength})`);
    if (schema.pattern && !new RegExp(schema.pattern).test(data))
      errors.push(`${where}: ${JSON.stringify(data)} doesn't match /${schema.pattern}/`);
  }

  if (typeof data === 'number' && schema.minimum !== undefined && data < schema.minimum)
    errors.push(`${where}: ${data} is less than the minimum ${schema.minimum}`);

  if (Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems)
      errors.push(`${where}: needs at least ${schema.minItems} item(s), has ${data.length}`);
    if (schema.items) data.forEach((v, i) => errors.push(...againstSchema(v, schema.items, root, `${where}[${i}]`)));
  }

  if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const req of schema.required || [])
      if (!(req in data)) errors.push(`${where}: missing required property "${req}"`);

    if (schema.properties) {
      for (const [k, sub] of Object.entries(schema.properties))
        if (k in data) errors.push(...againstSchema(data[k], sub, root, path ? `${path}.${k}` : k));
    }

    // `patternProperties` — a key that matches a pattern counts as declared, and
    // its value is validated against the pattern's sub-schema. Without this, a
    // closed schema only knows how to ENUMERATE, and enumerating free-form
    // commentary is a contradiction: that's what failed `_conferir` on a case
    // artifact that the `_`, `_reparenta` and `_refina` in the list didn't cover.
    const patterns = Object.entries(schema.patternProperties || {}).map(([p, sub]) => [new RegExp(p), sub]);
    for (const [re, sub] of patterns)
      for (const k of Object.keys(data))
        if (re.test(k) && !(schema.properties && k in schema.properties))
          errors.push(...againstSchema(data[k], sub, root, path ? `${path}.${k}` : k));

    if (schema.additionalProperties === false && schema.properties) {
      for (const k of Object.keys(data))
        if (!(k in schema.properties) && !RESERVED.has(k) && !patterns.some(([re]) => re.test(k)))
          errors.push(`${where}: unknown property "${k}"` + suggestion(k, Object.keys(schema.properties)));
    }
  }

  for (const sub of schema.allOf || []) errors.push(...againstSchema(data, sub, root, path));

  if (schema.if) {
    const matches = againstSchema(data, schema.if, root, path).length === 0;
    if (matches && schema.then) errors.push(...againstSchema(data, schema.then, root, path));
    if (!matches && schema.else) errors.push(...againstSchema(data, schema.else, root, path));
  }

  return errors;
}

/** "unknown property" with no hint is a dead end for whoever wrote the model. */
function suggestion(wrong, valid) {
  const dist = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  // The threshold follows the key's length: with a fixed ceiling of 3, the key
  // "x" would "match" "id" and the hint would turn into noise. A short key
  // needs an almost exact hit to earn a suggestion.
  const ceiling = Math.min(3, Math.max(1, Math.floor(wrong.length / 2)));
  const closest = valid.map(v => [v, dist(wrong, v)]).filter(([, d]) => d <= ceiling).sort((a, b) => a[1] - b[1])[0];
  return closest ? ` — did you mean "${closest[0]}"?` : ` (valid: ${valid.join(', ')})`;
}

// ------------------------------------------------------- 2. references

const CONTAINERS = new Set(['cloud', 'account', 'region', 'vpc', 'subnet', 'security-group', 'group']);
const LEAVES = new Set(['service', 'block', 'actor']);

function references(m) {
  const errors = [];
  const byId = new Map();

  for (const n of m.nodes) {
    if (byId.has(n.id)) errors.push(`nodes: duplicate id "${n.id}"`);
    byId.set(n.id, n);
  }

  for (const n of m.nodes) {
    if (n.inside === undefined) continue;
    const parent = byId.get(n.inside);
    if (!parent) { errors.push(`node "${n.id}": inside="${n.inside}" does not exist`); continue; }
    if (!CONTAINERS.has(parent.kind))
      errors.push(`node "${n.id}": inside="${n.inside}" is of kind "${parent.kind}", which is a leaf and contains nothing`);
  }

  // cycle: walk the chain of parents from each node
  for (const n of m.nodes) {
    const seen = new Set([n.id]);
    let cur = n;
    while (cur && cur.inside !== undefined) {
      if (seen.has(cur.inside)) { errors.push(`cyclic containment passing through "${n.id}"`); break; }
      seen.add(cur.inside);
      cur = byId.get(cur.inside);
    }
  }

  for (const [i, a] of (m.edges || []).entries()) {
    for (const tip of ['from', 'to']) {
      const target = byId.get(a[tip]);
      if (!target) { errors.push(`edge[${i}]: ${tip}="${a[tip]}" does not exist`); continue; }
      if (CONTAINERS.has(target.kind))
        errors.push(`edge[${i}]: ${tip}="${a[tip]}" is a container ("${target.kind}"). ` +
          `An edge ending at a container asserts that EVERYTHING inside it participates — if that's really the intent, ` +
          `give it a concrete node instead (e.g. the VPC's gateway).`);
    }
    if (a.from === a.to) errors.push(`edge[${i}]: loop from "${a.from}" to itself`);
  }

  for (const [i, f] of (m.bands || []).entries()) {
    for (const id of f.members)
      if (!byId.has(id)) errors.push(`band "${f.id}": member "${id}" does not exist`);
    // Members in DIFFERENT parents is the whole point of a band — it exists to
    // cross the tree (#19). What breaks is a member at a different DEPTH: the
    // union of a subnet with an EC2 instance that lives inside another subnet
    // produces a box that swallows one of the two's parent.
    const depthOf = id => { let d = 0, c = byId.get(id); while (c && c.inside !== undefined) { d++; c = byId.get(c.inside); } return d; };
    const levels = new Set(f.members.filter(id => byId.has(id)).map(depthOf));
    if (levels.size > 1)
      errors.push(`band "${f.id}": members at different tree depths (${[...levels].sort().join(' and ')}). ` +
        `The band is the union of its members; mixing levels produces a box that swallows one of their parents.`);
  }

  for (const [i, nt] of (m.notes || []).entries())
    if (nt.about !== undefined && !byId.has(nt.about))
      errors.push(`note[${i}]: about="${nt.about}" does not exist`);

  // permission enabler (#6 E9): the target has to exist, and can't be the
  // enabler itself — an IAM role that authorizes itself is an arrow in a circle
  for (const n of m.nodes) {
    if (n.enables === undefined) continue;
    if (!byId.has(n.enables))
      errors.push(`node "${n.id}": enables="${n.enables}" does not exist`);
    else if (n.enables === n.id)
      errors.push(`node "${n.id}": enables itself`);
  }

  return { errors, byId };
}

// ---------------------------------------------------------- 3. domain

function domain(m, byId) {
  const errors = [];
  const warnings = [];
  const parent = n => n.inside === undefined ? null : byId.get(n.inside);
  const ancestors = n => { const out = []; let c = parent(n); while (c) { out.push(c); c = parent(c); } return out; };

  for (const n of m.nodes) {
    // An account inside another account doesn't exist in AWS: the Organizations
    // tree goes OU › OU › account, and the account is always a leaf of that
    // tree. Since the OU here is a dimension and not a container (#12), an
    // account nested in an account can only be a modeling error — and drawn, it
    // would read as an ownership boundary inside an ownership boundary, which
    // is a network that doesn't exist.
    if (n.kind === 'account' && ancestors(n).some(a => a.kind === 'account'))
      errors.push(`node "${n.id}": account inside an account. The OU is a dimension ("ou"), not a containment level (#12).`);

    if (n.kind === 'subnet' && !ancestors(n).some(a => a.kind === 'vpc'))
      errors.push(`node "${n.id}": subnet outside any VPC. The containment tree is Cloud › VPC › Subnet (#19).`);

    if (n.kind === 'service' && m.view === 'logical')
      errors.push(`node "${n.id}": kind "service" in the logical view. The logical view is pre-services — use "block". ` +
        `A service name said too early goes to the dossier's parking lot (#15), not to the drawing.`);

    if (n.kind === 'block' && m.view === 'technical')
      warnings.push(`node "${n.id}": "block" in the technical view — a capability that hasn't become a service yet.`);

    if (n.kind === 'subnet' && !n.access)
      warnings.push(`node "${n.id}": subnet with no "access". Without it the drawing can't tell public from private, ` +
        `which is exactly the boundary rubric A4.2 requires.`);
  }

  // The one truth the drawing can assert on its own: a single declared AZ in a
  // model with several subnets of the same role suggests redundancy that
  // doesn't exist.
  const azs = new Set(m.nodes.filter(n => n.az).map(n => n.az));
  const subnets = m.nodes.filter(n => n.kind === 'subnet');
  if (subnets.length > 1 && azs.size === 1)
    warnings.push(`all ${subnets.length} subnets are in "${[...azs][0]}". ` +
      `If multi-AZ was the intent, the other ones are missing the "az" dimension.`);
  if (subnets.length && subnets.some(s => !s.az) && azs.size)
    warnings.push(`there's a subnet with "az" and a subnet without. The derived AZ band only sees the ones that declare it.`);

  return { errors, warnings };
}

// ------------------------------------------------------------ facade

// ⚠️ THE RETURN SHAPE KEEPS ITS PORTUGUESE KEYS (`erros`, `avisos`, `fase`) ON
// PURPOSE. This facade is a contract read by callers across the whole tree —
// validator/gate.cjs, theme/theme.cjs, session/*, tools/*, tests/* — that
// destructure `.erros`/`.avisos`/`.fase` by that exact name. Renaming the keys
// here without renaming every one of those call sites would repeat the exact
// mistake this codebase already paid for once: a contract key changed on one
// end and not the other, silently producing `undefined` on the reading side.
// The VALUES and the message strings inside `erros`/`avisos` are English; only
// the three field names stay as they are until every consumer moves together.
function validate(model, schema) {
  const shapeErrors = againstSchema(model, schema, schema);
  if (shapeErrors.length) return { ok: false, erros: shapeErrors, avisos: [], fase: 'schema' };

  const { errors: refErrors, byId } = references(model);
  if (refErrors.length) return { ok: false, erros: refErrors, avisos: [], fase: 'references', byId };

  const { errors: domainErrors, warnings } = domain(model, byId);
  if (domainErrors.length) return { ok: false, erros: domainErrors, avisos: warnings, fase: 'domain', byId };

  return { ok: true, erros: [], avisos: warnings, fase: null, byId };
}

module.exports = { validate, againstSchema, CONTAINERS, LEAVES };
