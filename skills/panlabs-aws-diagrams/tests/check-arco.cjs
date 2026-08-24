#!/usr/bin/env node
'use strict';
/**
 * O ARCO PONTA A PONTA — os sete passos do `SKILL.md`, cada um fechando na
 * condição escrita DELE.
 *
 *   node tests/check-arco.cjs
 *
 * O #26 pede a skill rodando *necessidade vaga → sabatina → candidatas →
 * aprovação da vista lógica → vista técnica → `.drawio`*. O critério está em
 * `docs/corpus.md` §5, e a primeira linha dele é a que decide o sujeito:
 *
 *   > E1 · o arco roda contra um caso que NÃO EXISTIA antes deste ticket —
 *   >      validar o arco contra a própria fixture dele não mede nada.
 *
 * Por isso o caso é `frota-preditiva` e não `varejo-300-lojas`. O varejo já era
 * fixture quando o #14 e o #23 rodaram; ele prova que a camada de sessão não
 * regrediu, e é o que `tools/aprovar.cjs` e `tools/retomar.cjs` guardam. Este
 * arquivo prova outra coisa: que o arco fecha num caso que nasceu depois das
 * regras.
 *
 * E as diferenças com o varejo são deliberadas, para o arco não passar duas
 * vezes pelo mesmo caminho de código:
 *
 *   varejo   3 contas · caminho `porContas` · 1+N páginas · fronteira = conta
 *   frota    1 conta  · caminho `porElk`    · 1 página    · fronteira = grupo
 *
 * ⚠️ ELE COMEÇA NO PASSO 2, e isso é limite declarado e não esquecimento.
 *
 * A perna *necessidade vaga → sabatina* não tem código: a sabatina é um protocolo
 * que um AGENTE conduz com um humano, e não há função a chamar entre *"quero
 * saber que um caminhão vai quebrar antes de quebrar na estrada"* e o primeiro
 * fato confirmado. O que este arquivo faz com essa perna é conferir o PRODUTO
 * dela — todo fato confirmado, todo inferido dizendo de onde saiu, candidatas que
 * não colapsam. Do passo 4 em diante tudo roda de verdade.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const { validar } = require(path.join(RAIZ, 'sessao', 'validar.cjs'));
const { aprovar, conferir } = require(path.join(RAIZ, 'sessao', 'acordo.cjs'));
const { desenhar } = require(path.join(RAIZ, 'sessao', 'desenhar.cjs'));
const { abrir } = require(path.join(RAIZ, 'sessao', 'abrir.cjs'));
const { elaborar } = require(path.join(RAIZ, 'sessao', 'elaborar.cjs'));
const { costurar } = require(path.join(RAIZ, 'sessao', 'gravar.cjs'));
const { projetar } = require(path.join(RAIZ, 'sessao', 'projetar.cjs'));
const { publicar, podar, contarDeliberacao } = require(path.join(RAIZ, 'sessao', 'publicar.cjs'));
const { revisar } = require(path.join(RAIZ, 'sessao', 'lacunas.cjs'));
const { briefing } = require(path.join(RAIZ, 'sessao', 'briefing.cjs'));

let falhou = 0;
const anota = (ok, o_que, detalhe) => {
  if (!ok) falhou++;
  console.log(`  ${ok ? '✓' : '✗'} ${o_que}`);
  if (detalhe) console.log(`      ${detalhe}`);
};

const LOGICA = path.join(RAIZ, 'modelo', 'sessao', 'frota-logica.json');
const DELTA = path.join(RAIZ, 'modelo', 'sessao', 'frota-elaboracao.json');
const SAIDA = path.join(RAIZ, 'saida', 'frota-preditiva.drawio');
const PUBLICADO = path.join(RAIZ, 'saida', 'frota-preditiva.publicado.drawio');

(async () => {
  const sessao = JSON.parse(fs.readFileSync(LOGICA, 'utf8'));

  // ─────────────────────────────────────────────── passo 2 · a sabatina fecha
  console.log('\npasso 2 · a sabatina fecha quando A1 chega ao piso\n');
  {
    const v = validar(sessao);
    anota(v.ok, 'o modelo de sessão é válido contra `sessao@1`', (v.erros || []).join(' · ') || 'sem erros');

    const fatos = sessao.dossie.fatos || [];
    anota(fatos.length > 0 && fatos.every(f => f.confirmado),
      'todo fato do dossiê está confirmado — inferido não conta até confirmar',
      `${fatos.length} fatos, ${fatos.filter(f => f.procedencia === 'inferido').length} inferido(s), ` +
      `todos com \`confirmado: true\``);

    const semDe = fatos.filter(f => f.procedencia === 'inferido' && !f.de);
    anota(!semDe.length, 'todo fato inferido diz DE ONDE saiu',
      semDe.length ? semDe.map(f => f.fato).join(' · ') : 'os inferidos carregam o trecho de origem');
  }

  // ────────────────────────────────────── passo 3 · candidatas genuinamente distintas
  console.log('\npasso 3 · toda dupla de candidatas difere em ≥1 eixo, e você sabe dizer qual\n');
  {
    const cs = sessao.dossie.candidatas || [];
    anota(cs.length >= 2 && cs.length <= 3, 'teto 3, piso 2', `${cs.length} candidatas`);
    anota(cs.filter(c => c.estado === 'escolhida').length === 1, 'exatamente uma escolhida');

    // o invariante de tupla: nenhuma dupla colapsa
    const colapsam = [];
    for (let i = 0; i < cs.length; i++)
      for (let j = i + 1; j < cs.length; j++)
        if (JSON.stringify(cs[i].tupla) === JSON.stringify(cs[j].tupla))
          colapsam.push(`${cs[i].id}=${cs[j].id}`);
    anota(!colapsam.length, 'nenhuma dupla tem a MESMA tupla — tuplas iguais colapsam e seriam descartadas',
      colapsam.length ? colapsam.join(' · ') : `${(cs.length * (cs.length - 1)) / 2} duplas, todas distintas`);

    // e `difereEm` tem de bater com a diferença REAL contra a escolhida
    const escolhida = cs.find(c => c.estado === 'escolhida');
    const EIXOS = ['E1', 'E2', 'E3', 'E4', 'E5'];
    for (const c of cs.filter(x => x.estado === 'descartada')) {
      const real = EIXOS.filter((_, i) => c.tupla[i] !== escolhida.tupla[i]);
      anota(JSON.stringify(real.sort()) === JSON.stringify([...(c.difereEm || [])].sort()),
        `"${c.id}": \`difereEm\` bate com a tupla, e não com a intenção`,
        `declarado [${(c.difereEm || []).join(',')}] · medido [${real.join(',')}]`);
      anota(!!c.porque, `"${c.id}" descartada carrega o \`porque\` — é o que responde "por que não a B?"`);
    }
  }

  // ─────────────────────────────────── passo 4 · a revisão de lacunas, com o código
  console.log('\npasso 4 · a revisão roda sobre o grafo montado, e a recusa chega ao desenho\n');
  {
    const proj = projetar(sessao, 'logica').modelo;
    const r = revisar(proj);
    anota(r.dentroDoTeto, 'a revisão fica dentro do teto do §4.2',
      `${r.achados.length} achado(s) · teto ⌈${proj.nos.length}÷4⌉ = ${r.teto}`);

    // o que o código acha tem de estar no dossiê: o dossiê é a DECISÃO sobre o
    // achado, e um achado sem decisão é um achado que ninguém viu
    const decididos = new Set((sessao.dossie.achados || []).map(a => `${a.regra}/${a.alvo}`));
    const semDecisao = r.achados.filter(a => !decididos.has(`${a.regra}/${a.alvo}`));
    anota(!semDecisao.length, 'todo achado que o código produz tem decisão no dossiê',
      semDecisao.length
        ? semDecisao.map(a => `${a.regra}/${a.alvo}`).join(' · ')
        : [...decididos].join(' · '));

    // e a recusa tem de ter o elo explícito até uma nota
    const recusados = (sessao.dossie.achados || []).filter(a => a.estado === 'recusado');
    anota(recusados.length > 0, 'o caso exercita ao menos uma RECUSA', `${recusados.length} recusa(s)`);
    for (const a of recusados) {
      const nota = (sessao.notas || []).find(n => n.id === a.viaNota);
      anota(!!nota && nota.origem === 'achado-recusado',
        `a recusa de "${a.regra}/${a.alvo}" chega ao desenho por \`viaNota\``,
        nota ? `→ ${nota.id} (origem "${nota.origem}")` : 'sem nota ligada — a recusa morreria no dossiê');
    }
  }

  // ──────────────────────────────────── passo 5 · o acordo, e ele é conferível
  console.log('\npasso 5 · a aprovação não é um booleano — é o recorte, e ele confere\n');
  let aprovado;
  {
    aprovado = aprovar(sessao, { em: '2026-08-23', por: 'diretoria de operações', candidata: 'cand-a' });
    const d = conferir(aprovado);
    anota(d.ok, '`conferir(aprovado).ok` logo depois de aprovar');
    anota(/^sha256:[0-9a-f]{64}$/.test(aprovado.dossie.acordo.impressao),
      'o acordo guarda a impressão do recorte, não um `true`',
      aprovado.dossie.acordo.impressao.slice(0, 26) + '…');

    // e o controle: mexer no que foi aprovado tem de QUEBRAR o acordo
    const mexido = JSON.parse(JSON.stringify(aprovado));
    mexido.nos.find(n => n.id === 'pontuar-risco').rotulo = 'Pontuação de risco (v2)';
    anota(!conferir(mexido).ok,
      'CONTROLE: mudar um rótulo aprovado quebra o acordo — senão o acordo não media nada',
      `${(conferir(mexido).diferencas || []).length} diferença(s) apontada(s)`);

    const r = await desenhar(aprovado, 'logica');
    fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
    fs.writeFileSync(SAIDA, r.xml);
    anota(fs.existsSync(SAIDA), 'a vista lógica está gravada', `${r.xml.length} bytes, caminho "${r.caminho}"`);

    const semanticas = r.relatorio.geometria.reduce((s, x) => s + x.laudo.semanticas.length, 0);
    anota(semanticas === 0, 'a vista lógica não tem falha semântica', `${semanticas} semânticas`);
  }

  // ───────────────── passo 6 · a vista técnica, e a projeção sobrevive ao nível de rede
  console.log('\npasso 6 · a fase técnica enfia VPC e subnet, e o aprovado continua o aprovado\n');
  let tecnico;
  {
    const aberto = abrir(fs.readFileSync(SAIDA, 'utf8'));
    anota(aberto.nosso, 'o `.drawio` gravado é reconhecido como nosso', aberto.porque || '');

    const delta = JSON.parse(fs.readFileSync(DELTA, 'utf8'));
    tecnico = elaborar(aberto.sessao, delta);

    const v = validar(tecnico);
    anota(v.ok, 'o modelo elaborado continua válido', (v.erros || []).join(' · ') || 'sem erros');

    // A PROVA do #14: o nó aprovado foi empurrado dois níveis para baixo…
    const alvo = tecnico.nos.find(n => n.id === 'pontuar-risco');
    anota(alvo.dentro === 'sub-modelo',
      '`pontuar-risco` foi reparenteado para dentro de uma subnet que a vista lógica não conhece',
      `dentro = "${alvo.dentro}" (era "analise")`);

    // …e a projeção lógica sai IDÊNTICA assim mesmo
    const d = conferir(tecnico);
    anota(d.ok, 'E3 · `conferir()` continua ok — a projeção lógica de hoje é byte a byte a aprovada',
      d.ok ? 'o colapso de contenção passa por cima dos níveis só-técnicos'
        : (d.diferencas || []).map(x => x.texto).join(' · '));

    const rl = await desenhar(tecnico, 'logica');
    const rt = await desenhar(tecnico, 'tecnica');
    fs.writeFileSync(SAIDA, costurar([rl.xml, rt.xml]));

    const sem = rt.relatorio.geometria.reduce((s, x) => s + x.laudo.semanticas.length, 0);
    anota(sem === 0, 'E4 · a vista técnica passa no portão de veracidade — zero falhas semânticas',
      `${rt.relatorio.geometria.length} página(s), ${sem} semânticas`);

    // e nenhum nome de serviço vazou para a vista lógica
    const logico = projetar(tecnico, 'logica').modelo;
    const vazou = logico.nos.filter(n => n.servico && n.tipo !== 'ator');
    anota(!vazou.length, 'nenhum nome de serviço AWS vazou para a vista lógica',
      vazou.length ? vazou.map(n => `${n.id}=${n.servico}`).join(' · ')
        : `${logico.nos.length} nós lógicos, zero \`servico\` fora de ator`);
  }

  // ───────────────────────────────────── passo 1 · a porta de retomada (o briefing)
  console.log('\npasso 1 · o arquivo retoma, e o briefing devolve o que não se pergunta de novo\n');
  {
    const aberto = abrir(fs.readFileSync(SAIDA, 'utf8'));
    anota(aberto.nosso, 'o arquivo costurado ainda é reconhecido');
    const corpo = briefing(aberto).join('\n');
    for (const [o_que, agulha] of [
      ['as candidatas descartadas, com o motivo', 'Lote noturno'],
      ['os achados e o estado deles', 'spof'],
      ['o estacionamento', 'Kinesis'],
    ]) anota(corpo.includes(agulha), `o briefing traz ${o_que}`, `procurou "${agulha}"`);
  }

  // ────────────────────────────────────────── passo 7 · a cópia que circula
  console.log('\npasso 7 · o arquivo que retoma e o que circula não são o mesmo arquivo\n');
  {
    const trabalhoXml = fs.readFileSync(SAIDA, 'utf8');
    const aberto = abrir(trabalhoXml);
    const antes = contarDeliberacao(aberto.sessao);
    const depois = contarDeliberacao(podar(aberto.sessao));
    anota(antes > 0 && depois === 0, 'a poda tira toda a deliberação do selo',
      `${antes} item(ns) antes, ${depois} depois`);

    fs.writeFileSync(PUBLICADO, publicar(trabalhoXml));
    const bytes = fs.readFileSync(PUBLICADO, 'utf8');
    for (const [o_que, agulha] of [
      ['o motivo do descarte de uma candidata', 'a antecedência de 48 h não sobrevive'],
      ['quem aprovou', 'diretoria de operações'],
      ['a fala de reunião que virou fato inferido', 'o pessoal de dados falou'],
    ]) anota(!bytes.includes(agulha), `E5 · a cópia publicada NÃO carrega ${o_que}`, `procurou "${agulha}" nos bytes`);

    // …e o controle na outra ponta: o arquivo de trabalho carrega
    const trabalho = fs.readFileSync(SAIDA, 'utf8');
    anota(trabalho.includes('a antecedência de 48 h não sobrevive'),
      'CONTROLE: o arquivo de TRABALHO carrega a deliberação — senão a checagem acima não media nada');

    // ⚠️ a cópia continua sendo NOSSA — o que ela deixa de ser é RETOMÁVEL, e as
    // duas coisas são diferentes: um arquivo que não fosse reconhecido não
    // saberia dizer POR QUE não retoma.
    const reaberto = abrir(bytes);
    anota(reaberto.publicado === true && reaberto.sessao === null,
      'E5 · a cópia publicada se declara publicada e não devolve sessão',
      reaberto.porque || '');
    anota(/publicada/i.test(reaberto.porque || ''),
      'e diz por quê, em vez de só falhar', (reaberto.porque || '').slice(0, 72) + '…');
  }

  console.log();
  if (falhou) { console.log(`  ✗ ${falhou} condição(ões) do arco não fecharam.`); process.exit(1); }
  console.log('  ✓ os sete passos fecham, num caso que não existia antes deste ticket.');
})().catch(e => { console.error('\n  ✗ o arco estourou:', e.message); console.error(e.stack); process.exit(1); });
