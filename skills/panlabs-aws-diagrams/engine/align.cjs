'use strict';
/**
 * Alinhamento — o passe que tira o "quase".
 *
 * Um desalinhamento de 13 px entre dois nós ligados por uma aresta não lê como
 * escolha: lê como erro. Ou os dois estão na mesma faixa, ou estão claramente
 * em faixas diferentes; o meio-termo é o que faz um desenho parecer descuidado.
 *
 * Por que aqui e não no ELK: **não achei alavanca no ELK que faça isso.**
 * Medidos e inertes em `elkjs` 0.12.0 — `priority.straightness` (por aresta),
 * `elk.margins` (por nó), `nodePlacement.favorStraightEdges`. As variantes de
 * `nodePlacement.bk.fixedAlignment` funcionam mas escolhem OUTRO vizinho para
 * alinhar; nenhuma zera a diferença. Como o motor já é dono de 100% da
 * geometria (#2 §8 — é por isso que `childLayout` é proibido), fazer o encaixe
 * aqui é coerente com o contrato, não uma gambiarra em volta dele.
 *
 * O passe é conservador de propósito:
 *   - só encosta em desalinhamento PEQUENO (≤ SNAP). Grande é intencional.
 *   - move a COLUNA inteira, nunca um nó solto, para não comer o vão do vizinho.
 *   - se o resultado sobrepõe qualquer coisa, DESFAZ. Melhor um "quase" do que
 *     um diagrama errado.
 */

const SNAP = 30;         // acima disso o desalinhamento é deliberado
const MAX_PASSES = 4;

/** Índice plano da saída do ELK, com posição absoluta e ponteiro para o pai. */
function indexar(saida) {
  const nodes = new Map();
  (function andar(n, paiId, ox, oy) {
    for (const c of n.children || []) {
      nodes.set(c.id, {
        no: c, paiId,
        x: ox + c.x, y: oy + c.y, w: c.width, h: c.height,
        folha: !(c.children && c.children.length),
      });
      andar(c, c.id, ox + c.x, oy + c.y);
    }
  })(saida, null, 0, 0);
  return nodes;
}

const cy = r => r.y + r.h / 2;

/** Irmãos que compartilham a mesma coluna (mesmo x) dentro do mesmo pai. */
function coluna(nodes, target) {
  const a = nodes.get(target);
  const out = [];
  for (const [id, r] of nodes) if (r.paiId === a.paiId && r.folha && Math.abs(r.x - a.x) < 1) out.push(id);
  return out;
}

/**
 * Qualquer par de irmãos se sobrepondo, ou filho estourando o pai.
 *
 * ⚠️ AS QUATRO BORDAS, e as duas de cima chegaram no #26 — o corpus achou.
 *
 * A versão anterior media só `bottom` e `right`, e a assimetria não era decisão:
 * o passe nasceu movendo coluna para BAIXO (o `delta` do primeiro caso medido
 * era positivo), e um filho que desce só pode sair pelo pé do pai. Mas `delta` é
 * `cy(u) − cy(v)` e é negativo com a mesma frequência — aí a coluna sobe, e
 * subir sem guarda passa por cima da faixa de título do container.
 *
 * O `events-fanout` do corpus do #26 faz exatamente isso: três encaixes
 * seguidos de −13, −27 e −6 px empurram a coluna das filas mortas 46 px acima do
 * lugar dela, e `dlq-estoque` acaba 7 px ACIMA do topo da própria região. O
 * desenho passa a afirmar que a fila morta não está na região — que é `A4.4`,
 * falha SEMÂNTICA, o desenho afirmando o que o modelo nega.
 *
 * É o padrão que o #23 nomeou uma volta acima: **a checagem que não sabe
 * falhar**. O cabeçalho deste arquivo promete "se o resultado sobrepõe qualquer
 * coisa, DESFAZ", e a promessa era cega em dois dos quatro lados. `refitar` não
 * cobre a diferença nem por acidente: ele só CRESCE o container (`Math.max`), e
 * crescer resolve quem passa do pé, nunca quem sai pelo topo.
 */
function temSobreposicao(saida, paddings) {
  const nodes = indexar(saida);
  const porPai = new Map();
  for (const [id, r] of nodes) {
    if (!porPai.has(r.paiId)) porPai.set(r.paiId, []);
    porPai.get(r.paiId).push({ id, ...r });
  }
  for (const [paiId, irmaos] of porPai) {
    for (let i = 0; i < irmaos.length; i++)
      for (let j = i + 1; j < irmaos.length; j++) {
        const a = irmaos[i], b = irmaos[j];
        if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) return `${a.id}×${b.id}`;
      }
    if (paiId === null) continue;
    const p = nodes.get(paiId);
    const pad = paddings.get(paiId) || { top: 0, left: 0, bottom: 0, right: 0 };
    for (const c of irmaos) {
      if (c.y + c.h > p.y + p.h - pad.bottom + 0.5) return `${c.id} estoura ${paiId}`;
      if (c.x + c.w > p.x + p.w - pad.right + 0.5) return `${c.id} estoura ${paiId} (x)`;
      if (c.y < p.y + pad.top - 0.5) return `${c.id} sai pelo topo de ${paiId}`;
      if (c.x < p.x + pad.left - 0.5) return `${c.id} sai pela esquerda de ${paiId}`;
    }
  }
  return null;
}

/** Cresce cada container para caber os filhos, de baixo para cima. */
function refitar(saida, paddings) {
  (function sobe(n) {
    for (const c of n.children || []) sobe(c);
    if (!n.children || !n.children.length || n.id === 'root') return;
    const pad = paddings.get(n.id) || { bottom: 0, right: 0 };
    const precisaH = Math.max(...n.children.map(c => c.y + c.height)) + pad.bottom;
    const precisaW = Math.max(...n.children.map(c => c.x + c.width)) + pad.right;
    n.height = Math.max(n.height, precisaH);
    n.width = Math.max(n.width, precisaW);
  })(saida);
}

/**
 * Reescreve o traçado de uma aresta cujos extremos deixaram de estar onde o ELK
 * os deixou. Só dois casos, e ambos ortogonais por construção:
 * reto quando os centros coincidem, Z no meio do vão quando não.
 */
function rerrotear(sec, u, v) {
  const uy = cy(u), vy = cy(v);
  const paraDireita = u.x + u.w <= v.x;
  const xs = paraDireita ? u.x + u.w : u.x;
  const xe = paraDireita ? v.x : v.x + v.w;
  sec.startPoint = { x: xs, y: uy };
  sec.endPoint = { x: xe, y: vy };
  sec.bendPoints = Math.abs(uy - vy) < 0.5 ? [] : [{ x: (xs + xe) / 2, y: uy }, { x: (xs + xe) / 2, y: vy }];
}

/**
 * @returns {{aplicados: Array, desfeitos: Array}}
 */
function alinhar(saida, paddings) {
  const aplicados = [], desfeitos = [];

  for (let passe = 0; passe < MAX_PASSES; passe++) {
    const nodes = indexar(saida);

    // candidatos: aresta entre duas folhas, quase alinhadas, em colunas distintas
    const cands = [];
    for (const e of saida.edges || []) {
      const u = nodes.get(e.sources[0]), v = nodes.get(e.targets[0]);
      if (!u || !v || !u.folha || !v.folha) continue;
      if (Math.abs(u.x - v.x) < 1) continue;                 // mesma coluna: não é faixa
      const delta = cy(u) - cy(v);
      if (Math.abs(delta) > 0.5 && Math.abs(delta) <= SNAP) cands.push({ e, delta });
    }
    if (!cands.length) break;
    cands.sort((a, b) => a.e.id < b.e.id ? -1 : 1);          // determinismo
    const { e, delta } = cands[0];

    // mover a coluna inteira do alvo, preservando os vãos internos dela
    const alvos = coluna(nodes, e.targets[0]);
    const antes = alvos.map(id => ({ id, y: nodes.get(id).no.y }));
    for (const id of alvos) nodes.get(id).no.y += delta;

    const alturasAntes = [];
    (function guarda(n) { alturasAntes.push([n, n.width, n.height]); for (const c of n.children || []) guarda(c); })(saida);
    refitar(saida, paddings);

    const problema = temSobreposicao(saida, paddings);
    if (problema) {
      for (const a of antes) nodes.get(a.id).no.y = a.y;
      for (const [n, w, h] of alturasAntes) { n.width = w; n.height = h; }
      desfeitos.push({ aresta: e.id, delta: Math.round(delta), because: problema });
      break;                       // um encaixe que não cabe encerra o passe
    }

    // as pontas mudaram de lugar: o traçado do ELK não vale mais para quem tocou
    const movidos = new Set(alvos);
    const depois = indexar(saida);
    for (const outra of saida.edges || []) {
      const su = outra.sources[0], sv = outra.targets[0];
      if (!movidos.has(su) && !movidos.has(sv)) continue;
      const u = depois.get(su), v = depois.get(sv);
      if (!u || !v) continue;
      const sec = (outra.sections || [])[0];
      if (!sec) continue;
      if (movidos.has(su) && movidos.has(sv)) {              // a aresta inteira desceu junto
        sec.startPoint.y += delta; sec.endPoint.y += delta;
        for (const p of sec.bendPoints || []) p.y += delta;
      } else {
        rerrotear(sec, u, v);
      }
    }
    aplicados.push({ aresta: e.id, delta: Math.round(delta), moveu: alvos });
  }

  return { aplicados, desfeitos };
}

module.exports = { alinhar, SNAP, indexar };
