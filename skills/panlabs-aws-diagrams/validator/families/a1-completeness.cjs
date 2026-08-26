'use strict';
/**
 * A1 · Semantic completeness.
 *
 * The rubric: "not geometry, presence of fields. This is the cheapest group to
 * implement and the one with the biggest return: it's literally the C4
 * checklist turned into assertions."
 *
 * Nine of the twelve are `fail`, on purpose: they are the floor that every
 * guide — C4, Azure WAF, AWS deck — requires of a diagram before aesthetics
 * even enter the conversation.
 */

const path = require('path');
const { ok, failure, notApplicable, matches, roundTo, withoutTags, name } = require(path.join(__dirname, 'common.cjs'));
const { catalog } = require(path.join(__dirname, 'catalog.cjs'));


/** Visual channels the legend would have to explain (A1.3). */
function usedChannels(scene) {
  const channels = new Map();
  const record = (channel, value, who) => {
    if (value === null || value === undefined || value === '') return;
    if (!channels.has(channel)) channels.set(channel, new Map());
    const m = channels.get(channel);
    if (!m.has(value)) m.set(value, []);
    m.get(value).push(who);
  };
  for (const e of [...scene.nodes, ...scene.groups, ...scene.bands]) {
    record('fill', e.fill, e.id);
    record('stroke', e.stroke, e.id);
    record('strokeStyle', e.style.dashed === '1' ? 'dashed' : 'solid', e.id);
    record('shape', e.style.shape || (e.style.container === '1' ? 'container' : 'rectangle'), e.id);
    record('sizeClass', `${e.cellBox.w}×${e.cellBox.h}`, e.id);
  }
  for (const a of scene.edges) {
    record('arrowhead', `${a.style.startArrow || 'none'}→${a.style.endArrow || 'none'}`, a.id);
    record('strokeStyle', a.style.dashed === '1' ? 'dashed' : 'solid', a.id);
    record('stroke', a.style.strokeColor || null, a.id);
  }
  return channels;
}

module.exports = function a1(scene) {
  const output = [];
  const model = scene.model;
  const { nodes, groups, bands, edges } = scene;
  const nameable = [...nodes, ...groups, ...bands];

  // ---------------------------------------------------------------- A1.1
  {
    const title = model ? withoutTags(model.title) : '';
    const subtitle = model ? withoutTags(model.subtitle) : '';
    if (!title) {
      output.push(failure('A1.1', { mensagem: 'the diagram has no title', occurrences: [{ o_que: 'meta.title empty or absent', ids: [] }] }));
    } else {
      // The rubric asks for diagram type + scope. Here the type lives in
      // `view` and the scope usually lands in the subtitle, so both go into
      // the measurement.
      const view = model.view || null;
      output.push(ok('A1.1', {
        measured: { title, view, subtitle: subtitle || null },
        mensagem: `"${title}"${view ? ` (view ${view})` : ''}`,
      }));
    }
  }

  // ---------------------------------------------------------------- A1.2
  {
    output.push(scene.legend.length
      ? ok('A1.2', { measured: { entries: scene.legend.length } })
      : failure('A1.2', {
        measured: { entries: 0 },
        mensagem: 'there is no legend — C4 asks for one on every diagram',
        occurrences: [{ o_que: '#11\'s engine does not emit a legend yet; every color and stroke meaning goes unlabeled', ids: [] }],
      }));
  }

  // ---------------------------------------------------------------- A1.3
  {
    const channels = usedChannels(scene);
    const explained = new Set(scene.legend.map(l => String(l.symbol)));
    const withoutInput = [];
    for (const [channel, values] of channels)
      for (const [value, who] of values)
        if (!explained.has(`${channel}:${value}`) && !explained.has(String(value)))
          withoutInput.push({ o_que: `channel "${channel}" is used as ${JSON.stringify(value)} on ${who.length} object(s) and the legend does not explain it`, ids: who.slice(0, 6) });
    output.push(matches('A1.3', withoutInput, {
      measured: { channels: channels.size, valuesWithoutEntry: withoutInput.length },
      mensagem: withoutInput.length ? `${withoutInput.length} visual channel value(s) with no legend entry` : 'every visual channel is explained',
    }));
  }

  // ---------------------------------------------------------------- A1.4
  {
    const cases = nameable.filter(e => !withoutTags(e.label)).map(e => ({ o_que: `${e.id} has no label`, ids: [e.id] }));
    output.push(matches('A1.4', cases, { measured: { elements: nameable.length, unnamed: cases.length } }));
  }

  // ---------------------------------------------------------------- A1.5
  {
    if (!model) output.push(notApplicable('A1.5', 'the plan does not carry the semantic model'));
    else {
      const cases = [...nodes, ...groups].filter(e => !e.semanticKind)
        .map(e => ({ o_que: `${name(e)} has no type declared in the model`, ids: [e.id] }));
      output.push(matches('A1.5', cases, { measured: { elements: nodes.length + groups.length, untyped: cases.length } }));
    }
  }

  // ---------------------------------------------------------------- A1.6
  {
    const cases = edges.filter(a => !withoutTags(a.label)).map(a => ({ o_que: `edge "${a.id}" (${a.from}→${a.to}) has no label`, ids: [a.id] }));
    output.push(edges.length ? matches('A1.6', cases, { measured: { edges: edges.length, unlabeled: cases.length } })
      : notApplicable('A1.6', 'the diagram has no edges'));
  }

  // ------------------------------------------------------------ A1.7 and A1.8
  {
    const tipCount = a => {
      const has = v => v && v !== 'none';
      return (has(a.style.startArrow) ? 1 : 0) + (has(a.style.endArrow) || a.style.endArrow === undefined ? 1 : 0);
    };
    if (!edges.length) {
      output.push(notApplicable('A1.7', 'the diagram has no edges'));
      output.push(notApplicable('A1.8', 'the diagram has no edges'));
    } else {
      const bidirectional = edges.filter(a => tipCount(a) > 1)
        .map(a => ({ o_que: `edge "${a.id}" has two tips — a bidirectional relationship hides which side initiates`, ids: [a.id] }));
      output.push(matches('A1.7', bidirectional, { measured: { edges: edges.length, bidirectional: bidirectional.length } }));

      const noArrow = edges.filter(a => tipCount(a) < 1)
        .map(a => ({ o_que: `edge "${a.id}" has no arrowhead`, ids: [a.id] }));
      output.push(matches('A1.8', noArrow, { measured: { edges: edges.length, noArrow: noArrow.length } }));
    }
  }

  // ---------------------------------------------------------------- A1.9
  {
    const cat = catalog();
    if (!cat) output.push(notApplicable('A1.9', 'the shape catalog is not available to build the list of official acronyms'));
    else {
      const official = new Set();
      for (const title of cat.titles) for (const t of String(title).match(/\b[A-Z][A-Za-z0-9]*\b/g) || []) official.add(t);
      const texts = [...nameable.map(e => withoutTags(e.label)), ...edges.map(a => withoutTags(a.label))].filter(Boolean);
      const unexplained = new Map();
      for (const t of texts)
        for (const acronym of t.match(/\b[A-Z]{2,}\b/g) || []) {
          if (official.has(acronym)) continue;
          // "expanded somewhere in the diagram" — some other piece of text spells it out
          const expanded = texts.some(other => new RegExp(acronym.split('').join('[a-z]* '), 'i').test(other));
          if (!expanded) unexplained.set(acronym, (unexplained.get(acronym) || 0) + 1);
        }
      const cases = [...unexplained].map(([s, n]) => ({ o_que: `acronym "${s}" appears ${n}× and is neither an official name nor expanded anywhere`, ids: [] }));
      output.push(matches('A1.9', cases, { measured: { labels: texts.length, unexplainedAcronyms: cases.length } }));
    }
  }

  // ---------------------------------------------------------------- A1.10
  {
    if (!model) output.push(notApplicable('A1.10', 'the plan does not carry the semantic model'));
    else {
      // In this model the level is the `view` (logical is pre-services,
      // technical is post-services), and the leaf's type gives it away:
      // `block` is logical, `service` is technical. Mixing the two in one
      // drawing is what C4 forbids.
      const levels = new Set();
      for (const n of model.nodes || []) {
        if (n.kind === 'block') levels.add('logical');
        if (n.kind === 'service') levels.add('technical');
      }
      output.push(levels.size > 1
        ? failure('A1.10', {
          measured: { levels: [...levels] },
          mensagem: `the diagram mixes ${[...levels].join(' and ')}`,
          occurrences: [{ o_que: 'logical blocks and concrete services in the same drawing — C4 asks for one level per diagram', ids: [] }],
        })
        : ok('A1.10', { measured: { levels: [...levels], view: model.view || null } }));
    }
  }

  // ---------------------------------------------------------------- A1.11
  {
    if (!model) output.push(notApplicable('A1.11', 'the plan does not carry the semantic model'));
    else {
      const missing = ['data', 'versao', 'autor'].filter(k => !model[k]);
      output.push(matches('A1.11', missing.map(k => ({ o_que: `the model does not declare "${k}"`, ids: [] })), {
        measured: { present: ['data', 'versao', 'autor'].filter(k => model[k]), missing },
        mensagem: missing.length ? `missing ${missing.join(', ')} — there is no way to tell whether the diagram is stale` : 'freshness metadata present',
      }));
    }
  }

  // ---------------------------------------------------------------- A1.12
  {
    // An orphan is a mark with no matching fact. The scene classifies
    // everything, so here an orphan is an object left with no known kind, or
    // one that draws without a counterpart in the model.
    const classified = new Set(['node', 'group', 'band', 'frame', 'edge', 'hidden']);
    const cases = [];
    for (const e of scene.elements) {
      if (!classified.has(e.kind)) { cases.push({ o_que: `${e.id} draws and is neither a node, group, band, edge nor frame`, ids: [e.id] }); continue; }
      if (e.kind === 'node' && model && !(model.nodes || []).some(n => n.id === e.id))
        cases.push({ o_que: `${e.id} draws as a node and does not exist in the model`, ids: [e.id] });
    }
    output.push(matches('A1.12', cases, { measured: { objects: scene.elements.length, orphans: cases.length } }));
  }

  return output;
};
