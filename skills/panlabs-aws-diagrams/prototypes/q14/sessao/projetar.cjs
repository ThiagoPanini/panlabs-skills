'use strict';
/**
 * Projecao — `sessao@1` + vista  ->  `modelo@1` (o que o motor do #11 come).
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
 * a saida daqui e um `modelo@1` valido, e o motor continua sendo um renderizador
 * de UMA vista. Quem sabe que existem duas e a camada de sessao.
 */

const VISTAS = ['logica', 'tecnica'];

/** Campos que o casaco tecnico repassa direto para o no do modelo@1. */
const CAMPOS_TECNICOS = ['servico', 'az', 'acesso', 'cidr', 'conta', 'nota'];

const existeNa = (el, vista) =>
  vista === 'tecnica' ? true : (el.camada || 'ambas') !== 'tecnica';

/**
 * @param {object} sessao  modelo `sessao@1`
 * @param {'logica'|'tecnica'} vista
 * @returns {{modelo: object, trilha: object}}
 */
function projetar(sessao, vista) {
  if (!VISTAS.includes(vista)) throw new Error(`vista "${vista}" — esperado logica ou tecnica`);
  if (vista === 'tecnica' && sessao.estagio !== 'tecnica')
    throw new Error('modelo no estagio "logica" nao emite vista tecnica: nenhum no tem casaco tecnico ainda');

  const porId = new Map(sessao.nos.map(n => [n.id, n]));
  const trilha = { colapsados: [], contraidas: [], descartados: [] };

  // ------------------------------------------------------- 1. quem sobrevive
  const vive = new Set();
  for (const n of sessao.nos) {
    if (!existeNa(n, vista)) { trilha.descartados.push({ o: 'no', id: n.id, porque: 'so existe na vista tecnica' }); continue; }
    vive.add(n.id);
  }

  // ------------------------------------------------- 2. contencao colapsada
  /** Sobe por `dentro` ate achar um ancestral que exista nesta vista. */
  function paiNaVista(no) {
    let atual = no.dentro, saltos = 0;
    while (atual !== undefined) {
      if (vive.has(atual)) return { pai: atual, saltos };
      const acima = porId.get(atual);
      if (!acima) return { pai: undefined, saltos };   // referencia quebrada — o validador reclama antes
      atual = acima.dentro; saltos++;
    }
    return { pai: undefined, saltos };
  }

  const nos = [];
  for (const n of sessao.nos) {
    if (!vive.has(n.id)) continue;
    const casaco = vista === 'logica' ? n.logico : n.tecnico;
    if (!casaco) throw new Error(`no "${n.id}" sem casaco "${vista}" — o validador de sessao deveria ter pego isto`);

    const { pai, saltos } = paiNaVista(n);
    if (saltos > 0) trilha.colapsados.push({ id: n.id, de: n.dentro, para: pai, saltos });

    const saida = { id: n.id, tipo: casaco.tipo };
    const rotulo = casaco.rotulo !== undefined ? casaco.rotulo : n.rotulo;
    if (rotulo !== undefined) saida.rotulo = rotulo;
    if (pai !== undefined) saida.dentro = pai;
    if (vista === 'tecnica') for (const c of CAMPOS_TECNICOS) if (casaco[c] !== undefined) saida[c] = casaco[c];
    else if (casaco.nota !== undefined) saida.nota = casaco.nota;
    nos.push(saida);
  }

  // ---------------------------------------------------- 3. arestas
  const arestasDaVista = (sessao.arestas || []).filter(a => existeNa(a, vista));
  for (const a of (sessao.arestas || []))
    if (!existeNa(a, vista))
      trilha.descartados.push({ o: 'aresta', id: a.id || `${a.de}->${a.para}`, porque: 'so existe na vista tecnica' });

  const saindoDe = new Map();
  for (const a of arestasDaVista) {
    if (!saindoDe.has(a.de)) saindoDe.set(a.de, []);
    saindoDe.get(a.de).push(a);
  }

  /**
   * Anda para frente atravessando nos que nao existem nesta vista, e devolve os
   * nos vivos alcancados. Um endpoint tecnico com duas saidas produz duas
   * arestas logicas — o que e a leitura certa: quem manda para o barramento
   * manda para os dois consumidores dele.
   */
  function alcancaveis(idInicial, visitados) {
    if (vive.has(idInicial)) return [{ id: idInicial, por: [] }];
    if (visitados.has(idInicial)) return [];
    visitados.add(idInicial);
    const out = [];
    for (const seguinte of (saindoDe.get(idInicial) || []))
      for (const alvo of alcancaveis(seguinte.para, visitados))
        out.push({ id: alvo.id, por: [idInicial, ...alvo.por] });
    return out;
  }

  const arestas = [];
  const jaVistas = new Set();
  for (const a of arestasDaVista) {
    if (!vive.has(a.de)) continue;   // caminho que comeca em infraestrutura nao tem leitura logica

    // Os alvos tem de estar todos conhecidos ANTES de emitir, porque o id de
    // saida depende de quantos sao. Sem isto a aresta contraida perdia o id da
    // aresta aprovada, o motor caia no id derivado, e a MESMA vista logica saia
    // com outros ids de celula depois da elaboracao tecnica — uma divergencia
    // inteira num desenho que nao mudou em nada. Custou uma rodada de bancada.
    const alvos = [];
    const vistos = new Set();
    for (const alvo of alcancaveis(a.para, new Set())) {
      if (alvo.id === a.de) continue;                          // contracao fechou um laco
      if (vistos.has(alvo.id)) continue;
      const chave = `${a.de}>${alvo.id}`;
      if (jaVistas.has(chave)) continue;
      jaVistas.add(chave); vistos.add(alvo.id);
      alvos.push(alvo);
    }

    for (const alvo of alvos) {
      const casaco = (vista === 'logica' ? a.logico : a.tecnico) || {};
      const e = { de: a.de, para: alvo.id };
      // A aresta contraida CONTINUA sendo a aresta aprovada — so passou a ser
      // desenhada pelo caminho curto, e por isso herda o id. Quando um salto
      // abre em leque (um barramento com varios consumidores), o alvo desempata.
      if (a.id !== undefined) e.id = alvos.length > 1 ? `${a.id}--${alvo.id}` : a.id;
      const rotulo = casaco.rotulo !== undefined ? casaco.rotulo : a.rotulo;
      if (rotulo !== undefined) e.rotulo = rotulo;
      const protocolo = casaco.protocolo !== undefined ? casaco.protocolo : a.protocolo;
      if (protocolo !== undefined) e.protocolo = protocolo;
      if (a.dados !== undefined) e.dados = a.dados;
      const ordem = casaco.ordem !== undefined ? casaco.ordem : a.ordem;
      if (ordem !== undefined) e.ordem = ordem;
      arestas.push(e);

      if (alvo.por.length)
        trilha.contraidas.push({ de: a.de, para: alvo.id, por: alvo.por, rotulo });
    }
  }

  // ---------------------------------------------------- 4. faixas e notas
  // Faixa e conceito de topologia (#19) — a vista logica nao tem o que cruzar.
  const faixas = vista === 'tecnica'
    ? (sessao.faixas || []).filter(f => f.membros.every(m => vive.has(m)))
    : [];

  const notas = [];
  for (const nt of (sessao.notas || [])) {
    if (!existeNa(nt, vista)) { trilha.descartados.push({ o: 'nota', id: nt.id || nt.texto.slice(0, 24), porque: 'so existe na vista tecnica' }); continue; }
    if (nt.sobre !== undefined && !vive.has(nt.sobre)) {
      // Nota presa a um no que sumiu na projecao. Reancorar no ancestral seria
      // mudar o que ela afirma; omitir calado seria A4.2. Vira nota de rodape,
      // e a trilha registra o remanejo.
      trilha.descartados.push({ o: 'ancora-de-nota', id: nt.sobre, porque: 'nota virou rodape nesta vista' });
      const { sobre, camada, ...resto } = nt;
      notas.push(resto);
      continue;
    }
    const { camada, ...resto } = nt;
    notas.push(resto);
  }

  const ap = (sessao.vistas && sessao.vistas[vista]) || {};
  const modelo = {
    esquema: 'panlabs-aws-diagrams/modelo@1',
    id: `${sessao.id}-${vista}`,
    titulo: ap.titulo || sessao.titulo,
    vista,
    nos, arestas,
  };
  const sub = ap.subtitulo !== undefined ? ap.subtitulo : sessao.subtitulo;
  if (sub) modelo.subtitulo = sub;
  if (ap.genero) modelo.genero = ap.genero;
  if (faixas.length) modelo.faixas = faixas;
  if (notas.length) modelo.notas = notas;

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
  return {
    nos: modeloLogico.nos.map(n => ({ id: n.id, tipo: n.tipo, rotulo: n.rotulo, dentro: n.dentro }))
      .sort((a, b) => a.id < b.id ? -1 : 1),
    arestas: (modeloLogico.arestas || []).map(a => ({ de: a.de, para: a.para, rotulo: a.rotulo, dados: a.dados }))
      .sort((x, y) => (x.de + x.para) < (y.de + y.para) ? -1 : 1),
    notas: (modeloLogico.notas || []).map(n => ({ texto: n.texto, sobre: n.sobre, origem: n.origem }))
      .sort((a, b) => a.texto < b.texto ? -1 : 1),
  };
}

module.exports = { projetar, recorteDoAcordo, VISTAS };
