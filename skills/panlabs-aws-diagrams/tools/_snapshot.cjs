'use strict';
/** Cuts each `<diagram>` out of output/retail.drawio into one file per page. */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'output', 'retail.drawio');
const xml = fs.readFileSync(file, 'utf8');
const pages = xml.match(/ *<diagram[\s\S]*?<\/diagram>/g) || [];
if (pages.length !== 2) {
  console.error(`  expected 2 pages in output/retail.drawio, found ${pages.length} — run tools/approve.cjs and tools/resume.cjs first.`);
  process.exit(1);
}
pages.forEach((p, i) => fs.writeFileSync(path.join(__dirname, '..', 'output', `_p${i}.drawio`),
  `<mxfile host="panlabs-aws-diagrams" compressed="false">\n${p}\n</mxfile>\n`));
