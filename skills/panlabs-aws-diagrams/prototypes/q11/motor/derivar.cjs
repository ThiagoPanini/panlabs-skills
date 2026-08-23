'use strict';
/**
 * Derivação: o que o motor descobre sozinho a partir do modelo.
 *
 * Tudo aqui existe para que o agente NÃO tenha de decidir. A faixa de AZ é o
 * caso exemplar: o #19 decidiu que a AZ é dimensão da subnet, nunca container,
 * e que ela vira faixa desenhada só quando a arquitetura de fato afirma
 * redundância zonal. Essa é uma regra executável — então é do motor, e o
 * modelo não tem onde escrevê-la nem como forçá-la.
 */

const path = require('path');
const { camadasDeSubnets, lacunasDeCamada, ordemDeCamada } = require('./camadas.cjs');

const CAMINHO_CATALOGO = path.join(__dirname, '..', '..', '..', 'catalog', 'aws-shapes.cjs');
let _catalogo = null;

/**
 * A derivação passou a depender do catálogo por causa do #22.
 *
 * Até aqui `derivar` era função só da semântica do modelo. A camada de rede de
 * uma subnet sai da CATEGORIA AWS do que ela guarda, e quem sabe categoria é o
 * catálogo (#17) — então ele entra aqui. A dependência é injetável (`opts.cat`)
 * para que a régua possa rodar contra um catálogo de teste, e memoizada porque
 * o `require` já é, mas a montagem do índice não.
 */
function catalogoPadrao() {
  if (!_catalogo) _catalogo = require(CAMINHO_CATALOGO).carregar();
  return _catalogo;
}

/**
 * A ordem dos IRMÃOS é derivada, não herdada do arquivo.
 *
 * O #11 derivou a ordem das LINHAS da grade por este motivo (incerteza 4 do #7:
 * quem escreve o modelo é um agente, e nenhum LLM emite a mesma lista duas
 * vezes na mesma ordem). O que passou batido lá é que a lista de FILHOS tem o
 * mesmo problema, e ele só aparece quando um container tem irmãos que nenhuma
 * aresta liga: o ELK layouta por camada a partir das arestas, e onde não há
 * aresta o desempate é a ordem de entrada.
 *
 * Medido no modelo de landing zone: a conta Org Management tem Organizations e
 * Control Tower sem aresta entre eles, e embaralhar `nos` trocava os dois de
 * lugar. Com aresta, o ELK decide e este critério só desempata.
 *
 * Critério: exposição primeiro (pública antes da privada, o sentido de leitura
 * do deck), depois a CAMADA DE REDE, depois o que está escrito na caixa.
 *
 * O #22 tirou daqui o placeholder: o desempate do meio era alfabético e
 * derrubava `Web · Data` e `Ingest · Core`. Agora quem desempata é a camada
 * que a subnet ocupa, lida do que ela guarda (`camadas.cjs`). O alfabeto
 * sobreviveu como ÚLTIMO desempate, e mudou de função: ele não carrega mais
 * significado nenhum, só garante ordem total entre coisas que a semântica
 * empatou — que é o que o determinismo precisa.
 *
 * A exposição continua na frente, e isso é decisão, não inércia: uma subnet
 * PÚBLICA que só hospeda compute continua acima de uma subnet PRIVADA que
 * hospeda um Transit Gateway. Público em cima é o sentido de leitura do deck, e
 * a camada ordena dentro dele.
 */
const ORDEM_ACESSO = { publica: 0, privada: 1 };

function chaveDeIrmao(n, camadaDe) {
  return [
    ORDEM_ACESSO[n.acesso] ?? 9,
    n.tipo === 'subnet' ? ordemDeCamada(camadaDe(n.id)) : ordemDeCamada(null),
    String(n.rotulo || n.servico || n.id),
    String(n.id),
  ];
}

function compararIrmaos(a, b, camadaDe) {
  const ka = chaveDeIrmao(a, camadaDe), kb = chaveDeIrmao(b, camadaDe);
  return ka[0] - kb[0] || ka[1] - kb[1] ||
    ka[2].localeCompare(kb[2], 'pt') || ka[3].localeCompare(kb[3]);
}

/**
 * Árvore de contenção a partir da lista plana.
 *
 * `camadaDe` é opcional porque a árvore é construída DUAS vezes: a primeira
 * sem camada nenhuma, só para poder navegar até os descendentes de cada subnet
 * (é deles que a camada sai); a segunda já sabendo ordenar. A primeira passada
 * só é usada para consultar ancestralidade, que não depende de ordem.
 */
function arvore(modelo, camadaDe = () => null) {
  const porId = new Map(modelo.nos.map(n => [n.id, n]));
  const filhos = new Map(modelo.nos.map(n => [n.id, []]));
  const raizes = [];
  for (const n of modelo.nos) {
    if (n.dentro === undefined) raizes.push(n);
    else filhos.get(n.dentro).push(n);
  }
  const cmp = (a, b) => compararIrmaos(a, b, camadaDe);
  raizes.sort(cmp);
  for (const lista of filhos.values()) lista.sort(cmp);
  const pai = n => n.dentro === undefined ? null : porId.get(n.dentro);
  const ancestrais = n => { const o = []; let c = pai(n); while (c) { o.push(c); c = pai(c); } return o; };
  const profundidade = n => ancestrais(n).length;
  return { porId, filhos, raizes, pai, ancestrais, profundidade };
}

/**
 * O gatilho do #19, portado para o IR plano.
 *
 *   desenhar = ≥2 AZs distintas E algum PAPEL de subnet presente em ≥2 AZs
 *
 * O papel é escopado por VPC: "private subnet" na VPC A e na VPC B são redes
 * diferentes, e a repetição entre elas não afirma redundância zonal nenhuma.
 */
function gatilhoAz(modelo, t) {
  const subnets = modelo.nos.filter(n => n.tipo === 'subnet');
  const azs = [...new Set(subnets.map(s => s.az).filter(Boolean))].sort();
  if (azs.length < 2)
    return { desenhar: false, azs, porque: `só ${azs.length} AZ distinta declarada` };

  const vpcDe = s => (t.ancestrais(s).find(a => a.tipo === 'vpc') || {}).id;
  const porPapel = new Map();
  for (const s of subnets) {
    if (!s.az) continue;
    const k = `${vpcDe(s)}|${s.acesso || '?'}|${s.rotulo || ''}`;
    if (!porPapel.has(k)) porPapel.set(k, new Set());
    porPapel.get(k).add(s.az);
  }
  const redundantes = [...porPapel.entries()].filter(([, zs]) => zs.size >= 2);
  if (!redundantes.length)
    return { desenhar: false, azs, porque: `${azs.length} AZs, mas nenhum papel de subnet se repete entre elas` };

  return {
    desenhar: true, azs,
    porque: `${redundantes.length} papel(is) em ≥2 AZs: ` +
      redundantes.map(([k, zs]) => `${k.split('|')[0]}/${k.split('|')[1]}×${zs.size}`).join(', '),
  };
}

// ------------------------------------------------------------------ multi-conta

/** Conta mais próxima na linha de ancestrais. `null` = o nó não mora em conta nenhuma. */
function contaDe(no, t) {
  if (!no) return null;
  if (no.tipo === 'conta') return no;
  return t.ancestrais(no).find(a => a.tipo === 'conta') || null;
}

/**
 * O gatilho de OU — irmão exato do gatilho de AZ, e pela mesma razão.
 *
 * O #19 decidiu que a AZ é DIMENSÃO da subnet, nunca container, e que ela vira
 * faixa desenhada só quando a arquitetura de fato afirma redundância zonal. A
 * medição do #6 diz a mesma coisa da OU por outro caminho: `AWS account` é um
 * group icon oficial, `Organizational unit` NÃO é — a OU aparece como par
 * ícone+rótulo flutuando acima do primeiro membro, sem caixa nenhuma (G2).
 *
 * Então a OU é dimensão da conta, e o gatilho pergunta a mesma coisa: a
 * declaração AGRUPA alguma coisa, ou só repete o que o rótulo da conta já diz?
 *
 *   desenhar = alguma OU com ≥2 contas   E   alguma conta FORA dessa OU
 *
 * As duas cláusulas são o eco exato das duas do #19 (≥2 zonas E papel repetido
 * entre elas), e cada uma mata um caso concreto:
 *
 *   sem a 1ª  duas OUs de uma conta cada ganhariam dois rótulos que não
 *             agrupam nada — o nome da conta já separa as duas.
 *   sem a 2ª  um diagrama inteiro dentro de uma OU só ganharia um rótulo
 *             constante, que é subtítulo, não agrupamento. Faixa sem
 *             contraste não é faixa.
 *
 * A conta SEM OU não vira uma OU anônima, mas CONTA como contraste: é o caso
 * da Management, que o `P2` põe no topo e fora de qualquer OU, e é justamente
 * contra ela que "OU – Security" significa alguma coisa.
 */
function gatilhoOu(modelo, t) {
  const contas = modelo.nos.filter(n => n.tipo === 'conta');
  const porOu = new Map();
  for (const c of contas) {
    if (!c.ou) continue;
    if (!porOu.has(c.ou)) porOu.set(c.ou, []);
    porOu.get(c.ou).push(c.id);
  }
  const ous = [...porOu.keys()].sort();
  const agrupam = ous.filter(o => porOu.get(o).length >= 2);

  if (!agrupam.length)
    return {
      desenhar: false, ous,
      porque: ous.length
        ? `${ous.length} OU(s), nenhuma com ≥2 contas — o rótulo da conta já separa`
        : 'nenhuma OU declarada',
    };

  const foraDaMaior = contas.filter(c => !agrupam.includes(c.ou));
  if (!foraDaMaior.length && agrupam.length < 2)
    return {
      desenhar: false, ous,
      porque: `todas as contas estão em "${agrupam[0]}" — rótulo constante é subtítulo, não faixa`,
    };

  // O GATILHO é decidido pelas OUs que agrupam; o DESENHO cobre todas as
  // declaradas. Rotular "Security" e deixar "Workloads" nua leria como se a
  // segunda não fosse uma OU — e a SRA rotula `OU – Workloads` mesmo com uma
  // conta membro só. Uma vez que a dimensão vira desenho, ela vira desenho
  // inteira.
  return {
    desenhar: true, ous, agrupam, porOu,
    porque: `${agrupam.length} OU(s) com ≥2 contas: ` +
      agrupam.map(o => `${o}×${porOu.get(o).length}`).join(', '),
  };
}

/** As arestas cujas duas pontas moram em contas DIFERENTES. Entrar da rua não conta. */
function travessias(arestas, t) {
  return arestas.filter(a => {
    const ca = contaDe(t.porId.get(a.de), t);
    const cb = contaDe(t.porId.get(a.para), t);
    return ca && cb && ca.id !== cb.id;
  }).map(a => ({
    ...a,
    contaDe: contaDe(t.porId.get(a.de), t).id,
    contaPara: contaDe(t.porId.get(a.para), t).id,
  }));
}

/**
 * Em qual dos dois modos o desenho está — e isto NÃO se pergunta ao agente.
 *
 * O #6 §6.7 é explícito: a vista de INTEGRAÇÃO (2–4 contas, o assunto é a
 * travessia) obedece a regras diferentes da vista de INVENTÁRIO (o mapa de
 * colocação, "que serviço mora em que conta"). Um gerador precisa saber em qual
 * está, porque as duas se contradizem: a de inventário suprime toda aresta
 * cross-account (`E1`, a regra soberana — o diagrama carro-chefe da AWS tem
 * ZERO conectores), e a de integração existe para desenhá-la.
 *
 * Os dois limites são medidos, não escolhidos:
 *
 *   contas 2..4   `X1` — a vista de integração do corpus é sempre desse tamanho.
 *   travessias ≤7 as vistas por-conta oficiais carregam de 2 a 7 conectores
 *                 (§4.3). Acima disso não há exemplo oficial nenhum, e `D1` diz
 *                 que o que estoura a página é a contagem de ARESTAS, não a de
 *                 contas. Então o motor volta para inventário e decompõe.
 */
const MAX_CONTAS_INTEGRACAO = 4;
const MAX_TRAVESSIAS = 7;

function modoDeContas(modelo, t, arestas) {
  const contas = modelo.nos.filter(n => n.tipo === 'conta');
  if (contas.length < 2)
    return { modo: 'nenhum', contas: contas.length, travessias: 0, porque: `${contas.length} conta no modelo` };

  const cruz = travessias(arestas || modelo.arestas || [], t);
  if (!cruz.length)
    return {
      modo: 'inventario', contas: contas.length, travessias: 0,
      porque: `${contas.length} contas, nenhuma travessia — é mapa de colocação`,
    };
  if (contas.length > MAX_CONTAS_INTEGRACAO)
    return {
      modo: 'inventario', contas: contas.length, travessias: cruz.length,
      porque: `${contas.length} contas passam das ${MAX_CONTAS_INTEGRACAO} que a vista de integração comporta (X1)`,
    };
  if (cruz.length > MAX_TRAVESSIAS)
    return {
      modo: 'inventario', contas: contas.length, travessias: cruz.length,
      porque: `${cruz.length} travessias passam das ${MAX_TRAVESSIAS} que o corpus oficial mostra (D1)`,
    };
  return {
    modo: 'integracao', contas: contas.length, travessias: cruz.length,
    porque: `${contas.length} contas e ${cruz.length} travessia(s) — a travessia é o assunto`,
  };
}

/**
 * A hierarquia de fallback de 6 níveis do #6 §6.4, aplicada na ordem, parando
 * na primeira que serve. É a resposta medida à pergunta do ticket — "canaleta
 * dedicada? jumpStyle no cruzamento? barramento central?".
 *
 *   1. não desenhe                    vista consolidada (E1)
 *   2. callout numerado, sem linha    relação sequencial e narrável (E2)
 *   3. aresta agregada + rótulo       fan-in N→1 (E3)
 *   4. canaleta / barramento          N irmãs recebem o mesmo vínculo (E4)
 *   5. hub central + raios            N→M com entidade central real
 *   6. aresta direta com nó na calha  exatamente 2 contas (E10)
 *
 * O nível 2 fica de fora da escolha automática de propósito: "narrável" não é
 * um fato do modelo, é um julgamento sobre a prosa que acompanha a figura, e o
 * IR não tem — nem deveria ter — onde afirmá-lo.
 */
/**
 * MESMA ORIGEM NÃO BASTA — as arestas têm de ser a MESMA RELAÇÃO.
 *
 * Esta condição não estava na leitura inicial do #6 e apareceu na primeira
 * rodada de casos, com o modelo de três contas: o ECS fala com o Transit
 * Gateway (atracamento de VPC) e com o event bus (PutEvents). Mesma origem,
 * duas contas de destino — a regra ingênua disparava barramento.
 *
 * E um barramento MENTE aqui. `E4` sai do MALZ, onde a barra carrega um
 * vínculo só ("estas contas pertencem a esta OU"), e 1 linha + N stubs é fiel
 * porque o vínculo é literalmente o mesmo. Desenhar uma barra ligando
 * atracamento e PutEvents afirmaria que as duas contas recebem a mesma coisa.
 * `E3` tem o mesmo problema pelo outro lado: colapsar um fan-in em uma aresta
 * rotulada só é honesto se o texto do rótulo valer para todas as origens.
 *
 * O que o IR já tem para responder isso é o par (rótulo, protocolo) — que é
 * semântica, não geometria.
 */
function mesmaRelacao(arestas) {
  const chave = a => `${a.rotulo || ''}|${a.protocolo || ''}`;
  return new Set(arestas.map(chave)).size === 1;
}

function politicaDeTravessia(modo, cruz, t) {
  if (modo !== 'integracao')
    return { nivel: 1, mecanismo: 'suprimir', grupos: [], porque: 'vista de inventário — E1 suprime toda travessia' };

  // fan-in: ≥2 contas de origem levando A MESMA COISA ao mesmo nó de destino
  const porDestino = new Map();
  for (const a of cruz) {
    if (!porDestino.has(a.para)) porDestino.set(a.para, []);
    porDestino.get(a.para).push(a);
  }
  const fanIn = [...porDestino.entries()]
    .filter(([, as]) => new Set(as.map(a => a.contaDe)).size >= 2 && mesmaRelacao(as));
  if (fanIn.length)
    return {
      nivel: 3, mecanismo: 'agregada',
      grupos: fanIn.map(([para, as]) => ({ para, contas: [...new Set(as.map(a => a.contaDe))].sort() })),
      porque: `fan-in de ${new Set(fanIn[0][1].map(a => a.contaDe)).size} contas em "${fanIn[0][0]}" ` +
        `com a mesma relação — E3 colapsa numa aresta rotulada`,
    };

  // barramento: a MESMA origem levando O MESMO VÍNCULO a ≥2 contas irmãs
  const porOrigem = new Map();
  for (const a of cruz) {
    if (!porOrigem.has(a.de)) porOrigem.set(a.de, []);
    porOrigem.get(a.de).push(a);
  }
  const barramento = [...porOrigem.entries()]
    .filter(([, as]) => new Set(as.map(a => a.contaPara)).size >= 2 && mesmaRelacao(as));
  if (barramento.length)
    return {
      nivel: 4, mecanismo: 'barramento',
      grupos: barramento.map(([de, as]) => ({ de, contas: [...new Set(as.map(a => a.contaPara))].sort() })),
      porque: `"${barramento[0][0]}" leva o mesmo vínculo a ` +
        `${new Set(barramento[0][1].map(a => a.contaPara)).size} contas — E4 roteia por barramento, 1 linha + N stubs`,
    };

  return {
    nivel: 6, mecanismo: 'direta', grupos: cruz.map(a => ({ aresta: a.id })),
    porque: `${cruz.length} travessia(s) entre pares distintos — E10 desenha direto, sem cerimônia na borda (E8)`,
  };
}

/**
 * Onde pendurar cada aresta.
 *
 * O #2 provou que waypoint vive no espaço do PAI da aresta e que o XSD oficial
 * erra ao chamá-lo de absoluto. Há duas saídas coerentes: parentear no ancestral
 * comum e emitir no espaço dele, ou pendurar tudo na camada raiz e emitir
 * absoluto. Escolho a segunda — com `elk.json.edgeCoords: ROOT` o próprio ELK já
 * devolve absoluto, e o #2 diz explicitamente que aí a divergência do XSD é
 * inócua. Uma regra, um sistema de coordenadas, nenhuma conversão.
 */
function paiDaAresta() { return '1'; }

/** Ancestral comum mais próximo — não usado para parentear, mas o layout precisa saber. */
function ancestralComum(a, b, t) {
  const ca = new Set([a.id, ...t.ancestrais(a).map(n => n.id)]);
  for (const n of [b, ...t.ancestrais(b)]) if (ca.has(n.id)) return n;
  return null;
}

function derivar(modelo, opts = {}) {
  const cat = opts.cat || catalogoPadrao();

  /**
   * A camada de rede das subnets, e onde a falta dela muda o desenho (#22).
   *
   * Duas passadas na árvore: a primeira só para navegar (a camada sai dos
   * DESCENDENTES da subnet, então a árvore tem de existir antes), a segunda já
   * com a camada na mão, que é o que ordena os irmãos.
   */
  const nav = arvore(modelo);
  const camadas = camadasDeSubnets(modelo, nav, cat);
  const lacunas = lacunasDeCamada(modelo, nav, camadas);
  const camadaDe = id => (camadas.get(id) || {}).camada || null;

  const t = arvore(modelo, camadaDe);
  const az = gatilhoAz(modelo, t);

  // Faixas de AZ nunca vêm do modelo — são construídas aqui, uma por zona,
  // e a caixa de cada uma é a união dos membros (o #19 mostrou a assimetria
  // se resolver sozinha: a zona que tem menos membros encolhe).
  const faixasAz = az.desenhar
    ? az.azs.map(z => ({
        id: `az-${z}`,
        derivada: true,
        rotulo: `Availability Zone · ${z}`,
        membros: modelo.nos.filter(n => n.az === z).map(n => n.id),
      }))
    : [];

  /**
   * A ORDEM DAS ARESTAS TAMBÉM É DERIVADA — e isto foi achado medindo.
   *
   * O #11 já tinha derivado a ordem das LINHAS da grade pela mesma razão
   * (incerteza 4 do #7): quem escreve o modelo é um agente, e nenhum LLM emite
   * a mesma lista duas vezes na mesma ordem. O que passou batido lá é que a
   * lista de arestas tem o mesmo problema, e ele só aparece nos caminhos que
   * emitem aresta iterando o modelo — o do ELK escapava porque quem devolve a
   * lista de arestas é o ELK, em ordem própria.
   *
   * A geometria não muda; o que muda é a ORDEM DAS CÉLULAS no arquivo. E isso
   * custa duas coisas concretas: o diff do `.drawio` fica sujo sem nenhum pixel
   * ter se mexido, e a ordem do documento é a ordem Z — duas arestas que se
   * cruzam trocam de "quem passa por cima" entre execuções.
   *
   * Critério: o passo numerado primeiro (é a ordem que o leitor vê), depois as
   * pontas. Semântica pura, como tudo mais que o motor deriva.
   */
  const arestas = (modelo.arestas || []).map((a, i) => ({
    ...a,
    id: a.id || `e-${a.de}-${a.para}${i}`,
    pai: paiDaAresta(),
    comum: ancestralComum(t.porId.get(a.de), t.porId.get(a.para), t),
  })).sort((a, b) =>
    (a.ordem ?? Number.MAX_SAFE_INTEGER) - (b.ordem ?? Number.MAX_SAFE_INTEGER) ||
    String(a.de).localeCompare(String(b.de)) ||
    String(a.para).localeCompare(String(b.para)));

  // multi-conta (#12) — mesma forma da AZ: gatilho derivado, faixa construída
  const ou = gatilhoOu(modelo, t);
  const modo = modoDeContas(modelo, t, arestas);
  const cruz = travessias(arestas, t);
  const politica = politicaDeTravessia(modo.modo, cruz, t);

  // A faixa de OU sai do MESMO construtor da faixa de AZ — união dos membros —
  // e difere num campo só: `render`. O #6 G2 mediu que a OU não ganha caixa em
  // diagrama de arquitetura (não existe shape oficial), então ela é rótulo
  // flutuante acima do primeiro membro. O construtor é agnóstico; quem decide
  // se a união vira retângulo ou só âncora de rótulo é esta linha.
  const faixasOu = ou.desenhar
    ? ou.ous.map(o => ({
        id: `ou-${o.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
        derivada: true,
        render: 'rotulo',
        rotulo: `OU – ${o}`,
        membros: modelo.nos.filter(n => n.tipo === 'conta' && n.ou === o).map(n => n.id),
      }))
    : [];

  // habilitador de permissão (E9): nó anexado, seta curta para DENTRO de quem
  // ele autoriza — nunca rótulo de aresta
  const habilitadores = modelo.nos
    .filter(n => n.habilita)
    .map(n => ({ id: n.id, alvo: n.habilita }));

  // mesma razão para as faixas (a ordem delas é ordem Z entre bandas) e para os
  // habilitadores (viram aresta)
  const faixas = [...(modelo.faixas || [])].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  habilitadores.sort((a, b) => String(a.id).localeCompare(String(b.id)));

  return {
    t, az, faixasAz, arestas, faixas,
    ou, faixasOu, modo, travessias: cruz, politica, habilitadores,
    camadas, lacunas,
  };
}

module.exports = {
  derivar, arvore, gatilhoAz, ancestralComum,
  contaDe, gatilhoOu, travessias, modoDeContas, politicaDeTravessia,
  chaveDeIrmao, compararIrmaos, catalogoPadrao,
  MAX_CONTAS_INTEGRACAO, MAX_TRAVESSIAS,
};
