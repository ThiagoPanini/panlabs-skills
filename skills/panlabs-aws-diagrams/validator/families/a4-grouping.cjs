'use strict';
/**
 * A4 · Agrupamento e região comum (Gestalt).
 *
 * A rubrica: "em diagrama AWS esta família carrega a semântica mais forte do
 * desenho: a caixa de VPC É a fronteira de rede. Erro aqui não é feio, é
 * factualmente errado."
 *
 * Duas das sete são marcadas `semantica` no índice — A4.2 e A4.4. Nelas o
 * validador deixa de ser linter e passa a ser guarda de veracidade: o que se
 * mede não é se o desenho está bonito, é se ele está AFIRMANDO uma topologia
 * que o modelo nega.
 *
 * Toda esta família roda sobre GRUPOS. As faixas saem, e a razão está escrita
 * em `scene.cjs`: uma faixa afirma atributo compartilhado, não contenção, e o
 * próprio motor a desenha para cruzar caixas. O que lhes cabe — que a faixa
 * abrace exatamente os membros que declara — está em `extras.cjs`, com a mesma
 * tolerância zero.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometry.cjs'));
const { lim } = require(path.join(__dirname, '..', 'index.cjs'));
const { ok, notApplicable, matches, pairs, mean, deviation, roundTo, withoutTags, name } = require(path.join(__dirname, 'common.cjs'));


module.exports = function a4(scene) {
  const output = [];
  const { nodes, grupos } = scene;
  const solidos = [...nodes, ...grupos];

  // ---------------------------------------------------------------- A4.1
  {
    const padding = lim('paddingDeGrupo');
    const casos = [];
    for (const e of solidos) {
      const parent = scene.byElement.get(e.parent);
      if (!parent || !parent.cellBox) continue;
      if (!g.contem(parent.cellBox, e.cellBox, padding)) {
        const p = g.paddings(parent.cellBox, [e.cellBox]);
        const tight = Object.entries(p).filter(([, d]) => d < padding)
          .map(([lado, d]) => `${lado}=${roundTo(d, 1)}`).join(', ');
        casos.push({ o_que: `${name(e)} não respeita ${padding} px dentro de "${parent.id}" (${tight})`, ids: [e.id, parent.id] });
      }
    }
    output.push(matches('A4.1', casos, { measured: { filhos: solidos.filter(e => scene.byElement.get(e.parent)).length, violations: casos.length } }));
  }

  // ---------------------------------------------------------------- A4.2
  // A falha de maior gravidade semântica do validador inteiro.
  {
    const casos = [];
    for (const n of solidos) {
      for (const group of grupos) {
        if (group.id === n.id) continue;
        if (scene.ehDescendente(n.id, group.id)) continue;      // é membro: pode estar dentro
        if (scene.ehDescendente(group.id, n.id)) continue;      // é o contrário: o grupo é filho
        const area = g.intersectionArea(n.cellBox, group.cellBox);
        if (area > 0) {
          const inside = g.contem(group.cellBox, n.cellBox);
          casos.push({
            o_que: `${name(n)} ${inside ? 'está dentro' : 'invade'} de "${group.id}" sem ser membro — ` +
              `o desenho afirma um pertencimento de fronteira que o modelo não tem`,
            ids: [n.id, group.id],
          });
        }
      }
    }
    output.push(matches('A4.2', casos, {
      measured: { violations: casos.length },
      mensagem: casos.length
        ? `${casos.length} pertencimento(s) falso(s) — tolerância é zero`
        : 'nenhum não-membro dentro de grupo alheio',
    }));
  }

  // ---------------------------------------------------------------- A4.3
  {
    const casos = [];
    const candidatos = [...pairs(grupos)].filter(([a, b]) =>
      a.parent === b.parent && !scene.ehDescendente(a.id, b.id) && !scene.ehDescendente(b.id, a.id));
    for (const [a, b] of candidatos) {
      const area = g.intersectionArea(a.cellBox, b.cellBox);
      if (area > 0) casos.push({ o_que: `os grupos irmãos "${a.id}" e "${b.id}" se sobrepõem em ${roundTo(area, 0)} px²`, ids: [a.id, b.id] });
    }
    output.push(candidatos.length ? matches('A4.3', casos, { measured: { pairs: candidatos.length, sobrepostos: casos.length } })
      : notApplicable('A4.3', 'não há dois grupos irmãos para comparar'));
  }

  // ---------------------------------------------------------------- A4.4
  // A árvore derivada da geometria contra a árvore declarada. O pai geométrico
  // é o menor grupo que contém a caixa inteira — que é como o olho lê.
  {
    const casos = [];
    for (const e of solidos) {
      const contendo = grupos.filter(gr => gr.id !== e.id && !scene.ehDescendente(gr.id, e.id) && g.contem(gr.cellBox, e.cellBox));
      const geometrico = contendo.sort((a, b) => (a.cellBox.w * a.cellBox.h) - (b.cellBox.w * b.cellBox.h))[0];
      const declaredValue = scene.byElement.get(e.parent);
      const idGeo = geometrico ? geometrico.id : '(raiz)';
      const idDec = declaredValue ? declaredValue.id : '(raiz)';
      if (idGeo !== idDec)
        casos.push({ o_que: `${name(e)} é desenhado dentro de "${idGeo}" e declarado dentro de "${idDec}"`, ids: [e.id] });
    }
    output.push(matches('A4.4', casos, {
      measured: { elements: solidos.length, divergences: casos.length },
      mensagem: casos.length
        ? `${casos.length} elemento(s) onde o desenho e o modelo contam topologias diferentes`
        : 'a árvore desenhada é a árvore declarada',
    }));
  }

  // ---------------------------------------------------------------- A4.5
  {
    const sigmaMax = lim('desvioDePaddingMaximo');
    const casos = [];
    const porTipo = new Map();
    for (const group of grupos) {
      const filhos = (scene.filhosDe.get(group.id) || []).map(f => f.cellBox);
      if (!filhos.length) continue;
      const p = g.paddings(group.cellBox, filhos);
      // O topo carrega a faixa de título, que é reserva deliberada e não desvio.
      const laterais = [p.esquerda, p.direita, p.baixo];
      const s = deviation(laterais);
      if (s > sigmaMax)
        casos.push({ o_que: `"${group.id}" tem paddings ${laterais.map(x => roundTo(x, 1)).join('/')} (σ = ${roundTo(s, 2)} > ${sigmaMax})`, ids: [group.id] });
      const kind = group.tipoSemantico || 'desconhecido';
      if (!porTipo.has(kind)) porTipo.set(kind, []);
      porTipo.get(kind).push({ id: group.id, p: mean(laterais) });
    }
    for (const [kind, list] of porTipo) {
      if (list.length < 2) continue;
      const s = deviation(list.map(x => x.p));
      if (s > sigmaMax)
        casos.push({ o_que: `grupos do tipo "${kind}" usam paddings diferentes entre si (σ = ${roundTo(s, 2)})`, ids: list.map(x => x.id) });
    }
    output.push(grupos.length ? matches('A4.5', casos, { measured: { grupos: grupos.length, irregulares: casos.length } })
      : notApplicable('A4.5', 'o diagrama não tem grupos'));
  }

  // ---------------------------------------------------------------- A4.6
  {
    const casos = [];
    let comRotulo = 0;
    for (const group of grupos) {
      const r = group.rotuloCaixa;
      if (!r || !withoutTags(group.label)) continue;
      comRotulo++;
      const noTopo = Math.abs(r.y - group.cellBox.y) <= lim('alturaDaFaixaDeTitulo');
      const naEsquerda = r.x - group.cellBox.x <= group.cellBox.w / 2;
      if (!noTopo || !naEsquerda)
        casos.push({ o_que: `o rótulo de "${group.id}" não está no canto superior esquerdo`, ids: [group.id] });
      for (const filho of scene.filhosDe.get(group.id) || [])
        if (g.intersectionArea(r, filho.cellBox) > 0) {
          casos.push({ o_que: `o rótulo de "${group.id}" colide com o filho "${filho.id}"`, ids: [group.id, filho.id] });
          break;
        }
    }
    output.push(comRotulo ? matches('A4.6', casos, { measured: { grupos_rotulados: comRotulo, fora_do_canone: casos.length } })
      : notApplicable('A4.6', 'nenhum grupo tem rótulo'));
  }

  // ---------------------------------------------------------------- A4.7
  {
    const ceiling = lim('proximidadeMaxima');
    const grupoDe = n => {
      const a = scene.ancestrais(n.id);
      return a.length ? a[0].id : '(raiz)';
    };
    const intra = [];
    const inter = [];
    for (const [a, b] of pairs(nodes)) {
      const d = Math.hypot(...['x', 'y'].map(k => g.centro(a.cellBox)[k] - g.centro(b.cellBox)[k]));
      (grupoDe(a) === grupoDe(b) ? intra : inter).push(d);
    }
    if (!intra.length || !inter.length) output.push(notApplicable('A4.7', 'não há pares intra e inter grupo para comparar'));
    else {
      const rho = mean(intra) / mean(inter);
      output.push(rho <= ceiling
        ? ok('A4.7', { measured: { rho: roundTo(rho), intra: roundTo(mean(intra), 1), inter: roundTo(mean(inter), 1) }, mensagem: `ρ = ${roundTo(rho)} ≤ ${ceiling}` })
        : matches('A4.7', [{ o_que: `ρ = ${roundTo(rho)} > ${ceiling}: nós do mesmo grupo não estão mais próximos entre si do que de nós de fora`, ids: [] }],
          { measured: { rho: roundTo(rho), intra: roundTo(mean(intra), 1), inter: roundTo(mean(inter), 1) } }));
    }
  }

  return output;
};
