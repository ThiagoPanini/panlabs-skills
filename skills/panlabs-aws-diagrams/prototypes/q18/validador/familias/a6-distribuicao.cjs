'use strict';
/**
 * A6 · Distribuição e forma global.
 *
 * Última na ordem de prioridade da rubrica, junto com A8, e ela diz por quê:
 * "ajuste fino; limiares menos firmes". Três das cinco reportam métrica de
 * Mooney et al. (GD 2025) contra o Q1 de desenhos de especialista — são régua
 * de comparação, não reprovação.
 *
 * A6.5 é a mais fraca de todas, e a própria rubrica avisa: "em diagrama de
 * arquitetura, posição é ditada por grupos (VPC/AZ), não por distância de
 * grafo. Baixa prioridade; provavelmente ruído." Fica implementada e medida,
 * com o aviso ao lado do número — o custo de calcular é baixo e o de esconder
 * uma métrica que a rubrica listou é ficar sem saber que ela era ruído mesmo.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometria.cjs'));
const { lim } = require(path.join(__dirname, '..', 'indice.cjs'));
const { ok, aviso, falha, inaplicavel, pares, media, arredonda } = require(path.join(__dirname, 'comum.cjs'));

/** Distâncias de grafo por BFS, a partir de um nó. */
function bfs(inicio, vizinhos) {
  const d = new Map([[inicio, 0]]);
  const fila = [inicio];
  while (fila.length) {
    const atual = fila.shift();
    for (const v of vizinhos.get(atual) || [])
      if (!d.has(v)) { d.set(v, d.get(atual) + 1); fila.push(v); }
  }
  return d;
}

module.exports = function a6(cena) {
  const saida = [];
  const { nos, arestas, canvas } = cena;
  const centros = new Map(nos.map(n => [n.id, g.centro(n.caixa)]));

  // ---------------------------------------------------------------- A6.1
  {
    // O ângulo com que uma aresta SAI de um nó só é um fato do desenho quando a
    // âncora foi declarada. Sem âncora, a cena projeta a ponta no perímetro em
    // direção ao alvo, e duas arestas que vão para o mesmo lado saem do mesmo
    // ponto no mesmo ângulo — artefato da reconstrução, não do diagrama. O
    // mxGraph desencosta as duas em tempo de render (`jettySize=auto`).
    // Então: `fail` só onde há âncora declarada; sem ela, `aviso` com a ressalva.
    const incidentes = new Map();
    let algumSemAncora = false;
    for (const a of arestas.filter(x => x.completa)) {
      if (!a.ancorada) algumSemAncora = true;
      const registra = (quem, p1, p2) => {
        if (!centros.has(quem)) return;
        if (!incidentes.has(quem)) incidentes.set(quem, []);
        incidentes.get(quem).push({ angulo: Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI, ancorada: !!a.ancorada });
      };
      registra(a.de, a.pontos[0], a.pontos[1] || a.pontos[0]);
      registra(a.para, a.pontos[a.pontos.length - 1], a.pontos[a.pontos.length - 2] || a.pontos[0]);
    }
    const comGrau = [...incidentes.entries()].filter(([, angs]) => angs.length > 1);
    if (!comGrau.length) saida.push(inaplicavel('A6.1', 'nenhum nó tem duas ou mais arestas incidentes'));
    else {
      const q1 = lim('resolucaoAngularQ1');
      const pisoAbsoluto = lim('anguloIncidenteMinimo');
      const termos = [];
      const apertados = [];       // âncora declarada: o ângulo é fato do plano
      const reconstruidos = [];   // sem âncora: o ângulo é palpite da cena
      for (const [id, registros] of comGrau) {
        const angs = registros.map(r => r.angulo);
        const todasAncoradas = registros.every(r => r.ancorada);
        const ordenados = [...angs].sort((a, b) => a - b);
        let menor = 360;
        for (let i = 0; i < ordenados.length; i++) {
          const prox = ordenados[(i + 1) % ordenados.length];
          let d = prox - ordenados[i];
          if (i === ordenados.length - 1) d += 360;
          menor = Math.min(menor, Math.abs(d));
        }
        const ideal = 360 / angs.length;
        termos.push(Math.abs((ideal - menor) / ideal));
        if (menor < pisoAbsoluto)
          (todasAncoradas ? apertados : reconstruidos).push({
            o_que: `duas arestas saem de "${id}" a ${arredonda(menor, 1)}° uma da outra (piso ${pisoAbsoluto}°)` +
              (todasAncoradas ? '' : ' — ângulo reconstruído, sem âncora declarada'),
            ids: [id],
          });
      }
      const AR = arredonda(1 - media(termos));
      const medida = {
        AR, nos_com_grau_maior_que_um: comGrau.length, piso_absoluto: pisoAbsoluto,
        angulos_reconstruidos: algumSemAncora,
      };
      saida.push(apertados.length
        ? falha('A6.1', { medida, mensagem: `${apertados.length} par(es) de arestas incidentes indistinguíveis`, ocorrencias: apertados })
        : reconstruidos.length
          ? aviso('A6.1', {
            medida,
            mensagem: `${reconstruidos.length} par(es) de arestas parecem sair juntas, mas as pontas foram reconstruídas — ` +
              'o renderizador desencosta as duas (jettySize=auto). Declare a âncora para que isto vire medição',
            ocorrencias: reconstruidos,
          })
          : AR < q1 ? aviso('A6.1', { medida, mensagem: `AR = ${AR} < ${q1} (Q1)`, ocorrencias: [{ o_que: 'arestas saem em leque desigual dos nós', ids: [] }] })
            : ok('A6.1', { medida, mensagem: `AR = ${AR}` }));
    }
  }

  // ---------------------------------------------------------------- A6.2
  {
    if (nos.length < 2) saida.push(inaplicavel('A6.2', 'menos de dois nós'));
    else {
      const V = nos.length;
      const env = g.envolvente(nos.map(n => n.caixa));
      const colunas = Math.floor(Math.sqrt(V)) || 1;
      const linhas = Math.ceil(V / colunas);
      const T = colunas * linhas;
      const celula = new Map();
      for (const n of nos) {
        const c = g.centro(n.caixa);
        const i = Math.min(colunas - 1, Math.floor(((c.x - env.x) / (env.w || 1)) * colunas));
        const j = Math.min(linhas - 1, Math.floor(((c.y - env.y) / (env.h || 1)) * linhas));
        const chave = `${i},${j}`;
        celula.set(chave, (celula.get(chave) || 0) + 1);
      }
      const mu = V / T;
      const dMax = (2 * V * (T - 1)) / T;
      let soma = 0;
      for (let i = 0; i < colunas; i++) for (let j = 0; j < linhas; j++) soma += Math.abs((celula.get(`${i},${j}`) || 0) - mu);
      const NU = arredonda(dMax > 0 ? 1 - soma / dMax : 1);
      const q1 = lim('uniformidadeDeNosQ1');
      const medida = { NU, grade: `${colunas}×${linhas}`, nos: V };
      saida.push(NU < q1
        ? aviso('A6.2', { medida, mensagem: `NU = ${NU} < ${q1} (Q1) — há aglomerado e vazio`, ocorrencias: [{ o_que: `${[...celula.values()].filter(v => v === 0).length || T - celula.size} célula(s) da grade estão vazias`, ids: [] }] })
        : ok('A6.2', { medida, mensagem: `NU = ${NU}` }));
    }
  }

  // ---------------------------------------------------------------- A6.3
  {
    const env = g.envolvente(cena.caixas.map(e => e.caixa));
    if (!env || !env.w || !env.h) saida.push(inaplicavel('A6.3', 'o desenho não tem área'));
    else {
      // `Asp` é a métrica de Mooney e é `min/max` por definição — ela mede
      // alongamento, não orientação. Mas a SEGUNDA metade de A6.3, que compara
      // o desenho com o canvas, não pode usar min/max: um desenho deitado numa
      // página em pé, com a mesma razão, daria diferença ZERO e passaria — e é
      // exatamente o caso das "faixas vazias grandes" que o limiar persegue.
      // Ali a razão tem de ser orientada.
      const asp = arredonda(Math.min(env.h, env.w) / Math.max(env.h, env.w));
      const razaoDesenho = env.w / env.h;
      const razaoCanvas = canvas.w / canvas.h;
      const diferenca = arredonda(Math.abs(razaoDesenho - razaoCanvas) / (razaoCanvas || 1));
      const q1 = lim('razaoDeAspectoQ1');
      const tol = lim('toleranciaDeRazaoDeAspecto');
      const medida = {
        Asp: asp, razao_desenho: arredonda(razaoDesenho, 2), razao_canvas: arredonda(razaoCanvas, 2),
        diferenca_relativa: diferenca, Q1: q1, tolerancia: tol,
      };
      const motivos = [];
      if (asp < q1) motivos.push({ o_que: `Asp = ${asp} < ${q1} (Q1): o desenho é uma faixa muito alongada`, ids: [] });
      if (diferenca > tol) motivos.push({ o_que: `a razão do desenho difere da do canvas em ${arredonda(diferenca * 100, 0)}% (tolerância ${arredonda(tol * 100, 0)}%): sobram faixas vazias`, ids: [] });
      saida.push(motivos.length ? aviso('A6.3', { medida, mensagem: motivos.map(m => m.o_que).join('; '), ocorrencias: motivos })
        : ok('A6.3', { medida, mensagem: `Asp = ${asp}` }));
    }
  }

  // ---------------------------------------------------------------- A6.4
  {
    if (nos.length < 2) saida.push(inaplicavel('A6.4', 'menos de dois nós'));
    else {
      const passo = lim('passoDaGrade');
      const minimo = lim('alinhamentoMinimo');
      const naGrade = v => Math.round(v / passo);
      const alinhados = nos.filter(n => {
        const c = g.centro(n.caixa);
        return nos.some(o => o.id !== n.id && (naGrade(g.centro(o.caixa).x) === naGrade(c.x) || naGrade(g.centro(o.caixa).y) === naGrade(c.y)));
      });
      const fracao = arredonda(alinhados.length / nos.length);
      const medida = { fracao_alinhada: fracao, minimo, passo, nos: nos.length };
      const soltos = nos.filter(n => !alinhados.includes(n)).map(n => ({ o_que: `${n.id} não compartilha eixo com nenhum outro nó`, ids: [n.id] }));
      saida.push(fracao >= minimo
        ? ok('A6.4', { medida, mensagem: `${arredonda(fracao * 100, 0)}% dos nós alinhados a pelo menos um outro` })
        : aviso('A6.4', { medida, mensagem: `só ${arredonda(fracao * 100, 0)}% alinhados (mínimo ${arredonda(minimo * 100, 0)}%)`, ocorrencias: soltos }));
    }
  }

  // ---------------------------------------------------------------- A6.5
  {
    const comAresta = arestas.filter(a => a.completa && centros.has(a.de) && centros.has(a.para));
    if (comAresta.length < 2 || nos.length < 3) saida.push(inaplicavel('A6.5', 'grafo pequeno demais para stress ou preservação de vizinhança'));
    else {
      const vizinhos = new Map(nos.map(n => [n.id, []]));
      for (const a of comAresta) { vizinhos.get(a.de).push(a.para); vizinhos.get(a.para).push(a.de); }

      // distâncias de grafo, só entre pares conectados
      const dGrafo = new Map();
      for (const n of nos) dGrafo.set(n.id, bfs(n.id, vizinhos));

      const paresConectados = [];
      for (const [a, b] of pares(nos)) {
        const d = dGrafo.get(a.id).get(b.id);
        if (d === undefined) continue;
        paresConectados.push({ a, b, d, euclidiana: Math.hypot(centros.get(a.id).x - centros.get(b.id).x, centros.get(a.id).y - centros.get(b.id).y) });
      }
      if (!paresConectados.length) saida.push(inaplicavel('A6.5', 'o grafo é totalmente desconexo'));
      else {
        // escala ótima: minimiza Σ (α·euclidiana − d)²/d²  →  α = Σ(e/d) / Σ(e²/d²)
        const num = paresConectados.reduce((s, p) => s + p.euclidiana / p.d, 0);
        const den = paresConectados.reduce((s, p) => s + (p.euclidiana ** 2) / (p.d ** 2), 0);
        const alfa = den > 0 ? num / den : 1;
        const stress = media(paresConectados.map(p => ((alfa * p.euclidiana - p.d) ** 2) / (p.d ** 2)));
        const KSM = arredonda(1 / (1 + stress));

        // preservação de vizinhança: os k mais próximos no desenho contra os k vizinhos de grafo
        const NPs = [];
        for (const n of nos) {
          const k = (vizinhos.get(n.id) || []).length;
          if (!k) continue;
          const proximos = nos.filter(o => o.id !== n.id)
            .sort((x, y) => Math.hypot(centros.get(x.id).x - centros.get(n.id).x, centros.get(x.id).y - centros.get(n.id).y)
              - Math.hypot(centros.get(y.id).x - centros.get(n.id).x, centros.get(y.id).y - centros.get(n.id).y))
            .slice(0, k).map(o => o.id);
          const reais = new Set(vizinhos.get(n.id));
          NPs.push(proximos.filter(id => reais.has(id)).length / k);
        }
        const NP = arredonda(media(NPs));
        const q1NP = lim('preservacaoDeVizinhancaQ1');
        const q1KSM = lim('stressQ1');
        const medida = {
          NP, KSM, Q1_NP: q1NP, Q1_KSM: q1KSM,
          formula_KSM: '1/(1+stress) com escala ótima — a normalização exata da eq. (8) de Mooney não foi acessada; ver U10 da rubrica',
          ressalva: 'a rubrica classifica A6.5 como provavelmente ruído em diagrama de arquitetura, onde a posição é ditada pelos grupos',
        };
        const motivos = [];
        if (NP < q1NP) motivos.push({ o_que: `NP = ${NP} < ${q1NP} (Q1)`, ids: [] });
        if (KSM < q1KSM) motivos.push({ o_que: `KSM = ${KSM} < ${q1KSM} (Q1)`, ids: [] });
        saida.push(motivos.length
          ? aviso('A6.5', { medida, mensagem: `${motivos.map(m => m.o_que).join('; ')} — mas ver a ressalva: aqui a posição vem dos grupos, não do grafo`, ocorrencias: motivos })
          : ok('A6.5', { medida, mensagem: `NP = ${NP}, KSM = ${KSM}` }));
      }
    }
  }

  return saida;
};
