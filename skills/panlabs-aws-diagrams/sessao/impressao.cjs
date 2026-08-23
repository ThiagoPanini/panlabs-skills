'use strict';
/**
 * Impressoes — o que responde "o humano mexeu no arquivo?".
 *
 * Sao TRES impressoes, e a razao de serem tres e a pergunta do #14:
 *
 *   > O que acontece quando o humano editou o `.drawio` a mao entre as duas
 *   > sessoes — o modelo ainda vale? A skill detecta divergencia?
 *
 * "Detectar divergencia" com um hash do arquivo inteiro nao serve, e isto e
 * MEDIDO em `tools/medir-impressao.cjs`, nao suposto: abrir e salvar no proprio
 * draw.io, sem tocar em nada, ja reescreve o XML. Hash de arquivo acusa um
 * arquivo intocado. E, pior, ele nao distingue mover uma caixa (inofensivo) de
 * apagar um servico (o modelo virou mentira).
 *
 *   impressao do DESENHO, semantica  — o que as celulas AFIRMAM: identidade da
 *                                      forma, rotulo, pai, extremos da aresta.
 *   impressao do DESENHO, aparencia  — como elas APARECEM: geometria, ordem z e
 *                                      todo o resto do style.
 *   impressao do ACORDO              — a projecao logica que foi aprovada.
 *
 * As duas primeiras separam "mexeu" de "so ajeitou". A terceira e outra pergunta:
 * nao "o humano editou o arquivo", e "a elaboracao tecnica ainda serve o que foi
 * aprovado".
 *
 * A fronteira entre as duas primeiras nao e geometria contra o resto — e
 * AFIRMACAO contra APARENCIA, e a diferenca custou uma medicao: trocar a fonte ou
 * recolher um container nao mexe em coordenada nenhuma, e na primeira versao o
 * arquivo saia INTACTO, quer dizer, "regere a vontade" por cima do ajuste que
 * alguem fez a mao.
 *
 * ---------------------------------------------------------------------------
 * COR E SEMANTICA NUM DIAGRAMA AWS.
 *
 * O reflexo e classificar cor como cosmetico. Medido no catalogo do #17, e
 * errado: `Public subnet` e `Private subnet` tem o MESMO `shape` e o MESMO
 * `grIcon` (`mxgraph.aws4.group` + `group_security_group`) e diferem SO no hex
 * (#7AA116 verde contra #00A4A6 turquesa). A fronteira publica/privada — que e
 * exatamente a que a checagem A4.2 da rubrica (#8) existe para proteger — mora
 * na cor e em nenhum outro lugar. Uma impressao que ignora cor deixa repintar
 * uma subnet privada de publica e ainda chama o arquivo de intacto.
 *
 * Por isso a fatia semantica do style inclui `strokeColor` e `fillColor`. O
 * experimento de controle em `medir-impressao.cjs` prova que a fatia sem cor
 * deixa esse caso passar.
 */

const crypto = require('crypto');
const path = require('path');
const { esc, conferirXml, limparGremlins } = require(path.join(__dirname, '..', 'motor', 'emitir.cjs'));

const sha = s => 'sha256:' + crypto.createHash('sha256').update(s, 'utf8').digest('hex');

/** JSON com chaves em ordem — hash so vale se a serializacao for unica. */
function canonicalizar(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(canonicalizar).join(',') + ']';
  return '{' + Object.keys(v).filter(k => v[k] !== undefined).sort()
    .map(k => JSON.stringify(k) + ':' + canonicalizar(v[k])).join(',') + '}';
}

// ------------------------------------------------------------- XML -> celulas

const DESESC = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };
function desescapar(s) {
  return String(s)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&(amp|lt|gt|quot|#39|apos);/g, m => DESESC[m]);
}

/**
 * Varredura de XML suficiente para `.drawio`. Nao e um parser geral: nao ha DTD,
 * namespace nem texto misto num mxfile. Precisa aguentar o que o codec do
 * proprio app escreve na volta, que difere do que o motor escreveu — ordem de
 * atributo, aspas, tag que fecha sozinha.
 */
function varrer(xml) {
  const raiz = { nome: '#raiz', attrs: {}, filhos: [] };
  const pilha = [raiz];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/([A-Za-z_][\w.-]*)\s*>|<([A-Za-z_][\w.-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
  let m;
  while ((m = re.exec(xml))) {
    if (m[0].startsWith('<!') || m[0].startsWith('<?')) continue;
    if (m[1]) { if (pilha.length > 1) pilha.pop(); continue; }
    const attrs = {};
    for (const a of String(m[3] || '').matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
      attrs[a[1]] = desescapar(a[2] !== undefined ? a[2] : a[3]);
    const no = { nome: m[2], attrs, filhos: [] };
    pilha[pilha.length - 1].filhos.push(no);
    if (!m[4]) pilha.push(no);
  }
  return raiz;
}

function acharTodos(no, nome, out = []) {
  for (const f of no.filhos) { if (f.nome === nome) out.push(f); acharTodos(f, nome, out); }
  return out;
}

const PREFIXO = 'panlabs';
const ID_SELO = 'panlabs-modelo';

/**
 * Le as paginas de um `.drawio`. Cada pagina vira `{ id, nome, selo, celulas }`.
 * A celula do selo NAO entra em `celulas`: ela carrega a impressao do desenho, e
 * uma impressao que se inclui nunca fecha.
 */
function lerPaginas(xml) {
  const raiz = varrer(xml);
  const mxfile = acharTodos(raiz, 'mxfile')[0];
  const paginas = [];

  for (const diagrama of acharTodos(raiz, 'diagram')) {
    const modelo = acharTodos(diagrama, 'mxGraphModel')[0];
    const celulas = [];
    let selo = null;

    const container = modelo ? acharTodos(modelo, 'root')[0] : null;
    for (const filho of (container ? container.filhos : [])) {
      let id, valor, dados = null, mx;
      if (filho.nome === 'object' || filho.nome === 'UserObject') {
        id = filho.attrs.id;
        valor = filho.attrs.label;
        dados = filho.attrs;
        mx = filho.filhos.find(f => f.nome === 'mxCell');
      } else if (filho.nome === 'mxCell') {
        id = filho.attrs.id; valor = filho.attrs.value; mx = filho;
      } else continue;
      if (!mx) continue;

      // O selo se identifica pelo id OU pelo atributo de esquema — e por mais
      // nada. Aceitar qualquer atributo comecado em "panlabs" abriria um jeito
      // de a celula SUMIR das impressoes: bastava batizar um atributo qualquer
      // de `panlabsX` e a edicao daquela celula passaria despercebida. Num
      // detector de divergencia isso nao e detalhe.
      if (id === ID_SELO || (dados && dados.panlabsEsquema !== undefined)) {
        selo = {};
        for (const [k, v] of Object.entries(dados || {})) if (k.startsWith(PREFIXO)) selo[k] = v;
        continue;
      }
      if (id === '0' || id === '1') continue;

      const geo = mx.filhos.find(f => f.nome === 'mxGeometry');
      const pontos = geo ? acharTodos(geo, 'mxPoint').map(p => ({ x: +p.attrs.x || 0, y: +p.attrs.y || 0 })) : [];
      celulas.push({
        id,
        valor: valor === undefined ? '' : valor,
        style: mx.attrs.style || '',
        pai: mx.attrs.parent,
        de: mx.attrs.source, para: mx.attrs.target,
        aresta: mx.attrs.edge === '1',
        visivel: mx.attrs.visible !== '0',
        // `collapsed` nao e style nem geometria, e um container recolhido esconde
        // o que ele tem dentro. Fica na aparencia: quem recolheu quer o desenho
        // assim, e regerar por cima desfaz.
        colapsado: mx.attrs.collapsed === '1',
        geo: geo ? { x: +geo.attrs.x || 0, y: +geo.attrs.y || 0, w: +geo.attrs.width || 0, h: +geo.attrs.height || 0 } : null,
        pontos,
      });
    }
    paginas.push({ id: diagrama.attrs.id, nome: diagrama.attrs.name, selo, celulas });
  }
  return { host: mxfile ? mxfile.attrs.host : undefined, paginas };
}

// ------------------------------------------------------------- as impressoes

const chavesDeStyle = s => {
  const out = {};
  for (const p of String(s).split(';')) {
    if (!p) continue;
    const i = p.indexOf('=');
    if (i < 0) out[p] = '1'; else out[p.slice(0, i)] = p.slice(i + 1);
  }
  return out;
};

/** O que o style AFIRMA — identidade da forma e a cor, que em AWS carrega fronteira. */
const SEMANTICO_VERTICE = ['shape', 'resIcon', 'grIcon', 'container', 'strokeColor', 'fillColor', 'dashed'];
/** Numa aresta a cor e decoracao; a ponta e afirmacao de sentido. */
const SEMANTICO_ARESTA = ['startArrow', 'endArrow', 'startFill', 'endFill'];

function fatiaSemantica(c, comCor = true) {
  const k = chavesDeStyle(c.style);
  const chaves = (c.aresta ? SEMANTICO_ARESTA : SEMANTICO_VERTICE)
    .filter(x => comCor || !/Color$/.test(x));
  const forma = {};
  for (const x of chaves) if (k[x] !== undefined) forma[x] = k[x];
  return {
    id: c.id, valor: c.valor, pai: c.pai, aresta: c.aresta,
    de: c.de, para: c.para, visivel: c.visivel, forma,
  };
}

/**
 * Tudo que NAO e afirmacao: geometria, ordem no documento (que e a ordem z) e
 * todo o resto do style.
 *
 * A primeira versao chamava isto de "impressao geometrica" e so olhava x/y/w/h.
 * A medicao de `medir-impressao.cjs` derrubou: quem troca a fonte ou recolhe um
 * container nao mexe em coordenada nenhuma, e o arquivo saia como INTACTO — quer
 * dizer, "pode regerar a vontade", jogando fora o ajuste do humano em silencio.
 *
 * A fronteira certa nao e geometria contra o resto. E **o que a celula AFIRMA**
 * contra **como ela APARECE**. Duas perguntas diferentes, dois hashes:
 * a afirmacao mudou -> o modelo virou mentira; so a aparencia mudou -> alguem
 * ajeitou o desenho e regerar apaga o trabalho dele.
 */
function fatiaDeAparencia(c, i) {
  const r = n => Math.round(n);
  const k = chavesDeStyle(c.style);
  const semanticas = new Set(c.aresta ? SEMANTICO_ARESTA : SEMANTICO_VERTICE);
  const resto = {};
  for (const [chave, v] of Object.entries(k)) if (!semanticas.has(chave)) resto[chave] = v;
  return {
    id: c.id,
    // ordem z = posicao ENTRE IRMAOS, nao indice na lista plana. Ver
    // `impressaoDeAparencia`, que e quem calcula o numero.
    ordemZ: i,
    pai: c.pai === undefined || c.pai === null ? null : String(c.pai),
    colapsado: !!c.colapsado,
    geo: c.geo ? { x: r(c.geo.x), y: r(c.geo.y), w: r(c.geo.w), h: r(c.geo.h) } : null,
    pontos: c.pontos.map(p => ({ x: r(p.x), y: r(p.y) })),
    resto,
  };
}

const ordenar = cs => [...cs].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

function impressaoSemantica(celulas, opts = {}) {
  return sha(canonicalizar(ordenar(celulas).map(c => fatiaSemantica(c, opts.comCor !== false))));
}

/**
 * A ordem do documento e ordem z, entao ela entra ANTES da ordenacao por id.
 *
 * ⚠️ E a ordem que conta e ENTRE IRMAOS, nao o indice na lista plana — corrigido
 * na recertificacao do #23, com medicao.
 *
 * No mxGraph z-order E a ordem dos filhos dentro do pai: quem vem depois na lista
 * de filhos daquele pai fica por cima. O indice absoluto na serializacao e outra
 * coisa — e a ordem em que o gerador escreveu as celulas no arquivo, que pode
 * mudar sem que nada fique por cima de nada.
 *
 * Enquanto o motor tinha um caminho so, os dois numeros andavam juntos e a
 * diferenca nao aparecia. Com o caminho multi-conta do #12, o motor emite por
 * blocos (rotulos de OU, depois contas, depois arestas, depois habilitadores) e
 * o codec do proprio draw.io reescreve em profundidade — MEDIDO: abrir e salvar
 * a vista tecnica de tres contas troca 22 posicoes na lista plana e ZERO na
 * ordem de irmaos, em todos os 7 pais. Com o indice absoluto, um arquivo que
 * ninguem tocou lia como `remanejado`, que e a skill avisando "regerar apaga o
 * seu ajuste" sobre um ajuste que nao existe.
 *
 * O caso de controle continua guardado: `check-impressao.cjs` move uma celula
 * para outra posicao ENTRE IRMAOS e exige `remanejado`.
 */
function impressaoDeAparencia(celulas) {
  const entreIrmaos = new Map();
  const comOrdem = celulas.map(c => {
    const chave = c.pai === undefined || c.pai === null ? '?' : String(c.pai);
    const n = entreIrmaos.get(chave) || 0;
    entreIrmaos.set(chave, n + 1);
    return { c, i: n };
  });
  comOrdem.sort((a, b) => a.c.id < b.c.id ? -1 : a.c.id > b.c.id ? 1 : 0);
  return sha(canonicalizar(comOrdem.map(({ c, i }) => fatiaDeAparencia(c, i))));
}

/**
 * REESCREVER O SELO DE TODA PAGINA — um lugar so, porque sao duas operacoes com
 * a mesma mecanica e o mesmo invariante.
 *
 * `gravar.selar` troca a celula que o motor emitiu pelo selo da sessao;
 * `publicar.publicar` troca o selo da sessao pelo selo podado. As duas andam
 * pelas mesmas ocorrencias, contam as mesmas paginas e cobram a mesma igualdade
 * no fim. Tinham a mesma regex escrita tres vezes, ao lado de um `ID_SELO`
 * importado e nao usado: renomear a constante deixaria as duas casando com nada
 * e a poda vira no-op silencioso ate estourar na contagem.
 *
 * Aqui a regex NASCE do `ID_SELO`, entao renomear quebra alto.
 *
 * @param {string} xml
 * @param {(pagina, i) => object} faz  atributos do selo daquela pagina
 * @returns {string}
 */
function reescreverSelos(xml, faz) {
  const { paginas } = lerPaginas(xml);
  if (!paginas.length) throw new Error('XML sem pagina nenhuma');
  const re = new RegExp(`[ \\t]*<object id="${ID_SELO}"[\\s\\S]*?</object>\\n?`, 'g');
  let i = 0;
  const saida = xml.replace(re, () => {
    const p = paginas[i] || paginas[paginas.length - 1];
    const attrs = Object.entries(faz(p, i))
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}="${esc(limparGremlins(v))}"`).join(' ');
    i += 1;
    return `        <object id="${ID_SELO}" label="" ${attrs}>\n` +
      `          <mxCell style="text;html=1;" vertex="1" parent="1" visible="0">\n` +
      `            <mxGeometry x="0" y="0" width="1" height="1" as="geometry"/>\n` +
      `          </mxCell>\n` +
      `        </object>\n`;
  });
  if (i === 0) throw new Error(`o XML nao trouxe nenhuma celula ${ID_SELO} para trocar`);
  if (i !== paginas.length)
    throw new Error(`o XML tem ${paginas.length} pagina(s) mas ${i} celula(s) ${ID_SELO} — ` +
      'alguma pagina ficou sem selo');
  const erros = conferirXml(saida);
  if (erros.length) { const e = new Error('a reescrita do selo produziu XML mal formado'); e.erros = erros; throw e; }
  return { xml: saida, paginas };
}

/** A impressao que a aprovacao pendura: o recorte do acordo, canonizado. */
const impressaoDoAcordo = recorte => sha(canonicalizar(recorte));

// --------------------------------------------------------------- a diferenca

/**
 * Diferenca celula a celula. Existe porque "divergente" sozinho nao e acionavel:
 * a regra do #15 e *relata, propoe, nunca conserta calado*, e relatar exige
 * dizer O QUE mudou. Como toda celula que o motor emite tem o id de um elemento
 * do modelo, a diferenca sai no vocabulario do modelo, nao no do XML.
 */
function diferenca(antes, depois) {
  const a = new Map(antes.map(c => [c.id, c]));
  const d = new Map(depois.map(c => [c.id, c]));
  const achados = [];

  for (const [id, c] of a)
    if (!d.has(id)) achados.push({ tipo: 'sumiu', id, o: c.aresta ? 'aresta' : 'no', era: c.valor });

  for (const [id, c] of d) {
    if (!a.has(id)) { achados.push({ tipo: 'apareceu', id, o: c.aresta ? 'aresta' : 'no', virou: c.valor }); continue; }
    const antiga = a.get(id);
    const fa = fatiaSemantica(antiga), fd = fatiaSemantica(c);
    if (fa.valor !== fd.valor) achados.push({ tipo: 'rotulo', id, era: fa.valor, virou: fd.valor });
    if (fa.pai !== fd.pai) achados.push({ tipo: 'mudou-de-pai', id, era: fa.pai, virou: fd.pai });
    if (fa.de !== fd.de || fa.para !== fd.para)
      achados.push({ tipo: 'extremos', id, era: `${fa.de}->${fa.para}`, virou: `${fd.de}->${fd.para}` });
    if (fa.visivel !== fd.visivel) achados.push({ tipo: 'visibilidade', id, era: fa.visivel, virou: fd.visivel });
    if (canonicalizar(fa.forma) !== canonicalizar(fd.forma))
      achados.push({ tipo: 'forma', id, era: canonicalizar(fa.forma), virou: canonicalizar(fd.forma) });
  }
  return achados;
}

/**
 * O que a divergencia CUSTA de conserto. A classificacao nao conserta nada — ela
 * diz se o modelo tem onde guardar o que o humano desenhou.
 *
 * `absorvivel`: existe campo no `sessao@1` que expressa a mudanca. A skill pode
 *               propor a absorcao — proximo passo, uma confirmacao.
 * `opaca`:      o humano desenhou algo que o modelo nao sabe dizer. Nao ha o que
 *               absorver; ou ele descreve o que fez, ou o desenho e a verdade e
 *               o modelo foi abandonado.
 */
function classificar(achados) {
  const ONDE = {
    rotulo: 'campo `rotulo`',
    sumiu: 'tirar o elemento do modelo',
    apareceu: 'no novo — mas a skill nao sabe QUE capacidade ele serve; absorver custa uma pergunta',
    'mudou-de-pai': 'campo `dentro`',
    extremos: 'campos `de` / `para`',
  };
  return achados.map(a => {
    let onde = ONDE[a.tipo] || null;
    // Trocar o icone e expressavel: e outro `servico` do catalogo. Trocar o
    // style para algo que nao carrega icone nenhum nao e — o modelo nao tem
    // vocabulario para "uma caixa que o usuario desenhou do jeito dele".
    if (a.tipo === 'forma' && /Icon/.test(String(a.virou))) onde = 'campo `servico` ou `tipo`';
    return { ...a, classe: onde ? 'absorvivel' : 'opaca', onde };
  });
}

module.exports = {
  sha, canonicalizar, varrer, acharTodos, lerPaginas, desescapar,
  impressaoSemantica, impressaoDeAparencia, impressaoDoAcordo,
  fatiaSemantica, fatiaDeAparencia, diferenca, classificar, chavesDeStyle,
  ID_SELO, PREFIXO, reescreverSelos,
};
