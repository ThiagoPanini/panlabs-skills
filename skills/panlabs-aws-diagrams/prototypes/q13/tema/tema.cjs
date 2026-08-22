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
 *  3. A régua (tools/medir-regua.cjs) mostrou que a paleta AWS é calibrada para
 *     branco puro: `#ED7100` só alcança 3:1 contra `#FFFFFF`. Portanto `fundo` é
 *     um INTERRUPTOR de dois estados, não um seletor de cor — e o segundo estado
 *     é o deck escuro que a própria AWS publica (#5 F3).
 */

const fs = require('fs');
const path = require('path');

const { contraEsquema } = require('../motor/validar.cjs');
const { setChave } = require('../../../catalog/aws-shapes.cjs');

const ESQUEMA = JSON.parse(fs.readFileSync(path.join(__dirname, 'esquema.json'), 'utf8'));
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
  claro:  { nuvem: '#232F3E', mono: '#232F3E', callout: { fundo: '#232F3E', tinta: '#FFFFFF' } },
  escuro: { nuvem: '#FFFFFF', mono: '#FFFFFF', callout: { fundo: '#FFFFFF', tinta: '#232F3E' } },
};

const PADRAO = {
  claro: {
    pagina: { cor: '#FFFFFF', margem: 32 },
    tinta:  { forte: '#232F3E', fraca: '#5A6C86', halo: '#FFFFFF' },
    texto:  { familia: 'Arial,Helvetica', rotulo: 12, grupo: 12, aresta: 10, titulo: 19, subtitulo: 12, qualificador: false },
    aresta: { cor: '#232F3E', espessura: 1.6, ponta: 'blockThin', cantos: 12, saltos: 'arc', fluxo: 'solido' },
    folga:  { base: 8, densidade: 1.0 },
    nota:   { fundo: '#FFF8E1', borda: '#B7791F', tinta: '#6B4E00' },
    bloco:  { fundo: '#FFFFFF', borda: '#232F3E', cantos: 12 },
    cartao: { revisao: null },
  },
  escuro: {
    pagina: { cor: '#161E2D', margem: 32 },
    // `#AEB9C6` e não `#AAB7B8`: o segundo é literalmente o cinza que o draw.io usa
    // como `fontColor` do VPC e que este ticket condenou por 2,06:1 no fundo claro.
    // Reaproveitá-lo como tinta secundária do tema escuro (onde ele mede 8,09:1 e
    // passaria) confunde duas coisas diferentes no mesmo hex — e torna impossível
    // afirmar no pixel que o rótulo cinza do VPC não sobrou em lugar nenhum.
    tinta:  { forte: '#FFFFFF', fraca: '#AEB9C6', halo: '#161E2D' },
    texto:  { familia: 'Arial,Helvetica', rotulo: 12, grupo: 12, aresta: 10, titulo: 19, subtitulo: 12, qualificador: false },
    aresta: { cor: '#E9EDF2', espessura: 1.6, ponta: 'blockThin', cantos: 12, saltos: 'arc', fluxo: 'solido' },
    folga:  { base: 8, densidade: 1.0 },
    nota:   { fundo: '#2E2718', borda: '#8A6D3B', tinta: '#F3DFAE' },
    bloco:  { fundo: '#1E2738', borda: '#FFFFFF', cantos: 12 },
    cartao: { revisao: null },
  },
};

// ------------------------------------------------------------------ carga

function fundir(base, sobre) {
  const out = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(sobre || {})])) {
    const a = base[k], b = (sobre || {})[k];
    out[k] = (a && typeof a === 'object' && !Array.isArray(a)) ? fundir(a, b || {}) : (b === undefined ? a : b);
  }
  return out;
}

function lerArquivo(idOuCaminho) {
  const p = idOuCaminho.endsWith('.json') ? idOuCaminho : path.join(DIR, idOuCaminho + '.json');
  if (!fs.existsSync(p)) {
    const disponiveis = fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'esquema.json')
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
function carregar(idOuCaminho = 'claro', vistos = []) {
  const bruto = lerArquivo(idOuCaminho);

  const erros = contraEsquema(bruto, ESQUEMA, ESQUEMA);
  if (erros.length) { const e = new Error(`tema "${idOuCaminho}" inválido`); e.erros = erros; throw e; }

  if (vistos.includes(bruto.id)) {
    const e = new Error('ciclo de herança entre temas');
    e.erros = [[...vistos, bruto.id].join(' -> ')];
    throw e;
  }

  let base = PADRAO[bruto.fundo];
  if (bruto.herda) {
    const pai = carregar(bruto.herda, [...vistos, bruto.id]);
    if (pai.fundo !== bruto.fundo) {
      const e = new Error(`tema "${bruto.id}" herda de "${bruto.herda}", que tem outro fundo`);
      e.erros = [`${bruto.fundo} != ${pai.fundo} — herdar através do interruptor normativo carregaria a tinta errada`];
      throw e;
    }
    base = pai.tokens;
  }

  // `fundir` traz junto as chaves de identidade do arquivo; elas não são token e
  // não devem viajar dentro de `panlabsTema` fingindo que são. `fundo` fica: é o
  // interruptor normativo, e sem ele o payload não se reconstrói.
  const { esquema, id, rotulo, porque, herda, ...tokens } = fundir(base, bruto);
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
  solido: {},
  tracejado: { dashed: 1, dashPattern: '8 5' },
  // #4 §2.6 mediu e o #11 confirmou: `flowAnimation` sobrevive a SVG e HTML,
  // NUNCA a PNG — lá vira um tracejado estático, sem erro nenhum.
  animado: { dashed: 1, dashPattern: '8 5', flowAnimation: 1 },
};

function montar(bruto, t) {
  const norm = NORMATIVO[t.fundo];
  const g = n => Math.round(n * t.folga.base * t.folga.densidade);

  /**
   * MÉTRICA DE TEXTO — e é aqui que fica claro que o tema NÃO é downstream do
   * layout. `resolver.cjs` calibrou 6,7 px/caractere e 17 px/linha contra
   * `fontSize=12`; mudar o corpo muda a caixa reservada, que muda o vão, que
   * muda a geometria. Ver tools/check-particao.cjs, que separa os tokens que
   * movem coordenada dos que só pintam — e prova a separação gerando.
   */
  const porPt = pt => 6.7 * (pt / 12);
  const metrica = {
    largCar: porPt(t.texto.rotulo),
    altLinha: 17 * (t.texto.rotulo / 12),
    largCarAresta: porPt(t.texto.aresta),
    largCarGrupo: porPt(t.texto.grupo),
  };

  const api = {
    id: bruto.id, rotulo: bruto.rotulo, porque: bruto.porque || '',
    fundo: t.fundo, tokens: t, normativo: norm, metrica,
    /** Folga em degraus da grade base, já com a densidade aplicada. */
    g,
    /** Calha: reserva de rótulo. NÃO leva densidade — ver o esquema. */
    calha: n => Math.round(n * t.folga.base),

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
    grupo(style, titulo) {
      const chaves = {
        fontColor: t.tinta.forte,
        fontFamily: t.texto.familia,
        fontSize: t.texto.grupo,
      };
      // a única cor de grupo que o deck escuro inverte (#5 §2.1 leitura 2)
      if (/^AWS Cloud/i.test(titulo || '')) { chaves.strokeColor = norm.nuvem; chaves.fontColor = norm.nuvem; }
      return aplicar(style, chaves);
    },

    /** Folha AWS: fonte e tinta. A cor do quadrado é da categoria — intocável. */
    servico(style, entrada) {
      const chaves = { fontColor: t.tinta.forte, fontFamily: t.texto.familia, fontSize: t.texto.rotulo };
      // `strokeColor` num shape aws4 pinta o GLIFO, não a borda (#4 §3.2). Nos
      // ícones monocromáticos é o `fillColor` que carrega o traço, e é ele que
      // a AWS entrega em duas variantes.
      if (entrada && PALETAS_MONO.has(entrada.palette)) chaves.fillColor = norm.mono;
      return aplicar(style, chaves);
    },

    /** Faixa derivada (AZ, Auto Scaling): halo no rótulo, que nasce sobre borda alheia. */
    faixa(style) {
      return aplicar(style, {
        fontColor: t.tinta.forte, fontFamily: t.texto.familia, fontSize: t.texto.grupo,
        labelBackgroundColor: t.tinta.halo,
      });
    },

    /** Aresta. N9/A11 do #5: a seta oficial é SEMPRE sólida — tracejado paga dívida. */
    aresta(extra = {}) {
      const base = {
        edgeStyle: 'orthogonalEdgeStyle', html: 1, jettySize: 'auto', orthogonalLoop: 1,
        rounded: t.aresta.cantos > 0 ? 1 : 0,
        strokeColor: t.aresta.cor, strokeWidth: t.aresta.espessura,
        endArrow: t.aresta.ponta, endFill: t.aresta.ponta === 'open' ? 0 : 1, endSize: 6,
        fontSize: t.texto.aresta, fontFamily: t.texto.familia, fontColor: t.tinta.forte,
        labelBackgroundColor: t.tinta.halo,
        ...(t.aresta.cantos > 0 ? { arcSize: t.aresta.cantos } : {}),
        ...(t.aresta.saltos !== 'none' ? { jumpStyle: t.aresta.saltos, jumpSize: 6 } : {}),
        ...FLUXO[t.aresta.fluxo],
        ...extra,
      };
      return Object.entries(base).map(([k, v]) => `${k}=${v}`).join(';') + ';';
    },

    titulo: () => `text;html=1;fontSize=${t.texto.titulo};fontStyle=1;fontColor=${t.tinta.forte};` +
      `fontFamily=${t.texto.familia};align=left;verticalAlign=middle;`,
    subtitulo: () => `text;html=1;fontSize=${t.texto.subtitulo};fontColor=${t.tinta.fraca};` +
      `fontFamily=${t.texto.familia};align=left;verticalAlign=middle;`,
    revisao: () => `text;html=1;fontSize=${Math.max(9, t.texto.subtitulo - 2)};fontColor=${t.tinta.fraca};` +
      `fontFamily=${t.texto.familia};align=left;verticalAlign=middle;`,
    nota: () => `rounded=0;whiteSpace=wrap;html=1;fillColor=${t.nota.fundo};strokeColor=${t.nota.borda};` +
      `fontColor=${t.nota.tinta};fontFamily=${t.texto.familia};fontSize=${Math.max(9, t.texto.rotulo - 1)};` +
      `align=left;verticalAlign=top;spacing=8;dashed=0;`,
    bloco: () => `rounded=${t.bloco.cantos > 0 ? 1 : 0};arcSize=${t.bloco.cantos};whiteSpace=wrap;html=1;` +
      `fillColor=${t.bloco.fundo};strokeColor=${t.bloco.borda};fontColor=${t.tinta.forte};` +
      `fontFamily=${t.texto.familia};fontSize=${t.texto.rotulo};verticalAlign=middle;align=center;strokeWidth=1.5;`,

    /**
     * O rótulo da folha. `qualificador` é o O21 do #5 — "Amazon Route 53 /
     * *DNS service*" —, forte em 4 corpora: o nome diz o que É, o itálico diz o
     * que faz ALI. Custa uma segunda linha, e a linha é métrica, não pintura.
     */
    rotuloDeFolha(nome, qualificador) {
      if (!t.texto.qualificador || !qualificador) return nome;
      return `${nome}<br><i>${qualificador}</i>`;
    },
  };
  return api;
}

/**
 * Um tema com um token trocado, sem passar por arquivo. Existe para
 * `tools/check-particao.cjs` poder perturbar um token de cada vez e medir se a
 * geometria se mexe — que é como a partição pintura/métrica deixa de ser
 * afirmação e vira checagem.
 */
function comPatch(base, patch) {
  const b = typeof base === 'string' ? carregar(base) : base;
  const tokens = fundir(b.tokens, patch);
  return montar({ id: b.id + '+patch', rotulo: b.rotulo, porque: b.porque }, tokens);
}

function listar() {
  return fs.readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'esquema.json')
    .map(f => f.replace(/\.json$/, '')).sort();
}

module.exports = { carregar, comPatch, listar, ESQUEMA, PADRAO, NORMATIVO, PALETAS_MONO };
