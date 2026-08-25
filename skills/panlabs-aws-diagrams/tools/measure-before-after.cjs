#!/usr/bin/env node
'use strict';
/**
 * O MESMO modelo, nos dois motores — a régua que escolheu o motor de produção.
 *
 *   node tools/measure-before-after.cjs            # laudo geométrico lado a lado
 *   node tools/measure-before-after.cjs --bytes    # e o tamanho do XML
 *
 * O #23 pede a escolha "por medição, não por data", e depois pede que toda
 * conclusão geométrica que não sobreviver seja registrada. Esta ferramenta é o
 * instrumento das duas coisas: ela gera cada modelo do corpus com o motor de
 * ANTES — o que vive em `prototypes/q11/motor/`, sem a camada de tema — e com o
 * de produção, e passa os dois pelo validador do #18.
 *
 * Ela é ferramenta e não checagem de propósito: um dia `prototypes/` sai da
 * árvore e o "antes" deixa de existir. Uma checagem que depende do protótipo
 * enferrujaria; uma ferramenta que responde uma pergunta de arqueologia só
 * precisa funcionar enquanto a pergunta interessa. Quando o protótipo sumir, ela
 * avisa e sai limpa.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const ANTES = path.join(RAIZ, 'prototypes', 'q11', 'engine', 'generate.cjs');
const { validarGeometria } = require(path.join(RAIZ, 'validator', 'validate-geometry.cjs'));

async function main() {
  if (!fs.existsSync(ANTES)) {
    console.log('  o motor de ANTES não existe mais em prototypes/ — não há o que comparar.');
    console.log('  (é o estado esperado depois que os protótipos saírem da árvore)');
    return 0;
  }
  const motores = {
    antes: require(ANTES).gerar,
    depois: require(path.join(RAIZ, 'engine', 'generate.cjs')).gerar,
  };
  const comBytes = process.argv.includes('--bytes');
  const modelos = fs.readdirSync(path.join(RAIZ, 'models')).filter(f => f.endsWith('.json')).sort();

  console.log('\n  o mesmo modelo nos dois motores — laudo do validador do #18\n');
  const L = comBytes ? 32 : 26;
  console.log('  ' + 'modelo'.padEnd(30) + 'antes'.padEnd(L) + 'depois');
  console.log('  ' + '─'.repeat(30 + 2 * L));

  let mudouSemantica = 0, mudouFalha = 0, naoGerou = 0;
  for (const arq of modelos) {
    const m = JSON.parse(fs.readFileSync(path.join(RAIZ, 'models', arq), 'utf8'));
    const col = {};
    for (const [rot, gerar] of Object.entries(motores)) {
      try {
        const r = await gerar(JSON.parse(JSON.stringify(m)));
        const l = validarGeometria(r.plano);
        col[rot] = { falha: l.resumo.falha, sem: l.semanticas.map(s => `${s.id}×${s.occurrences.length}`),
          ids: l.falhas.map(f => f.id), bytes: r.xml.length };
      } catch (e) { col[rot] = { erro: e.message.slice(0, 40) }; }
    }
    const mostra = c => c.erro ? `NÃO GEROU (${c.erro})`
      : `falha=${String(c.falha).padStart(2)} sem=[${c.sem.join(',') || '—'}]` +
        (comBytes ? ` ${c.bytes}b` : '');
    console.log(`  ${path.basename(arq, '.json').padEnd(30)}${mostra(col.antes).padEnd(comBytes ? 32 : 26)}${mostra(col.depois)}`);
    if (col.antes.erro || col.depois.erro) naoGerou++;
    else {
      if (JSON.stringify(col.antes.sem) !== JSON.stringify(col.depois.sem)) mudouSemantica++;
      if (col.antes.falha !== col.depois.falha) {
        mudouFalha++;
        // QUAIS mudaram, sempre. "A contagem caiu" sem a lista é um número que
        // ninguém pode conferir, e o #23 existe justamente porque um número
        // desses ficou sem conferência.
        const saiu = col.antes.ids.filter(x => !col.depois.ids.includes(x));
        const entrou = col.depois.ids.filter(x => !col.antes.ids.includes(x));
        console.log(`  ${' '.repeat(30)}└ ${saiu.length ? `saiu ${saiu.join(', ')}` : ''}` +
          `${saiu.length && entrou.length ? ' · ' : ''}${entrou.length ? `entrou ${entrou.join(', ')}` : ''}`);
      }
    }
  }

  console.log(`\n  modelos em que a lista de falhas SEMÂNTICAS mudou: ${mudouSemantica}`);
  console.log(`  modelos em que a contagem de falhas mudou:          ${mudouFalha}`);
  if (naoGerou) console.log(`  modelos que um dos motores não gerou:              ${naoGerou}`);
  console.log('\n  Leitura: falha semântica é o desenho MENTINDO (tolerância zero). Mudança na');
  console.log('  contagem total é achado do #18 sobre a escala nova, não regressão — o');
  console.log('  `check-good.cjs` separa os dois eixos.\n');
  return 0;
}

main().then(c => process.exit(c)).catch(e => { console.error(e); process.exit(1); });
