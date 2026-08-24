'use strict';
/**
 * Diagramas quebrados de propósito — o controle negativo do validador.
 *
 * O `check-fronteira.cjs` do #11 estabeleceu a convenção e ela vale aqui: uma
 * checagem só está provada quando REPROVA o que devia. Um validador que só foi
 * testado contra desenhos bons e nunca falhou é indistinguível de um validador
 * que não roda — e o segundo também dá suíte verde.
 *
 * Cada caso abaixo quebra UMA coisa nomeada e declara qual checagem tem de
 * acusar. A asserção é de inclusão, não de igualdade: quebrar a contenção de um
 * nó dispara A4.1, A4.2 e A4.4 ao mesmo tempo, porque as três olham a mesma
 * geometria de ângulos diferentes, e exigir que só uma disparasse seria exigir
 * que a rubrica não tivesse redundância — ela tem, de propósito.
 *
 * Os planos são construídos à mão, e não gerados pelo motor, por dois motivos:
 * o motor não sabe produzir estes defeitos (é o trabalho dele não produzir), e
 * um plano literal deixa o defeito visível na revisão do próprio arquivo.
 *
 * Lembrete de que a geometria do plano é RELATIVA AO PAI: `geo` de um filho é
 * medida a partir do canto do pai, e é justamente isso que torna fácil escrever
 * um filho que escapa da caixa sem perceber.
 */

const CINZA = '#232F3E';

/** Estilo de container (grupo de contenção). */
const grupo = (traco = '#00A4A6', preenche = 'none') =>
  `points=[[0,0],[1,1]];outlineConnect=0;gradientColor=none;html=1;whiteSpace=wrap;fontSize=12;` +
  `container=1;pointerEvents=0;collapsible=0;recursiveResize=0;shape=mxgraph.aws4.group;` +
  `grIcon=mxgraph.aws4.group_vpc;strokeColor=${traco};fillColor=${preenche};verticalAlign=top;align=left;spacingLeft=30;`;

/** Estilo de service icon (folha). */
const icone = (preenche = '#ED7100', res = 'lambda') =>
  `sketch=0;outlineConnect=0;fontColor=${CINZA};gradientColor=none;fillColor=${preenche};strokeColor=#ffffff;` +
  `dashed=0;verticalLabelPosition=bottom;verticalAlign=top;align=center;html=1;fontSize=12;fontStyle=0;` +
  `aspect=fixed;shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.${res};`;

/** Estilo de faixa (sobreposição), tracejada, sem preenchimento. */
const faixa = (traco = '#7AA116') =>
  `fillColor=none;strokeColor=${traco};dashed=1;verticalAlign=top;fontStyle=0;fontColor=${traco};` +
  `whiteSpace=wrap;html=1;container=1;pointerEvents=0;collapsible=0;recursiveResize=0;labelBackgroundColor=#FFFFFF;`;

const aresta = (extra = '') =>
  `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=${CINZA};strokeWidth=1.6;` +
  `endArrow=blockThin;endFill=1;fontSize=12;fontColor=${CINZA};labelBackgroundColor=#FFFFFF;${extra}`;

const v = (id, pai, x, y, w, h, style, rotulo = id) => ({ tipo: 'vertice', id, pai, rotulo, style, geo: { x, y, w, h } });
const e = (id, de, para, rotulo, style = aresta(), pontos = []) => ({ tipo: 'aresta', id, pai: '1', de, para, rotulo, style, pontos });

/** Empacota células num plano, com o modelo embutido como o motor faz. */
function montar(id, celulas, modelo, larg = 900, alt = 700) {
  return {
    plano: {
      id, nome: id, fundo: '#FFFFFF', larg, alt,
      celulas: [
        ...celulas,
        {
          tipo: 'vertice', id: 'panlabs-modelo', pai: '1', rotulo: '', visivel: false,
          style: 'text;html=1;', geo: { x: 0, y: 0, w: 1, h: 1 },
          dados: { panlabsModelo: JSON.stringify(modelo) },
        },
      ],
    },
    modelo,
  };
}

// Um modelo mínimo que dá tipo aos ids usados nos casos.
const mod = (nos, extra = {}) => ({
  esquema: 'panlabs-aws-diagrams/modelo@1', id: 'quebrado', titulo: 'Caso quebrado',
  vista: 'tecnica', nos, ...extra,
});

const CASOS = [

  {
    nome: 'nó desenhado dentro da VPC errada',
    porque: 'a caixa de VPC É a fronteira de rede; o desenho afirma um pertencimento que o modelo nega',
    espera: ['A4.2', 'A4.4'],
    ...montar('a4.2', [
      v('vpc-a', '1', 60, 60, 300, 260, grupo()),
      v('vpc-b', '1', 460, 60, 300, 260, grupo('#C925D1')),
      // filho de vpc-a, mas com geo que o joga para dentro de vpc-b
      v('srv', 'vpc-a', 460, 100, 78, 78, icone()),
    ], mod([
      { id: 'vpc-a', tipo: 'vpc' }, { id: 'vpc-b', tipo: 'vpc' },
      { id: 'srv', tipo: 'servico', servico: 'lambda', dentro: 'vpc-a' },
    ])),
  },

  {
    nome: 'aresta atravessando uma VPC de que não sai nem para onde vai',
    porque: 'sugere um caminho de rede inexistente entre duas redes que não se falam',
    espera: ['A5.5'],
    ...montar('a5.5', [
      v('vpc-meio', '1', 300, 60, 260, 300, grupo()),
      v('dentro', 'vpc-meio', 90, 120, 78, 78, icone('#8C4FFF', 'vpc_endpoints')),
      v('esq', '1', 60, 160, 78, 78, icone()),
      v('dir', '1', 700, 160, 78, 78, icone('#C925D1', 'rds')),
      // a polilinha corta a caixa de vpc-meio na horizontal
      e('e1', 'esq', 'dir', 'replica', aresta(), [{ x: 200, y: 199 }, { x: 660, y: 199 }]),
    ], mod([
      { id: 'vpc-meio', tipo: 'vpc' },
      { id: 'dentro', tipo: 'servico', servico: 'vpc_endpoints', dentro: 'vpc-meio' },
      { id: 'esq', tipo: 'servico', servico: 'lambda' },
      { id: 'dir', tipo: 'servico', servico: 'rds' },
    ], { arestas: [{ de: 'esq', para: 'dir', rotulo: 'replica' }] })),
  },

  {
    nome: 'faixa de AZ abraçando um nó que não é membro dela',
    porque: 'a faixa afirma um atributo compartilhado — dizer que um EC2 está numa AZ em que ele não está é a mesma mentira de A4.2, por outro caminho',
    espera: ['F1'],
    ...montar('f1', [
      v('az-a', '1', 60, 60, 320, 300, faixa()),
      v('membro', '1', 100, 140, 78, 78, icone()),
      v('forasteiro', '1', 240, 140, 78, 78, icone('#C925D1', 'rds')),
    ], mod([
      { id: 'membro', tipo: 'servico', servico: 'lambda' },
      { id: 'forasteiro', tipo: 'servico', servico: 'rds' },
    ], { faixas: [{ id: 'az-a', membros: ['membro'], rotulo: 'Availability Zone · us-east-1a' }] })),
  },

  {
    nome: 'faixa que declara um membro e não o abraça',
    porque: 'o outro lado do mesmo defeito: o modelo afirma o atributo e o desenho não mostra',
    espera: ['F1'],
    ...montar('f1-b', [
      v('asg', '1', 60, 60, 200, 200, faixa()),
      v('dentro', '1', 100, 120, 78, 78, icone()),
      v('esquecido', '1', 500, 120, 78, 78, icone()),
    ], mod([
      { id: 'dentro', tipo: 'servico', servico: 'ec2' },
      { id: 'esquecido', tipo: 'servico', servico: 'ec2' },
    ], { faixas: [{ id: 'asg', membros: ['dentro', 'esquecido'], rotulo: 'Auto Scaling group' }] })),
  },

  {
    nome: 'dois nós sobrepostos',
    porque: 'node occlusion — um ícone tapa o outro e o leitor não sabe que há dois',
    espera: ['A3.1'],
    ...montar('a3.1', [
      v('a', '1', 100, 100, 78, 78, icone()),
      v('b', '1', 140, 130, 78, 78, icone('#C925D1', 'rds')),
    ], mod([
      { id: 'a', tipo: 'servico', servico: 'lambda' },
      { id: 'b', tipo: 'servico', servico: 'rds' },
    ])),
  },

  {
    nome: 'aresta passando por cima de um nó que não é ponta dela',
    porque: 'node-edge occlusion — a linha parece tocar um serviço que ela não toca',
    espera: ['A3.5'],
    ...montar('a3.5', [
      v('origem', '1', 60, 160, 78, 78, icone()),
      v('meio', '1', 380, 160, 78, 78, icone('#8C4FFF', 'vpc_endpoints')),
      v('destino', '1', 700, 160, 78, 78, icone('#C925D1', 'rds')),
      e('e1', 'origem', 'destino', 'grava', aresta(), [{ x: 250, y: 199 }, { x: 620, y: 199 }]),
    ], mod([
      { id: 'origem', tipo: 'servico', servico: 'lambda' },
      { id: 'meio', tipo: 'servico', servico: 'vpc_endpoints' },
      { id: 'destino', tipo: 'servico', servico: 'rds' },
    ], { arestas: [{ de: 'origem', para: 'destino', rotulo: 'grava' }] })),
  },

  {
    nome: 'duas arestas paralelas coladas uma na outra',
    porque: 'os dois rótulos caem no mesmo traço e nenhum dos dois se lê',
    espera: ['A5.8'],
    ...montar('a5.8', [
      v('a', '1', 60, 160, 78, 78, icone()),
      v('b', '1', 600, 160, 78, 78, icone('#C925D1', 'rds')),
      e('e1', 'a', 'b', 'lê', aresta(), [{ x: 300, y: 199 }]),
      e('e2', 'a', 'b', 'escreve', aresta(), [{ x: 300, y: 201 }]),
    ], mod([
      { id: 'a', tipo: 'servico', servico: 'lambda' },
      { id: 'b', tipo: 'servico', servico: 'rds' },
    ], { arestas: [{ de: 'a', para: 'b', rotulo: 'lê' }, { de: 'a', para: 'b', rotulo: 'escreve' }] })),
  },

  {
    nome: 'arestas que se cruzam em ângulo raso',
    porque: 'Purchase 1997 — cruzamento é a estética de maior efeito medido, e raso é o pior tipo',
    espera: ['A5.1', 'A5.2'],
    ...montar('a5.1', [
      v('a1', '1', 60, 100, 78, 78, icone()),
      v('a2', '1', 60, 300, 78, 78, icone()),
      v('b1', '1', 700, 130, 78, 78, icone('#C925D1', 'rds')),
      v('b2', '1', 700, 270, 78, 78, icone('#C925D1', 'rds')),
      e('e1', 'a1', 'b2', 'um', aresta()),
      e('e2', 'a2', 'b1', 'dois', aresta()),
    ], mod([
      { id: 'a1', tipo: 'servico', servico: 'lambda' }, { id: 'a2', tipo: 'servico', servico: 'lambda' },
      { id: 'b1', tipo: 'servico', servico: 'rds' }, { id: 'b2', tipo: 'servico', servico: 'rds' },
    ], { arestas: [{ de: 'a1', para: 'b2', rotulo: 'um' }, { de: 'a2', para: 'b1', rotulo: 'dois' }] })),
  },

  {
    nome: 'contraste de texto insuficiente',
    porque: 'WCAG 2.2 SC 1.4.3 — cinza claro sobre branco não chega a 4,5:1',
    espera: ['A7.1'],
    ...montar('a7.1', [
      v('grupo-palido', '1', 60, 60, 400, 300, grupo('#CCCCCC').replace(`fontColor=${CINZA}`, '') + 'fontColor=#BBBBBB;'),
      v('no', 'grupo-palido', 40, 80, 78, 78, icone().replace(`fontColor=${CINZA}`, 'fontColor=#DDDDDD')),
    ], mod([
      { id: 'grupo-palido', tipo: 'vpc' },
      { id: 'no', tipo: 'servico', servico: 'lambda', dentro: 'grupo-palido' },
    ])),
  },

  {
    nome: 'preenchimento de ícone que some no fundo',
    porque: 'WCAG 2.2 SC 1.4.11 — a silhueta do ícone precisa de 3:1 contra o que está atrás',
    espera: ['A7.2'],
    ...montar('a7.2', [
      // a borda do grupo é escura de propósito: se ela também reprovasse, o caso
      // passaria sem provar que o PREENCHIMENTO do ícone é medido
      v('fundo', '1', 60, 60, 400, 300, grupo('#595959', '#F2F2F2')),
      v('quase-invisivel', 'fundo', 40, 80, 78, 78, icone('#EFEFEF')),
    ], mod([
      { id: 'fundo', tipo: 'vpc' },
      { id: 'quase-invisivel', tipo: 'servico', servico: 'lambda', dentro: 'fundo' },
    ])),
  },

  {
    nome: 'texto escuro sobre grupo escuro',
    porque: 'o caso que o corte de z errado deixava passar: 1,00:1 na tela virava 13,57:1 medido contra a página. '
      + 'É a direção perigosa do bug — o falso NEGATIVO, que aprova o ilegível',
    espera: ['A7.1'],
    ...montar('a7.1-escuro', [
      // grupo com preenchimento escuro e rótulo quase da mesma cor
      v('grupo-escuro', '1', 60, 60, 400, 300,
        grupo('#232F3E', '#232F3D').replace('fontColor=', 'fontColorAntigo=') + 'fontColor=#232F3E;'),
      v('no', 'grupo-escuro', 40, 80, 78, 78, icone()),
    ], mod([
      { id: 'grupo-escuro', tipo: 'vpc' },
      { id: 'no', tipo: 'servico', servico: 'lambda', dentro: 'grupo-escuro' },
    ])),
  },

  {
    nome: 'desenho estourando o canvas',
    porque: 'o `drawio -x` exporta a caixa que contém tudo; o que passa da página vira imagem cortada ou faixa em branco',
    espera: ['A3.7'],
    ...montar('a3.7', [
      v('a', '1', 100, 100, 78, 78, icone()),
      v('longe', '1', 1400, 100, 78, 78, icone()),
    ], mod([
      { id: 'a', tipo: 'servico', servico: 'lambda' },
      { id: 'longe', tipo: 'servico', servico: 'lambda' },
    ]), 600, 400),
  },

  {
    nome: 'ícone espelhado e com sombra',
    porque: 'AWS e Azure proíbem deformar o ícone; Tufte chama a sombra de chartjunk',
    espera: ['A2.2', 'A2.11'],
    ...montar('a2.2', [
      v('torto', '1', 100, 100, 78, 78, icone() + 'flipH=1;shadow=1;'),
      v('reto', '1', 300, 100, 78, 78, icone()),
    ], mod([
      { id: 'torto', tipo: 'servico', servico: 'lambda' },
      { id: 'reto', tipo: 'servico', servico: 'lambda' },
    ])),
  },

  {
    nome: 'elemento sem nome e aresta bidirecional',
    porque: 'C4 — todo elemento nomeado, toda linha unidirecional',
    espera: ['A1.4', 'A1.7'],
    ...montar('a1', [
      v('anonimo', '1', 100, 100, 78, 78, icone(), ''),
      v('outro', '1', 400, 100, 78, 78, icone('#C925D1', 'rds')),
      e('e1', 'anonimo', 'outro', 'conversa', aresta('startArrow=blockThin;startFill=1;')),
    ], mod([
      { id: 'anonimo', tipo: 'servico', servico: 'lambda' },
      { id: 'outro', tipo: 'servico', servico: 'rds' },
    ], { arestas: [{ de: 'anonimo', para: 'outro', rotulo: 'conversa' }] })),
  },

  {
    nome: 'dois grupos irmãos sobrepostos',
    porque: 'a hierarquia AWS é uma árvore; irmãos sobrepostos deixam ambíguo quem contém o quê',
    espera: ['A4.3'],
    ...montar('a4.3', [
      v('vpc-a', '1', 60, 60, 300, 260, grupo()),
      v('vpc-b', '1', 260, 60, 300, 260, grupo('#C925D1')),
    ], mod([{ id: 'vpc-a', tipo: 'vpc' }, { id: 'vpc-b', tipo: 'vpc' }])),
  },

  {
    nome: 'filho escapando da caixa do pai',
    porque: 'contenção estrita — metade do recurso desenhado fora da subnet a que pertence',
    espera: ['A4.1'],
    ...montar('a4.1', [
      v('vpc', '1', 60, 60, 300, 260, grupo()),
      v('vazando', 'vpc', 260, 100, 78, 78, icone()),
    ], mod([
      { id: 'vpc', tipo: 'vpc' },
      { id: 'vazando', tipo: 'servico', servico: 'lambda', dentro: 'vpc' },
    ])),
  },
];

/**
 * O controle positivo: mesmo vocabulário, geometria correta.
 *
 * Serve para provar que os casos acima falham pelo DEFEITO e não pelo estilo de
 * construção — se este aqui também acusasse A4.2, o que a suíte estaria medindo
 * seria o construtor de planos, não o validador.
 */
const CONTROLE = montar('controle', [
  v('nuvem', '1', 40, 40, 760, 420, grupo('#232F3E')),
  v('vpc', 'nuvem', 20, 46, 480, 340, grupo()),
  v('sub', 'vpc', 20, 46, 440, 260, grupo('#00A4A6', '#E6F6F7')),
  v('app', 'sub', 30, 60, 78, 78, icone()),
  v('banco', 'sub', 320, 60, 78, 78, icone('#C925D1', 'rds')),
  v('externo', 'nuvem', 620, 120, 78, 78, icone('#8C4FFF', 'vpc_endpoints')),
  e('e1', 'app', 'banco', 'consulta', aresta()),
], mod([
  { id: 'nuvem', tipo: 'nuvem' },
  { id: 'vpc', tipo: 'vpc', dentro: 'nuvem' },
  { id: 'sub', tipo: 'subnet', acesso: 'privada', dentro: 'vpc' },
  { id: 'app', tipo: 'servico', servico: 'lambda', dentro: 'sub' },
  { id: 'banco', tipo: 'servico', servico: 'rds', dentro: 'sub' },
  { id: 'externo', tipo: 'servico', servico: 'vpc_endpoints', dentro: 'nuvem' },
], { arestas: [{ de: 'app', para: 'banco', rotulo: 'consulta', protocolo: 'sql' }] }), 900, 560);

module.exports = { CASOS, CONTROLE };
