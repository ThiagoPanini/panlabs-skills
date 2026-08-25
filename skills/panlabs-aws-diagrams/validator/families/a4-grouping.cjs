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
const { ok, notApplicable, conforme, pares, media, desvio, arredonda, semTags, name } = require(path.join(__dirname, 'common.cjs'));


module.exports = function a4(cena) {
  const output = [];
  const { nodes, grupos } = cena;
  const solidos = [...nodes, ...grupos];

  // ---------------------------------------------------------------- A4.1
  {
    const padding = lim('paddingDeGrupo');
    const casos = [];
    for (const e of solidos) {
      const pai = cena.porElemento.get(e.pai);
      if (!pai || !pai.caixa) continue;
      if (!g.contem(pai.caixa, e.caixa, padding)) {
        const p = g.paddings(pai.caixa, [e.caixa]);
        const apertado = Object.entries(p).filter(([, d]) => d < padding)
          .map(([lado, d]) => `${lado}=${arredonda(d, 1)}`).join(', ');
        casos.push({ o_que: `${name(e)} não respeita ${padding} px dentro de "${pai.id}" (${apertado})`, ids: [e.id, pai.id] });
      }
    }
    output.push(conforme('A4.1', casos, { medida: { filhos: solidos.filter(e => cena.porElemento.get(e.pai)).length, violacoes: casos.length } }));
  }

  // ---------------------------------------------------------------- A4.2
  // A falha de maior gravidade semântica do validador inteiro.
  {
    const casos = [];
    for (const n of solidos) {
      for (const group of grupos) {
        if (group.id === n.id) continue;
        if (cena.ehDescendente(n.id, group.id)) continue;      // é membro: pode estar dentro
        if (cena.ehDescendente(group.id, n.id)) continue;      // é o contrário: o grupo é filho
        const area = g.areaDaIntersecao(n.caixa, group.caixa);
        if (area > 0) {
          const inside = g.contem(group.caixa, n.caixa);
          casos.push({
            o_que: `${name(n)} ${inside ? 'está dentro' : 'invade'} de "${group.id}" sem ser membro — ` +
              `o desenho afirma um pertencimento de fronteira que o modelo não tem`,
            ids: [n.id, group.id],
          });
        }
      }
    }
    output.push(conforme('A4.2', casos, {
      medida: { violacoes: casos.length },
      mensagem: casos.length
        ? `${casos.length} pertencimento(s) falso(s) — tolerância é zero`
        : 'nenhum não-membro dentro de grupo alheio',
    }));
  }

  // ---------------------------------------------------------------- A4.3
  {
    const casos = [];
    const candidatos = [...pares(grupos)].filter(([a, b]) =>
      a.pai === b.pai && !cena.ehDescendente(a.id, b.id) && !cena.ehDescendente(b.id, a.id));
    for (const [a, b] of candidatos) {
      const area = g.areaDaIntersecao(a.caixa, b.caixa);
      if (area > 0) casos.push({ o_que: `os grupos irmãos "${a.id}" e "${b.id}" se sobrepõem em ${arredonda(area, 0)} px²`, ids: [a.id, b.id] });
    }
    output.push(candidatos.length ? conforme('A4.3', casos, { medida: { pares: candidatos.length, sobrepostos: casos.length } })
      : notApplicable('A4.3', 'não há dois grupos irmãos para comparar'));
  }

  // ---------------------------------------------------------------- A4.4
  // A árvore derivada da geometria contra a árvore declarada. O pai geométrico
  // é o menor grupo que contém a caixa inteira — que é como o olho lê.
  {
    const casos = [];
    for (const e of solidos) {
      const contendo = grupos.filter(gr => gr.id !== e.id && !cena.ehDescendente(gr.id, e.id) && g.contem(gr.caixa, e.caixa));
      const geometrico = contendo.sort((a, b) => (a.caixa.w * a.caixa.h) - (b.caixa.w * b.caixa.h))[0];
      const declarado = cena.porElemento.get(e.pai);
      const idGeo = geometrico ? geometrico.id : '(raiz)';
      const idDec = declarado ? declarado.id : '(raiz)';
      if (idGeo !== idDec)
        casos.push({ o_que: `${name(e)} é desenhado dentro de "${idGeo}" e declarado dentro de "${idDec}"`, ids: [e.id] });
    }
    output.push(conforme('A4.4', casos, {
      medida: { elementos: solidos.length, divergencias: casos.length },
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
      const filhos = (cena.filhosDe.get(group.id) || []).map(f => f.caixa);
      if (!filhos.length) continue;
      const p = g.paddings(group.caixa, filhos);
      // O topo carrega a faixa de título, que é reserva deliberada e não desvio.
      const laterais = [p.esquerda, p.direita, p.baixo];
      const s = desvio(laterais);
      if (s > sigmaMax)
        casos.push({ o_que: `"${group.id}" tem paddings ${laterais.map(x => arredonda(x, 1)).join('/')} (σ = ${arredonda(s, 2)} > ${sigmaMax})`, ids: [group.id] });
      const kind = group.tipoSemantico || 'desconhecido';
      if (!porTipo.has(kind)) porTipo.set(kind, []);
      porTipo.get(kind).push({ id: group.id, p: media(laterais) });
    }
    for (const [kind, lista] of porTipo) {
      if (lista.length < 2) continue;
      const s = desvio(lista.map(x => x.p));
      if (s > sigmaMax)
        casos.push({ o_que: `grupos do tipo "${kind}" usam paddings diferentes entre si (σ = ${arredonda(s, 2)})`, ids: lista.map(x => x.id) });
    }
    output.push(grupos.length ? conforme('A4.5', casos, { medida: { grupos: grupos.length, irregulares: casos.length } })
      : notApplicable('A4.5', 'o diagrama não tem grupos'));
  }

  // ---------------------------------------------------------------- A4.6
  {
    const casos = [];
    let comRotulo = 0;
    for (const group of grupos) {
      const r = group.rotuloCaixa;
      if (!r || !semTags(group.label)) continue;
      comRotulo++;
      const noTopo = Math.abs(r.y - group.caixa.y) <= lim('alturaDaFaixaDeTitulo');
      const naEsquerda = r.x - group.caixa.x <= group.caixa.w / 2;
      if (!noTopo || !naEsquerda)
        casos.push({ o_que: `o rótulo de "${group.id}" não está no canto superior esquerdo`, ids: [group.id] });
      for (const filho of cena.filhosDe.get(group.id) || [])
        if (g.areaDaIntersecao(r, filho.caixa) > 0) {
          casos.push({ o_que: `o rótulo de "${group.id}" colide com o filho "${filho.id}"`, ids: [group.id, filho.id] });
          break;
        }
    }
    output.push(comRotulo ? conforme('A4.6', casos, { medida: { grupos_rotulados: comRotulo, fora_do_canone: casos.length } })
      : notApplicable('A4.6', 'nenhum grupo tem rótulo'));
  }

  // ---------------------------------------------------------------- A4.7
  {
    const teto = lim('proximidadeMaxima');
    const grupoDe = n => {
      const a = cena.ancestrais(n.id);
      return a.length ? a[0].id : '(raiz)';
    };
    const intra = [];
    const inter = [];
    for (const [a, b] of pares(nodes)) {
      const d = Math.hypot(...['x', 'y'].map(k => g.centro(a.caixa)[k] - g.centro(b.caixa)[k]));
      (grupoDe(a) === grupoDe(b) ? intra : inter).push(d);
    }
    if (!intra.length || !inter.length) output.push(notApplicable('A4.7', 'não há pares intra e inter grupo para comparar'));
    else {
      const rho = media(intra) / media(inter);
      output.push(rho <= teto
        ? ok('A4.7', { medida: { rho: arredonda(rho), intra: arredonda(media(intra), 1), inter: arredonda(media(inter), 1) }, mensagem: `ρ = ${arredonda(rho)} ≤ ${teto}` })
        : conforme('A4.7', [{ o_que: `ρ = ${arredonda(rho)} > ${teto}: nós do mesmo grupo não estão mais próximos entre si do que de nós de fora`, ids: [] }],
          { medida: { rho: arredonda(rho), intra: arredonda(media(intra), 1), inter: arredonda(media(inter), 1) } }));
    }
  }

  return output;
};
