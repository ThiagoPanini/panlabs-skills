'use strict';
/**
 * O briefing — como a sessao seguinte "recupera o contexto da conversa
 * anterior", que e uma das perguntas literais do #14.
 *
 * A resposta que NAO serve e guardar a transcricao. Transcricao e cara, envelhece
 * mal e obriga a proxima sessao a reler uma conversa para descobrir tres fatos.
 * O que se recupera e o DOSSIE, e o briefing e ele renderizado: o que ficou
 * decidido, o que foi recusado e por que, o que esta estacionado esperando a
 * fase tecnica, e se o acordo ainda vale.
 *
 * Isto e o que o agente le ao reabrir o arquivo. Nao e log de execucao — e o
 * lugar de onde ele retoma a conversa sem pedir ao usuario que repita nada.
 */

const cabeca = t => ['', `  ${t}`, `  ${'─'.repeat(Math.max(8, t.length))}`];

function briefing(aberto, extra = {}) {
  const L = [];
  const s = aberto.sessao;

  L.push('', '  ┌─ RETOMADA ' + '─'.repeat(52));
  if (!aberto.nosso) {
    L.push(`  │ Este arquivo nao e meu: ${aberto.porque}`);
    L.push('  └' + '─'.repeat(63));
    return L;
  }
  L.push(`  │ Reconheci por: ${aberto.comoReconheci.join(' · ')}`);
  L.push(`  │ Caso: ${s.titulo}`);
  L.push(`  │ Estagio do modelo: ${s.estagio}   ·   ${s.nos.length} nos, ${(s.arestas || []).length} arestas`);
  L.push('  └' + '─'.repeat(63));

  // ------------------------------------------------------- estado das paginas
  L.push(...cabeca('Paginas e o que o humano fez com elas'));
  for (const p of aberto.paginas) {
    const marca = { intacto: '✓', remanejado: '~', divergente: '✗', 'sem-selo': '?' }[p.estado] || '?';
    L.push(`    ${marca} ${String(p.nome || p.id).padEnd(34)} vista=${p.vista || '—'}  ${p.estado}`);
    if (p.porque) L.push(`        ${p.porque}`);
  }
  if (aberto.conflitoDeCopias)
    L.push(`    ⚠ as paginas trazem ${aberto.conflitoDeCopias.quantas} copias DIFERENTES do modelo — ` +
      'alguem colou aqui uma pagina de outro arquivo.');

  // -------------------------------------------------------------- o acordo
  const acordo = s.dossie && s.dossie.acordo;
  L.push(...cabeca('O acordo'));
  if (!acordo) {
    L.push('    (nenhum) — a vista logica ainda nao foi aprovada. A fase tecnica nao comeca.');
  } else {
    L.push(`    aprovado ${acordo.em || '(sem data)'}${acordo.por ? ' por ' + acordo.por : ''}` +
      `${acordo.candidata ? ', candidata ' + acordo.candidata : ''}`);
    L.push(`    cobre ${acordo.recorte.nos.length} capacidades, ${acordo.recorte.arestas.length} fluxos, ${acordo.recorte.notas.length} nota(s)`);
    if (extra.acordo)
      L.push(extra.acordo.ok
        ? '    ✓ a projecao logica de hoje ainda bate com a aprovada'
        : `    ✗ ${extra.acordo.motivo}`);
    for (const d of (extra.acordo && extra.acordo.diferencas) || []) L.push(`        · ${d.texto}`);
  }

  // ---------------------------------------------------------- as candidatas
  const d = s.dossie || {};
  if (d.candidatas && d.candidatas.length) {
    L.push(...cabeca('Candidatas — a escolhida e as descartadas'));
    for (const c of d.candidatas) {
      const marca = c.estado === 'escolhida' ? '►' : '·';
      L.push(`    ${marca} ${c.nome}${c.difereEm ? `   (difere em ${c.difereEm.join(', ')})` : ''}`);
      L.push(`        E1–E5: ${c.tupla.join(' | ')}`);
      if (c.porque) L.push(`        ${c.porque}`);
    }
    L.push('    As descartadas ficam para nao serem repropostas, e para responder "por que nao a B?".');
  }

  // ------------------------------------------------------------- os achados
  if (d.achados && d.achados.length) {
    L.push(...cabeca('Revisao de lacunas — o que foi aceito e o que foi recusado'));
    for (const a of d.achados) {
      const marca = { aceito: '+', recusado: '✗', resolvido: '✓' }[a.estado] || '·';
      L.push(`    ${marca} ${String(a.regra).padEnd(28)} ${a.alvo || ''}  ${a.nota || ''}`);
    }
    const recusados = d.achados.filter(a => a.estado === 'recusado');
    if (recusados.length)
      L.push(`    ${recusados.length} recusa(s) viajam ate o desenho como nota — e assim que "SPOF conhecido e aceito" sobrevive.`);
  }

  // -------------------------------------------------------- o estacionamento
  if (d.estacionamento && d.estacionamento.length) {
    L.push(...cabeca('Estacionamento — nomes de servico ditos cedo demais'));
    for (const e of d.estacionamento)
      L.push(`    ${e.estado === 'devolvido' ? '↩' : '⏸'} ${String(e.nome).padEnd(12)} → ${e.capacidade || ''}   ${e.nota || ''}`);
    const parados = d.estacionamento.filter(e => e.estado === 'estacionado');
    if (parados.length)
      L.push(`    ${parados.length} esperando a fase tecnica: voltam como SUGESTAO inferida contra a capacidade, para confirmar.`);
  }

  // ------------------------------------------------------------------ fatos
  if (d.fatos && d.fatos.length) {
    const inferidos = d.fatos.filter(f => f.procedencia === 'inferido');
    const naoConfirmados = d.fatos.filter(f => !f.confirmado);
    L.push(...cabeca('Fatos'));
    L.push(`    ${d.fatos.length} fatos · ${inferidos.length} inferido(s) · ${naoConfirmados.length} ainda sem confirmacao`);
    for (const f of naoConfirmados) L.push(`    ⚠ nao confirmado: ${f.fato}`);
  }

  return L;
}

module.exports = { briefing };
