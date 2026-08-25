'use strict';
/**
 * O índice das 62 checagens mecanizáveis da rubrica (#8).
 *
 * Este arquivo é a tabela, não o cálculo. Ele existe separado das famílias por
 * um motivo concreto: a pergunta "quais das 62 o validador cobre, com que
 * severidade, e o que sobrou para o render" tem de ser respondível sem executar
 * nada e sem ler oito módulos. `tests/check-index.cjs` confere a tabela contra
 * a rubrica, e é o que impede o índice de perder uma checagem em silêncio.
 *
 * Quatro campos carregam as decisões que o #18 tinha de tomar:
 *
 *   `severidade`  a PIOR severidade que a checagem pode emitir. Sete checagens
 *                 escalonam com a medida (A2.1 é warn em 7–8 entradas de legenda
 *                 e fail acima de 8); elas trazem `escalona: true`, e quem decide
 *                 o caso concreto é a checagem, não a tabela.
 *
 *   `insumo`      de onde sai o dado. É a divisão validador × render, e ela é
 *                 uma PARTIÇÃO: `render` é do juiz oportunista, todo o resto é do
 *                 validador obrigatório. Nenhum id nos dois lados, nenhum id fora
 *                 dos dois. Quem cai em `render` explica por quê em `porqueRender`.
 *
 *   `calibravel`  o número não tem base experimental — é a lista do U8 da rubrica.
 *                 Vira chave em `thresholds.json` com `porque: null`, e o campo vazio
 *                 é o pedido de medição.
 *
 *   `semantica`   a falha não é feia, é FALSA: o desenho afirma um fato de
 *                 arquitetura que não existe. São A4.2, A4.4 e A5.5. É o que
 *                 separa este validador de um linter de estética, e por isso
 *                 tolerância zero nas três não é rigor, é o mínimo.
 *
 * Os insumos, do mais barato ao mais caro:
 *
 *   geometria  x/y/w/h absolutos e polilinhas — sai do plano sozinho
 *   estilo     a style string do mxGraph já parseada (cor, traço, fonte, seta)
 *   modelo     o modelo semântico que viaja dentro do plano (célula `panlabs-modelo`)
 *   catalogo   o catálogo de shapes AWS (#17) — nome oficial, cor oficial, vigência
 *   render     pixels ou métrica de fonte real. NÃO é do validador.
 */

const path = require('path');
const bruto = require(path.join(__dirname, 'thresholds.json'));

/** Os limiares num mapa chato, porque quem consulta quer o número, não o grupo. */
const THRESHOLDS = Object.freeze({ ...bruto.normativos, ...bruto.calibraveis });

const SEVERITIES = ['fail', 'warn'];
const INPUTS = ['geometry', 'style', 'model', 'catalog', 'render'];

/** Atalho: o valor cru de um limiar, pelo nome. */
const lim = key => {
  if (!(key in THRESHOLDS)) throw new Error(`limiar "${key}" não existe em thresholds.json`);
  return THRESHOLDS[key].valor;
};

const CHECKS = [

  // ------------------------------------------------------------------- A1
  // "Não é geometria, é presença de campos" — a rubrica. O grupo mais barato e
  // o de maior retorno: é o checklist do C4 virado em asserção.
  {
    id: 'A1.1', family: 'A1', name: 'Título presente', severity: 'fail', input: 'model',
    mede: 'o diagrama se descreve sozinho: título com tipo de diagrama e escopo',
    limiar: { descricao: 'presente e não vazio' },
    fonte: 'C4 (/diagrams/notation); Azure WAF ("Include metadata")',
  },
  {
    id: 'A1.2', family: 'A1', name: 'Legenda presente', severity: 'fail', input: 'geometry',
    mede: 'existe uma legenda no canvas',
    limiar: { descricao: 'presente' },
    fonte: 'C4 ("Every diagram should have a key/legend")',
  },
  {
    id: 'A1.3', family: 'A1', name: 'Legenda completa (cobertura de canal visual)', severity: 'fail', input: 'style',
    mede: 'todo valor de canal visual efetivamente usado tem entrada na legenda',
    limiar: { descricao: '|valores_sem_entrada| = 0' },
    fonte: 'C4 review checklist; Azure WAF ("Provide a legend")',
  },
  {
    id: 'A1.4', family: 'A1', name: 'Todo elemento nomeado', severity: 'fail', input: 'geometry',
    mede: '∀ nó, grupo: rótulo ≠ ""',
    limiar: { descricao: '100%' },
    fonte: 'C4 checklist; Azure WAF ("Label everything clearly"); Azure Icons',
  },
  {
    id: 'A1.5', family: 'A1', name: 'Todo elemento tipado', severity: 'fail', input: 'model',
    mede: '∀ nó, grupo: tipo ∈ catálogo',
    limiar: { descricao: '100%' },
    fonte: 'C4 ("The type of every element should be explicitly specified")',
  },
  {
    id: 'A1.6', family: 'A1', name: 'Toda aresta rotulada', severity: 'fail', input: 'geometry',
    mede: '∀ aresta: rótulo ≠ ""',
    limiar: { descricao: '100%' },
    fonte: 'C4 ("Every line should be labelled"); Azure WAF',
  },
  {
    id: 'A1.7', family: 'A1', name: 'Toda aresta unidirecional', severity: 'fail', input: 'style',
    mede: '∀ aresta: exatamente uma ponta de seta',
    limiar: { descricao: '0 arestas bidirecionais' },
    fonte: 'C4 ("unidirectional relationship"); Azure WAF ("Avoid bidirectional arrows")',
  },
  {
    id: 'A1.8', family: 'A1', name: 'Nenhuma linha sem seta', severity: 'fail', input: 'style',
    mede: '∀ aresta: ao menos uma ponta de seta',
    limiar: { descricao: '100%' },
    fonte: 'Azure WAF ("Lines without arrows make relationships unclear")',
  },
  {
    id: 'A1.9', family: 'A1', name: 'Siglas expandidas', severity: 'warn', input: 'catalog',
    mede: 'sigla em rótulo que não é nome oficial de serviço AWS aparece expandida',
    limiar: { descricao: '0 siglas não explicadas' },
    fonte: 'C4 ("Acronyms and abbreviations ... should be understandable by all audiences")',
  },
  {
    id: 'A1.10', family: 'A1', name: 'Um nível de abstração', severity: 'fail', input: 'model',
    mede: '|distinct(nível de abstração)| == 1',
    limiar: { descricao: '1' },
    fonte: 'C4 FAQ ("at the same level of abstraction"); Azure WAF ("Layer, don\'t overload")',
  },
  {
    id: 'A1.11', family: 'A1', name: 'Metadados de frescor', severity: 'warn', input: 'model',
    mede: 'data, versão e autor presentes',
    limiar: { descricao: 'presentes' },
    fonte: 'Azure WAF ("title, description, last updated date, author, version")',
  },
  {
    id: 'A1.12', family: 'A1', name: 'Nenhum shape órfão', severity: 'fail', input: 'geometry',
    mede: 'todo objeto de desenho pertence a nós ∪ grupos ∪ arestas ∪ rótulos ∪ legenda ∪ título',
    limiar: { descricao: '0 órfãos' },
    fonte: 'Tufte, Visual Display, "Erase non-data-ink" (adaptado)',
  },

  // ------------------------------------------------------------------- A2
  {
    id: 'A2.1', family: 'A2', name: 'Complexidade gráfica ≤ 6', severity: 'fail', escalona: true, input: 'style',
    mede: 'número de entradas distintas que a legenda precisaria ter (tipos de símbolo, não instâncias)',
    limiar: { key: 'complexidadeGraficaAlvo', descricao: `≤ ${lim('complexidadeGraficaAlvo')}; warn em 7–8; fail acima de ${lim('complexidadeGraficaFalha')}` },
    fonte: 'Moody, Physics of Notations ("span of absolute judgement is around 6 categories")',
  },
  {
    id: 'A2.2', family: 'A2', name: 'Ícone íntegro', severity: 'fail', input: 'style',
    mede: 'nenhum ícone espelhado, girado, cisalhado ou recortado',
    limiar: { descricao: '100% dos ícones' },
    fonte: 'AWS deck (DON\'T crop/flip/rotate); Azure Icons; Azure WAF',
  },
  {
    id: 'A2.3', family: 'A2', name: 'Cor de ícone não alterada', severity: 'fail', input: 'catalog',
    mede: 'a cor declarada no estilo bate com a do asset oficial do catálogo',
    limiar: { descricao: 'igual ao catálogo' },
    fonte: 'AWS deck (DO "use icons at their predefined size, color and format"); Azure WAF',
    note: 'a rubrica pede hash de pixels; o hash é do render. O validador confere a COR DECLARADA, ' +
      'que é o que o motor controla — se o pixel divergir do estilo, o culpado é o renderizador, não o gerador.',
  },
  {
    id: 'A2.4', family: 'A2', name: 'Ícone do catálogo oficial e atual', severity: 'warn', input: 'catalog',
    mede: 'todo ícone usado existe no catálogo vigente, e nenhum vem do conjunto legado',
    limiar: { descricao: '100%' },
    fonte: 'AWS Architecture Icons ("check that you\'re using up-to-date icons"; releases trimestrais)',
  },
  {
    id: 'A2.5', family: 'A2', name: 'Tamanho de ícone uniforme por classe', severity: 'fail', input: 'geometry',
    mede: 'dentro de cada classe de nó, max(largura)/min(largura) == 1',
    limiar: { descricao: 'razão == 1 dentro da classe' },
    fonte: 'Azure WAF ("Use standardized ... icons, icon sizes ... for similar elements")',
  },
  {
    id: 'A2.6', family: 'A2', name: 'Codificação visual consistente por tipo', severity: 'fail', input: 'style',
    mede: 'para cada tipo, um único valor por canal (preenchimento, traço, espessura, estilo, forma)',
    limiar: { descricao: '1 valor por canal por tipo' },
    fonte: 'Azure WAF ("Maintain consistency"); C4; Kobourov et al. (similaridade)',
  },
  {
    id: 'A2.7', family: 'A2', name: 'Estilo de linha semanticamente consistente', severity: 'fail', input: 'style',
    mede: 'a relação estilo-de-traço → significado é uma bijeção',
    limiar: { descricao: 'bijeção' },
    fonte: 'Azure WAF ("Avoid ambiguous lines"); C4 checklist',
  },
  {
    id: 'A2.8', family: 'A2', name: 'Borda de grupo segue a convenção containment vs. deployment', severity: 'warn', input: 'style',
    mede: 'grupo de localização com borda sólida, grupo de zona lógica com borda tracejada',
    limiar: { descricao: '100% conforme o mapa adotado' },
    fonte: 'IBM Cloud architecture-icons (container=sólida, zone=tracejada); AWS deck',
    note: 'a rubrica avisa: o mapa exato por grupo AWS não é norma textual publicada — extraia do asset, não hard-code.',
  },
  {
    id: 'A2.9', family: 'A2', name: 'Rótulo de serviço com no máximo 2 linhas, sem quebra intra-palavra', severity: 'warn', input: 'render',
    mede: 'quantas linhas o rótulo ocupa DEPOIS de quebrado pela fonte real',
    limiar: { descricao: '≤ 2 linhas, 0 quebras intra-palavra' },
    fonte: 'AWS deck, slide de Labels',
    porqueRender: 'a quebra depende da métrica da fonte real. O motor já estima (resolve.cjs, LARG_CAR=6.7), ' +
      'e o comentário de lá é explícito sobre a estimativa ter subdimensionado em ~25% na primeira versão. ' +
      'Validar contra a própria estimativa seria o gerador conferindo o próprio palpite.',
  },
  {
    id: 'A2.10', family: 'A2', name: 'Setas do conjunto predefinido', severity: 'warn', input: 'style',
    mede: 'toda ponta de seta usada está no conjunto de presets',
    limiar: { descricao: '100%' },
    fonte: 'AWS deck ("Use the preset arrows provided in the Elements section")',
  },
  {
    id: 'A2.11', family: 'A2', name: 'Sem chartjunk', severity: 'fail', input: 'style',
    mede: 'nenhuma sombra, gradiente, brilho, bisel, perspectiva ou textura',
    limiar: { descricao: '0 ocorrências' },
    fonte: 'Tufte, Visual Display, cap. 5 (chartjunk); Azure WAF ("Use standard notations")',
  },

  // ------------------------------------------------------------------- A3
  // A rubrica: "falhas duras, tolerância zero, trivialmente computáveis, e são
  // exatamente o que um gerador automático erra".
  {
    id: 'A3.1', family: 'A3', name: 'Sobreposição nó–nó', severity: 'fail', input: 'geometry',
    mede: 'área de interseção entre caixas irmãs não aninhadas, e a folga entre elas',
    limiar: { key: 'folgaEntreCaixas', descricao: `0 pares sobrepostos; folga ≥ ${lim('folgaEntreCaixas')} px` },
    fonte: 'Purchase 2002; Dunne et al. 2015 (node occlusion); Azure WAF',
  },
  {
    id: 'A3.2', family: 'A3', name: 'Sobreposição rótulo–rótulo', severity: 'fail', input: 'geometry',
    mede: 'interseção das faixas de rótulo que o motor reservou',
    limiar: { key: 'paddingDeRotulo', descricao: `0 pares, com padding de ${lim('paddingDeRotulo')} px` },
    fonte: 'Dunne et al. 2015; C4 checklist (legibilidade do rótulo)',
    note: 'o motor RESERVA a faixa do rótulo na altura da caixa (resolve.cjs) porque o mxGraph não reserva. ' +
      'Esta checagem confere a reserva; se o texto real estourar a reserva, quem acusa é o render (B7).',
  },
  {
    id: 'A3.3', family: 'A3', name: 'Rótulo transbordando sua caixa', severity: 'fail', input: 'geometry',
    mede: 'a faixa de rótulo reservada cabe na caixa do dono, com padding interno',
    limiar: { descricao: '0 transbordos' },
    fonte: 'AWS deck (regras de Labels); consequência direta de A1.4',
  },
  {
    id: 'A3.4', family: 'A3', name: 'Sobreposição rótulo–aresta', severity: 'fail', input: 'geometry',
    mede: 'a faixa de rótulo cruza um segmento de aresta que não é a dona do rótulo',
    limiar: { descricao: '0 cruzamentos' },
    fonte: 'Dunne et al. 2015 (node-edge occlusion, generalizado a texto)',
  },
  {
    id: 'A3.5', family: 'A3', name: 'Aresta atravessando nó', severity: 'fail', input: 'geometry',
    mede: 'polilinha da aresta cruza a caixa de um nó que não é sua origem nem seu destino',
    limiar: { descricao: '0' },
    fonte: 'Dunne et al. 2015; Azure WAF ("Avoid ambiguous lines")',
  },
  {
    id: 'A3.6', family: 'A3', name: 'Ancoragem de seta', severity: 'fail', input: 'geometry',
    mede: 'as pontas da polilinha encostam no perímetro da origem e do destino',
    limiar: { key: 'toleranciaDeAncoragem', descricao: `±${lim('toleranciaDeAncoragem')} px do perímetro` },
    fonte: 'consequência de A1.6/A1.8; Azure WAF',
  },
  {
    id: 'A3.7', family: 'A3', name: 'Nada fora do canvas', severity: 'fail', input: 'geometry',
    mede: 'a união de tudo cabe no canvas, com margem',
    limiar: { key: 'margemDoCanvas', descricao: `contido, margem ≥ ${lim('margemDoCanvas')} px` },
    fonte: 'requisito de render; nenhum guia precisa dizer',
  },
  {
    id: 'A3.8', family: 'A3', name: 'Resolução de nó (NR)', severity: 'warn', input: 'geometry',
    mede: 'NR = min‖u−v‖ / max‖u−v‖ sobre centros de nós',
    limiar: { key: 'resolucaoDeNoQ1', descricao: `warn se NR < ${lim('resolucaoDeNoQ1')}; alvo ≥ ${lim('resolucaoDeNoMediana')}` },
    fonte: 'Mooney et al., GD 2025, eq. (9) + Tabela 2',
  },
  {
    id: 'A3.9', family: 'A3', name: 'Tamanho mínimo de fonte', severity: 'warn', input: 'style', calibravel: true,
    mede: 'tamanho de fonte declarado por classe de texto',
    limiar: { key: 'fonteMinimaRotuloDeAresta', descricao: `≥ ${lim('fonteMinimaRotuloDeAresta')} px em rótulo de aresta; ≥ ${lim('fonteMinimaNomeDeElemento')} px em nome de elemento` },
    fonte: 'derivado — a rubrica é explícita: NÃO é regra WCAG (WCAG normatiza contraste, não tamanho)',
  },

  // ------------------------------------------------------------------- A4
  // "Em diagrama AWS esta família carrega a semântica mais forte do desenho: a
  // caixa de VPC É a fronteira de rede. Erro aqui não é feio, é factualmente errado."
  {
    id: 'A4.1', family: 'A4', name: 'Contenção estrita', severity: 'fail', input: 'geometry',
    mede: 'todo filho cabe dentro do pai, com padding nos quatro lados',
    limiar: { key: 'paddingDeGrupo', descricao: `100%, padding ≥ ${lim('paddingDeGrupo')} px, tolerância 0` },
    fonte: 'Gestalt/região comum (Kobourov, Mchedlidze & Vonessen); Azure WAF ("Be accurate")',
  },
  {
    id: 'A4.2', family: 'A4', name: 'Não-membro fora da região', severity: 'fail', input: 'geometry', semantica: true,
    mede: 'nenhum nó cai dentro de um grupo do qual não é filho',
    limiar: { descricao: '0 violações, tolerância 0' },
    fonte: 'região comum (Gestalt); a rubrica: "a falha de maior gravidade semântica de todo o validador"',
    note: 'comunica pertencimento a uma fronteira de rede que não existe. Não é estética: é o desenho mentindo.',
  },
  {
    id: 'A4.3', family: 'A4', name: 'Grupos irmãos disjuntos', severity: 'fail', input: 'geometry',
    mede: 'grupos de mesmo pai, sem ancestralidade entre si, não se sobrepõem',
    limiar: { descricao: '0' },
    fonte: 'região comum; a hierarquia AWS (Region ⊃ VPC ⊃ AZ ⊃ Subnet) é uma árvore',
  },
  {
    id: 'A4.4', family: 'A4', name: 'Aninhamento geométrico == aninhamento lógico', severity: 'fail', input: 'geometry', semantica: true,
    mede: 'a árvore de contenção derivada da geometria é idêntica à árvore declarada',
    limiar: { descricao: 'árvores idênticas' },
    fonte: 'Azure WAF ("Be accurate"); região comum',
    note: 'é o teste de que o desenho e o modelo contam a mesma história. Divergir aqui é o diagrama ' +
      'afirmar uma topologia que o modelo nega — a mesma classe de mentira de A4.2, vista do outro lado.',
  },
  {
    id: 'A4.5', family: 'A4', name: 'Padding de grupo uniforme', severity: 'warn', input: 'geometry',
    mede: 'desvio dos quatro paddings internos, e entre grupos do mesmo tipo',
    limiar: { key: 'desvioDePaddingMaximo', descricao: `σ ≤ ${lim('desvioDePaddingMaximo')} px intra-grupo` },
    fonte: 'Azure WAF ("Maintain consistency"); similaridade Gestalt',
  },
  {
    id: 'A4.6', family: 'A4', name: 'Rótulo de grupo em posição canônica', severity: 'warn', input: 'geometry',
    mede: 'rótulo e ícone do grupo no canto superior esquerdo interno, sem colidir com filho',
    limiar: { descricao: '100%' },
    fonte: 'IBM ("icons in upper left corners"); AWS deck (Groups)',
  },
  {
    id: 'A4.7', family: 'A4', name: 'Razão de proximidade intra/inter grupo', severity: 'warn', input: 'geometry', calibravel: true,
    mede: 'ρ = distância média intra-grupo / distância média inter-grupo',
    limiar: { key: 'proximidadeMaxima', descricao: `ρ ≤ ${lim('proximidadeMaxima')}` },
    fonte: 'proximidade formalizada em Kobourov, Mchedlidze & Vonessen',
  },

  // ------------------------------------------------------------------- A5
  {
    id: 'A5.1', family: 'A5', name: 'Cruzamentos de aresta (EC)', severity: 'fail', escalona: true, input: 'geometry',
    mede: 'EC = 1 − c/c_max, e a contagem absoluta de cruzamentos',
    limiar: { key: 'cruzamentosQ1', descricao: `alvo 0 cruzamentos; warn em ≥1; fail acima de ⌈|E|/10⌉` },
    fonte: 'Purchase 1997 ("by far the most important aesthetic"); Mooney et al., GD 2025, eq. (3)',
  },
  {
    id: 'A5.2', family: 'A5', name: 'Ângulo de cruzamento (CA)', severity: 'fail', escalona: true, input: 'geometry',
    mede: 'CA normalizado e o menor ângulo absoluto entre arestas que se cruzam',
    limiar: { key: 'anguloDeCruzamentoMinimo', descricao: `alvo ≥ ${lim('anguloDeCruzamentoIdeal')}°; fail se < ${lim('anguloDeCruzamentoMinimo')}°` },
    fonte: 'Huang, Eades, Hong & Lin (JVLC 2014); fórmula em Mooney et al., GD 2025, eq. (2)',
  },
  {
    id: 'A5.3', family: 'A5', name: 'Número de dobras por aresta', severity: 'fail', escalona: true, input: 'geometry', calibravel: true,
    mede: 'dobras(e) = |pontos(e)| − 2; máximo e média',
    limiar: { key: 'dobrasAviso', descricao: `alvo ≤ ${lim('dobrasAlvo')}; warn acima de ${lim('dobrasAviso')}; fail acima de ${lim('dobrasFalha')}` },
    fonte: 'Purchase 1997; Gestalt/continuação (Kobourov et al.)',
  },
  {
    id: 'A5.4', family: 'A5', name: 'Ângulo de dobra', severity: 'fail', escalona: true, input: 'geometry', calibravel: false,
    mede: 'ângulo interno em cada vértice da polilinha',
    limiar: { key: 'anguloDeDobraAlvo', descricao: `≥ ${lim('anguloDeDobraAlvo')}°; fail abaixo de ${lim('anguloDeDobraFalha')}°` },
    fonte: 'Gestalt/continuação — "poucas dobras que não sejam bruscas"',
  },
  {
    id: 'A5.5', family: 'A5', name: 'Aresta atravessando fronteira espúria', severity: 'fail', input: 'geometry', semantica: true,
    mede: 'a polilinha entra num grupo que não contém nem a origem, nem o destino, nem é ancestral comum',
    limiar: { descricao: '0, tolerância 0' },
    fonte: 'região comum (Gestalt) + Azure WAF ("Be accurate")',
    note: 'aresta que corta uma VPC alheia sugere um caminho de rede inexistente. Como A4.2: o desenho mente.',
  },
  {
    id: 'A5.6', family: 'A5', name: 'Ortogonalidade de aresta (EO)', severity: 'warn', input: 'geometry',
    mede: 'desvio angular ponderado por comprimento até o eixo mais próximo',
    limiar: { key: 'ortogonalidadeAlvo', descricao: `se ortogonal: EO ≥ ${lim('ortogonalidadeAlvo')}; se reto: warn só se EO < ${lim('ortogonalidadeQ1')}` },
    fonte: 'Mooney et al., GD 2025, eqs. (5)–(6); Purchase 2002',
  },
  {
    id: 'A5.7', family: 'A5', name: 'Direção de fluxo consistente', severity: 'warn', input: 'geometry', calibravel: true,
    mede: 'fração de arestas que projetam positivo no eixo dominante',
    limiar: { key: 'fluxoConsistenteMinimo', descricao: `≥ ${lim('fluxoConsistenteMinimo')}` },
    fonte: 'Purchase 2002 (consistent flow direction); Kobourov et al.',
  },
  {
    id: 'A5.8', family: 'A5', name: 'Arestas paralelas separadas', severity: 'fail', input: 'geometry',
    mede: 'distância de Hausdorff entre polilinhas do mesmo par origem→destino; e comprimento não nulo',
    limiar: { key: 'separacaoDeArestasParalelas', descricao: `separação ≥ ${lim('separacaoDeArestasParalelas')} px` },
    fonte: 'consequência de A1.6 (cada aresta tem rótulo próprio e legível)',
  },
  {
    id: 'A5.9', family: 'A5', name: 'Uniformidade de comprimento de aresta (ELD)', severity: 'warn', input: 'geometry',
    mede: 'ELD = 1/(1 + desvio relativo médio ao comprimento ideal)',
    limiar: { key: 'uniformidadeDeComprimentoQ1', descricao: `warn se ELD < ${lim('uniformidadeDeComprimentoQ1')}` },
    fonte: 'Mooney et al., GD 2025, eq. (4); Purchase 2002',
    note: 'a rubrica pede o cálculo SEPARADO por classe de aresta — em diagrama com grupos aninhados, ' +
      'comprimento intra-grupo e inter-grupo variam por desenho, não por defeito.',
  },

  // ------------------------------------------------------------------- A6
  {
    id: 'A6.1', family: 'A6', name: 'Resolução angular (AR)', severity: 'fail', escalona: true, input: 'geometry',
    mede: 'AR normalizado, e o ângulo absoluto mínimo entre arestas incidentes ao mesmo nó',
    limiar: { key: 'resolucaoAngularQ1', descricao: `warn se AR < ${lim('resolucaoAngularQ1')}; fail se o ângulo absoluto < ${lim('anguloIncidenteMinimo')}°` },
    fonte: 'Mooney et al., GD 2025, eq. (1); Purchase 2002',
  },
  {
    id: 'A6.2', family: 'A6', name: 'Uniformidade de nós (NU)', severity: 'warn', input: 'geometry',
    mede: 'distribuição dos nós numa grade sobre o bounding box',
    limiar: { key: 'uniformidadeDeNosQ1', descricao: `warn se NU < ${lim('uniformidadeDeNosQ1')}` },
    fonte: 'Mooney et al., GD 2025, eq. (10)',
  },
  {
    id: 'A6.3', family: 'A6', name: 'Razão de aspecto (Asp)', severity: 'warn', input: 'geometry',
    mede: 'min(h,w)/max(h,w) do bounding box, e a diferença para a razão do canvas',
    limiar: { key: 'razaoDeAspectoQ1', descricao: `warn se Asp < ${lim('razaoDeAspectoQ1')} ou se difere do canvas em > ${lim('toleranciaDeRazaoDeAspecto') * 100}%` },
    fonte: 'Mooney et al., GD 2025 (definição + percentis)',
  },
  {
    id: 'A6.4', family: 'A6', name: 'Alinhamento a grid', severity: 'warn', input: 'geometry', calibravel: true,
    mede: 'fração de nós que compartilham x ou y com pelo menos um outro nó',
    limiar: { key: 'alinhamentoMinimo', descricao: `≥ ${lim('alinhamentoMinimo') * 100}% dos nós, passo de ${lim('passoDaGrade')} px` },
    fonte: 'graph aesthetics (alinhamento a grade); Gestalt/simetria via Kobourov et al.',
    note: 'é o substituto operacional da simetria — ver B1, que a deixa deliberadamente fora de (A).',
  },
  {
    id: 'A6.5', family: 'A6', name: 'Preservação de vizinhança (NP) / Stress (KSM)', severity: 'warn', input: 'geometry',
    mede: 'NP e KSM conforme Mooney et al., eqs. (7)–(8)',
    limiar: { key: 'preservacaoDeVizinhancaQ1', descricao: `warn se NP < ${lim('preservacaoDeVizinhancaQ1')} ou KSM < ${lim('stressQ1')}` },
    fonte: 'Mooney et al., GD 2025, eqs. (7)–(8)',
    note: 'a própria rubrica avisa: em diagrama de arquitetura a posição é ditada pelos grupos (VPC/AZ), ' +
      'não pela distância de grafo. "Baixa prioridade; provavelmente ruído."',
  },

  // ------------------------------------------------------------------- A7
  {
    id: 'A7.1', family: 'A7', name: 'Contraste de texto', severity: 'fail', input: 'style',
    mede: 'razão de contraste entre a cor do texto e o FUNDO EFETIVO resolvido pela pilha de grupos',
    limiar: { key: 'contrasteTextoPequeno', descricao: `≥ ${lim('contrasteTextoPequeno')}:1; ≥ ${lim('contrasteTextoGrande')}:1 para texto grande` },
    fonte: 'WCAG 2.2 SC 1.4.3 (AA); fórmula em G18',
  },
  {
    id: 'A7.2', family: 'A7', name: 'Contraste não-textual', severity: 'fail', input: 'style',
    mede: 'contraste de borda de nó, borda de grupo, traço de aresta e ponta de seta contra o fundo efetivo',
    limiar: { key: 'contrasteNaoTextual', descricao: `≥ ${lim('contrasteNaoTextual')}:1` },
    fonte: 'WCAG 2.2 SC 1.4.11 — cobre "each line in a graph"',
  },
  {
    id: 'A7.3', family: 'A7', name: 'Cor não é o único canal', severity: 'fail', input: 'style',
    mede: 'dois significados que diferem APENAS em cor de preenchimento',
    limiar: { descricao: '0 pares' },
    fonte: 'WCAG 2.2 SC 1.4.1 (nível A); Azure WAF; C4; Google style guide',
  },
  {
    id: 'A7.4', family: 'A7', name: 'Distinguibilidade sob deficiência de cor', severity: 'warn', input: 'style', calibravel: true,
    mede: 'menor ΔE00 entre cores de significados distintos, sob protanopia, deuteranopia e tritanopia',
    limiar: { key: 'deltaE00Minimo', descricao: `ΔE00 ≥ ${lim('deltaE00Minimo')} nas três simulações` },
    fonte: 'WCAG SC 1.4.1 é o requisito normativo; o teste de simulação é operacionalização de engenharia',
    note: 'A7.3 já é a rede de segurança normativa; A7.4 é diagnóstico complementar.',
  },
  {
    id: 'A7.5', family: 'A7', name: 'Contraste da legenda', severity: 'fail', input: 'style',
    mede: 'A7.1 e A7.2 aplicados ao texto e às amostras de cor da legenda',
    limiar: { descricao: 'idem A7.1 e A7.2' },
    fonte: 'WCAG 2.2 SC 1.4.3 e 1.4.11',
  },

  // ------------------------------------------------------------------- A8
  {
    id: 'A8.1', family: 'A8', name: 'Contagem de elementos de primeira classe', severity: 'fail', escalona: true, input: 'geometry',
    mede: 'número de nós, excluindo caixas de grupo',
    limiar: { key: 'elementosAlvo', descricao: `alvo ≤ ${lim('elementosAlvo')}; warn em 21–${lim('elementosFalha')}; fail acima de ${lim('elementosFalha')}` },
    fonte: 'Ghoniem/Fekete/Castagliola; Yoghourdjian et al.; Störrle; C4 FAQ',
    note: 'a rubrica é explícita quanto ao remédio: DECOMPOR, não encolher (Moody & Heymans, RE\'09).',
  },
  {
    id: 'A8.2', family: 'A8', name: 'Densidade de arestas', severity: 'warn', input: 'geometry',
    mede: 'd = |E|/C(|V|,2) e a densidade linear |E|/|V|',
    limiar: { key: 'densidadeMaxima', descricao: `warn se d > ${lim('densidadeMaxima')} E |V| > ${lim('elementosAlvo')}` },
    fonte: 'Yoghourdjian et al. (78% dos estudos usam densidade <10%)',
  },
  {
    id: 'A8.3', family: 'A8', name: 'Arestas por nó (fan-out)', severity: 'warn', input: 'geometry', calibravel: true,
    mede: 'max(grau(v))',
    limiar: { key: 'fanOutMaximo', descricao: `warn se grau > ${lim('fanOutMaximo')}` },
    fonte: 'derivado de A6.1 + Ware et al. 2002',
  },
  {
    id: 'A8.4', family: 'A8', name: 'Cobertura de tinta', severity: 'warn', input: 'render', calibravel: true,
    mede: 'fração de pixels não-fundo sobre a área do canvas',
    limiar: { key: 'coberturaDeTinta', descricao: `faixa [${lim('coberturaDeTinta').join(' ; ')}] como sinal, não reprovação` },
    fonte: 'Tufte (data-ink), explicitamente adaptado e enfraquecido pela própria rubrica',
    porqueRender: 'pixel não-fundo só existe depois de rasterizar. Não há aproximação honesta a partir do plano: ' +
      'somar áreas de caixa conta o vão dentro de um grupo como tinta, e um grupo grande e vazio ficaria "denso".',
  },
];

const INDEX = new Map(CHECKS.map(c => [c.id, c]));
const byId = id => INDEX.get(id);

/** As que o validador obrigatório cobre — tudo que não foi entregue ao render. */
const FROM_VALIDATOR = CHECKS.filter(c => c.input !== 'render');
/** As que o juiz oportunista cobre. A partição é exaustiva e sem sobreposição. */
const FROM_RENDER = CHECKS.filter(c => c.input === 'render');

module.exports = {
  CHECKS, INDEX, THRESHOLDS, SEVERITIES, INPUTS,
  FROM_VALIDATOR, FROM_RENDER, byId, lim,
};
