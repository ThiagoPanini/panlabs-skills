#!/usr/bin/env node
'use strict';
/**
 * A privacidade do dossiê, conferida NO ARQUIVO — não no objeto.
 *
 * A checagem que valeria a pena escrever errado seria esta: comparar o objeto
 * podado com o esperado e dar-se por satisfeita. Não serve. A pergunta do #23 é
 * sobre o que alguém lê abrindo *Extras › Editar diagrama*, e o que se lê ali são
 * BYTES. Então a régua é: plantar frases inconfundíveis em cada campo que a
 * decisão manda embora, publicar, e **procurar as frases no XML**.
 *
 * O experimento de controle é a outra metade, e sem ele a checagem não prova
 * nada: as mesmas frases têm de estar presentes no arquivo de TRABALHO. Se elas
 * sumissem dos dois, a busca poderia estar errada e ninguém saberia.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const { aprovar } = require(path.join(RAIZ, 'sessao', 'acordo.cjs'));
const { elaborar } = require(path.join(RAIZ, 'sessao', 'elaborar.cjs'));
const { desenhar } = require(path.join(RAIZ, 'sessao', 'desenhar.cjs'));
const { publicar, podar, avisoDeDossie } = require(path.join(RAIZ, 'sessao', 'publicar.cjs'));
const { abrir } = require(path.join(RAIZ, 'sessao', 'abrir.cjs'));
const { lerPaginas } = require(path.join(RAIZ, 'sessao', 'impressao.cjs'));

let falhas = 0;
const ok = (cond, titulo, detalhe) => {
  console.log(`  ${cond ? '✓' : '✗'} ${titulo}${detalhe ? `  — ${detalhe}` : ''}`);
  if (!cond) falhas++;
};

/**
 * As frases plantadas. Cada uma é a marca de UM campo, e nenhuma delas se parece
 * com texto que o motor produziria sozinho — se aparecer no XML, veio do dossiê.
 */
const MARCAS = {
  'candidata descartada (porque)': 'MARCA-CANDIDATA-DESCARTADA-PORQUE',
  'candidata descartada (nome)': 'MARCA-CANDIDATA-DESCARTADA-NOME',
  'candidata escolhida (porque)': 'MARCA-CANDIDATA-ESCOLHIDA-PORQUE',
  'motivo da recusa de um achado': 'MARCA-ACHADO-RECUSADO-NOTA',
  'estacionamento (fala da reuniao)': 'MARCA-ESTACIONAMENTO-FALA',
  'procedencia de um fato (citacao)': 'MARCA-FATO-DE',
  'quem aprovou': 'MARCA-ACORDO-POR',
};

/** O que TEM de sobreviver — senão a poda virou censura e o arquivo não serve para nada. */
const FICAM = {
  'o fato em si': 'MARCA-FATO-EM-SI',
  'o nome da candidata escolhida': 'MARCA-CANDIDATA-ESCOLHIDA-NOME',
  'o rotulo de um no do desenho': 'MARCA-ROTULO-DE-NO',
};

async function main() {
  const logico = JSON.parse(fs.readFileSync(path.join(RAIZ, 'modelo', 'sessao', 'varejo-logica.json'), 'utf8'));
  const elab = JSON.parse(fs.readFileSync(path.join(RAIZ, 'modelo', 'sessao', 'varejo-elaboracao.json'), 'utf8'));

  // ---------------------------------------------------------------- 1 · planta
  const semeado = JSON.parse(JSON.stringify(logico));
  const d = semeado.dossie;
  const descartada = d.candidatas.find(c => c.estado === 'descartada');
  const escolhida = d.candidatas.find(c => c.estado === 'escolhida');
  descartada.porque = MARCAS['candidata descartada (porque)'];
  descartada.nome = MARCAS['candidata descartada (nome)'];
  escolhida.porque = MARCAS['candidata escolhida (porque)'];
  escolhida.nome = FICAM['o nome da candidata escolhida'];
  const recusado = d.achados.find(a => a.estado === 'recusado');
  recusado.nota = MARCAS['motivo da recusa de um achado'];
  d.fatos[0].procedencia = 'inferido';
  d.fatos[0].de = MARCAS['procedencia de um fato (citacao)'];
  d.fatos[0].fato = FICAM['o fato em si'];
  semeado.nos[0].rotulo = FICAM['o rotulo de um no do desenho'];

  const tecnico = elaborar(aprovar(semeado, { em: '2026-08-21', por: MARCAS['quem aprovou'] }), elab);
  // O estacionamento é plantado DEPOIS de `elaborar`: é ele quem reescreve a
  // nota de cada entrada ao devolvê-la na fase técnica (#15 §5), e plantar antes
  // mediria o texto do elaborador, não o do dossiê.
  tecnico.dossie.estacionamento[0].nota = MARCAS['estacionamento (fala da reuniao)'];

  const trabalho = (await desenhar(tecnico, 'tecnica')).xml;
  const copia = publicar(trabalho);

  // -------------------------------------------------- 2 · o controle, primeiro
  //
  // Antes de afirmar que a cópia não tem as marcas, prove que o arquivo de
  // trabalho TEM. Uma busca que não acha nada nos dois arquivos não distingue
  // "podou" de "a busca está quebrada".
  console.log('\n1 · controle: o arquivo de TRABALHO carrega tudo (é para isso que ele existe)\n');
  for (const [nome, marca] of Object.entries(MARCAS))
    ok(trabalho.includes(marca), `${nome} está no arquivo de trabalho`);

  // ------------------------------------------------------------- 3 · a poda
  console.log('\n2 · a cópia publicada: a deliberação não sai da casa\n');
  for (const [nome, marca] of Object.entries(MARCAS))
    ok(!copia.includes(marca), `${nome} NÃO está na cópia`,
      copia.includes(marca) ? 'VAZOU' : undefined);

  console.log('\n3 · e o que fica, fica — poda não é censura\n');
  for (const [nome, marca] of Object.entries(FICAM))
    ok(copia.includes(marca), `${nome} sobreviveu`);

  // as impressões continuam: são o que prova que o PNG é este arquivo
  const pubs = lerPaginas(copia).paginas;
  ok(pubs.every(p => p.selo && p.selo.panlabsSemantica && p.selo.panlabsAparencia),
    'as impressões do desenho sobreviveram em todas as páginas',
    `${pubs.length} pagina(s)`);
  ok(pubs.every(p => p.selo.panlabsRetomavel === 'nao'),
    'toda página da cópia se declara não-retomável');

  // ------------------------------------------------------- 4 · a cópia se anuncia
  console.log('\n4 · a cópia se declara, em vez de parecer um arquivo de trabalho quebrado\n');
  const a = abrir(copia);
  ok(a.nosso === true, 'a skill ainda reconhece o arquivo como dela');
  ok(a.publicado === true, 'e sabe que é uma cópia publicada');
  ok(a.sessao === null, 'não devolve sessão — não há o que retomar');
  ok(/publicada/i.test(a.porque || ''), 'e diz por quê', (a.porque || '').slice(0, 70) + '…');

  const t = abrir(trabalho);
  ok(t.publicado !== true && t.sessao !== null,
    'controle: o arquivo de trabalho continua retomando normalmente');

  // ------------------------------------------------------------- 5 · o aviso
  console.log('\n5 · o aviso de uma linha (padrão do #16: avisa, nunca bloqueia)\n');
  const aviso = avisoDeDossie(tecnico);
  ok(!!aviso && /deliberacao/i.test(aviso), 'a sessão com deliberação gera aviso', (aviso || '').slice(0, 62) + '…');
  ok(avisoDeDossie(podar(tecnico)) === null,
    'e a sessão já podada NÃO gera aviso — o aviso mede, não decora');
  const r = await desenhar(tecnico, 'logica');
  ok(r.relatorio.avisos.some(x => /Editar diagrama/.test(x)),
    'e ele chega ao relatório de quem desenhou');

  // ------------------------------------------------- 6 · a poda é determinística
  console.log('\n6 · a poda é função pura e determinística\n');
  const antes = JSON.stringify(tecnico);
  const p1 = JSON.stringify(podar(tecnico));
  ok(JSON.stringify(tecnico) === antes, 'podar não muta a sessão de quem chamou');
  ok(p1 === JSON.stringify(podar(tecnico)), 'podar duas vezes dá o mesmo resultado');
  ok(p1 === JSON.stringify(podar(JSON.parse(p1))), 'podar o já podado é no-op (idempotente)');
  ok(publicar(copia) === copia, 'publicar a cópia devolve a mesma cópia');

  console.log(falhas
    ? `\n  ✗ ${falhas} checagem(ns) falharam — o dossiê não está onde a decisão diz que está.\n`
    : '\n  ✓ a deliberação fica no arquivo de trabalho e não sai na cópia que circula.\n');
  process.exit(falhas ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
