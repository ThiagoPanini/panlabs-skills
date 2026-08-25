#!/usr/bin/env node
/**
 * Checagens estáticas do catálogo. Rodam sem renderizar nada.
 *
 *   node check-catalog.cjs                 # checagens auto-contidas
 *   node check-catalog.cjs /tmp/drawio     # + round-trip contra o upstream
 *
 * A checagem que mais importa é a de round-trip: prova que guardar
 * `template + (categoria, stencil)` em vez de 1009 strings literais é
 * COMPACTAÇÃO, não perda — todo style reconstruído bate byte a byte com o que
 * o Sidebar-AWS4.js produz.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = path.join(__dirname, '..');
const { load, applyTemplate, fixGroup } = require(path.join(dir, 'aws-shapes.cjs'));

const cat = load(dir);
const catalog = cat.catalog;
const corrections = cat.corrections;

const falhas = [];
const notes = [];
function verify(name, ok, detail) {
  if (ok) notes.push(`  ok    ${name}${detail ? ' — ' + detail : ''}`);
  else falhas.push(`  FALHA ${name}${detail ? ' — ' + detail : ''}`);
}

// ------------------------------------------------- 1. integridade do catálogo

verify('extração sem referência quebrada',
  catalog.meta.referenciasQuebradas.length === 0,
  `${catalog.meta.stencilsDeclarados} stencils declarados no aws4.xml`);

const semStencil = [...catalog.services, ...catalog.resources].filter(e => !e.stencil);
verify('toda entrada tem stencil', semStencil.length === 0,
  semStencil.length ? semStencil.map(e => e.title).join(', ') : `${catalog.services.length + catalog.resources.length} entradas`);

const hexRuim = Object.entries(catalog.categories)
  .filter(([, c]) => !/^#[0-9A-Fa-f]{6}$/.test(c.fill || ''));
verify('toda categoria tem cor hex válida', hexRuim.length === 0,
  hexRuim.length ? hexRuim.map(([k]) => k).join(', ') : `${Object.keys(catalog.categories).length} categorias`);

// ------------------------------------------------------- 2. os dois caminhos

// O modo de falha que o ticket nomeia: buscar só por resourceIcon faz o
// gerador concluir que S3 Tables, EventBridge Pipes/Scheduler e Trainium
// não existem, e cair no fallback sem necessidade.
const doisCaminhos = ['s3 tables', 's3 express one zone', 'eventbridge pipes',
                      'eventbridge scheduler', 'trainium', 'inferentia'];
for (const name of doisCaminhos) {
  const r = cat.service(name);
  verify(`caminho de resource icon: ${name}`,
    !!r && r.via.startsWith('recurso'),
    r ? `${r.title} -> ${r.stencil} (${r.via})` : 'não resolvido');
}

// ---------------------------------------------------------- 3. renomes/siglas

const stencilsConhecidos = new Set(
  [...catalog.services, ...catalog.resources].map(e => e.stencil));

for (const grupoTabela of ['renomes', 'sinonimos']) {
  const tabela = corrections[grupoTabela];
  const ruins = Object.entries(tabela)
    .filter(([k]) => !k.startsWith('_'))
    .filter(([, stencil]) => !stencilsConhecidos.has(stencil));
  verify(`tabela de ${grupoTabela} aponta só para stencil existente`,
    ruins.length === 0,
    ruins.length ? ruins.map(([k, v]) => `${k}->${v}`).join(', ')
                 : `${Object.keys(tabela).length - 1} entradas`);

  const naoResolve = Object.keys(tabela).filter(k => !k.startsWith('_'))
    .filter(k => !cat.service(k));
  verify(`toda chave de ${grupoTabela} resolve`, naoResolve.length === 0,
    naoResolve.join(', ') || 'todas');

  // Resolver != apontar. "sagemaker" apontava certo na tabela e resolvia
  // errado, porque o título obsoleto de OUTRO serviço casava antes.
  const desviou = Object.entries(tabela)
    .filter(([k]) => !k.startsWith('_'))
    .filter(([k, stencil]) => {
      const r = cat.service(k);
      return !r || r.stencil !== stencil;
    });
  verify(`toda chave de ${grupoTabela} resolve PARA O STENCIL DECLARADO`,
    desviou.length === 0,
    desviou.map(([k, v]) => `${k}: esperado ${v}, veio ${(cat.service(k) || {}).stencil}`).join('; ')
      || 'todas');
}

// ------------------------------------------------------------- 4. correções

const legados = Object.keys(corrections.paletaLegada).filter(k => !k.startsWith('_'));
let corrigidos = 0, semContainer = [], comLegado = [];

for (const g of catalog.groups) {
  const r = cat.group(g.title);
  if (!r) { falhas.push(`  FALHA grupo não resolve: ${g.title}`); continue; }
  if (!/(^|;)container=1(;|$)/.test(r.style)) semContainer.push(g.title);
  for (const l of legados) if (r.style.includes(l)) comLegado.push(`${g.title}:${l}`);
  if (r.corrections.length) corrigidos++;
}

verify('nenhum grupo sem container=1 depois da correção',
  semContainer.length === 0, semContainer.join(', ') || `${catalog.groups.length} grupos`);
verify('nenhuma cor da paleta pré-2022 sobrevive num grupo',
  comLegado.length === 0, comLegado.join(', ') || legados.join(' '));
verify('as correções de fato pegaram', corrigidos > 0, `${corrigidos} grupos corrigidos`);

// Os grupos que o upstream entrega sem container=1 (pesquisa §3.5).
const semContainerUpstream = catalog.groups
  .filter(g => !/container=1/.test(g.style)).map(g => g.title);
verify('os 4 retângulos puros do upstream foram identificados',
  semContainerUpstream.length === 4, semContainerUpstream.join(', '));

// ------------------------------------------------------- 4b. desambiguação

// Um título de service icon que aparece em duas paletas com cor (ou stencil)
// diferente é uma bomba-relógio: sem tabela, a escolha vira ordem de paleta.
const porTitulo = new Map();
for (const s of catalog.services) {
  const n = cat.normalize(s.title);
  if (!porTitulo.has(n)) porTitulo.set(n, []);
  porTitulo.get(n).push(s);
}
const corDe = e => e.fill || cat.corDaCategoria(e.palette);
const ambiguos = [...porTitulo.entries()]
  .filter(([, v]) => new Set(v.map(corDe)).size > 1 || new Set(v.map(e => e.stencil)).size > 1)
  .map(([k]) => k);

const semTabela = ambiguos.filter(k => !corrections.desambiguacao[k]);
verify('todo título ambíguo tem entrada de desambiguação',
  semTabela.length === 0, semTabela.join(', ') || `${ambiguos.length} títulos ambíguos cobertos`);

const desRuins = Object.entries(corrections.desambiguacao)
  .filter(([k]) => !k.startsWith('_'))
  .filter(([k, d]) => {
    const r = cat.service(k);
    return !r || r.stencil !== d.stencil || r.palette !== d.palette;
  });
verify('desambiguação de fato governa a resolução', desRuins.length === 0,
  desRuins.map(([k]) => k).join(', ') ||
  `${Object.keys(corrections.desambiguacao).length - 1} entradas`);

const arbitrarios = Object.entries(corrections.desambiguacao)
  .filter(([k, d]) => !k.startsWith('_') && d.review).map(([k]) => k);
notes.push(`  --    ${arbitrarios.length} desempates arbitrários abertos: ${arbitrarios.join(', ')}`);

// ------------------------------------------------- 5. round-trip (precisa repo)

const repo = process.argv[2];
if (repo && fs.existsSync(repo)) {
  const tmp = path.join(require('os').tmpdir(), `catalogo-roundtrip-${process.pid}.json`);
  execFileSync('node', [path.join(__dirname, 'extract-aws4-catalog.cjs'), repo, tmp],
    { stdio: ['ignore', 'ignore', 'ignore'] });
  const fresco = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  fs.unlinkSync(tmp);

  verify('reextração é determinística',
    JSON.stringify(fresco) === JSON.stringify(catalog),
    'mesmo commit -> mesmo JSON');

  // Reconstrói cada style a partir do template e compara com o upstream.
  let divergentes = 0, literais = 0, reconstruidos = 0;
  for (const [list, tplKey] of [[catalog.services, 'svc'], [catalog.resources, 'res']]) {
    for (const e of list) {
      if (e.style) { literais++; continue; }       // guardado verbatim, nada a reconstruir
      const fill = e.fill || cat.corDaCategoria(e.palette);
      const built = applyTemplate(catalog.templates[tplKey].style, { fill, stencil: e.stencil });
      const upstream = (tplKey === 'svc' ? fresco.services : fresco.resources)
        .find(x => x.stencil === e.stencil && x.title === e.title && x.palette === e.palette);
      const expected = upstream && upstream.style
        ? upstream.style
        : applyTemplate(fresco.templates[tplKey].style,
            { fill: upstream.fill || (fresco.categories[upstream.palette] || {}).fill, stencil: upstream.stencil });
      if (built !== expected) divergentes++; else reconstruidos++;
    }
  }
  verify('round-trip: style reconstruído == style do upstream',
    divergentes === 0,
    `${reconstruidos} reconstruídos, ${literais} literais, ${divergentes} divergentes`);

  // Todo stencil citado existe no aws4.xml.
  const xml = fs.readFileSync(path.join(repo, 'src/main/webapp/stencils/aws4.xml'), 'utf8');
  const declarados = new Set([...xml.matchAll(/<shape [^>]*name="([^"]*)"/g)]
    .map(m => m[1].replace(/ /g, '_').toLowerCase()));
  const citados = new Set([...stencilsConhecidos,
    ...catalog.groups.filter(g => g.grIcon).map(g => g.grIcon)]);
  const ausentes = [...citados].filter(s => !declarados.has(s));
  verify('todo stencil citado existe em aws4.xml', ausentes.length === 0,
    ausentes.join(', ') || `${citados.size} stencils`);
} else {
  notes.push('  --    round-trip pulado (passe o caminho do repo do draw.io para rodá-lo)');
}

// ----------------------------------------------------------------- resultado

console.log(`catálogo aws4 — draw.io ${catalog.meta.drawio && catalog.meta.drawio.version}, commit ${(catalog.meta.commit || '').slice(0, 8)}`);
console.log(notes.join('\n'));
if (falhas.length) {
  console.log(falhas.join('\n'));
  console.log(`\n${falhas.length} falha(s).`);
  process.exit(1);
}
console.log(`\ntodas as ${notes.filter(n => n.includes('ok ')).length} checagens passaram.`);
