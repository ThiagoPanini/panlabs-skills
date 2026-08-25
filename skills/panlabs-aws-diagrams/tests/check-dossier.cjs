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

const ROOT = path.join(__dirname, '..');
const { approve } = require(path.join(ROOT, 'session', 'agreement.cjs'));
const { elaborate } = require(path.join(ROOT, 'session', 'elaborate.cjs'));
const { draw } = require(path.join(ROOT, 'session', 'draw.cjs'));
const { publish, prune, dossierWarning, countDeliberation, DELIBERATION } =
  require(path.join(ROOT, 'session', 'publish.cjs'));
const { open } = require(path.join(ROOT, 'session', 'open.cjs'));
const { readPages, impressaoSemantica, appearanceFingerprint } =
  require(path.join(ROOT, 'session', 'fingerprint.cjs'));

let falhas = 0;
const ok = (cond, title, detail) => {
  console.log(`  ${cond ? '✓' : '✗'} ${title}${detail ? `  — ${detail}` : ''}`);
  if (!cond) falhas++;
};

/**
 * As frases plantadas SAEM DA PRÓPRIA RÉGUA — uma por campo que `DELIBERACAO`
 * manda embora, mais uma por item que ela apaga inteiro.
 *
 * Escrevê-las à mão foi o erro da primeira versão, e a revisão pegou: a lista
 * cobria 6 dos 12 campos, e `compra`, `paga`, `escolhaSe`, `erradaSe`,
 * `difereEm` e `acordo.recorte` nunca eram plantados — exatamente a fresta por
 * onde o contador e a poda tinham divergido. Derivando da régua, um campo novo
 * na poda nasce com marca plantada no mesmo commit.
 *
 * Nenhuma marca se parece com texto que o motor produziria: se aparecer no XML,
 * veio do dossiê.
 */
const marcaDe = (onde, campo) => `MARCA-${onde}-${campo}`.toUpperCase();

/** O que TEM de sobreviver — senão a poda virou censura e o arquivo não serve para nada. */
const KEPT = {
  'o fato em si': 'MARCA-FATO-EM-SI',
  'o nome da candidata escolhida': 'MARCA-CANDIDATA-ESCOLHIDA-NOME',
  'o rotulo de um no do desenho': 'MARCA-ROTULO-DE-NO',
};

async function main() {
  const logical = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'session', 'retail-logical.json'), 'utf8'));
  const elab = JSON.parse(fs.readFileSync(path.join(ROOT, 'models', 'session', 'retail-elaboration.json'), 'utf8'));

  // ---------------------------------------------------------------- 1 · planta
  const seeded = JSON.parse(JSON.stringify(logical));
  const d = seeded.dossier;
  const chosen = d.candidates.find(c => c.state === 'chosen');
  chosen.name = KEPT['o nome da candidata escolhida'];
  d.facts[0].provenance = 'inferred';
  d.facts[0].fact = KEPT['o fato em si'];
  seeded.nodes[0].label = KEPT['o rotulo de um no do desenho'];
  // `acordo` é escrito por `aprovar`, então a marca de quem aprovou entra por lá
  const POR = marcaDe('agreement', 'by');

  const technical = elaborate(approve(seeded, { at: '2026-08-21', by: POR }), elab);

  /**
   * A plantação, derivada da régua. Roda DEPOIS de `elaborar` porque é ele quem
   * reescreve a nota de cada entrada do estacionamento ao devolvê-la na fase
   * técnica (#15 §5) — plantar antes mediria o texto do elaborador.
   */
  const MARKS = {};
  const list = (dd, onde) => (Array.isArray(dd[onde]) ? dd[onde] : dd[onde] ? [dd[onde]] : []);
  for (const r of DELIBERATION) {
    for (const it of list(technical.dossier, r.onde)) {
      for (const c of r.campos) {
        // só planta onde o valor é texto: `recorte` e `difereEm` são estrutura,
        // e trocá-los por string quebraria o esquema. Para esses, a marca vai
        // DENTRO — uma chave que não existe em lugar nenhum.
        const m = marcaDe(r.onde, c);
        if (c === 'snapshot') { if (it[c]) { it[c][m] = m; MARKS[`${r.onde}.${c}`] = m; } continue; }
        if (c === 'differsIn') { if (Array.isArray(it[c])) { /* enum fechado — não plantável */ } continue; }
        it[c] = m;
        MARKS[`${r.onde}.${c}`] = m;
      }
    }
  }
  MARKS['acordo.by'] = POR;
  // e o item que some INTEIRO: uma candidata descartada, marcada no nome
  const discarded = technical.dossier.candidates.find(c => c.state === 'discarded');
  discarded.name = marcaDe('candidates', 'nome-da-descartada');
  MARKS['candidatas[descartada].nome'] = discarded.name;

  const trabalho = (await draw(technical, 'technical')).xml;
  const copia = publish(trabalho);

  // -------------------------------------------------- 2 · o controle, primeiro
  //
  // Antes de afirmar que a cópia não tem as marcas, prove que o arquivo de
  // trabalho TEM. Uma busca que não acha nada nos dois arquivos não distingue
  // "podou" de "a busca está quebrada".
  console.log(`\n1 · controle: o arquivo de TRABALHO carrega tudo — ${Object.keys(MARKS).length} campos da régua\n`);
  for (const [name, marca] of Object.entries(MARKS))
    ok(trabalho.includes(marca), `${name} está no arquivo de trabalho`);
  // e a régua tem de estar coberta: um campo novo em DELIBERACAO sem marca aqui
  // é a fresta que a revisão do #23 achou
  const previstos = DELIBERATION.flatMap(r => r.campos.filter(c => c !== 'differsIn').map(c => `${r.onde}.${c}`));
  const semMarca = previstos.filter(k => !(k in MARKS));
  ok(semMarca.length === 0, 'todo campo da régua tem marca plantada',
    semMarca.length ? `sem marca: ${semMarca.join(', ')}` : `${previstos.length} campos`);

  // ------------------------------------------------------------- 3 · a poda
  console.log('\n2 · a cópia publicada: a deliberação não sai da casa\n');
  for (const [name, marca] of Object.entries(MARKS))
    ok(!copia.includes(marca), `${name} NÃO está na cópia`,
      copia.includes(marca) ? 'VAZOU' : undefined);

  console.log('\n3 · e o que fica, fica — poda não é censura\n');
  for (const [name, marca] of Object.entries(KEPT))
    ok(copia.includes(marca), `${name} sobreviveu`);

  // as impressões continuam: são o que prova que o PNG é este arquivo
  const pubs = readPages(copia).pages;
  ok(pubs.every(p => p.seal && p.seal.panlabsSemantica && p.seal.panlabsAparencia),
    'as impressões do desenho sobreviveram em todas as páginas',
    `${pubs.length} pagina(s)`);
  ok(pubs.every(p => p.seal.panlabsRetomavel === 'nao'),
    'toda página da cópia se declara não-retomável');

  /**
   * E O DESENHO É O MESMO DESENHO — célula por célula, nas duas impressões.
   *
   * É a afirmação que a decisão inteira depende de e que seria a mais fácil de
   * quebrar sem perceber: a cópia que circula tem de ser o MESMO diagrama, não
   * um diagrama parecido. Se a poda tocasse uma coordenada ou um rótulo, o
   * usuário mandaria para fora algo que ele nunca viu na tela.
   */
  const trab = readPages(trabalho).pages;
  const mesmoDesenho = trab.length === pubs.length && trab.every((p, i) =>
    impressaoSemantica(p.celulas) === impressaoSemantica(pubs[i].celulas) &&
    appearanceFingerprint(p.celulas) === appearanceFingerprint(pubs[i].celulas));
  ok(mesmoDesenho, 'e o desenho é célula por célula o mesmo — a poda só mexe no selo',
    `${trab.length} páginas, semântica e aparência idênticas`);

  // ------------------------------------------------------- 4 · a cópia se anuncia
  console.log('\n4 · a cópia se declara, em vez de parecer um arquivo de trabalho quebrado\n');
  const a = open(copia);
  ok(a.ours === true, 'a skill ainda reconhece o arquivo como dela');
  ok(a.published === true, 'e sabe que é uma cópia publicada');
  ok(a.session === null, 'não devolve sessão — não há o que retomar');
  ok(/publicada/i.test(a.because || ''), 'e diz por quê', (a.because || '').slice(0, 70) + '…');

  const t = open(trabalho);
  ok(t.published !== true && t.session !== null,
    'controle: o arquivo de trabalho continua retomando normalmente');

  // ------------------------------------------------------------- 5 · o aviso
  console.log('\n5 · o aviso de uma linha (padrão do #16: avisa, nunca bloqueia)\n');
  const warning = dossierWarning(technical);
  ok(!!warning && /deliberacao/i.test(warning), 'a sessão com deliberação gera aviso', (warning || '').slice(0, 62) + '…');
  ok(dossierWarning(prune(technical)) === null,
    'e a sessão já podada NÃO gera aviso — o aviso mede, não decora');
  /**
   * O CONTADOR NÃO PODE CONTAR EM DOBRO nem deixar campo de fora — os dois
   * defeitos que a revisão achou, um em cada direção.
   */
  const soUmCampo = (onde, campo, valor) => {
    const t = prune(JSON.parse(JSON.stringify(technical)));
    const target = list(t.dossier, onde)[0];
    if (!target) return null;
    target[campo] = valor;
    return countDeliberation(t);
  };
  for (const r of DELIBERATION)
    for (const c of r.campos) {
      if (c === 'differsIn' || c === 'snapshot') continue;
      const n = soUmCampo(r.onde, c, 'x');
      if (n === null) continue;
      ok(n === 1, `um único "${r.onde}.${c}" conta exatamente 1`, `contou ${n}`);
    }
  const dupla = prune(JSON.parse(JSON.stringify(technical)));
  dupla.dossier.candidates.push({ id: 'z', name: 'Z', tuple: ['a', 'b', 'c', 'd', 'e'],
    state: 'discarded', because: 'x', pays: 'y' });
  ok(countDeliberation(dupla) === 1,
    'uma candidata descartada COM `porque` e `paga` conta 1, não 3',
    `contou ${countDeliberation(dupla)}`);
  const r = await draw(technical, 'logical');
  ok(r.relatorio.avisos.some(x => /Editar diagrama/.test(x)),
    'e ele chega ao relatório de quem desenhou');

  // ------------------------------------------------- 6 · a poda é determinística
  console.log('\n6 · a poda é função pura e determinística\n');
  const antes = JSON.stringify(technical);
  const p1 = JSON.stringify(prune(technical));
  ok(JSON.stringify(technical) === antes, 'podar não muta a sessão de quem chamou');
  ok(p1 === JSON.stringify(prune(technical)), 'podar duas vezes dá o mesmo resultado');
  ok(p1 === JSON.stringify(prune(JSON.parse(p1))), 'podar o já podado é no-op (idempotente)');
  ok(publish(copia) === copia, 'publicar a cópia devolve a mesma cópia');

  console.log(falhas
    ? `\n  ✗ ${falhas} checagem(ns) falharam — o dossiê não está onde a decisão diz que está.\n`
    : '\n  ✓ a deliberação fica no arquivo de trabalho e não sai na cópia que circula.\n');
  process.exit(falhas ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
