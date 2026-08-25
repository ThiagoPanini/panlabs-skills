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

const RESERVED = new Set(['definitions', '$schema', '$id', 'title', 'description', 'default']);

// ----------------------------------------------------------- 1. esquema

function resolverRef(ref, raiz) {
  if (!ref.startsWith('#/')) throw new Error('$ref externo não suportado: ' + ref);
  return ref.slice(2).split('/').reduce((o, k) => o[k], raiz);
}

/** Valida `dado` contra `esq`. Devolve lista de erros (vazia = válido). */
function againstSchema(dado, esq, raiz, caminho = '') {
  const erros = [];
  const onde = caminho || '(raiz)';

  if (esq.$ref) return againstSchema(dado, resolverRef(esq.$ref, raiz), raiz, caminho);

  if (esq.const !== undefined && dado !== esq.const)
    erros.push(`${onde}: esperado o literal ${JSON.stringify(esq.const)}, veio ${JSON.stringify(dado)}`);

  if (esq.enum && !esq.enum.includes(dado))
    erros.push(`${onde}: ${JSON.stringify(dado)} não está em [${esq.enum.join(', ')}]`);

  if (esq.type) {
    const tipoDe = v => Array.isArray(v) ? 'array' : v === null ? 'null'
      : Number.isInteger(v) ? 'integer' : typeof v;
    const t = tipoDe(dado);
    // `type` como LISTA é draft-07 legítimo e o #11 não precisou dele; o esquema
    // do tema precisa (`revisao` é string ou null). Uma união de tipos passa se
    // qualquer membro passar.
    const aceita = target => target === 'integer' ? t === 'integer'
      : target === 'number' ? (t === 'integer' || t === 'number')
      : t === target;
    const alvos = Array.isArray(esq.type) ? esq.type : [esq.type];
    if (!alvos.some(aceita)) {
      erros.push(`${onde}: esperado ${alvos.join(' ou ')}, veio ${t}`);
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
    if (esq.items) dado.forEach((v, i) => erros.push(...againstSchema(v, esq.items, raiz, `${onde}[${i}]`)));
  }

  if (dado && typeof dado === 'object' && !Array.isArray(dado)) {
    for (const req of esq.required || [])
      if (!(req in dado)) erros.push(`${onde}: falta a propriedade obrigatória "${req}"`);

    if (esq.properties) {
      for (const [k, sub] of Object.entries(esq.properties))
        if (k in dado) erros.push(...againstSchema(dado[k], sub, raiz, caminho ? `${caminho}.${k}` : k));
    }

    // `patternProperties` — chave que casa com um padrão vale como declarada, e o
    // valor dela é validado contra o sub-esquema do padrão. Sem isto, um esquema
    // fechado só sabe ENUMERAR, e enumerar comentário livre é contradição: foi o
    // que reprovou `_conferir` num artefato de caso que o `_`, `_reparenta` e
    // `_refina` da lista não cobriam.
    const patterns = Object.entries(esq.patternProperties || {}).map(([p, sub]) => [new RegExp(p), sub]);
    for (const [re, sub] of patterns)
      for (const k of Object.keys(dado))
        if (re.test(k) && !(esq.properties && k in esq.properties))
          erros.push(...againstSchema(dado[k], sub, raiz, caminho ? `${caminho}.${k}` : k));

    if (esq.additionalProperties === false && esq.properties) {
      for (const k of Object.keys(dado))
        if (!(k in esq.properties) && !RESERVED.has(k) && !patterns.some(([re]) => re.test(k)))
          erros.push(`${onde}: propriedade desconhecida "${k}"` + suggestion(k, Object.keys(esq.properties)));
    }
  }

  for (const sub of esq.allOf || []) erros.push(...againstSchema(dado, sub, raiz, caminho));

  if (esq.if) {
    const casa = againstSchema(dado, esq.if, raiz, caminho).length === 0;
    if (casa && esq.then) erros.push(...againstSchema(dado, esq.then, raiz, caminho));
    if (!casa && esq.else) erros.push(...againstSchema(dado, esq.else, raiz, caminho));
  }

  return erros;
}

/** "propriedade desconhecida" sem dica é um beco sem saída para quem escreve o modelo. */
function suggestion(errada, validas) {
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
  const ceiling = Math.min(3, Math.max(1, Math.floor(errada.length / 2)));
  const perto = validas.map(v => [v, dist(errada, v)]).filter(([, d]) => d <= ceiling).sort((a, b) => a[1] - b[1])[0];
  return perto ? ` — você quis dizer "${perto[0]}"?` : ` (válidas: ${validas.join(', ')})`;
}

// ------------------------------------------------------- 2. referências

const CONTAINERS = new Set(['cloud', 'account', 'region', 'vpc', 'subnet', 'security-group', 'group']);
const LEAVES = new Set(['service', 'block', 'actor']);

function references(m) {
  const erros = [];
  const byId = new Map();

  for (const n of m.nodes) {
    if (byId.has(n.id)) erros.push(`nós: id duplicado "${n.id}"`);
    byId.set(n.id, n);
  }

  for (const n of m.nodes) {
    if (n.inside === undefined) continue;
    const parent = byId.get(n.inside);
    if (!parent) { erros.push(`nó "${n.id}": dentro="${n.inside}" não existe`); continue; }
    if (!CONTAINERS.has(parent.kind))
      erros.push(`nó "${n.id}": dentro="${n.inside}" é do tipo "${parent.kind}", que é folha e não contém nada`);
  }

  // ciclo: subir a cadeia de pais a partir de cada nó
  for (const n of m.nodes) {
    const visto = new Set([n.id]);
    let cur = n;
    while (cur && cur.inside !== undefined) {
      if (visto.has(cur.inside)) { erros.push(`contenção cíclica passando por "${n.id}"`); break; }
      visto.add(cur.inside);
      cur = byId.get(cur.inside);
    }
  }

  for (const [i, a] of (m.edges || []).entries()) {
    for (const tip of ['from', 'to']) {
      const target = byId.get(a[tip]);
      if (!target) { erros.push(`aresta[${i}]: ${tip}="${a[tip]}" não existe`); continue; }
      if (CONTAINERS.has(target.kind))
        erros.push(`aresta[${i}]: ${tip}="${a[tip]}" é um container ("${target.kind}"). ` +
          `Aresta que termina num container afirma que TUDO lá dentro participa — se é isso mesmo, ` +
          `dê a ela um nó concreto (ex.: o gateway da VPC).`);
    }
    if (a.from === a.to) erros.push(`aresta[${i}]: laço de "${a.from}" para si mesmo`);
  }

  for (const [i, f] of (m.bands || []).entries()) {
    for (const id of f.members)
      if (!byId.has(id)) erros.push(`faixa "${f.id}": membro "${id}" não existe`);
    // Membros em PAIS diferentes é o ponto da faixa — ela existe para cruzar a
    // árvore (#19). O que quebra é membro em PROFUNDIDADE diferente: a união de
    // uma subnet com um EC2 que vive dentro de outra subnet produz uma caixa
    // que engole o pai de um dos dois.
    const prof = id => { let d = 0, c = byId.get(id); while (c && c.inside !== undefined) { d++; c = byId.get(c.inside); } return d; };
    const niveis = new Set(f.members.filter(id => byId.has(id)).map(prof));
    if (niveis.size > 1)
      erros.push(`faixa "${f.id}": membros em profundidades diferentes da árvore (${[...niveis].sort().join(' e ')}). ` +
        `A faixa é a união dos membros; misturar níveis produz uma caixa que engole o pai de um deles.`);
  }

  for (const [i, nt] of (m.notes || []).entries())
    if (nt.about !== undefined && !byId.has(nt.about))
      erros.push(`nota[${i}]: sobre="${nt.about}" não existe`);

  // habilitador de permissão (#6 E9): o alvo tem de existir, e não pode ser o
  // próprio habilitador — um IAM role que autoriza a si mesmo é seta em círculo
  for (const n of m.nodes) {
    if (n.enables === undefined) continue;
    if (!byId.has(n.enables))
      erros.push(`nó "${n.id}": habilita="${n.enables}" não existe`);
    else if (n.enables === n.id)
      erros.push(`nó "${n.id}": habilita a si mesmo`);
  }

  return { erros, byId };
}

// ---------------------------------------------------------- 3. domínio

function dominio(m, byId) {
  const erros = [];
  const avisos = [];
  const parent = n => n.inside === undefined ? null : byId.get(n.inside);
  const ancestrais = n => { const out = []; let c = parent(n); while (c) { out.push(c); c = parent(c); } return out; };

  for (const n of m.nodes) {
    // Uma conta dentro de outra conta não existe na AWS: a árvore do
    // Organizations vai OU › OU › conta, e a conta é sempre folha dessa árvore.
    // Como a OU aqui é dimensão e não container (#12), conta aninhada em conta
    // só pode ser erro de modelagem — e desenhada leria como fronteira de posse
    // dentro de fronteira de posse, que é uma rede que não existe.
    if (n.kind === 'account' && ancestrais(n).some(a => a.kind === 'account'))
      erros.push(`nó "${n.id}": conta dentro de conta. A OU é dimensão ("ou"), não um nível de contenção (#12).`);

    if (n.kind === 'subnet' && !ancestrais(n).some(a => a.kind === 'vpc'))
      erros.push(`nó "${n.id}": subnet fora de qualquer VPC. A árvore de contenção é Cloud › VPC › Subnet (#19).`);

    if (n.kind === 'service' && m.view === 'logical')
      erros.push(`nó "${n.id}": tipo "servico" na vista lógica. A vista lógica é pré-serviços — use "bloco". ` +
        `Nome de serviço dito cedo demais vai para o estacionamento do dossiê (#15), não para o desenho.`);

    if (n.kind === 'block' && m.view === 'technical')
      avisos.push(`nó "${n.id}": "bloco" na vista técnica — capacidade que ainda não virou serviço.`);

    if (n.kind === 'subnet' && !n.access)
      avisos.push(`nó "${n.id}": subnet sem "acesso". Sem isso o desenho não distingue pública de privada, ` +
        `que é justamente a fronteira que a rubrica A4.2 cobra.`);
  }

  // A veracidade que o desenho pode afirmar sozinho: uma única AZ declarada num
  // modelo com várias subnets do mesmo papel sugere redundância que não existe.
  const azs = new Set(m.nodes.filter(n => n.az).map(n => n.az));
  const subnets = m.nodes.filter(n => n.kind === 'subnet');
  if (subnets.length > 1 && azs.size === 1)
    avisos.push(`todas as ${subnets.length} subnets estão em "${[...azs][0]}". ` +
      `Se a intenção era multi-AZ, falta a dimensão "az" nas outras.`);
  if (subnets.length && subnets.some(s => !s.az) && azs.size)
    avisos.push(`há subnet com "az" e subnet sem. A faixa de AZ derivada só enxerga as que declaram.`);

  return { erros, avisos };
}

// ------------------------------------------------------------ fachada

function validate(model, schema) {
  const deForma = againstSchema(model, schema, schema);
  if (deForma.length) return { ok: false, erros: deForma, avisos: [], fase: 'schema' };

  const { erros: deRef, byId } = references(model);
  if (deRef.length) return { ok: false, erros: deRef, avisos: [], fase: 'referências', byId };

  const { erros: deDom, avisos } = dominio(model, byId);
  if (deDom.length) return { ok: false, erros: deDom, avisos, fase: 'domínio', byId };

  return { ok: true, erros: [], avisos, fase: null, byId };
}

module.exports = { validate, againstSchema, CONTAINERS, LEAVES };
