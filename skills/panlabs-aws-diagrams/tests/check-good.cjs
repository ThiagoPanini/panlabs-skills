#!/usr/bin/env node
'use strict';
/**
 * Os diagramas bons do corpus, laudados — a outra metade do critério de aceite.
 *
 * O ticket pede que o validador "separe os dois": os quebrados de propósito e o
 * diagrama bom. `check-broken.cjs` cobre o primeiro lado. Aqui está o
 * segundo, e ele NÃO é "tudo verde".
 *
 * A distinção que a suíte trava é entre duas coisas que um relatório único
 * embaralha:
 *
 *   o desenho está INCOMPLETO — falta legenda, faltam metadados de frescor, o
 *   título de um grupo tem contraste de 3,06:1. São defeitos reais do motor, e a
 *   suíte os reporta em vez de escondê-los. Não travam: travar aqui seria
 *   transformar achado do #18 em regressão do motor.
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

const RAIZ = path.join(__dirname, '..');
const { validarGeometria } = require(path.join(__dirname, '..', 'validator', 'validate-geometry.cjs'));
const { gerar } = require(path.join(RAIZ, 'engine', 'generate.cjs'));

/**
 * ⚠️ QUARENTENA NOMEADA — hoje VAZIA, e a lista vazia é o registro.
 *
 * A recertificação do #23 rodou o validador do #18 sobre o corpus do #12 pela
 * primeira vez e achou uma dívida real e SEMÂNTICA: o `web-flow-3-az` acusava
 * `A5.5` ×2 — duas gravações de EC2 em raias diferentes atravessando o grupo
 * "app-a", de onde não saíam nem para onde iam. Ela entrou aqui com ticket
 * (#24), com o porquê e com a contagem EXATA, e com a regra de que quando fosse
 * paga a suíte quebraria pedindo a remoção da entrada.
 *
 * **Foi paga.** O #24 achou a causa em `dispor`/`planejar` — o desvio da grade
 * calculava a perna perpendicular como ponto médio entre os ÍCONES, e num grid
 * 3×3 esse ponto cai dentro da coluna do meio. `corredorLivre` passou a
 * procurar um VÃO, e a suíte cobrou a remoção desta entrada exatamente como
 * prometido. O registro fica: quarentena que sabe expirar expirou.
 *
 * O objeto continua aqui, vazio, porque a mecânica que o lê é a que cobra
 * igualdade exata — e a próxima dívida nomeada entra por ela.
 */
const QUARENTENA = {};

async function main() {
  const modelos = fs.readdirSync(path.join(RAIZ, 'models')).filter(f => f.endsWith('.json')).sort();
  let falhou = 0;

  for (const arquivo of modelos) {
    const name = path.basename(arquivo, '.json');
    let r;
    try {
      r = await gerar(JSON.parse(fs.readFileSync(path.join(RAIZ, 'models', arquivo), 'utf8')));
    } catch (e) {
      console.log(`  ✗ ${name}: o motor não gerou — ${e.message}`);
      falhou = 1;
      continue;
    }

    const laudo = validarGeometria(r.plano);
    const s = laudo.resumo;

    // 1. tolerância zero no que é semântico — salvo quarentena nomeada, e ela
    //    cobra igualdade EXATA, não "menos ou igual"
    const mentiras = laudo.semanticas;
    const assinatura = mentiras.map(m => `${m.id}×${m.occurrences.length}`).sort();
    const q = QUARENTENA[name];
    const emQuarentena = q && JSON.stringify(assinatura) === JSON.stringify([...q.esperado].sort());

    if (emQuarentena) {
      console.log(`  ⚠ ${name}: ${assinatura.join(', ')} — QUARENTENA ${q.ticket} (${q.because})`);
    } else {
      console.log(`  ${mentiras.length ? '✗' : '✓'} ${name}: ${mentiras.length ? `${mentiras.length} FALHA(S) SEMÂNTICA(S)` : 'nenhuma falha semântica'}`);
      for (const m of mentiras) {
        falhou = 1;
        console.log(`      ${m.id} ${m.name}: ${m.mensagem}`);
        for (const o of m.occurrences.slice(0, 3)) console.log(`        · ${o.o_que}`);
      }
      if (q) {
        falhou = 1;
        console.log(`      ✗ a quarentena ${q.ticket} para "${name}" esperava ${q.esperado.join(', ')} e veio ` +
          `${assinatura.length ? assinatura.join(', ') : 'nada'} — ` +
          (assinatura.length ? 'a dívida mudou de forma' : 'a dívida foi PAGA: apague a entrada de QUARENTENA'));
      }
    }

    // 2. o laudo tem de ser completo — uma checagem muda não pode passar por verde
    if (laudo.cobertura.naoRodaram.length) {
      falhou = 1;
      console.log(`      ✗ não rodaram: ${laudo.cobertura.naoRodaram.join(', ')}`);
    }
    const erros = laudo.resultados.filter(x => x.state === 'erro');
    for (const e of erros) { falhou = 1; console.log(`      ✗ ${e.mensagem}`); }

    // 3. o retrato, que é o que se compara entre sessões
    console.log(`      ${s.ok} ok · ${s.aviso} aviso · ${s.falha} falha · ${s.notApplicable} inaplicável · ${s.pulada} do render`);
    if (laudo.falhas.length)
      console.log(`      achados (não travam a suíte): ${laudo.falhas.map(f => f.id).join(', ')}`);
  }

  // ---------------------------------------------------- a separação, explícita
  //
  // O critério de aceite do ticket é "mostrar que separa os dois". Vale dizer
  // em que EIXO a separação acontece, porque no eixo do relatório inteiro ela
  // não acontece — e esconder isso seria vender a ferramenta melhor do que ela é.
  //
  // Os exemplos do #11 acumulam 6 falhas cada um: sem legenda, sem metadados,
  // contraste do catálogo abaixo da WCAG. São defeitos REAIS. Então "tem falha"
  // não distingue um diagrama bom de um quebrado — os dois têm.
  //
  // O que distingue é a VERACIDADE: o desenho afirma alguma coisa que o modelo
  // nega? Aí a separação é limpa, e é ela que o portão usa como nível default.
  const { gate } = require(path.join(__dirname, '..', 'validator', 'gate.cjs'));
  const { CASOS } = require(path.join(__dirname, 'cases', 'broken.cjs'));

  console.log('\n  a separação, no eixo da veracidade:\n');
  const mentirosos = CASOS.filter(c => ['A4.2', 'A4.4', 'A5.5', 'F1'].some(id => c.espera.includes(id)));
  let barrados = 0;
  for (const c of mentirosos) {
    let barrou = false;
    try { gate(c.plano, { modelo: c.modelo, nivel: 'veracidade' }); } catch { barrou = true; }
    if (barrou) barrados++;
    else { falhou = 1; console.log(`  ✗ "${c.name}" passou o portão de veracidade`); }
  }
  console.log(`  ${barrados === mentirosos.length ? '✓' : '✗'} ${barrados}/${mentirosos.length} diagramas que mentem foram barrados`);

  let passaram = 0, emQuarentenaNoPortao = 0;
  for (const arquivo of modelos) {
    const name = path.basename(arquivo, '.json');
    const r = await gerar(JSON.parse(fs.readFileSync(path.join(RAIZ, 'models', arquivo), 'utf8')));
    try { gate(r.plano, { nivel: 'veracidade' }); passaram++; }
    catch (e) {
      // o portão barra o que mente, e a quarentena não o desliga: ele CONTINUA
      // barrando o `web-flow-3-az`, que é o comportamento certo. O que a
      // quarentena faz é não chamar de regressão uma dívida já nomeada.
      if (QUARENTENA[name]) { emQuarentenaNoPortao++; console.log(`  ⚠ ${arquivo} barrado pelo portão — quarentena ${QUARENTENA[name].ticket}`); }
      else { falhou = 1; console.log(`  ✗ ${arquivo} foi barrado: ${e.erros.join(' | ')}`); }
    }
  }
  const esperados = modelos.length - Object.keys(QUARENTENA).length;
  console.log(`  ${passaram === esperados ? '✓' : '✗'} ${passaram}/${esperados} diagramas do corpus passaram` +
    (emQuarentenaNoPortao ? `  (+${emQuarentenaNoPortao} em quarentena nomeada)` : ''));
  if (passaram !== esperados) falhou = 1;
  console.log('      (no eixo do relatório inteiro NÃO há separação, e é honesto: os');
  console.log('       diagramas do corpus têm 6 a 9 falhas reais cada um. "Tem falha"');
  console.log('       não distingue bom de quebrado; "mente" distingue.)');

  console.log(falhou
    ? '\n  ✗ há falha semântica fora de quarentena, ou laudo incompleto, no corpus'
    : '\n  ✓ o corpus tem defeitos reportados, e nenhum fora de quarentena é o desenho mentindo.');
  process.exit(falhou ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
