'use strict';
/**
 * Camada de tema — tokens FECHADOS -> style string por célula.
 *
 * Três fatos de pesquisa decidem a forma deste módulo:
 *
 *  1. #4 §7 mediu os quatro níveis onde um estilo pode morar no draw.io e só
 *     DOIS viajam no arquivo: a style string por célula (nível D) e os atributos
 *     do `<mxGraphModel>` (nível D'). Folha `mxStylesheet` por nome, `defaultVertexStyle`
 *     e `currentVertexStyle` dependem da instalação de QUEM ABRE. Logo: tema é
 *     assado célula a célula, e não há alternativa.
 *
 *  2. #5 mediu a camada normativa: cor de grupo, traço de grupo, cor de categoria
 *     e tamanho de ícone são preset da AWS, e mudá-los faz o diagrama LER ERRADO
 *     (a cor do grupo É a legenda — #5 §6.4). Então o tema não pode nomeá-los.
 *     Aqui isso não é regra de runtime: é ausência de palavra no esquema, o mesmo
 *     truque que o #11 usou para a fronteira de coordenadas.
 *
 *  3. A régua (tools/measure-ruler.cjs) mostrou que a paleta AWS é calibrada para
 *     branco puro: `#ED7100` só alcança 3:1 contra `#FFFFFF`. Portanto `fundo` é
 *     um INTERRUPTOR de dois estados, não um seletor de cor — e o segundo estado
 *     é o deck escuro que a própria AWS publica (#5 F3).
 */

const fs = require('fs');
const path = require('path');

const { contraEsquema } = require('../engine/validate.cjs');
const { setChave } = require('../catalog/aws-shapes.cjs');

const ESQUEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'schema.json'), 'utf8'));
const DIR = __dirname;

/**
 * As paletas que a AWS entrega em variante Light/Dark — e SÓ elas.
 *
 * #5 §3.2: no pacote oficial só os `Res_General-Icons` têm `_Light`/`_Dark`,
 * porque só eles são monocromáticos; os demais usam a cor da categoria, "designed
 * to be used on both light and dark backgrounds" (slide 15). A medição confirma
 * o desenho: `#232F3D` dá 1,23:1 num fundo escuro — some — enquanto toda cor de
 * categoria fica acima de 3:1 nos dois fundos. O draw.io tem uma variante só,
 * então quem inverte é o tema.
 */
const PALETAS_MONO = new Set(['general_resources', 'illustrations']);

/**
 * O que o deck escuro da AWS muda, e nada além disso (#5 tabela 2.1 + N15):
 * a borda/ícone do `AWS Cloud` inverte, e os callouts invertem. As cores de
 * grupo são IDÊNTICAS nos dois decks.
 */
const NORMATIVO = {
  light:  { cloud: '#232F3E', mono: '#232F3E', callout: { background: '#232F3E', ink: '#FFFFFF' } },
  dark: { cloud: '#FFFFFF', mono: '#FFFFFF', callout: { background: '#FFFFFF', ink: '#232F3E' } },
};

/** Quanto da cor normativa do grupo entra no tingimento derivado. */
const TINGIMENTO = 0.10;

/** Mistura linear em sRGB — não é composição perceptual; é o que o draw.io faz. */
function misturar(color, background, p) {
  const canais = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [a, b] = [canais(color), canais(background)];
  return '#' + [0, 1, 2]
    .map(i => Math.round(a[i] * p + b[i] * (1 - p)).toString(16).padStart(2, '0'))
    .join('').toUpperCase();
}

const PADRAO = {
  light: {
    page: { color: '#FFFFFF', margin: 32 },
    group:  { tint: 'derived' },
    ink:  { strong: '#232F3E', weak: '#5A6C86', halo: '#FFFFFF' },
    text:  { family: 'Arial,Helvetica', label: 12, group: 12, edge: 10, title: 19, subtitle: 12, qualifier: false },
    edge: { color: '#232F3E', thickness: 1.6, tip: 'blockThin', corners: 12, jumps: 'arc', flow: 'solid' },
    gap:  { base: 8, density: 1.0 },
    note:   { background: '#FFF8E1', edge: '#B7791F', ink: '#6B4E00' },
    block:  { background: '#FFFFFF', edge: '#232F3E', corners: 12 },
    card: { revision: null },
  },
  dark: {
    // `#1C1C1C` e não `#161E2D`: o retorno do #13 pediu um tom mais escuro e mais
    // neutro, "próximo a #222222". Medido, `#222222` é 24% MAIS CLARO em luminância
    // que o azul-noite que estava aqui — ele lê como mais escuro por ser neutro, não
    // por ser escuro — e derruba a borda do Generic group para 2,97:1, um triz abaixo
    // do piso de 3:1. `#1C1C1C` entrega o neutro pedido, é de fato mais escuro que os
    // dois, e passa com 3,18:1.
    page: { color: '#1C1C1C', margin: 32 },
    group:  { tint: 'derived' },
    // `#AEB9C6` e não `#AAB7B8`: o segundo é literalmente o cinza que o draw.io usa
    // como `fontColor` do VPC e que este ticket condenou por 2,06:1 no fundo claro.
    // Reaproveitá-lo como tinta secundária do tema escuro (onde ele mede 8,09:1 e
    // passaria) confunde duas coisas diferentes no mesmo hex — e torna impossível
    // afirmar no pixel que o rótulo cinza do VPC não sobrou em lugar nenhum.
    ink:  { strong: '#FFFFFF', weak: '#B4B4B4', halo: '#1C1C1C' },
    text:  { family: 'Arial,Helvetica', label: 12, group: 12, edge: 10, title: 19, subtitle: 12, qualifier: false },
    edge: { color: '#EDEDED', thickness: 1.6, tip: 'blockThin', corners: 12, jumps: 'arc', flow: 'solid' },
    gap:  { base: 8, density: 1.0 },
    note:   { background: '#2A2416', edge: '#8A6D3B', ink: '#F3DFAE' },
    block:  { background: '#242424', edge: '#FFFFFF', corners: 12 },
    card: { revision: null },
  },
};

// ------------------------------------------------------------------ carga

function fundir(base, about) {
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(about || {})])) {
    const a = base[k], b = (about || {})[k];
    out[k] = (a && typeof a === 'object' && !Array.isArray(a)) ? fundir(a, b || {}) : (b === undefined ? a : b);
  }
  return out;
}

function lerArquivo(idOuCaminho) {
  const p = idOuCaminho.endsWith('.json') ? idOuCaminho : path.join(DIR, idOuCaminho + '.json');
  if (!fs.existsSync(p)) {
    const disponiveis = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'schema.json')
      .map(f => f.replace(/\.json$/, ''));
    const e = new Error(`tema "${idOuCaminho}" não existe`);
    e.erros = [`temas disponíveis: ${disponiveis.join(', ')}`];
    throw e;
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

/**
 * Carrega, valida contra o vocabulário fechado e funde com o padrão do `fundo`.
 * `herda` permite um tema dizer só o delta — a mesma lógica de "espelho + delta"
 * que o #17 usou no catálogo, para que mexer no padrão não apague a variação.
 */
function carregar(idOuCaminho = 'light', vistos = []) {
  const bruto = lerArquivo(idOuCaminho);

  const erros = contraEsquema(bruto, ESQUEMA, ESQUEMA);
  if (erros.length) { const e = new Error(`tema "${idOuCaminho}" inválido`); e.erros = erros; throw e; }

  if (vistos.includes(bruto.id)) {
    const e = new Error('ciclo de herança entre temas');
    e.erros = [[...vistos, bruto.id].join(' -> ')];
    throw e;
  }

  let base = PADRAO[bruto.background];
  if (bruto.inherits) {
    const pai = carregar(bruto.inherits, [...vistos, bruto.id]);
    if (pai.background !== bruto.background) {
      const e = new Error(`tema "${bruto.id}" herda de "${bruto.inherits}", que tem outro fundo`);
      e.erros = [`${bruto.background} != ${pai.background} — herdar através do interruptor normativo carregaria a tinta errada`];
      throw e;
    }
    base = pai.tokens;
  }

  // `fundir` traz junto as chaves de identidade do arquivo; elas não são token e
  // não devem viajar dentro de `panlabsTema` fingindo que são. `fundo` fica: é o
  // interruptor normativo, e sem ele o payload não se reconstrói.
  const { schema, id, label, because, inherits, ...tokens } = fundir(base, bruto);
  return montar(bruto, tokens);
}

// -------------------------------------------------------- tokens -> style

/** Aplica um mapa de chaves a uma style string preservando a ordem das demais. */
function aplicar(style, chaves) {
  let s = style;
  for (const [k, v] of Object.entries(chaves)) if (v !== undefined && v !== null) s = setChave(s, k, v);
  return s;
}

const FLUXO = {
  solid: {},
  dashed: { dashed: 1, dashPattern: '8 5' },
  // #4 §2.6 mediu e o #11 confirmou: `flowAnimation` sobrevive a SVG e HTML,
  // NUNCA a PNG — lá vira um tracejado estático, sem erro nenhum.
  animated: { dashed: 1, dashPattern: '8 5', flowAnimation: 1 },
};

function montar(bruto, t) {
  const norm = NORMATIVO[t.background];
  const g = n => Math.round(n * t.gap.base * t.gap.density);

  /**
   * MÉTRICA DE TEXTO — e é aqui que fica claro que o tema NÃO é downstream do
   * layout. `resolve.cjs` calibrou 6,7 px/caractere e 17 px/linha contra
   * `fontSize=12`; mudar o corpo muda a caixa reservada, que muda o vão, que
   * muda a geometria. Ver tools/check-partition.cjs, que separa os tokens que
   * movem coordenada dos que só pintam — e prova a separação gerando.
   */
  const porPt = pt => 6.7 * (pt / 12);
  const metrica = {
    largCar: porPt(t.text.label),
    altLinha: 17 * (t.text.label / 12),
    largCarAresta: porPt(t.text.edge),
    largCarGrupo: porPt(t.text.group),
  };

  const api = {
    id: bruto.id, label: bruto.label, because: bruto.because || '',
    background: t.background, tokens: t, normativo: norm, metrica,
    /** Folga em degraus da grade base, já com a densidade aplicada. */
    g,
    /** Calha: reserva de rótulo. NÃO leva densidade — ver o esquema. */
    calha: n => Math.round(n * t.gap.base),

    /**
     * Grupo (container). O tema pinta APENAS a tinta do rótulo e a fonte.
     * `strokeColor`, `dashed` e o ícone continuam sendo do catálogo, porque são
     * a camada normativa — e por isso não existe token para eles.
     *
     * A tinta do rótulo é a decisão que o #17 empurrou para cá, e ela se resolve
     * por medição, não por gosto: borda de grupo é grafismo (WCAG 1.4.11, 3:1) e
     * rótulo é texto (1.4.3, 4,5:1). Dois limiares diferentes não cabem na mesma
     * cor. "Rótulo herda a cor da borda" é a leitura que não sobrevive a nenhuma
     * troca de fundo; "rótulo é tinta neutra" é a do deck (#5 §2.1: 12 pt Arial,
     * cor `tx1`).
     */
    group(style, title) {
      const chaves = {
        fontColor: t.ink.strong,
        fontFamily: t.text.family,
        fontSize: t.text.group,
      };
      /**
       * TINGIMENTO — e note de onde vem cada metade da decisão.
       *
       * QUAIS grupos são tingidos é fato do CATÁLOGO: o draw.io entrega duas subnets
       * com fill e as outras 18 com `none`, e o tema não tem palavra para mudar esse
       * conjunto. O VALOR é derivado da própria cor normativa daquele grupo sobre o
       * fundo da página — então o tingimento não pode inventar significado: ele é a
       * cor que já estava lá, a 10%.
       *
       * Que essa derivação é MESMO a do produto, e não uma invenção nossa, está
       * medido: 10% de `#00A4A6` sobre branco dá `#E6F6F6` contra o `#E6F6F7` que o
       * draw.io entrega, e 10% de `#7AA116` dá `#F2F6E8` exato.
       *
       * Sem derivar, o tema escuro quebra: o `#E6F6F7` fixo do produto vira um bloco
       * luminoso no fundo escuro, e o rótulo branco de quem cai dentro dele some.
       */
      const fill = (/(?:^|;)fillColor=([^;]*)/.exec(style) || [])[1];
      if (fill && fill !== 'none') {
        chaves.fillColor = t.group.tint === 'none' ? 'none'
          : misturar((/(?:^|;)strokeColor=(#[0-9A-Fa-f]{6})/.exec(style) || [])[1] || t.ink.strong,
                     t.page.color, TINGIMENTO);
      }
      // a única cor de grupo que o deck escuro inverte (#5 §2.1 leitura 2)
      if (/^AWS Cloud/i.test(title || '')) { chaves.strokeColor = norm.cloud; chaves.fontColor = norm.cloud; }
      return aplicar(style, chaves);
    },

    /** Folha AWS: fonte e tinta. A cor do quadrado é da categoria — intocável. */
    service(style, input) {
      const chaves = { fontColor: t.ink.strong, fontFamily: t.text.family, fontSize: t.text.label };
      /**
       * `strokeColor` num shape aws4 pinta o GLIFO, não a borda (#4 §3.2). Nos
       * ícones monocromáticos é o `fillColor` que carrega o traço, e é ele que a
       * AWS entrega em duas variantes.
       *
       * ⚠️ E o tema INVERTE, não reafirma. No deck claro o catálogo já é a
       * variante clara: reescrever o `fillColor` com a nossa constante repinta o
       * ícone por nada — e "por nada" aqui foi literalmente um dígito. O
       * `A2.3` do validador (#18) pegou na recertificação do #23: o "Users" do
       * catálogo pinta `#232F3D` e a constante `NORMATIVO.claro.mono` diz
       * `#232F3E`. Na tela é a mesma tinta; na checagem é o tema alterando cor
       * de ícone, que é exatamente o que o `A2.3` existe para proibir.
       *
       * Enquanto o motor e o validador rodavam separados, ninguém tinha visto.
       */
      if (input && PALETAS_MONO.has(input.palette) && t.background === 'dark')
        chaves.fillColor = norm.mono;
      return aplicar(style, chaves);
    },

    /** Faixa derivada (AZ, Auto Scaling): halo no rótulo, que nasce sobre borda alheia. */
    band(style) {
      return aplicar(style, {
        fontColor: t.ink.strong, fontFamily: t.text.family, fontSize: t.text.group,
        labelBackgroundColor: t.ink.halo,
      });
    },

    /**
     * Faixa DEGRADADA (#31): quando a caixa da união abraçaria um não-membro
     * junto dos membros, a faixa para de afirmar contenção — não existe caixa
     * que abrace só quem é dela sem também abraçar quem não é. Mesmo recurso
     * do rótulo de OU (`ou()`, algumas linhas abaixo): par texto solto, sem
     * forma, no lugar onde a caixa desenharia a borda.
     */
    faixaRotulo: () => `text;html=1;fontSize=${t.text.group};fontStyle=1;fontColor=${t.ink.strong};` +
      `fontFamily=${t.text.family};align=left;verticalAlign=middle;`,

    /** Aresta. N9/A11 do #5: a seta oficial é SEMPRE sólida — tracejado paga dívida. */
    edge(extra = {}) {
      const base = {
        edgeStyle: 'orthogonalEdgeStyle', html: 1, jettySize: 'auto', orthogonalLoop: 1,
        rounded: t.edge.corners > 0 ? 1 : 0,
        strokeColor: t.edge.color, strokeWidth: t.edge.thickness,
        endArrow: t.edge.tip, endFill: t.edge.tip === 'open' ? 0 : 1, endSize: 6,
        fontSize: t.text.edge, fontFamily: t.text.family, fontColor: t.ink.strong,
        labelBackgroundColor: t.ink.halo,
        ...(t.edge.corners > 0 ? { arcSize: t.edge.corners } : {}),
        ...(t.edge.jumps !== 'none' ? { jumpStyle: t.edge.jumps, jumpSize: 6 } : {}),
        ...FLUXO[t.edge.flow],
        ...extra,
      };
      return Object.entries(base).map(([k, v]) => `${k}=${v}`).join(';') + ';';
    },

    title: () => `text;html=1;fontSize=${t.text.title};fontStyle=1;fontColor=${t.ink.strong};` +
      `fontFamily=${t.text.family};align=left;verticalAlign=middle;`,
    subtitle: () => `text;html=1;fontSize=${t.text.subtitle};fontColor=${t.ink.weak};` +
      `fontFamily=${t.text.family};align=left;verticalAlign=middle;`,
    revision: () => `text;html=1;fontSize=${Math.max(9, t.text.subtitle - 2)};fontColor=${t.ink.weak};` +
      `fontFamily=${t.text.family};align=left;verticalAlign=middle;`,
    note: () => `rounded=0;whiteSpace=wrap;html=1;fillColor=${t.note.background};strokeColor=${t.note.edge};` +
      `fontColor=${t.note.ink};fontFamily=${t.text.family};fontSize=${Math.max(9, t.text.label - 1)};` +
      `align=left;verticalAlign=top;spacing=8;dashed=0;`,
    block: () => `rounded=${t.block.corners > 0 ? 1 : 0};arcSize=${t.block.corners};whiteSpace=wrap;html=1;` +
      `fillColor=${t.block.background};strokeColor=${t.block.edge};fontColor=${t.ink.strong};` +
      `fontFamily=${t.text.family};fontSize=${t.text.label};verticalAlign=middle;align=center;strokeWidth=1.5;`,

    /**
     * As QUATRO CÉLULAS DO #12 — e elas entram aqui sem abrir uma palavra nova
     * no vocabulário. É a régua do próprio #13: só se abre um token quando ele
     * comprova que o vocabulário existente não alcança o significado. Aqui
     * alcança, e a prova é aritmética — no tema `claro` os quatro literais que o
     * #12 escreveu à mão reconstroem token a token:
     *
     *   S_OU          #232F3E = tinta.forte    · 13 pt = texto.grupo + 1
     *   S_BARRAMENTO  #232F3E = aresta.cor     · 1.6 = aresta.espessura
     *   S_STUB        #FFFFFF = tinta.halo     · 10 pt = texto.aresta
     *   S_HABILITA    #5A6C86 = tinta.fraca
     *
     * Ou seja: o #12 já estava usando os tokens do #13 sem saber — escrevendo os
     * valores deles. Isso não é coincidência, é a mesma paleta normativa nas
     * duas pontas. Quem confere é `tests/check-tokens-of-12.cjs`.
     *
     * E é por isso que fica aqui e não em `plan.cjs`: com o hex lá dentro, o
     * deck escuro desenhava um barramento `#232F3E` sobre um fundo `#1C1C1C`.
     */

    /**
     * Rótulo de OU. Não é caixa — o deck não tem shape de Organizational unit
     * (#6 G1), então é par ícone+rótulo flutuando acima do primeiro membro. Um
     * degrau acima do rótulo de grupo, que é a relação que o #12 escreveu.
     */
    ou: () => `text;html=1;fontSize=${t.text.group + 1};fontStyle=1;fontColor=${t.ink.strong};` +
      `fontFamily=${t.text.family};align=left;verticalAlign=middle;`,

    /** `E4`/`X3`: a linha do barramento. Sem ponta — quem tem ponta é o stub. */
    barramento: () => `endArrow=none;html=1;strokeColor=${t.edge.color};` +
      `strokeWidth=${t.edge.thickness};`,

    /** O stub perpendicular que entra na conta, e a aresta agregada do `E3`. */
    stub: () => `edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=${t.edge.color};` +
      `strokeWidth=${t.edge.thickness};endArrow=${t.edge.tip};` +
      `endFill=${t.edge.tip === 'open' ? 0 : 1};endSize=6;fontSize=${t.text.edge};` +
      `fontFamily=${t.text.family};fontColor=${t.ink.strong};labelBackgroundColor=${t.ink.halo};`,

    /**
     * `E9`: habilitador de permissão é seta CURTA para dentro de quem autoriza,
     * nunca rótulo de aresta. Tinta fraca porque é anexo, não fluxo — a mesma
     * distinção que o subtítulo faz no bloco de título.
     */
    habilitador: () => `edgeStyle=orthogonalEdgeStyle;html=1;strokeColor=${t.ink.weak};` +
      `strokeWidth=1.4;dashed=1;dashPattern=6 4;endArrow=${t.edge.tip};` +
      `endFill=${t.edge.tip === 'open' ? 0 : 1};endSize=6;`,

    /**
     * O rótulo da folha. `qualificador` é o O21 do #5 — "Amazon Route 53 /
     * *DNS service*" —, forte em 4 corpora: o nome diz o que É, o itálico diz o
     * que faz ALI. Custa uma segunda linha, e a linha é métrica, não pintura.
     */
    rotuloDeFolha(name, qualifier) {
      if (!t.text.qualifier || !qualifier) return name;
      return `${name}<br><i>${qualifier}</i>`;
    },
  };
  return api;
}

/**
 * Um tema com um token trocado, sem passar por arquivo. Existe para
 * `tools/check-partition.cjs` poder perturbar um token de cada vez e medir se a
 * geometria se mexe — que é como a partição pintura/métrica deixa de ser
 * afirmação e vira checagem.
 */
function comPatch(base, patch) {
  const b = typeof base === 'string' ? carregar(base) : base;
  const tokens = fundir(b.tokens, patch);
  return montar({ id: b.id + '+patch', label: b.label, because: b.because }, tokens);
}

function listar() {
  return fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'schema.json')
    .map(f => f.replace(/\.json$/, '')).sort();
}

module.exports = { carregar, comPatch, listar, misturar, ESQUEMA, PADRAO, NORMATIVO, PALETAS_MONO, TINGIMENTO };
