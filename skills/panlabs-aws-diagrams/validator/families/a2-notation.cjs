'use strict';
/**
 * A2 · Notação, consistência e vocabulário.
 *
 * A rubrica coloca esta família em 5º na ordem de implementação, mas anota que
 * é onde os cinco guias — C4, AWS deck, Azure WAF, Azure Icons, IBM — concordam
 * sem exceção. É a família mais barata de satisfazer e a mais fácil de quebrar
 * sem perceber, porque cada violação isolada parece inofensiva.
 */

const path = require('path');
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, aviso, falha, notApplicable, pulada, conforme, arredonda, semTags, name } = require(path.join(__dirname, 'common.cjs'));
const { catalog, preenchimentoDe, stencilDe } = require(path.join(__dirname, 'catalog.cjs'));


/** Pontas de seta que os presets do deck AWS cobrem. */
const SETAS_PRESET = new Set(['none', 'block', 'blockThin', 'open', 'openThin', 'classic', 'classicThin', 'oval', 'diamond', 'diamondThin', 'halfCircle', 'baseDash', 'ERone', 'ERmandOne']);

/** Marcas de chartjunk: efeito que não carrega dado. */
const CHARTJUNK = [
  ['shadow', e => e.style.shadow === '1', 'sombra'],
  ['glass', e => e.style.glass === '1', 'brilho de vidro'],
  ['sketch', e => e.style.sketch === '1', 'traço rascunhado'],
  ['gradiente', e => e.style.gradientColor && e.style.gradientColor !== 'none', 'gradiente'],
  ['perspectiva', e => e.style.shape === 'cube' || e.style.isometric === '1', 'perspectiva/isometria'],
];

module.exports = function a2(cena) {
  const output = [];
  const cat = catalog();
  const { nodes, grupos, bands, edges } = cena;
  const desenhaveis = [...nodes, ...grupos, ...bands];

  // ---------------------------------------------------------------- A2.1
  // Conta TIPOS de símbolo, não instâncias — "vinte Lambdas = 1 entrada".
  {
    const simbolos = new Set(desenhaveis.map(e =>
      [e.preenchimento, e.traco, e.style.dashed === '1' ? 'dashed' : 'solid', e.style.shape || (e.style.container === '1' ? 'container' : 'caixa')].join('|')));
    for (const a of edges) simbolos.add(['edge', a.style.strokeColor, a.style.dashed === '1' ? 'dashed' : 'solid', a.style.endArrow].join('|'));
    const n = simbolos.size;
    const target = lim('complexidadeGraficaAlvo');
    const teto = lim('complexidadeGraficaFalha');
    const medida = { entradas_necessarias: n, target, teto };
    output.push(n <= target ? ok('A2.1', { medida, mensagem: `${n} tipo(s) de símbolo (alvo ≤ ${target})` })
      : n <= teto ? aviso('A2.1', { medida, mensagem: `${n} tipos de símbolo — acima do alvo de ${target}, ainda dentro de ${teto}`, occurrences: [{ o_que: `a legenda precisaria de ${n} entradas`, ids: [] }] })
        : falha('A2.1', { medida, mensagem: `${n} tipos de símbolo — acima do limite de ${teto} (span of absolute judgement)`, occurrences: [{ o_que: `a legenda precisaria de ${n} entradas; Moody põe o teto efetivo em ${target}`, ids: [] }] }));
  }

  // ---------------------------------------------------------------- A2.2
  {
    const casos = [];
    for (const e of desenhaveis) {
      const s = e.style;
      const deformacoes = [];
      if (s.flipH === '1') deformacoes.push('espelhado na horizontal');
      if (s.flipV === '1') deformacoes.push('espelhado na vertical');
      if (s.rotation && parseFloat(s.rotation) !== 0) deformacoes.push(`girado ${s.rotation}°`);
      if (s.direction && s.direction !== 'east') deformacoes.push(`direção "${s.direction}"`);
      if (deformacoes.length) casos.push({ o_que: `${name(e)} está ${deformacoes.join(' e ')}`, ids: [e.id] });
    }
    output.push(conforme('A2.2', casos, { medida: { objetos: desenhaveis.length, deformados: casos.length } }));
  }

  // ---------------------------------------------------------------- A2.3
  {
    if (!cat) output.push(notApplicable('A2.3', 'o catálogo de shapes não está disponível'));
    else if (!cena.modelo) output.push(notApplicable('A2.3', 'o plano não carrega o modelo, então não há como saber que serviço cada nó pediu'));
    else {
      const porIdModelo = new Map((cena.modelo.nodes || []).map(n => [n.id, n]));
      const casos = [];
      let conferidos = 0;
      for (const e of nodes) {
        const m = porIdModelo.get(e.id);
        const chave = m && (m.service || (m.kind === 'actor' ? 'users' : null));
        if (!chave) continue;
        const oficial = cat.service(chave);
        if (!oficial) continue;
        conferidos++;
        const esperado = preenchimentoDe(oficial.style);
        if (esperado && e.preenchimento && esperado.toLowerCase() !== e.preenchimento.toLowerCase())
          casos.push({ o_que: `${name(e)} pinta ${e.preenchimento} e o catálogo prescreve ${esperado} para "${oficial.title}"`, ids: [e.id] });
      }
      output.push(conforme('A2.3', casos, {
        medida: { conferidos, divergentes: casos.length },
        mensagem: `${conferidos} ícone(s) conferido(s) contra a cor declarada no catálogo — o hash de pixel é do render`,
      }));
    }
  }

  // ---------------------------------------------------------------- A2.4
  {
    if (!cat) output.push(notApplicable('A2.4', 'o catálogo de shapes não está disponível'));
    else {
      const casos = [];
      let comStencil = 0;
      for (const e of nodes) {
        const id = stencilDe(e.estiloBruto);
        if (!id) continue;
        comStencil++;
        if (!cat.ids.has(id)) casos.push({ o_que: `${name(e)} usa o stencil "${id}", que não está no catálogo vigente`, ids: [e.id] });
      }
      output.push(conforme('A2.4', casos, {
        medida: { com_stencil: comStencil, fora_do_catalogo: casos.length, vigencia: cat.vigencia },
        mensagem: `catálogo de ${cat.vigencia || 'data desconhecida'}; ${comStencil} ícone(s) com stencil declarado`,
      }));
    }
  }

  // ---------------------------------------------------------------- A2.5
  {
    const porClasse = new Map();
    for (const e of nodes) {
      const classe = e.tipoSemantico || 'desconhecido';
      if (!porClasse.has(classe)) porClasse.set(classe, []);
      porClasse.get(classe).push(e);
    }
    const casos = [];
    for (const [classe, lista] of porClasse) {
      if (lista.length < 2) continue;
      const larguras = lista.map(e => e.caixa.w);
      const razao = Math.max(...larguras) / Math.min(...larguras);
      if (razao !== 1)
        casos.push({ o_que: `a classe "${classe}" usa larguras de ${Math.min(...larguras)} a ${Math.max(...larguras)} px (razão ${arredonda(razao, 2)})`, ids: lista.map(e => e.id) });
    }
    output.push(porClasse.size ? conforme('A2.5', casos, { medida: { classes: porClasse.size, irregulares: casos.length } })
      : notApplicable('A2.5', 'o diagrama não tem nós'));
  }

  // ---------------------------------------------------------------- A2.6
  {
    const canais = ['fillColor', 'strokeColor', 'strokeWidth', 'dashed', 'shape'];
    // "Para cada `type`" é o tipo do ELEMENTO — Lambda, RDS, subnet pública —,
    // não o tipo grosso do modelo. Errar a granularidade quebra A2.6 nos dois
    // sentidos, e as duas versões erradas já apareceram medindo:
    //
    //   grosso demais (`tipo` do modelo): todo `servico` num balde só, e a
    //   checagem reprova a paleta oficial da AWS, em que cada serviço TEM a sua
    //   cor. Ela existe para pegar dois Lambdas de cores diferentes.
    //
    //   fino demais mas pelo lugar errado (o stencil): subnet pública e privada
    //   compartilham o stencil `group_security_group` e são tipos DIFERENTES,
    //   com cores diferentes de propósito — e a checagem acusa a convenção.
    //
    // A chave certa está no modelo, que é quem sabe o que discrimina o tipo:
    // o `tipo` mais os campos que o especializam (`servico`, `acesso`).
    const tipoDe = (e) => {
      const m = e.noModelo;
      if (m && m.kind) return [m.kind, m.service, m.access].filter(Boolean).join('/');
      return stencilDe(e.estiloBruto) || e.tipoSemantico || 'desconhecido';
    };
    const porTipo = new Map();
    for (const e of [...nodes, ...grupos]) {
      const t = tipoDe(e);
      if (!porTipo.has(t)) porTipo.set(t, []);
      porTipo.get(t).push(e);
    }
    const casos = [];
    for (const [kind, lista] of porTipo) {
      if (lista.length < 2) continue;
      for (const canal of canais) {
        const valores = new Set(lista.map(e => e.style[canal] === undefined ? '(ausente)' : e.style[canal]));
        if (valores.size > 1)
          casos.push({ o_que: `o tipo "${kind}" usa ${valores.size} valores de ${canal}: ${[...valores].join(', ')}`, ids: lista.map(e => e.id) });
      }
    }
    output.push(porTipo.size ? conforme('A2.6', casos, { medida: { tipos: porTipo.size, inconsistencias: casos.length } })
      : notApplicable('A2.6', 'o diagrama não tem elementos tipados'));
  }

  // ---------------------------------------------------------------- A2.7
  {
    if (!edges.length) output.push(notApplicable('A2.7', 'o diagrama não tem arestas'));
    else {
      // O significado de uma relação é o TIPO DE RELAÇÃO que o modelo declara —
      // aqui, `protocolo`. Derivar significado do par de tipos das pontas seria
      // inventar taxonomia: "ator→servico" e "servico→servico" não são dois
      // sentidos de linha, são duas posições no grafo, e reprovar por isso
      // acusaria de ambíguo todo diagrama com mais de um formato de nó.
      // Arestas que não declaram tipo ficam de fora: ausência não é ambiguidade.
      const modelo = cena.modelo || {};
      const tipoDeclarado = new Map((modelo.edges || [])
        .map(a => [`${a.from}→${a.to}`, a.protocol || a.kind || null]));
      const comTipo = edges.filter(a => tipoDeclarado.get(`${a.from}→${a.to}`));
      const porEstilo = new Map();
      const porSignificado = new Map();
      for (const a of comTipo) {
        const style = a.style.dashed === '1' ? `tracejado(${a.style.dashPattern || 'padrão'})` : 'solid';
        const significado = tipoDeclarado.get(`${a.from}→${a.to}`);
        if (!porEstilo.has(style)) porEstilo.set(style, new Set());
        porEstilo.get(style).add(significado);
        if (!porSignificado.has(significado)) porSignificado.set(significado, new Set());
        porSignificado.get(significado).add(style);
      }
      if (porSignificado.size < 2) {
        output.push(notApplicable('A2.7', comTipo.length
          ? 'só há um tipo de relação declarado — não há bijeção a conferir'
          : 'nenhuma aresta declara tipo de relação (protocolo); sem taxonomia não há o que mapear'));
      } else {
        const casos = [];
        for (const [style, significados] of porEstilo)
          if (significados.size > 1) casos.push({ o_que: `o traço "${style}" carrega ${significados.size} significados: ${[...significados].join(', ')}`, ids: comTipo.map(a => a.id) });
        for (const [significado, estilos] of porSignificado)
          if (estilos.size > 1) casos.push({ o_que: `a relação "${significado}" é desenhada de ${estilos.size} jeitos: ${[...estilos].join(', ')}`, ids: [] });
        output.push(conforme('A2.7', casos, { medida: { estilos: porEstilo.size, significados: [...porSignificado.keys()], quebras_de_bijecao: casos.length } }));
      }
    }
  }

  // ---------------------------------------------------------------- A2.8
  {
    // Containment (nuvem, região, VPC, subnet) desenha sólido; zona lógica
    // (AZ, Auto Scaling) desenha tracejado. É o mapa do IBM, e a rubrica avisa
    // que a AWS não publica o dela como norma — daí ser `warn`.
    // `regiao` fica de fora de propósito: a AWS desenha Region com borda
    // TRACEJADA no próprio deck, e o catálogo reproduz isso. Ela é fronteira
    // geográfica, não fronteira de rede — mesma família das zonas.
    const contencao = new Set(['cloud', 'account', 'vpc', 'subnet', 'security-group']);
    const casos = [];
    for (const e of grupos) {
      const t = e.tipoSemantico;
      if (!t || !contencao.has(t)) continue;
      if (e.style.dashed === '1') casos.push({ o_que: `o grupo de contenção "${e.id}" (${t}) desenha tracejado, e tracejado é convenção de zona`, ids: [e.id] });
    }
    for (const f of bands)
      if (f.style.dashed !== '1') casos.push({ o_que: `a faixa "${f.id}" desenha sólido, e sólido é convenção de contenção`, ids: [f.id] });
    output.push((grupos.length + bands.length) ? conforme('A2.8', casos, { medida: { grupos: grupos.length, bands: bands.length, fora_da_convencao: casos.length } })
      : notApplicable('A2.8', 'o diagrama não tem grupos nem faixas'));
  }

  // ---------------------------------------------------------------- A2.9
  output.push(pulada('A2.9'));

  // ---------------------------------------------------------------- A2.10
  {
    if (!edges.length) output.push(notApplicable('A2.10', 'o diagrama não tem arestas'));
    else {
      const casos = [];
      for (const a of edges)
        for (const tip of ['startArrow', 'endArrow']) {
          const v = a.style[tip];
          if (v === undefined) continue;
          if (!SETAS_PRESET.has(v)) casos.push({ o_que: `a aresta "${a.id}" usa ${tip}="${v}", fora dos presets`, ids: [a.id] });
        }
      output.push(conforme('A2.10', casos, { medida: { edges: edges.length, fora_dos_presets: casos.length } }));
    }
  }

  // ---------------------------------------------------------------- A2.11
  {
    const casos = [];
    for (const e of [...desenhaveis, ...edges])
      for (const [, testa, comoSeChama] of CHARTJUNK)
        if (testa(e)) casos.push({ o_que: `${e.id} usa ${comoSeChama} — tinta que não carrega dado`, ids: [e.id] });
    output.push(conforme('A2.11', casos, { medida: { objetos: desenhaveis.length + edges.length, com_chartjunk: casos.length } }));
  }

  return output;
};
