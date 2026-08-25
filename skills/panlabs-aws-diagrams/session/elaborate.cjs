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
 * Ate o #37, `elaboration@1` nao tinha arquivo de esquema: o unico jeito de errar
 * a FORMA do delta (campo com typo, `esquema` errado, no novo sem `camada`) era
 * cair direto nos erros de dominio abaixo, ou nem isso. Agora a forma e
 * conferida primeiro, contra o mesmo esquema que `tests/check-single-schema.cjs`
 * passou a varrer.
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

const fs = require('fs');
const path = require('path');
const { contraEsquema } = require(path.join(__dirname, '..', 'engine', 'validate.cjs'));

const ESQUEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'elaboration.schema.json'), 'utf8'));

const clonar = o => JSON.parse(JSON.stringify(o));

function elaborar(base, el) {
  const deForma = contraEsquema(el, ESQUEMA, ESQUEMA);
  if (deForma.length) { const e = new Error('elaboracao fora do esquema'); e.erros = deForma; throw e; }

  if (el.about && el.about !== base.id)
    throw new Error(`elaboracao e sobre "${el.about}", o modelo e "${base.id}"`);

  const m = clonar(base);
  const erros = [];
  const porId = new Map(m.nodes.map(n => [n.id, n]));
  const porAresta = new Map((m.edges || []).filter(a => a.id).map(a => [a.id, a]));

  // 1 · nos novos ------------------------------------------------------------
  for (const n of (el.nodes || [])) {
    if (porId.has(n.id)) { erros.push(`no novo "${n.id}" ja existe no modelo aprovado`); continue; }
    if (n.logical)
      erros.push(`no novo "${n.id}" traz casaco logico. A fase tecnica nao inventa capacidade: ` +
        `se ela e mesmo nova, a vista logica mudou e precisa de aprovacao nova, nao de um casaco a mais.`);
    if ((n.layer || 'both') !== 'technical')
      erros.push(`no novo "${n.id}" sem camada "tecnica" — tudo que a elaboracao acrescenta e infraestrutura.`);
    const copia = clonar(n);
    m.nodes.push(copia); porId.set(copia.id, copia);
  }

  // 2 · casacos tecnicos -----------------------------------------------------
  for (const [id, facet] of Object.entries(el.facets || {})) {
    const n = porId.get(id);
    if (!n) { erros.push(`casaco para "${id}", que nao existe`); continue; }
    if (n.technical) erros.push(`no "${id}" ja tinha casaco tecnico`);
    n.technical = clonar(facet);
  }

  // 3 · reparentar -----------------------------------------------------------
  for (const [id, pai] of Object.entries(el.inside || {})) {
    const n = porId.get(id);
    if (!n) { erros.push(`reparenta "${id}", que nao existe`); continue; }
    if (!porId.has(pai)) { erros.push(`reparenta "${id}" para dentro de "${pai}", que nao existe`); continue; }
    n.inside = pai;
  }

  // 4 · refinar aresta em caminho -------------------------------------------
  for (const [id, r] of Object.entries(el.refines || {})) {
    const a = porAresta.get(id);
    if (!a) { erros.push(`refina a aresta "${id}", que nao existe`); continue; }
    const jumps = r.by || [];
    for (const s of jumps) if (!porId.has(s)) erros.push(`refina "${id}" por "${s}", que nao existe`);
    const rotulos = r.rotulos || [];
    if (rotulos.length && rotulos.length !== jumps.length + 1)
      erros.push(`refina "${id}": ${jumps.length} salto(s) exigem ${jumps.length + 1} rotulo(s), vieram ${rotulos.length}`);

    const cadeia = [a.from, ...jumps, a.to];
    // O primeiro segmento CONTINUA sendo a aresta aprovada: mesmo objeto, mesmo
    // id, mesmo rotulo logico. So o alvo muda e ganha um casaco tecnico.
    a.to = cadeia[1];
    if (rotulos[0] !== undefined) a.technical = { ...(a.technical || {}), label: rotulos[0] };
    for (let k = 1; k < cadeia.length - 1; k++) {
      const seg = { id: `${id}-s${k}`, from: cadeia[k], to: cadeia[k + 1], layer: 'both' };
      // O salto NAO herda `dados` nem `protocolo`: e plumbing, e a aresta
      // aprovada (o primeiro segmento) e que carrega a afirmacao. Herdar
      // `dados: "ambos"` faria o barramento sair com seta dupla, afirmando um
      // caminho de volta que passa por outro lugar.
      if (rotulos[k] !== undefined) seg.label = rotulos[k];
      m.edges.push(seg); porAresta.set(seg.id, seg);
    }
  }

  // 5 · arestas novas e casacos de aresta ------------------------------------
  for (const a of (el.edges || [])) {
    if (a.id && porAresta.has(a.id)) { erros.push(`aresta nova "${a.id}" ja existe`); continue; }
    const copia = clonar(a);
    m.edges.push(copia); if (copia.id) porAresta.set(copia.id, copia);
  }
  for (const [id, facet] of Object.entries(el.facetEdges || {})) {
    const a = porAresta.get(id);
    if (!a) { erros.push(`casaco para a aresta "${id}", que nao existe`); continue; }
    a.technical = { ...(a.technical || {}), ...clonar(facet) };
  }

  // 6 · notas e dossie -------------------------------------------------------
  m.notes = [...(m.notes || []), ...clonar(el.notes || [])];
  if (el.dossier) {
    m.dossier = m.dossier || {};
    for (const e of (el.dossier.parking || [])) {
      const l = m.dossier.parking || (m.dossier.parking = []);
      const i = l.findIndex(x => x.name === e.name);
      if (i >= 0) l[i] = clonar(e); else l.push(clonar(e));
    }
    for (const a of (el.dossier.findings || [])) {
      const l = m.dossier.findings || (m.dossier.findings = []);
      const i = l.findIndex(x => x.rule === a.rule && x.target === a.target);
      if (i >= 0) l[i] = clonar(a); else l.push(clonar(a));
    }
  }

  m.stage = 'technical';
  if (el.title) m.title = el.title;
  if (el.subtitle) m.subtitle = el.subtitle;

  // 7 · o guarda -------------------------------------------------------------
  // Nao e paranoia: e o mesmo experimento de controle do #11. A elaboracao nao
  // TEM campo que alcance um casaco logico, e mesmo assim a checagem existe,
  // porque foi assim que o #17 aprendeu que 24 checagens verdes nao pegaram o
  // icone errado. Barato, e fecha a porta que o esquema deixaria entreaberta se
  // alguem acrescentasse um campo amanha.
  const antes = new Map(base.nodes.map(n => [n.id, JSON.stringify(n.logical)]));
  for (const [id, logical] of antes) {
    const agora = porId.get(id);
    if (!agora) { erros.push(`o no aprovado "${id}" sumiu na elaboracao`); continue; }
    if (JSON.stringify(agora.logical) !== logical)
      erros.push(`a elaboracao mexeu no casaco logico de "${id}" — isso muda o que foi aprovado`);
  }

  if (erros.length) { const e = new Error('elaboracao invalida'); e.erros = erros; throw e; }
  return m;
}

module.exports = { elaborar, ESQUEMA };
