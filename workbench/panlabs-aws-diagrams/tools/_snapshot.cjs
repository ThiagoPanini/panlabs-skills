'use strict';
/**
 * Cuts each `<diagram>` out of a `.drawio` file into one file per page.
 *
 *   node tools/_snapshot.cjs <file.drawio>
 */
const fs = require('fs');
const path = require('path');

const file = process.argv[2];
if (!file) { console.error('usage: node _snapshot.cjs <file.drawio>'); process.exit(2); }

const xml = fs.readFileSync(file, 'utf8');
const pages = xml.match(/ *<diagram[\s\S]*?<\/diagram>/g) || [];
if (pages.length !== 2) {
  console.error(`  expected 2 pages in ${file}, found ${pages.length} — run tools/approve.cjs and tools/resume.cjs first.`);
  process.exit(1);
}
const dir = path.dirname(file);
pages.forEach((p, i) => fs.writeFileSync(path.join(dir, `_p${i}.drawio`),
  `<mxfile host="panlabs-aws-diagrams" compressed="false">\n${p}\n</mxfile>\n`));
