'use strict';
/**
 * A1 · Completude semântica.
 *
 * A rubrica: "não é geometria, é presença de campos. É o grupo mais barato de
 * implementar e o de maior retorno: é literalmente o checklist do C4
 * transformado em asserção."
 *
 * Nove das doze são `fail`, e é de propósito: são o piso do que qualquer guia
 * — C4, Azure WAF, AWS deck — exige de um diagrama antes de discutir estética.
 */

const path = require('path');
const { ok, failure, notApplicable, matches, roundTo, withoutTags, name } = require(path.join(__dirname, 'common.cjs'));
const { catalog } = require(path.join(__dirname, 'catalog.cjs'));


/** Canais visuais que a legenda teria de explicar (A1.3). */
function canaisUsados(scene) {
  const canais = new Map();
  const anota = (canal, valor, quem) => {
    if (valor === null || valor === undefined || valor === '') return;
    if (!canais.has(canal)) canais.set(canal, new Map());
    const m = canais.get(canal);
    if (!m.has(valor)) m.set(valor, []);
    m.get(valor).push(quem);
  };
  for (const e of [...scene.nodes, ...scene.grupos, ...scene.bands]) {
    anota('preenchimento', e.preenchimento, e.id);
    anota('traco', e.traco, e.id);
    anota('estilo_de_traco', e.style.dashed === '1' ? 'dashed' : 'solid', e.id);
    anota('forma', e.style.shape || (e.style.container === '1' ? 'container' : 'retangulo'), e.id);
    anota('classe_de_tamanho', `${e.cellBox.w}×${e.cellBox.h}`, e.id);
  }
  for (const a of scene.edges) {
    anota('ponta_de_seta', `${a.style.startArrow || 'nenhuma'}→${a.style.endArrow || 'nenhuma'}`, a.id);
    anota('estilo_de_traco', a.style.dashed === '1' ? 'dashed' : 'solid', a.id);
    anota('traco', a.style.strokeColor || null, a.id);
  }
  return canais;
}

module.exports = function a1(scene) {
  const output = [];
  const model = scene.model;
  const { nodes, grupos, bands, edges } = scene;
  const nomeaveis = [...nodes, ...grupos, ...bands];

  // ---------------------------------------------------------------- A1.1
  {
    const title = model ? withoutTags(model.title) : '';
    const subtitle = model ? withoutTags(model.subtitle) : '';
    if (!title) {
      output.push(failure('A1.1', { mensagem: 'o diagrama não tem título', occurrences: [{ o_que: 'meta.titulo vazio ou ausente', ids: [] }] }));
    } else {
      // A rubrica pede tipo de diagrama + escopo. Aqui o tipo mora em `vista` e
      // o escopo costuma cair no subtítulo, então os dois entram na medida.
      const view = model.view || null;
      output.push(ok('A1.1', {
        measured: { title, view, subtitle: subtitle || null },
        mensagem: `"${title}"${view ? ` (vista ${view})` : ''}`,
      }));
    }
  }

  // ---------------------------------------------------------------- A1.2
  {
    output.push(scene.legend.length
      ? ok('A1.2', { measured: { entradas: scene.legend.length } })
      : failure('A1.2', {
        measured: { entradas: 0 },
        mensagem: 'não há legenda — o C4 pede uma em todo diagrama',
        occurrences: [{ o_que: 'o motor do #11 ainda não emite legenda; toda semântica de cor e de traço fica sem chave', ids: [] }],
      }));
  }

  // ---------------------------------------------------------------- A1.3
  {
    const canais = canaisUsados(scene);
    const explicados = new Set(scene.legend.map(l => String(l.simbolo)));
    const withoutInput = [];
    for (const [canal, valores] of canais)
      for (const [valor, quem] of valores)
        if (!explicados.has(`${canal}:${valor}`) && !explicados.has(String(valor)))
          withoutInput.push({ o_que: `o canal "${canal}" usa ${JSON.stringify(valor)} em ${quem.length} objeto(s) e a legenda não explica`, ids: quem.slice(0, 6) });
    output.push(matches('A1.3', withoutInput, {
      measured: { canais: canais.size, valores_sem_entrada: withoutInput.length },
      mensagem: withoutInput.length ? `${withoutInput.length} valor(es) de canal visual sem entrada na legenda` : 'todo canal visual está explicado',
    }));
  }

  // ---------------------------------------------------------------- A1.4
  {
    const casos = nomeaveis.filter(e => !withoutTags(e.label)).map(e => ({ o_que: `${e.id} não tem rótulo`, ids: [e.id] }));
    output.push(matches('A1.4', casos, { measured: { elements: nomeaveis.length, sem_nome: casos.length } }));
  }

  // ---------------------------------------------------------------- A1.5
  {
    if (!model) output.push(notApplicable('A1.5', 'o plano não carrega o modelo semântico'));
    else {
      const casos = [...nodes, ...grupos].filter(e => !e.tipoSemantico)
        .map(e => ({ o_que: `${name(e)} não tem tipo declarado no modelo`, ids: [e.id] }));
      output.push(matches('A1.5', casos, { measured: { elements: nodes.length + grupos.length, sem_tipo: casos.length } }));
    }
  }

  // ---------------------------------------------------------------- A1.6
  {
    const casos = edges.filter(a => !withoutTags(a.label)).map(a => ({ o_que: `a aresta "${a.id}" (${a.from}→${a.to}) não tem rótulo`, ids: [a.id] }));
    output.push(edges.length ? matches('A1.6', casos, { measured: { edges: edges.length, sem_rotulo: casos.length } })
      : notApplicable('A1.6', 'o diagrama não tem arestas'));
  }

  // ------------------------------------------------------------ A1.7 e A1.8
  {
    const pontas = a => {
      const tem = v => v && v !== 'none';
      return (tem(a.style.startArrow) ? 1 : 0) + (tem(a.style.endArrow) || a.style.endArrow === undefined ? 1 : 0);
    };
    if (!edges.length) {
      output.push(notApplicable('A1.7', 'o diagrama não tem arestas'));
      output.push(notApplicable('A1.8', 'o diagrama não tem arestas'));
    } else {
      const bidirecionais = edges.filter(a => pontas(a) > 1)
        .map(a => ({ o_que: `a aresta "${a.id}" tem duas pontas — uma relação bidirecional esconde qual lado inicia`, ids: [a.id] }));
      output.push(matches('A1.7', bidirecionais, { measured: { edges: edges.length, bidirecionais: bidirecionais.length } }));

      const semSeta = edges.filter(a => pontas(a) < 1)
        .map(a => ({ o_que: `a aresta "${a.id}" não tem seta`, ids: [a.id] }));
      output.push(matches('A1.8', semSeta, { measured: { edges: edges.length, sem_seta: semSeta.length } }));
    }
  }

  // ---------------------------------------------------------------- A1.9
  {
    const cat = catalog();
    if (!cat) output.push(notApplicable('A1.9', 'o catálogo de shapes não está disponível para montar a lista de siglas oficiais'));
    else {
      const oficiais = new Set();
      for (const title of cat.titulos) for (const t of String(title).match(/\b[A-Z][A-Za-z0-9]*\b/g) || []) oficiais.add(t);
      const textos = [...nomeaveis.map(e => withoutTags(e.label)), ...edges.map(a => withoutTags(a.label))].filter(Boolean);
      const naoExplicadas = new Map();
      for (const t of textos)
        for (const sigla of t.match(/\b[A-Z]{2,}\b/g) || []) {
          if (oficiais.has(sigla)) continue;
          // "expandida no diagrama" — alguma outra parte do texto a soletra
          const expanded = textos.some(outro => new RegExp(sigla.split('').join('[a-z]* '), 'i').test(outro));
          if (!expanded) naoExplicadas.set(sigla, (naoExplicadas.get(sigla) || 0) + 1);
        }
      const casos = [...naoExplicadas].map(([s, n]) => ({ o_que: `a sigla "${s}" aparece ${n}× e não é nome oficial nem está expandida`, ids: [] }));
      output.push(matches('A1.9', casos, { measured: { rotulos: textos.length, siglas_sem_explicacao: casos.length } }));
    }
  }

  // ---------------------------------------------------------------- A1.10
  {
    if (!model) output.push(notApplicable('A1.10', 'o plano não carrega o modelo semântico'));
    else {
      // Neste modelo o nível é o `vista` (lógica é pré-serviços, técnica é
      // pós-serviços), e o tipo da folha o denuncia: `bloco` é lógico, `servico`
      // é técnico. Misturar os dois num desenho é o que o C4 proíbe.
      const niveis = new Set();
      for (const n of model.nodes || []) {
        if (n.kind === 'block') niveis.add('logical');
        if (n.kind === 'service') niveis.add('technical');
      }
      output.push(niveis.size > 1
        ? failure('A1.10', {
          measured: { niveis: [...niveis] },
          mensagem: `o diagrama mistura ${[...niveis].join(' e ')}`,
          occurrences: [{ o_que: 'blocos lógicos e serviços concretos no mesmo desenho — o C4 pede um nível por diagrama', ids: [] }],
        })
        : ok('A1.10', { measured: { niveis: [...niveis], view: model.view || null } }));
    }
  }

  // ---------------------------------------------------------------- A1.11
  {
    if (!model) output.push(notApplicable('A1.11', 'o plano não carrega o modelo semântico'));
    else {
      const faltando = ['data', 'versao', 'autor'].filter(k => !model[k]);
      output.push(matches('A1.11', faltando.map(k => ({ o_que: `o modelo não declara "${k}"`, ids: [] })), {
        measured: { presentes: ['data', 'versao', 'autor'].filter(k => model[k]), ausentes: faltando },
        mensagem: faltando.length ? `sem ${faltando.join(', ')} — não dá para saber se o diagrama está velho` : 'metadados de frescor presentes',
      }));
    }
  }

  // ---------------------------------------------------------------- A1.12
  {
    // Órfão é traço que não corresponde a fato. A cena classifica tudo, então o
    // órfão aqui é o objeto que ficou sem classe conhecida ou que desenha sem
    // ter contrapartida no modelo.
    const classificadas = new Set(['no', 'group', 'band', 'frame', 'edge', 'oculto']);
    const casos = [];
    for (const e of scene.elements) {
      if (!classificadas.has(e.classe)) { casos.push({ o_que: `${e.id} desenha e não é nó, grupo, faixa, aresta nem moldura`, ids: [e.id] }); continue; }
      if (e.classe === 'no' && model && !(model.nodes || []).some(n => n.id === e.id))
        casos.push({ o_que: `${e.id} desenha como nó e não existe no modelo`, ids: [e.id] });
    }
    output.push(matches('A1.12', casos, { measured: { objetos: scene.elements.length, orfaos: casos.length } }));
  }

  return output;
};
