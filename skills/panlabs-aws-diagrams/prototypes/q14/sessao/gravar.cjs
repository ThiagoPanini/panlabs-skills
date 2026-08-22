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

const Q11 = path.join(__dirname, '..', '..', 'q11', 'motor');
const { esc, conferirXml, limparGremlins } = require(path.join(Q11, 'emitir.cjs'));
const { lerPaginas, impressaoSemantica, impressaoDeAparencia, ID_SELO } = require('./impressao.cjs');

const RE_SELO = /[ \t]*<object id="panlabs-modelo"[\s\S]*?<\/object>\n?/;

/** Marca de reconhecimento. Ver `abrir.cjs` para por que nao basta o `host`. */
const ESQUEMA_SELO = 'panlabs-aws-diagrams/sessao@1';

/**
 * Troca a celula de metadados que o motor do #11 emitiu pelo selo da sessao.
 *
 * O motor grava ali o `modelo@1` que ele proprio recebeu — que, aqui, e uma
 * PROJECAO. Guardar a projecao seria guardar a saida em vez da fonte: a sessao
 * seguinte precisa do modelo de sessao, com os dois casacos e o dossie, ou nao
 * ha o que retomar.
 */
function selar(xml, sessao, vista, opts = {}) {
  const { paginas } = lerPaginas(xml);
  if (paginas.length !== 1) throw new Error(`selar espera uma pagina, veio ${paginas.length}`);
  const celulas = paginas[0].celulas;

  const selo = {
    panlabsEsquema: ESQUEMA_SELO,
    panlabsVista: vista,
    panlabsSemantica: impressaoSemantica(celulas),
    panlabsAparencia: impressaoDeAparencia(celulas),
    panlabsMotor: opts.motor || 'q11',
    panlabsSessao: JSON.stringify(sessao),
  };

  const attrs = Object.entries(selo).map(([k, v]) => `${k}="${esc(limparGremlins(v))}"`).join(' ');
  const bloco =
    `        <object id="${ID_SELO}" label="" ${attrs}>\n` +
    `          <mxCell style="text;html=1;" vertex="1" parent="1" visible="0">\n` +
    `            <mxGeometry x="0" y="0" width="1" height="1" as="geometry"/>\n` +
    `          </mxCell>\n` +
    `        </object>\n`;

  if (!RE_SELO.test(xml)) throw new Error('o XML do motor nao trouxe a celula panlabs-modelo para trocar');
  const saida = xml.replace(RE_SELO, bloco);

  // A armadilha do #19, que pegou de novo no #21: XML mal formado faz o draw.io
  // renderizar TRUNCADO com codigo de saida 0. O selo e justamente o lugar onde
  // texto arbitrario do usuario entra num atributo — e o lugar mais provavel de
  // um `<` cru escapar. Conferir aqui nao e zelo, e o unico ponto de controle.
  const erros = conferirXml(saida);
  if (erros.length) { const e = new Error('o selo produziu XML mal formado'); e.erros = erros; throw e; }
  return saida;
}

/**
 * Junta paginas de um `.drawio` num arquivo so.
 *
 * Cada `<diagram>` chega de uma execucao independente do motor, que so sabe
 * emitir uma pagina. Costurar aqui em vez de ensinar o motor a fazer paginas e
 * de proposito: o motor renderiza UMA vista, e quem sabe que existem duas e esta
 * camada. Ver `projetar.cjs`.
 */
function costurar(xmlsPorPagina, opts = {}) {
  const diagramas = xmlsPorPagina.map(xml => {
    const m = /[ \t]*<diagram[\s\S]*<\/diagram>/.exec(xml);
    if (!m) throw new Error('XML sem <diagram> para costurar');
    return m[0];
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
