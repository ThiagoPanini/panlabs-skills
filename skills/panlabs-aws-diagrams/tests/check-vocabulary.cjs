#!/usr/bin/env node
'use strict';
/**
 * A CAMADA NORMATIVA É INDIZÍVEL — checagem, com experimento de controle.
 *
 * O #11 provou que "o agente nunca escreve coordenada" não precisava de
 * disciplina: bastou que o esquema não tivesse nenhuma propriedade que nomeasse
 * posição. Aqui é a mesma jogada para a outra fronteira do #13:
 *
 *   > o tema não pode mudar cor de grupo, cor de categoria, traço de grupo nem
 *   > tamanho de ícone — porque mudar isso faz o diagrama LER ERRADO
 *   > (a cor do grupo É a legenda, §6.4 do #5).
 *
 * Duas frentes, porque uma só não fecha:
 *
 *   ENTRADA  o esquema do tema recusa o token proibido.
 *   SAÍDA    as style strings emitidas não carregam a chave proibida, mesmo que
 *            alguém contornasse a entrada.
 *
 * E a lição cara do #17 — 24 checagens verdes e o PNG saiu com o ícone errado —
 * vira experimento de controle: injetamos os tokens proibidos no esquema e a
 * checagem TEM de acusar. Checagem que não sabe falhar não prova nada.
 *
 *   node tools/check-vocabulary.cjs
 */

const fs = require('fs');
const path = require('path');
const { contraEsquema } = require('../engine/validate.cjs');

const ESQUEMA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'theme', 'schema.json'), 'utf8'));

const BASE = { schema: 'panlabs-aws-diagrams/theme@1', id: 'teste', label: 'Teste', background: 'light' };

/** O que um tema NÃO pode dizer, e por quê. */
const PROIBIDOS = [
  { name: 'cor de borda de grupo', tema: { group: { edge: '#FF0000' } },
    because: 'a cor do grupo É a legenda — #5 §6.4' },
  { name: 'traço de grupo', tema: { group: { traco: 'solid' } },
    because: 'sysDash/dash/sólido carregam significado — A5 do #5' },
  { name: 'cor de categoria de serviço', tema: { categoria: { compute: '#FF0000' } },
    because: 'a cor do quadrado é a categoria — slide 26 do deck' },
  { name: 'tamanho de ícone', tema: { icone: { tamanho: 64 } },
    because: 'N1: "use icons at their predefined size and do not resize"' },
  { name: 'preenchimento de grupo', tema: { group: { background: '#EEEEEE' } },
    because: 'A2: box de grupo é <a:noFill/>; e tingir derruba #ED7100 abaixo de 3:1' },
  { name: 'sketch / hand-drawn', tema: { sketch: true },
    because: '#4 §3.3: o RoughCanvas jittera o glifo do stencil AWS — a paleta oficial força sketch=0 em 56/56' },
  { name: 'glass', tema: { glass: true },
    because: '#4 §8: no-op silencioso em AWS4 — expor gera bug report' },
  { name: 'sombra', tema: { sombra: true },
    because: 'zero sombra em 156 lâminas do deck; e por célula só o quadrado externo recebe' },
  { name: 'gradiente', tema: { gradiente: { color: '#505863', direcao: 'north' } },
    because: 'ícone com gradiente é legacy pré-2022 — a própria AWS avisa (F1 do #5)' },
  { name: 'cores adaptativas / light-dark()', tema: { adaptiveColors: 'auto' },
    because: '#4 §1.4: o mesmo arquivo renderiza diferente em dois computadores' },
  { name: 'fonte fora da lista segura', tema: { text: { family: 'Inter' } },
    because: '#4 §4.2: PNG depende da fonte instalada no renderizador' },
  { name: 'cantos arredondados em vértice AWS4', tema: { icone: { corners: 8 } },
    because: '#4 §3.3: no-op silencioso — AWS4 não está em roundableShapes' },
  { name: 'estilo de aresta exótico', tema: { edge: { style: 'isometricEdgeStyle' } },
    because: 'N10: linhas retas e ângulos retos; isometric não existe em arquitetura AWS' },
  { name: 'math / MathJax', tema: { math: true },
    because: '#4 §1.4: custo de render puro se o gerador não emite LaTeX' },
];

/** Chaves de style que o arquivo emitido não pode conter, venha de onde vier. */
const CHAVES_PROIBIDAS = ['sketch=1', 'comic=1', 'glass=1', 'shadow=1', 'sketchStyle=',
  'gradientColor=#', 'light-dark(', 'fontSource=', 'libavoidRouting=1'];

function testarEntrada(schema) {
  const passaram = [];
  for (const caso of PROIBIDOS) {
    const erros = contraEsquema({ ...BASE, ...caso.tema }, schema, schema);
    if (erros.length === 0) passaram.push(caso);
  }
  return passaram;
}

async function testarSaida() {
  const { gerar } = require('../engine/generate.cjs');
  const temaMod = require('../theme/theme.cjs');
  const findings = [];
  for (const arquivo of fs.readdirSync(path.join(__dirname, '..', 'models')).filter(f => f.endsWith('.json'))) {
    const modelo = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'models', arquivo), 'utf8'));
    for (const id of temaMod.listar()) {
      let r;
      // `forcar: true` desarma o portão de contraste, então qualquer exceção aqui
      // é defeito de verdade. Engolir com `continue` contaria como aprovado o
      // tema que nem chegou a gerar — e o cabeçalho deste arquivo diz que
      // checagem que não sabe falhar não prova nada.
      try {
        r = await gerar(modelo, { tema: id, force: true });
      } catch (e) {
        findings.push(`${arquivo} + tema ${id}: geração falhou (${e.message}) — não dá para conferir a saída`);
        continue;
      }
      for (const chave of CHAVES_PROIBIDAS)
        if (r.xml.includes(chave)) findings.push(`${arquivo} + tema ${id}: XML contém "${chave}"`);
    }
  }
  return findings;
}

async function main() {
  let falhou = 0;

  console.log('ENTRADA — o esquema do tema recusa o token proibido');
  const vazaram = testarEntrada(ESQUEMA);
  for (const caso of PROIBIDOS)
    console.log(`  ${vazaram.includes(caso) ? '✗' : '✓'} ${caso.name.padEnd(38)} ${caso.because}`);
  if (vazaram.length) { console.log(`\n  ${vazaram.length} token(s) proibido(s) ACEITOS pelo esquema`); falhou = 1; }

  console.log('\nCONTROLE — injetando os tokens no esquema, a checagem TEM de acusar');
  const sabotado = JSON.parse(JSON.stringify(ESQUEMA));
  sabotado.properties.group = { type: 'object' };
  sabotado.properties.categoria = { type: 'object' };
  sabotado.properties.icone = { type: 'object' };
  sabotado.properties.sketch = { type: 'boolean' };
  sabotado.properties.glass = { type: 'boolean' };
  sabotado.properties.sombra = { type: 'boolean' };
  sabotado.properties.gradiente = { type: 'object' };
  sabotado.properties.adaptiveColors = { type: 'string' };
  sabotado.properties.math = { type: 'boolean' };
  sabotado.properties.text.properties.family = { type: 'string' };
  sabotado.properties.edge.properties.style = { type: 'string' };
  const acusados = testarEntrada(sabotado);
  const esperado = PROIBIDOS.length;
  console.log(`  esquema sabotado aceita ${acusados.length} de ${esperado} tokens proibidos`);
  if (acusados.length !== esperado) {
    console.log('  ✗ o controle NÃO reproduziu a violação — a checagem de entrada não prova o que diz');
    for (const c of PROIBIDOS) if (!acusados.includes(c)) console.log(`      não reproduzido: ${c.name}`);
    falhou = 1;
  } else {
    console.log('  ✓ controle reproduz — a checagem sabe falhar');
  }

  console.log('\nSAÍDA — o XML emitido não carrega chave proibida');
  const findings = await testarSaida();
  if (findings.length) { for (const a of findings) console.log('  ✗ ' + a); falhou = 1; }
  else console.log(`  ✓ ${CHAVES_PROIBIDAS.length} chaves conferidas, nenhuma no XML de nenhum tema`);

  console.log(falhou ? '\nVOCABULÁRIO VAZOU' : '\nvocabulário fechado');
  process.exit(falhou);
}

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
