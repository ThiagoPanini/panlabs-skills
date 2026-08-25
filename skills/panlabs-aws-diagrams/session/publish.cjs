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
 * | `fatos[].from` | **sai** | a citação. O `fato` fica: ele é premissa da arquitetura |
 * | `acordo.by` | **sai** | nome de pessoa |
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

const { reescreverSelos } = require('./fingerprint.cjs');

const PUBLISHED_SCHEMA = 'panlabs-aws-diagrams/published@1';

/**
 * A RÉGUA, EM DADOS — uma lista só, e é dela que saem as três coisas que
 * precisam concordar: o que a poda tira, o que o aviso conta, e o que a checagem
 * planta.
 *
 * Escrever a régua três vezes é o erro que este arquivo cometeu na primeira
 * versão e que a revisão pegou: a poda tirava `compra` e `difereEm`, o contador
 * não olhava para eles, e uma sessão cuja única deliberação fosse `compra` era
 * podada enquanto o CLI dizia *"nada — o arquivo já não trazia deliberação"*.
 * Com a lista aqui, divergir exige mexer nos três de uma vez.
 *
 * `onde` é o caminho no dossiê; `campos` é o que sai de cada item; `filtro`
 * (quando existe) diz quais ITENS somem inteiros.
 */
const DELIBERATION = [
  { onde: 'candidates', filtro: c => c.state === 'discarded',
    campos: ['because', 'pays', 'buys', 'chooseIf', 'wrongIf', 'differsIn'],
    because: 'as candidatas descartadas somem; da escolhida sobra o que descreve o desenho' },
  { onde: 'findings', campos: ['note'],
    because: 'o QUE foi achado é técnico; o texto costuma citar a conversa' },
  { onde: 'parking', filtro: () => true, campos: ['note'],
    because: 'é fala de pessoa em reunião, com aspas' },
  { onde: 'facts', campos: ['from'],
    because: 'a citação sai; o fato fica, é premissa da arquitetura' },
  { onde: 'agreement', campos: ['by', 'snapshot'],
    because: 'nome de pessoa, e a deliberação da fase lógica' },
];

const listOf = (d, onde) => (Array.isArray(d[onde]) ? d[onde] : d[onde] ? [d[onde]] : []);

/** A sessão sem a deliberação. Função pura: devolve outra, não muta a de dentro. */
function prune(session) {
  const s = JSON.parse(JSON.stringify(session));
  const d = s.dossier;
  if (!d) return s;

  for (const r of DELIBERATION) {
    if (d[r.onde] === undefined) continue;
    const isList = Array.isArray(d[r.onde]);
    let itens = listOf(d, r.onde);
    if (r.filtro) itens = itens.filter(x => !r.filtro(x));
    // `estacionamento` some inteiro: o filtro dele casa com todo item
    if (r.filtro && !itens.length && isList && r.onde === 'parking') { delete d[r.onde]; continue; }
    for (const it of itens) for (const c of r.campos) delete it[c];
    d[r.onde] = isList ? itens : itens[0];
  }
  return s;
}

/** Quantos itens de deliberação uma sessão ainda carrega. Mesma lista da poda. */
function countDeliberation(session) {
  const d = (session && session.dossier) || {};
  let n = 0;
  for (const r of DELIBERATION) {
    for (const it of listOf(d, r.onde)) {
      // um item que a régua manda embora INTEIRO conta uma vez, e não outra por
      // cada campo dentro dele — senão uma candidata descartada com `porque`
      // aparecia como dois itens
      if (r.filtro && r.filtro(it)) { n += 1; continue; }
      if (r.campos.some(c => it[c] !== undefined)) n += 1;
    }
  }
  return n;
}

/**
 * Reescreve o selo de todas as páginas para a versão publicável.
 *
 * As IMPRESSÕES continuam, e de propósito: elas são hashes do DESENHO, não do
 * dossiê, e é com elas que quem receber o arquivo consegue provar que o PNG que
 * está vendo é o que saiu daqui. Tirá-las não protegeria nada e tiraria a única
 * garantia que a cópia ainda pode dar.
 */
const DEFAULT_BECAUSE =
  'copia publicada: a deliberacao da sessao (candidatas descartadas, motivo das recusas, ' +
  'estacionamento, quem aprovou) foi podada. Retome a partir do arquivo de trabalho.';

function publish(xml) {
  const r = reescreverSelos(xml, p => {
    const seal = p.seal || {};
    let session = null;
    try { session = JSON.parse(seal.panlabsSessao); } catch (e) { session = null; }
    return {
      panlabsSchema: PUBLISHED_SCHEMA,
      panlabsVista: seal.panlabsVista,
      panlabsSemantica: seal.panlabsSemantica,
      panlabsAparencia: seal.panlabsAparencia,
      panlabsMotor: seal.panlabsMotor,
      panlabsRetomavel: 'nao',
      panlabsPorque: DEFAULT_BECAUSE,
      panlabsSessao: session ? JSON.stringify(prune(session)) : '',
    };
  });
  if (r.pages.every(p => !p.seal || !p.seal.panlabsSessao))
    throw new Error('nenhuma pagina traz selo de sessao — nao ha dossie para podar');
  return r.xml;
}

/**
 * O aviso de uma linha, no padrão que o #16 fixou: avisa, não bloqueia, e nomeia
 * o que fazer. Fica aqui e não em `save.cjs` porque quem sabe o que é
 * deliberação é este módulo — a régua mora num lugar só.
 */
function dossierWarning(session) {
  /**
   * Conta DELIBERAÇÃO PRESENTE, pela MESMA lista que a poda usa.
   *
   * Duas armadilhas que a revisão do #23 pegou, e as duas eram o mesmo erro —
   * a régua escrita duas vezes:
   *
   *   · contar por ESTADO fazia a cópia podada avisar sobre deliberação que ela
   *     já não carrega (ela guarda que um achado foi recusado — fato técnico —
   *     mas não o motivo);
   *   · contar por estado E por campo somava a mesma candidata duas vezes.
   */
  const quantos = countDeliberation(session);
  if (!quantos) return null;
  return `este arquivo carrega ${quantos} item(ns) de deliberacao no selo — candidata descartada, ` +
    'recusa com motivo, estacionamento ou quem aprovou. Legiveis em Extras > Editar diagrama. ' +
    'Para mandar para fora, gere a copia publicada (session/publish.cjs).';
}

// ------------------------------------------------------------------- CLI

function main() {
  const fs = require('fs');
  const path = require('path');
  // ⚠️ `--output x.drawio y.drawio` — o valor de uma flag NÃO é a entrada. A
  // primeira versão usava `args.find(a => !a.startsWith('--'))` e, com a flag
  // na frente, publicava o arquivo de SAÍDA.
  const args = process.argv.slice(2);
  const iOutput = args.indexOf('--output');
  if (iOutput >= 0 && args[iOutput + 1] === undefined) {
    console.error('--output precisa de um caminho');
    process.exit(2);
  }
  // ⚠️ `i !== iOutput + 1` pula o valor de `--output` — mas com `iOutput = -1` ele
  // pulava o ÍNDICE 0, que é justamente o argumento posicional da forma sem
  // `--output`. `node session/publish.cjs output/retail.drawio` respondia com o
  // texto de uso, o que faz a linha do README parecer errada quando quem está
  // errado é a guarda. Achado no #24, ao regerar a cópia publicada.
  const input = args.find((a, i) => !a.startsWith('--') && !(iOutput >= 0 && i === iOutput + 1));
  if (!input) {
    console.error('uso: node session/publish.cjs <trabalho.drawio> [--output <copia>.drawio]');
    console.error('  Produz a copia que CIRCULA: sem candidatas descartadas, sem o motivo das');
    console.error('  recusas, sem estacionamento e sem quem aprovou. Ela NAO retoma a sessao.');
    process.exit(2);
  }
  const output = iOutput >= 0 ? args[iOutput + 1] : input.replace(/\.drawio$/, '') + '.published.drawio';
  const xml = fs.readFileSync(input, 'utf8');
  let copia;
  try { copia = publish(xml); }
  catch (e) { console.error(`\n✗ ${e.message}`); for (const l of e.erros || []) console.error(`    · ${l}`); process.exit(1); }

  let session = null;
  try {
    session = JSON.parse(require('./fingerprint.cjs').readPages(xml).pages[0].seal.panlabsSessao);
  } catch (e) { /* sem selo legivel */ }
  const antes = session ? countDeliberation(session) : 0;

  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
  fs.writeFileSync(output, copia);
  console.log(`  → ${output}  (${copia.length} bytes, era ${xml.length})`);
  console.log(antes
    ? `  podado: ${antes} item(ns) de deliberacao — ` +
      DELIBERATION.map(r => r.onde).join(', ')
    : '  podado: nada — o arquivo ja nao trazia deliberacao');
  console.log('  esta copia NAO retoma a sessao. Guarde o arquivo de trabalho.');
}

if (require.main === module) main();

module.exports = { publish, prune, dossierWarning, countDeliberation, PUBLISHED_SCHEMA, DELIBERATION };
