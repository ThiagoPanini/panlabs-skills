#!/usr/bin/env node
'use strict';
/**
 * A terceira candidata do ticket, medida em vez de descartada por argumento.
 *
 *   > "Ou ordenar por distância da borda, contando saltos até o nó mais
 *   >  exposto — funciona quando há arestas, e cai para o quê quando não há?"
 *
 * A pergunta tem duas metades, e as duas se respondem contando:
 *
 *   1. QUANTO do corpus ela alcança — em quantos modelos existe aresta
 *      suficiente para a distância significar alguma coisa;
 *   2. ONDE ela alcança, se DISCORDA da regra de conteúdo. Se concordar, ela
 *      não acrescenta informação: é a mesma ordem por um caminho mais frágil.
 *
 * O corpus é o de rede INTEIRO da skill, não só os modelos escritos para esta
 * pergunta — e a contagem separa os dois grupos, porque medir a candidata só nos
 * exemplos desenhados para a vencedora seria fazer a régua concordar comigo. A
 * separação, que era de diretório enquanto o corpus morava nos protótipos, virou
 * a lista `DO_22` abaixo. É a mesma linha, escrita.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');


const { derivar } = require(path.join(RAIZ, 'engine', 'derive.cjs'));
const camadas = require(path.join(RAIZ, 'engine', 'layers.cjs'));
const resolverMod = require(path.join(RAIZ, 'engine', 'resolve.cjs'));

const cat = resolverMod.criar(require(path.join(RAIZ, 'theme', 'theme.cjs')).carregar('light')).cat;

/**
 * Os modelos que o #22 escreveu PARA esta pergunta. O resto do corpus veio de
 * outros tickets, antes dela — e é essa a linha que a medição precisa separar:
 * rodar a candidata rival só nos modelos feitos sob medida para a vencedora
 * seria fazer a régua concordar comigo.
 *
 * Na árvore de produção o corpus mora todo em `models/`, então a separação que
 * antes era de DIRETÓRIO passa a ser esta lista. É a mesma linha, escrita.
 */
const DO_22 = new Set(['app-data', 'elk-no-layer', 'ingest-core', 'declared-empty-subnet',
  'three-mixed-layers', 'web-data-with-flow', 'web-data', 'empty-subnet']);

const corpus = [];
for (const dir of [path.join(RAIZ, 'models'), path.join(RAIZ, 'models', 'refusal')])
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort()) {
    const name = f.replace(/\.json$/, '');
    corpus.push({ group: DO_22.has(name) ? 'q22' : 'herdado', name,
      modelo: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) });
  }

/**
 * Distância em saltos, no grafo NÃO dirigido das arestas do modelo, do papel de
 * subnet até a coisa mais exposta que existir.
 *
 * "Mais exposto" na ordem que o próprio IR oferece: um nó fora de qualquer VPC
 * (ator, serviço regional), senão uma folha de subnet pública. Sem nenhum dos
 * dois não há de onde contar, e a candidata não tem resposta — que já é meia
 * resposta à pergunta do ticket.
 */
function distanciaDaBorda(modelo, d) {
  const subnetDe = id => {
    const n = d.t.porId.get(id);
    if (!n) return null;
    return n.kind === 'subnet' ? n : d.t.ancestrais(n).find(a => a.kind === 'subnet') || null;
  };
  const emVpc = n => d.t.ancestrais(n).some(a => a.kind === 'vpc');

  const fontes = modelo.nodes.filter(n => ['service', 'block', 'actor'].includes(n.kind))
    .filter(n => !emVpc(n) || (subnetDe(n.id) || {}).access === 'public')
    .map(n => n.id);
  if (!fontes.length) return { ok: false, because: 'nenhum nó exposto de onde contar', dist: new Map() };

  const viz = new Map(modelo.nodes.map(n => [n.id, []]));
  for (const a of modelo.edges || []) {
    if (!viz.has(a.from) || !viz.has(a.to)) continue;
    viz.get(a.from).push(a.to);
    viz.get(a.to).push(a.from);
  }

  const dist = new Map(fontes.map(f => [f, 0]));
  const fila = [...fontes];
  while (fila.length) {
    const id = fila.shift();
    for (const v of viz.get(id) || []) if (!dist.has(v)) { dist.set(v, dist.get(id) + 1); fila.push(v); }
  }

  // a distância de um PAPEL é a menor entre as folhas que ele guarda
  const porPapel = new Map();
  for (const [id, dd] of dist) {
    const s = subnetDe(id);
    if (!s) continue;
    const chave = camadas.chaveDePapel(s, d.t);
    porPapel.set(chave, Math.min(porPapel.get(chave) ?? Infinity, dd));
  }
  return { ok: porPapel.size > 0, because: porPapel.size ? null : 'nenhuma subnet alcançada por aresta', dist: porPapel };
}

let alcanca = 0, mudo = 0, concorda = 0, discorda = 0;
// Contagem à parte para o corpus HERDADO (q11 + q12). Os modelos do q22 foram
// escritos para esta pergunta, então medir a candidata rival só neles seria
// fazer a régua concordar comigo — a linha que importa é a de baixo.
let herdadoFala = 0, herdadoMudo = 0, herdadoDiscorda = 0;
const detalhes = [];

for (const { group, name, modelo } of corpus) {
  const d = derivar(modelo, { cat });
  const papeis = [...camadas.papeisDeSubnet(modelo, d.t, d.camadas).values()];
  const privados = papeis.filter(p => p.access === 'private');
  if (privados.length < 2) { detalhes.push([group, name, '—', 'menos de 2 papéis privados: a pergunta não se põe']); continue; }

  const s = distanciaDaBorda(modelo, d);
  const cobertos = privados.filter(p => s.dist.has(p.chave));
  if (!s.ok || cobertos.length < 2) {
    mudo++;
    if (group !== 'q22') herdadoMudo++;
    detalhes.push([group, name, 'MUDA', s.because || `só ${cobertos.length} de ${privados.length} papéis alcançados por aresta`]);
    continue;
  }
  alcanca++;
  if (group !== 'q22') herdadoFala++;

  const porSalto = [...cobertos].sort((a, b) => s.dist.get(a.chave) - s.dist.get(b.chave) || a.label.localeCompare(b.label, 'pt'));
  const porCamada = [...cobertos].sort((a, b) =>
    camadas.ordemDeCamada(a.layer) - camadas.ordemDeCamada(b.layer) || a.label.localeCompare(b.label, 'pt'));
  const igual = JSON.stringify(porSalto.map(p => p.label)) === JSON.stringify(porCamada.map(p => p.label));
  if (igual) concorda++; else discorda++;
  if (!igual && group !== 'q22') herdadoDiscorda++;
  detalhes.push([group, name, igual ? 'CONCORDA' : 'DISCORDA',
    `saltos → ${porSalto.map(p => `${p.label}(${s.dist.get(p.chave)})`).join(' · ')}`]);
}

console.log('\n  distância da borda vs. camada do conteúdo — todo o corpus de rede da skill\n');
for (const [g, n, v, det] of detalhes)
  console.log(`  ${g}  ${n.padEnd(24)} ${String(v).padEnd(9)} ${det}`);

console.log(`\n  modelos em que a distância consegue ordenar: ${alcanca}`);
console.log(`  modelos em que ela fica muda:               ${mudo}`);
console.log(`  onde ela fala, concorda com o conteúdo:     ${concorda}`);
console.log(`  onde ela fala, DISCORDA do conteúdo:        ${discorda}`);
console.log(`  só no corpus HERDADO (escrito antes desta pergunta): ` +
  `fala em ${herdadoFala}, muda em ${herdadoMudo}, discorda em ${herdadoDiscorda}`);

/**
 * Isto é PORTÃO, não relatório — e por isso sai 1 quando discorda.
 *
 * A conclusão do #22 sobre a candidata rival é "ela não carrega informação que
 * o conteúdo não tenha". Uma discordância derruba essa conclusão, e uma régua
 * que imprime "reabrir" e sai 0 deixa a suite verde em cima de uma decisão que
 * acabou de perder o argumento.
 */
console.log(discorda
  ? '\n  ✗ há discordância — a candidata dos saltos carrega informação que o conteúdo não tem. Reabrir a decisão do #22.'
  : '\n  ✓ onde a distância fala, ela repete o que o conteúdo já dizia; onde o conteúdo fala sozinho, ' +
    'ela está muda. Ela não é uma segunda fonte — é a mesma resposta por um caminho que depende de aresta.');
process.exit(discorda ? 1 : 0);
