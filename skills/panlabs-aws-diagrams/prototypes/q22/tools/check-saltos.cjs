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
 * O corpus é o de rede dos três protótipos — q11, q12 e q22 —, não só os
 * modelos escritos para esta pergunta. Medir a candidata só nos exemplos que eu
 * desenhei para a candidata vencedora seria fazer a régua concordar comigo.
 */

const fs = require('fs');
const path = require('path');

const Q22 = path.join(__dirname, '..');
const Q11 = path.join(Q22, '..', 'q11');
const Q12 = path.join(Q22, '..', 'q12');
const { derivar } = require(path.join(Q11, 'motor', 'derivar.cjs'));
const camadas = require(path.join(Q11, 'motor', 'camadas.cjs'));
const resolverMod = require(path.join(Q11, 'motor', 'resolver.cjs'));

const cat = resolverMod.criar().cat;

const corpus = [];
for (const [rotulo, dir] of [['q11', path.join(Q11, 'modelo')], ['q12', path.join(Q12, 'modelo')],
  ['q22', path.join(Q22, 'modelo')], ['q22', path.join(Q22, 'recusa')]])
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort())
    corpus.push({ grupo: rotulo, nome: f.replace(/\.json$/, ''), modelo: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) });

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
    return n.tipo === 'subnet' ? n : d.t.ancestrais(n).find(a => a.tipo === 'subnet') || null;
  };
  const emVpc = n => d.t.ancestrais(n).some(a => a.tipo === 'vpc');

  const fontes = modelo.nos.filter(n => ['servico', 'bloco', 'ator'].includes(n.tipo))
    .filter(n => !emVpc(n) || (subnetDe(n.id) || {}).acesso === 'publica')
    .map(n => n.id);
  if (!fontes.length) return { ok: false, porque: 'nenhum nó exposto de onde contar', dist: new Map() };

  const viz = new Map(modelo.nos.map(n => [n.id, []]));
  for (const a of modelo.arestas || []) {
    if (!viz.has(a.de) || !viz.has(a.para)) continue;
    viz.get(a.de).push(a.para);
    viz.get(a.para).push(a.de);
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
  return { ok: porPapel.size > 0, porque: porPapel.size ? null : 'nenhuma subnet alcançada por aresta', dist: porPapel };
}

let alcanca = 0, mudo = 0, concorda = 0, discorda = 0;
// Contagem à parte para o corpus HERDADO (q11 + q12). Os modelos do q22 foram
// escritos para esta pergunta, então medir a candidata rival só neles seria
// fazer a régua concordar comigo — a linha que importa é a de baixo.
let herdadoFala = 0, herdadoMudo = 0, herdadoDiscorda = 0;
const detalhes = [];

for (const { grupo, nome, modelo } of corpus) {
  const d = derivar(modelo, { cat });
  const papeis = [...camadas.papeisDeSubnet(modelo, d.t, d.camadas).values()];
  const privados = papeis.filter(p => p.acesso === 'privada');
  if (privados.length < 2) { detalhes.push([grupo, nome, '—', 'menos de 2 papéis privados: a pergunta não se põe']); continue; }

  const s = distanciaDaBorda(modelo, d);
  const cobertos = privados.filter(p => s.dist.has(p.chave));
  if (!s.ok || cobertos.length < 2) {
    mudo++;
    if (grupo !== 'q22') herdadoMudo++;
    detalhes.push([grupo, nome, 'MUDA', s.porque || `só ${cobertos.length} de ${privados.length} papéis alcançados por aresta`]);
    continue;
  }
  alcanca++;
  if (grupo !== 'q22') herdadoFala++;

  const porSalto = [...cobertos].sort((a, b) => s.dist.get(a.chave) - s.dist.get(b.chave) || a.rotulo.localeCompare(b.rotulo, 'pt'));
  const porCamada = [...cobertos].sort((a, b) =>
    camadas.ordemDeCamada(a.camada) - camadas.ordemDeCamada(b.camada) || a.rotulo.localeCompare(b.rotulo, 'pt'));
  const igual = JSON.stringify(porSalto.map(p => p.rotulo)) === JSON.stringify(porCamada.map(p => p.rotulo));
  if (igual) concorda++; else discorda++;
  if (!igual && grupo !== 'q22') herdadoDiscorda++;
  detalhes.push([grupo, nome, igual ? 'CONCORDA' : 'DISCORDA',
    `saltos → ${porSalto.map(p => `${p.rotulo}(${s.dist.get(p.chave)})`).join(' · ')}`]);
}

console.log('\n  distância da borda vs. camada do conteúdo — todo o corpus de rede dos protótipos\n');
for (const [g, n, v, det] of detalhes)
  console.log(`  ${g}  ${n.padEnd(24)} ${String(v).padEnd(9)} ${det}`);

console.log(`\n  modelos em que a distância consegue ordenar: ${alcanca}`);
console.log(`  modelos em que ela fica muda:               ${mudo}`);
console.log(`  onde ela fala, concorda com o conteúdo:     ${concorda}`);
console.log(`  onde ela fala, DISCORDA do conteúdo:        ${discorda}`);
console.log(`  só no corpus HERDADO (q11+q12, escrito antes desta pergunta): ` +
  `fala em ${herdadoFala}, muda em ${herdadoMudo}, discorda em ${herdadoDiscorda}`);

console.log(discorda
  ? '\n  ⚠ há discordância — a candidata dos saltos carrega informação que o conteúdo não tem. Reabrir.'
  : '\n  ✓ onde a distância fala, ela repete o que o conteúdo já dizia; onde o conteúdo fala sozinho, ' +
    'ela está muda. Ela não é uma segunda fonte — é a mesma resposta por um caminho que depende de aresta.');
process.exit(0);
