#!/usr/bin/env node
'use strict';
/**
 * M3 — a projecao logica do modelo tecnico e MESMO a vista aprovada?
 *
 *   node tools/check-projection.cjs
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

const { aprovar, check } = require('../session/agreement.cjs');
const { elaborar } = require('../session/elaborate.cjs');
const { validar } = require('../session/validate.cjs');
const { projetar } = require('../session/project.cjs');

const RAIZ = path.join(__dirname, '..');
const clonar = o => JSON.parse(JSON.stringify(o));
const no = (m, id) => m.nodes.find(n => n.id === id);

/**
 * Sete mutacoes que a checagem TEM de pegar. Todas sao coisas que um agente
 * distraido faz na fase tecnica achando que esta so detalhando.
 */
const DEVE_QUEBRAR = [
  { name: 'tirar o casaco logico de uma capacidade aprovada',
    faz: m => { delete no(m, 'tratar-falha').logical; no(m, 'tratar-falha').layer = 'technical'; } },

  { name: 'renomear uma capacidade aprovada',
    faz: m => { no(m, 'processar-na-chegada').logical.label = 'Enriquecer e validar'; } },

  { name: 'mudar uma capacidade de fronteira',
    faz: m => { no(m, 'consultar').inside = 'processamento'; } },

  { name: 'apagar uma capacidade aprovada',
    faz: m => { m.nodes = m.nodes.filter(n => n.id !== 'tratar-falha');
                m.edges = m.edges.filter(a => a.from !== 'tratar-falha' && a.to !== 'tratar-falha'); } },

  { name: 'acrescentar capacidade que nao foi discutida',
    faz: m => { m.nodes.push({ id: 'antivirus', label: 'Varrer vírus', inside: 'aterrissagem',
                             logical: { kind: 'block' }, technical: { kind: 'service', service: 'guardduty' } }); } },

  { name: 'apagar a nota do achado RECUSADO',
    faz: m => { m.notes = m.notes.filter(n => n.id !== 'n-spof'); },
    because: 'e o canal por onde "SPOF conhecido e aceito" chega ao desenho (#15 §4)' },

  // Este nao quebra o acordo — quebra a PROJECAO, antes dela existir. Um hub so
  // tecnico com 2 entradas e 2 saidas logicas contrairia para 4 arestas, das
  // quais 2 ninguem afirmou. Sem o guarda, o desenho logico sairia inventando
  // conversa, que e exatamente a mentira calada que este mapa persegue.
  { name: 'hub so-tecnico com 2 entradas e 2 saidas logicas',
    faz: m => {
      m.edges.push({ id: 'x-in1', from: 'receber-arquivo', to: 'barramento' });
      m.edges.push({ id: 'x-in2', from: 'reter-objeto', to: 'barramento' });
      m.edges.push({ id: 'x-out', from: 'barramento', to: 'consultar' });
    },
    because: 'a contracao emitiria 4 arestas logicas com 3 afirmadas' },
];

/**
 * Cinco mutacoes que sao elaboracao tecnica LEGITIMA. Se a checagem reclamar de
 * alguma, ela esta apertada demais e vira ruido que o usuario aprende a ignorar.
 */
const NAO_PODE_QUEBRAR = [
  { name: 'acrescentar infraestrutura (no so-tecnico)',
    faz: m => { m.nodes.push({ id: 'nat', layer: 'technical', inside: 'vpc-dados',
                             technical: { kind: 'service', service: 'nat gateway', label: 'NAT gateway' } }); } },

  { name: 'trocar o servico AWS de uma capacidade',
    faz: m => { no(m, 'consultar').technical.service = 'redshift'; no(m, 'consultar').technical.label = 'Redshift'; } },

  { name: 'enfiar mais um nivel de rede e reparentar',
    faz: m => { m.nodes.push({ id: 'sub-dados', layer: 'technical', inside: 'vpc-dados',
                             technical: { kind: 'subnet', label: 'Private subnet · dados', access: 'private' } });
                no(m, 'endpoint-s3').inside = 'sub-dados'; } },

  { name: 'mudar o numero da conta',
    faz: m => { no(m, 'processamento').technical.account = '999988887777'; } },

  { name: 'dar rotulo tecnico novo a uma aresta aprovada',
    faz: m => { m.edges.find(a => a.id === 'a-grava').technical = { label: 'PutObject' }; } },
];

function main() {
  const logical = JSON.parse(fs.readFileSync(path.join(RAIZ, 'models', 'session', 'retail-logical.json'), 'utf8'));
  const elab = JSON.parse(fs.readFileSync(path.join(RAIZ, 'models', 'session', 'retail-elaboration.json'), 'utf8'));
  const aprovado = aprovar(logical, { at: '2026-08-21', by: 'usuario', candidate: 'cand-a' });
  const technical = elaborar(aprovado, elab);

  let falhas = 0;

  // -------------------------------------------------------- 1. o caso normal
  const base = check(technical);
  console.log('\n  1 · O caso normal\n');
  console.log(`    a projecao logica do modelo tecnico bate com a aprovada .... ${base.ok ? '✓' : '✗'}`);
  if (!base.ok) { falhas++; for (const d of base.diferencas) console.log(`        · ${d.text}`); }

  const pl = projetar(technical, 'logical').modelo;
  const pt = projetar(technical, 'technical').modelo;
  console.log(`    vista logica projetada .................................... ${pl.nodes.length} nos, ${pl.edges.length} arestas`);
  console.log(`    vista tecnica projetada .................................. ${pt.nodes.length} nos, ${pt.edges.length} arestas`);
  console.log(`    o modelo de sessao tem ................................... ${technical.nodes.length} nos, ${technical.edges.length} arestas`);
  console.log(`    nenhum no com casaco logico some da projecao logica ....... ` +
    `${technical.nodes.filter(n => n.logical).length === pl.nodes.length ? '✓' : '✗'}`);
  if (technical.nodes.filter(n => n.logical).length !== pl.nodes.length) falhas++;

  // A nota de no chega ate a projecao? O `else` sem chaves grudava no `if` de
  // dentro do `for` e a vista logica perdia todo `casacoLogico.nota` em
  // silencio. Uma linha de checagem para uma classe de bug que nao da erro.
  // A nota e INJETADA aqui em vez de lida do caso: se o modelo do caso parar de
  // usar `logico.nota` — e ele parou —, uma checagem que so conta o que ja
  // existe passa contando zero. Verde por vacuidade e o modo de falhar que o
  // #17 pagou caro para aprender.
  const comNota = clonar(technical);
  comNota.nodes.find(n => n.id === 'tratar-falha').logical.note = 'reprocessamento manual, por enquanto';
  const notaProjetada = projetar(comNota, 'logical').modelo.nodes.find(n => n.id === 'tratar-falha').note;
  console.log(`    a nota do casaco logico chega na projecao ................. ` +
    `${notaProjetada ? '✓' : '✗'}  (${notaProjetada ? `"${notaProjetada}"` : 'sumiu'})`);
  if (!notaProjetada) falhas++;

  // Duas arestas aprovadas DISTINTAS entre o mesmo par tem de sobreviver as
  // duas. A chave de deduplicacao ja foi so `de>para`, e nesse regime a segunda
  // sumia — nas DUAS pontas da comparacao do acordo, o que deixava a checagem
  // cega para a propria perda.
  const paralelo = clonar(technical);
  paralelo.edges.push({ id: 'a-confirma', from: 'receber-arquivo', to: 'guardar-bruto', label: 'confirma gravacao' });
  const proj = projetar(paralelo, 'logical').modelo.edges
    .filter(a => a.from === 'receber-arquivo' && a.to === 'guardar-bruto').length;
  console.log(`    duas arestas distintas no mesmo par sobrevivem ............ ${proj === 2 ? '✓' : '✗'}  (${proj} de 2)`);
  if (proj !== 2) falhas++;

  // ------------------------------------------------- 2. experimento de controle
  console.log('\n  2 · Experimento de controle — o que TEM de quebrar\n');
  for (const mut of DEVE_QUEBRAR) {
    const m = clonar(technical);
    mut.faz(m);
    // Uma mutacao pode ser pega pelo validador ANTES da projecao. Vale igual —
    // as duas camadas existem para isso, e a checagem so falharia se NENHUMA
    // pegasse.
    const v = validar(m);
    let pego = !v.ok, via = 'validator';
    let r = null;
    if (!pego) { r = check(m); pego = !r.ok; via = 'agreement'; }
    console.log(`    ${mut.name.padEnd(52)} ${pego ? '✓ pego' : '✗ PASSOU'}  (${pego ? via : '—'})`);
    if (!pego) falhas++;
    else if (r) for (const d of r.diferencas.slice(0, 2)) console.log(`        · ${d.text}`);
    else console.log(`        · ${v.erros[0].slice(0, 110)}`);
  }

  console.log('\n  3 · Experimento de controle — o que NAO PODE quebrar\n');
  for (const mut of NAO_PODE_QUEBRAR) {
    const m = clonar(technical);
    mut.faz(m);
    const v = validar(m);
    const r = v.ok ? check(m) : { ok: false, motivo: v.erros[0] };
    console.log(`    ${mut.name.padEnd(52)} ${r.ok ? '✓ passou' : '✗ QUEBROU'}`);
    if (!r.ok) { falhas++; console.log(`        · ${(r.motivo || '').slice(0, 110)}`); for (const d of r.diferencas || []) console.log(`        · ${d.text}`); }
  }

  const total = DEVE_QUEBRAR.length + NAO_PODE_QUEBRAR.length;
  console.log(falhas
    ? `\n  ✗ ${falhas} falha(s) de ${total} — a checagem esta medindo outra coisa.\n`
    : `\n  ✓ ${total}/${total}. A checagem prende o que muda o acordo e deixa passar o que so o detalha.\n`);
  return falhas ? 1 : 0;
}

process.exit(main());
