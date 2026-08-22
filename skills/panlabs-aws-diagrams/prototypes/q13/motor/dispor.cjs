'use strict';
/**
 * Layout — o único lugar do motor onde nasce um número de posição.
 *
 * Dois caminhos, e quem escolhe é o modelo, não o agente:
 *
 *   A · ELK manda em tudo.  Sem faixa de AZ, o `elkjs` layouta a hierarquia
 *       inteira numa passada. `shapeCoords: PARENT` devolve coordenada já
 *       relativa ao pai — a semântica exata do `mxGeometry` (#7).
 *
 *   B · o motor manda na grade.  Com faixa de AZ, as subnets da mesma zona
 *       precisam ficar alinhadas ENTRE VPCs para a faixa ler como coluna, e o
 *       ELK layoutando cada VPC isolada não garante isso (#19). Então o motor
 *       fica com o `x` das colunas e o ELK com o conteúdo DENTRO da célula.
 *
 * O preço do caminho B é exatamente o que o #19 mediu: quatro constantes de
 * calha. Não é um motor novo.
 */

const ELK = require('./vendor/elk.bundled.js');
const { alinhar } = require('./alinhar.cjs');

// ---- as quatro calhas do #19 -------------------------------------------------
//
// ⚠️ CALHA NÃO É FOLGA, e a densidade do tema (#13) não toca nelas.
//
// Folga é respiro: o vão entre dois nós, o padding de um container. Encolher
// aperta o desenho e nada mais. Calha é RESERVA DE RÓTULO — derivada de métrica
// de fonte e do `spacingTop` do próprio estilo (#11 achado 6). Encolher calha
// não aperta: derruba texto em cima de borda. Por isso a densidade multiplica
// `folga()` e nunca `calha()`.
const AZ_LANE = 36;    // linha de rótulo das colunas de AZ
const BAND_LANE = 24;  // piso do rótulo de uma faixa de membros — ver calhaDaFaixa
const CROSS_OUT = 24;  // transbordo que faz o cruzamento SE VER
const HEAD = 34;       // faixa de título de qualquer container — recursiva (#2 §3.2)

/**
 * `BAND_LANE` não pode ser constante — descoberto ao ligar o motor no catálogo.
 *
 * O #19 calibrou 24 px contra um estilo de faixa escrito à mão. O estilo REAL
 * do Auto Scaling group no catálogo (#17) é `groupCenter` com `spacingTop=25`:
 * o rótulo é desenhado 25 px abaixo do topo da caixa, para caber o ícone que
 * essa forma põe ali. Com calha de 24 px o rótulo da faixa cai exatamente na
 * linha de título da subnet que ela cruza.
 *
 * A calha, então, é lida do estilo — quem sabe onde o rótulo vai parar é a
 * forma, não uma constante nossa.
 */
function calhaDaFaixa(style) {
  const m = /(?:^|;)spacingTop=(-?\d+)/.exec(style || '');
  const recuo = m ? Number(m[1]) : 0;
  return Math.max(BAND_LANE, recuo + 18 + 6);
}

const PAD = 12;
const COL_GAP = 30;
const ROW_GAP = 14;

/**
 * A grade base do tema (#13). Os valores de fábrica acima vieram do #11 sem
 * denominador comum; a camada da casa os reancora numa escala de base 8 — e 8
 * não é gosto: o ícone de serviço é 48 px e o de grupo 40 px (A9/A6 do #5,
 * travados no preset), ambos múltiplos de 8, e a folga mínima entre grupos
 * aninhados (N7: 0.05") é 4,8 px, cujo degrau imediatamente acima é 8.
 *
 * Sem tema, tudo cai nos valores de fábrica e o #11 roda idêntico.
 */
function folgas(tema) {
  if (!tema) return { PAD, COL_GAP, ROW_GAP, nodeNode: 30, entreCamadas: 46, edgeNode: 22, edgeEdge: 14, edgeLabel: 8 };
  const g = tema.g;
  return {
    PAD: g(1), COL_GAP: g(4), ROW_GAP: g(2),
    nodeNode: g(4), entreCamadas: g(6), edgeNode: g(3), edgeEdge: g(2), edgeLabel: g(1),
  };
}

/**
 * `O1` do #5 é a tendência observada mais forte do corpus — 17 de 24 diagramas
 * oficiais correm esquerda→direita. `RIGHT` também desvia do bug do #7 em que
 * `nodeSize.minimum` troca os eixos em nó compound sob `DOWN`/`UP`.
 */
/**
 * ⚠️ OPÇÃO DE ESPAÇAMENTO NÃO DESCE PARA CONTAINER.
 *
 * Descoberto medindo, e é a armadilha mais cara deste módulo: com
 * `hierarchyHandling: INCLUDE_CHILDREN` a documentação dá a entender que o
 * grafo inteiro é layoutado numa passada — mas as opções de espaçamento são
 * lidas **por container**, não herdadas da raiz. Setá-las só na raiz não é erro
 * silencioso de digitação: é configuração INERTE. O que vale lá dentro é o
 * default do ELK (`nodeNode` = 20).
 *
 * Prova: com as opções só na raiz, `spacing.nodeNode` de 38, 50 ou 90 produz
 * exatamente a mesma geometria — vão de 20 px, o default. Repetidas por
 * container, o vão passa a obedecer o valor pedido. Mesma coisa para
 * `nodePlacement.strategy`, que era inerte na raiz e muda o desenho quando
 * repetida.
 *
 * Por isso `espalhar()` existe e por isso todo container recebe o bloco
 * inteiro. Quem acrescentar uma opção de espaçamento aqui precisa acrescentar
 * em ESPACAMENTO, nunca só em OPCOES_RAIZ.
 */
function espacamentoDe(fg) {
  return {
    'elk.spacing.nodeNode': String(fg.nodeNode),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(fg.entreCamadas),
    'elk.spacing.edgeNode': String(fg.edgeNode),
    'elk.spacing.edgeEdge': String(fg.edgeEdge),
    'elk.layered.spacing.edgeLabelSpacing': String(fg.edgeLabel),
    'elk.edgeLabels.placement': 'CENTER',
  };
}
const ESPACAMENTO = espacamentoDe(folgas(null));

const OPCOES_RAIZ = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',   // sem isto cada container é layoutado sozinho
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.crossingMinimization.semiInteractive': 'true',
  'elk.randomSeed': '1',                          // 0 == semente do relógio
  'elk.json.shapeCoords': 'PARENT',               // == semântica do mxGeometry
  'elk.json.edgeCoords': 'ROOT',                  // default na raiz é CONTAINER, não ROOT
  ...ESPACAMENTO,
};

/** O texto que a aresta vai de fato mostrar — é dele que sai a largura reservada. */
function textoDaAresta(a) {
  const base = a.rotulo || '';
  if (a.ordem === undefined) return base;
  return base ? `${a.ordem}. ${base}` : String(a.ordem);
}

/** O `$H` do GWT vaza no JSON e muda a cada execução sem mover uma coordenada (#7). */
function limpar(o) {
  if (Array.isArray(o)) return o.map(limpar);
  if (o && typeof o === 'object') {
    const r = {};
    for (const [k, v] of Object.entries(o)) if (k !== '$H') r[k] = limpar(v);
    return r;
  }
  return o;
}

// ------------------------------------------------------------------ caminho A

/**
 * A caixa que o ELK enxerga é a caixa do ÍCONE, não a do ícone mais o rótulo.
 *
 * O caminho óbvio — inflar a altura para caber o rótulo — parece certo e é
 * errado: o ELK roteia até o CENTRO da caixa, e uma caixa inflada para baixo
 * tem centro abaixo do ícone. A seta passaria a sair de dentro do texto. Então
 * a caixa é o ícone (centro = centro do ícone, âncora exata) e o espaço do
 * rótulo é comprado onde ele de fato é consumido:
 *
 *   - na vertical, por `spacing.nodeNode`, que separa vizinhos da mesma camada;
 *   - na horizontal, alargando a caixa até a largura do rótulo, com o ícone
 *     centrado — assim o transbordo do texto fica DENTRO da caixa e nenhum
 *     vizinho encosta nele;
 *   - no rodapé do container, por `padding.bottom`.
 */
function montarElk(modelo, d, res, medir) {
  const FOLGA = folgas(res.tema);
  const caixas = new Map();
  const paddings = new Map();     // o passe de alinhamento precisa saber o limite de cada caixa

  // pré-resolve as folhas para saber de quanto rótulo o layout precisa fugir
  let rotuloMax = 0, transbordo = 0;
  for (const no of modelo.nos) {
    if (d.t.filhos.get(no.id).length) continue;
    const f = res.folha(no);
    rotuloMax = Math.max(rotuloMax, f.rotuloH);
    // quanto o texto passa de cada lado do ícone — é isso que precisa caber no
    // vão entre camadas, já que a caixa do layout é a do ícone
    transbordo = Math.max(transbordo, Math.max(0, ((f.rotuloW || 0) - f.formaW) / 2));
  }

  // O espaçamento efetivo depende do rótulo, e precisa ser IDÊNTICO na raiz e
  // em cada container — ver o aviso em ESPACAMENTO.
  const espacamento = {
    ...espacamentoDe(FOLGA),
    // vizinho de cima/baixo tem de caber o rótulo do de cima, que é desenhado
    // fora da caixa
    'elk.spacing.nodeNode': String(FOLGA.ROW_GAP + rotuloMax),
    // e o vizinho de lado tem de caber o transbordo do texto pelos dois lados
    'elk.layered.spacing.nodeNodeBetweenLayers': String(FOLGA.PAD + Math.ceil(2 * transbordo)),
  };

  const paraElk = (no) => {
    const kids = d.t.filhos.get(no.id);
    if (kids.length) {
      const c = res.container(no);
      caixas.set(no.id, { container: true, ...c });
      // o rótulo da folha transborda a caixa dela para baixo e para os lados;
      // se o container não reservar isso, o texto vaza pela borda
      const temFolha = kids.some(k => !d.t.filhos.get(k.id).length);
      const folga = temFolha ? Math.ceil(transbordo) : 0;
      const pad = {
        top: c.tituloH + FOLGA.PAD, left: FOLGA.PAD + folga,
        bottom: FOLGA.PAD + (temFolha ? rotuloMax : 0), right: FOLGA.PAD + folga + (medir.get(no.id) || 0),
      };
      paddings.set(no.id, pad);
      return {
        id: no.id,
        layoutOptions: {
          'elk.padding': `[top=${pad.top},left=${pad.left},bottom=${pad.bottom},right=${pad.right}]`,
          ...espacamento,          // sem isto, o container usa os defaults do ELK — ver o aviso acima
        },
        children: kids.map(paraElk),
      };
    }
    const f = res.folha(no);
    caixas.set(no.id, { container: false, ...f });
    return { id: no.id, width: f.caixaW || f.formaW, height: f.formaH };
  };

  const grafo = {
    id: 'root',
    layoutOptions: { ...OPCOES_RAIZ, ...espacamento },
    children: d.t.raizes.map(paraElk),
    // O rótulo da aresta vai JUNTO. Sem ele o ELK aproxima os nós até o vão
    // ficar menor que o texto, e o texto cai em cima do ícone vizinho — que é
    // `A3.2` da rubrica (#8), a falha que ela prevê para gerador automático.
    // Entregando o rótulo, o vão passa a ser calculado para caber nele.
    edges: d.arestas.map(a => {
      const txt = textoDaAresta(a);
      return {
        id: a.id, sources: [a.de], targets: [a.para],
        ...(txt ? { labels: [{ id: a.id + '-rot', text: txt, width: res.larguraDaAresta(txt) + 8, height: 14 }] } : {}),
      };
    }),
  };
  return { grafo, caixas, paddings, rotuloMax, transbordo };
}

/**
 * Largura mínima que o título exige. O contorno que o #7 propõe — alargar o
 * container DEPOIS do layout — pode encostar num irmão (incerteza 7 de lá).
 * Aqui a folga entra como `padding.right` e o ELK relayouta com ela, então os
 * irmãos se afastam sozinhos. Duas passadas, ~180 ms cada no pior caso medido.
 */
function deficitDeTitulo(no, caixa, larguraObtida, res) {
  if (!caixa || !caixa.container) return 0;
  const texto = no.rotulo || '';
  if (!texto) return 0;
  // o rótulo de grupo tem corpo próprio (`texto.grupo`), que pode diferir do de folha
  const precisa = res.larguraDoRotuloDeGrupo(texto) + (caixa.recuoTitulo || 8) + 16;
  return Math.max(0, Math.ceil(precisa - larguraObtida));
}

async function porElk(modelo, d, res) {
  const elk = new ELK();
  let medir = new Map();
  let saida = null;

  for (let passada = 0; passada < 2; passada++) {
    const { grafo, caixas, paddings, rotuloMax } = montarElk(modelo, d, res, medir);
    saida = limpar(await elk.layout(structuredClone(grafo)));
    if (passada === 1) return { saida, caixas, rotuloMax, passadas: 2, encaixe: alinhar(saida, paddings) };

    const proximo = new Map();
    (function medirTitulos(n) {
      for (const c of n.children || []) {
        const no = d.t.porId.get(c.id);
        const def = deficitDeTitulo(no, caixas.get(c.id), c.width, res);
        if (def > 0) proximo.set(c.id, def);
        medirTitulos(c);
      }
    })(saida);
    if (!proximo.size) return { saida, caixas, rotuloMax, passadas: 1, encaixe: alinhar(saida, paddings) };
    medir = proximo;
  }
}

// ------------------------------------------------------------------ caminho B

/**
 * Grade de AZ. O motor fixa o `x` de cada coluna; dentro de cada célula
 * (uma subnet) o ELK arruma o conteúdo. As linhas são os PAPÉIS de subnet
 * — mesma linha, mesmo papel, colunas diferentes — que é o que faz a faixa
 * vertical ler como zona.
 */
async function porGrade(modelo, d, res) {
  const elk = new ELK();
  const FOLGA = folgas(res.tema);
  const caixas = new Map();
  const azs = d.az.azs;

  const vpcs = modelo.nos.filter(n => n.tipo === 'vpc');
  const subnets = modelo.nos.filter(n => n.tipo === 'subnet');

  // 1. cada subnet é layoutada isolada, para saber de que tamanho ela precisa
  const intra = new Map();
  for (const s of subnets) {
    const kids = d.t.filhos.get(s.id);
    const c = res.container(s);
    caixas.set(s.id, { container: true, ...c });
    if (!kids.length) { intra.set(s.id, { w: 200, h: 90, filhos: [] }); continue; }
    const g = {
      id: s.id,
      layoutOptions: {
        'elk.algorithm': 'layered', 'elk.direction': 'RIGHT',
        'elk.spacing.nodeNode': String(FOLGA.nodeNode), 'elk.randomSeed': '1',
        'elk.json.shapeCoords': 'PARENT',
        'elk.padding': `[top=${c.tituloH + FOLGA.PAD},left=${FOLGA.ROW_GAP},bottom=${FOLGA.ROW_GAP},right=${FOLGA.ROW_GAP}]`,
      },
      children: kids.map(k => {
        const f = res.folha(k);
        caixas.set(k.id, { container: false, ...f });
        return { id: k.id, width: f.caixaW || f.formaW, height: f.formaH + f.rotuloH };
      }),
    };
    const r = limpar(await elk.layout(g));
    intra.set(s.id, { w: r.width, h: r.height, filhos: r.children });
  }

  // 2. a coluna é tão larga quanto a subnet mais larga daquela zona; a linha,
  //    tão alta quanto a mais alta daquele papel.
  const papel = s => `${(d.t.ancestrais(s).find(a => a.tipo === 'vpc') || {}).id}|${s.acesso || '?'}|${s.rotulo || ''}`;
  const papeisPorVpc = new Map();
  for (const v of vpcs) papeisPorVpc.set(v.id, []);
  for (const s of subnets) {
    const v = (d.t.ancestrais(s).find(a => a.tipo === 'vpc') || {}).id;
    const lista = papeisPorVpc.get(v);
    if (lista && !lista.includes(papel(s))) lista.push(papel(s));
  }
  /**
   * A ORDEM DAS LINHAS É DERIVADA, não herdada da ordem do arquivo.
   *
   * A primeira versão empilhava as linhas na ordem em que as subnets apareciam
   * em `nos`. Reordenar a lista reordenava o desenho — exatamente a incerteza 4
   * do #7, e ela se confirmou: `check-determinismo` acusou geometria diferente
   * em 2 de 3 embaralhamentos. Importa porque quem escreve o modelo é um
   * agente, e nenhum LLM emite a mesma lista na mesma ordem duas vezes; sem
   * ordem derivada, regerar o mesmo diagrama produz um diff inteiro.
   *
   * Critério: exposição primeiro (pública em cima, que é o sentido de leitura
   * do deck), rótulo como desempate.
   *
   * ⚠️ O desempate alfabético é PLACEHOLDER. Ele acerta "App subnet" antes de
   * "Data subnet" por coincidência do alfabeto, e erraria "Web subnet" depois
   * de "Data subnet". Ordenar camadas privadas por significado exige um fato
   * que o IR ainda não tem — é decisão, não bug. Anotado para o mapa.
   */
  const ordem = { publica: 0, privada: 1, '?': 2 };
  for (const lista of papeisPorVpc.values())
    lista.sort((a, b) => {
      const [, aa, ra] = a.split('|'), [, ab, rb] = b.split('|');
      return (ordem[aa] ?? 9) - (ordem[ab] ?? 9) || ra.localeCompare(rb, 'pt');
    });

  const colW = new Map(azs.map(z => [z, Math.max(200, ...subnets.filter(s => s.az === z).map(s => intra.get(s.id).w))]));
  const colX = new Map();
  let x = 0;
  for (const z of azs) { colX.set(z, x); x += colW.get(z) + FOLGA.COL_GAP; }
  const larguraGrade = x - FOLGA.COL_GAP;

  // 3. empilhar as VPCs; dentro de cada uma, uma linha por papel
  const faixasMembro = (modelo.faixas || []);
  const calhas = new Map();          // id da faixa -> calha lida do estilo dela
  const linhaComFaixa = new Map();   // vpc -> Map(linha -> maior calha que começa nela)
  for (const f of faixasMembro) {
    const calha = calhaDaFaixa(res.faixa(f).style);
    calhas.set(f.id, calha);
    const linhas = f.membros.map(m => {
      const s = d.t.ancestrais(d.t.porId.get(m)).find(a => a.tipo === 'subnet') || d.t.porId.get(m);
      const v = (d.t.ancestrais(s).find(a => a.tipo === 'vpc') || {}).id;
      return { v, idx: papeisPorVpc.get(v) ? papeisPorVpc.get(v).indexOf(papel(s)) : -1 };
    }).filter(x => x.idx >= 0);
    // a calha só é cobrada na PRIMEIRA linha que a faixa toca — é ali que o rótulo mora
    for (const v of new Set(linhas.map(l => l.v))) {
      const primeira = Math.min(...linhas.filter(l => l.v === v).map(l => l.idx));
      if (!linhaComFaixa.has(v)) linhaComFaixa.set(v, new Map());
      const atual = linhaComFaixa.get(v);
      atual.set(primeira, Math.max(atual.get(primeira) || 0, calha));
    }
  }

  const pos = new Map();          // id -> {x,y,w,h} absoluto
  let y = HEAD + AZ_LANE;         // regras 1+4: a calha de AZ nasce abaixo da faixa de título da nuvem — CALHA, não folga
  const vpcBox = new Map();
  for (const v of vpcs) {
    const papeis = papeisPorVpc.get(v.id);
    const comFaixa = linhaComFaixa.get(v.id) || new Map();
    const cV = res.container(v);
    caixas.set(v.id, { container: true, ...cV });

    let h = cV.tituloH + FOLGA.PAD;
    const rowY = [], rowH = [];
    papeis.forEach((p, i) => {
      if (i > 0) h += FOLGA.ROW_GAP + (comFaixa.get(i) || 0);
      const alt = Math.max(90, ...subnets.filter(s => papel(s) === p).map(s => intra.get(s.id).h));
      rowY.push(h); rowH.push(alt); h += alt;
    });
    h += FOLGA.PAD;
    vpcBox.set(v.id, { x: FOLGA.PAD, y, w: larguraGrade + 2 * FOLGA.PAD, h });

    for (const s of subnets) {
      if ((d.t.ancestrais(s).find(a => a.tipo === 'vpc') || {}).id !== v.id) continue;
      const i = papeis.indexOf(papel(s));
      pos.set(s.id, {
        x: 2 * FOLGA.PAD + colX.get(s.az), y: y + rowY[i],
        w: colW.get(s.az), h: rowH[i],
      });
    }
    y += h + FOLGA.COL_GAP + FOLGA.ROW_GAP;
  }

  return { pos, vpcBox, intra, caixas, calhas, colX, colW, azs, larguraGrade,
    fim: y - FOLGA.COL_GAP - FOLGA.ROW_GAP, AZ_LANE, BAND_LANE, CROSS_OUT, HEAD, PAD: FOLGA.PAD, folgas: FOLGA };
}

module.exports = { porElk, porGrade, textoDaAresta, calhaDaFaixa, OPCOES_RAIZ, AZ_LANE, BAND_LANE, CROSS_OUT, HEAD, PAD, limpar, folgas };
