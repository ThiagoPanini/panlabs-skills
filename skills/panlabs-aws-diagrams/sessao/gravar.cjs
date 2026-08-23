'use strict';
/**
 * Gravacao — como a sessao vai parar DENTRO do `.drawio`.
 *
 * O #14 pos tres opcoes de persistencia na mesa: sidecar `.yaml` versionado ao
 * lado, embutido no proprio arquivo via `<object>`, ou multiplas paginas
 * `<diagram>`. **Nao sao alternativas: as duas ultimas sao a mesma resposta em
 * eixos diferentes**, e a primeira e a unica que da para descartar por
 * argumento em vez de medicao.
 *
 *   ONDE o modelo mora   -> embutido (`<object>`), nao sidecar.
 *   COMO as vistas moram -> duas paginas `<diagram>` do MESMO arquivo.
 *
 * Sidecar cai por um motivo so, e e o mesmo motivo que o #11 usou para nao ter
 * um segundo arquivo: **dois arquivos dessincronizam**. Um `.drawio` sem o
 * `.yaml` ao lado e um diagrama orfao; um `.yaml` sem o `.drawio` e um modelo
 * que ninguem aprovou. O usuario arrasta o `.drawio` para o Slack e o par se
 * desfaz na primeira vez. Nada disso e hipotetico: e o modo normal de um arquivo
 * circular numa empresa.
 *
 * Duas paginas em vez de dois arquivos e o mesmo argumento um nivel acima.
 *
 * O modelo e escrito em TODA pagina, nao so na primeira. Custa bytes (medido em
 * `tools/medir-hospedeiro.cjs`) e compra uma coisa concreta: apagar uma pagina e
 * a operacao mais banal do mundo no draw.io, e com uma copia so ela apaga a
 * sessao inteira junto. Copias divergentes viram, elas proprias, sinal de
 * divergencia na leitura.
 *
 * O que o selo NAO tem: relogio. O #11 mediu que regerar o mesmo modelo tem de
 * dar o mesmo arquivo byte a byte, e um timestamp de geracao quebra isso em toda
 * execucao. Data que existe no selo e data de DOMINIO — quando o humano aprovou
 * —, que vem do dossie e nao do sistema.
 */

const path = require('path');

const MOTOR_DIR = path.join(__dirname, '..', 'motor');
const { esc, conferirXml } = require(path.join(MOTOR_DIR, 'emitir.cjs'));
const { impressaoSemantica, impressaoDeAparencia, reescreverSelos } = require('./impressao.cjs');

/** Marca de reconhecimento. Ver `abrir.cjs` para por que nao basta o `host`. */
const ESQUEMA_SELO = 'panlabs-aws-diagrams/sessao@1';

/**
 * Quem desenhou. Era `'q11'` — o nome do PROTOTIPO — enquanto o motor morava
 * dentro de `prototypes/`. Na arvore de producao o motor nao tem mais numero de
 * ticket: ele e o motor, e o que o selo precisa dizer e "foi este binario", nao
 * "foi o experimento tal". O `abrir.cjs` usa este campo so para explicar
 * divergencia geometrica que nao veio de edicao humana.
 */
const MOTOR = 'panlabs-aws-diagrams/motor@1';

/**
 * Troca a celula de metadados que o motor do #11 emitiu pelo selo da sessao.
 *
 * O motor grava ali o `modelo@1` que ele proprio recebeu — que, aqui, e uma
 * PROJECAO. Guardar a projecao seria guardar a saida em vez da fonte: a sessao
 * seguinte precisa do modelo de sessao, com os dois casacos e o dossie, ou nao
 * ha o que retomar.
 */
function selar(xml, sessao, vista, opts = {}) {
  /**
   * ⚠️ UMA CHAMADA DO MOTOR PODE DEVOLVER N PAGINAS — e ate a recertificacao do
   * #23 esta funcao dizia `selar espera uma pagina, veio N` e morria.
   *
   * A premissa vinha do motor que o #14 mediu: um `gerar` = uma pagina, e as
   * duas vistas viravam duas chamadas costuradas aqui. O #12 acrescentou a
   * decomposicao estrutural do `D2` — consolidada + uma por conta — e a vista
   * TECNICA de um modelo multi-conta passou a ser 1+N paginas de uma chamada so.
   * Nenhuma suite pegou porque nenhuma rodava as duas coisas juntas.
   *
   * A correcao nao muda a decisao do #14, ela a cumpre: *uma copia do selo por
   * pagina*, escolhida la para que apagar uma pagina no draw.io — a operacao
   * mais banal do mundo — nao leve a sessao junto. Com 1+N paginas isso vale
   * ainda mais: a pagina que o usuario mais provavelmente apaga e uma vista de
   * detalhe, nao a consolidada.
   *
   * As IMPRESSOES sao por pagina, nao do arquivo: elas respondem "o humano mexeu
   * NESTA pagina?", e o `abrir.cjs` ja classificava pagina a pagina.
   */
  // O motor emite a celula do modelo por ultimo em CADA pagina, na mesma ordem
  // das paginas — entao a n-esima ocorrencia e a da n-esima pagina. Quem anda
  // pelas ocorrencias, confere a contagem e o XML de volta e `reescreverSelos`
  // (impressao.cjs); a armadilha do #19 — XML mal formado renderiza TRUNCADO com
  // codigo 0 — esta guardada la, e o selo e justamente o lugar onde texto
  // arbitrario do usuario entra num atributo.
  return reescreverSelos(xml, p => ({
    panlabsEsquema: ESQUEMA_SELO,
    panlabsVista: vista,
    panlabsSemantica: impressaoSemantica(p.celulas),
    panlabsAparencia: impressaoDeAparencia(p.celulas),
    panlabsMotor: opts.motor || MOTOR,
    panlabsSessao: JSON.stringify(sessao),
  })).xml;
}

/**
 * Junta as VISTAS de um `.drawio` num arquivo so.
 *
 * Cada entrada chega de uma execucao independente do motor. Costurar aqui em vez
 * de ensinar o motor a servir as duas vistas e de proposito: o motor renderiza
 * UMA vista, e quem sabe que existem duas e esta camada. Ver `projetar.cjs`.
 *
 * ⚠️ Uma execucao NAO e mais uma pagina. Desde o #12 a vista tecnica de um modelo
 * multi-conta ja chega aqui com 1+N `<diagram>` dentro — a consolidada mais uma
 * por conta (`D2` do #6). Por isso o recorte e por `<diagram>` individual e nao
 * "o bloco do primeiro ao ultimo": a regex gulosa de antes juntava as N paginas
 * de uma execucao num pedaco so, o que por sorte produzia XML valido, e a
 * checagem de id repetido logo abaixo passava a olhar so o primeiro id.
 */
function costurar(xmlsPorPagina, opts = {}) {
  const diagramas = xmlsPorPagina.flatMap(xml => {
    const achados = [...xml.matchAll(/[ \t]*<diagram\b[\s\S]*?<\/diagram>/g)].map(m => m[0]);
    if (!achados.length) throw new Error('XML sem <diagram> para costurar');
    return achados;
  });

  const ids = diagramas.map(d => /<diagram id="([^"]*)"/.exec(d)?.[1]);
  const repetidos = ids.filter((x, i) => ids.indexOf(x) !== i);
  if (repetidos.length) throw new Error(`paginas com o mesmo id: ${repetidos.join(', ')}`);

  const saida = `<mxfile host="${esc(opts.host || 'panlabs-aws-diagrams')}" compressed="false">\n` +
    diagramas.join('\n') + '\n</mxfile>\n';

  const erros = conferirXml(saida);
  if (erros.length) { const e = new Error('a costura produziu XML mal formado'); e.erros = erros; throw e; }
  return saida;
}

module.exports = { selar, costurar, ESQUEMA_SELO };
