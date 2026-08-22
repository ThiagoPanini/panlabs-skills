'use strict';
/**
 * O índice das 62 checagens mecanizáveis da rubrica (#8).
 *
 * Este arquivo é a tabela, não o cálculo. Ele existe separado das famílias por
 * um motivo concreto: a pergunta "quais das 62 o validador cobre, com que
 * severidade, e o que sobrou para o render" tem de ser respondível sem executar
 * nada e sem ler oito módulos. `tests/check-indice.cjs` confere a tabela contra
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
 *                 Vira chave em `limiares.json` com `porque: null`, e o campo vazio
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
const bruto = require(path.join(__dirname, 'limiares.json'));

/** Os limiares num mapa chato, porque quem consulta quer o número, não o grupo. */
const LIMIARES = Object.freeze({ ...bruto.normativos, ...bruto.calibraveis });

const SEVERIDADES = ['fail', 'warn'];
const INSUMOS = ['geometria', 'estilo', 'modelo', 'catalogo', 'render'];

/** Atalho: o valor cru de um limiar, pelo nome. */
const lim = chave => {
  if (!(chave in LIMIARES)) throw new Error(`limiar "${chave}" não existe em limiares.json`);
  return LIMIARES[chave].valor;
};

const CHECAGENS = [

  // ------------------------------------------------------------------- A1
  // "Não é geometria, é presença de campos" — a rubrica. O grupo mais barato e
  // o de maior retorno: é o checklist do C4 virado em asserção.
  {
    id: 'A1.1', familia: 'A1', nome: 'Título presente', severidade: 'fail', insumo: 'modelo',
    mede: 'o diagrama se descreve sozinho: título com tipo de diagrama e escopo',
    limiar: { descricao: 'presente e não vazio' },
    fonte: 'C4 (/diagrams/notation); Azure WAF ("Include metadata")',
  },
  {
    id: 'A1.2', familia: 'A1', nome: 'Legenda presente', severidade: 'fail', insumo: 'geometria',
    mede: 'existe uma legenda no canvas',
    limiar: { descricao: 'presente' },
    fonte: 'C4 ("Every diagram should have a key/legend")',
  },
  {
    id: 'A1.3', familia: 'A1', nome: 'Legenda completa (cobertura de canal visual)', severidade: 'fail', insumo: 'estilo',
    mede: 'todo valor de canal visual efetivamente usado tem entrada na legenda',
    limiar: { descricao: '|valores_sem_entrada| = 0' },
    fonte: 'C4 review checklist; Azure WAF ("Provide a legend")',
  },
  {
    id: 'A1.4', familia: 'A1', nome: 'Todo elemento nomeado', severidade: 'fail', insumo: 'geometria',
    mede: '∀ nó, grupo: rótulo ≠ ""',
    limiar: { descricao: '100%' },
    fonte: 'C4 checklist; Azure WAF ("Label everything clearly"); Azure Icons',
  },
  {
    id: 'A1.5', familia: 'A1', nome: 'Todo elemento tipado', severidade: 'fail', insumo: 'modelo',
    mede: '∀ nó, grupo: tipo ∈ catálogo',
    limiar: { descricao: '100%' },
    fonte: 'C4 ("The type of every element should be explicitly specified")',
  },
  {
    id: 'A1.6', familia: 'A1', nome: 'Toda aresta rotulada', severidade: 'fail', insumo: 'geometria',
    mede: '∀ aresta: rótulo ≠ ""',
    limiar: { descricao: '100%' },
    fonte: 'C4 ("Every line should be labelled"); Azure WAF',
  },
  {
    id: 'A1.7', familia: 'A1', nome: 'Toda aresta unidirecional', severidade: 'fail', insumo: 'estilo',
    mede: '∀ aresta: exatamente uma ponta de seta',
    limiar: { descricao: '0 arestas bidirecionais' },
    fonte: 'C4 ("unidirectional relationship"); Azure WAF ("Avoid bidirectional arrows")',
  },
  {
    id: 'A1.8', familia: 'A1', nome: 'Nenhuma linha sem seta', severidade: 'fail', insumo: 'estilo',
    mede: '∀ aresta: ao menos uma ponta de seta',
    limiar: { descricao: '100%' },
    fonte: 'Azure WAF ("Lines without arrows make relationships unclear")',
  },
  {
    id: 'A1.9', familia: 'A1', nome: 'Siglas expandidas', severidade: 'warn', insumo: 'catalogo',
    mede: 'sigla em rótulo que não é nome oficial de serviço AWS aparece expandida',
    limiar: { descricao: '0 siglas não explicadas' },
    fonte: 'C4 ("Acronyms and abbreviations ... should be understandable by all audiences")',
  },
  {
    id: 'A1.10', familia: 'A1', nome: 'Um nível de abstração', severidade: 'fail', insumo: 'modelo',
    mede: '|distinct(nível de abstração)| == 1',
    limiar: { descricao: '1' },
    fonte: 'C4 FAQ ("at the same level of abstraction"); Azure WAF ("Layer, don\'t overload")',
  },
  {
    id: 'A1.11', familia: 'A1', nome: 'Metadados de frescor', severidade: 'warn', insumo: 'modelo',
    mede: 'data, versão e autor presentes',
    limiar: { descricao: 'presentes' },
    fonte: 'Azure WAF ("title, description, last updated date, author, version")',
  },
  {
    id: 'A1.12', familia: 'A1', nome: 'Nenhum shape órfão', severidade: 'fail', insumo: 'geometria',
    mede: 'todo objeto de desenho pertence a nós ∪ grupos ∪ arestas ∪ rótulos ∪ legenda ∪ título',
    limiar: { descricao: '0 órfãos' },
    fonte: 'Tufte, Visual Display, "Erase non-data-ink" (adaptado)',
  },

  // ------------------------------------------------------------------- A2
  {
    id: 'A2.1', familia: 'A2', nome: 'Complexidade gráfica ≤ 6', severidade: 'fail', escalona: true, insumo: 'estilo',
    mede: 'número de entradas distintas que a legenda precisaria ter (tipos de símbolo, não instâncias)',
    limiar: { chave: 'complexidadeGraficaAlvo', descricao: `≤ ${lim('complexidadeGraficaAlvo')}; warn em 7–8; fail acima de ${lim('complexidadeGraficaFalha')}` },
    fonte: 'Moody, Physics of Notations ("span of absolute judgement is around 6 categories")',
  },
  {
    id: 'A2.2', familia: 'A2', nome: 'Ícone íntegro', severidade: 'fail', insumo: 'estilo',
    mede: 'nenhum ícone espelhado, girado, cisalhado ou recortado',
    limiar: { descricao: '100% dos ícones' },
    fonte: 'AWS deck (DON\'T crop/flip/rotate); Azure Icons; Azure WAF',
  },
  {
    id: 'A2.3', familia: 'A2', nome: 'Cor de ícone não alterada', severidade: 'fail', insumo: 'catalogo',
    mede: 'a cor declarada no estilo bate com a do asset oficial do catálogo',
    limiar: { descricao: 'igual ao catálogo' },
    fonte: 'AWS deck (DO "use icons at their predefined size, color and format"); Azure WAF',
    nota: 'a rubrica pede hash de pixels; o hash é do render. O validador confere a COR DECLARADA, ' +
      'que é o que o motor controla — se o pixel divergir do estilo, o culpado é o renderizador, não o gerador.',
  },
  {
    id: 'A2.4', familia: 'A2', nome: 'Ícone do catálogo oficial e atual', severidade: 'warn', insumo: 'catalogo',
    mede: 'todo ícone usado existe no catálogo vigente, e nenhum vem do conjunto legado',
    limiar: { descricao: '100%' },
    fonte: 'AWS Architecture Icons ("check that you\'re using up-to-date icons"; releases trimestrais)',
  },
  {
    id: 'A2.5', familia: 'A2', nome: 'Tamanho de ícone uniforme por classe', severidade: 'fail', insumo: 'geometria',
    mede: 'dentro de cada classe de nó, max(largura)/min(largura) == 1',
    limiar: { descricao: 'razão == 1 dentro da classe' },
    fonte: 'Azure WAF ("Use standardized ... icons, icon sizes ... for similar elements")',
  },
  {
    id: 'A2.6', familia: 'A2', nome: 'Codificação visual consistente por tipo', severidade: 'fail', insumo: 'estilo',
    mede: 'para cada tipo, um único valor por canal (preenchimento, traço, espessura, estilo, forma)',
    limiar: { descricao: '1 valor por canal por tipo' },
    fonte: 'Azure WAF ("Maintain consistency"); C4; Kobourov et al. (similaridade)',
  },
  {
    id: 'A2.7', familia: 'A2', nome: 'Estilo de linha semanticamente consistente', severidade: 'fail', insumo: 'estilo',
    mede: 'a relação estilo-de-traço → significado é uma bijeção',
    limiar: { descricao: 'bijeção' },
    fonte: 'Azure WAF ("Avoid ambiguous lines"); C4 checklist',
  },
  {
    id: 'A2.8', familia: 'A2', nome: 'Borda de grupo segue a convenção containment vs. deployment', severidade: 'warn', insumo: 'estilo',
    mede: 'grupo de localização com borda sólida, grupo de zona lógica com borda tracejada',
    limiar: { descricao: '100% conforme o mapa adotado' },
    fonte: 'IBM Cloud architecture-icons (container=sólida, zone=tracejada); AWS deck',
    nota: 'a rubrica avisa: o mapa exato por grupo AWS não é norma textual publicada — extraia do asset, não hard-code.',
  },
  {
    id: 'A2.9', familia: 'A2', nome: 'Rótulo de serviço com no máximo 2 linhas, sem quebra intra-palavra', severidade: 'warn', insumo: 'render',
    mede: 'quantas linhas o rótulo ocupa DEPOIS de quebrado pela fonte real',
    limiar: { descricao: '≤ 2 linhas, 0 quebras intra-palavra' },
    fonte: 'AWS deck, slide de Labels',
    porqueRender: 'a quebra depende da métrica da fonte real. O motor já estima (resolver.cjs, LARG_CAR=6.7), ' +
      'e o comentário de lá é explícito sobre a estimativa ter subdimensionado em ~25% na primeira versão. ' +
      'Validar contra a própria estimativa seria o gerador conferindo o próprio palpite.',
  },
  {
    id: 'A2.10', familia: 'A2', nome: 'Setas do conjunto predefinido', severidade: 'warn', insumo: 'estilo',
    mede: 'toda ponta de seta usada está no conjunto de presets',
    limiar: { descricao: '100%' },
    fonte: 'AWS deck ("Use the preset arrows provided in the Elements section")',
  },
  {
    id: 'A2.11', familia: 'A2', nome: 'Sem chartjunk', severidade: 'fail', insumo: 'estilo',
    mede: 'nenhuma sombra, gradiente, brilho, bisel, perspectiva ou textura',
    limiar: { descricao: '0 ocorrências' },
    fonte: 'Tufte, Visual Display, cap. 5 (chartjunk); Azure WAF ("Use standard notations")',
  },

  // ------------------------------------------------------------------- A3
  // A rubrica: "falhas duras, tolerância zero, trivialmente computáveis, e são
  // exatamente o que um gerador automático erra".
  {
    id: 'A3.1', familia: 'A3', nome: 'Sobreposição nó–nó', severidade: 'fail', insumo: 'geometria',
    mede: 'área de interseção entre caixas irmãs não aninhadas, e a folga entre elas',
    limiar: { chave: 'folgaEntreCaixas', descricao: `0 pares sobrepostos; folga ≥ ${lim('folgaEntreCaixas')} px` },
    fonte: 'Purchase 2002; Dunne et al. 2015 (node occlusion); Azure WAF',
  },
  {
    id: 'A3.2', familia: 'A3', nome: 'Sobreposição rótulo–rótulo', severidade: 'fail', insumo: 'geometria',
    mede: 'interseção das faixas de rótulo que o motor reservou',
    limiar: { chave: 'paddingDeRotulo', descricao: `0 pares, com padding de ${lim('paddingDeRotulo')} px` },
    fonte: 'Dunne et al. 2015; C4 checklist (legibilidade do rótulo)',
    nota: 'o motor RESERVA a faixa do rótulo na altura da caixa (resolver.cjs) porque o mxGraph não reserva. ' +
      'Esta checagem confere a reserva; se o texto real estourar a reserva, quem acusa é o render (B7).',
  },
  {
    id: 'A3.3', familia: 'A3', nome: 'Rótulo transbordando sua caixa', severidade: 'fail', insumo: 'geometria',
    mede: 'a faixa de rótulo reservada cabe na caixa do dono, com padding interno',
    limiar: { descricao: '0 transbordos' },
    fonte: 'AWS deck (regras de Labels); consequência direta de A1.4',
  },
  {
    id: 'A3.4', familia: 'A3', nome: 'Sobreposição rótulo–aresta', severidade: 'fail', insumo: 'geometria',
    mede: 'a faixa de rótulo cruza um segmento de aresta que não é a dona do rótulo',
    limiar: { descricao: '0 cruzamentos' },
    fonte: 'Dunne et al. 2015 (node-edge occlusion, generalizado a texto)',
  },
  {
    id: 'A3.5', familia: 'A3', nome: 'Aresta atravessando nó', severidade: 'fail', insumo: 'geometria',
    mede: 'polilinha da aresta cruza a caixa de um nó que não é sua origem nem seu destino',
    limiar: { descricao: '0' },
    fonte: 'Dunne et al. 2015; Azure WAF ("Avoid ambiguous lines")',
  },
  {
    id: 'A3.6', familia: 'A3', nome: 'Ancoragem de seta', severidade: 'fail', insumo: 'geometria',
    mede: 'as pontas da polilinha encostam no perímetro da origem e do destino',
    limiar: { chave: 'toleranciaDeAncoragem', descricao: `±${lim('toleranciaDeAncoragem')} px do perímetro` },
    fonte: 'consequência de A1.6/A1.8; Azure WAF',
  },
  {
    id: 'A3.7', familia: 'A3', nome: 'Nada fora do canvas', severidade: 'fail', insumo: 'geometria',
    mede: 'a união de tudo cabe no canvas, com margem',
    limiar: { chave: 'margemDoCanvas', descricao: `contido, margem ≥ ${lim('margemDoCanvas')} px` },
    fonte: 'requisito de render; nenhum guia precisa dizer',
  },
  {
    id: 'A3.8', familia: 'A3', nome: 'Resolução de nó (NR)', severidade: 'warn', insumo: 'geometria',
    mede: 'NR = min‖u−v‖ / max‖u−v‖ sobre centros de nós',
    limiar: { chave: 'resolucaoDeNoQ1', descricao: `warn se NR < ${lim('resolucaoDeNoQ1')}; alvo ≥ ${lim('resolucaoDeNoMediana')}` },
    fonte: 'Mooney et al., GD 2025, eq. (9) + Tabela 2',
  },
  {
    id: 'A3.9', familia: 'A3', nome: 'Tamanho mínimo de fonte', severidade: 'warn', insumo: 'estilo', calibravel: true,
    mede: 'tamanho de fonte declarado por classe de texto',
    limiar: { chave: 'fonteMinimaRotuloDeAresta', descricao: `≥ ${lim('fonteMinimaRotuloDeAresta')} px em rótulo de aresta; ≥ ${lim('fonteMinimaNomeDeElemento')} px em nome de elemento` },
    fonte: 'derivado — a rubrica é explícita: NÃO é regra WCAG (WCAG normatiza contraste, não tamanho)',
  },

  // ------------------------------------------------------------------- A4
  // "Em diagrama AWS esta família carrega a semântica mais forte do desenho: a
  // caixa de VPC É a fronteira de rede. Erro aqui não é feio, é factualmente errado."
  {
    id: 'A4.1', familia: 'A4', nome: 'Contenção estrita', severidade: 'fail', insumo: 'geometria',
    mede: 'todo filho cabe dentro do pai, com padding nos quatro lados',
    limiar: { chave: 'paddingDeGrupo', descricao: `100%, padding ≥ ${lim('paddingDeGrupo')} px, tolerância 0` },
    fonte: 'Gestalt/região comum (Kobourov, Mchedlidze & Vonessen); Azure WAF ("Be accurate")',
  },
  {
    id: 'A4.2', familia: 'A4', nome: 'Não-membro fora da região', severidade: 'fail', insumo: 'geometria', semantica: true,
    mede: 'nenhum nó cai dentro de um grupo do qual não é filho',
    limiar: { descricao: '0 violações, tolerância 0' },
    fonte: 'região comum (Gestalt); a rubrica: "a falha de maior gravidade semântica de todo o validador"',
    nota: 'comunica pertencimento a uma fronteira de rede que não existe. Não é estética: é o desenho mentindo.',
  },
  {
    id: 'A4.3', familia: 'A4', nome: 'Grupos irmãos disjuntos', severidade: 'fail', insumo: 'geometria',
    mede: 'grupos de mesmo pai, sem ancestralidade entre si, não se sobrepõem',
    limiar: { descricao: '0' },
    fonte: 'região comum; a hierarquia AWS (Region ⊃ VPC ⊃ AZ ⊃ Subnet) é uma árvore',
  },
  {
    id: 'A4.4', familia: 'A4', nome: 'Aninhamento geométrico == aninhamento lógico', severidade: 'fail', insumo: 'geometria', semantica: true,
    mede: 'a árvore de contenção derivada da geometria é idêntica à árvore declarada',
    limiar: { descricao: 'árvores idênticas' },
    fonte: 'Azure WAF ("Be accurate"); região comum',
    nota: 'é o teste de que o desenho e o modelo contam a mesma história. Divergir aqui é o diagrama ' +
      'afirmar uma topologia que o modelo nega — a mesma classe de mentira de A4.2, vista do outro lado.',
  },
  {
    id: 'A4.5', familia: 'A4', nome: 'Padding de grupo uniforme', severidade: 'warn', insumo: 'geometria',
    mede: 'desvio dos quatro paddings internos, e entre grupos do mesmo tipo',
    limiar: { chave: 'desvioDePaddingMaximo', descricao: `σ ≤ ${lim('desvioDePaddingMaximo')} px intra-grupo` },
    fonte: 'Azure WAF ("Maintain consistency"); similaridade Gestalt',
  },
  {
    id: 'A4.6', familia: 'A4', nome: 'Rótulo de grupo em posição canônica', severidade: 'warn', insumo: 'geometria',
    mede: 'rótulo e ícone do grupo no canto superior esquerdo interno, sem colidir com filho',
    limiar: { descricao: '100%' },
    fonte: 'IBM ("icons in upper left corners"); AWS deck (Groups)',
  },
  {
    id: 'A4.7', familia: 'A4', nome: 'Razão de proximidade intra/inter grupo', severidade: 'warn', insumo: 'geometria', calibravel: true,
    mede: 'ρ = distância média intra-grupo / distância média inter-grupo',
    limiar: { chave: 'proximidadeMaxima', descricao: `ρ ≤ ${lim('proximidadeMaxima')}` },
    fonte: 'proximidade formalizada em Kobourov, Mchedlidze & Vonessen',
  },

  // ------------------------------------------------------------------- A5
  {
    id: 'A5.1', familia: 'A5', nome: 'Cruzamentos de aresta (EC)', severidade: 'fail', escalona: true, insumo: 'geometria',
    mede: 'EC = 1 − c/c_max, e a contagem absoluta de cruzamentos',
    limiar: { chave: 'cruzamentosQ1', descricao: `alvo 0 cruzamentos; warn em ≥1; fail acima de ⌈|E|/10⌉` },
    fonte: 'Purchase 1997 ("by far the most important aesthetic"); Mooney et al., GD 2025, eq. (3)',
  },
  {
    id: 'A5.2', familia: 'A5', nome: 'Ângulo de cruzamento (CA)', severidade: 'fail', escalona: true, insumo: 'geometria',
    mede: 'CA normalizado e o menor ângulo absoluto entre arestas que se cruzam',
    limiar: { chave: 'anguloDeCruzamentoMinimo', descricao: `alvo ≥ ${lim('anguloDeCruzamentoIdeal')}°; fail se < ${lim('anguloDeCruzamentoMinimo')}°` },
    fonte: 'Huang, Eades, Hong & Lin (JVLC 2014); fórmula em Mooney et al., GD 2025, eq. (2)',
  },
  {
    id: 'A5.3', familia: 'A5', nome: 'Número de dobras por aresta', severidade: 'fail', escalona: true, insumo: 'geometria', calibravel: true,
    mede: 'dobras(e) = |pontos(e)| − 2; máximo e média',
    limiar: { chave: 'dobrasAviso', descricao: `alvo ≤ ${lim('dobrasAlvo')}; warn acima de ${lim('dobrasAviso')}; fail acima de ${lim('dobrasFalha')}` },
    fonte: 'Purchase 1997; Gestalt/continuação (Kobourov et al.)',
  },
  {
    id: 'A5.4', familia: 'A5', nome: 'Ângulo de dobra', severidade: 'fail', escalona: true, insumo: 'geometria', calibravel: false,
    mede: 'ângulo interno em cada vértice da polilinha',
    limiar: { chave: 'anguloDeDobraAlvo', descricao: `≥ ${lim('anguloDeDobraAlvo')}°; fail abaixo de ${lim('anguloDeDobraFalha')}°` },
    fonte: 'Gestalt/continuação — "poucas dobras que não sejam bruscas"',
  },
  {
    id: 'A5.5', familia: 'A5', nome: 'Aresta atravessando fronteira espúria', severidade: 'fail', insumo: 'geometria', semantica: true,
    mede: 'a polilinha entra num grupo que não contém nem a origem, nem o destino, nem é ancestral comum',
    limiar: { descricao: '0, tolerância 0' },
    fonte: 'região comum (Gestalt) + Azure WAF ("Be accurate")',
    nota: 'aresta que corta uma VPC alheia sugere um caminho de rede inexistente. Como A4.2: o desenho mente.',
  },
  {
    id: 'A5.6', familia: 'A5', nome: 'Ortogonalidade de aresta (EO)', severidade: 'warn', insumo: 'geometria',
    mede: 'desvio angular ponderado por comprimento até o eixo mais próximo',
    limiar: { chave: 'ortogonalidadeAlvo', descricao: `se ortogonal: EO ≥ ${lim('ortogonalidadeAlvo')}; se reto: warn só se EO < ${lim('ortogonalidadeQ1')}` },
    fonte: 'Mooney et al., GD 2025, eqs. (5)–(6); Purchase 2002',
  },
  {
    id: 'A5.7', familia: 'A5', nome: 'Direção de fluxo consistente', severidade: 'warn', insumo: 'geometria', calibravel: true,
    mede: 'fração de arestas que projetam positivo no eixo dominante',
    limiar: { chave: 'fluxoConsistenteMinimo', descricao: `≥ ${lim('fluxoConsistenteMinimo')}` },
    fonte: 'Purchase 2002 (consistent flow direction); Kobourov et al.',
  },
  {
    id: 'A5.8', familia: 'A5', nome: 'Arestas paralelas separadas', severidade: 'fail', insumo: 'geometria',
    mede: 'distância de Hausdorff entre polilinhas do mesmo par origem→destino; e comprimento não nulo',
    limiar: { chave: 'separacaoDeArestasParalelas', descricao: `separação ≥ ${lim('separacaoDeArestasParalelas')} px` },
    fonte: 'consequência de A1.6 (cada aresta tem rótulo próprio e legível)',
  },
  {
    id: 'A5.9', familia: 'A5', nome: 'Uniformidade de comprimento de aresta (ELD)', severidade: 'warn', insumo: 'geometria',
    mede: 'ELD = 1/(1 + desvio relativo médio ao comprimento ideal)',
    limiar: { chave: 'uniformidadeDeComprimentoQ1', descricao: `warn se ELD < ${lim('uniformidadeDeComprimentoQ1')}` },
    fonte: 'Mooney et al., GD 2025, eq. (4); Purchase 2002',
    nota: 'a rubrica pede o cálculo SEPARADO por classe de aresta — em diagrama com grupos aninhados, ' +
      'comprimento intra-grupo e inter-grupo variam por desenho, não por defeito.',
  },

  // ------------------------------------------------------------------- A6
  {
    id: 'A6.1', familia: 'A6', nome: 'Resolução angular (AR)', severidade: 'fail', escalona: true, insumo: 'geometria',
    mede: 'AR normalizado, e o ângulo absoluto mínimo entre arestas incidentes ao mesmo nó',
    limiar: { chave: 'resolucaoAngularQ1', descricao: `warn se AR < ${lim('resolucaoAngularQ1')}; fail se o ângulo absoluto < ${lim('anguloIncidenteMinimo')}°` },
    fonte: 'Mooney et al., GD 2025, eq. (1); Purchase 2002',
  },
  {
    id: 'A6.2', familia: 'A6', nome: 'Uniformidade de nós (NU)', severidade: 'warn', insumo: 'geometria',
    mede: 'distribuição dos nós numa grade sobre o bounding box',
    limiar: { chave: 'uniformidadeDeNosQ1', descricao: `warn se NU < ${lim('uniformidadeDeNosQ1')}` },
    fonte: 'Mooney et al., GD 2025, eq. (10)',
  },
  {
    id: 'A6.3', familia: 'A6', nome: 'Razão de aspecto (Asp)', severidade: 'warn', insumo: 'geometria',
    mede: 'min(h,w)/max(h,w) do bounding box, e a diferença para a razão do canvas',
    limiar: { chave: 'razaoDeAspectoQ1', descricao: `warn se Asp < ${lim('razaoDeAspectoQ1')} ou se difere do canvas em > ${lim('toleranciaDeRazaoDeAspecto') * 100}%` },
    fonte: 'Mooney et al., GD 2025 (definição + percentis)',
  },
  {
    id: 'A6.4', familia: 'A6', nome: 'Alinhamento a grid', severidade: 'warn', insumo: 'geometria', calibravel: true,
    mede: 'fração de nós que compartilham x ou y com pelo menos um outro nó',
    limiar: { chave: 'alinhamentoMinimo', descricao: `≥ ${lim('alinhamentoMinimo') * 100}% dos nós, passo de ${lim('passoDaGrade')} px` },
    fonte: 'graph aesthetics (alinhamento a grade); Gestalt/simetria via Kobourov et al.',
    nota: 'é o substituto operacional da simetria — ver B1, que a deixa deliberadamente fora de (A).',
  },
  {
    id: 'A6.5', familia: 'A6', nome: 'Preservação de vizinhança (NP) / Stress (KSM)', severidade: 'warn', insumo: 'geometria',
    mede: 'NP e KSM conforme Mooney et al., eqs. (7)–(8)',
    limiar: { chave: 'preservacaoDeVizinhancaQ1', descricao: `warn se NP < ${lim('preservacaoDeVizinhancaQ1')} ou KSM < ${lim('stressQ1')}` },
    fonte: 'Mooney et al., GD 2025, eqs. (7)–(8)',
    nota: 'a própria rubrica avisa: em diagrama de arquitetura a posição é ditada pelos grupos (VPC/AZ), ' +
      'não pela distância de grafo. "Baixa prioridade; provavelmente ruído."',
  },

  // ------------------------------------------------------------------- A7
  {
    id: 'A7.1', familia: 'A7', nome: 'Contraste de texto', severidade: 'fail', insumo: 'estilo',
    mede: 'razão de contraste entre a cor do texto e o FUNDO EFETIVO resolvido pela pilha de grupos',
    limiar: { chave: 'contrasteTextoPequeno', descricao: `≥ ${lim('contrasteTextoPequeno')}:1; ≥ ${lim('contrasteTextoGrande')}:1 para texto grande` },
    fonte: 'WCAG 2.2 SC 1.4.3 (AA); fórmula em G18',
  },
  {
    id: 'A7.2', familia: 'A7', nome: 'Contraste não-textual', severidade: 'fail', insumo: 'estilo',
    mede: 'contraste de borda de nó, borda de grupo, traço de aresta e ponta de seta contra o fundo efetivo',
    limiar: { chave: 'contrasteNaoTextual', descricao: `≥ ${lim('contrasteNaoTextual')}:1` },
    fonte: 'WCAG 2.2 SC 1.4.11 — cobre "each line in a graph"',
  },
  {
    id: 'A7.3', familia: 'A7', nome: 'Cor não é o único canal', severidade: 'fail', insumo: 'estilo',
    mede: 'dois significados que diferem APENAS em cor de preenchimento',
    limiar: { descricao: '0 pares' },
    fonte: 'WCAG 2.2 SC 1.4.1 (nível A); Azure WAF; C4; Google style guide',
  },
  {
    id: 'A7.4', familia: 'A7', nome: 'Distinguibilidade sob deficiência de cor', severidade: 'warn', insumo: 'estilo', calibravel: true,
    mede: 'menor ΔE00 entre cores de significados distintos, sob protanopia, deuteranopia e tritanopia',
    limiar: { chave: 'deltaE00Minimo', descricao: `ΔE00 ≥ ${lim('deltaE00Minimo')} nas três simulações` },
    fonte: 'WCAG SC 1.4.1 é o requisito normativo; o teste de simulação é operacionalização de engenharia',
    nota: 'A7.3 já é a rede de segurança normativa; A7.4 é diagnóstico complementar.',
  },
  {
    id: 'A7.5', familia: 'A7', nome: 'Contraste da legenda', severidade: 'fail', insumo: 'estilo',
    mede: 'A7.1 e A7.2 aplicados ao texto e às amostras de cor da legenda',
    limiar: { descricao: 'idem A7.1 e A7.2' },
    fonte: 'WCAG 2.2 SC 1.4.3 e 1.4.11',
  },

  // ------------------------------------------------------------------- A8
  {
    id: 'A8.1', familia: 'A8', nome: 'Contagem de elementos de primeira classe', severidade: 'fail', escalona: true, insumo: 'geometria',
    mede: 'número de nós, excluindo caixas de grupo',
    limiar: { chave: 'elementosAlvo', descricao: `alvo ≤ ${lim('elementosAlvo')}; warn em 21–${lim('elementosFalha')}; fail acima de ${lim('elementosFalha')}` },
    fonte: 'Ghoniem/Fekete/Castagliola; Yoghourdjian et al.; Störrle; C4 FAQ',
    nota: 'a rubrica é explícita quanto ao remédio: DECOMPOR, não encolher (Moody & Heymans, RE\'09).',
  },
  {
    id: 'A8.2', familia: 'A8', nome: 'Densidade de arestas', severidade: 'warn', insumo: 'geometria',
    mede: 'd = |E|/C(|V|,2) e a densidade linear |E|/|V|',
    limiar: { chave: 'densidadeMaxima', descricao: `warn se d > ${lim('densidadeMaxima')} E |V| > ${lim('elementosAlvo')}` },
    fonte: 'Yoghourdjian et al. (78% dos estudos usam densidade <10%)',
  },
  {
    id: 'A8.3', familia: 'A8', nome: 'Arestas por nó (fan-out)', severidade: 'warn', insumo: 'geometria', calibravel: true,
    mede: 'max(grau(v))',
    limiar: { chave: 'fanOutMaximo', descricao: `warn se grau > ${lim('fanOutMaximo')}` },
    fonte: 'derivado de A6.1 + Ware et al. 2002',
  },
  {
    id: 'A8.4', familia: 'A8', nome: 'Cobertura de tinta', severidade: 'warn', insumo: 'render', calibravel: true,
    mede: 'fração de pixels não-fundo sobre a área do canvas',
    limiar: { chave: 'coberturaDeTinta', descricao: `faixa [${lim('coberturaDeTinta').join(' ; ')}] como sinal, não reprovação` },
    fonte: 'Tufte (data-ink), explicitamente adaptado e enfraquecido pela própria rubrica',
    porqueRender: 'pixel não-fundo só existe depois de rasterizar. Não há aproximação honesta a partir do plano: ' +
      'somar áreas de caixa conta o vão dentro de um grupo como tinta, e um grupo grande e vazio ficaria "denso".',
  },
];

const INDICE = new Map(CHECAGENS.map(c => [c.id, c]));
const porId = id => INDICE.get(id);
const daFamilia = f => CHECAGENS.filter(c => c.familia === f);

/** As que o validador obrigatório cobre — tudo que não foi entregue ao render. */
const DO_VALIDADOR = CHECAGENS.filter(c => c.insumo !== 'render');
/** As que o juiz oportunista cobre. A partição é exaustiva e sem sobreposição. */
const DO_RENDER = CHECAGENS.filter(c => c.insumo === 'render');

module.exports = {
  CHECAGENS, INDICE, LIMIARES, SEVERIDADES, INSUMOS,
  DO_VALIDADOR, DO_RENDER, porId, daFamilia, lim,
};
