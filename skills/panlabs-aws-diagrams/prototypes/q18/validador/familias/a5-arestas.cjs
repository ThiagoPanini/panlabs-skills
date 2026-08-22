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
const g = require(path.join(__dirname, '..', 'geometria.cjs'));
const { lim } = require(path.join(__dirname, '..', 'indice.cjs'));
const { ok, aviso, falha, inaplicavel, conforme, pares, media, arredonda } = require(path.join(__dirname, 'comum.cjs'));

/** Todos os pontos de cruzamento entre duas polilinhas, ignorando incidências. */
function cruzamentosEntre(a, b) {
  const achados = [];
  for (let i = 0; i + 1 < a.pontos.length; i++)
    for (let j = 0; j + 1 < b.pontos.length; j++) {
      const p = g.cruzamento(a.pontos[i], a.pontos[i + 1], b.pontos[j], b.pontos[j + 1]);
      if (p) achados.push({ ponto: p, angulo: g.anguloEntre(a.pontos[i], a.pontos[i + 1], b.pontos[j], b.pontos[j + 1]) });
    }
  return achados;
}

module.exports = function a5(cena) {
  const saida = [];
  const arestas = cena.arestas.filter(a => a.completa);
  const semAresta = id => saida.push(inaplicavel(id, 'o diagrama não tem arestas'));

  if (!arestas.length) {
    for (const id of ['A5.1', 'A5.2', 'A5.3', 'A5.4', 'A5.5', 'A5.6', 'A5.7', 'A5.8', 'A5.9']) semAresta(id);
    return saida;
  }

  const grau = cena.grau;   // a cena monta uma vez; A6.1 e A8.3 leem o mesmo mapa

  // ------------------------------------------------- cruzamentos, uma vez só
  const cruzes = [];
  for (const [a, b] of pares(arestas)) {
    if (a.de === b.de || a.de === b.para || a.para === b.de || a.para === b.para) continue;  // incidência
    for (const c of cruzamentosEntre(a, b)) cruzes.push({ ...c, a: a.id, b: b.id });
  }

  // ---------------------------------------------------------------- A5.1
  {
    const E = arestas.length;
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
      const chave = `${Math.round(c.ponto.x)},${Math.round(c.ponto.y)}`;
      if (!porPonto.has(chave)) porPonto.set(chave, new Set());
      porPonto.get(chave).add(c.a).add(c.b);
    }
    const c = [...porPonto.values()].reduce((soma, arestasNoPonto) => {
      const k = arestasNoPonto.size;
      return soma + (k * (k - 1)) / 2;
    }, 0);
    const EC = arredonda(1 - c / cMax);
    const orcamento = Math.ceil(E / 10);
    const medida = { cruzamentos: cruzes.length, c_em_pares: c, EC, orcamento_de_falha: orcamento, c_max: cMax };
    const ocorrencias = cruzes.map(c => ({ o_que: `"${c.a}" cruza "${c.b}" em (${arredonda(c.ponto.x, 0)}, ${arredonda(c.ponto.y, 0)}) a ${arredonda(c.angulo, 1)}°`, ids: [c.a, c.b] }));
    saida.push(!cruzes.length ? ok('A5.1', { medida, mensagem: `0 cruzamentos, EC = ${EC}` })
      : cruzes.length > orcamento ? falha('A5.1', { medida, mensagem: `${cruzes.length} cruzamentos, acima do orçamento de ⌈${E}/10⌉ = ${orcamento}`, ocorrencias })
        : aviso('A5.1', { medida, mensagem: `${cruzes.length} cruzamento(s), EC = ${EC} (alvo 0)`, ocorrencias }));
  }

  // ---------------------------------------------------------------- A5.2
  {
    if (!cruzes.length) saida.push(inaplicavel('A5.2', 'não há cruzamento para medir o ângulo'));
    else {
      const CA = arredonda(1 - media(cruzes.map(c => Math.abs((90 - c.angulo) / 90))));
      const minAngulo = arredonda(Math.min(...cruzes.map(c => c.angulo)), 1);
      const piso = lim('anguloDeCruzamentoMinimo');
      const q1 = lim('anguloDeCruzamentoQ1');
      const medida = { CA, angulo_minimo: minAngulo, ideal: lim('anguloDeCruzamentoIdeal') };
      const rasos = cruzes.filter(c => c.angulo < piso)
        .map(c => ({ o_que: `"${c.a}" e "${c.b}" cruzam a ${arredonda(c.angulo, 1)}° (piso ${piso}°)`, ids: [c.a, c.b] }));
      saida.push(rasos.length ? falha('A5.2', { medida, mensagem: `cruzamento a ${minAngulo}°, abaixo do piso de ${piso}°`, ocorrencias: rasos })
        : CA < q1 ? aviso('A5.2', { medida, mensagem: `CA = ${CA} < ${q1} (Q1)`, ocorrencias: [{ o_que: `menor ângulo ${minAngulo}°, ideal ${lim('anguloDeCruzamentoIdeal')}°`, ids: [] }] })
          : ok('A5.2', { medida, mensagem: `CA = ${CA}, menor ângulo ${minAngulo}°` }));
    }
  }

  // ---------------------------------------------------------------- A5.3
  {
    const alvo = lim('dobrasAlvo');
    const teto = lim('dobrasAviso');
    const pisoDeFalha = lim('dobrasFalha');
    const contagem = arestas.map(a => ({ id: a.id, dobras: Math.max(0, a.pontos.length - 2) }));
    const maximo = Math.max(...contagem.map(c => c.dobras));
    const medida = { maximo, media: arredonda(media(contagem.map(c => c.dobras)), 2), alvo, aviso: teto, falha: pisoDeFalha };
    const graves = contagem.filter(c => c.dobras > pisoDeFalha).map(c => ({ o_que: `"${c.id}" tem ${c.dobras} dobras (falha acima de ${pisoDeFalha})`, ids: [c.id] }));
    const passou = contagem.filter(c => c.dobras > teto && c.dobras <= pisoDeFalha).map(c => ({ o_que: `"${c.id}" tem ${c.dobras} dobras (alvo ≤ ${alvo})`, ids: [c.id] }));
    saida.push(graves.length ? falha('A5.3', { medida, mensagem: `${graves.length} aresta(s) com mais de ${pisoDeFalha} dobras`, ocorrencias: graves })
      : passou.length ? aviso('A5.3', { medida, mensagem: `${passou.length} aresta(s) acima de ${teto} dobras`, ocorrencias: passou })
        : ok('A5.3', { medida, mensagem: `no máximo ${maximo} dobra(s) por aresta` }));
  }

  // ---------------------------------------------------------------- A5.4
  {
    const alvo = lim('anguloDeDobraAlvo');
    const piso = lim('anguloDeDobraFalha');
    const angulos = [];
    for (const a of arestas)
      for (let i = 1; i + 1 < a.pontos.length; i++)
        angulos.push({ id: a.id, angulo: g.anguloInterno(a.pontos[i - 1], a.pontos[i], a.pontos[i + 1]) });
    if (!angulos.length) saida.push(inaplicavel('A5.4', 'nenhuma aresta tem dobra'));
    else {
      const menor = Math.min(...angulos.map(x => x.angulo));
      const medida = { angulo_minimo: arredonda(menor, 1), alvo, piso, dobras: angulos.length };
      const agudas = angulos.filter(x => x.angulo < piso).map(x => ({ o_que: `"${x.id}" dobra a ${arredonda(x.angulo, 1)}° (piso ${piso}°)`, ids: [x.id] }));
      const brandas = angulos.filter(x => x.angulo >= piso && x.angulo < alvo).map(x => ({ o_que: `"${x.id}" dobra a ${arredonda(x.angulo, 1)}° (alvo ${alvo}°)`, ids: [x.id] }));
      saida.push(agudas.length ? falha('A5.4', { medida, mensagem: `dobra de ${arredonda(menor, 1)}°, abaixo do piso de ${piso}°`, ocorrencias: agudas })
        : brandas.length ? aviso('A5.4', { medida, mensagem: `${brandas.length} dobra(s) abaixo de ${alvo}°`, ocorrencias: brandas })
          : ok('A5.4', { medida, mensagem: `menor dobra ${arredonda(menor, 1)}°` }));
    }
  }

  // ---------------------------------------------------------------- A5.5
  // Fronteira ESPÚRIA. O grupo entra na conta quando não contém nenhuma das
  // duas pontas e não é ancestral comum das duas — aí a aresta está riscando
  // uma fronteira de rede com a qual ela não tem relação nenhuma.
  {
    const casos = [];
    for (const a of arestas) {
      for (const grupo of cena.grupos) {
        const deDentro = a.de === grupo.id || cena.ehDescendente(a.de, grupo.id);
        const paraDentro = a.para === grupo.id || cena.ehDescendente(a.para, grupo.id);
        if (deDentro || paraDentro) continue;                 // a aresta é dali, ou vai para lá
        if (g.polilinhaCruzaRetangulo(a.pontos, grupo.caixa))
          casos.push({
            o_que: `a aresta "${a.id}" (${a.de}→${a.para}) atravessa o grupo "${grupo.id}", ` +
              `de onde não sai nem para onde vai — o desenho sugere um caminho de rede que não existe`,
            ids: [a.id, grupo.id],
          });
      }
    }
    saida.push(conforme('A5.5', casos, {
      medida: { arestas: arestas.length, grupos: cena.grupos.length, travessias_espurias: casos.length },
      mensagem: casos.length ? `${casos.length} travessia(s) de fronteira alheia — tolerância é zero` : 'nenhuma aresta corta grupo alheio',
    }));
  }

  // ---------------------------------------------------------------- A5.6
  {
    const ortogonal = arestas.filter(a => a.estilo.edgeStyle === 'orthogonalEdgeStyle').length > arestas.length / 2;
    const desvios = [];
    for (const a of arestas) {
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
    const EO = arredonda(1 - media(desvios));
    const alvo = lim('ortogonalidadeAlvo');
    const q1 = lim('ortogonalidadeQ1');
    const medida = { EO, estilo: ortogonal ? 'ortogonal' : 'reto', alvo: ortogonal ? alvo : q1 };
    saida.push(ortogonal
      ? (EO >= alvo ? ok('A5.6', { medida, mensagem: `EO = ${EO} ≥ ${alvo}` })
        : aviso('A5.6', { medida, mensagem: `estilo ortogonal declarado e EO = ${EO} < ${alvo}`, ocorrencias: [{ o_que: 'há segmentos fora dos eixos num roteamento que se diz ortogonal', ids: [] }] }))
      : (EO >= q1 ? ok('A5.6', { medida, mensagem: `EO = ${EO}` })
        : aviso('A5.6', { medida, mensagem: `EO = ${EO} < ${q1} — mistura desordenada de ângulos`, ocorrencias: [{ o_que: 'nem ortogonal nem consistentemente reto', ids: [] }] })));
  }

  // ---------------------------------------------------------------- A5.7
  {
    const minimo = lim('fluxoConsistenteMinimo');
    const vetores = arestas.map(a => {
      const o = cena.porElemento.get(a.de);
      const d = cena.porElemento.get(a.para);
      return { id: a.id, dx: g.centro(d.caixa).x - g.centro(o.caixa).x, dy: g.centro(d.caixa).y - g.centro(o.caixa).y };
    });
    // A rubrica manda ignorar as perpendiculares ao eixo (±15°) e escolher UM
    // eixo dominante; medimos os dois e ficamos com o que o desenho de fato usa.
    const medir = (eixo) => {
      const usados = vetores.filter(v => {
        const ang = Math.abs(Math.atan2(v.dy, v.dx) * 180 / Math.PI);
        const desvioDoEixo = eixo === 'x' ? Math.min(ang, 180 - ang) : Math.abs(90 - ang);
        return desvioDoEixo <= 75;
      });
      const positivos = usados.filter(v => (eixo === 'x' ? v.dx : v.dy) > 0);
      return { eixo, considerados: usados.length, fluxo: usados.length ? positivos.length / usados.length : 0, contramao: usados.filter(v => (eixo === 'x' ? v.dx : v.dy) <= 0) };
    };
    const candidatos = [medir('x'), medir('y')].filter(m => m.considerados);
    if (!candidatos.length) saida.push(inaplicavel('A5.7', 'nenhuma aresta tem projeção clara num eixo'));
    else {
      const melhor = candidatos.sort((a, b) => b.fluxo - a.fluxo || b.considerados - a.considerados)[0];
      const fluxo = arredonda(melhor.fluxo);
      const medida = { eixo: melhor.eixo === 'x' ? 'esquerda→direita' : 'cima→baixo', fluxo, consideradas: melhor.considerados, minimo };
      saida.push(fluxo >= minimo ? ok('A5.7', { medida, mensagem: `${arredonda(fluxo * 100, 0)}% das arestas seguem ${medida.eixo}` })
        : aviso('A5.7', {
          medida,
          mensagem: `só ${arredonda(fluxo * 100, 0)}% seguem ${medida.eixo} (mínimo ${arredonda(minimo * 100, 0)}%)`,
          ocorrencias: melhor.contramao.map(v => ({ o_que: `"${v.id}" vai na contramão do fluxo dominante`, ids: [v.id] })),
        }));
    }
  }

  // ---------------------------------------------------------------- A5.8
  {
    const separacao = lim('separacaoDeArestasParalelas');
    const casos = [];
    const porPar = new Map();
    for (const a of arestas) {
      const chave = [a.de, a.para].sort().join('|');
      if (!porPar.has(chave)) porPar.set(chave, []);
      porPar.get(chave).push(a);
    }
    for (const a of arestas)
      if (a.comprimento < g.EPS) casos.push({ o_que: `a aresta "${a.id}" tem comprimento zero`, ids: [a.id] });
    for (const lista of porPar.values())
      for (const [a, b] of pares(lista)) {
        const d = g.hausdorff(a.pontos, b.pontos);
        if (d < separacao) casos.push({ o_que: `"${a.id}" e "${b.id}" ligam o mesmo par e correm a ${arredonda(d, 1)} px (mínimo ${separacao})`, ids: [a.id, b.id] });
      }
    saida.push(conforme('A5.8', casos, { medida: { pares_com_multiplas_arestas: [...porPar.values()].filter(l => l.length > 1).length, coladas: casos.length } }));
  }

  // ---------------------------------------------------------------- A5.9
  // A rubrica pede o cálculo SEPARADO por classe de aresta: num diagrama com
  // grupos aninhados, intra-grupo e inter-grupo têm comprimentos naturalmente
  // diferentes, e misturar as duas populações reprova o desenho correto.
  {
    const q1 = lim('uniformidadeDeComprimentoQ1');
    const classeDe = a => {
      const pa = cena.ancestrais(a.de).map(x => x.id);
      const pb = cena.ancestrais(a.para).map(x => x.id);
      return pa[0] && pa[0] === pb[0] ? 'intra-grupo' : 'inter-grupo';
    };
    const porClasse = new Map();
    for (const a of arestas) {
      const c = classeDe(a);
      if (!porClasse.has(c)) porClasse.set(c, []);
      porClasse.get(c).push(a);
    }
    const porMedida = {};
    const casos = [];
    for (const [classe, lista] of porClasse) {
      if (lista.length < 2) { porMedida[classe] = { arestas: lista.length, ELD: null }; continue; }
      const comps = lista.map(a => a.comprimento);
      const ideal = media(comps);
      const ELD = arredonda(1 / (1 + media(comps.map(c => Math.abs(c - ideal) / ideal))));
      porMedida[classe] = { arestas: lista.length, ELD };
      if (ELD < q1) casos.push({ o_que: `arestas ${classe}: ELD = ${ELD} < ${q1} (Q1)`, ids: lista.map(a => a.id) });
    }
    saida.push(conforme('A5.9', casos, { medida: { por_classe: porMedida, Q1: q1 } }));
  }

  return saida;
};
