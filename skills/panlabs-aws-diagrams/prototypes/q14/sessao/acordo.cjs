'use strict';
/**
 * O acordo — a aprovacao da vista logica virada fato conferivel.
 *
 * A premissa 2 do #1 poe a aprovacao ENTRE as duas fases, e chama a progressao
 * de coracao do produto. O que este arquivo faz e recusar que essa aprovacao
 * seja um booleano.
 *
 *   `aprovado: true` sobrevive a tudo. Voce aprova a vista logica, a sessao
 *   seguinte elabora tecnicamente, alguem acrescenta uma capacidade que nunca
 *   foi discutida, e o booleano continua dizendo sim. O diagrama tecnico sai com
 *   o carimbo de aprovado por cima de uma arquitetura que ninguem aprovou.
 *
 * O acordo guarda o RECORTE da projecao logica aprovada. Reconferir e reprojetar
 * o modelo de hoje e comparar. Se bate, a elaboracao tecnica e fiel; se nao
 * bate, a diferenca sai no vocabulario da conversa — "voce aprovou 12
 * capacidades, o modelo tecnico serve 11" — e nao em hash contra hash.
 */

const { projetar, recorteDoAcordo } = require('./projetar.cjs');
const { impressaoDoAcordo, canonicalizar } = require('./impressao.cjs');

/** Sela a aprovacao no dossie. Nao muda mais nada do modelo. */
function aprovar(sessao, quem = {}) {
  const { modelo } = projetar(sessao, 'logica');
  const recorte = recorteDoAcordo(modelo);
  const saida = JSON.parse(JSON.stringify(sessao));
  saida.dossie = saida.dossie || {};
  saida.dossie.acordo = {
    vista: 'logica',
    impressao: impressaoDoAcordo(recorte),
    recorte,
    ...(quem.em ? { em: quem.em } : {}),
    ...(quem.por ? { por: quem.por } : {}),
    ...(quem.candidata ? { candidata: quem.candidata } : {}),
  };
  return saida;
}

/**
 * O modelo de hoje ainda serve o que foi aprovado?
 *
 * Esta e a rastreabilidade que o #14 temia perder ao usar um IR so. Com dois
 * modelos ligados por mapeamento, responder isto exige que o mapeamento esteja
 * certo — e nada garante que esteja. Com um IR, a resposta e uma projecao e uma
 * comparacao de strings.
 */
function conferir(sessao) {
  const acordo = sessao.dossie && sessao.dossie.acordo;
  if (!acordo) return { ok: false, motivo: 'sem acordo', diferencas: [] };

  const { modelo } = projetar(sessao, 'logica');
  const agora = recorteDoAcordo(modelo);
  const impressao = impressaoDoAcordo(agora);
  if (impressao === acordo.impressao) return { ok: true, impressao, diferencas: [] };

  return { ok: false, motivo: 'a projecao logica de hoje difere da aprovada', impressao,
    esperada: acordo.impressao, diferencas: diferencaDoRecorte(acordo.recorte, agora) };
}

/** A diferenca no vocabulario da conversa, nao no do XML. */
function diferencaDoRecorte(antes, depois) {
  const out = [];
  const porId = l => new Map((l || []).map(x => [x.id, x]));
  const a = porId(antes.nos), d = porId(depois.nos);

  for (const [id, n] of a) if (!d.has(id))
    out.push({ o: 'capacidade', tipo: 'sumiu', id, texto: `"${n.rotulo || id}" foi aprovada e o modelo tecnico nao a serve` });
  for (const [id, n] of d) if (!a.has(id))
    out.push({ o: 'capacidade', tipo: 'apareceu', id, texto: `"${n.rotulo || id}" nao estava na vista aprovada` });
  for (const [id, n] of d) {
    const v = a.get(id); if (!v) continue;
    if (v.rotulo !== n.rotulo) out.push({ o: 'capacidade', tipo: 'rotulo', id, texto: `"${v.rotulo}" virou "${n.rotulo}"` });
    if (v.dentro !== n.dentro) out.push({ o: 'capacidade', tipo: 'fronteira', id, texto: `"${v.rotulo || id}" mudou de fronteira: ${v.dentro || '(raiz)'} → ${n.dentro || '(raiz)'}` });
    if (v.tipo !== n.tipo) out.push({ o: 'capacidade', tipo: 'tipo', id, texto: `"${v.rotulo || id}" mudou de tipo: ${v.tipo} → ${n.tipo}` });
  }

  const chave = e => `${e.de}→${e.para}`;
  const ea = new Map((antes.arestas || []).map(e => [chave(e), e]));
  const ed = new Map((depois.arestas || []).map(e => [chave(e), e]));
  for (const [k, e] of ea) if (!ed.has(k)) out.push({ o: 'fluxo', tipo: 'sumiu', id: k, texto: `o fluxo ${k} ("${e.rotulo || ''}") foi aprovado e nao existe mais` });
  for (const [k, e] of ed) if (!ea.has(k)) out.push({ o: 'fluxo', tipo: 'apareceu', id: k, texto: `o fluxo ${k} ("${e.rotulo || ''}") nao estava na vista aprovada` });
  for (const [k, e] of ed) {
    const v = ea.get(k); if (!v) continue;
    if (v.rotulo !== e.rotulo) out.push({ o: 'fluxo', tipo: 'rotulo', id: k, texto: `${k}: "${v.rotulo}" virou "${e.rotulo}"` });
    if ((v.dados || 'ida') !== (e.dados || 'ida')) out.push({ o: 'fluxo', tipo: 'sentido', id: k, texto: `${k}: sentido do dado ${v.dados || 'ida'} → ${e.dados || 'ida'}` });
  }

  const na = new Set((antes.notas || []).map(canonicalizar));
  const nd = new Set((depois.notas || []).map(canonicalizar));
  for (const n of na) if (!nd.has(n)) out.push({ o: 'nota', tipo: 'sumiu', id: n.slice(0, 40), texto: `uma nota aprovada sumiu — se for a do achado recusado, o desenho volta a enganar calado (#15 §4)` });
  for (const n of nd) if (!na.has(n)) out.push({ o: 'nota', tipo: 'apareceu', id: n.slice(0, 40), texto: 'nota nova na vista logica' });

  return out;
}

module.exports = { aprovar, conferir, diferencaDoRecorte };
