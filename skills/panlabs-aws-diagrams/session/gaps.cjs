'use strict';
/**
 * A REVISÃO DE LACUNAS — a fase 5 do protocolo (#15), em código.
 *
 *   node tools/revisar-lacunas.cjs <modelo.json>
 *   const { revisar } = require('./sessao/lacunas.cjs')
 *
 * O #15 fechou a POLÍTICA e deixou o LIMIAR aberto, e disse por quê: as regras
 * do protótipo dispararam **4 achados num modelo de 3 nós**. Ansiosas demais. O
 * #26 fecha o limiar, e o que fecha não é um número mágico — é uma forma.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * A FORMA: pré-condição, medida, limiar. E a pré-condição é a calibração.
 *
 * O defeito do protótipo não era o limiar de cada regra; era que três das quatro
 * regras dele disparavam sobre AUSÊNCIA:
 *
 *     "nenhum componente declara redundância"      → SPOF
 *     "multi-conta sem caminho de confiança"       → TRUST
 *     "assíncrono sem fila morta"                  → DLQ
 *
 * Regra que dispara sobre ausência dispara em todo modelo pequeno, porque todo
 * modelo pequeno é quase todo ausência. Daí 4 achados em 3 nós.
 *
 * A regra aqui:
 *
 *   > **Um achado só nasce sobre um fato que o modelo AFIRMA, nunca sobre um
 *   > fato que ele não menciona.**
 *
 * Cada regra declara a estrutura que precisa existir para ela ter o que dizer.
 * Onde o modelo não afirma essa estrutura, a regra fica **MUDA** — que não é o
 * mesmo que passar. É o mesmo movimento do #22 com a categoria AWS que não diz
 * andar de rede: *quem cala não vota*. Uma regra muda aparece em `mudas[]` com
 * o motivo, para que "não acusou" nunca se confunda com "não rodou".
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * O QUE ESTE MÓDULO NÃO FAZ
 *
 * Não conserta. Nem sugere conserto no modelo. O #15 é explícito, e é a regra
 * que segura o produto inteiro: **relata, propõe, e conserta apenas o que o
 * usuário mandar consertar.** Consertar um SPOF calado produz um diagrama bonito
 * de uma arquitetura que não existe, e — como a diferença contra IaC está fora
 * de escopo — nada a jusante pega isso.
 *
 * Não bloqueia sozinho, também. Quem bloqueia é o arco (passo 4 do `SKILL.md`),
 * em bloco e uma vez só.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DE ONDE SAEM OS FATOS
 *
 * De lugar nenhum novo. `stateful` é `CATEGORIA_CAMADA[categoria] === 'dados'`,
 * a mesma tabela do #22 que decide o andar da subnet; `egresso` é a categoria
 * `network_content_delivery`; `transporte assíncrono` é
 * `application_integration`. Nenhuma lista inventada para esta revisão — se a
 * tabela do #22 estiver errada, ela está errada nos dois lugares, e conserta-se
 * num só.
 */

const path = require('path');
const { CATEGORIA_CAMADA, categoriaDoNo, chaveDePapel } = require(path.join(__dirname, '..', 'motor', 'camadas.cjs'));
const { arvore, contaDe, travessias } = require(path.join(__dirname, '..', 'motor', 'derivar.cjs'));

const CATALOGO = path.join(__dirname, '..', 'catalog', 'aws-shapes.cjs');
let _cat = null;
const catalogoPadrao = () => (_cat = _cat || require(CATALOGO).carregar());

/** Guarda o que ele guarda: `dados` na tabela do #22 é exatamente "tem estado". */
const ehStateful = (no, cat) => CATEGORIA_CAMADA[categoriaDoNo(no, cat)] === 'dados';

/** Saída controlada da rede: NAT, VPC endpoint, transit/internet gateway. */
const ehEgresso = (no, cat) => categoriaDoNo(no, cat) === 'network_content_delivery';

/** Transporte assíncrono: fila, tópico, barramento. */
const ehAssincrono = (no, cat) => categoriaDoNo(no, cat) === 'application_integration';

/** Quem computa — e portanto quem FALHA processando uma mensagem. */
const ehComputacao = (no, cat) => ['compute', 'containers'].includes(categoriaDoNo(no, cat));

const achado = (regra, alvo, porque) => ({ regra, alvo, porque });
const muda = (regra, porque) => ({ regra, porque });

// ---------------------------------------------------------------- grafo

/** Vizinhança NÃO dirigida sobre as folhas — o caminho existe nos dois sentidos. */
function adjacencia(modelo) {
  const adj = new Map();
  const toca = id => { if (!adj.has(id)) adj.set(id, new Set()); return adj.get(id); };
  for (const a of modelo.arestas || []) { toca(a.de).add(a.para); toca(a.para).add(a.de); }
  return adj;
}

/** Alcançáveis a partir de `raiz`, opcionalmente sem passar por `sem`. */
function alcance(adj, raiz, sem = null) {
  const vistos = new Set();
  const fila = [raiz];
  while (fila.length) {
    const id = fila.pop();
    if (id === sem || vistos.has(id)) continue;
    vistos.add(id);
    for (const v of adj.get(id) || []) if (v !== sem && !vistos.has(v)) fila.push(v);
  }
  vistos.delete(raiz);
  return vistos;
}

// ---------------------------------------------------------------- as seis regras

/**
 * `spof` — ponto único no caminho de quem está de fora.
 *
 * PRÉ-CONDIÇÃO: há ator, e há aresta. Sem ator não existe "de fora"; sem aresta
 * o modelo é inventário e inventário não tem caminho para quebrar.
 *
 * MEDIDA: nó cuja remoção tira do alcance de um ator algo que ele alcançava —
 * ponto de articulação, medido, não adivinhado.
 *
 * DOIS LIMIARES, e os dois foram calibrados contra o corpus no #26:
 *
 *   1. O PAR. Um nó com par não é ponto único, e "par" é fato que o modelo
 *      afirma: outro nó com o mesmo `servico`, ou o nó ser membro de uma faixa
 *      (que é como este motor diz "N destes"). Sem esta cláusula, todo ALB de um
 *      desenho multi-AZ vira achado — e é justamente o desenho que já está certo.
 *
 *   2. ORFANA ≥2. Ponto de estrangulamento é por onde ≥2 coisas passam. Num
 *      encadeamento A→B→C, B "separa" C — mas dizer que B é o ponto único de
 *      falha de C é só dizer que C tem UM vizinho, o que é afirmação sobre C, não
 *      sobre um caminho compartilhado.
 *
 *      Medido: sem esta cláusula o `pedidos-serverless` acusa o VPC endpoint
 *      ("único caminho de cliente até ddb" — orfana exatamente 1) e o
 *      `logica-atendimento` acusa a trilha de auditoria por separar só a política
 *      de retenção.
 *
 *   3. SÓ OS MAXIMAIS. Um estrangulamento cujo órfãos estão TODOS contidos nos
 *      órfãos de outro é o mesmo corte, contado de novo mais fundo. Numa cadeia
 *      linear `A→B→C→D` toda ligação é ponto de articulação e os conjuntos são
 *      encaixados — reportar os quatro é dizer quatro vezes *"esta cadeia não tem
 *      par em lugar nenhum"*.
 *
 *      Medido no caso ponta a ponta do #26: a `frota-preditiva` é uma cadeia de
 *      ponta a ponta e acusava SEIS `spof` num modelo de 11 nós — pior que o
 *      protótipo do #15 que motivou toda esta calibração. Com a cláusula, dois:
 *      a recepção (tudo está atrás dela, visto do caminhão) e o aviso (tudo está
 *      atrás dele, visto da oficina) — que são de fato as duas pontas.
 *
 *      A informação não se perde: o `porque` diz quantos pontos únicos ficam
 *      ATRÁS do que foi reportado. Consertar o de fora não conserta os de
 *      dentro, e o texto diz isso em vez de escondê-lo.
 */
const ORFAOS_MINIMOS = 2;

function regraSpof(modelo, ctx) {
  const atores = modelo.nos.filter(n => n.tipo === 'ator');
  const arestas = modelo.arestas || [];
  if (!atores.length || !arestas.length)
    return { achados: [], muda: muda('spof', !atores.length
      ? 'nenhum ator: o modelo não afirma ninguém de fora, e sem fora não há caminho de entrada'
      : 'nenhuma aresta: é vista de inventário, e inventário não tem caminho para quebrar') };

  const adj = adjacencia(modelo);
  const membrosDeFaixa = new Set((modelo.faixas || []).flatMap(f => f.membros || []));
  const porServico = new Map();
  for (const n of modelo.nos) {
    if (!n.servico) continue;
    porServico.set(n.servico, (porServico.get(n.servico) || 0) + 1);
  }
  const temPar = n => membrosDeFaixa.has(n.id) || (n.servico && porServico.get(n.servico) > 1);

  const candidatos = [];
  const jaVisto = new Set();
  for (const ator of atores) {
    const base = alcance(adj, ator.id);
    for (const cand of base) {
      if (jaVisto.has(cand)) continue;
      const no = ctx.t.porId.get(cand);
      if (!no || no.tipo === 'ator') continue;
      if (temPar(no)) continue;
      const semEle = alcance(adj, ator.id, cand);
      // perdeu alguém além do próprio candidato: ele estava no meio do caminho
      const perdeu = new Set([...base].filter(x => x !== cand && !semEle.has(x)));
      if (perdeu.size < ORFAOS_MINIMOS) continue;
      jaVisto.add(cand);
      candidatos.push({ id: cand, ator: ator.id, orfaos: perdeu });
    }
  }

  // ...e agora só os MAXIMAIS: cai quem tem os órfãos todos dentro dos de outro.
  const contido = (a, b) => a.size < b.size && [...a].every(x => b.has(x));
  const maximais = candidatos.filter(c => !candidatos.some(o => o !== c && contido(c.orfaos, o.orfaos)));

  const achados = maximais.map(c => {
    const atras = candidatos.filter(o => o !== c && contido(o.orfaos, c.orfaos)).length;
    return achado('spof', c.id,
      `sem par, e é o único caminho de "${c.ator}" até ${c.orfaos.size} outros componentes` +
      (atras ? ` — e ${atras} deles também não tem par, atrás deste` : ''));
  });
  return { achados, muda: null };
}

/**
 * `single-az` — o que guarda estado mora numa zona só.
 *
 * PRÉ-CONDIÇÃO: alguma subnet declara `az`. Modelo que não fala de zona não
 * recebe achado sobre zona — era exatamente o disparo por ausência do protótipo.
 *
 * MEDIDA: o PAPEL da subnet (a mesma `chaveDePapel` que vira linha da grade e
 * que o gatilho do #19 usa) aparece em quantas zonas?
 *
 * LIMIAR: uma. E o sujeito é o que guarda estado, não qualquer nó: um Lambda em
 * AZ única não é achado, é como Lambda funciona.
 */
function regraSingleAz(modelo, ctx) {
  const subnets = modelo.nos.filter(n => n.tipo === 'subnet');
  const comAz = subnets.filter(s => s.az);
  if (!comAz.length)
    return { achados: [], muda: muda('single-az', 'nenhuma subnet declara `az`: o modelo não fala de zona') };

  const zonasDoPapel = new Map();
  for (const s of comAz) {
    const k = chaveDePapel(s, ctx.t);
    if (!zonasDoPapel.has(k)) zonasDoPapel.set(k, new Set());
    zonasDoPapel.get(k).add(s.az);
  }

  const achados = [];
  for (const s of comAz) {
    const zonas = zonasDoPapel.get(chaveDePapel(s, ctx.t));
    if (zonas.size >= 2) continue;
    for (const filho of ctx.t.filhos.get(s.id) || [])
      if (ehStateful(filho, ctx.cat))
        achados.push(achado('single-az', filho.id,
          `guarda estado e a subnet "${s.id}" existe só em ${s.az} — nenhuma outra zona tem o mesmo papel`));
  }
  return { achados, muda: null };
}

/**
 * `egress-sem-controle` — subnet privada com conteúdo e nenhuma saída declarada.
 *
 * PRÉ-CONDIÇÃO: há subnet privada COM conteúdo, dentro de uma VPC. Subnet
 * privada vazia não tem de onde sair.
 *
 * MEDIDA: a VPC tem saída controlada — DENTRO dela ou LIGADA a ela?
 *
 * ⚠️ A segunda metade chegou no #26, medindo. A primeira versão olhava só o
 * conteúdo da VPC, e o `hub-tgw-3-contas` acusou as DUAS VPCs spoke: num
 * hub-and-spoke o Transit Gateway é justamente a saída controlada, e ele mora
 * FORA das VPCs que ele serve — é uma conta de rede à parte. A regra reprovava o
 * desenho pelo motivo que o torna certo.
 *
 * Então saída ligada conta: alguma aresta entre um nó de dentro da VPC e um
 * serviço de categoria `network_content_delivery`. É o atracamento, e o
 * atracamento é o que o modelo tem para afirmar "por aqui se sai".
 *
 * LIMIAR: zero. Um endpoint já responde a pergunta — o achado é sobre a saída
 * não existir, não sobre ela ser suficiente. Dimensionar egresso é auditoria, e
 * auditoria formal está fora do escopo do mapa.
 */
function regraEgresso(modelo, ctx) {
  const privadas = modelo.nos.filter(n => n.tipo === 'subnet' && n.acesso === 'privada'
    && (ctx.t.filhos.get(n.id) || []).length);
  if (!privadas.length)
    return { achados: [], muda: muda('egress-sem-controle',
      'nenhuma subnet privada com conteúdo: não há de onde sair') };

  const achados = [];
  const jaVista = new Set();
  for (const s of privadas) {
    const vpc = ctx.t.ancestrais(s).find(a => a.tipo === 'vpc');
    if (!vpc || jaVista.has(vpc.id)) continue;
    const dentroDaVpc = modelo.nos.filter(n => n === vpc || ctx.t.ancestrais(n).some(a => a.id === vpc.id));
    if (dentroDaVpc.some(n => ehEgresso(n, ctx.cat))) continue;
    // ...ou LIGADA a uma: o atracamento no Transit Gateway da conta de rede
    const ids = new Set(dentroDaVpc.map(n => n.id));
    const atracada = (modelo.arestas || []).some(a => {
      const [x, y] = [ctx.t.porId.get(a.de), ctx.t.porId.get(a.para)];
      if (!x || !y) return false;
      return (ids.has(x.id) && ehEgresso(y, ctx.cat)) || (ids.has(y.id) && ehEgresso(x, ctx.cat));
    });
    if (atracada) continue;
    jaVista.add(vpc.id);
    achados.push(achado('egress-sem-controle', vpc.id,
      `a VPC tem subnet privada com conteúdo e nenhum NAT, endpoint ou gateway — ` +
      `a saída existe na conta e não está no desenho, ou não existe`));
  }
  return { achados, muda: null };
}

/**
 * `dado-em-subnet-publica` — o que guarda estado numa subnet que a rua alcança.
 *
 * PRÉ-CONDIÇÃO: há subnet pública. (Aqui a pré-condição quase não filtra, e é
 * assim que tem de ser: a estrutura sobre a qual a regra fala é a subnet
 * pública, e ela ou existe ou não.)
 */
function regraDadoPublico(modelo, ctx) {
  const publicas = modelo.nos.filter(n => n.tipo === 'subnet' && n.acesso === 'publica');
  if (!publicas.length)
    return { achados: [], muda: muda('dado-em-subnet-publica', 'nenhuma subnet pública declarada') };

  const achados = [];
  for (const s of publicas)
    for (const filho of ctx.t.filhos.get(s.id) || [])
      if (ehStateful(filho, ctx.cat))
        achados.push(achado('dado-em-subnet-publica', filho.id,
          `guarda estado e está em "${s.id}", que é pública`));
  return { achados, muda: null };
}

/**
 * `cross-account-sem-confianca` — travessia sem quem a autorize desenhado.
 *
 * PRÉ-CONDIÇÃO: ≥2 contas E ≥1 travessia. Duas contas sem travessia é vista de
 * inventário (o modo do #12), e inventário não afirma acesso nenhum.
 *
 * MEDIDA: a travessia tem um habilitador (`habilita`, o E9 do #6) numa das
 * pontas? Papel de IAM, política de bucket, política de event bus.
 */
function regraConfianca(modelo, ctx) {
  const contas = modelo.nos.filter(n => n.tipo === 'conta');
  const cruz = contas.length >= 2 ? travessias(modelo.arestas || [], ctx.t) : [];
  if (contas.length < 2 || !cruz.length)
    return { achados: [], muda: muda('cross-account-sem-confianca', contas.length < 2
      ? `${contas.length} conta(s): não há travessia possível`
      : `${contas.length} contas e nenhuma travessia: é mapa de colocação, não afirma acesso`) };

  const autorizados = new Set(modelo.nos.filter(n => n.habilita).map(n => n.habilita));
  const achados = [];
  for (const a of cruz) {
    if (autorizados.has(a.de) || autorizados.has(a.para)) continue;
    achados.push(achado('cross-account-sem-confianca', a.id || `${a.de}→${a.para}`,
      `"${a.contaDe}" alcança "${a.contaPara}" e nenhum habilitador está desenhado nas pontas`));
  }
  return { achados, muda: null };
}

/**
 * `assincrono-sem-dlq` — consumidor de fila sem destino para o que falha.
 *
 * PRÉ-CONDIÇÃO: alguma aresta SAI de um serviço de integração assíncrona. Sem
 * transporte assíncrono não há mensagem para morrer — e este era o terceiro
 * disparo por ausência do protótipo.
 *
 * MEDIDA: o consumidor é COMPUTAÇÃO (é ele que falha processando; o salto
 * barramento → fila é fan-out, não consumo), e ele escreve em algum outro nó do
 * MESMO serviço que o alimenta? Uma fila morta é uma fila.
 *
 * LIMIAR: zero destinos desse tipo. E o teste do mesmo-serviço é derivado, não
 * uma lista: não existe "lista de serviços que são DLQ", existe "o que recebe o
 * refugo de uma fila é outra fila".
 */
function regraDlq(modelo, ctx) {
  const arestas = modelo.arestas || [];
  const alimenta = arestas.filter(a => {
    const q = ctx.t.porId.get(a.de);
    return q && ehAssincrono(q, ctx.cat);
  });
  if (!alimenta.length)
    return { achados: [], muda: muda('assincrono-sem-dlq',
      'nenhuma aresta sai de fila, tópico ou barramento: não há caminho assíncrono') };

  const achados = [];
  const jaVisto = new Set();
  for (const a of alimenta) {
    const consumidor = ctx.t.porId.get(a.para);
    const fila = ctx.t.porId.get(a.de);
    if (!consumidor || !ehComputacao(consumidor, ctx.cat)) continue;
    if (jaVisto.has(consumidor.id)) continue;
    const temDestinoDeFalha = arestas.some(x => {
      if (x.de !== consumidor.id) return false;
      const alvo = ctx.t.porId.get(x.para);
      return alvo && alvo.id !== fila.id && alvo.servico === fila.servico;
    });
    if (temDestinoDeFalha) continue;
    jaVisto.add(consumidor.id);
    achados.push(achado('assincrono-sem-dlq', consumidor.id,
      `consome de "${fila.id}" e não escreve em nenhuma outra fila — ` +
      `a mensagem que ele não conseguir processar não tem para onde ir`));
  }
  return { achados, muda: null };
}

const REGRAS = [regraSpof, regraSingleAz, regraEgresso, regraDadoPublico, regraConfianca, regraDlq];

/**
 * Os nomes, numa lista só — porque a régua e a CLI precisam da MESMA lista.
 *
 * Estavam escritos à mão nos dois consumidores, e uma sétima regra exigiria três
 * edições em três arquivos, com a chance de a régua passar a cobrar cinco
 * enquanto o módulo entrega seis. Uma lista, um lugar.
 */
const NOMES = ['spof', 'single-az', 'egress-sem-controle', 'dado-em-subnet-publica',
  'cross-account-sem-confianca', 'assincrono-sem-dlq'];

/**
 * Os modelos do corpus, na ordem — e ele mora aqui, junto das regras, por uma
 * razão de correção e não de arrumação: o `L2`/`L3` do critério (*toda regra
 * dispara em ≥1 e cala em ≥1*) só quer dizer alguma coisa se a régua e a CLI
 * varrerem **o mesmo corpus**. Duas listas de diretório é a porta para a régua
 * ficar verde contra metade dele.
 */
const DIRS_DO_CORPUS = ['modelo', 'modelo/recusa'];

function arquivosDoCorpus(raiz) {
  const fs = require('fs');
  const saida = [];
  for (const d of DIRS_DO_CORPUS) {
    const dir = path.join(raiz, d);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.json')).sort())
      saida.push(path.join(d, f));
  }
  return saida;
}

/**
 * Roda as seis contra um `modelo@1`. Função pura.
 *
 * @returns {{achados: Array, mudas: Array, teto: number, dentroDoTeto: boolean}}
 */
function revisar(modelo, opts = {}) {
  const cat = opts.cat || catalogoPadrao();
  const ctx = { cat, t: arvore(modelo) };

  const achados = [], mudas = [];
  for (const regra of REGRAS) {
    const r = regra(modelo, ctx);
    achados.push(...r.achados);
    if (r.muda) mudas.push(r.muda);
  }
  achados.sort((a, b) => a.regra.localeCompare(b.regra) || String(a.alvo).localeCompare(String(b.alvo)));

  // O teto do critério de aprovação, calculado junto para não virar prosa.
  const teto = Math.ceil(modelo.nos.length / 4);
  return { achados, mudas, teto, dentroDoTeto: achados.length <= teto };
}

module.exports = {
  revisar, REGRAS, NOMES, arquivosDoCorpus, DIRS_DO_CORPUS,
  ehStateful, ehEgresso, ehAssincrono, ehComputacao,
};
