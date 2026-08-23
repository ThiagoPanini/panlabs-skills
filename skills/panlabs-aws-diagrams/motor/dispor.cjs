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
const camadasMod = require('./camadas.cjs');
const { CONTEINERES, FOLHAS } = require('./validar.cjs');

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
 * A quinta calha, e ela é do #12: a linha onde o rótulo da OU mora.
 *
 * Sai da mesma medição das outras: no PPTX do SRA o ícone da OU tem 0,50" de
 * altura e a primeira conta membro começa ≈0,12" abaixo dele (#6 §1.4/§2.2).
 * Com as caixas de conta deste motor girando em 250–550 px de largura contra
 * as 2,5–4" do SRA, a escala é ≈100 px por polegada, então 0,50" + 0,12" ≈ 62.
 *
 * Ela é irmã da `AZ_LANE` e existe pelo mesmo motivo: a faixa é desenhada FORA
 * da árvore, então ninguém reserva espaço para o rótulo dela a não ser o motor.
 */
const OU_LANE = 62;

/**
 * A caixa de um container VAZIO — e ela existe porque o #22 tropeçou nela.
 *
 * Container é quem o ESQUEMA diz que é container, não quem tem filho. Os dois
 * caminhos do ELK decidiam por `kids.length`, e uma subnet sem nada dentro caía
 * no ramo de folha: o motor morria em `res.folha()` com "nó sem chave de
 * serviço" — mensagem que fala de serviço para quem escreveu uma subnet. O
 * caminho da grade nunca teve o problema, porque lá o container vazio já
 * ganhava caixa mínima (200×90); era só o ELK.
 *
 * Subnet vazia não é erro de modelo: é o range reservado para o que ainda não
 * existe, e um diagrama de rede a desenha.
 */
const VAZIO_LARG = 200;
const VAZIO_ALT = 56;

/**
 * Caixa de um container sem filho — uma definição só, para os dois `paraElk`.
 *
 * A largura já sai com o título medido, porque a passada de `deficitDeTitulo`
 * compra folga via `padding.right`, e padding não alarga um nó que não tem
 * conteúdo para empurrar contra a borda.
 */
function caixaVazia(no, c, res) {
  const precisaTitulo = res.larguraDoRotuloDeGrupo(no.rotulo || '') + (c.recuoTitulo || 8) + 16;
  return {
    id: no.id,
    width: Math.max(VAZIO_LARG, Math.ceil(precisaTitulo)),
    height: c.tituloH + VAZIO_ALT,
  };
}

/**
 * E a sexta: a faixa de rótulo de uma RAIA de zona.
 *
 * Com a AZ em coluna, o rótulo das zonas fica todo numa tira só, acima da
 * grade — é a `AZ_LANE`. Transposta, cada raia precisa da própria tira, porque
 * o rótulo é desenhado no canto superior esquerdo da banda e há uma banda por
 * linha. Então a reserva deixa de ser global e passa a viver no vão ENTRE as
 * raias. 26 px é o que o rótulo de 12 px ocupa com folga.
 */
const RAIA_LANE = 26;

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

// Os valores do #11, guardados como referência histórica da escala anterior.
// Nenhum deles é lido: quem manda é `folgas(tema)`.
//   PAD 12 · COL_GAP 30 · ROW_GAP 14 · nodeNode 30 · entreCamadas 46
//
// ⚠️ E é por causa desta linha que o `web-multi-az` deixou de sair byte a byte
// igual ao do #11/#12: a escala mudou de "números chegados um a um" para
// "múltiplos de 8". Ver `docs/recertificacao.md`.

/**
 * A escala de folga, derivada da grade base do tema (#13).
 *
 * Os valores do #11 acima ficam como o que eram — números sem denominador comum,
 * chegados um a um. A camada da casa os reancora numa escala de base 8, e 8 não é
 * gosto: o ícone de serviço é 48 px e o de grupo 40 px (A9/A6 do #5, travados no
 * preset), ambos múltiplos de 8, e a folga mínima entre grupos aninhados
 * (N7: 0.05") é 4,8 px, cujo degrau imediatamente acima é 8.
 *
 * Não existe caminho sem tema. A primeira versão do protótipo do #13 carregava um
 * ramo de fábrica para "manter o #11 rodando idêntico", e ele **não mantinha**:
 * um literal `+10` virou `+PAD` e o `web-multi-az` saiu 6 px mais alto sem que
 * ninguém percebesse. Compatibilidade que ninguém exercita não é compatibilidade,
 * é peso.
 */
function folgas(tema) {
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
 * em `espacamentoDe`, nunca só em OPCOES_RAIZ.
 */
/**
 * ⚠️ QUEM ACRESCENTAR UMA OPÇÃO DE ESPAÇAMENTO mexe em DOIS lugares: `folgas()`,
 * que dá o valor, e aqui, que dá o nome do ELK. Duas metades da mesma decisão —
 * e o aviso de OPCOES_RAIZ acima continua valendo, porque o bloco inteiro tem
 * de ser repetido por container.
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

const OPCOES_RAIZ = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.hierarchyHandling': 'INCLUDE_CHILDREN',   // sem isto cada container é layoutado sozinho
  'elk.edgeRouting': 'ORTHOGONAL',
  'elk.layered.crossingMinimization.semiInteractive': 'true',
  'elk.randomSeed': '1',                          // 0 == semente do relógio
  'elk.json.shapeCoords': 'PARENT',               // == semântica do mxGeometry
  'elk.json.edgeCoords': 'ROOT',                  // default na raiz é CONTAINER, não ROOT
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
    // FOLHA é o tipo, não "quem não tem filho" — ver `caixaVazia`. O teste por
    // contagem de filhos mandava toda subnet vazia para `res.folha()`.
    if (!FOLHAS.has(no.tipo)) continue;
    const f = res.folha(no);
    rotuloMax = Math.max(rotuloMax, f.rotuloH);
    // quanto o texto passa de cada lado do ícone — é isso que precisa caber no
    // vão entre camadas, já que a caixa do layout é a do ícone
    transbordo = Math.max(transbordo, Math.max(0, ((f.rotuloW || 0) - f.formaW) / 2));
  }

  // O espaçamento efetivo depende do rótulo, e precisa ser IDÊNTICO na raiz e
  // em cada container — ver o aviso acima de OPCOES_RAIZ.
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
    if (CONTEINERES.has(no.tipo)) {
      const c = res.container(no);
      caixas.set(no.id, { container: true, ...c });
      if (!kids.length) return caixaVazia(no, c, res);
      // o rótulo da folha transborda a caixa dela para baixo e para os lados;
      // se o container não reservar isso, o texto vaza pela borda
      // "tem folha" é sobre TIPO, igual a `caixaVazia` — um container vazio não é
      // folha, e reservar faixa de rótulo para ele seria o mesmo erro de novo.
      const temFolha = kids.some(k => FOLHAS.has(k.tipo));
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
 * Grade de AZ, nos DOIS eixos — e quem escolhe é o modelo, não o agente.
 *
 * O #11 escreveu esta grade com a AZ em COLUNAS, que era a orientação do
 * protótipo do #19. O #21 fechou depois e decidiu o contrário — mas com uma
 * condição que é fácil perder ao ler só a manchete:
 *
 *   > Quando as DUAS dimensões estão presentes, a dimensão ORDENADA fica com a
 *   > horizontal; a paralela vira raia empilhada na vertical. Passo numerado é
 *   > ordenado; réplica zonal é intercambiável — é isso que "redundância" quer
 *   > dizer. **Sem fluxo numerado, a AZ pode ficar com a coluna, como no deck.**
 *
 * Então a dívida herdada não era "transponha tudo": era "o motor tem de saber
 * os dois eixos, e a escolha é regra". A régua do #21 mediu por quê — 24
 * combinações realistas, fluxo na horizontal vencendo em 24 de 24 QUANDO há
 * passo numerado, porque aí a dimensão ordenada tem 5–11 posições e a paralela
 * tem 2–4, e a dimensão longa vai no lado longo do papel. Sem passo numerado o
 * regime muda e a coluna do deck volta a empatar.
 *
 * A grade é escrita em coordenadas ABSTRATAS — `principal` (papéis de subnet, o
 * eixo do fluxo) e `transversal` (as zonas) — e só no fim é mapeada para (x,y).
 * Transpor é trocar o mapeamento, não reescrever a grade. As VPCs empilham ao
 * longo do PRINCIPAL, porque a faixa de zona atravessa todas elas e ela corre
 * nessa direção.
 */
function eixoDaGrade(modelo) {
  const numerado = (modelo.arestas || []).some(a => a.ordem !== undefined);
  return {
    eixo: numerado ? 'raia' : 'coluna',
    porque: numerado
      ? 'há passo numerado — a dimensão ordenada fica com a horizontal (#21)'
      : 'sem passo numerado — a AZ fica com a coluna, como no deck (#21)',
  };
}

/**
 * A ordem das raias — VARREDURA, não heurística.
 *
 * O #21 mediu as 6 permutações de 3 zonas nos dois eixos e achou piso ZERO de
 * `A5.5` em duas delas; mediu também que a heurística óbvia ("põe o alvo da
 * convergência no meio") apenas TROCA um cruzamento por outro. Com 2 a 4 zonas
 * são 2 a 24 permutações: varrer é exato e barato.
 *
 * O custo é o do #21: aresta entre zonas não vizinhas cruza a faixa de quem
 * está no meio, que é `A5.5` da rubrica (#8).
 */
function ordemDeRaias(modelo, d, subnets) {
  const zonas = [...new Set(subnets.map(s => s.az).filter(Boolean))].sort();
  if (zonas.length < 3) return { zonas, custo: 0, varridas: 0 };

  const zonaDo = id => {
    const n = d.t.porId.get(id);
    if (!n) return null;
    const s = n.tipo === 'subnet' ? n : d.t.ancestrais(n).find(a => a.tipo === 'subnet');
    return s ? s.az : null;
  };
  const cruzam = (modelo.arestas || [])
    .map(a => [zonaDo(a.de), zonaDo(a.para)])
    .filter(([x, y]) => x && y && x !== y);
  if (!cruzam.length) return { zonas, custo: 0, varridas: 0 };

  let melhor = null;
  const todas = permutar(zonas);
  for (const perm of todas) {
    const idx = new Map(perm.map((z, i) => [z, i]));
    let custo = 0;
    for (const [x, y] of cruzam) custo += Math.max(0, Math.abs(idx.get(x) - idx.get(y)) - 1);
    if (!melhor || custo < melhor.custo) melhor = { perm, custo };
  }
  return { zonas: melhor.perm, custo: melhor.custo, varridas: todas.length };
}

/**
 * A QUINTA CALHA — a que o #21 achou e o #11 não tinha.
 *
 *   > A calha só empilha se as bandas SE SOBREPÕEM no eixo transversal; lado a
 *   > lado dividem. Sem essa correção as três faixas de AZ saem em escada.
 *
 * A regra do #19 cobrava a calha na primeira linha que a faixa toca e ficava no
 * MÁXIMO entre as faixas daquela linha — certo para faixas lado a lado, errado
 * para faixas que se sobrepõem, porque essas precisam de espaço uma DEPOIS da
 * outra.
 *
 * Vira um máximo de somas: para cada posição transversal, some as calhas das
 * faixas que começam naquela linha E cobrem aquela posição; a calha da linha é
 * o maior desses totais. Lado a lado, cada posição só vê uma faixa e a soma
 * degenera no máximo de antes — a regra velha é o caso particular desta, e é
 * por isso que trocar uma pela outra não mexe em nenhum desenho existente.
 */
function calhaDaLinha(faixasDaLinha, zonas) {
  let maior = 0;
  for (const z of zonas) {
    let soma = 0;
    for (const f of faixasDaLinha) if (f.zonas.has(z)) soma += f.calha;
    maior = Math.max(maior, soma);
  }
  for (const f of faixasDaLinha) if (!f.zonas.size) maior = Math.max(maior, f.calha);
  return maior;
}

async function porGrade(modelo, d, res) {
  const FOLGA = folgas(res.tema);
  /**
   * A grade RECUSA quando a ordem depende de um fato que o modelo não tem (#22),
   * e recusa ANTES de layoutar coisa nenhuma.
   *
   * Aqui a ordem das linhas é o desenho: a chave de papel manda, sem aresta e
   * sem ELK para desempatar. Uma subnet sem camada de rede, num grupo com mais
   * de um papel para empilhar, é ordem inventada — e ordem inventada põe a
   * camada de dados em cima, que é a leitura que a convenção de rede não quer.
   *
   * Mesma política do resto do caminho da grade: falha com a LISTA, em vez de
   * omitir em silêncio (o A4.2 da rubrica). E a recusa é precisa — só dispara
   * onde a falta muda o desenho, nunca por subnet vazia que não disputa linha
   * com ninguém. O agente lê a mensagem e conserta o modelo; o humano não é
   * chamado, e a premissa 11 continua de pé.
   */
  if (d.lacunas.length) {
    const e = new Error('a grade não sabe empilhar estas linhas — falta a camada de rede das subnets');
    e.erros = camadasMod.textoDaLacuna(d.lacunas);
    throw e;
  }

  const elk = new ELK();
  const caixas = new Map();
  const { eixo, porque: porqueEixo } = eixoDaGrade(modelo);
  const raia = eixo === 'raia';

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
        'elk.spacing.nodeNode': '30', 'elk.randomSeed': '1',
        'elk.json.shapeCoords': 'PARENT',
        'elk.padding': `[top=${c.tituloH + 10},left=14,bottom=14,right=14]`,
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

  // A chave de papel é UMA — a do `camadas.cjs`. Ela era construída aqui e lá,
  // com a mesma expressão escrita duas vezes; duas definições de "papel" seriam
  // duas grades, e a que decide a camada tem de ser a mesma que vira linha.
  const papel = s => camadasMod.chaveDePapel(s, d.t);
  const vpcDe = s => (d.t.ancestrais(s).find(a => a.tipo === 'vpc') || {}).id;

  const varreduraRaias = ordemDeRaias(modelo, d, subnets);
  const zonas = varreduraRaias.zonas;

  const papeisPorVpc = new Map();
  for (const v of vpcs) papeisPorVpc.set(v.id, []);
  for (const s of subnets) {
    const lista = papeisPorVpc.get(vpcDe(s));
    if (lista && !lista.includes(papel(s))) lista.push(papel(s));
  }
  /**
   * A ORDEM DOS PAPÉIS É DERIVADA, não herdada da ordem do arquivo.
   *
   * A primeira versão empilhava as linhas na ordem em que as subnets apareciam
   * em `nos`. Reordenar a lista reordenava o desenho — exatamente a incerteza 4
   * do #7, e ela se confirmou: `check-determinismo` acusou geometria diferente
   * em 2 de 3 embaralhamentos. Importa porque quem escreve o modelo é um
   * agente, e nenhum LLM emite a mesma lista na mesma ordem duas vezes; sem
   * ordem derivada, regerar o mesmo diagrama produz um diff inteiro.
   *
   * Critério: exposição primeiro (pública antes, que é o sentido de leitura do
   * deck), CAMADA DE REDE depois, rótulo como último desempate.
   *
   * O #22 fechou o placeholder que ficou aberto aqui. O desempate do meio era
   * alfabético e acertava `App · Data` por coincidência; agora quem manda é a
   * camada que o papel ocupa, lida do que as subnets dele guardam
   * (`camadas.cjs`). O alfabeto continua no fim e mudou de função: não carrega
   * mais significado, só fecha a ordem total que o determinismo exige.
   *
   * Nenhum papel chega aqui sem camada — a recusa lá em cima já barrou.
   */
  /**
   * O comparador lê CAMPOS, não pedaços da chave.
   *
   * A versão anterior fazia `a.split('|')` e pegava a exposição e o rótulo por
   * posição — o que quebra em silêncio no dia em que um rótulo tiver `|`
   * dentro: a chave ganha um quarto pedaço e o desempate passa a comparar o
   * lado errado do texto. O `papeisDeSubnet` já devolve o papel como objeto;
   * basta consultá-lo.
   */
  const porChave = camadasMod.papeisDeSubnet(modelo, d.t, d.camadas);
  const ordemDe = chave => {
    const p = porChave.get(chave) || {};
    return [camadasMod.ordemDeAcesso(p.acesso), camadasMod.ordemDeCamada(p.camada), p.rotulo || ''];
  };
  for (const lista of papeisPorVpc.values())
    lista.sort((a, b) => {
      const ka = ordemDe(a), kb = ordemDe(b);
      return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2], 'pt');
    });

  // 2. a extensão TRANSVERSAL de cada zona: largura com AZ em coluna, altura
  //    com AZ em raia. É aqui, e só aqui, que a transposição encosta na medida.
  const extT = s => raia ? intra.get(s.id).h : intra.get(s.id).w;
  const extP = s => raia ? intra.get(s.id).w : intra.get(s.id).h;
  const minT = raia ? 90 : 200;
  const minP = raia ? 200 : 90;

  /**
   * O gap PRINCIPAL com a grade transposta tem de caber o rótulo da aresta.
   *
   * Com a AZ em coluna, o principal é o Y e o vão entre papéis só separa
   * caixas — 14 px bastam. Transposta, o principal é o X e é exatamente ali que
   * o rótulo do passo numerado é desenhado. É o mesmo achado do #11 no caminho
   * do ELK ("entregue o rótulo ao layout, senão ele aproxima os nós até o texto
   * cair em cima do ícone vizinho"), só que aqui não há ELK para entregar: quem
   * reserva é a grade.
   */
  const larguraDoRotulo = Math.max(0, ...d.arestas.map(a => res.larguraDaAresta(textoDaAresta(a))));
  const GAP_T = raia ? FOLGA.ROW_GAP : FOLGA.COL_GAP;
  const GAP_P = raia ? Math.max(FOLGA.ROW_GAP, larguraDoRotulo + 24) : FOLGA.ROW_GAP;

  const tamT = new Map(zonas.map(z =>
    [z, Math.max(minT, ...subnets.filter(s => s.az === z).map(extT))]));

  /**
   * 3. as faixas de membros, e em QUE EIXO a calha delas é cobrada.
   *
   * A calha existe para o RÓTULO da faixa, e o rótulo da faixa é desenhado no
   * topo dela — em -Y, sempre, porque é onde o `verticalAlign=top` do estilo o
   * põe. Então a calha é cobrada no eixo que estiver mapeado em Y:
   *
   *   AZ em coluna  Y é o PRINCIPAL     → cobra na linha de papel onde a faixa começa
   *   AZ em raia    Y é o TRANSVERSAL   → cobra na raia onde a faixa começa
   *
   * O #19 só viu o primeiro caso, porque lá só havia um eixo. Ignorar isso na
   * grade transposta foi visível no primeiro render: o Auto Scaling group subiu
   * o próprio rótulo para dentro da faixa de título da VPC, e o gap entre as
   * colunas de papel ganhou 49 px que ninguém pediu.
   */
  const calhas = new Map();
  const porLinha = new Map();      // vpc -> Map(linha de papel -> [{calha, zonas}])
  const porRaia = new Map();       // índice da raia -> calha acumulada
  for (const f of (modelo.faixas || [])) {
    const calha = calhaDaFaixa(res.faixa(f).style);
    calhas.set(f.id, calha);
    const membros = f.membros.map(m => {
      const s = d.t.ancestrais(d.t.porId.get(m)).find(a => a.tipo === 'subnet') || d.t.porId.get(m);
      const v = vpcDe(s);
      return { v, az: s.az, idx: papeisPorVpc.get(v) ? papeisPorVpc.get(v).indexOf(papel(s)) : -1 };
    }).filter(x => x.idx >= 0);

    if (raia) {
      const idxs = membros.map(l => zonas.indexOf(l.az)).filter(i => i >= 0);
      if (!idxs.length) continue;
      const primeira = Math.min(...idxs);
      porRaia.set(primeira, Math.max(porRaia.get(primeira) || 0, calha));
      continue;
    }
    for (const v of new Set(membros.map(l => l.v))) {
      const meus = membros.filter(l => l.v === v);
      const primeira = Math.min(...meus.map(l => l.idx));
      if (!porLinha.has(v)) porLinha.set(v, new Map());
      const mapa = porLinha.get(v);
      if (!mapa.has(primeira)) mapa.set(primeira, []);
      mapa.get(primeira).push({ calha, zonas: new Set(meus.map(l => l.az).filter(Boolean)) });
    }
  }

  /**
   * A reserva de cada raia é a SOMA de duas tiras, não o máximo.
   *
   * Empilhar em vez de compartilhar é a mesma regra que o #21 achou para duas
   * bandas na mesma linha, aplicada entre uma banda DERIVADA (a raia de zona) e
   * uma banda de MEMBROS (o Auto Scaling group): elas se sobrepõem no eixo
   * transversal — o ASG está dentro da raia — então precisam de espaço uma
   * depois da outra.
   *
   * Sem isso os dois rótulos caem na mesma linha. Visto no render: o
   * "Auto Scaling group" laranja em cima do "Availability Zone · us-east-1b"
   * ciano, porque o estilo `groupCenter` desenha o rótulo 25 px abaixo do topo
   * da banda — exatamente onde o rótulo da raia estava.
   */
  const posT = new Map();
  const reservaDaRaia = new Map();
  let t = 0;
  for (const [i, z] of zonas.entries()) {
    if (i > 0) t += GAP_T;
    const reserva = raia ? RAIA_LANE + (porRaia.get(i) || 0) : 0;
    reservaDaRaia.set(z, reserva);
    t += reserva;
    posT.set(z, t);
    t += tamT.get(z);
  }
  const extensaoT = t;

  // 4. empilhar as VPCs ao longo do eixo PRINCIPAL
  const pos = new Map();
  const vpcBox = new Map();
  // regras 1+4 do #19: a calha da zona nasce sempre ABAIXO da faixa de título de
  // quem a contém. Em coluna, isso é um deslocamento no principal (o Y); em
  // raia, o rótulo da zona vive na calha ENTRE as raias, então o principal
  // começa na margem e é o transversal que carrega a reserva.
  let p = raia ? FOLGA.PAD : HEAD + AZ_LANE;
  for (const v of vpcs) {
    const papeis = papeisPorVpc.get(v.id);
    const doVpc = porLinha.get(v.id) || new Map();
    const cV = res.container(v);
    caixas.set(v.id, { container: true, ...cV });

    // a faixa de título do container consome o PRINCIPAL quando o principal é o
    // Y; com a grade transposta ela consome o transversal, não o principal
    let corrida = raia ? FOLGA.PAD : cV.tituloH + FOLGA.PAD;
    const posP = [], tamP = [];
    papeis.forEach((pa, i) => {
      if (i > 0) corrida += GAP_P + calhaDaLinha(doVpc.get(i) || [], zonas);
      const ext = Math.max(minP, ...subnets.filter(s => papel(s) === pa).map(extP));
      posP.push(corrida); tamP.push(ext); corrida += ext;
    });
    corrida += FOLGA.PAD;

    // o topo do conteúdo dentro da VPC: título + padding, mais a faixa de
    // rótulo da primeira raia quando a grade está transposta
    const desloT = raia ? HEAD + cV.tituloH + FOLGA.PAD : 2 * FOLGA.PAD;
    vpcBox.set(v.id, raia
      ? { x: p, y: HEAD, w: corrida, h: cV.tituloH + FOLGA.PAD + extensaoT + FOLGA.PAD }
      : { x: FOLGA.PAD, y: p, w: extensaoT + 2 * FOLGA.PAD, h: corrida });

    for (const s of subnets) {
      if (vpcDe(s) !== v.id) continue;
      const i = papeis.indexOf(papel(s));
      pos.set(s.id, raia
        ? { x: p + posP[i], y: desloT + posT.get(s.az), w: tamP[i], h: tamT.get(s.az) }
        : { x: 2 * FOLGA.PAD + posT.get(s.az), y: p + posP[i], w: tamT.get(s.az), h: tamP[i] });
    }
    p += corrida + FOLGA.COL_GAP + FOLGA.ROW_GAP;
  }

  const fimP = p - FOLGA.COL_GAP - FOLGA.ROW_GAP;
  const alturaRaia = vpcs.length
    ? Math.max(...[...vpcBox.values()].map(b => b.y + b.h))
    : HEAD;

  return {
    pos, vpcBox, intra, caixas, calhas, zonas, azs: zonas, eixo, raia, porqueEixo,
    varreduraRaias, RAIA_LANE, reservaDaRaia,
    colX: posT, colW: tamT, posT, tamT, extensaoT,
    larguraGrade: raia ? fimP : extensaoT,
    fim: raia ? alturaRaia : fimP,
    AZ_LANE, BAND_LANE, CROSS_OUT, HEAD, PAD: FOLGA.PAD,
  };
}

// ------------------------------------------------------------------ caminho C

/**
 * Multi-conta (#12). Terceiro caminho, mesma divisão de trabalho dos outros
 * dois: o motor fica com a grade, o ELK fica com o conteúdo de cada célula —
 * só que aqui a célula é uma CONTA.
 *
 * Por que a conta não pode ser deixada com o ELK: `antes-elk-sem-politica.png`
 * mostra o custo. O ELK dispõe as contas pelo grafo de arestas, então elas
 * saem espalhadas na diagonal, de tamanhos díspares, sem ordem de leitura e
 * com metade da nuvem vazia. Nenhuma das regras medidas no #6 — ordem
 * canônica `P1`, alinhamento `S5`, calha `X1`, contraste de gap 1:4 `S3` — tem
 * como ser expressa em opção de ELK: elas falam de CONTAS, e o ELK não sabe o
 * que é uma conta.
 */

// Os gaps saem da geometria medida no PPTX do SRA (#6 §2.2), e o que carrega
// peso é a RAZÃO, não o valor: gap entre irmãs da mesma OU 0,11–0,15";
// gap entre grupos de OU ≈0,51". O contraste de 1:4 é o que faz o agrupamento
// por OU ser legível SEM desenhar caixa nenhuma (`S3`) — e como a AWS não tem
// shape de OU (`G2`), é ele que faz o trabalho todo.
const GAP_IRMA = 22;
const GAP_OU = 4 * GAP_IRMA;
// `X1`/`X2`: na vista de integração as contas ficam lado a lado com uma calha
// LARGA, porque é nela que mora o elemento compartilhado (peering, PrivateLink,
// TGW) e é por ela que a travessia respira.
const CALHA = 130;

/**
 * `P1` — a ordem de leitura canônica, medida em três diagramas oficiais
 * independentes (SRA, MALZ, phase-1): governança → segurança → infraestrutura
 * → workload. A conta sem OU vem primeiro porque é a Management, que o `P2`
 * põe no topo e fora de qualquer OU.
 */
const RANK_OU = ['management', 'security', 'infrastructure', 'infra', 'network',
  'shared services', 'shared', 'workloads', 'workload', 'application', 'sandbox'];

function rankOu(ou) {
  if (!ou) return -1;                       // sem OU = Management, e ela vem antes de tudo (P2)
  const k = String(ou).toLowerCase();
  const i = RANK_OU.findIndex(r => k.includes(r));
  return i >= 0 ? i : RANK_OU.length;       // OU que a AWS não nomeia vai depois das que ela nomeia
}

/** Permutações de uma lista curta. Só é chamada com n ≤ 4 — ver `ordemDeContas`. */
function permutar(xs) {
  if (xs.length <= 1) return [xs];
  const out = [];
  for (let i = 0; i < xs.length; i++)
    for (const resto of permutar([...xs.slice(0, i), ...xs.slice(i + 1)]))
      out.push([xs[i], ...resto]);
  return out;
}

/**
 * A ordem das contas ao longo do eixo.
 *
 * VARREDURA, NÃO HEURÍSTICA — a lição do #21, que mediu que "põe o alvo da
 * convergência no meio" apenas TROCA um cruzamento por outro. Lá as raias eram
 * AZs; aqui são contas, e a aritmética é a mesma: `X1` limita a vista de
 * integração a 4 contas, então são no máximo 24 permutações. Varrer é barato e
 * exato; adivinhar é barato e errado.
 *
 * O custo tem dois termos, e a ordem entre eles é o que importa:
 *
 *   PULO (peso 10)  travessia entre contas não adjacentes — a aresta atravessa
 *                   a caixa de uma terceira conta. É `A5.5` da rubrica (#8),
 *                   aresta cortando faixa alheia, e é o que faz o desenho
 *                   virar espaguete.
 *   CONTRAMÃO (1)   travessia apontando para trás. `X5` diz que o eixo
 *                   esquerda→direita segue o fluxo primário; uma aresta contra
 *                   o eixo não mente, só lê pior.
 *
 * O desempate final é a ordem canônica `P1`, para que dois layouts de mesmo
 * custo não dependam da ordem em que o agente escreveu a lista (#11 mediu que
 * nenhum LLM emite a mesma lista duas vezes).
 */
function ordemDeContas(contas, cruz, modo) {
  const canonica = [...contas].sort((a, b) =>
    rankOu(a.ou) - rankOu(b.ou) ||
    String(a.rotulo || a.id).localeCompare(String(b.rotulo || b.id), 'pt'));

  if (modo !== 'integracao' || !cruz.length) return { ordem: canonica, custo: null, varridas: 0 };

  const custoDe = (perm) => {
    const pos = new Map(perm.map((c, i) => [c.id, i]));
    let pulo = 0, contramao = 0;
    for (const a of cruz) {
      const i = pos.get(a.contaDe), j = pos.get(a.contaPara);
      if (i === undefined || j === undefined) continue;
      if (Math.abs(i - j) > 1) pulo += Math.abs(i - j) - 1;
      if (j < i) contramao++;
    }
    return 10 * pulo + contramao;
  };

  /**
   * O desempate é INVERSÕES contra a ordem canônica, e isso não é detalhe.
   *
   * Neste modelo de três contas duas permutações empatam em custo 1 — as duas
   * que põem o workload no meio — e a diferença entre elas é ler
   * `Network | Workload | Data` ou `Data | Workload | Network`. "A primeira que
   * a enumeração achar" é determinística e arbitrária; contar inversões contra
   * `P1` é determinística e SIGNIFICATIVA: entre dois layouts igualmente bons
   * para a aresta, ganha o que estiver mais perto da ordem de leitura que a AWS
   * usa.
   */
  const idxCanonico = new Map(canonica.map((c, i) => [c.id, i]));
  const inversoes = (perm) => {
    let n = 0;
    for (let i = 0; i < perm.length; i++)
      for (let j = i + 1; j < perm.length; j++)
        if (idxCanonico.get(perm[i].id) > idxCanonico.get(perm[j].id)) n++;
    return n;
  };

  let melhor = null;
  const todas = permutar(canonica);
  for (const perm of todas) {
    const c = custoDe(perm), inv = inversoes(perm);
    if (!melhor || c < melhor.custo || (c === melhor.custo && inv < melhor.inv))
      melhor = { perm, custo: c, inv };
  }
  return { ordem: melhor.perm, custo: melhor.custo, inversoes: melhor.inv, varridas: todas.length };
}

/**
 * Layout do INTERIOR de uma conta: o ELK arruma a subárvore e as arestas internas.
 *
 * Duas passadas, pelo mesmo motivo do caminho A: uma conta cujo conteúdo é
 * estreito sai mais estreita que o próprio título, e o rótulo vaza por baixo da
 * caixa. Foi o que aconteceu com "Org Management" e "Shared Services" no
 * primeiro render da landing zone — duas linhas de texto pendurdas fora da
 * borda magenta. A folga entra como `padding.right` e o ELK relayouta com ela,
 * então nada precisa ser esticado depois (que é o contorno que o #7 propõe e
 * que pode encostar num irmão).
 */
async function layoutDaConta(elk, conta, d, res, caixas, metrica, medir = new Map()) {
  const FOLGA = folgas(res.tema);
  const espacamento = {
    ...espacamentoDe(FOLGA),
    'elk.spacing.nodeNode': String(FOLGA.ROW_GAP + metrica.rotuloMax),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(FOLGA.PAD + Math.ceil(2 * metrica.transbordo)),
  };

  const paraElk = (no) => {
    const kids = d.t.filhos.get(no.id);
    if (CONTEINERES.has(no.tipo)) {
      const c = res.container(no);
      caixas.set(no.id, { container: true, ...c });
      if (!kids.length) return caixaVazia(no, c, res);
      const temFolha = kids.some(k => FOLHAS.has(k.tipo));   // por TIPO — ver `caixaVazia`
      const folga = temFolha ? Math.ceil(metrica.transbordo) : 0;
      return {
        id: no.id,
        layoutOptions: {
          'elk.padding': `[top=${c.tituloH + FOLGA.PAD},left=${FOLGA.PAD + folga},` +
            `bottom=${FOLGA.PAD + (temFolha ? metrica.rotuloMax : 0)},right=${FOLGA.PAD + folga + (medir.get(no.id) || 0)}]`,
          ...espacamento,
        },
        children: kids.map(paraElk),
      };
    }
    const f = res.folha(no);
    caixas.set(no.id, { container: false, ...f });
    return { id: no.id, width: f.caixaW || f.formaW, height: f.formaH };
  };

  const cC = res.container(conta);
  caixas.set(conta.id, { container: true, ...cC });
  const folgaConta = d.t.filhos.get(conta.id).some(k => FOLHAS.has(k.tipo))
    ? metrica.transbordo : 0;                              // por TIPO — ver `caixaVazia`

  // só as arestas cujas DUAS pontas moram nesta conta — a travessia é do motor
  const dentro = new Set();
  (function marcar(id) { dentro.add(id); for (const k of d.t.filhos.get(id)) marcar(k.id); })(conta.id);
  const internas = d.arestas.filter(a => dentro.has(a.de) && dentro.has(a.para));

  const grafo = {
    id: conta.id,
    layoutOptions: {
      ...OPCOES_RAIZ,
      'elk.json.edgeCoords': 'CONTAINER',   // dentro da conta, o espaço é o da conta
      // a folga lateral vale para a CONTA também, não só para os containers de
      // dentro: o rótulo da folha é desenhado centrado sob o ícone e mais largo
      // que ele, então sem isto "IAM Identity Center" encosta na borda magenta
      'elk.padding': `[top=${cC.tituloH + FOLGA.PAD},left=${FOLGA.PAD + folgaConta},` +
        `bottom=${FOLGA.PAD + metrica.rotuloMax},right=${FOLGA.PAD + folgaConta + (medir.get(conta.id) || 0)}]`,
      ...espacamento,
    },
    children: d.t.filhos.get(conta.id).map(paraElk),
    edges: internas.map(a => {
      const txt = textoDaAresta(a);
      return {
        id: a.id, sources: [a.de], targets: [a.para],
        ...(txt ? { labels: [{ id: a.id + '-rot', text: txt, width: res.larguraDaAresta(txt) + 8, height: 14 }] } : {}),
      };
    }),
  };
  return limpar(await elk.layout(grafo));
}

/** As duas medidas de rótulo que todo caminho precisa antes de montar grafo nenhum. */
function metricaDeRotulo(modelo, d, res) {
  let rotuloMax = 0, transbordo = 0;
  for (const no of modelo.nos) {
    if (!FOLHAS.has(no.tipo)) continue;              // ver `caixaVazia`
    const f = res.folha(no);
    rotuloMax = Math.max(rotuloMax, f.rotuloH);
    transbordo = Math.max(transbordo, Math.max(0, ((f.rotuloW || 0) - f.formaW) / 2));
  }
  return { rotuloMax, transbordo: Math.ceil(transbordo) };
}

async function porContas(modelo, d, res) {
  const elk = new ELK();
  const caixas = new Map();
  const metrica = metricaDeRotulo(modelo, d, res);
  const contas = modelo.nos.filter(n => n.tipo === 'conta');
  const modo = d.modo.modo;

  // 1. cada conta é layoutada isolada, para saber de que tamanho ela precisa (S4)
  const interno = new Map();
  for (const c of contas) {
    let medir = new Map(), r = null;
    for (let passada = 0; passada < 2; passada++) {
      r = await layoutDaConta(elk, c, d, res, caixas, metrica, medir);
      const proximo = new Map();
      const def = deficitDeTitulo(c, caixas.get(c.id), r.width, res);
      if (def > 0) proximo.set(c.id, def);
      (function medirTitulos(n) {
        for (const filho of n.children || []) {
          const no = d.t.porId.get(filho.id);
          const dd = deficitDeTitulo(no, caixas.get(filho.id), filho.width, res);
          if (dd > 0) proximo.set(filho.id, dd);
          medirTitulos(filho);
        }
      })(r);
      if (!proximo.size) break;
      medir = proximo;
    }
    interno.set(c.id, r);
  }

  // 2. a ordem ao longo do eixo — varrida na integração, canônica no inventário
  const { ordem, custo, varridas } = ordemDeContas(contas, d.travessias, modo);

  // `X6`: a conta que é hub ganha ênfase de borda, os spokes ficam finos. Só
  // marca quem DOMINA — empate não tem hub, e uma ênfase que não distingue é
  // ruído. Hub = quem mais participa de travessia.
  const grau = new Map(contas.map(c => [c.id, 0]));
  for (const a of d.travessias) {
    grau.set(a.contaDe, (grau.get(a.contaDe) || 0) + 1);
    grau.set(a.contaPara, (grau.get(a.contaPara) || 0) + 1);
  }
  const ranking = [...grau.entries()].sort((a, b) => b[1] - a[1]);
  // e SÓ na vista de integração: `X6` sai dos diagramas em que a travessia está
  // desenhada, e no inventário ela não está. Engrossar a borda de uma conta por
  // causa de arestas que a vista suprimiu é afirmar uma ênfase que o leitor não
  // tem como conferir.
  const hub = modo === 'integracao' && ranking.length > 1 &&
    ranking[0][1] > ranking[1][1] && ranking[0][1] >= 2
    ? ranking[0][0] : null;

  // 3. a grade. Integração: uma fileira, calha larga (X1). Inventário: uma
  //    COLUNA por grupo de OU, contas empilhadas dentro dela (a disposição do
  //    SRA, medida em §2.2), com o contraste de gap 1:4 fazendo o agrupamento.
  const pos = new Map();
  let larguraTotal = 0, alturaTotal = 0;
  const colunas = [];

  if (modo === 'integracao') {
    let x = 0;
    const alt = Math.max(...ordem.map(c => interno.get(c.id).height));
    ordem.forEach((c, i) => {
      const g = interno.get(c.id);
      if (i > 0) x += CALHA;
      // `S5` transposto: numa COLUNA as contas são left-aligned na origem; numa
      // FILEIRA, top-aligned. O topo reto é o que deixa a travessia sair
      // horizontal e curta.
      pos.set(c.id, { x, y: 0, w: g.width, h: g.height });
      x += g.width;
    });
    larguraTotal = x; alturaTotal = alt;
    colunas.push({ ou: null, contas: ordem.map(c => c.id) });
  } else {
    // agrupa em colunas por OU, preservando a ordem canônica já calculada
    let atual = null;
    for (const c of ordem) {
      const chave = c.ou || null;
      if (!atual || atual.ou !== chave) { atual = { ou: chave, contas: [] }; colunas.push(atual); }
      atual.contas.push(c.id);
    }
    let x = 0;
    for (const [i, col] of colunas.entries()) {
      if (i > 0) x += GAP_OU;
      const larg = Math.max(...col.contas.map(id => interno.get(id).width));
      let y = d.ou.desenhar ? OU_LANE : 0;   // a faixa de rótulo da OU nasce acima do primeiro membro
      col.x = x; col.larg = larg; col.y = 0;
      for (const id of col.contas) {
        const g = interno.get(id);
        pos.set(id, { x, y, w: g.width, h: g.height });   // S5: left-aligned na origem da coluna
        y += g.height + GAP_IRMA;
      }
      col.alt = y - GAP_IRMA;
      alturaTotal = Math.max(alturaTotal, col.alt);
      x += larg;
    }
    larguraTotal = x;
  }

  return {
    pos, interno, caixas, ordem, colunas, modo, hub,
    largura: larguraTotal, altura: alturaTotal,
    varredura: { custo, varridas },
    metrica, GAP_IRMA, GAP_OU, CALHA, OU_LANE,
  };
}

module.exports = {
  porElk, porGrade, porContas, ordemDeContas, ordemDeRaias, eixoDaGrade, calhaDaLinha,
  rankOu, metricaDeRotulo,
  textoDaAresta, calhaDaFaixa, OPCOES_RAIZ,
  AZ_LANE, BAND_LANE, CROSS_OUT, HEAD, GAP_IRMA, GAP_OU, CALHA, OU_LANE, limpar, folgas,
};
