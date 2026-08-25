#!/usr/bin/env node
'use strict';
/**
 * O LAUDO COMPLETO DE TODO O CORPUS, num formato que `diff` sabe ler.
 *
 *   node tools/measure-routing.cjs > antes.txt
 *   ...mexe no motor...
 *   node tools/measure-routing.cjs > depois.txt
 *   diff antes.txt depois.txt
 *
 * O #24 pede uma coisa que nenhuma ferramenta daqui dava: *"nenhuma checagem
 * trocada por outra — o laudo completo antes/depois"*. O `check-geometry.cjs`
 * mostra só o que reprovou, e `check-good.cjs` conta por estado; nos dois, uma
 * checagem que sai de `ok` para `aviso` some do relatório. O #12 já pagou por
 * isso uma vez: cortou `A5.5` pela metade e comprou colisão de rótulo, e o
 * número da troca só apareceu quando alguém foi conferir à mão.
 *
 * Aqui TODA checagem sai, em TODA página, com a contagem de ocorrências — em
 * uma linha por checagem, ordenada, sem timestamp e sem caminho absoluto. É o
 * `diff` que vira o laudo antes/depois, e ele não tem como esconder uma troca.
 *
 * As duas VISTAS da sessão entram junto com o corpus de propósito: a vista
 * técnica do #14 é o artefato que reprovou na inspeção humana, e ela não é
 * nenhum dos `models/*.json` — nasce de `retail-logical` + `retail-elaboration`
 * passando pela projeção. Medir só o corpus deixaria de fora exatamente o
 * desenho que o ticket existe para consertar.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const { gerar } = require(path.join(RAIZ, 'engine', 'generate.cjs'));
const { validarGeometria } = require(path.join(RAIZ, 'validator', 'validate-geometry.cjs'));
const { aprovar } = require(path.join(RAIZ, 'session', 'agreement.cjs'));
const { elaborar } = require(path.join(RAIZ, 'session', 'elaborate.cjs'));
const { projetar } = require(path.join(RAIZ, 'session', 'project.cjs'));

/** O modelo técnico da sessão do #14, sem passar por arquivo nenhum. */
function modelosDaSessao() {
  const ler = f => JSON.parse(fs.readFileSync(path.join(RAIZ, 'models', 'session', f), 'utf8'));
  const aprovado = aprovar(ler('retail-logical.json'), { at: '2026-08-21', by: 'usuario', candidate: 'cand-a' });
  const technical = elaborar(aprovado, ler('retail-elaboration.json'));
  return [
    { name: 'sessao:retail/logica', modelo: projetar(technical, 'logical').modelo },
    { name: 'sessao:retail/tecnica', modelo: projetar(technical, 'technical').modelo },
  ];
}

function entradas() {
  const dir = path.join(RAIZ, 'models');
  const corpus = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(f => ({ name: path.basename(f, '.json'), modelo: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
  return [...corpus, ...modelosDaSessao()];
}

const SIMBOLO = { ok: 'ok   ', aviso: 'AVISO', falha: 'FALHA', notApplicable: 'n/a  ', pulada: 'render', erro: 'ERRO ' };

async function main() {
  const soAlvo = process.argv.includes('--target');
  const ALVO = ['A5.5', 'A3.5', 'A3.4', 'A5.1', 'A4.2', 'A4.4', 'A3.2'];
  let totalSemantica = 0, totalFalha = 0;

  for (const { name, modelo } of entradas()) {
    let r;
    try {
      r = await gerar(modelo);
    } catch (e) {
      console.log(`${name} :: NÃO GEROU :: ${e.message}`);
      for (const l of e.erros || []) console.log(`${name} ::   · ${l}`);
      continue;
    }
    console.log(`${name} :: caminho=${r.caminho} paginas=${1 + r.paginas.length}`);
    for (const p of [r.plano, ...r.paginas]) {
      const laudo = validarGeometria(p);
      const pag = p.id || '(sem id)';
      totalSemantica += laudo.semanticas.length;
      totalFalha += laudo.falhas.length;
      const linhas = [...laudo.resultados, ...laudo.extras]
        .filter(x => !soAlvo || ALVO.includes(x.id))
        .map(x => `${name}/${pag} :: ${x.id.padEnd(5)} ${SIMBOLO[x.state] || x.state} ` +
          `${String(x.occurrences.length).padStart(3)}oc${x.semantica && x.state === 'falha' ? ' SEMANTICA' : ''}`)
        .sort();
      for (const l of linhas) console.log(l);
      if (laudo.cobertura.naoRodaram.length)
        console.log(`${name}/${pag} :: NÃO RODARAM ${laudo.cobertura.naoRodaram.join(',')}`);
    }
  }
  console.log(`TOTAL :: falhas=${totalFalha} semanticas=${totalSemantica}`);
}

main().catch(e => { console.error(e); process.exit(1); });
