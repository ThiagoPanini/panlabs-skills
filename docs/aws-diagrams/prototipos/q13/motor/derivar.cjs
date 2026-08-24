'use strict';
/**
 * Derivação: o que o motor descobre sozinho a partir do modelo.
 *
 * Tudo aqui existe para que o agente NÃO tenha de decidir. A faixa de AZ é o
 * caso exemplar: o #19 decidiu que a AZ é dimensão da subnet, nunca container,
 * e que ela vira faixa desenhada só quando a arquitetura de fato afirma
 * redundância zonal. Essa é uma regra executável — então é do motor, e o
 * modelo não tem onde escrevê-la nem como forçá-la.
 */

/** Árvore de contenção a partir da lista plana. */
function arvore(modelo) {
  const porId = new Map(modelo.nos.map(n => [n.id, n]));
  const filhos = new Map(modelo.nos.map(n => [n.id, []]));
  const raizes = [];
  for (const n of modelo.nos) {
    if (n.dentro === undefined) raizes.push(n);
    else filhos.get(n.dentro).push(n);
  }
  const pai = n => n.dentro === undefined ? null : porId.get(n.dentro);
  const ancestrais = n => { const o = []; let c = pai(n); while (c) { o.push(c); c = pai(c); } return o; };
  const profundidade = n => ancestrais(n).length;
  return { porId, filhos, raizes, pai, ancestrais, profundidade };
}

/**
 * O gatilho do #19, portado para o IR plano.
 *
 *   desenhar = ≥2 AZs distintas E algum PAPEL de subnet presente em ≥2 AZs
 *
 * O papel é escopado por VPC: "private subnet" na VPC A e na VPC B são redes
 * diferentes, e a repetição entre elas não afirma redundância zonal nenhuma.
 */
function gatilhoAz(modelo, t) {
  const subnets = modelo.nos.filter(n => n.tipo === 'subnet');
  const azs = [...new Set(subnets.map(s => s.az).filter(Boolean))].sort();
  if (azs.length < 2)
    return { desenhar: false, azs, porque: `só ${azs.length} AZ distinta declarada` };

  const vpcDe = s => (t.ancestrais(s).find(a => a.tipo === 'vpc') || {}).id;
  const porPapel = new Map();
  for (const s of subnets) {
    if (!s.az) continue;
    const k = `${vpcDe(s)}|${s.acesso || '?'}|${s.rotulo || ''}`;
    if (!porPapel.has(k)) porPapel.set(k, new Set());
    porPapel.get(k).add(s.az);
  }
  const redundantes = [...porPapel.entries()].filter(([, zs]) => zs.size >= 2);
  if (!redundantes.length)
    return { desenhar: false, azs, porque: `${azs.length} AZs, mas nenhum papel de subnet se repete entre elas` };

  return {
    desenhar: true, azs,
    porque: `${redundantes.length} papel(is) em ≥2 AZs: ` +
      redundantes.map(([k, zs]) => `${k.split('|')[0]}/${k.split('|')[1]}×${zs.size}`).join(', '),
  };
}

/**
 * Onde pendurar cada aresta.
 *
 * O #2 provou que waypoint vive no espaço do PAI da aresta e que o XSD oficial
 * erra ao chamá-lo de absoluto. Há duas saídas coerentes: parentear no ancestral
 * comum e emitir no espaço dele, ou pendurar tudo na camada raiz e emitir
 * absoluto. Escolho a segunda — com `elk.json.edgeCoords: ROOT` o próprio ELK já
 * devolve absoluto, e o #2 diz explicitamente que aí a divergência do XSD é
 * inócua. Uma regra, um sistema de coordenadas, nenhuma conversão.
 */
function paiDaAresta() { return '1'; }

/** Ancestral comum mais próximo — não usado para parentear, mas o layout precisa saber. */
function ancestralComum(a, b, t) {
  const ca = new Set([a.id, ...t.ancestrais(a).map(n => n.id)]);
  for (const n of [b, ...t.ancestrais(b)]) if (ca.has(n.id)) return n;
  return null;
}

function derivar(modelo) {
  const t = arvore(modelo);
  const az = gatilhoAz(modelo, t);

  // Faixas de AZ nunca vêm do modelo — são construídas aqui, uma por zona,
  // e a caixa de cada uma é a união dos membros (o #19 mostrou a assimetria
  // se resolver sozinha: a zona que tem menos membros encolhe).
  const faixasAz = az.desenhar
    ? az.azs.map(z => ({
        id: `az-${z}`,
        derivada: true,
        rotulo: `Availability Zone · ${z}`,
        membros: modelo.nos.filter(n => n.az === z).map(n => n.id),
      }))
    : [];

  const arestas = (modelo.arestas || []).map((a, i) => ({
    ...a,
    id: a.id || `e-${a.de}-${a.para}${i}`,
    pai: paiDaAresta(),
    comum: ancestralComum(t.porId.get(a.de), t.porId.get(a.para), t),
  }));

  return { t, az, faixasAz, arestas, faixas: modelo.faixas || [] };
}

module.exports = { derivar, arvore, gatilhoAz, ancestralComum };
