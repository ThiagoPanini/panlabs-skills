'use strict';
/**
 * A cópia que CIRCULA — e por que ela é um arquivo diferente do que retoma.
 *
 * O ⚠️ que o mapa carregava sem veredito: o `.drawio` que o usuário manda por
 * e-mail leva dentro, em texto legível por qualquer um em *Extras › Editar
 * diagrama*, as candidatas descartadas com o motivo do descarte, os achados que
 * o time RECUSOU com a justificativa, a fala que a pessoa deu na reunião e o
 * nome de quem aprovou. O #14 pôs tudo ali por medição — sidecar dessincroniza —
 * e a medição continua certa. O que faltava era reconhecer que **o arquivo que
 * retoma e o arquivo que circula não são o mesmo arquivo**.
 *
 * ## A decisão
 *
 * Duas saídas, um formato. `desenhar` continua gravando o dossiê inteiro: é o
 * arquivo de TRABALHO, e é dele que a sessão seguinte nasce. `publicar` produz a
 * cópia que sai da casa, sem a deliberação, e o selo dela **diz que ela não
 * retoma** — em vez de ficar parecendo um arquivo de trabalho corrompido.
 *
 * Por que não apagar sempre: apagar por padrão desfaz o #14 inteiro. A sessão
 * some no primeiro salvamento e a skill volta a depender de alguém lembrar.
 *
 * Por que não deixar sempre: a exposição é real e hoje o usuário não tem nem
 * como vê-la. "Está escondido num atributo" não é uma propriedade de segurança —
 * é um menu de dois cliques.
 *
 * Por que um VERBO e não uma opção de geração: mandar o arquivo para alguém é um
 * ato, e atos têm hora. A opção de geração obrigaria a decidir a privacidade no
 * momento errado — quando o desenho nasce, e não quando ele sai.
 *
 * ## A régua do que sai
 *
 * **Sai o que é sobre PESSOAS e sobre CAMINHOS NÃO TOMADOS. Fica o que é sobre a
 * arquitetura desenhada.**
 *
 * A régua tem uma consequência que vale dizer em voz alta: quase nada do que
 * fica é segredo, porque quase tudo que fica já está no desenho. O modelo é a
 * arquitetura, e a arquitetura está no PNG. O que sai é a conversa que levou
 * até ela.
 *
 * | campo | na cópia | por quê |
 * |---|---|---|
 * | `nos`/`arestas`/`faixas`/`notas` | fica | é o desenho em texto; quem vê a imagem já sabe |
 * | `dossie.eixos` | fica | descreve a arquitetura ESCOLHIDA, que está desenhada |
 * | `candidatas` descartadas | **sai** | deliberação interna: "por que não a B" é conversa da casa |
 * | `candidatas` escolhida | fica sem `porque`/`paga`/`erradaSe`/`escolhaSe` | o nome e a tupla descrevem o desenho; o resto é o argumento |
 * | `achados[].nota` | **sai** | é onde mora "o time aceitou por orçamento" |
 * | `achados[]` regra/alvo/estado | fica | o QUE foi encontrado é técnico, e a recusa já viaja como nota no desenho (#14) |
 * | `estacionamento` | **sai inteiro** | é fala de pessoa em reunião, com aspas |
 * | `fatos[].de` | **sai** | a citação. O `fato` fica: ele é premissa da arquitetura |
 * | `acordo.por` | **sai** | nome de pessoa |
 * | `acordo.recorte` | **sai** | é a vista lógica aprovada, isto é, a deliberação da fase 1 |
 * | `acordo.impressao`/`em`/`vista` | fica | provam QUE foi aprovado e QUANDO, sem dizer por quem nem o quê |
 *
 * ## O que a cópia NÃO tenta ser
 *
 * Não é anonimização e não é criptografia. Um rótulo de nó pode dizer
 * "RDS · dados de cartão do cliente X" e isso continua no desenho, porque é o
 * desenho. A régua aqui é uma só: **o que o leitor do PNG já vê pode ficar; o
 * que só existia na conversa, não.**
 */

const { esc, conferirXml, limparGremlins } = require('../motor/emitir.cjs');
const { lerPaginas, ID_SELO } = require('./impressao.cjs');

const ESQUEMA_PUBLICADO = 'panlabs-aws-diagrams/publicado@1';

const RE_SELO_G = /[ \t]*<object id="panlabs-modelo"[\s\S]*?<\/object>\n?/g;

/** Os campos que a régua manda embora, para a checagem poder citar a mesma lista. */
const DELIBERACAO = [
  'dossie.candidatas[estado=descartada]',
  'dossie.candidatas[].porque',
  'dossie.candidatas[].paga',
  'dossie.candidatas[].compra',
  'dossie.candidatas[].escolhaSe',
  'dossie.candidatas[].erradaSe',
  'dossie.candidatas[].difereEm',
  'dossie.achados[].nota',
  'dossie.estacionamento',
  'dossie.fatos[].de',
  'dossie.acordo.por',
  'dossie.acordo.recorte',
];

/** A sessão sem a deliberação. Função pura: devolve outra, não muta a de dentro. */
function podar(sessao) {
  const s = JSON.parse(JSON.stringify(sessao));
  const d = s.dossie;
  if (!d) return s;

  if (Array.isArray(d.candidatas))
    d.candidatas = d.candidatas
      .filter(c => c.estado === 'escolhida')
      .map(({ id, nome, tupla, estado }) => ({ id, nome, tupla, estado }));

  if (Array.isArray(d.achados))
    d.achados = d.achados.map(({ regra, alvo, estado, viaNota, em }) => {
      const a = { regra, estado };
      if (alvo !== undefined) a.alvo = alvo;
      // `viaNota` fica: é o elo que prova que a recusa chegou ao desenho, e ele
      // aponta para uma nota que o leitor já vê na página.
      if (viaNota !== undefined) a.viaNota = viaNota;
      if (em !== undefined) a.em = em;
      return a;
    });

  delete d.estacionamento;

  if (Array.isArray(d.fatos))
    d.fatos = d.fatos.map(({ fato, procedencia, confirmado }) => {
      const f = { fato, procedencia };
      if (confirmado !== undefined) f.confirmado = confirmado;
      return f;
    });

  if (d.acordo) {
    const { vista, impressao, em } = d.acordo;
    d.acordo = { vista, impressao };
    if (em !== undefined) d.acordo.em = em;
  }
  return s;
}

/**
 * Reescreve o selo de todas as páginas para a versão publicável.
 *
 * As IMPRESSÕES continuam, e de propósito: elas são hashes do DESENHO, não do
 * dossiê, e é com elas que quem receber o arquivo consegue provar que o PNG que
 * está vendo é o que saiu daqui. Tirá-las não protegeria nada e tiraria a única
 * garantia que a cópia ainda pode dar.
 */
function publicar(xml, opts = {}) {
  const { paginas } = lerPaginas(xml);
  if (!paginas.length) throw new Error('publicar recebeu um XML sem pagina nenhuma');

  const semSelo = paginas.filter(p => !p.selo || !p.selo.panlabsSessao);
  if (semSelo.length === paginas.length)
    throw new Error('nenhuma pagina traz selo de sessao — nao ha dossie para podar');

  let i = 0;
  const saida = xml.replace(RE_SELO_G, () => {
    const p = paginas[i] || paginas[paginas.length - 1];
    i += 1;
    const selo = p.selo || {};
    let sessao = null;
    try { sessao = JSON.parse(selo.panlabsSessao); } catch (e) { sessao = null; }
    const novo = {
      panlabsEsquema: ESQUEMA_PUBLICADO,
      panlabsVista: selo.panlabsVista,
      panlabsSemantica: selo.panlabsSemantica,
      panlabsAparencia: selo.panlabsAparencia,
      panlabsMotor: selo.panlabsMotor,
      panlabsRetomavel: 'nao',
      panlabsPorque: opts.porque ||
        'copia publicada: a deliberacao da sessao (candidatas descartadas, motivo das recusas, ' +
        'estacionamento, quem aprovou) foi podada. Retome a partir do arquivo de trabalho.',
      panlabsSessao: sessao ? JSON.stringify(podar(sessao)) : '',
    };
    const attrs = Object.entries(novo)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}="${esc(limparGremlins(v))}"`).join(' ');
    return `        <object id="${ID_SELO}" label="" ${attrs}>\n` +
      `          <mxCell style="text;html=1;" vertex="1" parent="1" visible="0">\n` +
      `            <mxGeometry x="0" y="0" width="1" height="1" as="geometry"/>\n` +
      `          </mxCell>\n` +
      `        </object>\n`;
  });

  if (i !== paginas.length)
    throw new Error(`o XML tem ${paginas.length} pagina(s) mas ${i} selo(s) — alguma pagina ficou sem podar`);

  const erros = conferirXml(saida);
  if (erros.length) { const e = new Error('a poda produziu XML mal formado'); e.erros = erros; throw e; }
  return saida;
}

/**
 * O aviso de uma linha, no padrão que o #16 fixou: avisa, não bloqueia, e nomeia
 * o que fazer. Fica aqui e não em `gravar.cjs` porque quem sabe o que é
 * deliberação é este módulo — a régua mora num lugar só.
 */
function avisoDeDossie(sessao) {
  const d = (sessao && sessao.dossie) || {};
  /**
   * Conta DELIBERAÇÃO PRESENTE, não "existe um achado recusado".
   *
   * A diferença importa e a checagem pegou: a cópia podada guarda que um achado
   * foi recusado — é fato técnico, e a nota dele já está no desenho — mas não
   * guarda o motivo. Contar por estado faria a cópia publicada avisar sobre uma
   * deliberação que ela não carrega mais, que é o aviso mentindo.
   */
  const quantos =
    (d.candidatas || []).filter(c => c.estado === 'descartada').length +
    (d.candidatas || []).filter(c => c.porque || c.paga || c.erradaSe || c.escolhaSe).length +
    (d.achados || []).filter(a => a.nota).length +
    (d.estacionamento || []).length +
    (d.fatos || []).filter(f => f.de).length +
    (d.acordo && d.acordo.por ? 1 : 0) +
    (d.acordo && d.acordo.recorte ? 1 : 0);
  if (!quantos) return null;
  return `este arquivo carrega ${quantos} item(ns) de deliberacao no selo — candidata descartada, ` +
    'recusa com motivo, estacionamento ou quem aprovou. Legiveis em Extras > Editar diagrama. ' +
    'Para mandar para fora, gere a copia publicada (sessao/publicar.cjs).';
}

// ------------------------------------------------------------------- CLI

function main() {
  const fs = require('fs');
  const path = require('path');
  const args = process.argv.slice(2);
  const entrada = args.find(a => !a.startsWith('--'));
  if (!entrada) {
    console.error('uso: node sessao/publicar.cjs <trabalho.drawio> [--saida <copia>.drawio]');
    console.error('  Produz a copia que CIRCULA: sem candidatas descartadas, sem o motivo das');
    console.error('  recusas, sem estacionamento e sem quem aprovou. Ela NAO retoma a sessao.');
    process.exit(2);
  }
  const i = args.indexOf('--saida');
  const saida = i >= 0 ? args[i + 1] : entrada.replace(/\.drawio$/, '') + '.publicado.drawio';
  const xml = fs.readFileSync(entrada, 'utf8');
  let copia;
  try { copia = publicar(xml); }
  catch (e) { console.error(`\n✗ ${e.message}`); for (const l of e.erros || []) console.error(`    · ${l}`); process.exit(1); }

  let sessao = null;
  try { sessao = JSON.parse(lerPaginas(xml).paginas[0].selo.panlabsSessao); } catch (e) { /* sem selo legivel */ }
  const antes = sessao ? avisoDeDossie(sessao) : null;

  fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
  fs.writeFileSync(saida, copia);
  console.log(`  → ${saida}  (${copia.length} bytes, era ${xml.length})`);
  console.log(`  podado: ${antes ? antes.replace(/\. Para mandar.*/, '') : 'nada — o arquivo ja nao trazia deliberacao'}`);
  console.log('  esta copia NAO retoma a sessao. Guarde o arquivo de trabalho.');
}

if (require.main === module) main();

module.exports = { publicar, podar, avisoDeDossie, ESQUEMA_PUBLICADO, DELIBERACAO };
