#!/usr/bin/env node
'use strict';
/**
 * PASSOS 1 E 6 DO ARCO — retoma um `.drawio` gravado e, se voce mandar um delta,
 * elabora a vista tecnica por cima do que foi aprovado.
 *
 *   node tools/retomar.cjs <arq.drawio>                          so o briefing
 *   node tools/retomar.cjs <arq.drawio> --delta <elaboracao.json> [--saida y.drawio]
 *
 * Sao os dois passos no mesmo comando porque sao a mesma leitura: reconhecer o
 * arquivo, classificar as paginas e devolver o briefing e o passo 1; aplicar o
 * delta por cima do resultado e o passo 6. Separa-los obrigaria a ler e
 * classificar duas vezes, e a segunda leitura poderia discordar da primeira.
 *
 * Daqui sai, nesta ordem:
 *
 *   1. reconhecimento    — este arquivo e meu?
 *   2. estado do desenho — o humano mexeu nele desde que eu gravei?
 *   3. briefing          — o que ficou decidido, recusado, estacionado
 *   4. elaboracao        — o delta tecnico sobre o modelo aprovado   (so com --delta)
 *   5. conferencia       — a projecao logica de hoje ainda e a aprovada?
 *   6. as duas vistas    — no MESMO arquivo. Duas VISTAS; desde o #12 a tecnica
 *                          multi-conta ja e 1+N paginas (D2 do #6), entao o
 *                          arquivo tem 1 + 1 + N.
 *
 * O passo 5 e o que o ticket compra ao usar um IR so: ele nao existiria com dois
 * modelos ligados por mapeamento, porque nao haveria como saber se o mapeamento
 * esta certo.
 *
 * ⚠️ ATE O #29 O PASSO 6 NAO TINHA COMANDO. O `SKILL.md` mandava o agente gravar
 * um driver de vinte linhas na raiz da skill — ver o cabecalho de `aprovar.cjs`
 * para os tres motivos de isso ter sido desfeito.
 *
 * Sem argumento nenhum ele roda o caso do corpus (`varejo`), que e o que a
 * camada 6 da suite exercita.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const { abrir, diferir, politica, podeRegerar } = require(path.join(RAIZ, 'sessao', 'abrir.cjs'));
const { briefing } = require(path.join(RAIZ, 'sessao', 'briefing.cjs'));
const { elaborar } = require(path.join(RAIZ, 'sessao', 'elaborar.cjs'));
const { validar } = require(path.join(RAIZ, 'sessao', 'validar.cjs'));
const { conferir } = require(path.join(RAIZ, 'sessao', 'acordo.cjs'));
const { desenhar } = require(path.join(RAIZ, 'sessao', 'desenhar.cjs'));
const { costurar } = require(path.join(RAIZ, 'sessao', 'gravar.cjs'));
const { lerPaginas } = require(path.join(RAIZ, 'sessao', 'impressao.cjs'));

const AJUDA = `
  node tools/retomar.cjs <arq.drawio> [opcoes]

    --delta <elaboracao.json>  aplica o delta da fase tecnica (passo 6 do arco).
                               Sem ele, o comando so imprime o briefing (passo 1).
    --saida <y.drawio>         onde gravar as duas vistas   (default: o proprio arquivo)

  Sem argumento nenhum, roda o caso do corpus (saida/varejo.drawio com
  modelo/sessao/varejo-elaboracao.json).

  Codigos de saida:
    0  tudo certo
    1  o arquivo nao e meu, ou o modelo elaborado nao valida
    2  uma pagina divergiu, ou a elaboracao mudou o que foi aprovado
`;

const COM_VALOR = ['delta', 'saida'];

function parse(args) {
  const opts = {}; const soltos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) { soltos.push(a); continue; }
    const nome = a.slice(2);
    if (COM_VALOR.includes(nome)) { opts[nome] = args[++i]; continue; }
    opts[nome] = true;
  }
  return { opts, soltos };
}

async function main() {
  const { opts, soltos } = parse(process.argv.slice(2));
  if (opts.help || opts.h) { console.log(AJUDA); return; }

  const entrada = soltos[0] || path.join(RAIZ, 'saida', 'varejo.drawio');
  // O default do delta so vale quando a ENTRADA tambem e a do corpus. Herdar o
  // delta do varejo num arquivo qualquer aplicaria o casaco tecnico errado — e
  // `elaborar` recusaria pelo `sobre`, mas com uma mensagem que nao explica a
  // causa. Melhor nao chegar la.
  const delta = opts.delta
    || (soltos.length === 0 ? path.join(RAIZ, 'modelo', 'sessao', 'varejo-elaboracao.json') : null);

  if (!fs.existsSync(entrada)) {
    console.error(`\n  ✗ nao achei ${entrada}`);
    console.error(AJUDA);
    process.exit(1);
  }

  const xml = fs.readFileSync(entrada, 'utf8');
  console.log(`\n  RETOMAR · ${path.relative(process.cwd(), entrada)}`);

  // 1 e 2 -------------------------------------------------------------------
  const aberto = abrir(xml);
  if (!aberto.nosso) { console.error(`\n  ✗ ${aberto.porque}`); process.exit(1); }

  const problema = aberto.paginas.filter(p => politica(p.estado).bloqueia);
  const remanejadas = aberto.paginas.filter(p => p.estado === 'remanejado');

  // 3 -----------------------------------------------------------------------
  const acordoAntes = conferir(aberto.sessao);
  for (const l of briefing(aberto, { acordo: acordoAntes })) console.log(l);

  // O bloqueio vem DEPOIS do briefing de proposito: mesmo quando nao da para
  // seguir, o usuario recebe o contexto de volta. Bloquear antes de contar o que
  // se sabe transforma um problema pequeno numa sessao perdida.
  if (problema.length) {
    console.log('\n  ┌─ DIVERGENCIA ' + '─'.repeat(49));
    for (const p of problema) {
      console.log(`  │ pagina "${p.nome || p.id}": ${politica(p.estado).diga}`);
      if (p.estado !== 'divergente') continue;
      const pode = podeRegerar(aberto.sessao, p.vista);
      if (!pode.pode) { console.log(`  │   ${pode.porque}`); continue; }
      const ref = await desenhar(aberto.sessao, p.vista);
      // A referencia e a pagina de MESMO id — com 1+N paginas por vista, pegar
      // sempre a primeira compararia a vista consolidada contra uma de detalhe
      // e chamaria de "divergencia" a diferenca entre duas paginas distintas.
      const paginasRef = lerPaginas(ref.xml).paginas;
      const ref1 = paginasRef.find(x => x.id === p.id) || paginasRef[0];
      const d = diferir(p, ref1.celulas);
      console.log(`  │ ${d.achados.length} diferenca(s): ${d.absorviveis} que o modelo sabe expressar, ${d.opacas} que nao.`);
      for (const a of d.achados) {
        const onde = a.classe === 'absorvivel' ? `absorvivel → ${a.onde}` : 'opaca';
        console.log(`  │   · ${String(a.tipo).padEnd(14)} ${String(a.id).padEnd(24)} ${a.era !== undefined && a.virou !== undefined ? `"${a.era}" -> "${a.virou}"` : a.era !== undefined ? `era "${a.era}"` : `veio "${a.virou}"`}  [${onde}]`);
      }
    }
    console.log('  └' + '─'.repeat(63));
    console.log('\n  Nao regero por cima. Ou voce me diz o que mudou e eu absorvo no modelo,');
    console.log('  ou o desenho passa a ser a verdade e o modelo foi abandonado. Nao adivinho qual.\n');
    process.exit(2);
  }
  for (const p of remanejadas)
    console.log(`\n  ⚠ pagina "${p.nome || p.id}": ${politica(p.estado).diga}`);

  if (!acordoAntes.ok) { console.error(`\n  ✗ acordo: ${acordoAntes.motivo}`); process.exit(2); }

  // Retomar um arquivo JA elaborado nao e erro, e o caso comum a partir da
  // terceira sessao. O que ele nao e e motivo para reaplicar o delta: a
  // elaboracao ja aconteceu, e reaplicar so produziria "ja tinha casaco
  // tecnico" dez vezes.
  if (aberto.sessao.estagio === 'tecnica') {
    console.log('\n  Este arquivo ja foi elaborado — as duas vistas estao aqui dentro.');
    console.log('  Nada a fazer: o briefing acima e o estado das paginas ja e a retomada.\n');
    return;
  }

  // Sem delta o comando para aqui, e isso e o passo 1 do arco cumprido: o agente
  // recebeu de volta o acordo, as candidatas descartadas com o motivo, os
  // achados recusados e o estacionamento. Nada disso se pergunta de novo.
  if (!delta) {
    console.log('\n  Briefing entregue. Este arquivo esta no estagio LOGICO.');
    console.log('  Para elaborar a vista tecnica, passe --delta <elaboracao.json>');
    console.log('  (a forma do delta esta em guia/modelo.md).\n');
    return;
  }

  if (!fs.existsSync(delta)) { console.error(`\n  ✗ nao achei o delta ${delta}\n`); process.exit(1); }

  // 4 e 5 -------------------------------------------------------------------
  const elaboracao = JSON.parse(fs.readFileSync(delta, 'utf8'));
  const tecnico = elaborar(aberto.sessao, elaboracao);
  console.log(`\n  elaborar    ${aberto.sessao.nos.length} → ${tecnico.nos.length} nos, ` +
    `${aberto.sessao.arestas.length} → ${tecnico.arestas.length} arestas  (estagio=${tecnico.estagio})`);

  const v = validar(tecnico);
  for (const a of v.avisos) console.log(`  ⚠ ${a}`);
  if (!v.ok) { console.error(`\n  ✗ modelo invalido (${v.fase})`); for (const e of v.erros) console.error(`      · ${e}`); process.exit(1); }

  const depois = conferir(tecnico);
  console.log(`  conferir    ${depois.ok ? '✓ a projecao logica do modelo TECNICO e byte a byte a que foi aprovada' : '✗ ' + depois.motivo}`);
  for (const d of depois.diferencas) console.log(`      · ${d.texto}`);
  if (!depois.ok) {
    console.error('\n  A elaboracao tecnica mudou o que foi aprovado. Isso exige aprovacao nova, nao um desenho novo.\n');
    process.exit(2);
  }

  // 6 -----------------------------------------------------------------------
  const rl = await desenhar(tecnico, 'logica');
  const rt = await desenhar(tecnico, 'tecnica');
  for (const a of rt.relatorio.avisos) console.log(`  ⚠ ${a}`);
  console.log(`  desenhar    logica: ${rl.modelo.nos.length} nos, ${rl.modelo.arestas.length} arestas  ·  ` +
    `tecnica: ${rt.modelo.nos.length} nos, ${rt.modelo.arestas.length} arestas (caminho "${rt.caminho}")`);
  if (rt.trilha.colapsados.length)
    console.log(`              colapso: ${rt.trilha.colapsados.length} no(s) da vista tecnica reancoram na logica`);
  for (const c of rl.trilha.contraidas)
    console.log(`              contraiu ${c.de} → ${c.para} atraves de [${c.por.join(', ')}]  ("${c.rotulo}")`);

  // A prova de que elaborar tecnicamente nao mexeu no desenho aprovado.
  const antiga = aberto.paginas.find(p => p.vista === 'logica');
  const nova = lerPaginas(rl.xml).paginas.find(x => x.id === (antiga && antiga.id)) || lerPaginas(rl.xml).paginas[0];
  const igual = antiga && antiga.selo.panlabsSemantica === nova.selo.panlabsSemantica
    && antiga.selo.panlabsAparencia === nova.selo.panlabsAparencia;
  console.log(`  conferir    ${igual ? '✓' : '✗'} a pagina logica saiu identica a da aprovacao — nem um pixel do que foi aprovado mudou`);
  if (!igual) process.exitCode = 1;

  const juntos = costurar([rl.xml, rt.xml]);
  const saida = opts.saida || entrada;
  fs.writeFileSync(saida, juntos);
  const nPag = lerPaginas(juntos).paginas.length;
  console.log(`\n  → ${path.relative(process.cwd(), saida)}  (${juntos.length} bytes, ${nPag} paginas: ` +
    `1 logica + ${nPag - 1} da vista tecnica)`);
  console.log('    A vista aprovada e a tecnica no mesmo arquivo. Nao ha um segundo lugar para dessincronizar.\n');
}

main().catch(e => {
  console.error(`\n  ✗ ${e.message}`);
  for (const l of e.erros || []) console.error(`      · ${l}`);
  process.exit(1);
});
