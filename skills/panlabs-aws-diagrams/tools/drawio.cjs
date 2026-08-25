'use strict';
/**
 * ONDE ESTÁ O draw.io HEADLESS — um lugar só, e três formas de dizer.
 *
 * O caminho estava escrito à mão em oito arquivos, em duas variantes que não são
 * a mesma coisa: uns apontavam para `squashfs-root/drawio`, outros para
 * `squashfs-root/AppRun`. Os dois funcionam, e é justamente por isso que a
 * divergência passou despercebida — até a suíte passar o binário como argumento
 * para dois checks e não para os outros dois, que caíam no default e podiam
 * pular em silêncio (`exit 0`) enquanto a camada inteira se dizia executada.
 *
 * A ordem de resolução, do mais explícito ao menos:
 *
 *   1. o argumento que quem chamou passou;
 *   2. `$DRAWIO`, para a suíte exportar uma vez e todo mundo herdar;
 *   3. o caminho onde o #10 instalou.
 *
 * ⚠️ É DEPENDÊNCIA DE DESENVOLVIMENTO (premissa 8). Nada em `engine/`,
 * `validator/`, `theme/` ou `session/` importa este arquivo — e `check-sem-prototipo`
 * cobra isso medindo o `require.cache` do pipeline.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const INSTALLED = path.join(os.homedir(), '.local', 'opt', 'drawio', 'squashfs-root', 'drawio');

/**
 * @param {string} [arg]  o que veio na linha de comando, se veio
 * @returns {string}      o caminho, existindo ou não — quem chama decide o que fazer
 */
function binary(arg) {
  return arg || process.env.DRAWIO || INSTALLED;
}

/** O caminho, ou `null` quando não há binário executável ali. */
function binaryIfPresent(arg) {
  const p = binary(arg);
  try { fs.accessSync(p, fs.constants.X_OK); return p; } catch (e) { return null; }
}

module.exports = { binary, binaryIfPresent, INSTALLED };
