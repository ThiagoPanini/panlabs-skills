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
 * em `cena.cjs`: uma faixa afirma atributo compartilhado, não contenção, e o
 * próprio motor a desenha para cruzar caixas. O que lhes cabe — que a faixa
 * abrace exatamente os membros que declara — está em `extras.cjs`, com a mesma
 * tolerância zero.
 */

const path = require('path');
const g = require(path.join(__dirname, '..', 'geometria.cjs'));
const { lim } = require(path.join(__dirname, '..', 'indice.cjs'));
const { ok, inaplicavel, conforme, pares, media, desvio, arredonda, semTags, nome } = require(path.join(__dirname, 'comum.cjs'));


module.exports = function a4(cena) {
  const saida = [];
  const { nos, grupos } = cena;
  const solidos = [...nos, ...grupos];

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
        casos.push({ o_que: `${nome(e)} não respeita ${padding} px dentro de "${pai.id}" (${apertado})`, ids: [e.id, pai.id] });
      }
    }
    saida.push(conforme('A4.1', casos, { medida: { filhos: solidos.filter(e => cena.porElemento.get(e.pai)).length, violacoes: casos.length } }));
  }

  // ---------------------------------------------------------------- A4.2
  // A falha de maior gravidade semântica do validador inteiro.
  {
    const casos = [];
    for (const n of solidos) {
      for (const grupo of grupos) {
        if (grupo.id === n.id) continue;
        if (cena.ehDescendente(n.id, grupo.id)) continue;      // é membro: pode estar dentro
        if (cena.ehDescendente(grupo.id, n.id)) continue;      // é o contrário: o grupo é filho
        const area = g.areaDaIntersecao(n.caixa, grupo.caixa);
        if (area > 0) {
          const dentro = g.contem(grupo.caixa, n.caixa);
          casos.push({
            o_que: `${nome(n)} ${dentro ? 'está dentro' : 'invade'} de "${grupo.id}" sem ser membro — ` +
              `o desenho afirma um pertencimento de fronteira que o modelo não tem`,
            ids: [n.id, grupo.id],
          });
        }
      }
    }
    saida.push(conforme('A4.2', casos, {
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
    saida.push(candidatos.length ? conforme('A4.3', casos, { medida: { pares: candidatos.length, sobrepostos: casos.length } })
      : inaplicavel('A4.3', 'não há dois grupos irmãos para comparar'));
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
        casos.push({ o_que: `${nome(e)} é desenhado dentro de "${idGeo}" e declarado dentro de "${idDec}"`, ids: [e.id] });
    }
    saida.push(conforme('A4.4', casos, {
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
    for (const grupo of grupos) {
      const filhos = (cena.filhosDe.get(grupo.id) || []).map(f => f.caixa);
      if (!filhos.length) continue;
      const p = g.paddings(grupo.caixa, filhos);
      // O topo carrega a faixa de título, que é reserva deliberada e não desvio.
      const laterais = [p.esquerda, p.direita, p.baixo];
      const s = desvio(laterais);
      if (s > sigmaMax)
        casos.push({ o_que: `"${grupo.id}" tem paddings ${laterais.map(x => arredonda(x, 1)).join('/')} (σ = ${arredonda(s, 2)} > ${sigmaMax})`, ids: [grupo.id] });
      const tipo = grupo.tipoSemantico || 'desconhecido';
      if (!porTipo.has(tipo)) porTipo.set(tipo, []);
      porTipo.get(tipo).push({ id: grupo.id, p: media(laterais) });
    }
    for (const [tipo, lista] of porTipo) {
      if (lista.length < 2) continue;
      const s = desvio(lista.map(x => x.p));
      if (s > sigmaMax)
        casos.push({ o_que: `grupos do tipo "${tipo}" usam paddings diferentes entre si (σ = ${arredonda(s, 2)})`, ids: lista.map(x => x.id) });
    }
    saida.push(grupos.length ? conforme('A4.5', casos, { medida: { grupos: grupos.length, irregulares: casos.length } })
      : inaplicavel('A4.5', 'o diagrama não tem grupos'));
  }

  // ---------------------------------------------------------------- A4.6
  {
    const casos = [];
    let comRotulo = 0;
    for (const grupo of grupos) {
      const r = grupo.rotuloCaixa;
      if (!r || !semTags(grupo.rotulo)) continue;
      comRotulo++;
      const noTopo = Math.abs(r.y - grupo.caixa.y) <= lim('alturaDaFaixaDeTitulo');
      const naEsquerda = r.x - grupo.caixa.x <= grupo.caixa.w / 2;
      if (!noTopo || !naEsquerda)
        casos.push({ o_que: `o rótulo de "${grupo.id}" não está no canto superior esquerdo`, ids: [grupo.id] });
      for (const filho of cena.filhosDe.get(grupo.id) || [])
        if (g.areaDaIntersecao(r, filho.caixa) > 0) {
          casos.push({ o_que: `o rótulo de "${grupo.id}" colide com o filho "${filho.id}"`, ids: [grupo.id, filho.id] });
          break;
        }
    }
    saida.push(comRotulo ? conforme('A4.6', casos, { medida: { grupos_rotulados: comRotulo, fora_do_canone: casos.length } })
      : inaplicavel('A4.6', 'nenhum grupo tem rótulo'));
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
    for (const [a, b] of pares(nos)) {
      const d = Math.hypot(...['x', 'y'].map(k => g.centro(a.caixa)[k] - g.centro(b.caixa)[k]));
      (grupoDe(a) === grupoDe(b) ? intra : inter).push(d);
    }
    if (!intra.length || !inter.length) saida.push(inaplicavel('A4.7', 'não há pares intra e inter grupo para comparar'));
    else {
      const rho = media(intra) / media(inter);
      saida.push(rho <= teto
        ? ok('A4.7', { medida: { rho: arredonda(rho), intra: arredonda(media(intra), 1), inter: arredonda(media(inter), 1) }, mensagem: `ρ = ${arredonda(rho)} ≤ ${teto}` })
        : conforme('A4.7', [{ o_que: `ρ = ${arredonda(rho)} > ${teto}: nós do mesmo grupo não estão mais próximos entre si do que de nós de fora`, ids: [] }],
          { medida: { rho: arredonda(rho), intra: arredonda(media(intra), 1), inter: arredonda(media(inter), 1) } }));
    }
  }

  return saida;
};
