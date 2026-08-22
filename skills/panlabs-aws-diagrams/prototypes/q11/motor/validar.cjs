'use strict';
/**
 * Validação do modelo — três camadas, e a ordem entre elas importa.
 *
 *   1. esquema      — forma. Um validador draft-07 de subconjunto, escrito à mão.
 *   2. referências  — `dentro`, `de`/`para`, `membros`, `sobre` apontam para nós que existem,
 *                     e a contenção é mesmo uma árvore.
 *   3. domínio      — o que só faz sentido em arquitetura AWS: subnet fora de VPC,
 *                     serviço na vista lógica, AZ afirmada sem ser subnet.
 *
 * Por que um validador à mão em vez de `ajv`: a premissa 7 do mapa exige a skill
 * auto-contida, sem `npm install` em runtime. Cada dependência embarcada é peso
 * que a skill carrega para sempre. O `elkjs` (1,6 MB) paga o próprio preço porque
 * layout é matemática que não se improvisa; um validador do subconjunto que ESTE
 * esquema usa cabe em ~150 linhas e não paga a mesma conta.
 */

const RESERVADO = new Set(['definitions', '$schema', '$id', 'title', 'description', 'default']);

// ----------------------------------------------------------- 1. esquema

function resolverRef(ref, raiz) {
  if (!ref.startsWith('#/')) throw new Error('$ref externo não suportado: ' + ref);
  return ref.slice(2).split('/').reduce((o, k) => o[k], raiz);
}

/** Valida `dado` contra `esq`. Devolve lista de erros (vazia = válido). */
function contraEsquema(dado, esq, raiz, caminho = '') {
  const erros = [];
  const onde = caminho || '(raiz)';

  if (esq.$ref) return contraEsquema(dado, resolverRef(esq.$ref, raiz), raiz, caminho);

  if (esq.const !== undefined && dado !== esq.const)
    erros.push(`${onde}: esperado o literal ${JSON.stringify(esq.const)}, veio ${JSON.stringify(dado)}`);

  if (esq.enum && !esq.enum.includes(dado))
    erros.push(`${onde}: ${JSON.stringify(dado)} não está em [${esq.enum.join(', ')}]`);

  if (esq.type) {
    const tipoDe = v => Array.isArray(v) ? 'array' : v === null ? 'null'
      : Number.isInteger(v) ? 'integer' : typeof v;
    const t = tipoDe(dado);
    const ok = esq.type === 'integer' ? t === 'integer'
      : esq.type === 'number' ? (t === 'integer' || t === 'number')
      : t === esq.type;
    if (!ok) {
      erros.push(`${onde}: esperado ${esq.type}, veio ${t}`);
      return erros;   // sem o tipo certo, as checagens abaixo só produzem ruído
    }
  }

  if (typeof dado === 'string') {
    if (esq.minLength !== undefined && dado.length < esq.minLength)
      erros.push(`${onde}: string vazia ou curta demais (mínimo ${esq.minLength})`);
    if (esq.maxLength !== undefined && dado.length > esq.maxLength)
      erros.push(`${onde}: string longa demais (máximo ${esq.maxLength})`);
    if (esq.pattern && !new RegExp(esq.pattern).test(dado))
      erros.push(`${onde}: ${JSON.stringify(dado)} não casa com /${esq.pattern}/`);
  }

  if (typeof dado === 'number' && esq.minimum !== undefined && dado < esq.minimum)
    erros.push(`${onde}: ${dado} é menor que o mínimo ${esq.minimum}`);

  if (Array.isArray(dado)) {
    if (esq.minItems !== undefined && dado.length < esq.minItems)
      erros.push(`${onde}: precisa de pelo menos ${esq.minItems} item(ns), tem ${dado.length}`);
    if (esq.items) dado.forEach((v, i) => erros.push(...contraEsquema(v, esq.items, raiz, `${onde}[${i}]`)));
  }

  if (dado && typeof dado === 'object' && !Array.isArray(dado)) {
    for (const req of esq.required || [])
      if (!(req in dado)) erros.push(`${onde}: falta a propriedade obrigatória "${req}"`);

    if (esq.properties) {
      for (const [k, sub] of Object.entries(esq.properties))
        if (k in dado) erros.push(...contraEsquema(dado[k], sub, raiz, caminho ? `${caminho}.${k}` : k));
    }

    if (esq.additionalProperties === false && esq.properties) {
      for (const k of Object.keys(dado))
        if (!(k in esq.properties) && !RESERVADO.has(k))
          erros.push(`${onde}: propriedade desconhecida "${k}"` + sugestao(k, Object.keys(esq.properties)));
    }
  }

  for (const sub of esq.allOf || []) erros.push(...contraEsquema(dado, sub, raiz, caminho));

  if (esq.if) {
    const casa = contraEsquema(dado, esq.if, raiz, caminho).length === 0;
    if (casa && esq.then) erros.push(...contraEsquema(dado, esq.then, raiz, caminho));
    if (!casa && esq.else) erros.push(...contraEsquema(dado, esq.else, raiz, caminho));
  }

  return erros;
}

/** "propriedade desconhecida" sem dica é um beco sem saída para quem escreve o modelo. */
function sugestao(errada, validas) {
  const dist = (a, b) => {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 0; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  };
  // O limiar acompanha o tamanho da chave: com um teto fixo de 3, a chave "x"
  // "casaria" com "id" e a dica viraria ruído. Chave curta exige acerto quase
  // exato para merecer sugestão.
  const teto = Math.min(3, Math.max(1, Math.floor(errada.length / 2)));
  const perto = validas.map(v => [v, dist(errada, v)]).filter(([, d]) => d <= teto).sort((a, b) => a[1] - b[1])[0];
  return perto ? ` — você quis dizer "${perto[0]}"?` : ` (válidas: ${validas.join(', ')})`;
}

// ------------------------------------------------------- 2. referências

const CONTEINERES = new Set(['nuvem', 'conta', 'regiao', 'vpc', 'subnet', 'grupo-seguranca', 'grupo']);
const FOLHAS = new Set(['servico', 'bloco', 'ator']);

function referencias(m) {
  const erros = [];
  const porId = new Map();

  for (const n of m.nos) {
    if (porId.has(n.id)) erros.push(`nós: id duplicado "${n.id}"`);
    porId.set(n.id, n);
  }

  for (const n of m.nos) {
    if (n.dentro === undefined) continue;
    const pai = porId.get(n.dentro);
    if (!pai) { erros.push(`nó "${n.id}": dentro="${n.dentro}" não existe`); continue; }
    if (!CONTEINERES.has(pai.tipo))
      erros.push(`nó "${n.id}": dentro="${n.dentro}" é do tipo "${pai.tipo}", que é folha e não contém nada`);
  }

  // ciclo: subir a cadeia de pais a partir de cada nó
  for (const n of m.nos) {
    const visto = new Set([n.id]);
    let cur = n;
    while (cur && cur.dentro !== undefined) {
      if (visto.has(cur.dentro)) { erros.push(`contenção cíclica passando por "${n.id}"`); break; }
      visto.add(cur.dentro);
      cur = porId.get(cur.dentro);
    }
  }

  for (const [i, a] of (m.arestas || []).entries()) {
    for (const ponta of ['de', 'para']) {
      const alvo = porId.get(a[ponta]);
      if (!alvo) { erros.push(`aresta[${i}]: ${ponta}="${a[ponta]}" não existe`); continue; }
      if (CONTEINERES.has(alvo.tipo))
        erros.push(`aresta[${i}]: ${ponta}="${a[ponta]}" é um container ("${alvo.tipo}"). ` +
          `Aresta que termina num container afirma que TUDO lá dentro participa — se é isso mesmo, ` +
          `dê a ela um nó concreto (ex.: o gateway da VPC).`);
    }
    if (a.de === a.para) erros.push(`aresta[${i}]: laço de "${a.de}" para si mesmo`);
  }

  for (const [i, f] of (m.faixas || []).entries()) {
    for (const id of f.membros)
      if (!porId.has(id)) erros.push(`faixa "${f.id}": membro "${id}" não existe`);
    // Membros em PAIS diferentes é o ponto da faixa — ela existe para cruzar a
    // árvore (#19). O que quebra é membro em PROFUNDIDADE diferente: a união de
    // uma subnet com um EC2 que vive dentro de outra subnet produz uma caixa
    // que engole o pai de um dos dois.
    const prof = id => { let d = 0, c = porId.get(id); while (c && c.dentro !== undefined) { d++; c = porId.get(c.dentro); } return d; };
    const niveis = new Set(f.membros.filter(id => porId.has(id)).map(prof));
    if (niveis.size > 1)
      erros.push(`faixa "${f.id}": membros em profundidades diferentes da árvore (${[...niveis].sort().join(' e ')}). ` +
        `A faixa é a união dos membros; misturar níveis produz uma caixa que engole o pai de um deles.`);
  }

  for (const [i, nt] of (m.notas || []).entries())
    if (nt.sobre !== undefined && !porId.has(nt.sobre))
      erros.push(`nota[${i}]: sobre="${nt.sobre}" não existe`);

  // habilitador de permissão (#6 E9): o alvo tem de existir, e não pode ser o
  // próprio habilitador — um IAM role que autoriza a si mesmo é seta em círculo
  for (const n of m.nos) {
    if (n.habilita === undefined) continue;
    if (!porId.has(n.habilita))
      erros.push(`nó "${n.id}": habilita="${n.habilita}" não existe`);
    else if (n.habilita === n.id)
      erros.push(`nó "${n.id}": habilita a si mesmo`);
  }

  return { erros, porId };
}

// ---------------------------------------------------------- 3. domínio

function dominio(m, porId) {
  const erros = [];
  const avisos = [];
  const pai = n => n.dentro === undefined ? null : porId.get(n.dentro);
  const ancestrais = n => { const out = []; let c = pai(n); while (c) { out.push(c); c = pai(c); } return out; };

  for (const n of m.nos) {
    // Uma conta dentro de outra conta não existe na AWS: a árvore do
    // Organizations vai OU › OU › conta, e a conta é sempre folha dessa árvore.
    // Como a OU aqui é dimensão e não container (#12), conta aninhada em conta
    // só pode ser erro de modelagem — e desenhada leria como fronteira de posse
    // dentro de fronteira de posse, que é uma rede que não existe.
    if (n.tipo === 'conta' && ancestrais(n).some(a => a.tipo === 'conta'))
      erros.push(`nó "${n.id}": conta dentro de conta. A OU é dimensão ("ou"), não um nível de contenção (#12).`);

    if (n.tipo === 'subnet' && !ancestrais(n).some(a => a.tipo === 'vpc'))
      erros.push(`nó "${n.id}": subnet fora de qualquer VPC. A árvore de contenção é Cloud › VPC › Subnet (#19).`);

    if (n.tipo === 'servico' && m.vista === 'logica')
      erros.push(`nó "${n.id}": tipo "servico" na vista lógica. A vista lógica é pré-serviços — use "bloco". ` +
        `Nome de serviço dito cedo demais vai para o estacionamento do dossiê (#15), não para o desenho.`);

    if (n.tipo === 'bloco' && m.vista === 'tecnica')
      avisos.push(`nó "${n.id}": "bloco" na vista técnica — capacidade que ainda não virou serviço.`);

    if (n.tipo === 'subnet' && !n.acesso)
      avisos.push(`nó "${n.id}": subnet sem "acesso". Sem isso o desenho não distingue pública de privada, ` +
        `que é justamente a fronteira que a rubrica A4.2 cobra.`);
  }

  // A veracidade que o desenho pode afirmar sozinho: uma única AZ declarada num
  // modelo com várias subnets do mesmo papel sugere redundância que não existe.
  const azs = new Set(m.nos.filter(n => n.az).map(n => n.az));
  const subnets = m.nos.filter(n => n.tipo === 'subnet');
  if (subnets.length > 1 && azs.size === 1)
    avisos.push(`todas as ${subnets.length} subnets estão em "${[...azs][0]}". ` +
      `Se a intenção era multi-AZ, falta a dimensão "az" nas outras.`);
  if (subnets.length && subnets.some(s => !s.az) && azs.size)
    avisos.push(`há subnet com "az" e subnet sem. A faixa de AZ derivada só enxerga as que declaram.`);

  return { erros, avisos };
}

// ------------------------------------------------------------ fachada

function validar(modelo, esquema) {
  const deForma = contraEsquema(modelo, esquema, esquema);
  if (deForma.length) return { ok: false, erros: deForma, avisos: [], fase: 'esquema' };

  const { erros: deRef, porId } = referencias(modelo);
  if (deRef.length) return { ok: false, erros: deRef, avisos: [], fase: 'referências', porId };

  const { erros: deDom, avisos } = dominio(modelo, porId);
  if (deDom.length) return { ok: false, erros: deDom, avisos, fase: 'domínio', porId };

  return { ok: true, erros: [], avisos, fase: null, porId };
}

module.exports = { validar, contraEsquema, CONTEINERES, FOLHAS };
