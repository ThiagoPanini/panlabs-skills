#!/usr/bin/env node
'use strict';
/**
 * A mesma decisão, conferida NO ARQUIVO EMITIDO — não na regra que eu escrevi.
 *
 * O `check-camada.cjs` prova que a REGRA ordena certo, e ele faz isso chamando
 * a regra. Se um dia o `dispor.cjs` parar de consultar a camada, aquela régua
 * continua verde e o desenho sai errado: ela estaria conferindo a minha
 * intenção, não o produto. É a lição que o #17 pagou caro — "checagem estática
 * não substitui render" — e o formato aqui é o do `check-travessia.cjs` do #12.
 *
 * Esta lê o `.drawio` que o motor acabou de emitir, extrai o Y de cada célula
 * de subnet e confere que a ordem de cima para baixo é a que o ticket espera.
 * Passa pelo pipeline inteiro: derivar › dispor › planejar › emitir.
 *
 * O Y é da GEOMETRIA, não da ordem das células no documento: a ordem do
 * documento é ordem Z e não é o que o leitor vê empilhado.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

const { gerar } = require(path.join(RAIZ, 'motor', 'gerar.cjs'));

/**
 * O que o ticket #22 espera ver, de cima para baixo, em cada modelo.
 * É a tabela do enunciado, mais os casos que este protótipo acrescentou.
 */
const ESPERADO = {
  'app-dados': ['App subnet', 'Data subnet'],
  'web-dados': ['Web subnet', 'Data subnet'],
  'ingest-core': ['Ingest subnet', 'Core subnet'],
  'tres-camadas-mistas': ['Firewall subnet', 'Worker subnet', 'Analytics subnet'],
  'subnet-vazia-declarada': ['App subnet', 'Reserved subnet'],
  'web-dados-com-fluxo': ['Public subnet', 'Web subnet', 'Data subnet'],
  'elk-sem-camada': ['App subnet', 'Reserved subnet'],
};

/**
 * As faixas de subnet do XML, de cima para baixo, sem repetir rótulo.
 *
 * O `value` de uma célula de subnet é o rótulo, e o estilo dela traz
 * `grIcon=…group_security_group` — é assim que o catálogo (#17) desenha as duas
 * subnets, e é o que separa a subnet da VPC e da nuvem no mesmo arquivo.
 *
 * Cada papel aparece uma vez por zona, todas na mesma linha: deduplicar por
 * rótulo devolve exatamente as LINHAS da grade, que é o que se quer conferir.
 */
function linhasDoArquivo(xml) {
  const celulas = [...xml.matchAll(
    /<mxCell id="([^"]+)" value="([^"]*)" style="([^"]*)"[^>]*>\s*<mxGeometry x="(-?\d+)" y="(-?\d+)"/g)]
    .filter(m => /group_security_group/.test(m[3]))
    .map(m => ({ id: m[1], rotulo: m[2], y: Number(m[5]) }));

  celulas.sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));
  const vistos = new Set();
  return celulas.filter(c => !vistos.has(c.rotulo) && vistos.add(c.rotulo)).map(c => c.rotulo);
}

(async () => {
  let falhas = 0;
  console.log('\n  ordem das linhas LIDA DO ARQUIVO EMITIDO\n');

  for (const [nome, esperado] of Object.entries(ESPERADO)) {
    const modelo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'modelo', `${nome}.json`), 'utf8'));
    const { xml } = await gerar(modelo);
    const obtido = linhasDoArquivo(xml);
    const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
    if (!ok) falhas++;
    console.log(`  ${ok ? '✓' : '✗'} ${nome.padEnd(24)} ${obtido.join(' → ')}`);
    if (!ok) console.log(`      esperado: ${esperado.join(' → ')}`);
  }

  /**
   * O controle: sem ele, um extrator que devolvesse lista vazia passaria em
   * tudo. Aqui a subnet de dados é declarada como borda — o desenho TEM de
   * inverter, e se não inverter é porque o arquivo não está sendo lido.
   */
  const controle = JSON.parse(fs.readFileSync(path.join(RAIZ, 'modelo', 'web-dados.json'), 'utf8'));
  for (const n of controle.nos) if (n.rotulo === 'Data subnet') n.camada = 'borda';
  const { xml } = await gerar(controle);
  const invertido = linhasDoArquivo(xml);
  const inverteu = JSON.stringify(invertido) === JSON.stringify(['Data subnet', 'Web subnet']);
  if (!inverteu) falhas++;
  console.log(`\n  ${inverteu ? '✓' : '✗'} controle: declarar a Data subnet como "borda" inverte o desenho ` +
    `— ${invertido.join(' → ')}`);

  console.log(falhas
    ? `\n  ✗ ${falhas} falha(s) — a ordem no arquivo não é a que a regra promete`
    : '\n  ✓ o que a regra decide é o que o arquivo mostra.');
  process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
