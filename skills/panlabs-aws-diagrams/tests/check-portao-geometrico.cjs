#!/usr/bin/env node
'use strict';
/**
 * O portão, rodado ponta a ponta — a decisão 2 provada, não declarada.
 *
 * A revisão do #18 apontou que "o validador é um portão depois de `planejar` e
 * antes de `emitir`" estava só na prosa: nada no código exercitava o enxerto, e
 * uma decisão de arquitetura que ninguém executa é uma intenção.
 *
 * Este teste executa. Ele monta o pipeline na mão até `planejar`, chama o portão
 * exatamente onde ele mora, e confere as duas metades:
 *
 *   · num plano que mente, o portão LANÇA, e a mensagem diz o que quebrou;
 *   · num plano correto, ele DEIXA PASSAR e o `emitir` roda em seguida,
 *     produzindo o XML — que é a prova de que o portão cabe no meio do
 *     pipeline sem quebrá-lo.
 *
 * ✅ E o enxerto ESTÁ aplicado desde a consolidação do #23 — quando este teste foi
 * escrito ele não estava, porque o motor era protótipo de outro ticket, e o que
 * se provava aqui era que ele CABIA. Continua provando, e agora prova o mais
 * forte: o portão que a suíte exercita à mão é o mesmo que `motor/gerar.cjs`
 * chama. A ponta a ponta pelo motor está em `tests/rodar.sh`, camada 5.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const { portao, NIVEIS } = require(path.join(__dirname, '..', 'validador', 'portao.cjs'));
const { CASOS, CONTROLE } = require(path.join(__dirname, 'casos', 'quebrados.cjs'));
const { emitir, conferirXml } = require(path.join(RAIZ, 'motor', 'emitir.cjs'));
const { gerar } = require(path.join(RAIZ, 'motor', 'gerar.cjs'));

let falhas = 0;
const anota = (ok, o_que, detalhe) => {
  if (!ok) falhas++;
  console.log(`  ${ok ? '✓' : '✗'} ${o_que}`);
  if (detalhe) console.log(`      ${detalhe}`);
};

// ------------------------------------------------- 1. o portão barra a mentira

/**
 * ⚠️ UMA FAMÍLIA SEMÂNTICA DE CADA VEZ, e não só a primeira que a lista achar.
 *
 * A versão anterior exercitava só `A4.2`. A revisão do #24 apontou o buraco: se
 * o portão passasse a barrar `A4.2` e a deixar passar `A5.5`, este arquivo
 * continuaria verde — e `A5.5` é justamente a família que o #24 zerou no motor,
 * o que significa que nenhum modelo do corpus a produz mais para cobrar em
 * outro lugar. Um portão que perde a checagem mais grave do validador não pode
 * depender de um defeito existir no corpus para ser pego.
 *
 * As quatro famílias de tolerância zero, cada uma com o seu caso plantado.
 */
{
  for (const id of ['A4.2', 'A4.4', 'A5.5', 'F1']) {
    const mentiroso = CASOS.find(c => c.espera.includes(id));
    if (!mentiroso) { anota(false, `há um caso plantado para ${id}`); continue; }
    let lancou = null;
    try {
      portao(mentiroso.plano, { modelo: mentiroso.modelo, nivel: 'veracidade' });
    } catch (e) { lancou = e; }

    anota(!!lancou, `nível "veracidade" barra o plano que mente por ${id} ("${mentiroso.nome}")`,
      lancou ? `→ ${lancou.erros[0]}` : 'passou, e não devia');
    if (!lancou) continue;
    anota(Array.isArray(lancou.erros) && lancou.erros.length > 0,
      `${id}: o erro traz linhas legíveis em \`.erros\`, como o resto do motor`);
    anota(!!lancou.laudo, `${id}: o erro carrega o laudo inteiro para quem quiser detalhar`);
    anota(lancou.erros.some(l => l.includes(id)), `${id}: a mensagem nomeia a checagem que barrou`);
  }
}

// ------------------ 2. incompletude nunca passa, mesmo no nível mais frouxo

{
  // Um plano correto no nível `nenhum` tem de passar…
  let passou = true;
  try { portao(CONTROLE.plano, { modelo: CONTROLE.modelo, nivel: 'nenhum' }); }
  catch { passou = false; }
  anota(passou, 'nível "nenhum" deixa passar um plano correto');

  // …mas nem `nenhum` engole laudo incompleto. Simula-se removendo uma família
  // do índice não dá; o que se confere é que a regra existe e está ligada.
  const laudo = require(path.join(__dirname, '..', 'validador', 'validar-geometria.cjs'))
    .validarGeometria(CONTROLE.plano, { modelo: CONTROLE.modelo });
  anota(laudo.cobertura.naoRodaram.length === 0 && !laudo.resultados.some(r => r.estado === 'erro'),
    'o laudo do controle é completo (nenhuma checagem muda)',
    `${laudo.cobertura.rodaram}/${laudo.cobertura.esperadas} rodaram`);
}

// --------------------------- 3. o enxerto real: planejar › PORTÃO › emitir

{
  // O pipeline do #11 até o plano. `gerar` já faz tudo, então usa-se o plano que
  // ele devolve — é o mesmo objeto que existiria entre `planejar` e `emitir`.
  const modelo = JSON.parse(fs.readFileSync(path.join(RAIZ, 'modelo', 'pedidos-serverless.json'), 'utf8'));
  gerar(modelo).then(r => {
    let laudo = null;
    let barrou = null;
    try {
      // é ISTO que entra em `gerar.cjs`, nas duas linhas documentadas em portao.cjs
      laudo = portao(r.plano, { nivel: 'veracidade' });
    } catch (e) { barrou = e; }

    anota(!barrou, 'o diagrama bom do #11 passa o portão de veracidade',
      barrou ? barrou.erros.join(' | ') : `${laudo.resumo.ok} ok, ${laudo.resumo.falha} falha, 0 semânticas`);

    // e o pipeline continua: o portão não consumiu nem alterou o plano
    const xml = emitir(r.plano);
    const malFormado = conferirXml(xml);
    anota(malFormado.length === 0 && xml.length > 0,
      '`emitir` roda depois do portão e produz XML bem formado',
      `${xml.length} bytes`);
    anota(xml === r.xml, 'o XML é byte a byte o mesmo — o portão é puro, não tocou no plano');

    /**
     * ⚠️ O CONTROLE MAIS IMPORTANTE DESTE ARQUIVO — e o único que precisa de um
     * processo filho.
     *
     * O #18 garante que *"um laudo incompleto nunca passa, EM NENHUM NÍVEL"*: se
     * uma família de checagem parou de rodar, o verde não quer dizer nada. É a
     * garantia mais fácil de perder no enxerto, e ela FOI perdida na primeira
     * versão do #23 — `gerar.cjs` chamava `portao` dentro de um `try` e pulava a
     * página quando ele lançava, então uma família quebrada saía como portão
     * verde sobre um laudo que não mediu nada.
     *
     * Para exercitar isso é preciso quebrar uma família ANTES de `portao.cjs`
     * ser carregado — ele destrutura `validarGeometria` na carga, então trocar a
     * propriedade depois não alcança a referência que ele guardou. Daí o filho.
     */
    const { execFileSync } = require('child_process');
    const roteiro = `
      const path = require('path');
      const RAIZ = ${JSON.stringify(RAIZ)};
      const alvo = require.resolve(path.join(RAIZ, 'validador', 'validar-geometria.cjs'));
      const real = require(alvo);
      // um laudo que se declara INCOMPLETO, e nada mais
      require.cache[alvo].exports = {
        ...real,
        validarGeometria: (plano, opts) => {
          const l = real.validarGeometria(plano, opts);
          return { ...l, cobertura: { ...l.cobertura, naoRodaram: ['A9.9'] } };
        },
      };
      const { gerar } = require(path.join(RAIZ, 'motor', 'gerar.cjs'));
      const fs = require('fs');
      const m = JSON.parse(fs.readFileSync(path.join(RAIZ, 'modelo', 'web-multi-az.json'), 'utf8'));
      gerar(m, { portao: 'nenhum' })
        .then(() => { console.log('PASSOU'); })
        .catch(e => { console.log('BARROU:' + e.message); });
    `;
    const saidaFilho = execFileSync(process.execPath, ['-e', roteiro], { encoding: 'utf8' }).trim();
    anota(saidaFilho.startsWith('BARROU:'),
      'laudo INCOMPLETO não passa nem no nível "nenhum" (a garantia do #18)',
      saidaFilho.slice(0, 110));

    console.log(falhas
      ? `\n  ✗ ${falhas} verificação(ões) falharam`
      : `\n  ✓ o portão barra o que mente, deixa passar o que não mente, e cabe entre planejar e emitir.`);
    process.exit(falhas ? 1 : 0);
  }).catch(e => { console.error(e); process.exit(1); });
}

// sanidade do próprio módulo: os níveis declarados existem
anota(Object.keys(NIVEIS).length === 4, 'os quatro níveis de portão estão declarados',
  Object.keys(NIVEIS).join(', '));
