'use strict';
/**
 * A3 · Sobreposição e legibilidade espacial.
 *
 * A rubrica: "a de maior valor prático — falhas duras, tolerância zero,
 * trivialmente computáveis, e são exatamente o que um gerador automático erra".
 * Roda primeiro junto com A4 pela ordem de prioridade do §Resumo.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometry.cjs'));
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, aviso, falha, notApplicable, conforme, pares, arredonda, semTags, name } = require(path.join(__dirname, 'common.cjs'));


module.exports = function a3(cena) {
  const output = [];
  const { nodes, grupos, edges, canvas } = cena;
  // Faixas ficam de fora de toda A3: elas existem para cruzar, e o `scene.cjs`
  // explica por quê. O que lhes cabe é a checagem de membros, em `extras`.
  const solidos = [...nodes, ...grupos];

  // ---------------------------------------------------------------- A3.1
  // "Irmãos" é o que a rubrica diz. Somo os pares folha–folha de qualquer lugar
  // da árvore, porque folha nunca contém folha: dois ícones de subnets
  // diferentes que se encostam são a mesma falha, e ninguém mais a pegaria.
  {
    const casos = [];
    const gap = lim('folgaEntreCaixas');
    const candidatos = [...pares(solidos)].filter(([a, b]) =>
      (a.pai === b.pai) || (a.classe === 'no' && b.classe === 'no'));
    for (const [a, b] of candidatos) {
      if (cena.ehDescendente(a.id, b.id) || cena.ehDescendente(b.id, a.id)) continue;
      const area = g.areaDaIntersecao(a.caixa, b.caixa);
      if (area > 0) casos.push({ o_que: `${name(a)} e ${name(b)} se sobrepõem em ${arredonda(area, 0)} px²`, ids: [a.id, b.id] });
      else {
        const d = g.gap(a.caixa, b.caixa);
        if (d < gap) casos.push({ o_que: `${name(a)} e ${name(b)} têm folga de ${arredonda(d, 1)} px (mínimo ${gap})`, ids: [a.id, b.id] });
      }
    }
    output.push(conforme('A3.1', casos, {
      medida: { pares_conferidos: candidatos.length, violacoes: casos.length },
      mensagem: casos.length ? `${casos.length} par(es) sobrepostos ou apertados demais` : `${candidatos.length} pares conferidos, nenhum encostado`,
    }));
  }

  // ---------------------------------------------------------------- A3.2
  {
    const comRotulo = [...solidos, ...edges].filter(e => e.rotuloCaixa);
    const padding = lim('paddingDeRotulo');
    const casos = [];
    for (const [a, b] of pares(comRotulo)) {
      const ra = { ...a.rotuloCaixa, x: a.rotuloCaixa.x - padding, y: a.rotuloCaixa.y - padding, w: a.rotuloCaixa.w + 2 * padding, h: a.rotuloCaixa.h + 2 * padding };
      const area = g.areaDaIntersecao(ra, b.rotuloCaixa);
      if (area > 0) casos.push({ o_que: `os rótulos de ${name(a)} e ${name(b)} se cruzam em ${arredonda(area, 0)} px²`, ids: [a.id, b.id] });
    }
    output.push(conforme('A3.2', casos, {
      medida: { rotulos: comRotulo.length, colisoes: casos.length },
      mensagem: casos.length ? `${casos.length} colisão(ões) de rótulo` : `${comRotulo.length} rótulos, nenhum encosta em outro`,
    }));
  }

  // ---------------------------------------------------------------- A3.3
  // Rótulo de folha é desenhado FORA da caixa por construção (o mxGraph põe
  // embaixo). Transbordar, para ele, é sair do GRUPO — que é quando a etiqueta
  // de um recurso aparece fora da VPC a que ele pertence.
  {
    const casos = [];
    for (const e of solidos) {
      const r = e.rotuloCaixa;
      if (!r) continue;
      if (r.onde === 'inside') {
        if (!g.contem(e.caixa, r)) casos.push({ o_que: `o rótulo de ${name(e)} não cabe na própria caixa`, ids: [e.id] });
        continue;
      }
      const pai = cena.porElemento.get(e.pai);
      const limite = pai && pai.caixa ? pai.caixa : canvas;
      if (!g.contem(limite, r)) {
        const onde = pai ? `do grupo "${pai.id}"` : 'do canvas';
        casos.push({ o_que: `o rótulo de ${name(e)} transborda ${onde}`, ids: [e.id] });
      }
    }
    output.push(conforme('A3.3', casos, { medida: { transbordos: casos.length } }));
  }

  // ---------------------------------------------------------------- A3.4
  {
    const casos = [];
    const comRotulo = solidos.filter(e => e.rotuloCaixa);
    for (const e of comRotulo) {
      for (const a of edges) {
        if (!a.completa) continue;
        if (a.from === e.id || a.to === e.id) continue;   // a aresta do próprio dono
        for (let i = 0; i + 1 < a.pontos.length; i++) {
          if (g.segmentoCruzaRetangulo(a.pontos[i], a.pontos[i + 1], e.rotuloCaixa)) {
            casos.push({ o_que: `a aresta "${a.id}" passa por cima do rótulo de ${name(e)}`, ids: [a.id, e.id] });
            break;
          }
        }
      }
    }
    output.push(edges.length ? conforme('A3.4', casos, { medida: { cruzamentos: casos.length } })
      : notApplicable('A3.4', 'o diagrama não tem arestas'));
  }

  // ---------------------------------------------------------------- A3.5
  {
    if (!edges.length) output.push(notApplicable('A3.5', 'o diagrama não tem arestas'));
    else {
      const casos = [];
      for (const a of edges) {
        if (!a.completa) continue;
        for (const n of nodes) {
          if (n.id === a.from || n.id === a.to) continue;
          if (g.polilinhaCruzaRetangulo(a.pontos, n.caixa))
            casos.push({ o_que: `a aresta "${a.id}" (${a.from}→${a.to}) atravessa ${name(n)}`, ids: [a.id, n.id] });
        }
      }
      output.push(conforme('A3.5', casos, { medida: { travessias: casos.length } }));
    }
  }

  // ---------------------------------------------------------------- A3.6
  // Onde a âncora foi declarada, dá para medir. Onde não foi, a ponta é
  // PROJETADA no perímetro pelo renderizador, e a cena reconstrói do mesmo
  // jeito — medir aí seria conferir a própria reconstrução. A checagem diz
  // quantas ficaram por construção em vez de fingir que conferiu as duas.
  {
    if (!edges.length) output.push(notApplicable('A3.6', 'o diagrama não tem arestas'));
    else {
      const tol = lim('toleranciaDeAncoragem');
      const casos = [];
      let ancoradas = 0;
      for (const a of edges) {
        if (!a.completa) { casos.push({ o_que: `a aresta "${a.id}" aponta para um id que não existe no plano`, ids: [a.id] }); continue; }
        if (!a.ancorada) continue;
        ancoradas++;
        const origin = cena.porElemento.get(a.from);
        const destino = cena.porElemento.get(a.to);
        if (!g.noPerimetro(a.pontos[0], origin.caixa, tol))
          casos.push({ o_que: `a aresta "${a.id}" começa fora do perímetro de ${name(origin)}`, ids: [a.id] });
        if (!g.noPerimetro(a.pontos[a.pontos.length - 1], destino.caixa, tol))
          casos.push({ o_que: `a aresta "${a.id}" termina fora do perímetro de ${name(destino)}`, ids: [a.id] });
      }
      const porConstrucao = edges.length - ancoradas;
      output.push(conforme('A3.6', casos, {
        medida: { ancoras_declaradas: ancoradas, por_construcao: porConstrucao },
        mensagem: porConstrucao
          ? `${ancoradas} âncora(s) conferida(s); ${porConstrucao} ponta(s) sem âncora declarada — o renderizador projeta no perímetro, então ali A3.6 vale por construção e não por medição`
          : `${ancoradas} âncoras conferidas`,
      }));
    }
  }

  // ---------------------------------------------------------------- A3.7
  {
    const margin = lim('margemDoCanvas');
    const all = [...cena.caixas, ...cena.molduras].map(e => e.caixa).filter(Boolean);
    for (const a of edges) if (a.completa) for (const p of a.pontos) all.push({ x: p.x, y: p.y, w: 0, h: 0 });
    const env = g.envolvente(all);
    const cabe = env && g.contem(canvas, env, margin);
    output.push(cabe
      ? ok('A3.7', { medida: { envolvente: env, canvas, margin }, mensagem: `tudo cabe no canvas com ≥ ${margin} px de margem` })
      : falha('A3.7', {
        medida: { envolvente: env, canvas, margin },
        mensagem: `o desenho ocupa ${env ? `${arredonda(env.w, 0)}×${arredonda(env.h, 0)} a partir de (${arredonda(env.x, 0)},${arredonda(env.y, 0)})` : '(vazio)'} e o canvas é ${canvas.w}×${canvas.h} com margem de ${margin} px`,
        occurrences: [{ o_que: 'a união dos objetos não cabe no canvas com a margem exigida', ids: [] }],
      }));
  }

  // ---------------------------------------------------------------- A3.8
  {
    const centros = nodes.map(n => g.centro(n.caixa));
    if (centros.length < 2) output.push(notApplicable('A3.8', 'menos de dois nós — não há par de distâncias'));
    else {
      const ds = [...pares(centros)].map(([a, b]) => Math.hypot(a.x - b.x, a.y - b.y));
      const nr = Math.min(...ds) / Math.max(...ds);
      const q1 = lim('resolucaoDeNoQ1');
      output.push(nr < q1
        ? aviso('A3.8', { medida: { NR: arredonda(nr) }, mensagem: `NR = ${arredonda(nr)} < ${q1} (Q1 de especialistas); alvo ${lim('resolucaoDeNoMediana')}` })
        : ok('A3.8', { medida: { NR: arredonda(nr) }, mensagem: `NR = ${arredonda(nr)}` }));
    }
  }

  // ---------------------------------------------------------------- A3.9
  {
    const minAresta = lim('fonteMinimaRotuloDeAresta');
    const minNome = lim('fonteMinimaNomeDeElemento');
    const casos = [];
    for (const e of solidos) {
      if (!semTags(e.label)) continue;
      if (e.tamanhoDaFonte < minNome)
        casos.push({ o_que: `${name(e)} rotula com ${e.tamanhoDaFonte} px (nome de elemento pede ${minNome})`, ids: [e.id] });
    }
    for (const a of edges) {
      if (!semTags(a.label)) continue;
      const px = parseFloat(a.style.fontSize) || 12;
      if (px < minAresta) casos.push({ o_que: `a aresta "${a.id}" rotula com ${px} px (rótulo de aresta pede ${minAresta})`, ids: [a.id] });
    }
    output.push(conforme('A3.9', casos, { medida: { abaixo_do_piso: casos.length } }));
  }

  return output;
};
