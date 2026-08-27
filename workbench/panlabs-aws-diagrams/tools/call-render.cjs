'use strict';
/**
 * THE ONE PLACE THAT DIALS `render.sh` FOR XML — for callers that want the
 * app's own codec, not a PNG.
 *
 * #144 found four checks that talked to `xvfb-run` on their own: no timeout,
 * so a hung export froze the whole suite forever; a blind retry that reran
 * ANY failure, including a refusal `render.sh` would never repeat; and one of
 * them cleaned up with `ps -C drawio | kill -9`, which reaches every draw.io
 * process on the machine, a neighbour session's legitimate render included.
 * `render.sh` already carries the timeout, the scoped kill (`timeout`'s own
 * process group, no separate sweep) and the answer-vs-non-answer retry that
 * #128 built for PNG. This is the same contract, for whoever needs XML.
 */

const path = require('path');
const { execFileSync } = require('child_process');

const RENDER = path.join(__dirname, '..', '..', '..', 'skills', 'panlabs-aws-diagrams', 'tools', 'render.sh');

/**
 * `render.sh` says so when one of its own retries is what saved the render —
 * read here as a live literal, not copied, for the same reason
 * `tools/bisect-model.cjs` reads it that way: a reword over there is meant to
 * go red here, not to retire the warning in silence.
 */
const FLAKED = /did not answer/;

/** Indents a multi-line log for a two-space nested print. */
const indent = txt => String(txt).trim().split('\n').map(l => '    ' + l.trim()).join('\n');

/**
 * Exports `input` to `output` as `format` through `render.sh`.
 *
 * On success: `{ ok: true, out, flaked }` — `out` is what `render.sh` printed,
 * `flaked` says whether a retry inside `render.sh` is what saved this call.
 *
 * On failure: `{ ok: false, code, log }` — `code` is `render.sh`'s own exit
 * code (1 the drawing was refused, 3 the binary is missing, 4 it never
 * answered even after `render.sh`'s own attempts), and `log` is its report.
 * There is no retry here: whatever `render.sh` decided is final — asking it
 * again would be the exact blind repetition #144 removed.
 */
function callRender(input, output, format, drawio) {
  try {
    const out = execFileSync(RENDER, [input, output, format],
      { encoding: 'utf8', stdio: 'pipe', env: { ...process.env, DRAWIO: drawio } });
    return { ok: true, out, flaked: FLAKED.test(out) };
  } catch (e) {
    const log = `${e.stdout || ''}${e.stderr || ''}`.trim() || `render.sh exited ${e.status} and said nothing`;
    return { ok: false, code: e.status, log };
  }
}

module.exports = { callRender, indent, FLAKED, RENDER };
