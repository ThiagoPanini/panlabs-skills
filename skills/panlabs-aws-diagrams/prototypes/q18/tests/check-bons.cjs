#!/usr/bin/env node
'use strict';
/**
 * Os diagramas bons do #11, laudados — a outra metade do critério de aceite.
 *
 * O ticket pede que o validador "separe os dois": os quebrados de propósito e o
 * diagrama bom. `check-quebrados.cjs` cobre o primeiro lado. Aqui está o
 * segundo, e ele NÃO é "tudo verde".
 *
 * A distinção que a suíte trava é entre duas coisas que um relatório único
 * embaralha:
 *
 *   o desenho está INCOMPLETO — falta legenda, faltam metadados de frescor, o
 *   título de um grupo tem contraste de 3,06:1. São defeitos reais, do motor do
 *   #11, e o protótipo os reporta em vez de escondê-los. Não travam a suíte:
 *   travar aqui seria transformar achado do #18 em regressão do #11.
 *
 *   o desenho está MENTINDO — um nó desenhado numa VPC de que não é membro,
 *   uma aresta cortando uma rede alheia, uma faixa afirmando um atributo que o
 *   modelo nega. É o que o índice marca como `semantica`, e é tolerância zero.
 *   ISSO trava a suíte, porque se aparecer num exemplo do #11 é porque o motor
 *   regrediu ou o validador está errado, e as duas coisas precisam de olho.
 *
 * A contagem por estado fica impressa a cada rodada de propósito: é o número
 * que se compara entre uma sessão e a seguinte para saber se melhorou.
 */

const fs = require('fs');
const path = require('path');

const Q11 = path.join(__dirname, '..', '..', 'q11');
const { validarGeometria } = require(path.join(__dirname, '..', 'validador', 'validar-geometria.cjs'));
const { gerar } = require(path.join(Q11, 'motor', 'gerar.cjs'));

async function main() {
  const modelos = fs.readdirSync(path.join(Q11, 'modelo')).filter(f => f.endsWith('.json')).sort();
  let falhou = 0;

  for (const arquivo of modelos) {
    const nome = path.basename(arquivo, '.json');
    let r;
    try {
      r = await gerar(JSON.parse(fs.readFileSync(path.join(Q11, 'modelo', arquivo), 'utf8')));
    } catch (e) {
      console.log(`  ✗ ${nome}: o motor do #11 não gerou — ${e.message}`);
      falhou = 1;
      continue;
    }

    const laudo = validarGeometria(r.plano);
    const s = laudo.resumo;

    // 1. tolerância zero no que é semântico
    const mentiras = laudo.semanticas;
    console.log(`  ${mentiras.length ? '✗' : '✓'} ${nome}: ${mentiras.length ? `${mentiras.length} FALHA(S) SEMÂNTICA(S)` : 'nenhuma falha semântica'}`);
    for (const m of mentiras) {
      falhou = 1;
      console.log(`      ${m.id} ${m.nome}: ${m.mensagem}`);
      for (const o of m.ocorrencias.slice(0, 3)) console.log(`        · ${o.o_que}`);
    }

    // 2. o laudo tem de ser completo — uma checagem muda não pode passar por verde
    if (laudo.cobertura.naoRodaram.length) {
      falhou = 1;
      console.log(`      ✗ não rodaram: ${laudo.cobertura.naoRodaram.join(', ')}`);
    }
    const erros = laudo.resultados.filter(x => x.estado === 'erro');
    for (const e of erros) { falhou = 1; console.log(`      ✗ ${e.mensagem}`); }

    // 3. o retrato, que é o que se compara entre sessões
    console.log(`      ${s.ok} ok · ${s.aviso} aviso · ${s.falha} falha · ${s.inaplicavel} inaplicável · ${s.pulada} do render`);
    if (laudo.falhas.length)
      console.log(`      achados (não travam a suíte): ${laudo.falhas.map(f => f.id).join(', ')}`);
  }

  console.log(falhou
    ? '\n  ✗ há falha semântica ou laudo incompleto nos exemplos do #11'
    : '\n  ✓ os exemplos do #11 têm defeitos reportados, e nenhum deles é o desenho mentindo.');
  process.exit(falhou ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
