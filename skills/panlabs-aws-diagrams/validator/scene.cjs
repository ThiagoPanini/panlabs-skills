'use strict';
/**
 * Cena — o plano do motor virado no que as checagens sabem ler.
 *
 * O plano é feito para o EMISSOR: geometria relativa ao pai, estilo como string,
 * z implícito na ordem da lista. As checagens precisam do contrário: coordenada
 * absoluta, estilo como campo, e as três classes de objeto separadas. Traduzir
 * uma vez aqui é o que impede oito famílias de reimplementarem a mesma travessia
 * de árvore com oito bugs diferentes.
 *
 * ------------------------------------------------------------------------
 * A distinção que a rubrica não tem: GRUPO e FAIXA
 * ------------------------------------------------------------------------
 *
 * A rubrica (#8) supõe uma árvore de contenção só. A4.2 diz "nenhum nó cai
 * dentro de um grupo do qual não é filho" e A4.3 diz "grupos irmãos são
 * disjuntos" — as duas com tolerância zero, e A4.2 chamada de "a falha de maior
 * gravidade semântica de todo o validador".
 *
 * Só que este motor desenha dois tipos de caixa, e o `resolve.cjs` é explícito
 * sobre o segundo: **"Uma faixa existe para CRUZAR outras caixas."** Uma faixa
 * de AZ atravessa as subnets; um Auto Scaling group abraça EC2 de duas AZs
 * distintas. Aplicar A4.2 e A4.3 sobre elas reprova o desenho correto, e reprova
 * justamente pelo motivo de maior gravidade — o validador acusaria de mentira a
 * decisão central do gerador.
 *
 * A saída não é abrir exceção, é reconhecer que as duas caixas afirmam coisas
 * diferentes:
 *
 *   GRUPO afirma CONTENÇÃO. "este nó está dentro desta VPC" é um fato de
 *   topologia de rede, e a caixa É a fronteira. Sobreposição aqui é mentira.
 *
 *   FAIXA afirma ATRIBUTO COMPARTILHADO. "estes dois nós estão nesta AZ", "estes
 *   dois escalam juntos". Não é fronteira de rede, é uma classe — e uma classe
 *   corta a árvore de contenção por definição, senão não precisaria existir.
 *
 * Então A4.2/A4.3/A5.5 valem sobre GRUPOS, e as faixas ganham a checagem que de
 * fato lhes cabe: **a faixa contém exatamente os seus membros declarados** — nem
 * um a menos (o membro ficou de fora do abraço) nem um a mais (um não-membro caiu
 * dentro e a faixa afirma dele um atributo que ele não tem). É a mesma pergunta
 * semântica de A4.2, feita contra a lista de membros em vez da relação de pai.
 *
 * Isto é um achado do #18 contra a rubrica, não uma licença: a tolerância zero
 * continua zero, só que medida contra o que a caixa afirma.
 */

const path = require('path');
const { LIMIARES } = require(path.join(__dirname, 'index.cjs'));
const color = require(path.join(__dirname, 'color.cjs'));
const geo = require(path.join(__dirname, 'geometry.cjs'));

const v = chave => LIMIARES[chave].valor;

/** Células que são moldura do documento, não conteúdo do diagrama. */
const CHROME = new Set(['title', 'subtitle', 'notes', 'panlabs-modelo']);

// -------------------------------------------------------------------- estilo

/**
 * A style string do mxGraph vira objeto.
 *
 * O formato é `chave=valor;chave=valor;` com dois detalhes que quebram um
 * `split('=')` ingênuo: o primeiro token pode ser um nome de forma sem valor
 * (`text;html=1`), e valores como `points=[[0,0],[1,0]]` e `dashPattern=8 5`
 * carregam vírgula, colchete e espaço dentro do valor.
 */
function lerEstilo(s) {
  const fora = { _flags: [] };
  for (const parte of String(s || '').split(';')) {
    const t = parte.trim();
    if (!t) continue;
    const i = t.indexOf('=');
    if (i < 0) { fora._flags.push(t); continue; }
    fora[t.slice(0, i)] = t.slice(i + 1);
  }
  return fora;
}

const num = (e, chave, padrao) => {
  const x = parseFloat(e[chave]);
  return Number.isFinite(x) ? x : padrao;
};
/** `none` e ausente são coisas diferentes de uma cor, e as duas viram `null`. */
const corDe = (e, chave) => (color.ehCor(e[chave]) ? e[chave] : null);

// -------------------------------------------------------------------- rótulo

/**
 * A caixa que o rótulo ocupa. É estimativa, e o módulo diz isso em voz alta.
 *
 * O motor reserva a faixa do rótulo por ESPAÇAMENTO (`elk.spacing.nodeNode` e o
 * padding inferior do grupo), não por geometria de célula: no plano, uma folha
 * é 78×78, que é a caixa do ícone, e o rótulo é desenhado por fora dela. Quem
 * quiser saber se dois rótulos se encostam tem de reconstruir as duas caixas.
 *
 * A constante de largura de caractere daqui é do validador, não importada do
 * motor — mas as duas caem no mesmo lugar, porque medem a mesma fonte no mesmo
 * tamanho. A independência que interessa não está na constante: está em que o
 * motor RESERVA espaço e nunca CONFERE se a reserva bastou, e é a conferência
 * que A3.2, A3.3 e A3.4 fazem. A palavra final continua sendo do render (B7).
 */
function caixaDeRotulo(caixa, label, estilo) {
  const text = String(label || '').replace(/<[^>]+>/g, '').trim();
  if (!text) return null;

  const fonte = num(estilo, 'fontSize', 12);
  const escala = fonte / 12;
  const largMax = v('larguraMaximaDeRotulo');
  const porCaractere = v('larguraMediaDeCaractere') * escala;
  const alturaLinha = v('alturaDeLinha') * escala;

  const quebra = (larg) => {
    const porLinha = Math.max(1, Math.floor(larg / porCaractere));
    let linhas = 1;
    let atual = 0;
    for (const palavra of text.split(/\s+/)) {
      const custo = palavra.length + (atual ? 1 : 0);
      if (atual + custo > porLinha && atual > 0) { linhas++; atual = palavra.length; }
      else atual += custo;
    }
    return linhas;
  };

  // Container: o rótulo mora na faixa de título, no canto superior esquerdo.
  if (estilo.container === '1') {
    // `estilo` já vem parseado: procurar "grIcon=" no JSON dele nunca casa,
    // porque serializado o par vira `"grIcon":"..."`. A chave é que se testa.
    const recuo = 'grIcon' in estilo || estilo.spacingLeft ? num(estilo, 'spacingLeft', 30) : 8;
    return {
      x: caixa.x + recuo, y: caixa.y,
      w: Math.min(caixa.w - recuo, text.length * porCaractere),
      h: v('alturaDaFaixaDeTitulo'),
      onde: 'title',
    };
  }

  // Folha com rótulo por fora: faixa centrada logo abaixo do ícone.
  if (estilo.verticalLabelPosition === 'bottom') {
    const larg = Math.min(largMax, text.length * porCaractere);
    return {
      x: caixa.x + (caixa.w - larg) / 2, y: caixa.y + caixa.h,
      w: larg, h: Math.max(v('alturaMinimaDeRotulo'), quebra(largMax) * alturaLinha),
      onde: 'abaixo',
    };
  }

  // Rótulo interno: a caixa é a própria caixa do objeto.
  return { x: caixa.x, y: caixa.y, w: caixa.w, h: caixa.h, onde: 'inside' };
}

// -------------------------------------------------------------------- aresta

/**
 * O plano guarda só as DOBRAS da aresta — as pontas o mxGraph projeta no
 * perímetro em tempo de render. Para checar A3.5 e A5.5 a polilinha precisa
 * estar inteira, então as pontas são reconstruídas do mesmo jeito que o
 * renderizador as calcularia: âncora declarada quando existe (`exitX`/`entryX`),
 * projeção no perímetro na direção do próximo ponto quando não.
 *
 * A consequência tem de ficar escrita, porque muda o que A3.6 pode afirmar: se
 * a ponta é reconstruída por projeção, ela está no perímetro POR CONSTRUÇÃO, e
 * A3.6 só tem o que medir onde a âncora foi declarada. Ver `a3` para o que a
 * checagem reporta nesse caso — o que ela não faz é passar calada fingindo ter
 * conferido.
 */
function pontaNoPerimetro(caixa, target) {
  const c = geo.centro(caixa);
  const dx = target.x - c.x;
  const dy = target.y - c.y;
  if (Math.abs(dx) < geo.EPS && Math.abs(dy) < geo.EPS) return c;
  const tx = Math.abs(dx) < geo.EPS ? Infinity : (caixa.w / 2) / Math.abs(dx);
  const ty = Math.abs(dy) < geo.EPS ? Infinity : (caixa.h / 2) / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: c.x + dx * t, y: c.y + dy * t };
}

function ancoraDeclarada(caixa, estilo, prefixo) {
  const ax = parseFloat(estilo[`${prefixo}X`]);
  const ay = parseFloat(estilo[`${prefixo}Y`]);
  if (!Number.isFinite(ax) || !Number.isFinite(ay)) return null;
  return { x: caixa.x + ax * caixa.w, y: caixa.y + ay * caixa.h, declarada: true };
}

// --------------------------------------------------------------------- cena

function criarCena(plano, opts = {}) {
  const celulas = plano.celulas || [];

  // 1. o modelo semântico, que viaja dentro do próprio plano (#2 §round-trip)
  let modelo = opts.modelo || null;
  if (!modelo) {
    const embutido = celulas.find(c => c.id === 'panlabs-modelo');
    if (embutido && embutido.data && embutido.data.panlabsModelo) {
      try { modelo = JSON.parse(embutido.data.panlabsModelo); } catch { modelo = null; }
    }
  }

  const idsDeFaixa = new Set((modelo && modelo.bands || []).map(f => f.id));
  const membrosDaFaixa = new Map((modelo && modelo.bands || []).map(f => [f.id, f.members || []]));
  const noDoModelo = new Map((modelo && modelo.nodes || []).map(n => [n.id, n]));

  // 2. coordenada absoluta, resolvendo a cadeia de pais
  const porId = new Map();
  const absoluto = new Map();
  for (const c of celulas) if (c.geo) porId.set(c.id, c);

  function abs(c) {
    if (absoluto.has(c.id)) return absoluto.get(c.id);
    let x = c.geo.x;
    let y = c.geo.y;
    const pai = porId.get(c.pai);
    if (pai) { const a = abs(pai); x += a.x; y += a.y; }
    const r = { x, y, w: c.geo.w, h: c.geo.h };
    absoluto.set(c.id, r);
    return r;
  }

  // 3. classificar. A ordem do laço é a ordem z (quem vem antes fica atrás).
  const elementos = [];
  celulas.forEach((c, z) => {
    const estilo = lerEstilo(c.style);
    if (c.kind === 'aresta') {
      elementos.push({
        id: c.id, classe: 'aresta', pai: c.pai, z, estilo, estiloBruto: c.style || '',
        label: c.label || '', from: c.from, to: c.to, dobras: c.pontos || [],
        // os mesmos campos que as caixas ganham: sem isto cada família reparseia
        // a style à mão, e A3.9 e A7.1 já divergiram no default de `fontSize`
        traco: corDe(estilo, 'strokeColor'),
        corDaFonte: corDe(estilo, 'fontColor') || '#000000',
        tamanhoDaFonte: num(estilo, 'fontSize', 12),
        negrito: estilo.fontStyle === '1' || estilo.fontStyle === '3',
        halo: corDe(estilo, 'labelBackgroundColor'),
      });
      return;
    }
    if (!c.geo) return;
    const caixa = abs(c);
    const oculto = c.visivel === false;
    let classe;
    if (oculto || CHROME.has(c.id)) classe = c.id === 'panlabs-modelo' || oculto ? 'oculto' : 'moldura';
    else if (idsDeFaixa.has(c.id) || /^az-/.test(c.id)) classe = 'faixa';
    else if (estilo.container === '1') classe = 'group';
    else if (estilo._flags.includes('text')) classe = 'moldura';
    else classe = 'no';

    elementos.push({
      id: c.id, classe, pai: c.pai, z, caixa, estilo, estiloBruto: c.style || '',
      label: c.label || '',
      tipoSemantico: (noDoModelo.get(c.id) || {}).kind || null,
      noModelo: noDoModelo.get(c.id) || null,
      members: membrosDaFaixa.get(c.id) || null,
      rotuloCaixa: caixa && !oculto ? caixaDeRotulo(caixa, c.label, estilo) : null,
      preenchimento: corDe(estilo, 'fillColor'),
      traco: corDe(estilo, 'strokeColor'),
      corDaFonte: corDe(estilo, 'fontColor') || '#000000',
      tamanhoDaFonte: num(estilo, 'fontSize', 12),
      negrito: estilo.fontStyle === '1' || estilo.fontStyle === '3',
      opacidade: num(estilo, 'opacity', 100) / 100,
    });
  });

  const from = classe => elementos.filter(e => e.classe === classe);
  const nodes = from('no');
  const grupos = from('group');
  const bands = from('faixa');
  const molduras = from('moldura');
  const edges = from('aresta');
  const caixas = [...nodes, ...grupos, ...bands];
  const porElemento = new Map(elementos.map(e => [e.id, e]));

  // 4. as faixas de AZ nascem do caminho da grade e não estão no modelo; os
  //    membros delas são os nós cuja subnet declara aquela zona.
  for (const f of bands) {
    if (f.members) continue;
    const zona = /^az-(.+)$/.exec(f.id);
    if (!zona || !modelo) { f.members = null; continue; }
    const subnets = new Set((modelo.nodes || []).filter(n => n.az === zona[1]).map(n => n.id));
    f.members = (modelo.nodes || [])
      .filter(n => subnets.has(n.id) || subnets.has(n.inside))
      .map(n => n.id)
      .filter(id => porElemento.has(id) && porElemento.get(id).classe === 'no');
  }

  // 5. a árvore de contenção DECLARADA — só grupos e nós; faixa não é pai de ninguém
  const filhosDe = new Map();
  for (const e of [...nodes, ...grupos]) {
    const pai = e.pai === '1' ? null : e.pai;
    if (!filhosDe.has(pai)) filhosDe.set(pai, []);
    filhosDe.get(pai).push(e);
  }
  function ancestrais(id) {
    const saida = [];
    let atual = porElemento.get(id);
    while (atual && atual.pai && atual.pai !== '1') {
      const pai = porElemento.get(atual.pai);
      if (!pai || saida.includes(pai)) break;
      saida.push(pai);
      atual = pai;
    }
    return saida;
  }
  const ehDescendente = (id, ancestralId) => ancestrais(id).some(a => a.id === ancestralId);

  // 6. as pontas das arestas, e a polilinha completa
  for (const a of edges) {
    const origin = porElemento.get(a.from);
    const destino = porElemento.get(a.to);
    if (!origin || !destino) { a.pontos = a.dobras.slice(); a.completa = false; continue; }
    const rumoInicio = a.dobras[0] || geo.centro(destino.caixa);
    const rumoFim = a.dobras[a.dobras.length - 1] || geo.centro(origin.caixa);
    const inicio = ancoraDeclarada(origin.caixa, a.estilo, 'exit') || pontaNoPerimetro(origin.caixa, rumoInicio);
    const fim = ancoraDeclarada(destino.caixa, a.estilo, 'entry') || pontaNoPerimetro(destino.caixa, rumoFim);
    a.pontos = [inicio, ...a.dobras, fim];
    a.completa = true;
    a.ancorada = !!(inicio.declarada && fim.declarada);
    a.comprimento = geo.comprimento(a.pontos);
    a.rotuloCaixa = a.label ? caixaDeRotuloDeAresta(a) : null;
  }

  function caixaDeRotuloDeAresta(a) {
    const text = String(a.label).replace(/<[^>]+>/g, '').trim();
    if (!text) return null;
    const fonte = num(a.estilo, 'fontSize', 12);
    const larg = text.length * v('larguraMediaDeCaractere') * (fonte / 12);
    const alt = v('alturaDeLinha') * (fonte / 12);
    const meio = pontoNoMeio(a.pontos);
    return { x: meio.x - larg / 2, y: meio.y - alt / 2, w: larg, h: alt, onde: 'aresta' };
  }

  function pontoNoMeio(pontos) {
    const total = geo.comprimento(pontos);
    let andado = 0;
    for (let i = 0; i + 1 < pontos.length; i++) {
      const d = Math.hypot(pontos[i + 1].x - pontos[i].x, pontos[i + 1].y - pontos[i].y);
      if (andado + d >= total / 2) {
        const t = d < geo.EPS ? 0 : (total / 2 - andado) / d;
        return { x: pontos[i].x + t * (pontos[i + 1].x - pontos[i].x), y: pontos[i].y + t * (pontos[i + 1].y - pontos[i].y) };
      }
      andado += d;
    }
    return pontos[0] || { x: 0, y: 0 };
  }

  /**
   * O fundo efetivo de um ponto — a decisão 4 do #18.
   *
   * Não é `plano.fundo`. Um rótulo dentro de uma subnet dentro de uma VPC dentro
   * da nuvem tem por trás a pilha inteira, e os grupos AWS desenham com
   * preenchimento próprio. A conta é: varrer as caixas em ordem z, ficar com as
   * que contêm o ponto e têm preenchimento, e compor de trás para frente com a
   * opacidade de cada uma. Medir contra o branco da página daria um contraste
   * que ninguém vê.
   *
   * `fillColor=none` — que é como as faixas e a AZ se desenham — não pinta, e
   * por isso não entra na pilha: a faixa cruza sem trocar o fundo de quem está
   * embaixo, que é exatamente o que ela promete visualmente.
   */
  function fundoEfetivoEm(ponto, ateZ = Infinity) {
    let background = plano.background || '#FFFFFF';
    for (const e of caixas) {
      if (e.z >= ateZ) continue;
      if (!e.preenchimento) continue;
      const c = e.caixa;
      if (ponto.x < c.x || ponto.x > geo.direita(c) || ponto.y < c.y || ponto.y > geo.baixo(c)) continue;
      background = color.compor(e.preenchimento, background, e.opacidade);
    }
    return background;
  }

  /**
   * O fundo efetivo sob o rótulo de um elemento, respeitando o halo se houver.
   *
   * O `+ 1` no corte de z não é detalhe: o rótulo de um grupo é desenhado DENTRO
   * da caixa dele, na faixa de título, então o preenchimento do próprio grupo é
   * o fundo daquele texto. Cortar em `e.z` exclui justamente a cor de trás e
   * mede contra a página.
   *
   * O erro tem direção perigosa. Um título `#00A4A6` sobre uma subnet `#E6F6F7`
   * dá 2,75:1, e medido contra o branco dá 3,06:1 — otimista, mas ainda reprova.
   * Já texto escuro sobre grupo escuro (`#232F3E` sobre `#232F3D`) é 1,00:1 na
   * tela e vira 13,57:1 medido contra a página: PASSA. Falso negativo na única
   * família normativa do validador.
   *
   * Para rótulo desenhado fora da caixa (folha com `verticalLabelPosition=bottom`)
   * incluir o próprio elemento não muda nada: o ponto do rótulo cai fora da
   * caixa dele, e quem decide é o teste de contenção, não o corte de z.
   */
  function fundoDoRotulo(e) {
    const halo = corDe(e.estilo, 'labelBackgroundColor');
    if (halo) return halo;
    const caixa = e.rotuloCaixa;
    if (!caixa) return plano.background || '#FFFFFF';
    return fundoEfetivoEm({ x: caixa.x + caixa.w / 2, y: caixa.y + caixa.h / 2 }, e.z + 1);
  }

  // Grau de cada nó. Mora aqui porque A5.1 (c_max), A6.1 e A8.3 querem o mesmo
  // mapa, e três cópias é onde uma delas passa a contar aresta incompleta.
  const grau = new Map();
  for (const a of edges) if (a.completa) for (const id of [a.from, a.to]) grau.set(id, (grau.get(id) || 0) + 1);

  return {
    plano, modelo, grau,
    canvas: { x: 0, y: 0, w: plano.larg, h: plano.alt },
    background: plano.background || '#FFFFFF',
    elementos, nodes, grupos, bands, molduras, edges, caixas,
    porElemento, filhosDe, ancestrais, ehDescendente,
    fundoEfetivoEm, fundoDoRotulo, pontoNoMeio,
    // a legenda ainda não existe neste motor; a cena expõe o campo para que a
    // família A1 possa dizer "ausente" em vez de estourar
    legend: plano.legend || [],
  };
}

module.exports = { criarCena, lerEstilo, caixaDeRotulo, pontaNoPerimetro };
