'use strict';
/**
 * The index of the rubric's (#8) 62 mechanizable checks.
 *
 * This file is the table, not the calculation. It exists separate from the
 * families for a concrete reason: the question "which of the 62 does the
 * validator cover, at what severity, and what was left for render" has to be
 * answerable without running anything and without reading eight modules.
 * `tests/check-index.cjs` checks the table against the rubric, and that is
 * what stops the index from drifting away from it in silence.
 *
 * Four fields carry the decisions #18 had to make:
 *
 *   `severity`  the WORST severity the check can emit. Seven checks scale
 *               with the measurement (A2.1 is warn at 7-8 legend entries and
 *               fail above 8); they carry `escalona: true`, and it is the
 *               check, not the table, that decides the concrete case.
 *
 *   `input`     where the data comes from. This is the validator × render
 *               split, and it is a PARTITION: `render` belongs to the
 *               opportunistic judge, everything else belongs to the
 *               mandatory validator. No id on both sides, no id outside
 *               both. Whoever falls into `render` explains why in
 *               `porqueRender`.
 *
 *   `calibravel`  the number has no experimental basis — it's the list from
 *                 the rubric's U8. It becomes a key in `thresholds.json` with
 *                 `because: null`, and the empty field is the request for
 *                 measurement.
 *
 *   `semantica`   the failure isn't ugly, it's FALSE: the drawing asserts an
 *                 architectural fact that does not exist. That's A4.2, A4.4
 *                 and A5.5. This is what separates this validator from an
 *                 aesthetics linter, and that is why zero tolerance on those
 *                 three isn't rigor, it's the minimum.
 *
 * The inputs, from cheapest to most expensive:
 *
 *   geometry   absolute x/y/w/h and polylines — comes straight out of the plan
 *   style      the mxGraph style string, already parsed (color, stroke, font, arrow)
 *   model      the semantic model that travels inside the plan (the `panlabs-modelo` cell)
 *   catalog    the AWS shape catalog (#17) — official name, official color, currency
 *   render     pixels or real font metrics. NOT the validator's job.
 */

const path = require('path');
const raw = require(path.join(__dirname, 'thresholds.json'));

/** The thresholds in one flat map, because whoever looks one up wants the number, not the section. */
const THRESHOLDS = Object.freeze({ ...raw.normative, ...raw.calibratable });

const SEVERITIES = ['fail', 'warn'];
const INPUTS = ['geometry', 'style', 'model', 'catalog', 'render'];

/** Shortcut: the raw value of a threshold, by name. */
const lim = key => {
  if (!(key in THRESHOLDS)) throw new Error(`threshold "${key}" does not exist in thresholds.json`);
  return THRESHOLDS[key].value;
};

const CHECKS = [

  // ------------------------------------------------------------------- A1
  // "Not geometry, presence of fields" — the rubric. The cheapest group and
  // the one with the biggest return: it's literally the C4 checklist turned
  // into assertions.
  {
    id: 'A1.1', family: 'A1', name: 'Title present', severity: 'fail', input: 'model',
    mede: 'the diagram describes itself: title with diagram type and scope',
    limiar: { descricao: 'present and non-empty' },
    fonte: 'C4 (/diagrams/notation); Azure WAF ("Include metadata")',
  },
  {
    id: 'A1.2', family: 'A1', name: 'Legend present', severity: 'fail', input: 'geometry',
    mede: 'a legend exists on the canvas',
    limiar: { descricao: 'present' },
    fonte: 'C4 ("Every diagram should have a key/legend")',
  },
  {
    id: 'A1.3', family: 'A1', name: 'Legend complete (visual channel coverage)', severity: 'fail', input: 'style',
    mede: 'every visual channel value actually in use has a legend entry',
    limiar: { descricao: '|values_without_entry| = 0' },
    fonte: 'C4 review checklist; Azure WAF ("Provide a legend")',
  },
  {
    id: 'A1.4', family: 'A1', name: 'Every element named', severity: 'fail', input: 'geometry',
    mede: '∀ node, group: label ≠ ""',
    limiar: { descricao: '100%' },
    fonte: 'C4 checklist; Azure WAF ("Label everything clearly"); Azure Icons',
  },
  {
    id: 'A1.5', family: 'A1', name: 'Every element typed', severity: 'fail', input: 'model',
    mede: '∀ node, group: type ∈ catalog',
    limiar: { descricao: '100%' },
    fonte: 'C4 ("The type of every element should be explicitly specified")',
  },
  {
    id: 'A1.6', family: 'A1', name: 'Every edge labeled', severity: 'fail', input: 'geometry',
    mede: '∀ edge: label ≠ ""',
    limiar: { descricao: '100%' },
    fonte: 'C4 ("Every line should be labelled"); Azure WAF',
  },
  {
    id: 'A1.7', family: 'A1', name: 'Every edge unidirectional', severity: 'fail', input: 'style',
    mede: '∀ edge: exactly one arrowhead',
    limiar: { descricao: '0 bidirectional edges' },
    fonte: 'C4 ("unidirectional relationship"); Azure WAF ("Avoid bidirectional arrows")',
  },
  {
    id: 'A1.8', family: 'A1', name: 'No line without an arrowhead', severity: 'fail', input: 'style',
    mede: '∀ edge: at least one arrowhead',
    limiar: { descricao: '100%' },
    fonte: 'Azure WAF ("Lines without arrows make relationships unclear")',
  },
  {
    id: 'A1.9', family: 'A1', name: 'Acronyms expanded', severity: 'warn', input: 'catalog',
    mede: 'an acronym in a label that is not an official AWS service name appears expanded somewhere',
    limiar: { descricao: '0 unexplained acronyms' },
    fonte: 'C4 ("Acronyms and abbreviations ... should be understandable by all audiences")',
  },
  {
    id: 'A1.10', family: 'A1', name: 'One abstraction level', severity: 'fail', input: 'model',
    mede: '|distinct(abstraction level)| == 1',
    limiar: { descricao: '1' },
    fonte: 'C4 FAQ ("at the same level of abstraction"); Azure WAF ("Layer, don\'t overload")',
  },
  {
    id: 'A1.11', family: 'A1', name: 'Freshness metadata', severity: 'warn', input: 'model',
    mede: 'date, version and author present',
    limiar: { descricao: 'present' },
    fonte: 'Azure WAF ("title, description, last updated date, author, version")',
  },
  {
    id: 'A1.12', family: 'A1', name: 'No orphan shape', severity: 'fail', input: 'geometry',
    mede: 'every drawing object belongs to nodes ∪ groups ∪ edges ∪ labels ∪ legend ∪ title',
    limiar: { descricao: '0 orphans' },
    fonte: 'Tufte, Visual Display, "Erase non-data-ink" (adapted)',
  },

  // ------------------------------------------------------------------- A2
  {
    id: 'A2.1', family: 'A2', name: 'Graphic complexity ≤ 6', severity: 'fail', escalona: true, input: 'style',
    mede: 'number of distinct entries the legend would need (symbol types, not instances)',
    limiar: { key: 'graphicComplexityTarget', descricao: `≤ ${lim('graphicComplexityTarget')}; warn at 7-8; fail above ${lim('graphicComplexityFail')}` },
    fonte: 'Moody, Physics of Notations ("span of absolute judgement is around 6 categories")',
  },
  {
    id: 'A2.2', family: 'A2', name: 'Icon intact', severity: 'fail', input: 'style',
    mede: 'no icon mirrored, rotated, sheared or cropped',
    limiar: { descricao: '100% of icons' },
    fonte: 'AWS deck (DON\'T crop/flip/rotate); Azure Icons; Azure WAF',
  },
  {
    id: 'A2.3', family: 'A2', name: 'Icon color unaltered', severity: 'fail', input: 'catalog',
    mede: 'the color declared in the style matches the catalog\'s official asset',
    limiar: { descricao: 'matches the catalog' },
    fonte: 'AWS deck (DO "use icons at their predefined size, color and format"); Azure WAF',
    note: 'the rubric asks for a pixel hash; the hash belongs to render. The validator checks the DECLARED ' +
      'COLOR, which is what the engine controls — if the pixel diverges from the style, the renderer is at fault, not the generator.',
  },
  {
    id: 'A2.4', family: 'A2', name: 'Icon from the official, current catalog', severity: 'warn', input: 'catalog',
    mede: 'every icon used exists in the current catalog, and none comes from the legacy set',
    limiar: { descricao: '100%' },
    fonte: 'AWS Architecture Icons ("check that you\'re using up-to-date icons"; quarterly releases)',
  },
  {
    id: 'A2.5', family: 'A2', name: 'Icon size uniform per class', severity: 'fail', input: 'geometry',
    mede: 'within each node class, max(width)/min(width) == 1',
    limiar: { descricao: 'ratio == 1 within the class' },
    fonte: 'Azure WAF ("Use standardized ... icons, icon sizes ... for similar elements")',
  },
  {
    id: 'A2.6', family: 'A2', name: 'Visual encoding consistent per type', severity: 'fail', input: 'style',
    mede: 'for each type, a single value per channel (fill, stroke, thickness, style, shape)',
    limiar: { descricao: '1 value per channel per type' },
    fonte: 'Azure WAF ("Maintain consistency"); C4; Kobourov et al. (similarity)',
  },
  {
    id: 'A2.7', family: 'A2', name: 'Line style semantically consistent', severity: 'fail', input: 'style',
    mede: 'the stroke-style → meaning relation is a bijection',
    limiar: { descricao: 'bijection' },
    fonte: 'Azure WAF ("Avoid ambiguous lines"); C4 checklist',
  },
  {
    id: 'A2.8', family: 'A2', name: 'Group border follows the containment vs. deployment convention', severity: 'warn', input: 'style',
    mede: 'a location group has a solid border, a logical-zone group has a dashed border',
    limiar: { descricao: '100% per the adopted mapping' },
    fonte: 'IBM Cloud architecture-icons (container=solid, zone=dashed); AWS deck',
    note: 'the rubric warns: the exact mapping per AWS group is not a published textual norm — extract it from the asset, don\'t hard-code it.',
  },
  {
    id: 'A2.9', family: 'A2', name: 'Service label at most 2 lines, no intra-word break', severity: 'warn', input: 'render',
    mede: 'how many lines the label occupies AFTER being wrapped by the real font',
    limiar: { descricao: '≤ 2 lines, 0 intra-word breaks' },
    fonte: 'AWS deck, Labels slide',
    porqueRender: 'the wrap depends on the real font metric. The engine already estimates it (resolve.cjs), ' +
      'and its comments are explicit that an early version undersized the label band by ~25%. ' +
      'Validating against the engine\'s own estimate would be the generator checking its own guess.',
  },
  {
    id: 'A2.10', family: 'A2', name: 'Arrowheads from the preset set', severity: 'warn', input: 'style',
    mede: 'every arrowhead used is in the preset set',
    limiar: { descricao: '100%' },
    fonte: 'AWS deck ("Use the preset arrows provided in the Elements section")',
  },
  {
    id: 'A2.11', family: 'A2', name: 'No chartjunk', severity: 'fail', input: 'style',
    mede: 'no shadow, gradient, glow, bevel, perspective or texture',
    limiar: { descricao: '0 occurrences' },
    fonte: 'Tufte, Visual Display, ch. 5 (chartjunk); Azure WAF ("Use standard notations")',
  },

  // ------------------------------------------------------------------- A3
  // The rubric: "hard failures, zero tolerance, trivially computable, and
  // exactly what an automatic generator gets wrong".
  {
    id: 'A3.1', family: 'A3', name: 'Node-node overlap', severity: 'fail', input: 'geometry',
    mede: 'intersection area between non-nested sibling boxes, and the gap between them',
    limiar: { key: 'gapBetweenBoxes', descricao: `0 overlapping pairs; gap ≥ ${lim('gapBetweenBoxes')} px` },
    fonte: 'Purchase 2002; Dunne et al. 2015 (node occlusion); Azure WAF',
  },
  {
    id: 'A3.2', family: 'A3', name: 'Label-label overlap', severity: 'fail', input: 'geometry',
    mede: 'intersection of the label bands the engine reserved',
    limiar: { key: 'labelPadding', descricao: `0 pairs, with padding of ${lim('labelPadding')} px` },
    fonte: 'Dunne et al. 2015; C4 checklist (label legibility)',
    note: 'the engine RESERVES the label band at box height (resolve.cjs) because mxGraph does not reserve it. ' +
      'This check verifies the reservation; if the real text overflows the reservation, render (B7) is the one that flags it.',
  },
  {
    id: 'A3.3', family: 'A3', name: 'Label overflowing its box', severity: 'fail', input: 'geometry',
    mede: 'the reserved label band fits inside the owner\'s box, with inner padding',
    limiar: { descricao: '0 overflows' },
    fonte: 'AWS deck (Labels rules); direct consequence of A1.4',
  },
  {
    id: 'A3.4', family: 'A3', name: 'Label-edge overlap', severity: 'fail', input: 'geometry',
    mede: 'the label band crosses an edge segment that does not own the label',
    limiar: { descricao: '0 crossings' },
    fonte: 'Dunne et al. 2015 (node-edge occlusion, generalized to text)',
  },
  {
    id: 'A3.5', family: 'A3', name: 'Edge crossing a node', severity: 'fail', input: 'geometry',
    mede: 'the edge\'s polyline crosses the box of a node that is neither its origin nor its destination',
    limiar: { descricao: '0' },
    fonte: 'Dunne et al. 2015; Azure WAF ("Avoid ambiguous lines")',
  },
  {
    id: 'A3.6', family: 'A3', name: 'Arrow anchoring', severity: 'fail', input: 'geometry',
    mede: 'the polyline\'s ends touch the perimeter of the origin and the destination',
    limiar: { key: 'anchorTolerance', descricao: `±${lim('anchorTolerance')} px from the perimeter` },
    fonte: 'consequence of A1.6/A1.8; Azure WAF',
  },
  {
    id: 'A3.7', family: 'A3', name: 'Nothing outside the canvas', severity: 'fail', input: 'geometry',
    mede: 'the union of everything fits in the canvas, with margin',
    limiar: { key: 'canvasMargin', descricao: `contained, margin ≥ ${lim('canvasMargin')} px` },
    fonte: 'a render requirement; no guide needs to say it',
  },
  {
    id: 'A3.8', family: 'A3', name: 'Node resolution (NR)', severity: 'warn', input: 'geometry',
    mede: 'NR = min‖u−v‖ / max‖u−v‖ over node centers',
    limiar: { key: 'nodeResolutionQ1', descricao: `warn if NR < ${lim('nodeResolutionQ1')}; target ≥ ${lim('nodeResolutionMedian')}` },
    fonte: 'Mooney et al., GD 2025, eq. (9) + Table 2',
  },
  {
    id: 'A3.9', family: 'A3', name: 'Minimum font size', severity: 'warn', input: 'style', calibravel: true,
    mede: 'declared font size per text class',
    limiar: { key: 'minEdgeLabelFontSize', descricao: `≥ ${lim('minEdgeLabelFontSize')} px on edge label; ≥ ${lim('minElementNameFontSize')} px on element name` },
    fonte: 'derived — the rubric is explicit: this is NOT a WCAG rule (WCAG governs contrast, not size)',
  },

  // ------------------------------------------------------------------- A4
  // "In an AWS diagram this family carries the drawing's strongest semantics:
  // the VPC box IS the network boundary. An error here isn't ugly, it's
  // factually wrong."
  {
    id: 'A4.1', family: 'A4', name: 'Strict containment', severity: 'fail', input: 'geometry',
    mede: 'every child fits inside the parent, with padding on all four sides',
    limiar: { key: 'groupPadding', descricao: `100%, padding ≥ ${lim('groupPadding')} px, zero tolerance` },
    fonte: 'Gestalt/common region (Kobourov, Mchedlidze & Vonessen); Azure WAF ("Be accurate")',
  },
  {
    id: 'A4.2', family: 'A4', name: 'Non-member outside the region', severity: 'fail', input: 'geometry', semantica: true,
    mede: 'no node falls inside a group it is not a child of',
    limiar: { descricao: '0 violations, zero tolerance' },
    fonte: 'common region (Gestalt); the rubric: "the most semantically severe failure in the whole validator"',
    note: 'it communicates membership in a network boundary that does not exist. It is not aesthetics: it is the drawing lying.',
  },
  {
    id: 'A4.3', family: 'A4', name: 'Sibling groups disjoint', severity: 'fail', input: 'geometry',
    mede: 'groups with the same parent, with no ancestry between them, do not overlap',
    limiar: { descricao: '0' },
    fonte: 'common region; the AWS hierarchy (Region ⊃ VPC ⊃ AZ ⊃ Subnet) is a tree',
  },
  {
    id: 'A4.4', family: 'A4', name: 'Geometric nesting == logical nesting', severity: 'fail', input: 'geometry', semantica: true,
    mede: 'the containment tree derived from the geometry is identical to the declared tree',
    limiar: { descricao: 'identical trees' },
    fonte: 'Azure WAF ("Be accurate"); common region',
    note: 'this is the test that the drawing and the model tell the same story. Diverging here means the diagram ' +
      'asserts a topology the model denies — the same class of lie as A4.2, seen from the other side.',
  },
  {
    id: 'A4.5', family: 'A4', name: 'Uniform group padding', severity: 'warn', input: 'geometry',
    mede: 'deviation of the four inner paddings, and across groups of the same type',
    limiar: { key: 'maxPaddingDeviation', descricao: `σ ≤ ${lim('maxPaddingDeviation')} px intra-group` },
    fonte: 'Azure WAF ("Maintain consistency"); Gestalt similarity',
  },
  {
    id: 'A4.6', family: 'A4', name: 'Group label in canonical position', severity: 'warn', input: 'geometry',
    mede: 'the group\'s label and icon sit in the inner top-left corner, without colliding with a child',
    limiar: { descricao: '100%' },
    fonte: 'IBM ("icons in upper left corners"); AWS deck (Groups)',
  },
  {
    id: 'A4.7', family: 'A4', name: 'Intra/inter-group proximity ratio', severity: 'warn', input: 'geometry', calibravel: true,
    mede: 'ρ = mean intra-group distance / mean inter-group distance',
    limiar: { key: 'maxProximity', descricao: `ρ ≤ ${lim('maxProximity')}` },
    fonte: 'proximity formalized in Kobourov, Mchedlidze & Vonessen',
  },

  // ------------------------------------------------------------------- A5
  {
    id: 'A5.1', family: 'A5', name: 'Edge crossings (EC)', severity: 'fail', escalona: true, input: 'geometry',
    mede: 'EC = 1 − c/c_max, and the absolute crossing count',
    limiar: { key: 'crossingsQ1', descricao: `target 0 crossings; warn at ≥1; fail above ⌈|E|/10⌉` },
    fonte: 'Purchase 1997 ("by far the most important aesthetic"); Mooney et al., GD 2025, eq. (3)',
  },
  {
    id: 'A5.2', family: 'A5', name: 'Crossing angle (CA)', severity: 'fail', escalona: true, input: 'geometry',
    mede: 'normalized CA and the smallest absolute angle between crossing edges',
    limiar: { key: 'minCrossingAngle', descricao: `target ≥ ${lim('idealCrossingAngle')}°; fail if < ${lim('minCrossingAngle')}°` },
    fonte: 'Huang, Eades, Hong & Lin (JVLC 2014); formula in Mooney et al., GD 2025, eq. (2)',
  },
  {
    id: 'A5.3', family: 'A5', name: 'Number of bends per edge', severity: 'fail', escalona: true, input: 'geometry', calibravel: true,
    mede: 'bends(e) = |points(e)| − 2; maximum and mean',
    limiar: { key: 'bendsWarn', descricao: `target ≤ ${lim('bendsTarget')}; warn above ${lim('bendsWarn')}; fail above ${lim('bendsFail')}` },
    fonte: 'Purchase 1997; Gestalt/continuation (Kobourov et al.)',
  },
  {
    id: 'A5.4', family: 'A5', name: 'Bend angle', severity: 'fail', escalona: true, input: 'geometry', calibravel: false,
    mede: 'interior angle at each polyline vertex',
    limiar: { key: 'bendAngleTarget', descricao: `≥ ${lim('bendAngleTarget')}°; fail below ${lim('bendAngleFail')}°` },
    fonte: 'Gestalt/continuation — "few bends, none abrupt"',
  },
  {
    id: 'A5.5', family: 'A5', name: 'Edge crossing a spurious boundary', severity: 'fail', input: 'geometry', semantica: true,
    mede: 'the polyline enters a group that contains neither the origin nor the destination, and is not a common ancestor',
    limiar: { descricao: '0, zero tolerance' },
    fonte: 'common region (Gestalt) + Azure WAF ("Be accurate")',
    note: 'an edge cutting through someone else\'s VPC suggests a network path that does not exist. Like A4.2: the drawing lies.',
  },
  {
    id: 'A5.6', family: 'A5', name: 'Edge orthogonality (EO)', severity: 'warn', input: 'geometry',
    mede: 'length-weighted angular deviation to the nearest axis',
    limiar: { key: 'orthogonalityTarget', descricao: `if orthogonal: EO ≥ ${lim('orthogonalityTarget')}; if straight: warn only if EO < ${lim('orthogonalityQ1')}` },
    fonte: 'Mooney et al., GD 2025, eqs. (5)–(6); Purchase 2002',
  },
  {
    id: 'A5.7', family: 'A5', name: 'Consistent flow direction', severity: 'warn', input: 'geometry', calibravel: true,
    mede: 'fraction of edges that project positively onto the dominant axis',
    limiar: { key: 'minConsistentFlow', descricao: `≥ ${lim('minConsistentFlow')}` },
    fonte: 'Purchase 2002 (consistent flow direction); Kobourov et al.',
  },
  {
    id: 'A5.8', family: 'A5', name: 'Parallel edges separated', severity: 'fail', input: 'geometry',
    mede: 'Hausdorff distance between polylines of the same origin→destination pair; and non-zero length',
    limiar: { key: 'parallelEdgeSeparation', descricao: `separation ≥ ${lim('parallelEdgeSeparation')} px` },
    fonte: 'consequence of A1.6 (each edge has its own legible label)',
  },
  {
    id: 'A5.9', family: 'A5', name: 'Edge length uniformity (ELD)', severity: 'warn', input: 'geometry',
    mede: 'ELD = 1/(1 + mean relative deviation from the ideal length)',
    limiar: { key: 'edgeLengthUniformityQ1', descricao: `warn if ELD < ${lim('edgeLengthUniformityQ1')}` },
    fonte: 'Mooney et al., GD 2025, eq. (4); Purchase 2002',
    note: 'the rubric asks for the calculation SEPARATED by edge class — in a diagram with nested groups, ' +
      'intra-group and inter-group lengths naturally differ, and mixing the two populations fails the correct drawing.',
  },

  // ------------------------------------------------------------------- A6
  {
    id: 'A6.1', family: 'A6', name: 'Angular resolution (AR)', severity: 'fail', escalona: true, input: 'geometry',
    mede: 'normalized AR, and the minimum absolute angle between edges incident on the same node',
    limiar: { key: 'angularResolutionQ1', descricao: `warn if AR < ${lim('angularResolutionQ1')}; fail if the absolute angle < ${lim('minIncidentAngle')}°` },
    fonte: 'Mooney et al., GD 2025, eq. (1); Purchase 2002',
  },
  {
    id: 'A6.2', family: 'A6', name: 'Node uniformity (NU)', severity: 'warn', input: 'geometry',
    mede: 'distribution of nodes across a grid over the bounding box',
    limiar: { key: 'nodeUniformityQ1', descricao: `warn if NU < ${lim('nodeUniformityQ1')}` },
    fonte: 'Mooney et al., GD 2025, eq. (10)',
  },
  {
    id: 'A6.3', family: 'A6', name: 'Aspect ratio (Asp)', severity: 'warn', input: 'geometry',
    mede: 'min(h,w)/max(h,w) of the bounding box, and the difference from the canvas ratio',
    limiar: { key: 'aspectRatioQ1', descricao: `warn if Asp < ${lim('aspectRatioQ1')} or if it differs from the canvas by > ${lim('aspectRatioTolerance') * 100}%` },
    fonte: 'Mooney et al., GD 2025 (definition + percentiles)',
  },
  {
    id: 'A6.4', family: 'A6', name: 'Grid alignment', severity: 'warn', input: 'geometry', calibravel: true,
    mede: 'fraction of nodes that share x or y with at least one other node',
    limiar: { key: 'minAlignment', descricao: `≥ ${lim('minAlignment') * 100}% of nodes, step of ${lim('gridStep')} px` },
    fonte: 'graph aesthetics (grid alignment); Gestalt/symmetry via Kobourov et al.',
    note: 'the operational substitute for symmetry — see B1, which deliberately leaves it out of (A).',
  },
  {
    id: 'A6.5', family: 'A6', name: 'Neighborhood preservation (NP) / Stress (KSM)', severity: 'warn', input: 'geometry',
    mede: 'NP and KSM per Mooney et al., eqs. (7)–(8)',
    limiar: { key: 'neighborhoodPreservationQ1', descricao: `warn if NP < ${lim('neighborhoodPreservationQ1')} or KSM < ${lim('stressQ1')}` },
    fonte: 'Mooney et al., GD 2025, eqs. (7)–(8)',
    note: 'the rubric itself warns: in an architecture diagram, position is dictated by groups (VPC/AZ), ' +
      'not by graph distance. "Low priority; probably noise."',
  },

  // ------------------------------------------------------------------- A7
  {
    id: 'A7.1', family: 'A7', name: 'Text contrast', severity: 'fail', input: 'style',
    mede: 'contrast ratio between the text color and the EFFECTIVE BACKGROUND resolved by the group stack',
    limiar: { key: 'smallTextContrast', descricao: `≥ ${lim('smallTextContrast')}:1; ≥ ${lim('largeTextContrast')}:1 for large text` },
    fonte: 'WCAG 2.2 SC 1.4.3 (AA); formula in G18',
  },
  {
    id: 'A7.2', family: 'A7', name: 'Non-text contrast', severity: 'fail', input: 'style',
    mede: 'contrast of node border, group border, edge stroke and arrowhead against the effective background',
    limiar: { key: 'nonTextContrast', descricao: `≥ ${lim('nonTextContrast')}:1` },
    fonte: 'WCAG 2.2 SC 1.4.11 — covers "each line in a graph"',
  },
  {
    id: 'A7.3', family: 'A7', name: 'Color is not the only channel', severity: 'fail', input: 'style',
    mede: 'two meanings that differ ONLY in fill color',
    limiar: { descricao: '0 pairs' },
    fonte: 'WCAG 2.2 SC 1.4.1 (level A); Azure WAF; C4; Google style guide',
  },
  {
    id: 'A7.4', family: 'A7', name: 'Distinguishability under color deficiency', severity: 'warn', input: 'style', calibravel: true,
    mede: 'smallest ΔE00 between colors of distinct meanings, under protanopia, deuteranopia and tritanopia',
    limiar: { key: 'minDeltaE00', descricao: `ΔE00 ≥ ${lim('minDeltaE00')} across the three simulations` },
    fonte: 'WCAG SC 1.4.1 is the normative requirement; the simulation test is engineering operationalization',
    note: 'A7.3 is already the normative safety net; A7.4 is a complementary diagnostic.',
  },
  {
    id: 'A7.5', family: 'A7', name: 'Legend contrast', severity: 'fail', input: 'style',
    mede: 'A7.1 and A7.2 applied to the legend\'s text and color swatches',
    limiar: { descricao: 'same as A7.1 and A7.2' },
    fonte: 'WCAG 2.2 SC 1.4.3 and 1.4.11',
  },

  // ------------------------------------------------------------------- A8
  {
    id: 'A8.1', family: 'A8', name: 'First-class element count', severity: 'fail', escalona: true, input: 'geometry',
    mede: 'number of nodes, excluding group boxes',
    limiar: { key: 'elementsTarget', descricao: `target ≤ ${lim('elementsTarget')}; warn at 21-${lim('elementsFail')}; fail above ${lim('elementsFail')}` },
    fonte: 'Ghoniem/Fekete/Castagliola; Yoghourdjian et al.; Störrle; C4 FAQ',
    note: 'the rubric is explicit about the remedy: DECOMPOSE, don\'t shrink (Moody & Heymans, RE\'09).',
  },
  {
    id: 'A8.2', family: 'A8', name: 'Edge density', severity: 'warn', input: 'geometry',
    mede: 'd = |E|/C(|V|,2) and the linear density |E|/|V|',
    limiar: { key: 'maxDensity', descricao: `warn if d > ${lim('maxDensity')} AND |V| > ${lim('elementsTarget')}` },
    fonte: 'Yoghourdjian et al. (78% of studies use density <10%)',
  },
  {
    id: 'A8.3', family: 'A8', name: 'Edges per node (fan-out)', severity: 'warn', input: 'geometry', calibravel: true,
    mede: 'max(degree(v))',
    limiar: { key: 'maxFanOut', descricao: `warn if degree > ${lim('maxFanOut')}` },
    fonte: 'derived from A6.1 + Ware et al. 2002',
  },
  {
    id: 'A8.4', family: 'A8', name: 'Ink coverage', severity: 'warn', input: 'render', calibravel: true,
    mede: 'fraction of non-background pixels over the canvas area',
    limiar: { key: 'inkCoverage', descricao: `range [${lim('inkCoverage').join(' ; ')}] as a signal, not a failure` },
    fonte: 'Tufte (data-ink), explicitly adapted and weakened by the rubric itself',
    porqueRender: 'a non-background pixel only exists after rasterizing. There is no honest approximation from the plan: ' +
      'summing box areas counts the empty space inside a group as ink, and a large, empty group would come out "dense".',
  },
];

const INDEX = new Map(CHECKS.map(c => [c.id, c]));
const byId = id => INDEX.get(id);

/** The ones the mandatory validator covers — everything not handed off to render. */
const FROM_VALIDATOR = CHECKS.filter(c => c.input !== 'render');
/** The ones the opportunistic judge covers. The partition is exhaustive and non-overlapping. */
const FROM_RENDER = CHECKS.filter(c => c.input === 'render');

module.exports = {
  CHECKS, INDEX, THRESHOLDS, SEVERITIES, INPUTS,
  FROM_VALIDATOR, FROM_RENDER, byId, lim,
};
