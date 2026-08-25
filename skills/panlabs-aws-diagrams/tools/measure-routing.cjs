#!/usr/bin/env node
'use strict';
/**
 * O LAUDO COMPLETO DE TODO O CORPUS, num formato que `diff` sabe ler.
 *
 *   node tools/medir-roteamento.cjs > antes.txt
 *   ...mexe no motor...
 *   node tools/medir-roteamento.cjs > depois.txt
 *   diff antes.txt depois.txt
 *
 * O #24 pede uma coisa que nenhuma ferramenta daqui dava: *"nenhuma checagem
 * trocada por outra — o laudo completo antes/depois"*. O `check-geometria.cjs`
 * mostra só o que reprovou, e `check-bons.cjs` conta por estado; nos dois, uma
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
 * nenhum dos `modelo/*.json` — nasce de `varejo-logica` + `varejo-elaboracao`
 * passando pela projeção. Medir só o corpus deixaria de fora exatamente o
 * desenho que o ticket existe para consertar.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const { gerar } = require(path.join(RAIZ, 'motor', 'gerar.cjs'));
const { validarGeometria } = require(path.join(RAIZ, 'validador', 'validar-geometria.cjs'));
const { aprovar } = require(path.join(RAIZ, 'sessao', 'acordo.cjs'));
const { elaborar } = require(path.join(RAIZ, 'sessao', 'elaborar.cjs'));
const { projetar } = require(path.join(RAIZ, 'sessao', 'projetar.cjs'));

/** O modelo técnico da sessão do #14, sem passar por arquivo nenhum. */
function modelosDaSessao() {
  const ler = f => JSON.parse(fs.readFileSync(path.join(RAIZ, 'modelo', 'sessao', f), 'utf8'));
  const aprovado = aprovar(ler('varejo-logica.json'), { em: '2026-08-21', por: 'usuario', candidata: 'cand-a' });
  const tecnico = elaborar(aprovado, ler('varejo-elaboracao.json'));
  return [
    { nome: 'sessao:varejo/logica', modelo: projetar(tecnico, 'logica').modelo },
    { nome: 'sessao:varejo/tecnica', modelo: projetar(tecnico, 'tecnica').modelo },
  ];
}

function entradas() {
  const dir = path.join(RAIZ, 'modelo');
  const corpus = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort()
    .map(f => ({ nome: path.basename(f, '.json'), modelo: JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
  return [...corpus, ...modelosDaSessao()];
}

const SIMBOLO = { ok: 'ok   ', aviso: 'AVISO', falha: 'FALHA', inaplicavel: 'n/a  ', pulada: 'render', erro: 'ERRO ' };

async function main() {
  const soAlvo = process.argv.includes('--alvo');
  const ALVO = ['A5.5', 'A3.5', 'A3.4', 'A5.1', 'A4.2', 'A4.4', 'A3.2'];
  let totalSemantica = 0, totalFalha = 0;

  for (const { nome, modelo } of entradas()) {
    let r;
    try {
      r = await gerar(modelo);
    } catch (e) {
      console.log(`${nome} :: NÃO GEROU :: ${e.message}`);
      for (const l of e.erros || []) console.log(`${nome} ::   · ${l}`);
      continue;
    }
    console.log(`${nome} :: caminho=${r.caminho} paginas=${1 + r.paginas.length}`);
    for (const p of [r.plano, ...r.paginas]) {
      const laudo = validarGeometria(p);
      const pag = p.id || '(sem id)';
      totalSemantica += laudo.semanticas.length;
      totalFalha += laudo.falhas.length;
      const linhas = [...laudo.resultados, ...laudo.extras]
        .filter(x => !soAlvo || ALVO.includes(x.id))
        .map(x => `${nome}/${pag} :: ${x.id.padEnd(5)} ${SIMBOLO[x.estado] || x.estado} ` +
          `${String(x.ocorrencias.length).padStart(3)}oc${x.semantica && x.estado === 'falha' ? ' SEMANTICA' : ''}`)
        .sort();
      for (const l of linhas) console.log(l);
      if (laudo.cobertura.naoRodaram.length)
        console.log(`${nome}/${pag} :: NÃO RODARAM ${laudo.cobertura.naoRodaram.join(',')}`);
    }
  }
  console.log(`TOTAL :: falhas=${totalFalha} semanticas=${totalSemantica}`);
}

main().catch(e => { console.error(e); process.exit(1); });
