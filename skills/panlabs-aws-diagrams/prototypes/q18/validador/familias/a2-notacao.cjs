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
const { lim } = require(path.join(__dirname, '..', 'indice.cjs'));
const { ok, aviso, falha, inaplicavel, pulada, conforme, arredonda, semTags, nome } = require(path.join(__dirname, 'comum.cjs'));
const { catalogo, preenchimentoDe, stencilDe } = require(path.join(__dirname, 'catalogo.cjs'));


/** Pontas de seta que os presets do deck AWS cobrem. */
const SETAS_PRESET = new Set(['none', 'block', 'blockThin', 'open', 'openThin', 'classic', 'classicThin', 'oval', 'diamond', 'diamondThin', 'halfCircle', 'baseDash', 'ERone', 'ERmandOne']);

/** Marcas de chartjunk: efeito que não carrega dado. */
const CHARTJUNK = [
  ['shadow', e => e.estilo.shadow === '1', 'sombra'],
  ['glass', e => e.estilo.glass === '1', 'brilho de vidro'],
  ['sketch', e => e.estilo.sketch === '1', 'traço rascunhado'],
  ['gradiente', e => e.estilo.gradientColor && e.estilo.gradientColor !== 'none', 'gradiente'],
  ['perspectiva', e => e.estilo.shape === 'cube' || e.estilo.isometric === '1', 'perspectiva/isometria'],
];

module.exports = function a2(cena) {
  const saida = [];
  const cat = catalogo();
  const { nos, grupos, faixas, arestas } = cena;
  const desenhaveis = [...nos, ...grupos, ...faixas];

  // ---------------------------------------------------------------- A2.1
  // Conta TIPOS de símbolo, não instâncias — "vinte Lambdas = 1 entrada".
  {
    const simbolos = new Set(desenhaveis.map(e =>
      [e.preenchimento, e.traco, e.estilo.dashed === '1' ? 'tracejado' : 'solido', e.estilo.shape || (e.estilo.container === '1' ? 'container' : 'caixa')].join('|')));
    for (const a of arestas) simbolos.add(['aresta', a.estilo.strokeColor, a.estilo.dashed === '1' ? 'tracejado' : 'solido', a.estilo.endArrow].join('|'));
    const n = simbolos.size;
    const alvo = lim('complexidadeGraficaAlvo');
    const teto = lim('complexidadeGraficaFalha');
    const medida = { entradas_necessarias: n, alvo, teto };
    saida.push(n <= alvo ? ok('A2.1', { medida, mensagem: `${n} tipo(s) de símbolo (alvo ≤ ${alvo})` })
      : n <= teto ? aviso('A2.1', { medida, mensagem: `${n} tipos de símbolo — acima do alvo de ${alvo}, ainda dentro de ${teto}`, ocorrencias: [{ o_que: `a legenda precisaria de ${n} entradas`, ids: [] }] })
        : falha('A2.1', { medida, mensagem: `${n} tipos de símbolo — acima do limite de ${teto} (span of absolute judgement)`, ocorrencias: [{ o_que: `a legenda precisaria de ${n} entradas; Moody põe o teto efetivo em ${alvo}`, ids: [] }] }));
  }

  // ---------------------------------------------------------------- A2.2
  {
    const casos = [];
    for (const e of desenhaveis) {
      const s = e.estilo;
      const deformacoes = [];
      if (s.flipH === '1') deformacoes.push('espelhado na horizontal');
      if (s.flipV === '1') deformacoes.push('espelhado na vertical');
      if (s.rotation && parseFloat(s.rotation) !== 0) deformacoes.push(`girado ${s.rotation}°`);
      if (s.direction && s.direction !== 'east') deformacoes.push(`direção "${s.direction}"`);
      if (deformacoes.length) casos.push({ o_que: `${nome(e)} está ${deformacoes.join(' e ')}`, ids: [e.id] });
    }
    saida.push(conforme('A2.2', casos, { medida: { objetos: desenhaveis.length, deformados: casos.length } }));
  }

  // ---------------------------------------------------------------- A2.3
  {
    if (!cat) saida.push(inaplicavel('A2.3', 'o catálogo de shapes não está disponível'));
    else if (!cena.modelo) saida.push(inaplicavel('A2.3', 'o plano não carrega o modelo, então não há como saber que serviço cada nó pediu'));
    else {
      const porIdModelo = new Map((cena.modelo.nos || []).map(n => [n.id, n]));
      const casos = [];
      let conferidos = 0;
      for (const e of nos) {
        const m = porIdModelo.get(e.id);
        const chave = m && (m.servico || (m.tipo === 'ator' ? 'users' : null));
        if (!chave) continue;
        const oficial = cat.servico(chave);
        if (!oficial) continue;
        conferidos++;
        const esperado = preenchimentoDe(oficial.style);
        if (esperado && e.preenchimento && esperado.toLowerCase() !== e.preenchimento.toLowerCase())
          casos.push({ o_que: `${nome(e)} pinta ${e.preenchimento} e o catálogo prescreve ${esperado} para "${oficial.title}"`, ids: [e.id] });
      }
      saida.push(conforme('A2.3', casos, {
        medida: { conferidos, divergentes: casos.length },
        mensagem: `${conferidos} ícone(s) conferido(s) contra a cor declarada no catálogo — o hash de pixel é do render`,
      }));
    }
  }

  // ---------------------------------------------------------------- A2.4
  {
    if (!cat) saida.push(inaplicavel('A2.4', 'o catálogo de shapes não está disponível'));
    else {
      const casos = [];
      let comStencil = 0;
      for (const e of nos) {
        const id = stencilDe(e.estiloBruto);
        if (!id) continue;
        comStencil++;
        if (!cat.ids.has(id)) casos.push({ o_que: `${nome(e)} usa o stencil "${id}", que não está no catálogo vigente`, ids: [e.id] });
      }
      saida.push(conforme('A2.4', casos, {
        medida: { com_stencil: comStencil, fora_do_catalogo: casos.length, vigencia: cat.vigencia },
        mensagem: `catálogo de ${cat.vigencia || 'data desconhecida'}; ${comStencil} ícone(s) com stencil declarado`,
      }));
    }
  }

  // ---------------------------------------------------------------- A2.5
  {
    const porClasse = new Map();
    for (const e of nos) {
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
    saida.push(porClasse.size ? conforme('A2.5', casos, { medida: { classes: porClasse.size, irregulares: casos.length } })
      : inaplicavel('A2.5', 'o diagrama não tem nós'));
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
      if (m && m.tipo) return [m.tipo, m.servico, m.acesso].filter(Boolean).join('/');
      return stencilDe(e.estiloBruto) || e.tipoSemantico || 'desconhecido';
    };
    const porTipo = new Map();
    for (const e of [...nos, ...grupos]) {
      const t = tipoDe(e);
      if (!porTipo.has(t)) porTipo.set(t, []);
      porTipo.get(t).push(e);
    }
    const casos = [];
    for (const [tipo, lista] of porTipo) {
      if (lista.length < 2) continue;
      for (const canal of canais) {
        const valores = new Set(lista.map(e => e.estilo[canal] === undefined ? '(ausente)' : e.estilo[canal]));
        if (valores.size > 1)
          casos.push({ o_que: `o tipo "${tipo}" usa ${valores.size} valores de ${canal}: ${[...valores].join(', ')}`, ids: lista.map(e => e.id) });
      }
    }
    saida.push(porTipo.size ? conforme('A2.6', casos, { medida: { tipos: porTipo.size, inconsistencias: casos.length } })
      : inaplicavel('A2.6', 'o diagrama não tem elementos tipados'));
  }

  // ---------------------------------------------------------------- A2.7
  {
    if (!arestas.length) saida.push(inaplicavel('A2.7', 'o diagrama não tem arestas'));
    else {
      // O significado de uma relação é o TIPO DE RELAÇÃO que o modelo declara —
      // aqui, `protocolo`. Derivar significado do par de tipos das pontas seria
      // inventar taxonomia: "ator→servico" e "servico→servico" não são dois
      // sentidos de linha, são duas posições no grafo, e reprovar por isso
      // acusaria de ambíguo todo diagrama com mais de um formato de nó.
      // Arestas que não declaram tipo ficam de fora: ausência não é ambiguidade.
      const modelo = cena.modelo || {};
      const tipoDeclarado = new Map((modelo.arestas || [])
        .map(a => [`${a.de}→${a.para}`, a.protocolo || a.tipo || null]));
      const comTipo = arestas.filter(a => tipoDeclarado.get(`${a.de}→${a.para}`));
      const porEstilo = new Map();
      const porSignificado = new Map();
      for (const a of comTipo) {
        const estilo = a.estilo.dashed === '1' ? `tracejado(${a.estilo.dashPattern || 'padrão'})` : 'solido';
        const significado = tipoDeclarado.get(`${a.de}→${a.para}`);
        if (!porEstilo.has(estilo)) porEstilo.set(estilo, new Set());
        porEstilo.get(estilo).add(significado);
        if (!porSignificado.has(significado)) porSignificado.set(significado, new Set());
        porSignificado.get(significado).add(estilo);
      }
      if (porSignificado.size < 2) {
        saida.push(inaplicavel('A2.7', comTipo.length
          ? 'só há um tipo de relação declarado — não há bijeção a conferir'
          : 'nenhuma aresta declara tipo de relação (protocolo); sem taxonomia não há o que mapear'));
      } else {
        const casos = [];
        for (const [estilo, significados] of porEstilo)
          if (significados.size > 1) casos.push({ o_que: `o traço "${estilo}" carrega ${significados.size} significados: ${[...significados].join(', ')}`, ids: comTipo.map(a => a.id) });
        for (const [significado, estilos] of porSignificado)
          if (estilos.size > 1) casos.push({ o_que: `a relação "${significado}" é desenhada de ${estilos.size} jeitos: ${[...estilos].join(', ')}`, ids: [] });
        saida.push(conforme('A2.7', casos, { medida: { estilos: porEstilo.size, significados: [...porSignificado.keys()], quebras_de_bijecao: casos.length } }));
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
    const contencao = new Set(['nuvem', 'conta', 'vpc', 'subnet', 'grupo-seguranca']);
    const casos = [];
    for (const e of grupos) {
      const t = e.tipoSemantico;
      if (!t || !contencao.has(t)) continue;
      if (e.estilo.dashed === '1') casos.push({ o_que: `o grupo de contenção "${e.id}" (${t}) desenha tracejado, e tracejado é convenção de zona`, ids: [e.id] });
    }
    for (const f of faixas)
      if (f.estilo.dashed !== '1') casos.push({ o_que: `a faixa "${f.id}" desenha sólido, e sólido é convenção de contenção`, ids: [f.id] });
    saida.push((grupos.length + faixas.length) ? conforme('A2.8', casos, { medida: { grupos: grupos.length, faixas: faixas.length, fora_da_convencao: casos.length } })
      : inaplicavel('A2.8', 'o diagrama não tem grupos nem faixas'));
  }

  // ---------------------------------------------------------------- A2.9
  saida.push(pulada('A2.9'));

  // ---------------------------------------------------------------- A2.10
  {
    if (!arestas.length) saida.push(inaplicavel('A2.10', 'o diagrama não tem arestas'));
    else {
      const casos = [];
      for (const a of arestas)
        for (const ponta of ['startArrow', 'endArrow']) {
          const v = a.estilo[ponta];
          if (v === undefined) continue;
          if (!SETAS_PRESET.has(v)) casos.push({ o_que: `a aresta "${a.id}" usa ${ponta}="${v}", fora dos presets`, ids: [a.id] });
        }
      saida.push(conforme('A2.10', casos, { medida: { arestas: arestas.length, fora_dos_presets: casos.length } }));
    }
  }

  // ---------------------------------------------------------------- A2.11
  {
    const casos = [];
    for (const e of [...desenhaveis, ...arestas])
      for (const [, testa, comoSeChama] of CHARTJUNK)
        if (testa(e)) casos.push({ o_que: `${e.id} usa ${comoSeChama} — tinta que não carrega dado`, ids: [e.id] });
    saida.push(conforme('A2.11', casos, { medida: { objetos: desenhaveis.length + arestas.length, com_chartjunk: casos.length } }));
  }

  return saida;
};
