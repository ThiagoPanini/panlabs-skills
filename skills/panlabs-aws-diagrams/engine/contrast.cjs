'use strict';
/**
 * Portão de contraste — a família A7 da rubrica (#8), rodando sobre o PLANO.
 *
 * O ponto de método está no #8 §5: o fundo efetivo de um rótulo num diagrama com
 * grupos aninhados NÃO é o fundo do canvas — é o do grupo mais interno que o
 * contém, resolvido pela pilha de z-order. Por isso a checagem mora aqui e não no
 * arquivo de tema: um tema, sozinho, não sabe sobre o que vai cair. O tema é
 * hipótese; o plano é onde ela vira número.
 *
 *   A7.1   texto            >= 4,5:1  (>= 3:1 se >= 24 px, ou >= 18,5 px em negrito)
 *   A7.2   traço            >= 3:1    REPROVA
 *   A7.2a  área sólida      >= 3:1    AVISA
 *   A7.3   cor não é o único canal
 *
 * A separação entre TRAÇO e ÁREA entrou no retorno do #13, e não é conveniência:
 * uma borda de grupo de 1,25 pt e o quadrado de 48 px de um service icon são
 * coisas diferentes para a WCAG 1.4.11, que fala das "important parts ... required
 * to understand". Achar uma linha fina de teal sobre off-white é genuinamente
 * difícil; um bloco laranja saturado sobre um azul de 10% é perfeitamente visível,
 * e a identidade dele é carregada pelo GLIFO branco de dentro — que é medido à
 * parte, contra o próprio quadrado, e não muda com o fundo.
 *
 * Tratar os dois com o mesmo limiar duro fez este protótipo condenar o tingimento
 * de subnet do draw.io, que os diagramas oficiais da AWS usam e que a ressalva do
 * A2 no #5 já autorizava. Por isso ÁREA avisa e TRAÇO reprova. O limiar de área é
 * operacionalização de engenharia, não texto da WCAG — mesma marcação que a
 * rubrica dá ao A7.4.
 *
 * ⚠️ A armadilha do #4 §3.2 vale AQUI TAMBÉM: nas formas `mxgraph.aws4.*`,
 * `strokeColor` não é a cor da borda — é a cor do GLIFO. Um validador que
 * medisse `strokeColor` contra o fundo da página num service icon estaria
 * medindo o par errado: o glifo cai sobre o quadrado da categoria, não sobre a
 * página. Os pares certos estão em `paresDe()`.
 */

// -------------------------------------------------------------- WCAG G18

function canal(c) { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }

function luminance(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return 0.2126 * canal(n >> 16 & 255) + 0.7152 * canal(n >> 8 & 255) + 0.0722 * canal(n & 255);
}

function ratio(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  if (l1 === null || l2 === null) return null;
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// -------------------------------------------------------------- style

function key(style, k) {
  const m = new RegExp('(?:^|;)' + k + '=([^;]*)').exec(style || '');
  return m ? m[1] : null;
}
const color = v => (v && /^#[0-9A-Fa-f]{6}$/.test(v)) ? v : null;

/** Limiar de texto (A7.1): 3:1 vale só para texto grande. */
function textThreshold(style) {
  const px = Number(key(style, 'fontSize') || 12);
  const negrito = (Number(key(style, 'fontStyle') || 0) & 1) === 1;
  return (px >= 24 || (negrito && px >= 18.5)) ? 3.0 : 4.5;
}

/**
 * Fundo efetivo: sobe a cadeia de pais até achar um `fillColor` opaco.
 *
 * Achado do #13: com a convenção AWS isto quase nunca dá mais de um passo —
 * A2 do #5 diz que box de grupo é `<a:noFill/>`, e o catálogo emite
 * `fillColor=none` em todos os 20 grupos. Ou seja, o fundo efetivo É o fundo da
 * página em todo lugar. A pilha de z-order que o #8 avisa só passa a importar
 * quando alguém TINGE um grupo — e o vocabulário fechado do tema não tem
 * palavra para isso. A checagem é exata por construção, não por sorte.
 */
function effectiveBackground(cel, byId, fundoPagina, pularProprio) {
  let atual = pularProprio ? byId.get(cel.parent) : cel;
  while (atual) {
    const f = color(key(atual.style, 'fillColor'));
    if (f) return { color: f, from: atual.id };
    atual = byId.get(atual.parent);
  }
  return { color: fundoPagina, from: '(página)' };
}

const ehAws4 = style => /shape=mxgraph\.aws4\./.test(style || '');
const ehIconeDeServico = style => /shape=mxgraph\.aws4\.(resourceIcon|productIcon)/.test(style || '');
const ehGrupoAws4 = style => /shape=mxgraph\.aws4\.(group|groupCenter|group2)\b/.test(style || '');

/**
 * Os pares (frente, fundo) que uma célula obriga a medir. É aqui que a
 * armadilha do `strokeColor` fica isolada num lugar só.
 */
function pairsOf(cel, byId, fundoPagina) {
  const st = cel.style || '';
  const pairs = [];
  const label = String(cel.label || '').replace(/<[^>]+>/g, '').trim();

  if (cel.kind === 'edge') {
    const halo = color(key(st, 'labelBackgroundColor'));
    const traco = color(key(st, 'strokeColor'));
    if (traco) pairs.push({ rule: 'A7.2', o_que: 'traço da aresta', frente: traco, background: fundoPagina, target: 3.0 });
    if (label) pairs.push({ rule: 'A7.1', o_que: 'rótulo da aresta', frente: color(key(st, 'fontColor')) || '#000000',
      background: halo || fundoPagina, target: textThreshold(st) });
    return pairs;
  }

  const fill = color(key(st, 'fillColor'));
  const stroke = color(key(st, 'strokeColor'));

  if (ehIconeDeServico(st)) {
    // o quadrado da categoria contra o que está atrás dele — ÁREA, portanto aviso
    const atras = effectiveBackground(cel, byId, fundoPagina, true);
    if (fill) pairs.push({ rule: 'A7.2a', o_que: 'quadrado do ícone', frente: fill, background: atras.color, target: 3.0, warning: true });
    // e o GLIFO contra o quadrado — `strokeColor` pinta o glifo (#4 §3.2)
    if (stroke && fill) pairs.push({ rule: 'A7.2', o_que: 'glifo dentro do ícone', frente: stroke, background: fill, target: 3.0 });
    // o rótulo do service icon é desenhado FORA da caixa (verticalLabelPosition=bottom):
    // ele cai sobre o pai, nunca sobre o próprio quadrado
    if (label) pairs.push({ rule: 'A7.1', o_que: 'rótulo do ícone', frente: color(key(st, 'fontColor')) || '#000000',
      background: atras.color, target: textThreshold(st) });
    return pairs;
  }

  if (ehAws4(st)) {   // grupo, ou ícone monocromático de recurso
    const atras = effectiveBackground(cel, byId, fundoPagina, true);
    const group = ehGrupoAws4(st);
    if (stroke) pairs.push({ rule: 'A7.2', o_que: group ? 'borda do grupo' : 'traço do ícone',
      frente: stroke, background: atras.color, target: 3.0 });
    // Num grupo, quem carrega a fronteira é a BORDA; o preenchimento é lavagem e
    // a WCAG 1.4.11 fala de "the important parts". Medir o tingimento contra a
    // página reprovaria um cinza-claro que não precisa ser visto — e deixaria
    // passar o que de fato importa, que é o efeito do tingimento sobre QUEM CAI
    // EM CIMA DELE. Esse efeito já é medido: entra como `fundo efetivo` dos
    // filhos. Num ícone monocromático é o contrário: `fillColor` É o traço.
    if (fill && !group) pairs.push({ rule: 'A7.2', o_que: 'traço do ícone monocromático', frente: fill, background: atras.color, target: 3.0 });
    /**
     * ⚠️ O CORTE DE Z DO RÓTULO DE GRUPO É OUTRO, e errar aqui é falso negativo.
     *
     * A borda mede contra o que está FORA (por isso `atras`, que pula o próprio
     * fill): ela é a fronteira, e o que importa é achá-la na página. O RÓTULO mede
     * contra o que está DENTRO — ele é desenhado no topo, por cima do próprio
     * preenchimento do grupo. Medi-lo contra o ancestral dá texto escuro sobre
     * grupo escuro passando com folga.
     *
     * O #18 encontrou exatamente este defeito no validador geométrico e registrou
     * no mapa: 1,00:1 na tela, 13,57:1 no relatório. Aqui ele ficou dormente
     * enquanto os 20 grupos eram `fillColor=none`; voltou a importar no instante
     * em que o tingimento de subnet voltou.
     */
    // ...e o corte vale SÓ para grupo. Num ícone monocromático, `fillColor` é o
    // GLIFO e o rótulo é desenhado abaixo da caixa (`verticalLabelPosition=bottom`),
    // sobre o pai — medi-lo contra o próprio fill dá 1,00:1 sempre, porque tinta e
    // glifo são a mesma cor do tema. A primeira versão desta correção não fez a
    // distinção e reprovou os três temas de uma vez; a suite pegou.
    const sob = group ? effectiveBackground(cel, byId, fundoPagina, false) : atras;
    if (label) pairs.push({ rule: 'A7.1', o_que: group ? 'rótulo do grupo' : 'rótulo do ícone',
      frente: color(key(st, 'fontColor')) || '#000000',
      background: color(key(st, 'labelBackgroundColor')) || sob.color, target: textThreshold(st) });
    return pairs;
  }

  // retângulo comum: bloco lógico, nota, título, subtítulo
  const atras = effectiveBackground(cel, byId, fundoPagina, true);
  if (stroke) pairs.push({ rule: 'A7.2', o_que: 'borda da caixa', frente: stroke, background: atras.color, target: 3.0 });
  if (label) pairs.push({ rule: 'A7.1', o_que: 'text', frente: color(key(st, 'fontColor')) || '#000000',
    background: fill || atras.color, target: textThreshold(st) });
  return pairs;
}

/**
 * A7.3 — cor não é o único canal (WCAG 1.4.1, nível A).
 *
 * Com a paleta AWS isto passa por CONSTRUÇÃO e vale entender por quê: além da
 * cor, grupo diferente traz traço diferente (`sysDash`/`dash`/sólido, A5 do #5)
 * e ícone diferente; serviço diferente traz stencil diferente. A checagem só
 * dispara se alguém acrescentar um canal que só existe em cor.
 */
function corNaoEUnicoCanal(celulas) {
  const assinaturas = new Map();
  for (const c of celulas) {
    const st = c.style || '';
    if (c.kind === 'edge' || !ehAws4(st)) continue;
    const fill = key(st, 'fillColor') || '-';
    const outros = [key(st, 'strokeColor') || '-', key(st, 'dashed') || '0',
      key(st, 'resIcon') || key(st, 'grIcon') || (/shape=([^;]*)/.exec(st) || [])[1] || '-'].join('|');
    if (!assinaturas.has(outros)) assinaturas.set(outros, new Set());
    assinaturas.get(outros).add(fill);
  }
  const violations = [];
  for (const [outros, fills] of assinaturas)
    if (fills.size > 1) violations.push({ rule: 'A7.3', o_que: `${fills.size} significados que diferem só no fill`, detail: outros });
  return violations;
}

// ---------------------------------------------------------------- portão

function measure(layoutPlan) {
  const fundoPagina = layoutPlan.background || '#FFFFFF';
  const byId = new Map(layoutPlan.celulas.map(c => [c.id, c]));
  const findings = [];

  for (const cel of layoutPlan.celulas) {
    if (cel.visivel === false) continue;
    for (const par of pairsOf(cel, byId, fundoPagina)) {
      const r = ratio(par.frente, par.background);
      if (r === null) continue;
      findings.push({ ...par, id: cel.id, ratio: r, passa: r >= par.target });
    }
  }
  findings.push(...corNaoEUnicoCanal(layoutPlan.celulas).map(v => ({ ...v, id: '(paleta)', ratio: null, passa: false, target: null })));

  const abaixo = findings.filter(a => !a.passa);
  const falhas = abaixo.filter(a => !a.warning);
  const avisos = abaixo.filter(a => a.warning);
  return {
    ok: falhas.length === 0,
    total: findings.length,
    falhas, avisos,
    piorTexto: Math.min(Infinity, ...findings.filter(a => a.rule === 'A7.1').map(a => a.ratio)),
    piorGrafismo: Math.min(Infinity, ...findings.filter(a => a.rule === 'A7.2').map(a => a.ratio)),
    piorArea: Math.min(Infinity, ...findings.filter(a => a.rule === 'A7.2a').map(a => a.ratio)),
    findings,
  };
}

/**
 * O portão sobre um arquivo de N PÁGINAS (#12).
 *
 * `medir` é por página porque o fundo efetivo é por página — cada `<diagram>`
 * tem o seu `background`. O #13 nunca viu isto: naquele protótipo o motor
 * produzia sempre uma página, e `gerar` chamava `medir(plano)` direto. Com o
 * #12 o mesmo arquivo passou a levar a consolidada mais uma por conta, e um
 * portão que só olhasse a primeira deixaria N−1 páginas sem guarda — o buraco
 * ficaria exatamente onde o motor cresceu.
 *
 * A dobra é conservadora de propósito: o arquivo passa se TODA página passar, e
 * o pior par do arquivo é o pior par de qualquer página.
 */
function measureAll(pages) {
  const partes = pages.map(measure);
  const min = (a, b) => Math.min(a, b);
  return {
    ok: partes.every(p => p.ok),
    total: partes.reduce((n, p) => n + p.total, 0),
    falhas: partes.flatMap(p => p.falhas),
    avisos: partes.flatMap(p => p.avisos),
    piorTexto: partes.map(p => p.piorTexto).reduce(min, Infinity),
    piorGrafismo: partes.map(p => p.piorGrafismo).reduce(min, Infinity),
    piorArea: partes.map(p => p.piorArea).reduce(min, Infinity),
    findings: partes.flatMap(p => p.findings),
    pages: partes.length,
  };
}

/** Uma linha por falha, agrupada — 40 rótulos com a mesma tinta são um problema, não 40. */
function summarize(r, quais) {
  const grupos = new Map();
  for (const f of (quais || r.falhas)) {
    const k = `${f.rule}|${f.o_que}|${f.frente}|${f.background}`;
    if (!grupos.has(k)) grupos.set(k, { ...f, quantos: 0, ids: [] });
    const g = grupos.get(k);
    g.quantos++; if (g.ids.length < 3) g.ids.push(f.id);
  }
  return [...grupos.values()].sort((a, b) => (a.ratio || 0) - (b.ratio || 0)).map(g =>
    g.ratio === null
      ? `${g.rule}  ${g.o_que} — ${g.detail}`
      : `${g.rule}  ${g.o_que}: ${g.frente} sobre ${g.background} = ${g.ratio.toFixed(2)}:1 ` +
        `(precisa ${g.target.toFixed(1)}:1) — ${g.quantos}× [${g.ids.join(', ')}${g.quantos > 3 ? ', …' : ''}]`);
}

module.exports = { measure, measureAll, summarize, ratio, luminance, pairsOf, textThreshold, effectiveBackground, key };
