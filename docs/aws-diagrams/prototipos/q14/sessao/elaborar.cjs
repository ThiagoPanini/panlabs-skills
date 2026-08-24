'use strict';
/**
 * Elaboracao — a fase tecnica aplicada sobre o modelo que a sessao anterior
 * aprovou.
 *
 * A sessao 2 NAO reescreve o modelo logico. Ela aplica um DELTA sobre o modelo
 * que recuperou de dentro do `.drawio`, e o delta nao tem como alcancar um
 * casaco logico — nao existe campo para isso na elaboracao, e o guarda no fim
 * confere que nenhum foi tocado. Mesma jogada do #11: a regra vira gramatica em
 * vez de disciplina.
 *
 * O que o delta pode fazer:
 *   nos            acrescentar infraestrutura (camada "tecnica" obrigatoria)
 *   casacos        vestir um no aprovado de servico AWS
 *   dentro         reparentar um no aprovado para dentro de nivel novo  ← a operacao de risco
 *   refina         transformar uma aresta aprovada num CAMINHO tecnico
 *   arestas        acrescentar aresta que so a camada tecnica tem
 *   arestasCasaco  dar rotulo tecnico a uma aresta aprovada
 *   notas, dossie  acrescentar
 *
 * `refina` merece a explicacao. Tecnicamente, "guardar-bruto avisa chegada a
 * processar-na-chegada" passa por um barramento de eventos. O reflexo e apagar a
 * aresta aprovada e escrever duas novas — e ai o extremo aprovado depende de
 * alguem reescrever certo. Declarando os SALTOS, os extremos sao os mesmos
 * objetos de antes: a primeira aresta continua sendo a aprovada, com o rotulo
 * logico dela intacto, e a contracao da projecao reconstroi o par original.
 */

const clonar = o => JSON.parse(JSON.stringify(o));

function elaborar(base, el) {
  if (el.sobre && el.sobre !== base.id)
    throw new Error(`elaboracao e sobre "${el.sobre}", o modelo e "${base.id}"`);

  const m = clonar(base);
  const erros = [];
  const porId = new Map(m.nos.map(n => [n.id, n]));
  const porAresta = new Map((m.arestas || []).filter(a => a.id).map(a => [a.id, a]));

  // 1 · nos novos ------------------------------------------------------------
  for (const n of (el.nos || [])) {
    if (porId.has(n.id)) { erros.push(`no novo "${n.id}" ja existe no modelo aprovado`); continue; }
    if (n.logico)
      erros.push(`no novo "${n.id}" traz casaco logico. A fase tecnica nao inventa capacidade: ` +
        `se ela e mesmo nova, a vista logica mudou e precisa de aprovacao nova, nao de um casaco a mais.`);
    if ((n.camada || 'ambas') !== 'tecnica')
      erros.push(`no novo "${n.id}" sem camada "tecnica" — tudo que a elaboracao acrescenta e infraestrutura.`);
    const copia = clonar(n);
    m.nos.push(copia); porId.set(copia.id, copia);
  }

  // 2 · casacos tecnicos -----------------------------------------------------
  for (const [id, casaco] of Object.entries(el.casacos || {})) {
    const n = porId.get(id);
    if (!n) { erros.push(`casaco para "${id}", que nao existe`); continue; }
    if (n.tecnico) erros.push(`no "${id}" ja tinha casaco tecnico`);
    n.tecnico = clonar(casaco);
  }

  // 3 · reparentar -----------------------------------------------------------
  for (const [id, pai] of Object.entries(el.dentro || {})) {
    const n = porId.get(id);
    if (!n) { erros.push(`reparenta "${id}", que nao existe`); continue; }
    if (!porId.has(pai)) { erros.push(`reparenta "${id}" para dentro de "${pai}", que nao existe`); continue; }
    n.dentro = pai;
  }

  // 4 · refinar aresta em caminho -------------------------------------------
  for (const [id, r] of Object.entries(el.refina || {})) {
    const a = porAresta.get(id);
    if (!a) { erros.push(`refina a aresta "${id}", que nao existe`); continue; }
    const saltos = r.por || [];
    for (const s of saltos) if (!porId.has(s)) erros.push(`refina "${id}" por "${s}", que nao existe`);
    const rotulos = r.rotulos || [];
    if (rotulos.length && rotulos.length !== saltos.length + 1)
      erros.push(`refina "${id}": ${saltos.length} salto(s) exigem ${saltos.length + 1} rotulo(s), vieram ${rotulos.length}`);

    const cadeia = [a.de, ...saltos, a.para];
    // O primeiro segmento CONTINUA sendo a aresta aprovada: mesmo objeto, mesmo
    // id, mesmo rotulo logico. So o alvo muda e ganha um casaco tecnico.
    a.para = cadeia[1];
    if (rotulos[0] !== undefined) a.tecnico = { ...(a.tecnico || {}), rotulo: rotulos[0] };
    for (let k = 1; k < cadeia.length - 1; k++) {
      const seg = { id: `${id}-s${k}`, de: cadeia[k], para: cadeia[k + 1], camada: 'ambas' };
      // O salto NAO herda `dados` nem `protocolo`: e plumbing, e a aresta
      // aprovada (o primeiro segmento) e que carrega a afirmacao. Herdar
      // `dados: "ambos"` faria o barramento sair com seta dupla, afirmando um
      // caminho de volta que passa por outro lugar.
      if (rotulos[k] !== undefined) seg.rotulo = rotulos[k];
      m.arestas.push(seg); porAresta.set(seg.id, seg);
    }
  }

  // 5 · arestas novas e casacos de aresta ------------------------------------
  for (const a of (el.arestas || [])) {
    if (a.id && porAresta.has(a.id)) { erros.push(`aresta nova "${a.id}" ja existe`); continue; }
    const copia = clonar(a);
    m.arestas.push(copia); if (copia.id) porAresta.set(copia.id, copia);
  }
  for (const [id, casaco] of Object.entries(el.arestasCasaco || {})) {
    const a = porAresta.get(id);
    if (!a) { erros.push(`casaco para a aresta "${id}", que nao existe`); continue; }
    a.tecnico = { ...(a.tecnico || {}), ...clonar(casaco) };
  }

  // 6 · notas e dossie -------------------------------------------------------
  m.notas = [...(m.notas || []), ...clonar(el.notas || [])];
  if (el.dossie) {
    m.dossie = m.dossie || {};
    for (const e of (el.dossie.estacionamento || [])) {
      const l = m.dossie.estacionamento || (m.dossie.estacionamento = []);
      const i = l.findIndex(x => x.nome === e.nome);
      if (i >= 0) l[i] = clonar(e); else l.push(clonar(e));
    }
    for (const a of (el.dossie.achados || [])) {
      const l = m.dossie.achados || (m.dossie.achados = []);
      const i = l.findIndex(x => x.regra === a.regra && x.alvo === a.alvo);
      if (i >= 0) l[i] = clonar(a); else l.push(clonar(a));
    }
  }

  m.estagio = 'tecnica';
  if (el.titulo) m.titulo = el.titulo;
  if (el.subtitulo) m.subtitulo = el.subtitulo;

  // 7 · o guarda -------------------------------------------------------------
  // Nao e paranoia: e o mesmo experimento de controle do #11. A elaboracao nao
  // TEM campo que alcance um casaco logico, e mesmo assim a checagem existe,
  // porque foi assim que o #17 aprendeu que 24 checagens verdes nao pegaram o
  // icone errado. Barato, e fecha a porta que o esquema deixaria entreaberta se
  // alguem acrescentasse um campo amanha.
  const antes = new Map(base.nos.map(n => [n.id, JSON.stringify(n.logico)]));
  for (const [id, logico] of antes) {
    const agora = porId.get(id);
    if (!agora) { erros.push(`o no aprovado "${id}" sumiu na elaboracao`); continue; }
    if (JSON.stringify(agora.logico) !== logico)
      erros.push(`a elaboracao mexeu no casaco logico de "${id}" — isso muda o que foi aprovado`);
  }

  if (erros.length) { const e = new Error('elaboracao invalida'); e.erros = erros; throw e; }
  return m;
}

module.exports = { elaborar };
