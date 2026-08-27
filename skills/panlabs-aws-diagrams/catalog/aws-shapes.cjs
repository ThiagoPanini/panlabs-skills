#!/usr/bin/env node
/**
 * AWS shape catalog — name resolution and style string assembly.
 *
 * The catalog is deliberately compact: 403 service icons + 606 resource icons
 * don't become 1009 literal strings, but `template + (category, stencil)`.
 * The style only exists when someone asks for it.
 *
 *   const cat = require('./aws-shapes.cjs').load();
 *   cat.service('lambda');   // -> { style, w, h, via: 'service', ... }
 *   cat.group('vpc');        // -> { style, w, h, ... }  (already corrected)
 *
 * Reference: the shape research from #17, crystallized into `aws4.catalog.json`
 * and `corrections.json` — the only source this file reads.
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------ normalization

/**
 * A service name arrives in many shapes: "Amazon S3", "s3",
 * "Simple Storage Service (S3)", "simple_storage_service". They all need
 * to land in the same bucket before any comparison.
 */
function normalize(name) {
  return String(name)
    .toLowerCase()
    .replace(/[_\-/]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(aws|amazon)\s+/, '')
    .trim();
}

/** "Simple Storage Service (S3)" also indexes as "s3" and as "simple storage service". */
function variants(title) {
  const out = new Set([normalize(title)]);
  const m = String(title).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    out.add(normalize(m[1]));
    out.add(normalize(m[2]));
  }
  return [...out].filter(Boolean);
}

// ------------------------------------------------------------------ styles

function applyTemplate(tpl, { fill, stencil }) {
  return tpl
    .split('${FILL}').join(fill)
    .split('${STENCIL}').join(stencil);
}

/** Replaces the value of a style key, preserving the order of the rest. */
function setKey(style, key, value) {
  const parts = style.split(';');
  let found = false;
  const next = parts.map(p => {
    if (p.startsWith(key + '=')) { found = true; return key + '=' + value; }
    return p;
  });
  if (!found) {
    // insert before the final empty terminator, if there is one
    const i = next.length && next[next.length - 1] === '' ? next.length - 1 : next.length;
    next.splice(i, 0, key + '=' + value);
  }
  return next.join(';');
}

function hasKey(style, key) {
  return style.split(';').some(p => p === key || p.startsWith(key + '='));
}

// ---------------------------------------------------------------- corrections

/**
 * Applies to the group the delta "what draw.io delivers" -> "what AWS prescribes":
 * pre-2022 palette colors, the missing container=1, and the tint on the two
 * subnets. See corrections.json.
 */
function fixGroup(style, corrections, title) {
  let s = style;
  const applied = [];

  for (const [legacyHex, fix] of Object.entries(corrections.legacyPalette)) {
    if (legacyHex.startsWith('_')) continue;
    if (s.includes(legacyHex)) {
      s = s.split(legacyHex).join(fix.to);
      applied.push(`${legacyHex}->${fix.to}`);
    }
  }

  if (!hasKey(s, 'container')) {
    const suffix = corrections.container.suffix;
    s = (s.endsWith(';') ? s : s + ';') + suffix;
    applied.push('container=1');
  }

  // Two subnets leave draw.io TINTED (#E6F6F7 / #F2F6E8) while the other
  // 18 are `none`. The deck is `<a:noFill/>` on all of them (A2), and the tint
  // drags #ED7100 down from 3.02 to 2.71:1 for whatever falls inside. See groupFill.
  const gf = corrections.groupFill;
  if (gf && (gf.affects || []).includes(title)) {
    const before = (/(?:^|;)fillColor=([^;]*)/.exec(s) || [])[1];
    if (before && before !== gf.to) {
      s = setKey(s, 'fillColor', gf.to);
      applied.push(`fillColor ${before}->${gf.to}`);
    }
  }

  return { style: s, corrections: applied };
}

// ------------------------------------------------------------------ loading

function load(dir) {
  const base = dir || __dirname;
  const catalog = JSON.parse(fs.readFileSync(path.join(base, 'aws4.catalog.json'), 'utf8'));
  const corrections = JSON.parse(fs.readFileSync(path.join(base, 'corrections.json'), 'utf8'));

  const categoryColor = category => (catalog.categories[category] || {}).fill || '#232F3D';

  // ---- indexes ---------------------------------------------------------

  const byName = new Map();       // normalized name -> [entries]
  const byStencil = new Map();    // stencil -> entry (service icon wins)
  const groupsByName = new Map();

  function buildIndex(input, kind) {
    const rec = { ...input, kind };
    for (const v of variants(input.title)) {
      if (!byName.has(v)) byName.set(v, []);
      byName.get(v).push(rec);
    }
    const sn = normalize(input.stencil);
    if (sn && !byName.has(sn)) byName.set(sn, []);
    if (sn) byName.get(sn).push(rec);

    // service icon takes precedence over resource icon on the same stencil
    if (!byStencil.has(input.stencil) || kind === 'service') {
      if (!(byStencil.get(input.stencil) || {}).kind || kind === 'service') {
        byStencil.set(input.stencil, rec);
      }
    }
    return rec;
  }

  for (const s of catalog.services) buildIndex(s, 'service');
  for (const r of catalog.resources) buildIndex(r, 'resource');
  for (const g of catalog.groups) {
    for (const v of variants(g.title)) {
      if (!groupsByName.has(v)) groupsByName.set(v, g);   // 1st variant wins
    }
  }

  // ---- style assembly ---------------------------------------------------

  function build(rec) {
    if (rec.style) {                       // outside the template: upstream literal
      return { style: rec.style, literal: true };
    }
    const tpl = rec.kind === 'service' ? catalog.templates.svc.style : catalog.templates.res.style;
    const fill = rec.fill || categoryColor(rec.palette);
    return { style: applyTemplate(tpl, { fill, stencil: rec.stencil }), literal: false };
  }

  function deliver(rec, via) {
    const { style, literal } = build(rec);
    return {
      style, via, literal,
      title: rec.title, stencil: rec.stencil, palette: rec.palette,
      fill: rec.fill || categoryColor(rec.palette),
      w: rec.w, h: rec.h
    };
  }

  // ---- lookup -------------------------------------------------------------

  function lookup(name) {
    const n = normalize(name);

    // 0. title that exists in more than one palette with a diverging color/icon.
    //    Comes BEFORE the name lookup: this is exactly the case where the name
    //    alone doesn't decide, and "the first one that matches" would make the
    //    same architecture come out with different colors depending on palette
    //    order.
    const des = corrections.disambiguation[n];
    if (des && !n.startsWith('_')) {
      const chosen = (byName.get(n) || []).find(
        c => c.stencil === des.stencil && c.palette === des.palette);
      if (chosen) return { candidates: [chosen], via: 'disambiguated:' + des.origin };
    }

    // 1. frozen rename (OpenSearch -> elasticsearch_service).
    //    BEFORE the title lookup, not after: the rename is a curated override,
    //    and the case that forces this order is SageMaker — asking for
    //    "sagemaker" matches by exact title with 'Sagemaker' (sagemaker_2, purple
    //    Analytics) and would never reach 'SageMaker AI' (sagemaker, teal).
    //    The title upstream never updated would win over the current name.
    const renamed = corrections.renames[n];
    if (renamed && byStencil.has(renamed)) return { candidates: [byStencil.get(renamed)], via: 'rename' };

    // 2. title or stencil name, direct
    if (byName.has(n)) return { candidates: byName.get(n), via: 'name' };

    // 3. acronym / nickname — AFTER the title: our own convenience doesn't
    //    override a real match against the catalog.
    const synonym = corrections.synonyms[n];
    if (synonym && byStencil.has(synonym)) return { candidates: [byStencil.get(synonym)], via: 'synonym' };

    // 4. substring, and ONLY if unambiguous. "trainium" finds "Trainium Instance";
    //    "gateway" finds nothing, because it matches dozens — and guessing which
    //    one would be worse than falling back.
    //    The word boundary isn't fussiness: without it "trainium" matches the
    //    key "ai", because the raw substring is in there.
    // A multi-word query decomposes into its own words on the `containsWord(n, k)`
    // side, and each word can land on a DIFFERENT, unrelated catalog entry —
    // "vpc endpoint" used to match "vpc" (the container) AND "endpoint" (the
    // resource), and a tie-break used to hand the win to whichever of those was
    // a service icon: "vpc" alone, discarding the endpoint the query actually
    // named. #139 measured it on two real queries: "vpc endpoint" -> VPC, and
    // "aurora serverless" -> ambiguous between "Aurora" and the unrelated
    // "Serverless" category icon. Neither word is a typo or a fragment of the
    // other; they are two real, competing matches, and a heuristic that resolves
    // that competition by icon *kind* rather than by what the query said is a
    // guess wearing the costume of a match. "exactly one candidate" is the whole
    // rule — no tie-break survives it.
    const containsWord = (hay, needle) => (' ' + hay + ' ').includes(' ' + needle + ' ');
    const keys = [...byName.keys()].filter(
      k => containsWord(k, n) || containsWord(n, k));
    const targets = new Set();
    for (const k of keys) for (const c of byName.get(k)) targets.add(c);
    if (targets.size === 1) return { candidates: [...targets], via: 'substring' };

    return null;
  }

  /**
   * Fallback ladder (research §5.6):
   *   service icon > resource icon > category icon > generic > generic group
   */
  function service(name, opts = {}) {
    const finding = lookup(name);

    if (finding) {
      const svc = finding.candidates.find(c => c.kind === 'service');
      if (svc) return deliver(svc, finding.via === 'name' ? 'service' : 'service:' + finding.via);
      const res = finding.candidates.find(c => c.kind === 'resource');
      if (res) return deliver(res, finding.via === 'name' ? 'resource' : 'resource:' + finding.via);
    }

    if (opts.category) {
      const category = normalize(opts.category);
      const byCategory = catalog.services.find(
        s => s.palette === category.replace(/ /g, '_') && normalize(s.title) === category);
      if (byCategory) return deliver({ ...byCategory, kind: 'service' }, 'category');
      const categoryIcon = lookup(opts.category);
      if (categoryIcon) {
        const c = categoryIcon.candidates.find(x => x.kind === 'service') || categoryIcon.candidates[0];
        if (c) return deliver(c, 'category');
      }
    }

    const generic = byStencil.get('generic_application');
    if (generic) return { ...deliver(generic, 'generic'), suggestedLabel: String(name) };

    return null;
  }

  function group(name) {
    const g = groupsByName.get(normalize(name));
    if (!g) return null;
    const { style, corrections: applied } = fixGroup(g.style, corrections, g.title);
    return {
      style, title: g.title, w: g.w, h: g.h,
      shapeClass: g.shapeClass, grIcon: g.grIcon,
      corrections: applied,
      styleUpstream: g.style
    };
  }

  return {
    catalog, corrections,
    meta: catalog.meta,
    service, group, lookup, normalize,
    groups: () => catalog.groups.map(g => g.title),
    categories: () => catalog.categories,
    categoryColor
  };
}

module.exports = { load, normalize, variants, applyTemplate, setKey, fixGroup };

// --------------------------------------------------------------------- CLI

if (require.main === module) {
  const cat = load();
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log(`aws4 catalog — draw.io ${cat.meta.drawio && cat.meta.drawio.version} (${cat.meta.commit && cat.meta.commit.slice(0, 8)})`);
    console.log(`  ${cat.catalog.services.length} service icons · ${cat.catalog.resources.length} resource icons · ${cat.catalog.groups.length} groups`);
    console.log(`usage: node aws-shapes.cjs <service or group name> ...`);
    process.exit(0);
  }
  // A `generic` result IS a resolved `service()` return — nothing throws, nothing
  // is falsy — so printing it on the same "service" line as a real match buries
  // the one outcome that means "the catalog does not know this name" inside a
  // tuple a skimming reader has to parse. #139: this line, unlike the engine's
  // own `report.avisos`, printed exactly that silence.
  let unresolved = 0;
  for (const a of args) {
    const s = cat.service(a);
    const g = cat.group(a);
    if (g) console.log(`group   ${a} -> ${g.title} [${g.corrections.join(' ') || 'no correction'}]\n  ${g.style}`);
    else if (s && s.via === 'generic') {
      unresolved++;
      console.log(`⚠ generic ${a} -> no catalog match for "${a}" — fell back to Generic Application, not the requested service`);
    }
    else if (s) console.log(`service ${a} -> ${s.title} (${s.stencil}, ${s.via}, ${s.fill})\n  ${s.style}`);
    else console.log(`?       ${a} -> not resolved`);
  }
  if (unresolved) process.exit(1);
}
