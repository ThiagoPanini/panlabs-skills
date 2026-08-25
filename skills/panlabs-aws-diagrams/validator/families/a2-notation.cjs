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
const { ok, warning, failure, notApplicable, skipped, matches, roundTo, withoutTags, name } = require(path.join(__dirname, 'common.cjs'));
const { catalog, fillOf, stencilOf } = require(path.join(__dirname, 'catalog.cjs'));


/** Pontas de seta que os presets do deck AWS cobrem. */
const PRESET_ARROWS = new Set(['none', 'block', 'blockThin', 'open', 'openThin', 'classic', 'classicThin', 'oval', 'diamond', 'diamondThin', 'halfCircle', 'baseDash', 'ERone', 'ERmandOne']);

/** Marcas de chartjunk: efeito que não carrega dado. */
const CHARTJUNK = [
  ['shadow', e => e.style.shadow === '1', 'sombra'],
  ['glass', e => e.style.glass === '1', 'brilho de vidro'],
  ['sketch', e => e.style.sketch === '1', 'traço rascunhado'],
  ['gradiente', e => e.style.gradientColor && e.style.gradientColor !== 'none', 'gradiente'],
  ['perspectiva', e => e.style.shape === 'cube' || e.style.isometric === '1', 'perspectiva/isometria'],
];

module.exports = function a2(scene) {
  const output = [];
  const cat = catalog();
  const { nodes, grupos, bands, edges } = scene;
  const desenhaveis = [...nodes, ...grupos, ...bands];

  // ---------------------------------------------------------------- A2.1
  // Conta TIPOS de símbolo, não instâncias — "vinte Lambdas = 1 entrada".
  {
    const simbolos = new Set(desenhaveis.map(e =>
      [e.preenchimento, e.traco, e.style.dashed === '1' ? 'dashed' : 'solid', e.style.shape || (e.style.container === '1' ? 'container' : 'cellBox')].join('|')));
    for (const a of edges) simbolos.add(['edge', a.style.strokeColor, a.style.dashed === '1' ? 'dashed' : 'solid', a.style.endArrow].join('|'));
    const n = simbolos.size;
    const target = lim('complexidadeGraficaAlvo');
    const ceiling = lim('complexidadeGraficaFalha');
    const measured = { entradas_necessarias: n, target, ceiling };
    output.push(n <= target ? ok('A2.1', { measured, mensagem: `${n} tipo(s) de símbolo (alvo ≤ ${target})` })
      : n <= ceiling ? warning('A2.1', { measured, mensagem: `${n} tipos de símbolo — acima do alvo de ${target}, ainda dentro de ${ceiling}`, occurrences: [{ o_que: `a legenda precisaria de ${n} entradas`, ids: [] }] })
        : failure('A2.1', { measured, mensagem: `${n} tipos de símbolo — acima do limite de ${ceiling} (span of absolute judgement)`, occurrences: [{ o_que: `a legenda precisaria de ${n} entradas; Moody põe o teto efetivo em ${target}`, ids: [] }] }));
  }

  // ---------------------------------------------------------------- A2.2
  {
    const casos = [];
    for (const e of desenhaveis) {
      const s = e.style;
      const deformations = [];
      if (s.flipH === '1') deformations.push('espelhado na horizontal');
      if (s.flipV === '1') deformations.push('espelhado na vertical');
      if (s.rotation && parseFloat(s.rotation) !== 0) deformations.push(`girado ${s.rotation}°`);
      if (s.direction && s.direction !== 'east') deformations.push(`direção "${s.direction}"`);
      if (deformations.length) casos.push({ o_que: `${name(e)} está ${deformations.join(' e ')}`, ids: [e.id] });
    }
    output.push(matches('A2.2', casos, { measured: { objetos: desenhaveis.length, deformados: casos.length } }));
  }

  // ---------------------------------------------------------------- A2.3
  {
    if (!cat) output.push(notApplicable('A2.3', 'o catálogo de shapes não está disponível'));
    else if (!scene.model) output.push(notApplicable('A2.3', 'o plano não carrega o modelo, então não há como saber que serviço cada nó pediu'));
    else {
      const porIdModelo = new Map((scene.model.nodes || []).map(n => [n.id, n]));
      const casos = [];
      let conferidos = 0;
      for (const e of nodes) {
        const m = porIdModelo.get(e.id);
        const key = m && (m.service || (m.kind === 'actor' ? 'users' : null));
        if (!key) continue;
        const oficial = cat.service(key);
        if (!oficial) continue;
        conferidos++;
        const expected = fillOf(oficial.style);
        if (expected && e.preenchimento && expected.toLowerCase() !== e.preenchimento.toLowerCase())
          casos.push({ o_que: `${name(e)} pinta ${e.preenchimento} e o catálogo prescreve ${expected} para "${oficial.title}"`, ids: [e.id] });
      }
      output.push(matches('A2.3', casos, {
        measured: { conferidos, divergentes: casos.length },
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
        const id = stencilOf(e.estiloBruto);
        if (!id) continue;
        comStencil++;
        if (!cat.ids.has(id)) casos.push({ o_que: `${name(e)} usa o stencil "${id}", que não está no catálogo vigente`, ids: [e.id] });
      }
      output.push(matches('A2.4', casos, {
        measured: { com_stencil: comStencil, fora_do_catalogo: casos.length, vigencia: cat.vigencia },
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
    for (const [classe, list] of porClasse) {
      if (list.length < 2) continue;
      const larguras = list.map(e => e.cellBox.w);
      const ratio = Math.max(...larguras) / Math.min(...larguras);
      if (ratio !== 1)
        casos.push({ o_que: `a classe "${classe}" usa larguras de ${Math.min(...larguras)} a ${Math.max(...larguras)} px (razão ${roundTo(ratio, 2)})`, ids: list.map(e => e.id) });
    }
    output.push(porClasse.size ? matches('A2.5', casos, { measured: { classes: porClasse.size, irregulares: casos.length } })
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
      return stencilOf(e.estiloBruto) || e.tipoSemantico || 'desconhecido';
    };
    const porTipo = new Map();
    for (const e of [...nodes, ...grupos]) {
      const t = tipoDe(e);
      if (!porTipo.has(t)) porTipo.set(t, []);
      porTipo.get(t).push(e);
    }
    const casos = [];
    for (const [kind, list] of porTipo) {
      if (list.length < 2) continue;
      for (const canal of canais) {
        const valores = new Set(list.map(e => e.style[canal] === undefined ? '(ausente)' : e.style[canal]));
        if (valores.size > 1)
          casos.push({ o_que: `o tipo "${kind}" usa ${valores.size} valores de ${canal}: ${[...valores].join(', ')}`, ids: list.map(e => e.id) });
      }
    }
    output.push(porTipo.size ? matches('A2.6', casos, { measured: { tipos: porTipo.size, inconsistencias: casos.length } })
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
      const model = scene.model || {};
      const declaredKind = new Map((model.edges || [])
        .map(a => [`${a.from}→${a.to}`, a.protocol || a.kind || null]));
      const comTipo = edges.filter(a => declaredKind.get(`${a.from}→${a.to}`));
      const porEstilo = new Map();
      const byMeaning = new Map();
      for (const a of comTipo) {
        const style = a.style.dashed === '1' ? `tracejado(${a.style.dashPattern || 'padrão'})` : 'solid';
        const meaning = declaredKind.get(`${a.from}→${a.to}`);
        if (!porEstilo.has(style)) porEstilo.set(style, new Set());
        porEstilo.get(style).add(meaning);
        if (!byMeaning.has(meaning)) byMeaning.set(meaning, new Set());
        byMeaning.get(meaning).add(style);
      }
      if (byMeaning.size < 2) {
        output.push(notApplicable('A2.7', comTipo.length
          ? 'só há um tipo de relação declarado — não há bijeção a conferir'
          : 'nenhuma aresta declara tipo de relação (protocolo); sem taxonomia não há o que mapear'));
      } else {
        const casos = [];
        for (const [style, significados] of porEstilo)
          if (significados.size > 1) casos.push({ o_que: `o traço "${style}" carrega ${significados.size} significados: ${[...significados].join(', ')}`, ids: comTipo.map(a => a.id) });
        for (const [meaning, estilos] of byMeaning)
          if (estilos.size > 1) casos.push({ o_que: `a relação "${meaning}" é desenhada de ${estilos.size} jeitos: ${[...estilos].join(', ')}`, ids: [] });
        output.push(matches('A2.7', casos, { measured: { estilos: porEstilo.size, significados: [...byMeaning.keys()], quebras_de_bijecao: casos.length } }));
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
    const containment = new Set(['cloud', 'account', 'vpc', 'subnet', 'security-group']);
    const casos = [];
    for (const e of grupos) {
      const t = e.tipoSemantico;
      if (!t || !containment.has(t)) continue;
      if (e.style.dashed === '1') casos.push({ o_que: `o grupo de contenção "${e.id}" (${t}) desenha tracejado, e tracejado é convenção de zona`, ids: [e.id] });
    }
    for (const f of bands)
      if (f.style.dashed !== '1') casos.push({ o_que: `a faixa "${f.id}" desenha sólido, e sólido é convenção de contenção`, ids: [f.id] });
    output.push((grupos.length + bands.length) ? matches('A2.8', casos, { measured: { grupos: grupos.length, bands: bands.length, fora_da_convencao: casos.length } })
      : notApplicable('A2.8', 'o diagrama não tem grupos nem faixas'));
  }

  // ---------------------------------------------------------------- A2.9
  output.push(skipped('A2.9'));

  // ---------------------------------------------------------------- A2.10
  {
    if (!edges.length) output.push(notApplicable('A2.10', 'o diagrama não tem arestas'));
    else {
      const casos = [];
      for (const a of edges)
        for (const tip of ['startArrow', 'endArrow']) {
          const v = a.style[tip];
          if (v === undefined) continue;
          if (!PRESET_ARROWS.has(v)) casos.push({ o_que: `a aresta "${a.id}" usa ${tip}="${v}", fora dos presets`, ids: [a.id] });
        }
      output.push(matches('A2.10', casos, { measured: { edges: edges.length, fora_dos_presets: casos.length } }));
    }
  }

  // ---------------------------------------------------------------- A2.11
  {
    const casos = [];
    for (const e of [...desenhaveis, ...edges])
      for (const [, testa, comoSeChama] of CHARTJUNK)
        if (testa(e)) casos.push({ o_que: `${e.id} usa ${comoSeChama} — tinta que não carrega dado`, ids: [e.id] });
    output.push(matches('A2.11', casos, { measured: { objetos: desenhaveis.length + edges.length, com_chartjunk: casos.length } }));
  }

  return output;
};
