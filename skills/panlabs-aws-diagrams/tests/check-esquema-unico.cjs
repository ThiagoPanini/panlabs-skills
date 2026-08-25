#!/usr/bin/env node
'use strict';
/**
 * UM contrato, UM arquivo — o critério de aceite que o #23 escreve como "um único
 * `esquema.json`".
 *
 * O que ele estava nomeando: quatro arquivos chamados `esquema.json` na árvore,
 * dois deles declarando o MESMO `$id` (`panlabs-aws-diagrams/modelo@1`) com
 * conteúdo divergente — o do #11, com `ou` e `habilita`, e o do #13, com
 * `qualificador`. Nesse estado o contrato do sistema depende de qual cópia o
 * `require` alcançou primeiro, que é a definição de não ter contrato.
 *
 * A consolidação não colapsa tudo num arquivo só, e vale dizer por quê: os
 * outros três `esquema.json` da árvore declaram `$id` DIFERENTES — `tema@1` é o
 * vocabulário fechado do #13, `sessao@1` é o modelo de sessão do #14,
 * `elaboracao@1` é o delta da fase técnica do #14, sem esquema até o #37. São
 * contratos distintos de camadas distintas. Juntá-los produziria um arquivo que
 * mistura públicos e não teria um dono.
 *
 * Então a regra que esta checagem trava é a mais forte que continua verdadeira:
 *
 *   1. cada `$id` aparece em EXATAMENTE UM arquivo da árvore de produção;
 *   2. o contrato do modelo (`modelo@1`) mora na RAIZ da skill, não dentro do
 *      motor — ele é o que o agente escreve, e o motor é só o primeiro leitor;
 *   3. quem carrega o esquema carrega ESSE arquivo (medido, não afirmado);
 *   4. o `modelo@1` é superconjunto dos dois que ele substituiu — nenhuma
 *      propriedade do #11 nem do #13 se perdeu na fusão;
 *   5. os QUATRO contratos existem, e nenhum é a exceção que só o exemplo do
 *      corpus descreve — o #37 fechou o `elaboracao@1` que faltava.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const REPO = path.join(RAIZ, '..', '..');

let falhas = 0;
const ok = (cond, titulo, detalhe) => {
  console.log(`  ${cond ? '✓' : '✗'} ${titulo}${detalhe ? `  — ${detalhe}` : ''}`);
  if (!cond) falhas++;
};

/** Todo .json da árvore de produção que se declare um JSON Schema. */
function esquemas(dir, fora = new Set(['prototypes', 'node_modules', 'saida'])) {
  const achados = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (fora.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { achados.push(...esquemas(p, fora)); continue; }
    if (!e.name.endsWith('.json')) continue;
    let j;
    try { j = JSON.parse(fs.readFileSync(p, 'utf8')); } catch (err) { continue; }
    if (j && typeof j === 'object' && j.$schema && j.$id) achados.push({ p, id: j.$id, j });
  }
  return achados;
}

const achados = esquemas(RAIZ);

console.log('\n1 · cada contrato num arquivo só\n');
const porId = new Map();
for (const a of achados) {
  if (!porId.has(a.id)) porId.set(a.id, []);
  porId.get(a.id).push(path.relative(RAIZ, a.p));
}
for (const [id, arquivos] of [...porId].sort())
  ok(arquivos.length === 1, `${id}`, arquivos.join(' + '));
ok(porId.size === 4, `${porId.size} contratos distintos na árvore — os QUATRO do #37, nem mais nem menos`,
  [...porId.keys()].sort().join(' · '));

console.log('\n2 · o contrato do modelo mora na raiz da skill\n');
const doModelo = porId.get('panlabs-aws-diagrams/modelo@1') || [];
ok(doModelo.length === 1 && doModelo[0] === 'esquema.json',
  'panlabs-aws-diagrams/modelo@1 está em esquema.json, na raiz',
  doModelo.join(', ') || 'não encontrado');
ok(!fs.existsSync(path.join(RAIZ, 'motor', 'esquema.json')),
  'e NÃO existe mais um esquema.json dentro do motor');

console.log('\n2b · o quarto contrato — elaboracao@1 — mora ao lado de quem o consome\n');
const daElaboracao = porId.get('panlabs-aws-diagrams/elaboracao@1') || [];
ok(daElaboracao.length === 1 && daElaboracao[0] === 'sessao/esquema-elaboracao.json',
  'panlabs-aws-diagrams/elaboracao@1 está em sessao/esquema-elaboracao.json',
  daElaboracao.join(', ') || 'não encontrado');

console.log('\n3 · é esse arquivo que o motor carrega (medido)\n');
{
  const lidos = [];
  const real = fs.readFileSync;
  fs.readFileSync = function (p, ...r) { lidos.push(String(p)); return real.call(fs, p, ...r); };
  try {
    delete require.cache[require.resolve(path.join(RAIZ, 'motor', 'gerar.cjs'))];
    require(path.join(RAIZ, 'motor', 'gerar.cjs'));
  } finally { fs.readFileSync = real; }
  const alvo = path.join(RAIZ, 'esquema.json');
  ok(lidos.includes(alvo), 'motor/gerar.cjs abriu <raiz>/esquema.json',
    lidos.filter(p => p.endsWith('esquema.json')).map(p => path.relative(RAIZ, p)).join(', ') || 'nenhum');
}

console.log('\n3b · e é esse arquivo que elaborar.cjs carrega para o delta (medido)\n');
{
  const lidos = [];
  const real = fs.readFileSync;
  fs.readFileSync = function (p, ...r) { lidos.push(String(p)); return real.call(fs, p, ...r); };
  try {
    delete require.cache[require.resolve(path.join(RAIZ, 'sessao', 'elaborar.cjs'))];
    require(path.join(RAIZ, 'sessao', 'elaborar.cjs'));
  } finally { fs.readFileSync = real; }
  const alvo = path.join(RAIZ, 'sessao', 'esquema-elaboracao.json');
  ok(lidos.includes(alvo), 'sessao/elaborar.cjs abriu sessao/esquema-elaboracao.json',
    lidos.filter(p => p.endsWith('.json')).map(p => path.relative(RAIZ, p)).join(', ') || 'nenhum');
}

console.log('\n4 · a fusão não perdeu propriedade dos dois esquemas que ela substituiu\n');
{
  const props = j => {
    const out = new Set();
    (function anda(n, caminho) {
      if (!n || typeof n !== 'object') return;
      if (n.properties) for (const k of Object.keys(n.properties)) {
        out.add(`${caminho}${k}`);
        anda(n.properties[k], `${caminho}${k}.`);
      }
      for (const k of ['items', 'then', 'else']) if (n[k]) anda(n[k], caminho);
      for (const k of ['allOf', 'anyOf', 'oneOf']) if (Array.isArray(n[k])) n[k].forEach(x => anda(x, caminho));
      if (n.definitions) for (const [k, v] of Object.entries(n.definitions)) anda(v, `${k}.`);
    })(j, '');
    return out;
  };
  const producao = props(JSON.parse(fs.readFileSync(path.join(RAIZ, 'esquema.json'), 'utf8')));
  // as duas versões que a fusão substituiu vêm do PRÓPRIO GIT, não de uma cópia
  // à mão: o que interessa é o que estava na árvore, e uma cópia poderia mentir
  /**
   * ⚠️ DOIS CAMINHOS, E O SEGUNDO É HISTÓRIA.
   *
   * No #29 os protótipos saíram da árvore da skill para `docs/aws-diagrams/`,
   * porque 18 MB deles dentro de um pacote de teto 30 MB era a diferença entre
   * publicável e não. O git guarda os dois endereços: o de hoje, e o de antes
   * do `git mv`. Tentar os dois em ordem é o que mantém esta comparação viva
   * atravessando a mudança — e ela PRECISA continuar viva, porque é a única
   * prova de que a fusão dos dois motores não perdeu propriedade de esquema.
   */
  const ENDERECOS = {
    '#11': ['docs/aws-diagrams/prototipos/q11/motor/esquema.json',
            'skills/panlabs-aws-diagrams/prototypes/q11/motor/esquema.json'],
    '#13': ['docs/aws-diagrams/prototipos/q13/motor/esquema.json',
            'skills/panlabs-aws-diagrams/prototypes/q13/motor/esquema.json'],
  };
  for (const [rot, alvos] of Object.entries(ENDERECOS)) {
    let bruto, ultimoErro;
    for (const alvo of alvos) {
      try {
        bruto = execFileSync('git', ['show', `HEAD:${alvo}`],
          { cwd: REPO, encoding: 'utf8', maxBuffer: 8 << 20 });
        break;
      } catch (e) { ultimoErro = e; }
    }
    if (!bruto) {
      const e = ultimoErro;
      /**
       * ⚠️ PULAR NÃO É PASSAR. A primeira versão fazia `continue` sem contar, e
       * então no dia em que `prototypes/` sair da árvore — que é o futuro
       * explicitamente planejado em `tools/medir-antes-depois.cjs` — a seção
       * inteira sairia verde afirmando "nada se perdeu" sem ter comparado nada.
       *
       * Aqui o pulo é FALHA, e a saída é deliberada: quando os protótipos
       * saírem, quem tirar substitui a comparação contra o git pela lista
       * congelada de propriedades (as quatro checagens logo abaixo já são o
       * começo dela) — em vez de herdar um verde vazio.
       */
      falhas++;
      console.log(`  ✗ ${rot}: não deu para ler do git (${e.message.split('\n')[0]}) — ` +
        'a comparação NÃO rodou, e um pulo silencioso aqui seria um verde vazio');
      continue;
    }
    const antigas = props(JSON.parse(bruto));
    const perdidas = [...antigas].filter(p => !producao.has(p));
    ok(perdidas.length === 0, `nenhuma propriedade do esquema do ${rot} se perdeu`,
      perdidas.length ? perdidas.join(', ') : `${antigas.size} propriedades conferidas`);
  }
  for (const nova of ['no.qualificador', 'no.ou', 'no.habilita', 'no.camada'])
    ok(producao.has(nova), `e o esquema único traz "${nova}"`);
}

console.log(falhas
  ? '\n  ✗ o contrato ainda mora em mais de um lugar.\n'
  : '\n  ✓ um contrato, um arquivo — e o motor lê o da raiz.\n');
process.exit(falhas ? 1 : 0);
