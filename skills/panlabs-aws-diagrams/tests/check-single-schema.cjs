#!/usr/bin/env node
'use strict';
/**
 * UM contrato, UM arquivo — o critério de aceite que o #23 escreve como "um único
 * `schema.json`".
 *
 * O que ele estava nomeando: quatro arquivos chamados `schema.json` na árvore,
 * dois deles declarando o MESMO `$id` (`panlabs-aws-diagrams/model@1`) com
 * conteúdo divergente — o do #11, com `ou` e `habilita`, e o do #13, com
 * `qualificador`. Nesse estado o contrato do sistema depende de qual cópia o
 * `require` alcançou primeiro, que é a definição de não ter contrato.
 *
 * A consolidação não colapsa tudo num arquivo só, e vale dizer por quê: os
 * outros três `schema.json` da árvore declaram `$id` DIFERENTES — `theme@1` é o
 * vocabulário fechado do #13, `session@1` é o modelo de sessão do #14,
 * `elaboration@1` é o delta da fase técnica do #14, sem esquema até o #37. São
 * contratos distintos de camadas distintas. Juntá-los produziria um arquivo que
 * mistura públicos e não teria um dono.
 *
 * Então a regra que esta checagem trava é a mais forte que continua verdadeira:
 *
 *   1. cada `$id` aparece em EXATAMENTE UM arquivo da árvore de produção;
 *   2. o contrato do modelo (`model@1`) mora na RAIZ da skill, não dentro do
 *      motor — ele é o que o agente escreve, e o motor é só o primeiro leitor;
 *   3. quem carrega o esquema carrega ESSE arquivo (medido, não afirmado);
 *   4. o `model@1` é superconjunto dos dois que ele substituiu — nenhuma
 *      propriedade do #11 nem do #13 se perdeu na fusão;
 *   5. os QUATRO contratos existem, e nenhum é a exceção que só o exemplo do
 *      corpus descreve — o #37 fechou o `elaboration@1` que faltava.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let falhas = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) falhas++;
};

/** Os caminhos que um `require(modulo)` abre via `fs.readFileSync`, medidos de verdade. */
function leiturasDoRequire(modulo) {
  const lidos = [];
  const real = fs.readFileSync;
  fs.readFileSync = function (p, ...r) { lidos.push(String(p)); return real.call(fs, p, ...r); };
  try {
    delete require.cache[require.resolve(modulo)];
    require(modulo);
  } finally { fs.readFileSync = real; }
  return lidos;
}

/** Todo .json da árvore de produção que se declare um JSON Schema. */
function esquemas(dir, fora = new Set(['prototypes', 'node_modules', 'output'])) {
  const findings = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (fora.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { findings.push(...esquemas(p, fora)); continue; }
    if (!e.name.endsWith('.json')) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (err) { continue; }
    if (j && typeof j === 'object' && j.$schema && j.$id) findings.push({ p, id: j.$id, j });
  }
  return findings;
}

const findings = esquemas(ROOT);

console.log('\n1 · cada contrato num arquivo só\n');
const byId = new Map();
for (const a of findings) {
  if (!byId.has(a.id)) byId.set(a.id, []);
  byId.get(a.id).push(path.relative(ROOT, a.p));
}
for (const [id, arquivos] of [...byId].sort())
  ok(arquivos.length === 1, `${id}`, arquivos.join(' + '));
ok(byId.size === 4, `${byId.size} contratos distintos na árvore — os QUATRO do #37, nem mais nem menos`,
  [...byId.keys()].sort().join(' · '));

console.log('\n2 · o contrato do modelo mora na raiz da skill\n');
const doModelo = byId.get('panlabs-aws-diagrams/model@1') || [];
ok(doModelo.length === 1 && doModelo[0] === 'schema.json',
  'panlabs-aws-diagrams/model@1 está em schema.json, na raiz',
  doModelo.join(', ') || 'não encontrado');
ok(!fs.existsSync(path.join(ROOT, 'engine', 'schema.json')),
  'e NÃO existe mais um schema.json dentro do motor');

console.log('\n2b · o quarto contrato — elaboration@1 — mora ao lado de quem o consome\n');
const fromElaboration = byId.get('panlabs-aws-diagrams/elaboration@1') || [];
ok(fromElaboration.length === 1 && fromElaboration[0] === 'session/elaboration.schema.json',
  'panlabs-aws-diagrams/elaboration@1 está em session/elaboration.schema.json',
  fromElaboration.join(', ') || 'não encontrado');

console.log('\n3 · é esse arquivo que o motor carrega (medido)\n');
{
  const lidos = leiturasDoRequire(path.join(ROOT, 'engine', 'generate.cjs'));
  const target = path.join(ROOT, 'schema.json');
  ok(lidos.includes(target), 'engine/generate.cjs abriu <raiz>/schema.json',
    lidos.filter(p => p.endsWith('schema.json')).map(p => path.relative(ROOT, p)).join(', ') || 'none');
}

console.log('\n3b · e é esse arquivo que elaborate.cjs carrega para o delta (medido)\n');
{
  const lidos = leiturasDoRequire(path.join(ROOT, 'session', 'elaborate.cjs'));
  const target = path.join(ROOT, 'session', 'elaboration.schema.json');
  ok(lidos.includes(target), 'session/elaborate.cjs abriu session/elaboration.schema.json',
    lidos.filter(p => p.endsWith('.json')).map(p => path.relative(ROOT, p)).join(', ') || 'none');
}

console.log('\n4 · a fusão não perdeu propriedade dos dois esquemas que ela substituiu\n');
{
  const props = j => {
    const out = new Set();
    (function anda(n, caminho) {
      if (!n || typeof n !== 'object') return;
      if (n.properties) for (const k of Object.keys(n.properties)) {
        out.add(`${caminho}${k}`);
        anda(n.properties[k], `${caminho}${k}.`);
      }
      for (const k of ['items', 'then', 'else']) if (n[k]) anda(n[k], caminho);
      for (const k of ['allOf', 'anyOf', 'oneOf']) if (Array.isArray(n[k])) n[k].forEach(x => anda(x, caminho));
      if (n.definitions) for (const [k, v] of Object.entries(n.definitions)) anda(v, `${k}.`);
    })(j, '');
    return out;
  };
  const production = props(JSON.parse(fs.readFileSync(path.join(ROOT, 'schema.json'), 'utf8')));
  /**
   * ⚠️ LISTA CONGELADA, E ELA SUBSTITUIU UMA LEITURA DO GIT — #62.
   *
   * Até aqui esta seção reconstruía os dois esquemas antigos com `git show`
   * apontando para os protótipos, que moravam fora da árvore da skill. A versão
   * anterior deste arquivo já escrevia o que fazer no dia em que eles saíssem:
   * *"quem tirar substitui a comparação contra o git pela lista congelada de
   * propriedades — em vez de herdar um verde vazio"*. O #62 os apagou, e isto é
   * o cumprimento daquela instrução.
   *
   * As duas listas abaixo foram EXTRAÍDAS do git, não escritas à mão: o mesmo
   * `props()` desta seção rodou sobre o conteúdo original. O #62 registra os
   * dois endereços e o commit de onde reabri-los.
   *
   * A troca também tirou daqui a ÚNICA referência da skill a caminho acima da
   * própria raiz (`REPO`, e o `execFileSync` que a usava) — a direção que o #46
   * exige é essa: o que está fora pode apontar para dentro, o que está dentro
   * não aponta para fora.
   */
  const FROZEN = {
    '#11': [
      'edge.data', 'edge.from', 'edge.id', 'edge.order', 'edge.to',
      'edge.protocol', 'edge.label', 'edges', 'dossier', 'schema',
      'band.id', 'band.members', 'band.label', 'band.kind', 'bands',
      'genre', 'id', 'node.access', 'node.az', 'node.layer', 'node.cidr', 'node.account',
      'node.inside', 'node.enables', 'node.id', 'node.note', 'node.ou', 'node.label',
      'node.service', 'node.kind', 'nodes', 'note.id', 'note.origin', 'note.about',
      'note.text', 'notes', 'subtitle', 'title', 'view',
    ],
    '#13': [
      'edge.data', 'edge.from', 'edge.id', 'edge.order', 'edge.to',
      'edge.protocol', 'edge.label', 'edges', 'dossier', 'schema',
      'band.id', 'band.members', 'band.label', 'band.kind', 'bands',
      'genre', 'id', 'node.access', 'node.az', 'node.cidr', 'node.account', 'node.inside',
      'node.id', 'node.note', 'node.qualifier', 'node.label', 'node.service',
      'node.kind', 'nodes', 'note.id', 'note.origin', 'note.about', 'note.text',
      'notes', 'subtitle', 'title', 'view',
    ],
  };
  /**
   * ⚠️ O PISO EXISTE PORQUE UMA LISTA CONGELADA PODE SER ESVAZIADA.
   *
   * A leitura do git tinha um modo de falha óbvio — o arquivo sumir — e a versão
   * anterior o tratava como FALHA justamente para não herdar um verde vazio. Uma
   * lista literal tem o modo de falha inverso e mais silencioso: alguém apaga
   * uma linha para "consertar" a checagem e ela continua verde, afirmando que
   * nada se perdeu depois de conferir menos. O piso é a contagem medida no dia
   * da extração; encolher a lista passa a ser vermelho.
   */
  const FLOOR = { '#11': 39, '#13': 37 };
  for (const [rot, antigas] of Object.entries(FROZEN)) {
    ok(antigas.length >= FLOOR[rot], `a lista congelada do ${rot} não encolheu`,
      `${antigas.length} de ${FLOOR[rot]} propriedades`);
    const perdidas = antigas.filter(p => !production.has(p));
    ok(perdidas.length === 0, `nenhuma propriedade do esquema do ${rot} se perdeu`,
      perdidas.length ? perdidas.join(', ') : `${antigas.length} propriedades conferidas`);
  }
  for (const nova of ['node.qualifier', 'node.ou', 'node.enables', 'node.layer'])
    ok(production.has(nova), `e o esquema único traz "${nova}"`);
}

console.log(falhas
  ? '\n  ✗ o contrato ainda mora em mais de um lugar.\n'
  : '\n  ✓ um contrato, um arquivo — e o motor lê o da raiz.\n');
process.exit(falhas ? 1 : 0);
