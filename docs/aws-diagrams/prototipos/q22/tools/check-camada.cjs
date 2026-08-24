#!/usr/bin/env node
'use strict';
/**
 * A regra de camada, isolada do pixel.
 *
 * Três famílias de caso:
 *
 *   1. a TABELA DO TICKET — os três modelos, e a ordem que um arquiteto espera,
 *      contra a ordem que o alfabeto dava. É a prova que o #22 pediu.
 *   2. a LEITURA — categoria do catálogo -> andar, mistura, escape, divergência.
 *   3. a LACUNA — onde a falta do fato recusa e onde ela só avisa.
 *
 * A coluna "alfabeto" não é decorativa: sem ela a tabela do ticket seria
 * afirmação, e com ela é comparação. Um caso em que as duas regras concordam
 * não prova nada sobre qual está valendo — e um dos três é exatamente assim.
 */

const fs = require('fs');
const path = require('path');

const Q22 = path.join(__dirname, '..');
const Q11 = path.join(Q22, '..', 'q11');
const { derivar } = require(path.join(Q11, 'motor', 'derivar.cjs'));
const camadas = require(path.join(Q11, 'motor', 'camadas.cjs'));
const dispor = require(path.join(Q11, 'motor', 'dispor.cjs'));
const resolverMod = require(path.join(Q11, 'motor', 'resolver.cjs'));
const { validar } = require(path.join(Q11, 'motor', 'validar.cjs'));
const ESQUEMA = JSON.parse(fs.readFileSync(path.join(Q11, 'motor', 'esquema.json'), 'utf8'));

const res = resolverMod.criar();
const cat = res.cat;

let falhas = 0;
const ok = (cond, titulo, detalhe) => {
  console.log(`  ${cond ? '✓' : '✗'} ${titulo}${detalhe ? `  — ${detalhe}` : ''}`);
  if (!cond) falhas++;
};

function carregar(nome, dir = 'modelo') {
  const m = JSON.parse(fs.readFileSync(path.join(Q22, dir, `${nome}.json`), 'utf8'));
  const v = validar(m, ESQUEMA);
  if (!v.ok) throw new Error(`${nome}: modelo inválido (${v.fase}) — ${v.erros[0]}`);
  return m;
}

/** A ordem dos PAPÉIS privados que a grade empilharia, de cima para baixo. */
function ordemDeLinhas(modelo) {
  const d = derivar(modelo, { cat });
  const papeis = [...camadas.papeisDeSubnet(modelo, d.t, d.camadas).values()];
  const ordemAcesso = { publica: 0, privada: 1, '?': 2 };
  return papeis
    .sort((a, b) =>
      (ordemAcesso[a.acesso] ?? 9) - (ordemAcesso[b.acesso] ?? 9) ||
      camadas.ordemDeCamada(a.camada) - camadas.ordemDeCamada(b.camada) ||
      a.rotulo.localeCompare(b.rotulo, 'pt'))
    .map(p => p.rotulo);
}

/** A ordem que a regra ANTIGA daria: exposição, depois alfabeto. É o "antes". */
function ordemAlfabetica(modelo) {
  const d = derivar(modelo, { cat });
  const papeis = [...camadas.papeisDeSubnet(modelo, d.t, d.camadas).values()];
  const ordemAcesso = { publica: 0, privada: 1, '?': 2 };
  return papeis
    .sort((a, b) =>
      (ordemAcesso[a.acesso] ?? 9) - (ordemAcesso[b.acesso] ?? 9) ||
      a.rotulo.localeCompare(b.rotulo, 'pt'))
    .map(p => p.rotulo);
}

(async () => {
// ---------------------------------------------------------------------------
console.log('\n1 · a tabela do ticket — a regra escolhida contra o placeholder alfabético\n');

const TABELA = [
  { modelo: 'app-dados', espera: ['App subnet', 'Data subnet'] },
  { modelo: 'web-dados', espera: ['Web subnet', 'Data subnet'] },
  { modelo: 'ingest-core', espera: ['Ingest subnet', 'Core subnet'] },
];

let alfabetoAcertou = 0;
for (const caso of TABELA) {
  const m = carregar(caso.modelo);
  const nova = ordemDeLinhas(m);
  const velha = ordemAlfabetica(m);
  const acertouNova = JSON.stringify(nova) === JSON.stringify(caso.espera);
  const acertouVelha = JSON.stringify(velha) === JSON.stringify(caso.espera);
  if (acertouVelha) alfabetoAcertou++;
  ok(acertouNova, `${caso.modelo.padEnd(14)} conteúdo → ${nova.join(' · ')}`,
    `alfabeto → ${velha.join(' · ')} ${acertouVelha ? '(também acerta)' : '✗ ERRA'}`);
}
ok(alfabetoAcertou === 1,
  'o alfabeto acerta exatamente 1 dos 3',
  `acertou ${alfabetoAcertou} — se acertasse os 3, a tabela não distinguiria as duas regras`);

// ---------------------------------------------------------------------------
console.log('\n2 · a leitura: categoria do catálogo → andar de rede\n');

const LEITURA = [
  ['ecs', 'containers', 'aplicacao'],
  ['ec2', 'compute', 'aplicacao'],
  ['rds', 'database', 'dados'],
  ['aurora', 'database', 'dados'],
  ['redshift', 'analytics', 'dados'],
  ['efs', 'storage', 'dados'],
  ['network load balancer', 'network_content_delivery', 'borda'],
  ['nat gateway', 'network_content_delivery', 'borda'],
  ['network firewall', 'security_identity_compliance', 'borda'],
  ['sagemaker', 'artificial_intelligence', null],
];
for (const [servico, categoriaEsperada, camadaEsperada] of LEITURA) {
  const c = camadas.categoriaDoNo({ tipo: 'servico', servico }, cat);
  const andar = c ? (camadas.CATEGORIA_CAMADA[c] || null) : null;
  ok(c === categoriaEsperada && andar === camadaEsperada,
    `${servico.padEnd(23)} ${String(c).padEnd(28)} → ${andar || '(cala — não vota)'}`);
}

// mistura: vence o mais fundo
{
  const m = carregar('tres-camadas-mistas');
  const d = derivar(m, { cat });
  const ana = d.camadas.get('ana-a');
  ok(ana.camada === 'dados' && ana.evidencia.length === 2,
    'mistura ECS + Redshift na mesma subnet → dados',
    `vence o mais fundo (${ana.evidencia.map(e => e.camada).join(' vs ')})`);
  ok(JSON.stringify(ordemDeLinhas(m)) === JSON.stringify(['Firewall subnet', 'Worker subnet', 'Analytics subnet']),
    'três andares saem na ordem de leitura de rede',
    `alfabeto daria ${ordemAlfabetica(m).join(' · ')}`);
}

// o escape: declarado vence, e a divergência é contada
{
  const m = carregar('subnet-vazia-declarada');
  const d = derivar(m, { cat });
  ok(d.camadas.get('res-a').camada === 'dados' && d.camadas.get('res-a').via === 'declarada',
    'subnet vazia com `camada` declarada → dados [declarada]');
  ok(JSON.stringify(ordemDeLinhas(m)) === JSON.stringify(['App subnet', 'Reserved subnet']),
    'e a linha declarada empilha embaixo da aplicação');

  const conflito = JSON.parse(JSON.stringify(m));
  conflito.nos.find(n => n.id === 'app-a').camada = 'dados';
  const dc = derivar(conflito, { cat });
  const c = dc.camadas.get('app-a');
  ok(c.camada === 'dados' && c.diverge === 'aplicacao',
    'declarar contra o próprio conteúdo → obedece e sinaliza',
    `declarada "dados", conteúdo diz "${c.diverge}"`);
}

// ---------------------------------------------------------------------------
console.log('\n3 · a lacuna: onde a falta do fato recusa, e onde ela só avisa\n');

{
  const m = carregar('subnet-vazia', 'recusa');
  const d = derivar(m, { cat });
  ok(d.lacunas.length === 1 && d.lacunas[0].orfaos.length === 1 &&
     d.lacunas[0].orfaos[0].papel === 'Reserved subnet' && d.lacunas[0].orfaos[0].vazio,
    'a lacuna é achada, e nomeia o papel exato',
    JSON.stringify(d.lacunas.map(l => l.orfaos.map(o => o.papel))));

  let recusou = null;
  try { await dispor.porGrade(m, d, res); }
  catch (e) { recusou = e; }
  ok(recusou !== null, 'a grade RECUSA — não desenha ordem inventada');
  ok(recusou && /Reserved subnet/.test((recusou.erros || []).join('\n')) &&
     /camada/.test((recusou.erros || []).join('\n')),
    'e a recusa diz o que falta e onde',
    recusou ? (recusou.erros || [])[1] : '');
}

// papel único: sem camada, mas sem contra quem ser ordenado → não recusa
{
  const m = carregar('subnet-vazia', 'recusa');
  const so = JSON.parse(JSON.stringify(m));
  so.nos = so.nos.filter(n => !['app-a', 'app-b', 'ecs-a', 'ecs-b'].includes(n.id));
  const d = derivar(so, { cat });
  ok(d.lacunas.length === 0,
    'papel único sem camada NÃO recusa — não há contra quem ordenar',
    'a recusa dispara onde a falta muda o desenho, e só lá');
}

// caminho do ELK: a mesma falta, e ele desenha
{
  const m = carregar('elk-sem-camada');
  const d = derivar(m, { cat });
  ok(!d.az.desenhar, 'o modelo do ELK não aciona a grade (1 AZ)');
  ok(d.lacunas.length === 1, 'a mesma lacuna existe lá');
  let erro = null;
  try { await dispor.porElk(m, d, res); } catch (e) { erro = e; }
  ok(erro === null, 'e o ELK desenha assim mesmo — avisa, não recusa');
}

// ---------------------------------------------------------------------------
console.log('\n4 · experimento de controle: a regra lê o CONTEÚDO, não o rótulo\n');

{
  // Troca os rótulos das duas linhas do web-dados, mantendo o conteúdo. Se a
  // regra estivesse lendo o nome, a ordem viraria; como ela lê o que está
  // dentro, a subnet que guarda o Aurora continua embaixo — só que agora ela se
  // chama "Web subnet".
  const m = carregar('web-dados');
  const trocado = JSON.parse(JSON.stringify(m));
  for (const n of trocado.nos)
    if (n.tipo === 'subnet') n.rotulo = n.rotulo === 'Web subnet' ? 'Data subnet' : 'Web subnet';

  const ordem = ordemDeLinhas(trocado);
  const camadaDe = r => {
    const d = derivar(trocado, { cat });
    const p = [...camadas.papeisDeSubnet(trocado, d.t, d.camadas).values()].find(x => x.rotulo === r);
    return p.camada;
  };
  ok(JSON.stringify(ordem) === JSON.stringify(['Data subnet', 'Web subnet']),
    'com os rótulos trocados, a ordem acompanha o CONTEÚDO',
    `"Data subnet" agora guarda o EC2 (${camadaDe('Data subnet')}) e sobe`);

  // E o controle do controle: se a regra fosse alfabética, este é o resultado
  // que ela daria — e ele é o MESMO nos dois modelos, o que é justamente o
  // sintoma de estar lendo a letra e não a arquitetura.
  ok(JSON.stringify(ordemAlfabetica(trocado)) === JSON.stringify(ordemAlfabetica(m)),
    'já o alfabeto dá a MESMA saída para os dois modelos',
    'trocar o conteúdo de lugar não move nada — é o sintoma de ler a letra');
}

// ---------------------------------------------------------------------------
console.log(falhas ? `\n  ✗ ${falhas} falha(s)` : '\n  ✓ a camada de rede sai do conteúdo, e o alfabeto perdeu o significado.');
process.exit(falhas ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
