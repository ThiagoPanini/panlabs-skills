'use strict';
/**
 * Validacao do modelo de sessao.
 *
 * Nao repete o validador do #11 — checa o que SO a camada de sessao sabe: se os
 * casacos fecham, se o dossie e coerente, se o acordo aponta para algo que
 * existe. O que e do desenho (subnet fora de VPC, aresta terminando em
 * container, servico na vista logica) continua sendo do motor, e chega la pela
 * projecao com as mensagens que o #11 ja escreveu. Duas camadas, cada uma
 * cobrando o que enxerga.
 *
 * A regra que carrega o ticket:
 *
 *   > No que existe nas duas camadas TEM de ter os dois casacos.
 *
 * Sem ela, esquecer o casaco logico de uma capacidade aprovada nao da erro
 * nenhum — a capacidade simplesmente some da projecao logica, e a vista que o
 * usuario aprovou passa a mostrar menos do que ele aprovou. Silenciosamente.
 * Essa e a falha que o #14 existe para impedir, e ela e barata de fechar.
 */

const fs = require('fs');
const path = require('path');

const MOTOR_DIR = path.join(__dirname, '..', 'engine');
const { contraEsquema } = require(path.join(MOTOR_DIR, 'validate.cjs'));

const ESQUEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));

const CONTEINERES_TECNICOS = new Set(['cloud', 'account', 'region', 'vpc', 'subnet', 'security-group', 'group']);
const CONTEINERES_LOGICOS = new Set(['group']);

function referencias(m) {
  const erros = [];
  const porId = new Map();
  for (const n of m.nodes) {
    if (porId.has(n.id)) erros.push(`no "${n.id}" declarado duas vezes`);
    porId.set(n.id, n);
  }
  for (const n of m.nodes) {
    if (n.inside === undefined) continue;
    if (!porId.has(n.inside)) erros.push(`no "${n.id}": dentro="${n.inside}" nao existe`);
    if (n.inside === n.id) erros.push(`no "${n.id}": contido em si mesmo`);
  }
  // ciclo de contencao — a lista e plana (#11), entao o ciclo e possivel
  for (const n of m.nodes) {
    const visto = new Set([n.id]);
    let c = n.inside;
    while (c !== undefined && porId.has(c)) {
      if (visto.has(c)) { erros.push(`ciclo de contencao passando por "${n.id}"`); break; }
      visto.add(c); c = porId.get(c).inside;
    }
  }
  for (const [i, a] of (m.edges || []).entries())
    for (const p of ['from', 'to'])
      if (!porId.has(a[p])) erros.push(`aresta[${i}]: ${p}="${a[p]}" nao existe`);
  for (const f of (m.bands || []))
    for (const id of f.members) if (!porId.has(id)) erros.push(`faixa "${f.id}": membro "${id}" nao existe`);
  for (const [i, nt] of (m.notes || []).entries())
    if (nt.about !== undefined && !porId.has(nt.about)) erros.push(`nota[${i}]: sobre="${nt.about}" nao existe`);
  return { erros, porId };
}

function facets(m, porId) {
  const erros = [], avisos = [];
  const camadaDe = el => el.layer || 'both';

  const temFilho = new Set();
  for (const n of m.nodes) if (n.inside !== undefined) temFilho.add(n.inside);

  for (const n of m.nodes) {
    const layer = camadaDe(n);

    if (m.stage === 'logical') {
      if (layer === 'technical')
        erros.push(`no "${n.id}": camada "tecnica" num modelo no estagio logico. ` +
          `Infraestrutura sem capacidade so aparece quando a fase tecnica comeca — antes disso ela nao foi decidida.`);
      if (!n.logical)
        erros.push(`no "${n.id}": sem casaco "logico" num modelo no estagio logico.`);
      if (n.technical)
        erros.push(`no "${n.id}": casaco "tecnico" num modelo no estagio logico. ` +
          `Nome de servico dito cedo demais vai para dossie.estacionamento (#15 §5), nao para o modelo — ` +
          `se entrar aqui, contamina a vista logica e quebra A1.10 (um nivel de abstracao).`);
    } else {
      if (!n.technical)
        erros.push(`no "${n.id}": sem casaco "tecnico" num modelo no estagio tecnico.`);
      if (layer === 'both' && !n.logical)
        erros.push(`no "${n.id}": camada "ambas" e sem casaco "logico". ` +
          `Ou ele existe na vista logica e precisa do casaco, ou e infraestrutura e precisa de camada:"tecnica". ` +
          `Deixar assim faria a capacidade sumir da projecao logica sem erro nenhum.`);
      if (layer === 'technical' && n.logical)
        erros.push(`no "${n.id}": camada "tecnica" mas tem casaco "logico" — o que ele afirma se contradiz.`);
    }

    // Um no que contem coisa tem de ser container NAS DUAS vistas. Um casaco
    // folha sobre um no com filhos produziria um model@1 em que a folha e pai
    // de alguem — e o motor desenharia o filho dentro de um icone.
    if (temFilho.has(n.id)) {
      if (n.technical && !CONTEINERES_TECNICOS.has(n.technical.kind))
        erros.push(`no "${n.id}": contem outros nos, mas o casaco tecnico e "${n.technical.kind}", que e folha.`);
      if (n.logical && !CONTEINERES_LOGICOS.has(n.logical.kind)) {
        // So vale se algum descendente sobrevive na vista logica — senao o
        // colapso passa por cima dele e ninguem fica dentro de nada.
        const descendentesLogicos = m.nodes.some(o => {
          if (camadaDe(o) === 'technical' || o.id === n.id) return false;
          let c = o.inside;
          while (c !== undefined && porId.has(c)) { if (c === n.id) return true; c = porId.get(c).inside; }
          return false;
        });
        if (descendentesLogicos)
          erros.push(`no "${n.id}": contem capacidades, mas o casaco logico e "${n.logical.kind}". ` +
            `Fronteira de responsabilidade e tipo "grupo" (#15 §6).`);
      }
    }
  }

  for (const [i, a] of (m.edges || []).entries()) {
    if (m.stage === 'logical' && camadaDe(a) === 'technical')
      erros.push(`aresta[${i}]: camada "tecnica" num modelo no estagio logico.`);
    if (camadaDe(a) === 'both') {
      const pontas = [a.from, a.to].map(id => porId.get(id)).filter(Boolean);
      for (const p of pontas)
        if (camadaDe(p) === 'technical' && !avisos.some(x => x.includes(`"${p.id}"`)))
          avisos.push(`aresta[${i}]: passa por "${p.id}", que so existe na vista tecnica — ` +
            `na projecao logica ela sera CONTRAIDA atraves dele.`);
    }
  }

  // ------------------------------------------------- contracao ambigua
  //
  // Um no que so a camada tecnica tem e atravessado pela projecao logica: a
  // aresta `a -> [hub] -> b` vira `a -> b`. Enquanto o hub tem uma entrada OU
  // uma saida, o pareamento e unico e a leitura e obvia. Com DUAS entradas e
  // DUAS saidas, ele nao e mais um salto — e um cruzamento, e a contracao
  // produziria as 4 combinacoes, quando so 2 foram afirmadas.
  //
  // Isso e o desenho mentindo, que e a falha que este mapa inteiro persegue.
  // O conserto e do autor do modelo, e e barato: as arestas que nao carregam
  // leitura logica levam `camada: "tecnica"` e somem da projecao.
  for (const n of m.nodes) {
    if (camadaDe(n) !== 'technical') continue;
    const entram = (m.edges || []).filter(a => a.to === n.id && camadaDe(a) === 'both');
    const saem = (m.edges || []).filter(a => a.from === n.id && camadaDe(a) === 'both');
    if (entram.length > 1 && saem.length > 1)
      erros.push(`no "${n.id}": so existe na vista tecnica e tem ${entram.length} entradas e ${saem.length} saidas ` +
        `que atravessam para a vista logica. A contracao emitiria ${entram.length * saem.length} arestas logicas, ` +
        `e so ${entram.length + saem.length} foram afirmadas — o desenho passaria a dizer que ` +
        `"${entram[0].from}" fala com "${saem[1].to}" sem que ninguem tenha dito isso. ` +
        `Marque com camada:"tecnica" as arestas que nao carregam leitura logica.`);
  }

  return { erros, avisos };
}

function dossier(m) {
  const erros = [], avisos = [];
  const d = m.dossier;
  if (!d) { avisos.push('sem dossie — a sessao seguinte retoma o desenho, mas nao a conversa.'); return { erros, avisos }; }

  const cands = d.candidates || [];
  if (cands.length) {
    const escolhidas = cands.filter(c => c.state === 'chosen');
    if (escolhidas.length !== 1)
      erros.push(`dossie.candidatas: ${escolhidas.length} escolhida(s) — tem de ser exatamente uma.`);
    if (cands.length < 2)
      avisos.push('dossie.candidatas: uma so. O #15 poe piso 2 — se o espaco real tinha uma, o dossie devia dizer por que.');
    if (cands.length > 3)
      avisos.push(`dossie.candidatas: ${cands.length}. O #15 poe teto 3.`);
    // O invariante de distincao do #15 §3, virado checagem: tuplas iguais
    // colapsam, e duas candidatas com a mesma tupla sao a mesma arquitetura com
    // dois nomes — que e exatamente o "tres variacoes da mesma coisa" que o
    // protocolo existe para impedir.
    for (let i = 0; i < cands.length; i++)
      for (let j = i + 1; j < cands.length; j++)
        if (JSON.stringify(cands[i].tuple) === JSON.stringify(cands[j].tuple))
          erros.push(`dossie.candidatas: "${cands[i].name}" e "${cands[j].name}" tem a MESMA tupla E1-E5 — ` +
            `nao sao candidatas distintas, sao a mesma arquitetura com dois nomes.`);
  }

  const ids = new Set(m.nodes.map(n => n.id));
  for (const a of (d.findings || []))
    if (a.target !== undefined && !ids.has(a.target)) erros.push(`dossie.achados: alvo "${a.target}" nao existe entre os nos.`);
  for (const e of (d.parking || []))
    if (e.capability !== undefined && !ids.has(e.capability))
      erros.push(`dossie.estacionamento: capacidade "${e.capability}" nao existe entre os nos.`);

  // Achado recusado que nao virou nota e a falha que o #15 §4 nomeia: sem diff
  // contra IaC, achado ignorado vira diagrama que engana em silencio.
  for (const a of (d.findings || []).filter(x => x.state === 'rejected')) {
    if (!a.viaNote) {
      erros.push(`dossie.achados: "${a.rule}" foi RECUSADO e nao aponta \`viaNota\`. ` +
        `A recusa tem de virar marca no diagrama (#15 §4), senao o desenho engana calado.`);
      continue;
    }
    const note = (m.notes || []).find(n => n.id === a.viaNote);
    if (!note) erros.push(`dossie.achados: "${a.rule}" aponta viaNota="${a.viaNote}", que nao existe em notas.`);
    else if (note.origin !== 'rejected-finding')
      erros.push(`dossie.achados: "${a.rule}" aponta a nota "${a.viaNote}", que tem origem "${note.origin}" e nao "achado-recusado".`);
    else if ((note.layer || 'both') !== 'both')
      erros.push(`dossie.achados: a nota "${a.viaNote}" so aparece na vista tecnica — a recusa some da vista logica, que e a que foi aprovada.`);
  }

  if (d.agreement && d.agreement.candidate && !cands.some(c => c.id === d.agreement.candidate))
    erros.push(`dossie.acordo: candidata "${d.agreement.candidate}" nao esta em dossie.candidatas.`);

  if (m.stage === 'technical' && !d.agreement)
    erros.push('estagio "tecnica" sem dossie.acordo. A premissa 2 poe a aprovacao da vista logica ' +
      'ENTRE as duas fases — elaborar tecnicamente sem ela e pular o coracao do produto.');

  return { erros, avisos };
}

function validar(modelo) {
  const deForma = contraEsquema(modelo, ESQUEMA, ESQUEMA);
  if (deForma.length) return { ok: false, fase: 'schema', erros: deForma, avisos: [] };

  const { erros: deRef, porId } = referencias(modelo);
  if (deRef.length) return { ok: false, fase: 'referencias', erros: deRef, avisos: [] };

  const c = facets(modelo, porId);
  const d = dossier(modelo);
  const erros = [...c.erros, ...d.erros];
  const avisos = [...c.avisos, ...d.avisos];
  if (erros.length) return { ok: false, fase: 'sessao', erros, avisos };
  return { ok: true, fase: null, erros: [], avisos, porId };
}

module.exports = { validar, ESQUEMA };
