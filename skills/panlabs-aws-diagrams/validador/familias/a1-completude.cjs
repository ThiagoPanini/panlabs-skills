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
const { ok, falha, inaplicavel, conforme, arredonda, semTags, nome } = require(path.join(__dirname, 'comum.cjs'));
const { catalogo } = require(path.join(__dirname, 'catalogo.cjs'));


/** Canais visuais que a legenda teria de explicar (A1.3). */
function canaisUsados(cena) {
  const canais = new Map();
  const anota = (canal, valor, quem) => {
    if (valor === null || valor === undefined || valor === '') return;
    if (!canais.has(canal)) canais.set(canal, new Map());
    const m = canais.get(canal);
    if (!m.has(valor)) m.set(valor, []);
    m.get(valor).push(quem);
  };
  for (const e of [...cena.nos, ...cena.grupos, ...cena.faixas]) {
    anota('preenchimento', e.preenchimento, e.id);
    anota('traco', e.traco, e.id);
    anota('estilo_de_traco', e.estilo.dashed === '1' ? 'tracejado' : 'solido', e.id);
    anota('forma', e.estilo.shape || (e.estilo.container === '1' ? 'container' : 'retangulo'), e.id);
    anota('classe_de_tamanho', `${e.caixa.w}×${e.caixa.h}`, e.id);
  }
  for (const a of cena.arestas) {
    anota('ponta_de_seta', `${a.estilo.startArrow || 'nenhuma'}→${a.estilo.endArrow || 'nenhuma'}`, a.id);
    anota('estilo_de_traco', a.estilo.dashed === '1' ? 'tracejado' : 'solido', a.id);
    anota('traco', a.estilo.strokeColor || null, a.id);
  }
  return canais;
}

module.exports = function a1(cena) {
  const saida = [];
  const modelo = cena.modelo;
  const { nos, grupos, faixas, arestas } = cena;
  const nomeaveis = [...nos, ...grupos, ...faixas];

  // ---------------------------------------------------------------- A1.1
  {
    const titulo = modelo ? semTags(modelo.titulo) : '';
    const subtitulo = modelo ? semTags(modelo.subtitulo) : '';
    if (!titulo) {
      saida.push(falha('A1.1', { mensagem: 'o diagrama não tem título', ocorrencias: [{ o_que: 'meta.titulo vazio ou ausente', ids: [] }] }));
    } else {
      // A rubrica pede tipo de diagrama + escopo. Aqui o tipo mora em `vista` e
      // o escopo costuma cair no subtítulo, então os dois entram na medida.
      const vista = modelo.vista || null;
      saida.push(ok('A1.1', {
        medida: { titulo, vista, subtitulo: subtitulo || null },
        mensagem: `"${titulo}"${vista ? ` (vista ${vista})` : ''}`,
      }));
    }
  }

  // ---------------------------------------------------------------- A1.2
  {
    saida.push(cena.legenda.length
      ? ok('A1.2', { medida: { entradas: cena.legenda.length } })
      : falha('A1.2', {
        medida: { entradas: 0 },
        mensagem: 'não há legenda — o C4 pede uma em todo diagrama',
        ocorrencias: [{ o_que: 'o motor do #11 ainda não emite legenda; toda semântica de cor e de traço fica sem chave', ids: [] }],
      }));
  }

  // ---------------------------------------------------------------- A1.3
  {
    const canais = canaisUsados(cena);
    const explicados = new Set(cena.legenda.map(l => String(l.simbolo)));
    const semEntrada = [];
    for (const [canal, valores] of canais)
      for (const [valor, quem] of valores)
        if (!explicados.has(`${canal}:${valor}`) && !explicados.has(String(valor)))
          semEntrada.push({ o_que: `o canal "${canal}" usa ${JSON.stringify(valor)} em ${quem.length} objeto(s) e a legenda não explica`, ids: quem.slice(0, 6) });
    saida.push(conforme('A1.3', semEntrada, {
      medida: { canais: canais.size, valores_sem_entrada: semEntrada.length },
      mensagem: semEntrada.length ? `${semEntrada.length} valor(es) de canal visual sem entrada na legenda` : 'todo canal visual está explicado',
    }));
  }

  // ---------------------------------------------------------------- A1.4
  {
    const casos = nomeaveis.filter(e => !semTags(e.rotulo)).map(e => ({ o_que: `${e.id} não tem rótulo`, ids: [e.id] }));
    saida.push(conforme('A1.4', casos, { medida: { elementos: nomeaveis.length, sem_nome: casos.length } }));
  }

  // ---------------------------------------------------------------- A1.5
  {
    if (!modelo) saida.push(inaplicavel('A1.5', 'o plano não carrega o modelo semântico'));
    else {
      const casos = [...nos, ...grupos].filter(e => !e.tipoSemantico)
        .map(e => ({ o_que: `${nome(e)} não tem tipo declarado no modelo`, ids: [e.id] }));
      saida.push(conforme('A1.5', casos, { medida: { elementos: nos.length + grupos.length, sem_tipo: casos.length } }));
    }
  }

  // ---------------------------------------------------------------- A1.6
  {
    const casos = arestas.filter(a => !semTags(a.rotulo)).map(a => ({ o_que: `a aresta "${a.id}" (${a.de}→${a.para}) não tem rótulo`, ids: [a.id] }));
    saida.push(arestas.length ? conforme('A1.6', casos, { medida: { arestas: arestas.length, sem_rotulo: casos.length } })
      : inaplicavel('A1.6', 'o diagrama não tem arestas'));
  }

  // ------------------------------------------------------------ A1.7 e A1.8
  {
    const pontas = a => {
      const tem = v => v && v !== 'none';
      return (tem(a.estilo.startArrow) ? 1 : 0) + (tem(a.estilo.endArrow) || a.estilo.endArrow === undefined ? 1 : 0);
    };
    if (!arestas.length) {
      saida.push(inaplicavel('A1.7', 'o diagrama não tem arestas'));
      saida.push(inaplicavel('A1.8', 'o diagrama não tem arestas'));
    } else {
      const bidirecionais = arestas.filter(a => pontas(a) > 1)
        .map(a => ({ o_que: `a aresta "${a.id}" tem duas pontas — uma relação bidirecional esconde qual lado inicia`, ids: [a.id] }));
      saida.push(conforme('A1.7', bidirecionais, { medida: { arestas: arestas.length, bidirecionais: bidirecionais.length } }));

      const semSeta = arestas.filter(a => pontas(a) < 1)
        .map(a => ({ o_que: `a aresta "${a.id}" não tem seta`, ids: [a.id] }));
      saida.push(conforme('A1.8', semSeta, { medida: { arestas: arestas.length, sem_seta: semSeta.length } }));
    }
  }

  // ---------------------------------------------------------------- A1.9
  {
    const cat = catalogo();
    if (!cat) saida.push(inaplicavel('A1.9', 'o catálogo de shapes não está disponível para montar a lista de siglas oficiais'));
    else {
      const oficiais = new Set();
      for (const titulo of cat.titulos) for (const t of String(titulo).match(/\b[A-Z][A-Za-z0-9]*\b/g) || []) oficiais.add(t);
      const textos = [...nomeaveis.map(e => semTags(e.rotulo)), ...arestas.map(a => semTags(a.rotulo))].filter(Boolean);
      const naoExplicadas = new Map();
      for (const t of textos)
        for (const sigla of t.match(/\b[A-Z]{2,}\b/g) || []) {
          if (oficiais.has(sigla)) continue;
          // "expandida no diagrama" — alguma outra parte do texto a soletra
          const expandida = textos.some(outro => new RegExp(sigla.split('').join('[a-z]* '), 'i').test(outro));
          if (!expandida) naoExplicadas.set(sigla, (naoExplicadas.get(sigla) || 0) + 1);
        }
      const casos = [...naoExplicadas].map(([s, n]) => ({ o_que: `a sigla "${s}" aparece ${n}× e não é nome oficial nem está expandida`, ids: [] }));
      saida.push(conforme('A1.9', casos, { medida: { rotulos: textos.length, siglas_sem_explicacao: casos.length } }));
    }
  }

  // ---------------------------------------------------------------- A1.10
  {
    if (!modelo) saida.push(inaplicavel('A1.10', 'o plano não carrega o modelo semântico'));
    else {
      // Neste modelo o nível é o `vista` (lógica é pré-serviços, técnica é
      // pós-serviços), e o tipo da folha o denuncia: `bloco` é lógico, `servico`
      // é técnico. Misturar os dois num desenho é o que o C4 proíbe.
      const niveis = new Set();
      for (const n of modelo.nos || []) {
        if (n.tipo === 'bloco') niveis.add('logico');
        if (n.tipo === 'servico') niveis.add('tecnico');
      }
      saida.push(niveis.size > 1
        ? falha('A1.10', {
          medida: { niveis: [...niveis] },
          mensagem: `o diagrama mistura ${[...niveis].join(' e ')}`,
          ocorrencias: [{ o_que: 'blocos lógicos e serviços concretos no mesmo desenho — o C4 pede um nível por diagrama', ids: [] }],
        })
        : ok('A1.10', { medida: { niveis: [...niveis], vista: modelo.vista || null } }));
    }
  }

  // ---------------------------------------------------------------- A1.11
  {
    if (!modelo) saida.push(inaplicavel('A1.11', 'o plano não carrega o modelo semântico'));
    else {
      const faltando = ['data', 'versao', 'autor'].filter(k => !modelo[k]);
      saida.push(conforme('A1.11', faltando.map(k => ({ o_que: `o modelo não declara "${k}"`, ids: [] })), {
        medida: { presentes: ['data', 'versao', 'autor'].filter(k => modelo[k]), ausentes: faltando },
        mensagem: faltando.length ? `sem ${faltando.join(', ')} — não dá para saber se o diagrama está velho` : 'metadados de frescor presentes',
      }));
    }
  }

  // ---------------------------------------------------------------- A1.12
  {
    // Órfão é traço que não corresponde a fato. A cena classifica tudo, então o
    // órfão aqui é o objeto que ficou sem classe conhecida ou que desenha sem
    // ter contrapartida no modelo.
    const classificadas = new Set(['no', 'grupo', 'faixa', 'moldura', 'aresta', 'oculto']);
    const casos = [];
    for (const e of cena.elementos) {
      if (!classificadas.has(e.classe)) { casos.push({ o_que: `${e.id} desenha e não é nó, grupo, faixa, aresta nem moldura`, ids: [e.id] }); continue; }
      if (e.classe === 'no' && modelo && !(modelo.nos || []).some(n => n.id === e.id))
        casos.push({ o_que: `${e.id} desenha como nó e não existe no modelo`, ids: [e.id] });
    }
    saida.push(conforme('A1.12', casos, { medida: { objetos: cena.elementos.length, orfaos: casos.length } }));
  }

  return saida;
};
