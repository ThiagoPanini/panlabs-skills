'use strict';
/**
 * The bridge to the shape catalog (#17), and the decision not to depend on it.
 *
 * Five checks want to know what is OFFICIAL — the service name (A1.9), the
 * icon's color (A2.3), the id's currency (A2.4). That knowledge isn't the
 * validator's: it belongs to the catalog, which is extracted from draw.io and
 * dated.
 *
 * The coupling is optional on purpose. The validator has to run over a plan
 * that came from anywhere, and a `require` that blows up because the catalog
 * moved folders would turn 60 checks into zero. Without a catalog, the five
 * become `notApplicable` — which is different from `ok`, and shows up in the
 * report saying what wasn't checked.
 */

const path = require('path');

const PATH = path.join(__dirname, '..', '..', 'catalog', 'aws-shapes.cjs');

let cache;

/** `{ service, group, titles, asOf, ids }`, or `null` if the catalog fails to load. */
function catalog() {
  if (cache !== undefined) return cache;
  try {
    const cat = require(PATH).load();
    const raw = cat.catalog || {};
    const titles = [];
    const ids = new Set();
    for (const group of ['services', 'resources', 'groups', 'other']) {
      const entries = raw[group];
      if (!entries) continue;
      for (const rec of Array.isArray(entries) ? entries : Object.values(entries)) {
        if (!rec || typeof rec !== 'object') continue;
        if (rec.title) titles.push(rec.title);
        if (rec.stencil) ids.add(String(rec.stencil));
      }
    }
    cache = {
      service: name => { try { return cat.service(name); } catch { return null; } },
      group: name => { try { return cat.group(name); } catch { return null; } },
      titles,
      ids,
      asOf: (cat.meta && cat.meta.drawio && cat.meta.drawio.date) || null,
      meta: cat.meta || null,
    };
  } catch {
    cache = null;
  }
  return cache;
}

/** The `fillColor` the catalog prescribes for a style, if any. */
const fillOf = style => (String(style || '').match(/fillColor=(#[0-9A-Fa-f]{3,6})/) || [])[1] || null;

/**
 * The real stencil id.
 *
 * `shape=mxgraph.aws4.resourceIcon` is the WRAPPER — the colored square every
 * service icon uses. What says which service it is is `resIcon`, and for a
 * group it's `grIcon`. Reading `shape` and stopping there makes A2.4 fail
 * every catalog icon for not finding "resourceIcon" in the stencil list,
 * which is the opposite of what the check means to say.
 */
function stencilOf(style) {
  const s = String(style || '');
  for (const key of ['resIcon', 'grIcon', 'shape']) {
    const m = s.match(new RegExp(`(?:^|;)${key}=mxgraph\\.aws4\\.([A-Za-z0-9_]+)`));
    if (m && m[1] !== 'resourceIcon') return m[1];
  }
  return null;
}

module.exports = { catalog, fillOf, stencilOf, PATH };
