#!/usr/bin/env node
'use strict';
/**
 * Extrator do context pack: `premissas.md` (prosa) + `exemplos/*.drawio`
 * (convenção visual) -> `restricoes.json`, o objeto que `aplicar.cjs`
 * consome. É o código que responde ao ponto central do #16: o que sai da
 * prosa e o que sai do desenho NÃO têm o mesmo peso.
 *
 *   node extrair.cjs <dir-do-context-pack> [saida.json]
 *
 * PROSA vira restrição — cada bullet nas seções conhecidas é uma regra que
 * `aplicar.cjs` pode usar para REESCREVER ou REJEITAR parte do modelo.
 *
 * O `.drawio` de exemplo NUNCA vira restrição. Um exemplo (n=1) não prova
 * uma regra universal por omissão — "este diagrama não tem subnet pública"
 * não autoriza concluir "esta empresa proíbe subnet pública" (isso seria
 * engenharia reversa de convenção a partir de amostra única, o oposto do que
 * a prosa declara de propósito). O que o desenho prova, de forma defensável,
 * é a DELTA de estilo entre a cell real e o que o catálogo (#17) desenharia
 * sozinho — convenção visual observada, nunca usada para aceitar/rejeitar
 * serviço ou topologia.
 */

const fs = require('fs');
const path = require('path');

const { carregar } = require(path.join(__dirname, '..', '..', 'catalog', 'aws-shapes.cjs'));

// ------------------------------------------------------------------ prosa

const SECOES_CATALOGO = { proibidos: /^###\s*proibidos/i, obrigatorios: /^###\s*obrigat[oó]rios/i };

// Junta linha de continuação (bullet do Markdown quebrado em várias linhas,
// como prosa de verdade vem) na última entrada — regra de uma linha só
// truncaria "Todo egress... atravessa" bem no meio.
function bullets(bloco) {
  const itens = [];
  for (const linha of bloco.split('\n')) {
    const m = linha.match(/^-\s+(.*)$/);
    if (m) itens.push(m[1].trim());
    else if (itens.length && /\S/.test(linha) && !/^#/.test(linha)) itens[itens.length - 1] += ' ' + linha.trim();
  }
  return itens.map(s => s.replace(/\*\*/g, ''));
}

/** Corta `md` em seções por heading `##`, devolvendo { titulo: corpoBruto }. */
function secoesH2(md) {
  const partes = md.split(/\n(?=##\s)/);
  const out = {};
  for (const parte of partes) {
    const m = parte.match(/^##\s+(.+)\n([\s\S]*)$/);
    if (m) out[m[1].trim()] = m[2];
  }
  return out;
}

function extrairPremissas(caminho) {
  const md = fs.readFileSync(caminho, 'utf8');
  const secoes = secoesH2(md);

  const catalogoBruto = secoes['Catálogo de serviços'] || '';
  const subs = catalogoBruto.split(/\n(?=###\s)/);
  const catalogo = { proibidos: [], obrigatoriosQuandoAplicavel: [] };
  for (const sub of subs) {
    if (SECOES_CATALOGO.proibidos.test(sub)) catalogo.proibidos.push(...bullets(sub).map(s => s.split(' em ')[0].split(' anexado')[0].toLowerCase()));
    if (SECOES_CATALOGO.obrigatorios.test(sub)) catalogo.obrigatoriosQuandoAplicavel.push(...bullets(sub).map(s => s.split(' para ')[0].split(' (')[0].toLowerCase()));
  }

  // Topologia, nomenclatura e segurança: toda regra de PROSA entra como
  // "obrigatorio" — é a decisão do #16 (contrato.md §"o que se extrai").
  // Não há gradiente de confiança aqui porque quem escreveu decidiu escrever.
  const comoRegras = titulo => bullets(secoes[titulo] || '').map(texto => ({ texto, severidade: 'obrigatorio' }));

  return {
    catalogo,
    topologia: comoRegras('Topologia obrigatória'),
    nomenclatura: comoRegras('Nomenclatura'),
    seguranca: comoRegras('Padrões de segurança'),
  };
}

// -------------------------------------------------------------- .drawio

// Prioridade explícita, não "primeiro que casar": `shape=mxgraph.aws4.group`
// e `shape=mxgraph.aws4.resourceIcon` são o MESMO token para todo grupo ou
// todo service icon (#17 — "resourceIcon" é o container genérico do Service
// Icon). Quem distingue é `grIcon=`/`resIcon=`; `shape=` só decide sozinho
// no caminho do Resource Icon plano, que não tem `resIcon=`.
function tokenDoStyle(style) {
  const grIcon = style.match(/grIcon=([\w.]+)/);
  if (grIcon) return grIcon[1];
  const resIcon = style.match(/resIcon=([\w.]+)/);
  if (resIcon) return resIcon[1];
  const shape = style.match(/shape=([\w.]+)/);
  return shape ? shape[1] : null;
}

/** Style string -> Map ordenado chave/valor, mesmo parser do gerador (#16). */
function paresDoStyle(style) {
  const mapa = new Map();
  for (const p of style.split(';').filter(Boolean)) {
    const i = p.indexOf('=');
    if (i === -1) mapa.set(p, '');
    else mapa.set(p.slice(0, i), p.slice(i + 1));
  }
  return mapa;
}

// Candidatos conhecidos para o índice reverso. Uma extração real varreria o
// catálogo inteiro (403 services + 20 grupos); aqui bastam os nomes que um
// diagrama de referência plausivelmente usa — o mecanismo é o mesmo.
const GRUPOS_CANDIDATOS = [
  'AWS Cloud', 'AWS Account', 'Region', 'VPC', 'Availability Zone',
  'Private subnet', 'Public subnet', 'Security group', 'Auto Scaling group', 'Generic group',
];
const SERVICOS_CANDIDATOS = [
  'transit gateway', 'nat gateway', 'ec2', 'rds', 'lambda', 's3', 'dynamodb',
  'key management service', 'cloudfront', 'api gateway',
];

// Token -> LISTA de candidatos, não um só: Private subnet e Public subnet
// usam o MESMO `grIcon` (o ícone de "security group" genérico) — só a cor
// separa os dois no catálogo real. Um token com >1 candidato precisa de
// desempate por cor, não é ambiguidade do extrator.
function indiceCatalogo(cat) {
  const idx = new Map();
  const add = (tok, entry) => {
    if (!tok) return;
    const lista = idx.get(tok) || [];
    lista.push(entry);
    idx.set(tok, lista);
  };
  for (const nome of GRUPOS_CANDIDATOS) {
    const g = cat.grupo(nome);
    if (g) add(tokenDoStyle(g.style), { tipo: 'grupo', nome, style: g.style });
  }
  for (const nome of SERVICOS_CANDIDATOS) {
    const s = cat.servico(nome);
    if (s) add(tokenDoStyle(s.style), { tipo: 'servico', nome: s.title, style: s.style });
  }
  return idx;
}

/** Extrai toda cell vértice de um .drawio (regex de campo, não DOM completo —
 *  o bastante para pegar id/style/value de <mxCell> e <object><mxCell>). */
function celulasDoXml(xml) {
  const out = [];
  const re = /<mxCell\b([^>]*)\bvertex="1"([^>]*)\/?>|<object\b([^>]*)>\s*<mxCell\b([^>]*)\bvertex="1"([^>]*)\/?>/g;
  let m;
  while ((m = re.exec(xml))) {
    const attrs = [m[1], m[2], m[3], m[4], m[5]].filter(Boolean).join(' ');
    const style = (attrs.match(/style="([^"]*)"/) || [, ''])[1];
    const value = (attrs.match(/(?:value|label)="([^"]*)"/) || [, ''])[1];
    if (style) out.push({ style, value });
  }
  return out;
}

function extrairConvencaoVisual(caminhos, cat) {
  const idx = indiceCatalogo(cat);
  const achados = [];
  for (const caminho of caminhos) {
    const xml = fs.readFileSync(caminho, 'utf8');
    for (const cel of celulasDoXml(xml)) {
      const tok = tokenDoStyle(cel.style);
      const candidatos = tok && idx.get(tok);
      if (!candidatos) continue; // ícone fora dos candidatos conhecidos — não é o ponto deste protótipo
      const real = paresDoStyle(cel.style);
      // Desempate por strokeColor quando o ícone sozinho não decide (Private
      // vs Public subnet). Se nenhum candidato bater a cor exata, assume o
      // primeiro — é o mesmo tipo de escolha marcada `revisar` que o #17 fez.
      const conhecido = candidatos.length === 1 ? candidatos[0]
        : candidatos.find(c => paresDoStyle(c.style).get('strokeColor') === real.get('strokeColor')) || candidatos[0];
      const canonico = paresDoStyle(conhecido.style);
      for (const [chave, valor] of real) {
        if (!canonico.has(chave) || canonico.get(chave) !== valor) {
          achados.push({
            alvo: conhecido.nome, tipo: conhecido.tipo, chave,
            catalogo: canonico.has(chave) ? canonico.get(chave) : null,
            observado: valor,
            fonte: path.relative(process.cwd(), caminho),
          });
        }
      }
    }
  }
  // Dedup por (alvo, chave, observado) — o mesmo grupo aparece 1x por conta neste exemplo.
  const vistos = new Set();
  return achados.filter(a => {
    const k = `${a.alvo}|${a.chave}|${a.observado}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

// ------------------------------------------------------------------- main

function extrair(dirPack) {
  const cat = carregar(path.join(__dirname, '..', '..', 'catalog'));
  const caminhoPremissas = path.join(dirPack, 'premissas.md');
  const dirExemplos = path.join(dirPack, 'exemplos');

  const premissas = fs.existsSync(caminhoPremissas) ? extrairPremissas(caminhoPremissas) : null;
  const exemplos = fs.existsSync(dirExemplos)
    ? fs.readdirSync(dirExemplos).filter(f => f.endsWith('.drawio')).map(f => path.join(dirExemplos, f))
    : [];
  const estiloVisual = exemplos.length ? extrairConvencaoVisual(exemplos, cat) : [];

  return {
    esquema: 'panlabs-aws-diagrams/restricoes@1',
    origem: {
      premissas: premissas ? path.relative(process.cwd(), caminhoPremissas) : null,
      exemplos: exemplos.map(e => path.relative(process.cwd(), e)),
    },
    catalogo: premissas ? premissas.catalogo : { proibidos: [], obrigatoriosQuandoAplicavel: [] },
    topologia: premissas ? premissas.topologia : [],
    nomenclatura: premissas ? premissas.nomenclatura : [],
    seguranca: premissas ? premissas.seguranca : [],
    estiloVisual,
  };
}

if (require.main === module) {
  const dirPack = process.argv[2];
  if (!dirPack) { console.error('uso: node extrair.cjs <dir-do-context-pack> [saida.json]'); process.exit(1); }
  const restricoes = extrair(dirPack);
  const saida = process.argv[3];
  const texto = JSON.stringify(restricoes, null, 2) + '\n';
  if (saida) { fs.writeFileSync(saida, texto); console.log('escrito:', saida); }
  else process.stdout.write(texto);
}

module.exports = { extrair };
