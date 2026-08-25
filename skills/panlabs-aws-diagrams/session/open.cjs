'use strict';
/**
 * Abertura — o que a skill faz quando recebe um `.drawio` e precisa saber se ele
 * e dela, e se o modelo que veio dentro ainda vale.
 *
 * Tres perguntas do #14 se respondem aqui:
 *
 *   1. Como a skill RECONHECE um diagrama que ela mesma gerou.
 *   2. Como ela RECUPERA o contexto da conversa anterior.
 *   3. O que acontece quando o humano EDITOU o arquivo entre as duas sessoes.
 *
 * Os tres estados possiveis de uma pagina, e por que sao tres e nao dois:
 *
 *   INTACTO      as duas impressoes batem. O modelo e a verdade; regerar e seguro.
 *   REMANEJADO   a semantica bate, a geometria nao. O humano ARRASTOU coisa. O
 *                modelo continua valendo — mas regerar joga fora o trabalho dele,
 *                e fazer isso calado e a pior coisa que a skill pode fazer com
 *                quem gastou meia hora ajeitando um desenho.
 *   DIVERGENTE   a semantica nao bate. O humano acrescentou, apagou ou renomeou.
 *                O modelo agora AFIRMA uma arquitetura diferente da desenhada, e
 *                nao ha como saber qual das duas o usuario considera verdade.
 *
 * Dois estados nao dariam conta: colapsar remanejado em intacto perde o trabalho
 * manual; colapsar remanejado em divergente bloqueia quem so moveu uma caixa, e
 * bloqueio que dispara a toa e bloqueio que o usuario aprende a ignorar.
 */

const { readPages, impressaoSemantica, appearanceFingerprint, diferenca, classify } = require('./fingerprint.cjs');
const { SEAL_SCHEMA } = require('./save.cjs');
const { PUBLISHED_SCHEMA } = require('./publish.cjs');

/**
 * @returns {{nosso, comoReconheci, host, paginas, sessao, conflitoDeCopias}}
 */
function open(xml) {
  const { host, pages } = readPages(xml);
  const howIRecognized = [];

  const sealed = pages.filter(p => p.seal && p.seal.panlabsSchema);
  if (sealed.length) howIRecognized.push(`selo em ${sealed.length}/${pages.length} pagina(s)`);
  // O `host` e a marca fraca: e atributo do APP, nao nosso, e quem gravar o
  // arquivo por ultimo escreve o proprio nome nele. Serve para explicar, nunca
  // para decidir. Medido em `tools/measure-host.cjs`.
  if (host === 'panlabs-aws-diagrams') howIRecognized.push('host="panlabs-aws-diagrams" (marca fraca)');

  /**
   * A COPIA PUBLICADA se declara, e este e o ponto de ela se declarar.
   *
   * Sem isto ela chegaria aqui como um arquivo nosso com o dossie mutilado, e a
   * skill diria "candidatas descartadas: nenhuma" — que e falso e cala justamente
   * onde a decisao do #23 quis falar. Um arquivo que perdeu a deliberacao de
   * proposito tem de dizer que perdeu, e dizer onde ela esta.
   */
  const publishedPages = sealed.filter(p => p.seal.panlabsSchema === PUBLISHED_SCHEMA);
  if (publishedPages.length === sealed.length && publishedPages.length) {
    howIRecognized.push(`copia PUBLICADA (${PUBLISHED_SCHEMA}) — nao retoma`);
    return { ours: true, published: true, howIRecognized, host, pages: [], session: null, copyConflict: null,
      because: publishedPages[0].seal.panlabsPorque ||
        'copia publicada: a deliberacao foi podada de proposito. Retome pelo arquivo de trabalho.' };
  }
  if (publishedPages.length)
    howIRecognized.push(`⚠ ${publishedPages.length} de ${sealed.length} pagina(s) sao copia publicada — ` +
      'alguem colou pagina de uma copia dentro do arquivo de trabalho');

  const fora = sealed.filter(p => p.seal.panlabsSchema !== SEAL_SCHEMA && p.seal.panlabsSchema !== PUBLISHED_SCHEMA);
  if (fora.length)
    howIRecognized.push(`⚠ ${fora.length} pagina(s) com esquema "${fora[0].seal.panlabsSchema}", nao "${SEAL_SCHEMA}"`);

  if (!sealed.length)
    return { ours: false, howIRecognized, host, pages: [], session: null, copyConflict: null,
      because: 'nenhuma pagina traz o selo — ou o arquivo nao e nosso, ou a pagina que o tinha foi apagada' };

  // As copias por pagina tem de concordar. Discordar so acontece se alguem
  // colou uma pagina de OUTRO arquivo aqui dentro — que e informacao, nao erro.
  const copias = [...new Set(sealed.map(p => p.seal.panlabsSessao))];
  const copyConflict = copias.length > 1
    ? { quantas: copias.length, pages: sealed.map(p => ({ page: p.id, view: p.seal.panlabsVista })) }
    : null;

  let session = null;
  try { session = JSON.parse(sealed[0].seal.panlabsSessao); }
  catch (e) { return { ours: true, howIRecognized, host, pages: [], session: null, copyConflict,
    because: `o selo existe mas nao e JSON valido: ${e.message}` }; }

  const analisadas = pages.map(p => {
    if (!p.seal || !p.seal.panlabsSchema)
      return { ...p, view: null, state: 'sem-selo', because: 'pagina sem selo — acrescentada a mao, ou nossa e teve o selo apagado' };
    const semAgora = impressaoSemantica(p.celulas);
    const apaAgora = appearanceFingerprint(p.celulas);
    const semBate = semAgora === p.seal.panlabsSemantica;
    const apaBate = apaAgora === p.seal.panlabsAparencia;
    return {
      ...p,
      view: p.seal.panlabsVista,
      state: !semBate ? 'divergente' : apaBate ? 'intacto' : 'remanejado',
      impressoes: { semAgora, apaAgora, semSelada: p.seal.panlabsSemantica, apaSelada: p.seal.panlabsAparencia },
      engine: p.seal.panlabsMotor,
    };
  });

  return { ours: true, howIRecognized, host, pages: analisadas, session, copyConflict, because: null };
}

/**
 * A pagina pede uma vista que o modelo recuperado sabe produzir?
 *
 * Descasar e possivel: um arquivo com pagina tecnica cujo modelo embutido esta
 * no estagio logico so existe se alguem editou o selo a mao. Raro, mas o erro
 * que sai de `projetar` nesse caso fala de casaco, e quem esta lendo quer ouvir
 * falar do arquivo.
 */
function canRegenerate(session, view) {
  if (view === 'technical' && session.stage !== 'technical')
    return { pode: false, because: 'a pagina diz ser a vista tecnica, mas o modelo selado esta no estagio logico — ' +
      'o selo e as paginas nao vieram da mesma gravacao.' };
  if (!view) return { pode: false, because: 'a pagina nao diz que vista ela e.' };
  return { pode: true };
}

/**
 * A diferenca exata, quando a pagina esta divergente.
 *
 * O "antes" nao vem do arquivo — vem de REGERAR o modelo. O #11 provou que o
 * motor e deterministico (a ordem das linhas cai de exposicao + rotulo, nao da
 * ordem do arquivo), entao regerar o modelo selado reproduz exatamente as
 * celulas que foram gravadas. E por isso que o selo carrega hash e nao a lista
 * de celulas: a lista e recalculavel, e guardar a saida junto da fonte e
 * comprar mais um par que pode dessincronizar.
 *
 * A ressalva honesta: se o MOTOR mudou entre as duas sessoes, regerar pode dar
 * outra geometria sem que ninguem tenha tocado no arquivo. E para isso que o
 * selo carrega `panlabsMotor` — a divergencia geometrica passa a ser explicavel
 * em vez de misteriosa.
 */
function differ(page, celulasDeReferencia) {
  const findings = classify(diferenca(celulasDeReferencia, page.celulas));
  const so = t => findings.filter(a => a.kind === t).length;
  return {
    findings,
    resumo: {
      sumiram: so('sumiu'), apareceram: so('apareceu'), rotulos: so('label'),
      pais: so('mudou-de-pai'), formas: so('forma'), extremos: so('extremos'),
    },
    absorviveis: findings.filter(a => a.classe === 'absorvivel').length,
    opacas: findings.filter(a => a.classe === 'opaca').length,
  };
}

/**
 * A politica. Separada da deteccao de proposito: detectar e medicao, decidir e
 * produto, e o #15 ja fixou a doutrina — *relata, propoe, nunca conserta calado*
 * e *bloqueia em bloco, uma vez so*.
 *
 * O glifo mora aqui junto com o resto. Ele estava numa tabela solta no
 * briefing, e um estado novo obrigaria a lembrar de dois lugares — este e o
 * unico que sabe o que cada estado significa.
 */
function policy(state) {
  switch (state) {
    case 'intacto':
      return { glifo: '✓', regerarEhSeguro: true, bloqueia: false,
        diga: 'o desenho e o que o modelo produz. Sigo.' };
    case 'remanejado':
      return { glifo: '~', regerarEhSeguro: true, bloqueia: false, avisa: true,
        diga: 'voce moveu coisa neste desenho. O modelo continua valendo, mas regerar devolve o layout do motor e perde o seu ajuste — confirme antes.' };
    case 'divergente':
      return { glifo: '✗', regerarEhSeguro: false, bloqueia: true,
        diga: 'o desenho afirma uma arquitetura que o modelo nao afirma. Nao regero por cima: eu apagaria a sua edicao, e nao sei qual das duas versoes voce considera verdade.' };
    default:
      return { glifo: '?', regerarEhSeguro: false, bloqueia: true,
        diga: 'pagina sem selo — nao sei o que ela afirma nem quem a desenhou.' };
  }
}

module.exports = { open, differ, policy, canRegenerate };
