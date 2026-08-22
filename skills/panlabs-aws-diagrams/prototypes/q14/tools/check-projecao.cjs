#!/usr/bin/env node
'use strict';
/**
 * M3 — a projecao logica do modelo tecnico e MESMO a vista aprovada?
 *
 *   node tools/check-projecao.cjs
 *
 * Esta e a checagem que o ticket compra ao usar um IR so, e ela nao existiria com
 * dois modelos: com um mapeamento explicito entre um modelo logico e um tecnico,
 * "o que estou desenhando ainda e o que voce aprovou?" so se responde se o
 * mapeamento estiver certo — e nada garante que esteja. Com um modelo, e uma
 * projecao e uma comparacao de strings.
 *
 * Mas checagem verde nao prova nada sozinha. O #17 aprendeu isso do jeito caro:
 * 24 checagens estaticas estavam verdes enquanto o PNG mostrava o SageMaker com
 * o icone errado. Entao aqui vem o EXPERIMENTO DE CONTROLE, no mesmo formato que
 * o #11 usou para a fronteira: doze mutacoes do modelo tecnico, sete que TEM de
 * ser pegas e cinco que NAO PODEM ser. Se alguma sair do lugar, a
 * checagem esta medindo outra coisa.
 */

const fs = require('fs');
const path = require('path');

const { aprovar, conferir } = require('../sessao/acordo.cjs');
const { elaborar } = require('../sessao/elaborar.cjs');
const { validar } = require('../sessao/validar.cjs');
const { projetar } = require('../sessao/projetar.cjs');

const RAIZ = path.join(__dirname, '..');
const clonar = o => JSON.parse(JSON.stringify(o));
const no = (m, id) => m.nos.find(n => n.id === id);

/**
 * Seis mutacoes que MUDAM o que foi aprovado. Todas sao coisas que um agente
 * distraido faz na fase tecnica achando que esta so detalhando.
 */
const DEVE_QUEBRAR = [
  { nome: 'tirar o casaco logico de uma capacidade aprovada',
    faz: m => { delete no(m, 'tratar-falha').logico; no(m, 'tratar-falha').camada = 'tecnica'; } },

  { nome: 'renomear uma capacidade aprovada',
    faz: m => { no(m, 'processar-na-chegada').logico.rotulo = 'Enriquecer e validar'; } },

  { nome: 'mudar uma capacidade de fronteira',
    faz: m => { no(m, 'consultar').dentro = 'processamento'; } },

  { nome: 'apagar uma capacidade aprovada',
    faz: m => { m.nos = m.nos.filter(n => n.id !== 'tratar-falha');
                m.arestas = m.arestas.filter(a => a.de !== 'tratar-falha' && a.para !== 'tratar-falha'); } },

  { nome: 'acrescentar capacidade que nao foi discutida',
    faz: m => { m.nos.push({ id: 'antivirus', rotulo: 'Varrer vírus', dentro: 'aterrissagem',
                             logico: { tipo: 'bloco' }, tecnico: { tipo: 'servico', servico: 'guardduty' } }); } },

  { nome: 'apagar a nota do achado RECUSADO',
    faz: m => { m.notas = m.notas.filter(n => n.id !== 'n-spof'); },
    porque: 'e o canal por onde "SPOF conhecido e aceito" chega ao desenho (#15 §4)' },

  // Este nao quebra o acordo — quebra a PROJECAO, antes dela existir. Um hub so
  // tecnico com 2 entradas e 2 saidas logicas contrairia para 4 arestas, das
  // quais 2 ninguem afirmou. Sem o guarda, o desenho logico sairia inventando
  // conversa, que e exatamente a mentira calada que este mapa persegue.
  { nome: 'hub so-tecnico com 2 entradas e 2 saidas logicas',
    faz: m => {
      m.arestas.push({ id: 'x-in1', de: 'receber-arquivo', para: 'barramento' });
      m.arestas.push({ id: 'x-in2', de: 'reter-objeto', para: 'barramento' });
      m.arestas.push({ id: 'x-out', de: 'barramento', para: 'consultar' });
    },
    porque: 'a contracao emitiria 4 arestas logicas com 3 afirmadas' },
];

/**
 * Cinco mutacoes que sao elaboracao tecnica legitima. Se a checagem reclamar de
 * alguma, ela esta apertada demais e vira ruido que o usuario aprende a ignorar.
 */
const NAO_PODE_QUEBRAR = [
  { nome: 'acrescentar infraestrutura (no so-tecnico)',
    faz: m => { m.nos.push({ id: 'nat', camada: 'tecnica', dentro: 'vpc-dados',
                             tecnico: { tipo: 'servico', servico: 'nat gateway', rotulo: 'NAT gateway' } }); } },

  { nome: 'trocar o servico AWS de uma capacidade',
    faz: m => { no(m, 'consultar').tecnico.servico = 'redshift'; no(m, 'consultar').tecnico.rotulo = 'Redshift'; } },

  { nome: 'enfiar mais um nivel de rede e reparentar',
    faz: m => { m.nos.push({ id: 'sub-dados', camada: 'tecnica', dentro: 'vpc-dados',
                             tecnico: { tipo: 'subnet', rotulo: 'Private subnet · dados', acesso: 'privada' } });
                no(m, 'endpoint-s3').dentro = 'sub-dados'; } },

  { nome: 'mudar o numero da conta',
    faz: m => { no(m, 'processamento').tecnico.conta = '999988887777'; } },

  { nome: 'dar rotulo tecnico novo a uma aresta aprovada',
    faz: m => { m.arestas.find(a => a.id === 'a-grava').tecnico = { rotulo: 'PutObject' }; } },
];

function main() {
  const logico = JSON.parse(fs.readFileSync(path.join(RAIZ, 'modelo', 'varejo-logica.json'), 'utf8'));
  const elab = JSON.parse(fs.readFileSync(path.join(RAIZ, 'modelo', 'varejo-elaboracao.json'), 'utf8'));
  const aprovado = aprovar(logico, { em: '2026-08-21', por: 'usuario', candidata: 'cand-a' });
  const tecnico = elaborar(aprovado, elab);

  let falhas = 0;

  // -------------------------------------------------------- 1. o caso normal
  const base = conferir(tecnico);
  console.log('\n  1 · O caso normal\n');
  console.log(`    a projecao logica do modelo tecnico bate com a aprovada .... ${base.ok ? '✓' : '✗'}`);
  if (!base.ok) { falhas++; for (const d of base.diferencas) console.log(`        · ${d.texto}`); }

  const pl = projetar(tecnico, 'logica').modelo;
  const pt = projetar(tecnico, 'tecnica').modelo;
  console.log(`    vista logica projetada .................................... ${pl.nos.length} nos, ${pl.arestas.length} arestas`);
  console.log(`    vista tecnica projetada .................................. ${pt.nos.length} nos, ${pt.arestas.length} arestas`);
  console.log(`    o modelo de sessao tem ................................... ${tecnico.nos.length} nos, ${tecnico.arestas.length} arestas`);
  console.log(`    nenhum no com casaco logico some da projecao logica ....... ` +
    `${tecnico.nos.filter(n => n.logico).length === pl.nos.length ? '✓' : '✗'}`);
  if (tecnico.nos.filter(n => n.logico).length !== pl.nos.length) falhas++;

  // ------------------------------------------------- 2. experimento de controle
  console.log('\n  2 · Experimento de controle — o que TEM de quebrar\n');
  for (const mut of DEVE_QUEBRAR) {
    const m = clonar(tecnico);
    mut.faz(m);
    // Uma mutacao pode ser pega pelo validador ANTES da projecao. Vale igual —
    // as duas camadas existem para isso, e a checagem so falharia se NENHUMA
    // pegasse.
    const v = validar(m);
    let pego = !v.ok, via = 'validador';
    let r = null;
    if (!pego) { r = conferir(m); pego = !r.ok; via = 'acordo'; }
    console.log(`    ${mut.nome.padEnd(52)} ${pego ? '✓ pego' : '✗ PASSOU'}  (${pego ? via : '—'})`);
    if (!pego) falhas++;
    else if (r) for (const d of r.diferencas.slice(0, 2)) console.log(`        · ${d.texto}`);
    else console.log(`        · ${v.erros[0].slice(0, 110)}`);
  }

  console.log('\n  3 · Experimento de controle — o que NAO PODE quebrar\n');
  for (const mut of NAO_PODE_QUEBRAR) {
    const m = clonar(tecnico);
    mut.faz(m);
    const v = validar(m);
    const r = v.ok ? conferir(m) : { ok: false, motivo: v.erros[0] };
    console.log(`    ${mut.nome.padEnd(52)} ${r.ok ? '✓ passou' : '✗ QUEBROU'}`);
    if (!r.ok) { falhas++; console.log(`        · ${(r.motivo || '').slice(0, 110)}`); for (const d of r.diferencas || []) console.log(`        · ${d.texto}`); }
  }

  const total = DEVE_QUEBRAR.length + NAO_PODE_QUEBRAR.length;
  console.log(falhas
    ? `\n  ✗ ${falhas} falha(s) de ${total} — a checagem esta medindo outra coisa.\n`
    : `\n  ✓ ${total}/${total}. A checagem prende o que muda o acordo e deixa passar o que so o detalha.\n`);
  return falhas ? 1 : 0;
}

process.exit(main());
