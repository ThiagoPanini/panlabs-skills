'use strict';
/** Recorta cada `<diagram>` de saida/varejo.drawio para um arquivo de uma pagina. */
const fs = require('fs');
const path = require('path');

const arq = path.join(__dirname, '..', 'saida', 'varejo.drawio');
const xml = fs.readFileSync(arq, 'utf8');
const paginas = xml.match(/ *<diagram[\s\S]*?<\/diagram>/g) || [];
if (paginas.length !== 2) {
  console.error(`  esperava 2 paginas em saida/varejo.drawio, achei ${paginas.length} — rode sessao1 e sessao2 antes.`);
  process.exit(1);
}
paginas.forEach((p, i) => fs.writeFileSync(path.join(__dirname, '..', 'saida', `_p${i}.drawio`),
  `<mxfile host="panlabs-aws-diagrams" compressed="false">\n${p}\n</mxfile>\n`));
