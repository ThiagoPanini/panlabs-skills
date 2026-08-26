'use strict';
/**
 * WHERE draw.io HEADLESS LIVES — one single place, and three ways to say it.
 *
 * The path used to be hand-written in eight files, in two variants that are not
 * the same thing: some pointed to `squashfs-root/drawio`, others to
 * `squashfs-root/AppRun`. Both work, and that is exactly why the divergence went
 * unnoticed — until the suite passed the binary as an argument to two checks and
 * not to the other two, which fell back to the default and could skip silently
 * (`exit 0`) while the whole layer called itself run.
 *
 * The resolution order, from most explicit to least:
 *
 *   1. the argument whoever called this passed;
 *   2. `$DRAWIO`, so the suite can export it once and everyone inherits it;
 *   3. the path where #10 installed it.
 *
 * ⚠️ THIS IS A DEVELOPMENT DEPENDENCY (assumption 8). Nothing in `engine/`,
 * `validator/`, `theme/` or `session/` imports this file — and `check-no-prototype`
 * enforces that by measuring the pipeline's `require.cache`.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const INSTALLED = path.join(os.homedir(), '.local', 'opt', 'drawio', 'squashfs-root', 'drawio');

/**
 * @param {string} [arg]  whatever came from the command line, if anything did
 * @returns {string}      the path, whether it exists or not — the caller decides what to do
 */
function binary(arg) {
  return arg || process.env.DRAWIO || INSTALLED;
}

/** The path, or `null` when there is no executable binary there. */
function binaryIfPresent(arg) {
  const p = binary(arg);
  try { fs.accessSync(p, fs.constants.X_OK); return p; } catch (e) { return null; }
}

module.exports = { binary, binaryIfPresent, INSTALLED };
