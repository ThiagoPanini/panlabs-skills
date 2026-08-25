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

const { politica } = require('./open.cjs');

const cabeca = t => ['', `  ${t}`, `  ${'─'.repeat(Math.max(8, t.length))}`];

function briefing(aberto, extra = {}) {
  const L = [];
  const s = aberto.sessao;

  L.push('', '  ┌─ RETOMADA ' + '─'.repeat(52));
  if (!aberto.nosso) {
    L.push(`  │ Este arquivo nao e meu: ${aberto.because}`);
    L.push('  └' + '─'.repeat(63));
    return L;
  }
  L.push(`  │ Reconheci por: ${aberto.comoReconheci.join(' · ')}`);
  L.push(`  │ Caso: ${s.title}`);
  L.push(`  │ Estagio do modelo: ${s.stage}   ·   ${s.nodes.length} nos, ${(s.edges || []).length} arestas`);
  L.push('  └' + '─'.repeat(63));

  // ------------------------------------------------------- estado das paginas
  L.push(...cabeca('Paginas e o que o humano fez com elas'));
  for (const p of aberto.paginas) {
    const marca = politica(p.state).glifo;
    L.push(`    ${marca} ${String(p.name || p.id).padEnd(34)} vista=${p.view || '—'}  ${p.state}`);
    if (p.because) L.push(`        ${p.because}`);
  }
  if (aberto.conflitoDeCopias)
    L.push(`    ⚠ as paginas trazem ${aberto.conflitoDeCopias.quantas} copias DIFERENTES do modelo — ` +
      'alguem colou aqui uma pagina de outro arquivo.');

  // -------------------------------------------------------------- o acordo
  const agreement = s.dossier && s.dossier.agreement;
  L.push(...cabeca('O acordo'));
  if (!agreement) {
    L.push('    (nenhum) — a vista logica ainda nao foi aprovada. A fase tecnica nao comeca.');
  } else {
    L.push(`    aprovado ${agreement.at || '(sem data)'}${agreement.by ? ' por ' + agreement.by : ''}` +
      `${agreement.candidate ? ', candidata ' + agreement.candidate : ''}`);
    L.push(`    cobre ${agreement.snapshot.nodes.length} capacidades, ${agreement.snapshot.edges.length} fluxos, ${agreement.snapshot.notes.length} nota(s)`);
    if (extra.agreement)
      L.push(extra.agreement.ok
        ? '    ✓ a projecao logica de hoje ainda bate com a aprovada'
        : `    ✗ ${extra.agreement.motivo}`);
    for (const d of (extra.agreement && extra.agreement.diferencas) || []) L.push(`        · ${d.text}`);
  }

  // ---------------------------------------------------------- as candidatas
  const d = s.dossier || {};
  if (d.candidates && d.candidates.length) {
    L.push(...cabeca('Candidatas — a escolhida e as descartadas'));
    for (const c of d.candidates) {
      const marca = c.state === 'chosen' ? '►' : '·';
      L.push(`    ${marca} ${c.name}${c.differsIn ? `   (difere em ${c.differsIn.join(', ')})` : ''}`);
      L.push(`        E1–E5: ${c.tuple.join(' | ')}`);
      if (c.because) L.push(`        ${c.because}`);
    }
    L.push('    As descartadas ficam para nao serem repropostas, e para responder "por que nao a B?".');
  }

  // ------------------------------------------------------------- os achados
  if (d.findings && d.findings.length) {
    L.push(...cabeca('Revisao de lacunas — o que foi aceito e o que foi recusado'));
    for (const a of d.findings) {
      const marca = { accepted: '+', rejected: '✗', resolved: '✓' }[a.state] || '·';
      L.push(`    ${marca} ${String(a.rule).padEnd(28)} ${a.target || ''}  ${a.note || ''}`);
    }
    const recusados = d.findings.filter(a => a.state === 'rejected');
    if (recusados.length)
      L.push(`    ${recusados.length} recusa(s) viajam ate o desenho como nota — e assim que "SPOF conhecido e aceito" sobrevive.`);
  }

  // -------------------------------------------------------- o estacionamento
  if (d.parking && d.parking.length) {
    L.push(...cabeca('Estacionamento — nomes de servico ditos cedo demais'));
    for (const e of d.parking)
      L.push(`    ${e.state === 'returned' ? '↩' : '⏸'} ${String(e.name).padEnd(12)} → ${e.capability || ''}   ${e.note || ''}`);
    const parados = d.parking.filter(e => e.state === 'parked');
    if (parados.length)
      L.push(`    ${parados.length} esperando a fase tecnica: voltam como SUGESTAO inferida contra a capacidade, para confirmar.`);
  }

  // ------------------------------------------------------------------ fatos
  if (d.facts && d.facts.length) {
    const inferidos = d.facts.filter(f => f.provenance === 'inferred');
    const naoConfirmados = d.facts.filter(f => !f.confirmed);
    L.push(...cabeca('Fatos'));
    L.push(`    ${d.facts.length} fatos · ${inferidos.length} inferido(s) · ${naoConfirmados.length} ainda sem confirmacao`);
    for (const f of naoConfirmados) L.push(`    ⚠ nao confirmado: ${f.fact}`);
  }

  return L;
}

module.exports = { briefing };
