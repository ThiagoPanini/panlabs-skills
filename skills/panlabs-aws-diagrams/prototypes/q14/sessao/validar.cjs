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

const Q11 = path.join(__dirname, '..', '..', 'q11', 'motor');
const { contraEsquema } = require(path.join(Q11, 'validar.cjs'));

const ESQUEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'esquema.json'), 'utf8'));

const CONTEINERES_TECNICOS = new Set(['nuvem', 'conta', 'regiao', 'vpc', 'subnet', 'grupo-seguranca', 'grupo']);
const CONTEINERES_LOGICOS = new Set(['grupo']);

function referencias(m) {
  const erros = [];
  const porId = new Map();
  for (const n of m.nos) {
    if (porId.has(n.id)) erros.push(`no "${n.id}" declarado duas vezes`);
    porId.set(n.id, n);
  }
  for (const n of m.nos) {
    if (n.dentro === undefined) continue;
    if (!porId.has(n.dentro)) erros.push(`no "${n.id}": dentro="${n.dentro}" nao existe`);
    if (n.dentro === n.id) erros.push(`no "${n.id}": contido em si mesmo`);
  }
  // ciclo de contencao — a lista e plana (#11), entao o ciclo e possivel
  for (const n of m.nos) {
    const visto = new Set([n.id]);
    let c = n.dentro;
    while (c !== undefined && porId.has(c)) {
      if (visto.has(c)) { erros.push(`ciclo de contencao passando por "${n.id}"`); break; }
      visto.add(c); c = porId.get(c).dentro;
    }
  }
  for (const [i, a] of (m.arestas || []).entries())
    for (const p of ['de', 'para'])
      if (!porId.has(a[p])) erros.push(`aresta[${i}]: ${p}="${a[p]}" nao existe`);
  for (const f of (m.faixas || []))
    for (const id of f.membros) if (!porId.has(id)) erros.push(`faixa "${f.id}": membro "${id}" nao existe`);
  for (const [i, nt] of (m.notas || []).entries())
    if (nt.sobre !== undefined && !porId.has(nt.sobre)) erros.push(`nota[${i}]: sobre="${nt.sobre}" nao existe`);
  return { erros, porId };
}

function casacos(m, porId) {
  const erros = [], avisos = [];
  const camadaDe = el => el.camada || 'ambas';

  const temFilho = new Set();
  for (const n of m.nos) if (n.dentro !== undefined) temFilho.add(n.dentro);

  for (const n of m.nos) {
    const camada = camadaDe(n);

    if (m.estagio === 'logica') {
      if (camada === 'tecnica')
        erros.push(`no "${n.id}": camada "tecnica" num modelo no estagio logico. ` +
          `Infraestrutura sem capacidade so aparece quando a fase tecnica comeca — antes disso ela nao foi decidida.`);
      if (!n.logico)
        erros.push(`no "${n.id}": sem casaco "logico" num modelo no estagio logico.`);
      if (n.tecnico)
        erros.push(`no "${n.id}": casaco "tecnico" num modelo no estagio logico. ` +
          `Nome de servico dito cedo demais vai para dossie.estacionamento (#15 §5), nao para o modelo — ` +
          `se entrar aqui, contamina a vista logica e quebra A1.10 (um nivel de abstracao).`);
    } else {
      if (!n.tecnico)
        erros.push(`no "${n.id}": sem casaco "tecnico" num modelo no estagio tecnico.`);
      if (camada === 'ambas' && !n.logico)
        erros.push(`no "${n.id}": camada "ambas" e sem casaco "logico". ` +
          `Ou ele existe na vista logica e precisa do casaco, ou e infraestrutura e precisa de camada:"tecnica". ` +
          `Deixar assim faria a capacidade sumir da projecao logica sem erro nenhum.`);
      if (camada === 'tecnica' && n.logico)
        erros.push(`no "${n.id}": camada "tecnica" mas tem casaco "logico" — o que ele afirma se contradiz.`);
    }

    // Um no que contem coisa tem de ser container NAS DUAS vistas. Um casaco
    // folha sobre um no com filhos produziria um modelo@1 em que a folha e pai
    // de alguem — e o motor desenharia o filho dentro de um icone.
    if (temFilho.has(n.id)) {
      if (n.tecnico && !CONTEINERES_TECNICOS.has(n.tecnico.tipo))
        erros.push(`no "${n.id}": contem outros nos, mas o casaco tecnico e "${n.tecnico.tipo}", que e folha.`);
      if (n.logico && !CONTEINERES_LOGICOS.has(n.logico.tipo)) {
        // So vale se algum descendente sobrevive na vista logica — senao o
        // colapso passa por cima dele e ninguem fica dentro de nada.
        const descendentesLogicos = m.nos.some(o => {
          if (camadaDe(o) === 'tecnica' || o.id === n.id) return false;
          let c = o.dentro;
          while (c !== undefined && porId.has(c)) { if (c === n.id) return true; c = porId.get(c).dentro; }
          return false;
        });
        if (descendentesLogicos)
          erros.push(`no "${n.id}": contem capacidades, mas o casaco logico e "${n.logico.tipo}". ` +
            `Fronteira de responsabilidade e tipo "grupo" (#15 §6).`);
      }
    }
  }

  for (const [i, a] of (m.arestas || []).entries()) {
    if (m.estagio === 'logica' && camadaDe(a) === 'tecnica')
      erros.push(`aresta[${i}]: camada "tecnica" num modelo no estagio logico.`);
    if (camadaDe(a) === 'ambas') {
      const pontas = [a.de, a.para].map(id => porId.get(id)).filter(Boolean);
      for (const p of pontas)
        if (camadaDe(p) === 'tecnica' && !avisos.some(x => x.includes(`"${p.id}"`)))
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
  for (const n of m.nos) {
    if (camadaDe(n) !== 'tecnica') continue;
    const entram = (m.arestas || []).filter(a => a.para === n.id && camadaDe(a) === 'ambas');
    const saem = (m.arestas || []).filter(a => a.de === n.id && camadaDe(a) === 'ambas');
    if (entram.length > 1 && saem.length > 1)
      erros.push(`no "${n.id}": so existe na vista tecnica e tem ${entram.length} entradas e ${saem.length} saidas ` +
        `que atravessam para a vista logica. A contracao emitiria ${entram.length * saem.length} arestas logicas, ` +
        `e so ${entram.length + saem.length} foram afirmadas — o desenho passaria a dizer que ` +
        `"${entram[0].de}" fala com "${saem[1].para}" sem que ninguem tenha dito isso. ` +
        `Marque com camada:"tecnica" as arestas que nao carregam leitura logica.`);
  }

  return { erros, avisos };
}

function dossie(m) {
  const erros = [], avisos = [];
  const d = m.dossie;
  if (!d) { avisos.push('sem dossie — a sessao seguinte retoma o desenho, mas nao a conversa.'); return { erros, avisos }; }

  const cands = d.candidatas || [];
  if (cands.length) {
    const escolhidas = cands.filter(c => c.estado === 'escolhida');
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
        if (JSON.stringify(cands[i].tupla) === JSON.stringify(cands[j].tupla))
          erros.push(`dossie.candidatas: "${cands[i].nome}" e "${cands[j].nome}" tem a MESMA tupla E1-E5 — ` +
            `nao sao candidatas distintas, sao a mesma arquitetura com dois nomes.`);
  }

  const ids = new Set(m.nos.map(n => n.id));
  for (const a of (d.achados || []))
    if (a.alvo !== undefined && !ids.has(a.alvo)) erros.push(`dossie.achados: alvo "${a.alvo}" nao existe entre os nos.`);
  for (const e of (d.estacionamento || []))
    if (e.capacidade !== undefined && !ids.has(e.capacidade))
      erros.push(`dossie.estacionamento: capacidade "${e.capacidade}" nao existe entre os nos.`);

  // Achado recusado que nao virou nota e a falha que o #15 §4 nomeia: sem diff
  // contra IaC, achado ignorado vira diagrama que engana em silencio.
  for (const a of (d.achados || []).filter(x => x.estado === 'recusado')) {
    if (!a.viaNota) {
      erros.push(`dossie.achados: "${a.regra}" foi RECUSADO e nao aponta \`viaNota\`. ` +
        `A recusa tem de virar marca no diagrama (#15 §4), senao o desenho engana calado.`);
      continue;
    }
    const nota = (m.notas || []).find(n => n.id === a.viaNota);
    if (!nota) erros.push(`dossie.achados: "${a.regra}" aponta viaNota="${a.viaNota}", que nao existe em notas.`);
    else if (nota.origem !== 'achado-recusado')
      erros.push(`dossie.achados: "${a.regra}" aponta a nota "${a.viaNota}", que tem origem "${nota.origem}" e nao "achado-recusado".`);
    else if ((nota.camada || 'ambas') !== 'ambas')
      erros.push(`dossie.achados: a nota "${a.viaNota}" so aparece na vista tecnica — a recusa some da vista logica, que e a que foi aprovada.`);
  }

  if (d.acordo && d.acordo.candidata && !cands.some(c => c.id === d.acordo.candidata))
    erros.push(`dossie.acordo: candidata "${d.acordo.candidata}" nao esta em dossie.candidatas.`);

  if (m.estagio === 'tecnica' && !d.acordo)
    erros.push('estagio "tecnica" sem dossie.acordo. A premissa 2 poe a aprovacao da vista logica ' +
      'ENTRE as duas fases — elaborar tecnicamente sem ela e pular o coracao do produto.');

  return { erros, avisos };
}

function validar(modelo) {
  const deForma = contraEsquema(modelo, ESQUEMA, ESQUEMA);
  if (deForma.length) return { ok: false, fase: 'esquema', erros: deForma, avisos: [] };

  const { erros: deRef, porId } = referencias(modelo);
  if (deRef.length) return { ok: false, fase: 'referencias', erros: deRef, avisos: [] };

  const c = casacos(modelo, porId);
  const d = dossie(modelo);
  const erros = [...c.erros, ...d.erros];
  const avisos = [...c.avisos, ...d.avisos];
  if (erros.length) return { ok: false, fase: 'sessao', erros, avisos };
  return { ok: true, fase: null, erros: [], avisos, porId };
}

module.exports = { validar, ESQUEMA };
