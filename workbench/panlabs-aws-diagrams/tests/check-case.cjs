#!/usr/bin/env node
'use strict';
/**
 * #41 — the case verb: session@1 + slug -> the case's file set, at the
 * CALLER's project root, never inside this skill's own tree.
 * #42 — that file set now includes `case.md`, the dossier rendered for the
 * human deciding whether to trust the drawing.
 *
 *   node tests/check-case.cjs [drawio-binary]
 *
 * Without an argument this covers everything that does not need the render
 * binary: the seam's purity, `case-notes.cjs`'s own rendering (unit-tested
 * directly, with a hand-built session — no engine, no disk), the corpus's
 * two session cases drawing under the `truthfulness` gate and coming out
 * with a `case.md` whose five sections are in order and whose known floor
 * (A1.2, A1.11) is genuinely present in the underlying report yet absent
 * from the file, the multi-page order (logical first, technical after —
 * general form of "two tabs", since a multi-account technical view is already
 * 1+N pages), the one-seal-per-page guarantee, the refusal of a logical-stage
 * session, and both branches of directory resolution (inside a git repo, and
 * outside one). With the binary, it additionally asks for `--image` and
 * requires the PNG to exist; without it, it forces a missing `DRAWIO` and
 * requires the opt-in warning instead of a failure.
 *
 * #196 — the same no-argument run also drives `--image` against three stub
 * binaries (refuses, hangs, crashes with Chromium's sandbox FATAL shape) and
 * requires the PERSON who asked for the image to read three DIFFERENT
 * sentences, not the one generic failure this file used to print for all of
 * them. It needs `xvfb-run`, not a real draw.io — same premise as
 * `check-render-verdict.cjs`, which is what actually measures `render.sh`'s
 * own exit codes; this file only checks that `case.cjs` translates them.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams');
const WORKBENCH = path.join(__dirname, '..');
const CLI = path.join(ROOT, 'tools', 'case.cjs');
const { caseFiles } = require(path.join(ROOT, 'tools', 'case.cjs'));
const { caseNotes } = require(path.join(ROOT, 'session', 'case-notes.cjs'));
const { draw } = require(path.join(ROOT, 'session', 'draw.cjs'));
const { elaborate } = require(path.join(ROOT, 'session', 'elaborate.cjs'));
const { readPages } = require(path.join(ROOT, 'session', 'fingerprint.cjs'));

let failed = 0;
function check(desc, ok) {
  console.log(`  ${ok ? '✓' : '✗'} ${desc}`);
  if (!ok) failed = 1;
  return ok;
}

const HEADERS = [
  '## 1. The case',
  '## 2. What I understood',
  '## 3. The decisions',
  '## 4. What I inferred',
  '## 5. What deserves attention',
];
function headersInOrder(md) {
  const positions = HEADERS.map(h => md.indexOf(h));
  return positions.every(p => p >= 0) && positions.every((p, i) => i === 0 || p > positions[i - 1]);
}

// `retail`'s pair moved to the skill's own `examples/session/` (#44) — it's
// the documented example; `fleet`'s stays in the workbench corpus.
function sessionFile(name) {
  const inExamples = path.join(ROOT, 'examples', 'session', name);
  return fs.existsSync(inExamples) ? inExamples : path.join(WORKBENCH, 'models', 'session', name);
}

function technicalSession(name) {
  const logical = JSON.parse(fs.readFileSync(sessionFile(`${name}-logical.json`), 'utf8'));
  const delta = JSON.parse(fs.readFileSync(sessionFile(`${name}-elaboration.json`), 'utf8'));
  return elaborate(logical, delta);
}

// The prose that "started" each corpus case — invented for this suite, since
// neither fixture carries one (session@1 has nowhere to persist it; #42's
// case verb takes it fresh, per call, in `opts.brief`).
const BRIEF = {
  retail: 'Precisamos receber o arquivo de vendas de 300 lojas todo dia, guardar por 5 anos ' +
    'por exigência de auditoria, e dar para a diretoria um painel com o histórico consolidado.',
  fleet: 'Frota de 1.200 caminhões manda telemetria a cada 30 segundos; quando a leitura foge ' +
    'do padrão, uma ordem de manutenção tem que abrir sozinha na oficina mais próxima.',
};

async function main() {
  // 1 · the seam is pure — no `fs`, no child process reachable from its own
  // source. Read from the file so a future edit that sneaks a disk write in
  // is caught by TEXT, not by trusting the docstring above it.
  const src = fs.readFileSync(CLI, 'utf8');
  const seamBody = src.slice(src.indexOf('async function caseFiles'), src.indexOf('the CLI\n'));
  check('the seam touches neither `fs` nor a child process',
    !/\bfs\.|spawnSync|execFileSync|writeFileSync/.test(seamBody));

  const notesSrc = fs.readFileSync(path.join(ROOT, 'session', 'case-notes.cjs'), 'utf8');
  check('case-notes.cjs touches neither `fs` nor a child process',
    !/\bfs\.|spawnSync|execFileSync|writeFileSync/.test(notesSrc));

  // 2 · case-notes.cjs, unit-tested directly — a hand-built session, no
  // engine and no disk, so every branch is reachable here regardless of what
  // the corpus happens to contain. Since #123 the corpus exercises the
  // resource-name branch too, and the two now agree from opposite directions.
  console.log('\n  case-notes.cjs — the rendering, in isolation\n');
  const fakeSession = {
    schema: 'panlabs-aws-diagrams/session@1', id: 'unit-case-notes', title: 'Unit test — case notes', stage: 'technical',
    nodes: [
      { id: 'orders-table', label: 'Guardar pedidos', technical: { kind: 'service', service: 'dynamodb', resource: 'orders-table' } },
      { id: 'diretoria', label: 'Diretoria', logical: { kind: 'actor' } },
    ],
    dossier: {
      facts: [
        { fact: 'ASKED FACT', provenance: 'asked', confirmed: true },
        { fact: 'INFERRED FACT', provenance: 'inferred', confirmed: true, from: 'Q3' },
      ],
      candidates: [
        { id: 'cand-a', name: 'CHOSEN CANDIDATE', state: 'chosen', tuple: ['x', 'x', 'x', 'x', 'x'], because: 'CHOSEN BECAUSE' },
        { id: 'cand-b', name: 'DISCARDED CANDIDATE', state: 'discarded', tuple: ['y', 'y', 'y', 'y', 'y'], because: 'DISCARDED BECAUSE' },
      ],
      findings: [
        { rule: 'spof', target: 'orders-table', state: 'rejected', note: 'FINDING NOTE' },
      ],
    },
  };
  const md = caseNotes(fakeSession, {
    brief: 'THE VERBATIM BRIEF TEXT.',
    semanticFailures: [{ id: 'A4.2', name: 'Non-member outside the region', message: 'FAKE SEMANTIC MESSAGE', view: 'technical' }],
  });
  check('renders the five sections, in order', headersInOrder(md));
  check('the brief appears verbatim', md.includes('THE VERBATIM BRIEF TEXT.'));
  check('an asked fact sits before "Inferred"', md.indexOf('ASKED FACT') > -1 && md.indexOf('ASKED FACT') < md.indexOf('**Inferred**'));
  check('an inferred fact sits after "Inferred", with its source', md.indexOf('**Inferred**') < md.indexOf('INFERRED FACT') && md.includes('INFERRED FACT — source: Q3'));
  check('the chosen candidate and why it won both appear', md.includes('CHOSEN CANDIDATE') && md.includes('CHOSEN BECAUSE'));
  check('the discarded candidate and why not it both appear', md.includes('DISCARDED CANDIDATE') && md.includes('DISCARDED BECAUSE'));
  check('the inferred resource name appears, tied to its node', md.includes('Guardar pedidos') && md.includes('orders-table'));
  check('a node with no resource never shows up in that block',
    !md.slice(md.indexOf('4. What I inferred'), md.indexOf('5. What deserves attention')).includes('diretoria'));
  check('the semantic failure appears', md.includes('A4.2') && md.includes('FAKE SEMANTIC MESSAGE'));
  check('the gap finding appears with its state', md.includes('[rejected] spof') && md.includes('FINDING NOTE'));

  try {
    caseNotes(fakeSession, {});
    check('refuses with no brief', false);
  } catch (e) {
    check('refuses with no brief', /brief/.test(e.message));
  }
  try {
    caseNotes(fakeSession, { brief: '   ' });
    check('refuses with a blank brief', false);
  } catch (e) {
    check('refuses with a blank brief', /brief/.test(e.message));
  }

  const bareSession = { schema: 'panlabs-aws-diagrams/session@1', id: 'bare', title: 'Bare', stage: 'technical', nodes: [{ id: 'n1', label: 'N1' }] };
  const bareMd = caseNotes(bareSession, { brief: 'A BARE BRIEF.' });
  check('all five sections render even with an empty dossier', headersInOrder(bareMd));

  // 3 · the corpus's session cases draw under the gate, and none is refused —
  // this is what promotes #31/#32 from tolerable defect to blocking wall, and
  // it is why this ticket waited on them.
  console.log('\n  the corpus, through the real verb\n');
  const drawn = {};
  for (const name of ['retail', 'fleet']) {
    const technical = technicalSession(name);
    try {
      drawn[name] = await caseFiles(technical, name, { gate: 'truthfulness', brief: BRIEF[name] });
      check(`"${name}" draws under the truthfulness gate`, true);
    } catch (e) {
      check(`"${name}" draws under the truthfulness gate`, false);
      console.log(`      · ${e.message}`);
      for (const l of e.errors || []) console.log(`        ${l}`);
    }
  }

  for (const name of Object.keys(drawn)) {
    const result = drawn[name];
    const technical = technicalSession(name);
    check(`"${name}": exactly two files — "${name}.drawio" and "case.md"`,
      result.files.length === 2 &&
      result.files.some(f => f.path === `${name}.drawio`) &&
      result.files.some(f => f.path === 'case.md'));
    // #42's own acceptance criterion, read literally: no report file — the 62
    // checks stay on the terminal for whoever runs the command.
    check(`"${name}": no report file was written to the case directory`,
      !result.files.some(f => /report/i.test(f.path)));

    const drawio = result.files.find(f => f.path === `${name}.drawio`);
    const { pages } = readPages(drawio.content);
    // General form of "two tabs, logical first": a multi-account technical
    // view is already 1+N pages (#12's D2), so the invariant is the SPLIT,
    // not a literal count of two.
    check(`"${name}": at least a logical and a technical page`, pages.length >= 2);
    check(`"${name}": logical page comes first`, pages[0]?.seal?.panlabsVista === 'logical');
    check(`"${name}": every page after it is technical`,
      pages.slice(1).every(p => p?.seal?.panlabsVista === 'technical'));

    // one seal per page — the point of #14, still honored here: deleting
    // one page in draw.io cannot take the session out of the other.
    const allSealed = pages.every(p => p.seal && p.seal.panlabsSessao);
    check(`"${name}": every page carries its own session seal`, allSealed);
    if (allSealed) {
      const ids = new Set(pages.map(p => JSON.parse(p.seal.panlabsSessao).id));
      check(`"${name}": every seal resumes the same session`, ids.size === 1);
    }

    // #42 — case.md itself
    const caseMd = result.files.find(f => f.path === 'case.md').content;
    check(`"${name}": case.md has the five sections, in order`, headersInOrder(caseMd));
    check(`"${name}": the original brief appears verbatim`, caseMd.includes(BRIEF[name]));
    // Both halves of section 4, against the real verb. Until #123 gave the
    // shipped elaboration its `resource` names, BOTH corpus cases landed on the
    // empty branch and the populated one was exercised only by the pure seam
    // above — which is how a section stays correct and is never once seen
    // carrying anything.
    //
    // Which half a case lands on is asked of the SESSION, never of its name: a
    // third fixture would otherwise fall silently into whichever branch the
    // `else` happened to be, and the fixtures are documentation — they move.
    const named = technical.nodes.filter(n => n.technical && n.technical.resource).map(n => n.technical.resource);
    const EMPTY = '_No resource name was inferred for this drawing._';
    if (named.length) {
      check(`"${name}": case.md lists all ${named.length} inferred resource names, tied to their nodes`,
        named.every(r => caseMd.includes(`"${r}"`)) && !caseMd.includes(EMPTY));
    } else {
      check(`"${name}": no resource name was inferred here, and case.md says so`, caseMd.includes(EMPTY));
    }
    // "Fixo porque a aceitação precisa ser observável" — the ~80-line target is
    // only observable if something actually counts. 80 is a soft "around", not
    // a hard truncation point (nothing here drops a real finding to fit), so
    // this fails loud on real growth instead of silently drifting past it.
    const lineCount = caseMd.split('\n').length;
    check(`"${name}": case.md stays around 80 lines (got ${lineCount})`, lineCount <= 80);

    // The known floor: A1.2 (no legend) and A1.11 (no freshness metadata) fail
    // on every page today — #11's engine emits neither. Confirmed against the
    // RAW report (not `result`, which never carries it) so the exclusion below
    // is proven against real findings, not against an accidentally-empty list.
    const rawTechnical = await draw(technical, 'technical', { gate: 'truthfulness' });
    const allResults = rawTechnical.report.geometry.flatMap(g => g.report.resultados);
    const floorFires = ['A1.2', 'A1.11'].every(id =>
      allResults.some(r => r.id === id && (r.state === 'failure' || r.state === 'warning')));
    check(`"${name}": the known floor (A1.2, A1.11) genuinely fires in the report`, floorFires);
    check(`"${name}": case.md never mentions it`,
      !/A1\.2\b/.test(caseMd) && !/A1\.11\b/.test(caseMd) && !/legend/i.test(caseMd) && !/freshness/i.test(caseMd));
  }

  // 4 · a logical-stage session has no second view to draw — refuse instead
  // of guessing which page to skip.
  const fleetLogicalOnly = JSON.parse(fs.readFileSync(path.join(WORKBENCH, 'models', 'session', 'fleet-logical.json'), 'utf8'));
  try {
    await caseFiles(fleetLogicalOnly, 'fleet', { brief: BRIEF.fleet });
    check('refuses a logical-stage session instead of drawing one tab', false);
  } catch (e) {
    check('refuses a logical-stage session instead of drawing one tab', /technical-stage/.test(e.message));
  }

  // 5 · no brief, no case — #42's own guard, next to #41's stage guard above.
  try {
    await caseFiles(technicalSession('retail'), 'retail', { gate: 'truthfulness' });
    check('refuses a session with no brief', false);
  } catch (e) {
    check('refuses a session with no brief', /brief/.test(e.message));
  }

  // ---------------------------------------------------------- the CLI, for real, on disk
  const fixtures = fs.mkdtempSync(path.join(os.tmpdir(), 'case-fixtures-'));
  const sessionFile = path.join(fixtures, 'retail-technical.json');
  fs.writeFileSync(sessionFile, JSON.stringify(technicalSession('retail')));
  const briefFile = path.join(fixtures, 'brief.txt');
  fs.writeFileSync(briefFile, BRIEF.retail);
  const SLUG = 'retail-300-stores';
  const caseDirOf = dir => path.join(dir, 'docs', 'architecture', 'diagrams', SLUG);
  const drawioAt = dir => path.join(caseDirOf(dir), `${SLUG}.drawio`);
  const caseMdAt = dir => path.join(caseDirOf(dir), 'case.md');
  const pngAt = dir => path.join(caseDirOf(dir), `${SLUG}.png`);

  // 6 · inside a git repo, from a NESTED working directory on purpose — this
  // is what proves the resolution walks up to the repo root instead of
  // trusting `cwd` directly.
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'case-repo-'));
  spawnSync('git', ['init', '-q'], { cwd: repo });
  const nested = path.join(repo, 'some', 'nested', 'place');
  fs.mkdirSync(nested, { recursive: true });
  const r1 = spawnSync('node', [CLI, sessionFile, SLUG, '--brief', briefFile], { cwd: nested, encoding: 'utf8' });
  check('CLI inside a git repo: exits 0', r1.status === 0);
  check('CLI inside a git repo: the directory is born at the repo root', fs.existsSync(drawioAt(repo)));
  check('CLI inside a git repo: case.md is born alongside it', fs.existsSync(caseMdAt(repo)));
  check('CLI inside a git repo: case.md carries the brief verbatim',
    fs.readFileSync(caseMdAt(repo), 'utf8').includes(BRIEF.retail));
  check('CLI inside a git repo: nothing landed inside the skill\'s own tree',
    !path.resolve(drawioAt(repo)).startsWith(ROOT + path.sep));

  // 7 · without --brief, the CLI fails the same way the seam does
  const noBriefDir = fs.mkdtempSync(path.join(os.tmpdir(), 'case-nobrief-'));
  const r1b = spawnSync('node', [CLI, sessionFile, SLUG], { cwd: noBriefDir, encoding: 'utf8' });
  check('CLI with no --brief: exits non-zero', r1b.status !== 0);
  check('CLI with no --brief: names the missing brief', /brief/.test(r1b.stderr || r1b.stdout));

  // 8 · outside a git repo: falls back to the current directory, and SAYS so
  const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'case-bare-'));
  const r2 = spawnSync('node', [CLI, sessionFile, SLUG, '--brief', briefFile], { cwd: bare, encoding: 'utf8' });
  check('CLI outside a git repo: exits 0', r2.status === 0);
  check('CLI outside a git repo: warns explicitly', /not inside a git repository/.test(r2.stdout));
  check('CLI outside a git repo: still writes docs/architecture/diagrams/<slug>/', fs.existsSync(drawioAt(bare)));

  // 9 · the image — opt-in, and the two branches of "does the binary exist"
  const drawioArg = process.argv[2];
  if (drawioArg) {
    const withBin = fs.mkdtempSync(path.join(os.tmpdir(), 'case-img-'));
    const r3 = spawnSync('node', [CLI, sessionFile, SLUG, '--brief', briefFile, '--image'],
      { cwd: withBin, encoding: 'utf8', env: { ...process.env, DRAWIO: drawioArg } });
    check('CLI --image, binary present: exits 0', r3.status === 0);
    check('CLI --image, binary present: the PNG exists', fs.existsSync(pngAt(withBin)));
  } else {
    const withoutBin = fs.mkdtempSync(path.join(os.tmpdir(), 'case-noimg-'));
    const r3 = spawnSync('node', [CLI, sessionFile, SLUG, '--brief', briefFile, '--image'],
      { cwd: withoutBin, encoding: 'utf8', env: { ...process.env, DRAWIO: '/nonexistent/drawio' } });
    check('CLI --image, no binary: exits 0 anyway', r3.status === 0);
    check('CLI --image, no binary: warns instead of failing', /skipping the image/.test(r3.stdout));
    check('CLI --image, no binary: no PNG was written', !fs.existsSync(pngAt(withoutBin)));
    console.log('  (binary check skipped — no draw.io binary was passed in)');

    // 10 · three stub binaries, three DIFFERENT sentences (#196). None of this
    // needs a real draw.io — only `xvfb-run`, which `render.sh` calls no
    // matter what `$DRAWIO` points at.
    if (spawnSync('sh', ['-c', 'command -v xvfb-run']).status === 0) {
      console.log("\n  --image against stub binaries — the person reads a different, actionable sentence per state (#196)\n");
      const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'case-stub-'));
      const stubBin = (name, body) => {
        const p = path.join(stubDir, name);
        fs.writeFileSync(p, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
        return p;
      };
      const runImage = (bin, extraEnv) => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'case-imgfail-'));
        const r = spawnSync('node', [CLI, sessionFile, SLUG, '--brief', briefFile, '--image'],
          { cwd: dir, encoding: 'utf8', env: { ...process.env, DRAWIO: bin, ...extraEnv } });
        return { text: `${r.stderr || ''}${r.stdout || ''}`, status: r.status, dir };
      };

      {
        const { text, status, dir } = runImage(stubBin('refused', 'echo "Error: Export failed" >&2; exit 1'));
        check('--image, draw.io REFUSES the file: the CLI fails', status !== 0);
        check('--image, draw.io REFUSES the file: names the drawing, not the environment',
          /the drawing, not the environment/.test(text));
        check('--image, draw.io REFUSES the file: the .drawio was still published (#35\'s "no impede a publicação")',
          fs.existsSync(drawioAt(dir)));
      }

      {
        const { text, status, dir } = runImage(stubBin('hangs', 'while :; do sleep 1; done'), { LIMIT: '2', ATTEMPTS: '2' });
        check('--image, the render NEVER ANSWERS: the CLI fails', status !== 0);
        check('--image, the render NEVER ANSWERS: blames the machine, not the drawing',
          /never answered in time/.test(text));
        check('--image, the render NEVER ANSWERS: the .drawio was still published', fs.existsSync(drawioAt(dir)));
      }

      {
        const { text, status, dir } = runImage(stubBin('sandboxed',
          'echo "[1:1:0101/000000.000000:FATAL:sandbox_host_linux.cc(94)] Check failed: sandboxed_" >&2\nkill -ABRT $$'));
        check("--image, the HOST blocks Chromium's sandbox: the CLI fails", status !== 0);
        check("--image, the HOST blocks Chromium's sandbox: names the environment, not the drawing",
          /an environment restriction, not the drawing/.test(text));
        check("--image, the HOST blocks Chromium's sandbox: the .drawio was still published", fs.existsSync(drawioAt(dir)));
      }
    } else {
      console.log('  (stub failure states skipped (#196) — xvfb-run not found)');
    }
  }

  console.log(failed
    ? '\n  ✗ the case verb has a red assertion above'
    : '\n  ✓ pure seam · case-notes renders in isolation · corpus draws under the gate · ' +
      'case.md\'s five sections land in order with the known floor excluded · one seal per page · ' +
      'writes at the caller\'s root · image is opt-in');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
