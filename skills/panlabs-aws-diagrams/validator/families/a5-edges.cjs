'use strict';
/**
 * A5 · Roteamento de arestas.
 *
 * Aqui mora a estética com maior efeito medido da literatura inteira — Purchase
 * 1997: "reducing the number of edge crosses is by far the most important
 * aesthetic" — e mora também A5.5, que não é estética nenhuma: uma aresta que
 * corta uma VPC alheia desenha um caminho de rede que não existe.
 *
 * As métricas normalizadas seguem a convenção da rubrica, herdada de GD 2025:
 * **1 = melhor**. Vale para EC, CA, EO e ELD.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometry.cjs'));
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, warning, failure, notApplicable, matches, pairs, mean, roundTo } = require(path.join(__dirname, 'common.cjs'));

/** Todos os pontos de cruzamento entre duas polilinhas, ignorando incidências. */
function crossingsBetween(a, b) {
  const findings = [];
  for (let i = 0; i + 1 < a.pontos.length; i++)
    for (let j = 0; j + 1 < b.pontos.length; j++) {
      const p = g.crossing(a.pontos[i], a.pontos[i + 1], b.pontos[j], b.pontos[j + 1]);
      if (p) findings.push({ ponto: p, angulo: g.anguloEntre(a.pontos[i], a.pontos[i + 1], b.pontos[j], b.pontos[j + 1]) });
    }
  return findings;
}

module.exports = function a5(scene) {
  const output = [];
  const edges = scene.edges.filter(a => a.completa);
  const semAresta = id => output.push(notApplicable(id, 'o diagrama não tem arestas'));

  if (!edges.length) {
    for (const id of ['A5.1', 'A5.2', 'A5.3', 'A5.4', 'A5.5', 'A5.6', 'A5.7', 'A5.8', 'A5.9']) semAresta(id);
    return output;
  }

  const grau = scene.grau;   // a cena monta uma vez; A6.1 e A8.3 leem o mesmo mapa

  // ------------------------------------------------- cruzamentos, uma vez só
  const cruzes = [];
  for (const [a, b] of pairs(edges)) {
    if (a.from === b.from || a.from === b.to || a.to === b.from || a.to === b.to) continue;  // incidência
    for (const c of crossingsBetween(a, b)) cruzes.push({ ...c, a: a.id, b: b.id });
  }

  // ---------------------------------------------------------------- A5.1
  {
    const E = edges.length;
    const somaGraus = [...grau.values()].reduce((s, d) => s + (d * (d - 1)) / 2, 0);
    const cMax = Math.max(1, (E * (E - 1)) / 2 - somaGraus);

    // A rubrica escreve `c = Σ_x |E(x)|²`, e essa forma NÃO normaliza contra o
    // `c_max` que ela mesma dá: um único cruzamento simples tem |E(x)| = 2,
    // logo c = 4, e com duas arestas (c_max = 1) o EC sairia −3, fora de [0,1].
    // O `c_max = C(|E|,2) − Σ_v C(deg(v),2)` é a contagem máxima de PARES que
    // podem se cruzar, então o numerador tem de ser em pares também. Onde k
    // arestas passam pelo mesmo ponto, o par correspondente é C(k,2) — que
    // vira a contagem simples quando não há três arestas concorrentes.
    const porPonto = new Map();
    for (const c of cruzes) {
      const key = `${Math.round(c.ponto.x)},${Math.round(c.ponto.y)}`;
      if (!porPonto.has(key)) porPonto.set(key, new Set());
      porPonto.get(key).add(c.a).add(c.b);
    }
    const c = [...porPonto.values()].reduce((soma, arestasNoPonto) => {
      const k = arestasNoPonto.size;
      return soma + (k * (k - 1)) / 2;
    }, 0);
    const EC = roundTo(1 - c / cMax);
    const budget = Math.ceil(E / 10);
    const measured = { cruzamentos: cruzes.length, c_em_pares: c, EC, orcamento_de_falha: budget, c_max: cMax };
    const occurrences = cruzes.map(c => ({ o_que: `"${c.a}" cruza "${c.b}" em (${roundTo(c.ponto.x, 0)}, ${roundTo(c.ponto.y, 0)}) a ${roundTo(c.angulo, 1)}°`, ids: [c.a, c.b] }));
    output.push(!cruzes.length ? ok('A5.1', { measured, mensagem: `0 cruzamentos, EC = ${EC}` })
      : cruzes.length > budget ? failure('A5.1', { measured, mensagem: `${cruzes.length} cruzamentos, acima do orçamento de ⌈${E}/10⌉ = ${budget}`, occurrences })
        : warning('A5.1', { measured, mensagem: `${cruzes.length} cruzamento(s), EC = ${EC} (alvo 0)`, occurrences }));
  }

  // ---------------------------------------------------------------- A5.2
  {
    if (!cruzes.length) output.push(notApplicable('A5.2', 'não há cruzamento para medir o ângulo'));
    else {
      const CA = roundTo(1 - mean(cruzes.map(c => Math.abs((90 - c.angulo) / 90))));
      const minAngulo = roundTo(Math.min(...cruzes.map(c => c.angulo)), 1);
      const floor = lim('anguloDeCruzamentoMinimo');
      const q1 = lim('anguloDeCruzamentoQ1');
      const measured = { CA, angulo_minimo: minAngulo, ideal: lim('anguloDeCruzamentoIdeal') };
      const rasos = cruzes.filter(c => c.angulo < floor)
        .map(c => ({ o_que: `"${c.a}" e "${c.b}" cruzam a ${roundTo(c.angulo, 1)}° (piso ${floor}°)`, ids: [c.a, c.b] }));
      output.push(rasos.length ? failure('A5.2', { measured, mensagem: `cruzamento a ${minAngulo}°, abaixo do piso de ${floor}°`, occurrences: rasos })
        : CA < q1 ? warning('A5.2', { measured, mensagem: `CA = ${CA} < ${q1} (Q1)`, occurrences: [{ o_que: `menor ângulo ${minAngulo}°, ideal ${lim('anguloDeCruzamentoIdeal')}°`, ids: [] }] })
          : ok('A5.2', { measured, mensagem: `CA = ${CA}, menor ângulo ${minAngulo}°` }));
    }
  }

  // ---------------------------------------------------------------- A5.3
  {
    const target = lim('dobrasAlvo');
    const ceiling = lim('dobrasAviso');
    const pisoDeFalha = lim('dobrasFalha');
    const count = edges.map(a => ({ id: a.id, dobras: Math.max(0, a.pontos.length - 2) }));
    const maximo = Math.max(...count.map(c => c.dobras));
    const measured = { maximo, mean: roundTo(mean(count.map(c => c.dobras)), 2), target, warning: ceiling, failure: pisoDeFalha };
    const graves = count.filter(c => c.dobras > pisoDeFalha).map(c => ({ o_que: `"${c.id}" tem ${c.dobras} dobras (falha acima de ${pisoDeFalha})`, ids: [c.id] }));
    const passou = count.filter(c => c.dobras > ceiling && c.dobras <= pisoDeFalha).map(c => ({ o_que: `"${c.id}" tem ${c.dobras} dobras (alvo ≤ ${target})`, ids: [c.id] }));
    output.push(graves.length ? failure('A5.3', { measured, mensagem: `${graves.length} aresta(s) com mais de ${pisoDeFalha} dobras`, occurrences: graves })
      : passou.length ? warning('A5.3', { measured, mensagem: `${passou.length} aresta(s) acima de ${ceiling} dobras`, occurrences: passou })
        : ok('A5.3', { measured, mensagem: `no máximo ${maximo} dobra(s) por aresta` }));
  }

  // ---------------------------------------------------------------- A5.4
  {
    const target = lim('anguloDeDobraAlvo');
    const floor = lim('anguloDeDobraFalha');
    const angulos = [];
    for (const a of edges)
      for (let i = 1; i + 1 < a.pontos.length; i++)
        angulos.push({ id: a.id, angulo: g.anguloInterno(a.pontos[i - 1], a.pontos[i], a.pontos[i + 1]) });
    if (!angulos.length) output.push(notApplicable('A5.4', 'nenhuma aresta tem dobra'));
    else {
      const menor = Math.min(...angulos.map(x => x.angulo));
      const measured = { angulo_minimo: roundTo(menor, 1), target, floor, dobras: angulos.length };
      const agudas = angulos.filter(x => x.angulo < floor).map(x => ({ o_que: `"${x.id}" dobra a ${roundTo(x.angulo, 1)}° (piso ${floor}°)`, ids: [x.id] }));
      const brandas = angulos.filter(x => x.angulo >= floor && x.angulo < target).map(x => ({ o_que: `"${x.id}" dobra a ${roundTo(x.angulo, 1)}° (alvo ${target}°)`, ids: [x.id] }));
      output.push(agudas.length ? failure('A5.4', { measured, mensagem: `dobra de ${roundTo(menor, 1)}°, abaixo do piso de ${floor}°`, occurrences: agudas })
        : brandas.length ? warning('A5.4', { measured, mensagem: `${brandas.length} dobra(s) abaixo de ${target}°`, occurrences: brandas })
          : ok('A5.4', { measured, mensagem: `menor dobra ${roundTo(menor, 1)}°` }));
    }
  }

  // ---------------------------------------------------------------- A5.5
  // Fronteira ESPÚRIA. O grupo entra na conta quando não contém nenhuma das
  // duas pontas e não é ancestral comum das duas — aí a aresta está riscando
  // uma fronteira de rede com a qual ela não tem relação nenhuma.
  {
    const casos = [];
    for (const a of edges) {
      for (const group of scene.grupos) {
        const deDentro = a.from === group.id || scene.ehDescendente(a.from, group.id);
        const paraDentro = a.to === group.id || scene.ehDescendente(a.to, group.id);
        if (deDentro || paraDentro) continue;                 // a aresta é dali, ou vai para lá
        if (g.polilinhaCruzaRetangulo(a.pontos, group.cellBox))
          casos.push({
            o_que: `a aresta "${a.id}" (${a.from}→${a.to}) atravessa o grupo "${group.id}", ` +
              `de onde não sai nem para onde vai — o desenho sugere um caminho de rede que não existe`,
            ids: [a.id, group.id],
          });
      }
    }
    output.push(matches('A5.5', casos, {
      measured: { edges: edges.length, grupos: scene.grupos.length, travessias_espurias: casos.length },
      mensagem: casos.length ? `${casos.length} travessia(s) de fronteira alheia — tolerância é zero` : 'nenhuma aresta corta grupo alheio',
    }));
  }

  // ---------------------------------------------------------------- A5.6
  {
    const ortogonal = edges.filter(a => a.style.edgeStyle === 'orthogonalEdgeStyle').length > edges.length / 2;
    const desvios = [];
    for (const a of edges) {
      let somaPeso = 0;
      let soma = 0;
      for (let i = 0; i + 1 < a.pontos.length; i++) {
        const dx = a.pontos[i + 1].x - a.pontos[i].x;
        const dy = a.pontos[i + 1].y - a.pontos[i].y;
        const comp = Math.hypot(dx, dy);
        if (comp < g.EPS) continue;
        const ang = Math.abs(Math.atan2(dy, dx) * 180 / Math.PI) % 90;
        soma += comp * (Math.min(ang, 90 - ang) / 45);
        somaPeso += comp;
      }
      if (somaPeso > 0) desvios.push(soma / somaPeso);
    }
    const EO = roundTo(1 - mean(desvios));
    const target = lim('ortogonalidadeAlvo');
    const q1 = lim('ortogonalidadeQ1');
    const measured = { EO, style: ortogonal ? 'ortogonal' : 'reto', target: ortogonal ? target : q1 };
    output.push(ortogonal
      ? (EO >= target ? ok('A5.6', { measured, mensagem: `EO = ${EO} ≥ ${target}` })
        : warning('A5.6', { measured, mensagem: `estilo ortogonal declarado e EO = ${EO} < ${target}`, occurrences: [{ o_que: 'há segmentos fora dos eixos num roteamento que se diz ortogonal', ids: [] }] }))
      : (EO >= q1 ? ok('A5.6', { measured, mensagem: `EO = ${EO}` })
        : warning('A5.6', { measured, mensagem: `EO = ${EO} < ${q1} — mistura desordenada de ângulos`, occurrences: [{ o_que: 'nem ortogonal nem consistentemente reto', ids: [] }] })));
  }

  // ---------------------------------------------------------------- A5.7
  {
    const minimo = lim('fluxoConsistenteMinimo');
    const vetores = edges.map(a => {
      const o = scene.byElement.get(a.from);
      const d = scene.byElement.get(a.to);
      return { id: a.id, dx: g.centro(d.cellBox).x - g.centro(o.cellBox).x, dy: g.centro(d.cellBox).y - g.centro(o.cellBox).y };
    });
    // A rubrica manda ignorar as perpendiculares ao eixo (±15°) e escolher UM
    // eixo dominante; medimos os dois e ficamos com o que o desenho de fato usa.
    const measure = (eixo) => {
      const usados = vetores.filter(v => {
        const ang = Math.abs(Math.atan2(v.dy, v.dx) * 180 / Math.PI);
        const desvioDoEixo = eixo === 'x' ? Math.min(ang, 180 - ang) : Math.abs(90 - ang);
        return desvioDoEixo <= 75;
      });
      const positivos = usados.filter(v => (eixo === 'x' ? v.dx : v.dy) > 0);
      return { eixo, considerados: usados.length, flow: usados.length ? positivos.length / usados.length : 0, contramao: usados.filter(v => (eixo === 'x' ? v.dx : v.dy) <= 0) };
    };
    const candidatos = [measure('x'), measure('y')].filter(m => m.considerados);
    if (!candidatos.length) output.push(notApplicable('A5.7', 'nenhuma aresta tem projeção clara num eixo'));
    else {
      const melhor = candidatos.sort((a, b) => b.flow - a.flow || b.considerados - a.considerados)[0];
      const flow = roundTo(melhor.flow);
      const measured = { eixo: melhor.eixo === 'x' ? 'esquerda→direita' : 'cima→baixo', flow, consideradas: melhor.considerados, minimo };
      output.push(flow >= minimo ? ok('A5.7', { measured, mensagem: `${roundTo(flow * 100, 0)}% das arestas seguem ${measured.eixo}` })
        : warning('A5.7', {
          measured,
          mensagem: `só ${roundTo(flow * 100, 0)}% seguem ${measured.eixo} (mínimo ${roundTo(minimo * 100, 0)}%)`,
          occurrences: melhor.contramao.map(v => ({ o_que: `"${v.id}" vai na contramão do fluxo dominante`, ids: [v.id] })),
        }));
    }
  }

  // ---------------------------------------------------------------- A5.8
  {
    const separation = lim('separacaoDeArestasParalelas');
    const casos = [];
    const byPair = new Map();
    for (const a of edges) {
      const key = [a.from, a.to].sort().join('|');
      if (!byPair.has(key)) byPair.set(key, []);
      byPair.get(key).push(a);
    }
    for (const a of edges)
      if (a.polylineLength < g.EPS) casos.push({ o_que: `a aresta "${a.id}" tem comprimento zero`, ids: [a.id] });
    for (const list of byPair.values())
      for (const [a, b] of pairs(list)) {
        const d = g.hausdorff(a.pontos, b.pontos);
        if (d < separation) casos.push({ o_que: `"${a.id}" e "${b.id}" ligam o mesmo par e correm a ${roundTo(d, 1)} px (mínimo ${separation})`, ids: [a.id, b.id] });
      }
    output.push(matches('A5.8', casos, { measured: { pares_com_multiplas_arestas: [...byPair.values()].filter(l => l.length > 1).length, coladas: casos.length } }));
  }

  // ---------------------------------------------------------------- A5.9
  // A rubrica pede o cálculo SEPARADO por classe de aresta: num diagrama com
  // grupos aninhados, intra-grupo e inter-grupo têm comprimentos naturalmente
  // diferentes, e misturar as duas populações reprova o desenho correto.
  {
    const q1 = lim('uniformidadeDeComprimentoQ1');
    const classeDe = a => {
      const pa = scene.ancestrais(a.from).map(x => x.id);
      const pb = scene.ancestrais(a.to).map(x => x.id);
      return pa[0] && pa[0] === pb[0] ? 'intra-grupo' : 'inter-grupo';
    };
    const porClasse = new Map();
    for (const a of edges) {
      const c = classeDe(a);
      if (!porClasse.has(c)) porClasse.set(c, []);
      porClasse.get(c).push(a);
    }
    const byMeasure = {};
    const casos = [];
    for (const [classe, list] of porClasse) {
      if (list.length < 2) { byMeasure[classe] = { edges: list.length, ELD: null }; continue; }
      const comps = list.map(a => a.polylineLength);
      const ideal = mean(comps);
      const ELD = roundTo(1 / (1 + mean(comps.map(c => Math.abs(c - ideal) / ideal))));
      byMeasure[classe] = { edges: list.length, ELD };
      if (ELD < q1) casos.push({ o_que: `arestas ${classe}: ELD = ${ELD} < ${q1} (Q1)`, ids: list.map(a => a.id) });
    }
    output.push(matches('A5.9', casos, { measured: { por_classe: byMeasure, Q1: q1 } }));
  }

  return output;
};
