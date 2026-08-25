'use strict';
/**
 * Projecao — `session@1` + vista  ->  `model@1` (o que o motor do #11 come).
 *
 * Este arquivo e a resposta inteira a primeira pergunta do #14 ("um IR ou
 * dois?"). O ticket enunciou o trade-off como *rastreabilidade vs simplicidade*:
 * dois modelos ligados por mapeamento explicito rastreiam melhor; um modelo so e
 * mais simples. **O trade-off e falso**, e a razao esta aqui dentro:
 *
 *   com um IR so, a rastreabilidade nao e uma tabela de-para que alguem mantem —
 *   e uma FUNCAO. `projetar(tecnico, 'logica')` reconstroi a vista logica a
 *   partir do modelo tecnico, e comparar o resultado com o que foi aprovado e
 *   uma igualdade de strings.
 *
 * Com dois modelos, a mesma pergunta ("o que estou desenhando ainda e o que voce
 * aprovou?") exige que o mapeamento esteja correto — e nada garante isso. Com um
 * modelo, a pergunta se responde sozinha.
 *
 * Duas mecanicas fazem a projecao funcionar:
 *
 * 1. COLAPSO DE CONTENCAO. `dentro` aponta sempre para o pai mais fino que o
 *    modelo conhece. Para achar o pai numa vista mais grossa, sobe-se ate o
 *    primeiro ancestral que exista naquela vista. E isto que deixa a fase
 *    tecnica enfiar VPC e subnet entre a folha e a fronteira SEM MEXER no que foi
 *    aprovado: a folha muda de `dentro`, a projecao logica nao muda nada.
 *
 * 2. CONTRACAO DE ARESTA. Um no que so a camada tecnica tem (VPC endpoint, papel
 *    de IAM, barramento de evento) fica no MEIO de um caminho logico. A aresta
 *    logica e a contracao do caminho: `processar -> endpoint -> tabela` projeta
 *    para `processar -> tabela`, com o rotulo da primeira aresta.
 *
 * O motor do #11 nao mudou uma linha para isto acontecer — e nao e coincidencia:
 * a saida daqui e um `model@1` valido, e o motor continua sendo um renderizador
 * de UMA vista. Quem sabe que existem duas e a camada de sessao.
 */

const VISTAS = ['logical', 'technical'];

/**
 * Campos que o casaco tecnico repassa direto para o no do model@1.
 *
 * ⚠️ ESTA LISTA E O `session/schema.json` SAO A MESMA DECISAO ESCRITA DUAS VEZES,
 * e o dia em que discordarem o campo some sem erro nenhum — foi o que aconteceu
 * com `qualificador`, `ou` e `habilita` ate o #29: os tres existiam em `model@1`
 * e nao existiam aqui, entao quem passava pelo ARCO DE DUAS VISTAS perdia os tres
 * enquanto quem escrevia `model@1` direto os tinha. `ou` era o mais caro: sem
 * ele, multi-conta pelo arco nao conseguia expressar unidade organizacional
 * nenhuma — as duas bandeiras da skill nao se combinavam.
 *
 * `tests/check-technical-parity.cjs` (#37) mede duas paridades, nao uma:
 * model@1.no contra session@1.casacoTecnico (os dois ESQUEMAS), e esta lista
 * contra session@1.casacoTecnico (o esquema contra quem de fato PROJETA). A
 * primeira sozinha nao pegaria a falha que faltou aqui para `camada` (#22)
 * ate o #37: o campo podia estar nos dois esquemas e ainda assim nunca
 * chegar ao model@1 projetado, se esta lista esquecesse dele. Exportada por
 * isso — a checagem le a lista de verdade, nao uma copia dela.
 */
const CAMPOS_TECNICOS = ['service', 'az', 'access', 'cidr', 'account', 'note',
                         'qualifier', 'ou', 'enables', 'layer'];

/** O mesmo, do lado logico. `nota` ja vinha; `qualificador` entrou no #29. */
const CAMPOS_LOGICOS = ['note', 'qualifier'];

const existeNa = (el, view) =>
  view === 'technical' ? true : (el.layer || 'both') !== 'technical';

/**
 * @param {object} sessao  modelo `session@1`
 * @param {'logica'|'tecnica'} vista
 * @returns {{modelo: object, trilha: object}}
 */
function projetar(sessao, view) {
  if (!VISTAS.includes(view)) throw new Error(`vista "${view}" — esperado logica ou tecnica`);
  if (view === 'technical' && sessao.stage !== 'technical')
    throw new Error('modelo no estagio "logica" nao emite vista tecnica: nenhum no tem casaco tecnico ainda');

  const porId = new Map(sessao.nodes.map(n => [n.id, n]));
  const trilha = { colapsados: [], contraidas: [], descartados: [] };

  // ------------------------------------------------------- 1. quem sobrevive
  const vive = new Set();
  for (const n of sessao.nodes) {
    if (!existeNa(n, view)) { trilha.descartados.push({ o: 'no', id: n.id, because: 'so existe na vista tecnica' }); continue; }
    vive.add(n.id);
  }

  // ------------------------------------------------- 2. contencao colapsada
  /** Sobe por `dentro` ate achar um ancestral que exista nesta vista. */
  function paiNaVista(no) {
    let atual = no.inside, jumps = 0;
    while (atual !== undefined) {
      if (vive.has(atual)) return { pai: atual, jumps };
      const acima = porId.get(atual);
      if (!acima) return { pai: undefined, jumps };   // referencia quebrada — o validador reclama antes
      atual = acima.inside; jumps++;
    }
    return { pai: undefined, jumps };
  }

  const nodes = [];
  for (const n of sessao.nodes) {
    if (!vive.has(n.id)) continue;
    const facet = view === 'logical' ? n.logical : n.technical;
    if (!facet) throw new Error(`no "${n.id}" sem casaco "${view}" — o validador de sessao deveria ter pego isto`);

    const { pai, jumps } = paiNaVista(n);
    if (jumps > 0) trilha.colapsados.push({ id: n.id, from: n.inside, to: pai, jumps });

    const output = { id: n.id, kind: facet.kind };
    const label = facet.label !== undefined ? facet.label : n.label;
    if (label !== undefined) output.label = label;
    if (pai !== undefined) output.inside = pai;
    // As chaves aqui NAO sao decoracao: sem elas o `else` gruda no `if` de
    // dentro do `for` e a projecao LOGICA nunca copia `nota` — o casaco logico
    // declara o campo, o esquema o documenta, e ele some sem erro nenhum.
    if (view === 'technical') {
      for (const c of CAMPOS_TECNICOS) if (facet[c] !== undefined) output[c] = facet[c];
    } else {
      for (const c of CAMPOS_LOGICOS) if (facet[c] !== undefined) output[c] = facet[c];
    }
    nodes.push(output);
  }

  // ---------------------------------------------------- 3. arestas
  const arestasDaVista = (sessao.edges || []).filter(a => existeNa(a, view));
  for (const a of (sessao.edges || []))
    if (!existeNa(a, view))
      trilha.descartados.push({ o: 'edge', id: a.id || `${a.from}->${a.to}`, because: 'so existe na vista tecnica' });

  const saindoDe = new Map();
  for (const a of arestasDaVista) {
    if (!saindoDe.has(a.from)) saindoDe.set(a.from, []);
    saindoDe.get(a.from).push(a);
  }

  /**
   * Anda para frente atravessando nos que nao existem nesta vista, e devolve os
   * nos vivos alcancados. Um endpoint tecnico com duas saidas produz duas
   * arestas logicas — o que e a leitura certa: quem manda para o barramento
   * manda para os dois consumidores dele.
   */
  function alcancaveis(idInicial, visitados) {
    if (vive.has(idInicial)) return [{ id: idInicial, by: [] }];
    if (visitados.has(idInicial)) return [];
    visitados.add(idInicial);
    const out = [];
    for (const seguinte of (saindoDe.get(idInicial) || []))
      for (const target of alcancaveis(seguinte.to, visitados))
        out.push({ id: target.id, by: [idInicial, ...target.by] });
    return out;
  }

  const edges = [];
  const jaVistas = new Set();
  for (const a of arestasDaVista) {
    if (!vive.has(a.from)) continue;   // caminho que comeca em infraestrutura nao tem leitura logica

    // Os alvos tem de estar todos conhecidos ANTES de emitir, porque o id de
    // saida depende de quantos sao. Sem isto a aresta contraida perdia o id da
    // aresta aprovada, o motor caia no id derivado, e a MESMA vista logica saia
    // com outros ids de celula depois da elaboracao tecnica — uma divergencia
    // inteira num desenho que nao mudou em nada. Custou uma rodada de bancada.
    const alvos = [];
    const vistos = new Set();
    for (const target of alcancaveis(a.to, new Set())) {
      if (target.id === a.from) continue;                          // contracao fechou um laco
      if (vistos.has(target.id)) continue;
      // A chave leva a ARESTA de origem, nao so o par (de, para). Sem isso, duas
      // arestas aprovadas DISTINTAS entre o mesmo par — "envia pedido" e
      // "confirma recebimento" entre os mesmos dois blocos — colapsariam numa
      // so, e as duas pontas da comparacao do acordo perderiam a mesma, deixando
      // a checagem cega para a perda. `vistos` continua deduplicando o leque de
      // UMA aresta, que e o caso que a contracao realmente cria.
      const chave = `${a.id || `${a.from}>${a.to}`}#${target.id}`;
      if (jaVistas.has(chave)) continue;
      jaVistas.add(chave); vistos.add(target.id);
      alvos.push(target);
    }

    for (const target of alvos) {
      const facet = (view === 'logical' ? a.logical : a.technical) || {};
      const e = { from: a.from, to: target.id };
      // A aresta contraida CONTINUA sendo a aresta aprovada — so passou a ser
      // desenhada pelo caminho curto, e por isso herda o id. Quando um salto
      // abre em leque (um barramento com varios consumidores), o alvo desempata.
      if (a.id !== undefined) e.id = alvos.length > 1 ? `${a.id}--${target.id}` : a.id;
      const label = facet.label !== undefined ? facet.label : a.label;
      if (label !== undefined) e.label = label;
      const protocol = facet.protocol !== undefined ? facet.protocol : a.protocol;
      if (protocol !== undefined) e.protocol = protocol;
      if (a.data !== undefined) e.data = a.data;
      const order = facet.order !== undefined ? facet.order : a.order;
      if (order !== undefined) e.order = order;
      edges.push(e);

      if (target.by.length)
        trilha.contraidas.push({ from: a.from, to: target.id, by: target.by, label });
    }
  }

  // ---------------------------------------------------- 4. faixas e notas
  // Faixa e conceito de topologia (#19) — a vista logica nao tem o que cruzar.
  const bands = view === 'technical'
    ? (sessao.bands || []).filter(f => f.members.every(m => vive.has(m)))
    : [];

  const notes = [];
  for (const nt of (sessao.notes || [])) {
    if (!existeNa(nt, view)) { trilha.descartados.push({ o: 'note', id: nt.id || nt.text.slice(0, 24), because: 'so existe na vista tecnica' }); continue; }
    if (nt.about !== undefined && !vive.has(nt.about)) {
      // Nota presa a um no que sumiu na projecao. Reancorar no ancestral seria
      // mudar o que ela afirma; omitir calado seria A4.2. Vira nota de rodape,
      // e a trilha registra o remanejo.
      trilha.descartados.push({ o: 'ancora-de-nota', id: nt.about, because: 'nota virou rodape nesta vista' });
      const { about, layer, ...resto } = nt;
      notes.push(resto);
      continue;
    }
    const { layer, ...resto } = nt;
    notes.push(resto);
  }

  const ap = (sessao.vistas && sessao.vistas[view]) || {};
  const modelo = {
    schema: 'panlabs-aws-diagrams/model@1',
    id: `${sessao.id}-${view}`,
    title: ap.title || sessao.title,
    view,
    nodes, edges,
  };
  const sub = ap.subtitle !== undefined ? ap.subtitle : sessao.subtitle;
  if (sub) modelo.subtitle = sub;
  if (ap.genre) modelo.genre = ap.genre;
  if (bands.length) modelo.bands = bands;
  if (notes.length) modelo.notes = notes;

  return { modelo, trilha };
}

/**
 * O ACORDO: o recorte do modelo projetado que a aprovacao cobre.
 *
 * Nao e o modelo inteiro. Titulo, subtitulo e genero sao apresentacao — mudar o
 * subtitulo depois de aprovado nao desfaz o acordo, e um esquema de aprovacao
 * que se quebra com isso vira ruido e o usuario aprende a ignorar. O que o
 * acordo cobre e o que foi DISCUTIDO: quais capacidades existem, dentro de que
 * fronteira, quem fala com quem, e as notas — inclusive a do achado recusado,
 * que e como "SPOF conhecido e aceito" (#15 §4) sobrevive.
 */
function recorteDoAcordo(modeloLogico) {
  // As chaves de ordenacao levam separador e rotulo. Concatenar `de + para` cru
  // faz ("a","bc") e ("ab","c") virarem a mesma chave; e o rotulo entra porque,
  // com arestas paralelas entre o mesmo par, sem ele a ordem depende de quem
  // chegou primeiro na lista — e a impressao do acordo deixaria de ser estavel.
  const chaveDaAresta = a => `${a.from} ${a.to} ${a.label || ''}`;
  const cmp = (x, y) => x < y ? -1 : x > y ? 1 : 0;
  return {
    nodes: modeloLogico.nodes.map(n => ({ id: n.id, kind: n.kind, label: n.label, inside: n.inside, note: n.note }))
      .sort((a, b) => cmp(a.id, b.id)),
    edges: (modeloLogico.edges || []).map(a => ({ from: a.from, to: a.to, label: a.label, data: a.data }))
      .sort((x, y) => cmp(chaveDaAresta(x), chaveDaAresta(y))),
    notes: (modeloLogico.notes || []).map(n => ({ text: n.text, about: n.about, origin: n.origin }))
      .sort((a, b) => cmp(a.text, b.text)),
  };
}

module.exports = { projetar, recorteDoAcordo, VISTAS, CAMPOS_TECNICOS, CAMPOS_LOGICOS };
