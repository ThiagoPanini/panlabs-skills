'use strict';
/**
 * A camada de rede de uma subnet — o fato que faltava no IR (#22).
 *
 * A pergunta do ticket: o que decide que a "Data subnet" fica ABAIXO da "App
 * subnet"? Até aqui a ordem caía de exposição + rótulo, e a metade alfabética
 * era placeholder assumido: acertava `App · Data` por coincidência do alfabeto
 * e errava `Web · Data` e `Ingest · Core`, jogando a camada de dados para cima
 * — exatamente a leitura que a convenção de rede não quer.
 *
 * A resposta:
 *
 *   > O que põe a subnet de dados embaixo é O QUE ELA GUARDA.
 *
 * Não é fato novo pedido ao agente: o catálogo (#17) já sabe a CATEGORIA AWS de
 * cada serviço, e a categoria já diz o andar. `rds` é `database`, `ecs` é
 * `containers`, `nat gateway` é `network_content_delivery`. A camada é uma
 * leitura do conteúdo, e o agente não responde nada a mais — a premissa 11 do
 * mapa (máximo AFK) fica intacta.
 *
 * O campo `camada` existe no esquema, mas como ESCAPE, não como pergunta: ele
 * cobre o que o conteúdo não sabe dizer (subnet vazia) e o que ele diria
 * errado. É semântico — nomeia um andar de rede, não uma posição —, então a
 * fronteira do #11 continua de pé e o `check-fronteira` continua verde.
 *
 * O que este módulo NÃO faz é adivinhar. Sem evidência ele devolve `null`, e
 * quem decide o que fazer com o `null` é quem está desenhando: a grade recusa
 * (lá a ordem das linhas É o desenho), o caminho do ELK avisa (lá ela é só
 * desempate, e o ELK tem aresta para mandar nele).
 */

/**
 * Categoria do catálogo -> andar da rede.
 *
 * A tabela é curta de propósito. Ela mapeia as categorias que TÊM significado
 * de andar quando o recurso está dentro de uma subnet, e cala nas outras 21 —
 * `management_governance`, `artificial_intelligence`, `internet_of_things` e
 * companhia não dizem se a caixa é borda ou fundo, e fingir que dizem seria
 * trocar um placeholder alfabético por um placeholder taxonômico.
 *
 * Quem cala não vota. Uma subnet cujos membros todos calam fica sem camada, e
 * isso é o mesmo estado da subnet vazia — que é o caso que o ticket mandou
 * mostrar.
 *
 * A linha mais frouxa é `security_identity_compliance`, e vale dizer por quê:
 * a categoria inteira não é borda (IAM, KMS e Secrets Manager estão nela), mas
 * o recorte deste módulo é o que mora DENTRO de uma subnet, e ali o que
 * aparece é appliance de inspeção — Network Firewall, WAF. Serviço regional
 * não entra em subnet.
 */
const CATEGORIA_CAMADA = {
  // borda — o andar que encara alguma coisa de fora da subnet
  network_content_delivery: 'edge',
  security_identity_compliance: 'edge',

  // aplicação — o andar que computa
  compute: 'application',
  containers: 'application',
  application_integration: 'application',
  front_end_web_mobile: 'application',

  // dados — o andar que guarda
  database: 'data',
  storage: 'data',
  analytics: 'data',
};

/** Cima para baixo. É a ordem de leitura da vista de rede, e é só ela. */
const CAMADAS = ['edge', 'application', 'data'];

/** Sem camada vai para o fim do grupo de exposição — ver `chaveDeIrmao`. */
const SEM_CAMADA = 9;

function ordemDeCamada(c) {
  const i = CAMADAS.indexOf(c);
  return i < 0 ? SEM_CAMADA : i;
}

/**
 * A exposição, que continua sendo a PRIMEIRA chave — pública em cima, que é o
 * sentido de leitura do deck (#5 `O1`). A camada ordena dentro dela.
 *
 * Mora aqui junto com a camada porque as duas são a mesma chave de ordenação
 * partida em duas metades, e ela estava escrita em três lugares — `derivar`,
 * `dispor` e as réguas —, com um deles mapeando o ausente para 2 e os outros
 * para 9. Empatavam na prática (os dois vão depois de `privada`), mas duas
 * tabelas para uma regra é uma a mais.
 */
const ORDEM_ACESSO = { public: 0, private: 1 };

function ordemDeAcesso(a) {
  return ORDEM_ACESSO[a] ?? 9;
}

/**
 * A camada de um conjunto: a MAIS FUNDA das que ele contém; quem não tem, não
 * vota. É a regra de mistura, e ela vale nos dois níveis em que agregamos —
 * os membros dentro de uma subnet, e as subnets dentro de uma linha da grade.
 */
function camadaDeGrupo(lista) {
  const idx = lista.map(c => CAMADAS.indexOf(c)).filter(i => i >= 0);
  return idx.length ? CAMADAS[Math.max(...idx)] : null;
}

/** Categoria AWS de um nó folha, ou null se ele não resolve para serviço. */
function categoriaDoNo(no, cat) {
  const chave = no.service || (no.kind === 'actor' ? 'users' : null);
  if (!chave) return null;
  const s = cat.service(chave);
  return s ? (s.palette || null) : null;
}

/**
 * A camada de uma subnet, a partir do que ela guarda.
 *
 * REGRA DE MISTURA: vence o membro MAIS FUNDO. Uma subnet que guarda um ALB e
 * um RDS é lida como camada de dados.
 *
 * Não é gosto — é a regra protegendo o invariante que ela existe para
 * proteger. O que a convenção de rede proíbe é subnet com banco ficando acima
 * de subnet sem banco; tomar o membro mais RASO permitiria exatamente isso
 * (bastava pendurar um load balancer na subnet do banco para ela subir). Tomar
 * o mais fundo torna o invariante impossível de violar: se guarda dado, não
 * sobe.
 *
 * O preço é conhecido e está no README: uma subnet de ingestão que hospeda os
 * brokers (MSK é `analytics`) é lida como dados, e o arquiteto que a quiser em
 * cima declara `camada: "borda"`. O escape existe para isto.
 */
function camadaDaSubnet(subnet, descendentes, cat) {
  const evidencia = [];
  for (const n of descendentes) {
    const categoria = categoriaDoNo(n, cat);
    const layer = categoria ? (CATEGORIA_CAMADA[categoria] || null) : null;
    if (layer) evidencia.push({ id: n.id, service: n.service || n.kind, categoria, layer });
  }

  const declarada = subnet.layer || null;
  const derivada = camadaDeGrupo(evidencia.map(e => e.layer));

  if (declarada) {
    return {
      layer: declarada,
      via: 'declarada',
      derivada,
      evidencia,
      // Declarar contra o próprio conteúdo é afirmação sobre a arquitetura, não
      // erro de digitação — o motor obedece e conta. Mesma política do #16 para
      // conflito com premissa corporativa: obedece e sinaliza, nunca calado.
      diverge: derivada && derivada !== declarada ? derivada : null,
    };
  }
  return { layer: derivada, via: derivada ? 'derivada' : null, derivada, evidencia, diverge: null };
}

/**
 * A camada de toda subnet do modelo, indexada por id.
 *
 * `t` é a árvore do `derive.cjs`. DESCENDENTE, não filho direto: um serviço
 * dentro de um security group dentro da subnet continua sendo o que a subnet
 * guarda.
 */
function camadasDeSubnets(modelo, t, cat) {
  const porSubnet = new Map();
  const descendentesDe = new Map();

  for (const n of modelo.nodes) {
    const sub = t.ancestrais(n).find(a => a.kind === 'subnet');
    if (!sub) continue;
    if (!descendentesDe.has(sub.id)) descendentesDe.set(sub.id, []);
    descendentesDe.get(sub.id).push(n);
  }

  for (const s of modelo.nodes.filter(n => n.kind === 'subnet'))
    porSubnet.set(s.id, camadaDaSubnet(s, descendentesDe.get(s.id) || [], cat));

  return porSubnet;
}

/**
 * O PAPEL — a unidade que a grade empilha, e portanto a unidade que se ordena.
 *
 * Duas subnets com o mesmo rótulo, na mesma VPC e mesma exposição, viram UMA
 * linha da grade, uma célula por zona (#11). Então a camada que ordena é a do
 * papel, não a da subnet: se `dado-a` guarda um RDS e `dado-b` está vazia, a
 * linha guarda um RDS.
 *
 * A chave é a mesma que o `layout.cjs` usa para virar linha — de propósito. Ter
 * duas definições de "papel" seria ter duas grades.
 */
function chaveDePapel(subnet, t) {
  const vpc = (t.ancestrais(subnet).find(a => a.kind === 'vpc') || {}).id;
  return `${vpc}|${subnet.access || '?'}|${subnet.label || ''}`;
}

function papeisDeSubnet(modelo, t, camadas) {
  const papeis = new Map();
  for (const s of modelo.nodes.filter(n => n.kind === 'subnet')) {
    const chave = chaveDePapel(s, t);
    if (!papeis.has(chave))
      // os campos vêm da SUBNET, não de fatiar a chave de volta: a chave é um
      // identificador, e ler dado de dentro dela é o que quebra quando um
      // rótulo tem `|`
      papeis.set(chave, {
        chave,
        vpc: (t.ancestrais(s).find(a => a.kind === 'vpc') || {}).id,
        access: s.access || null,
        label: s.label || '',
        subnets: [], layer: null,
      });
    papeis.get(chave).subnets.push(s.id);
  }
  for (const p of papeis.values())
    p.layer = camadaDeGrupo(p.subnets.map(id => (camadas.get(id) || {}).layer || null));
  return papeis;
}

/**
 * Onde a falta do fato muda o desenho.
 *
 * A ordem só é o desenho quando há mais de um PAPEL para empilhar dentro da
 * mesma exposição, na mesma VPC. Papel único não tem contra quem ser ordenado,
 * e aí a subnet sem camada não custa nada — a recusa não dispara.
 *
 * Devolve uma lacuna por grupo (vpc × exposição), com os papéis órfãos.
 */
function lacunasDeCamada(modelo, t, camadas) {
  const grupos = new Map();
  for (const p of papeisDeSubnet(modelo, t, camadas).values()) {
    const chave = `${p.vpc}|${p.access}`;
    if (!grupos.has(chave)) grupos.set(chave, { vpc: p.vpc, access: p.access, papeis: [] });
    grupos.get(chave).papeis.push(p);
  }

  const lacunas = [];
  for (const { vpc, access, papeis } of grupos.values()) {
    if (papeis.length < 2) continue;                     // nada a ordenar
    const orfaos = papeis.filter(p => !p.layer);
    if (!orfaos.length) continue;
    lacunas.push({
      vpc, access: access || 'sem exposição declarada', papeis: papeis.length,
      orfaos: orfaos.map(o => ({
        papel: o.label || `(sem rótulo: ${o.subnets.join(', ')})`,
        subnets: o.subnets,
        vazio: o.subnets.every(id => !((camadas.get(id) || {}).evidencia || []).length),
      })).sort((a, b) => a.papel.localeCompare(b.papel, 'pt')),
    });
  }
  return lacunas.sort((a, b) => a.vpc.localeCompare(b.vpc) || a.access.localeCompare(b.access));
}

/**
 * O que o motor diz quando a ordem depende do fato que falta.
 *
 * Devolve LINHAS, sem marcador nenhum: quem apresenta decide o marcador. A CLI
 * põe `· ` em cada erro; o aviso do caminho do ELK indenta. Embutir o bullet
 * aqui dava bullet dobrado num dos dois.
 */
function textoDaLacuna(lacunas) {
  const linhas = [];
  for (const l of lacunas)
    for (const o of l.orfaos)
      linhas.push(`VPC "${l.vpc}" · ${l.access}s: "${o.papel}" (${o.subnets.join(', ')}) ` +
        `não diz que camada de rede ocupa — ${o.vazio ? 'vazia, nada a inferir' : 'o que ela guarda não tem andar de rede'}` +
        ` (são ${l.papeis} papéis para empilhar)`);
  linhas.push('declare `camada` ("borda" | "aplicacao" | "dados") nessas subnets, ou ponha dentro delas o serviço que elas hospedam');
  return linhas;
}

module.exports = {
  CATEGORIA_CAMADA, CAMADAS,
  ordemDeCamada, ordemDeAcesso, camadaDeGrupo, categoriaDoNo, camadasDeSubnets,
  chaveDePapel, papeisDeSubnet, lacunasDeCamada, textoDaLacuna,
};
