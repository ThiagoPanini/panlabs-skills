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

const { lerPaginas, impressaoSemantica, impressaoDeAparencia, diferenca, classificar } = require('./impressao.cjs');
const { ESQUEMA_SELO } = require('./gravar.cjs');

/**
 * @returns {{nosso, comoReconheci, host, paginas, sessao, conflitoDeCopias}}
 */
function abrir(xml) {
  const { host, paginas } = lerPaginas(xml);
  const comoReconheci = [];

  const comSelo = paginas.filter(p => p.selo && p.selo.panlabsEsquema);
  if (comSelo.length) comoReconheci.push(`selo em ${comSelo.length}/${paginas.length} pagina(s)`);
  // O `host` e a marca fraca: e atributo do APP, nao nosso, e quem gravar o
  // arquivo por ultimo escreve o proprio nome nele. Serve para explicar, nunca
  // para decidir. Medido em `tools/medir-hospedeiro.cjs`.
  if (host === 'panlabs-aws-diagrams') comoReconheci.push('host="panlabs-aws-diagrams" (marca fraca)');

  const fora = comSelo.filter(p => p.selo.panlabsEsquema !== ESQUEMA_SELO);
  if (fora.length)
    comoReconheci.push(`⚠ ${fora.length} pagina(s) com esquema "${fora[0].selo.panlabsEsquema}", nao "${ESQUEMA_SELO}"`);

  if (!comSelo.length)
    return { nosso: false, comoReconheci, host, paginas: [], sessao: null, conflitoDeCopias: null,
      porque: 'nenhuma pagina traz o selo — ou o arquivo nao e nosso, ou a pagina que o tinha foi apagada' };

  // As copias por pagina tem de concordar. Discordar so acontece se alguem
  // colou uma pagina de OUTRO arquivo aqui dentro — que e informacao, nao erro.
  const copias = [...new Set(comSelo.map(p => p.selo.panlabsSessao))];
  const conflitoDeCopias = copias.length > 1
    ? { quantas: copias.length, paginas: comSelo.map(p => ({ pagina: p.id, vista: p.selo.panlabsVista })) }
    : null;

  let sessao = null;
  try { sessao = JSON.parse(comSelo[0].selo.panlabsSessao); }
  catch (e) { return { nosso: true, comoReconheci, host, paginas: [], sessao: null, conflitoDeCopias,
    porque: `o selo existe mas nao e JSON valido: ${e.message}` }; }

  const analisadas = paginas.map(p => {
    if (!p.selo || !p.selo.panlabsEsquema)
      return { ...p, vista: null, estado: 'sem-selo', porque: 'pagina sem selo — acrescentada a mao, ou nossa e teve o selo apagado' };
    const semAgora = impressaoSemantica(p.celulas);
    const apaAgora = impressaoDeAparencia(p.celulas);
    const semBate = semAgora === p.selo.panlabsSemantica;
    const apaBate = apaAgora === p.selo.panlabsAparencia;
    return {
      ...p,
      vista: p.selo.panlabsVista,
      estado: !semBate ? 'divergente' : apaBate ? 'intacto' : 'remanejado',
      impressoes: { semAgora, apaAgora, semSelada: p.selo.panlabsSemantica, apaSelada: p.selo.panlabsAparencia },
      motor: p.selo.panlabsMotor,
    };
  });

  return { nosso: true, comoReconheci, host, paginas: analisadas, sessao, conflitoDeCopias, porque: null };
}

/**
 * A pagina pede uma vista que o modelo recuperado sabe produzir?
 *
 * Descasar e possivel: um arquivo com pagina tecnica cujo modelo embutido esta
 * no estagio logico so existe se alguem editou o selo a mao. Raro, mas o erro
 * que sai de `projetar` nesse caso fala de casaco, e quem esta lendo quer ouvir
 * falar do arquivo.
 */
function podeRegerar(sessao, vista) {
  if (vista === 'tecnica' && sessao.estagio !== 'tecnica')
    return { pode: false, porque: 'a pagina diz ser a vista tecnica, mas o modelo selado esta no estagio logico — ' +
      'o selo e as paginas nao vieram da mesma gravacao.' };
  if (!vista) return { pode: false, porque: 'a pagina nao diz que vista ela e.' };
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
function diferir(pagina, celulasDeReferencia) {
  const achados = classificar(diferenca(celulasDeReferencia, pagina.celulas));
  const so = t => achados.filter(a => a.tipo === t).length;
  return {
    achados,
    resumo: {
      sumiram: so('sumiu'), apareceram: so('apareceu'), rotulos: so('rotulo'),
      pais: so('mudou-de-pai'), formas: so('forma'), extremos: so('extremos'),
    },
    absorviveis: achados.filter(a => a.classe === 'absorvivel').length,
    opacas: achados.filter(a => a.classe === 'opaca').length,
  };
}

/**
 * A politica. Separada da deteccao de proposito: detectar e medicao, decidir e
 * produto, e o #15 ja fixou a doutrina — *relata, propoe, nunca conserta calado*
 * e *bloqueia em bloco, uma vez so*.
 */
function politica(estado) {
  switch (estado) {
    case 'intacto':
      return { regerarEhSeguro: true, bloqueia: false,
        diga: 'o desenho e o que o modelo produz. Sigo.' };
    case 'remanejado':
      return { regerarEhSeguro: true, bloqueia: false, avisa: true,
        diga: 'voce moveu coisa neste desenho. O modelo continua valendo, mas regerar devolve o layout do motor e perde o seu ajuste — confirme antes.' };
    case 'divergente':
      return { regerarEhSeguro: false, bloqueia: true,
        diga: 'o desenho afirma uma arquitetura que o modelo nao afirma. Nao regero por cima: eu apagaria a sua edicao, e nao sei qual das duas versoes voce considera verdade.' };
    default:
      return { regerarEhSeguro: false, bloqueia: true,
        diga: 'pagina sem selo — nao sei o que ela afirma nem quem a desenhou.' };
  }
}

module.exports = { abrir, diferir, politica, podeRegerar };
