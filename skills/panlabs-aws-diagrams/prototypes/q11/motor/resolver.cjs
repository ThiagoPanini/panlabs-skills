'use strict';
/**
 * Resolução: nó do modelo -> forma desenhável.
 *
 * É aqui que a semântica encosta no catálogo (#17) e sai do outro lado como
 * style string do mxGraph. O motor não conhece nenhum hex, nenhum stencil,
 * nenhum `container=1` — tudo isso vem do catálogo já corrigido.
 *
 * A única coisa que este módulo decide sozinho é TAMANHO, e por um motivo
 * concreto: no mxGraph o rótulo de um service icon é desenhado FORA dos bounds
 * (`verticalLabelPosition=bottom`). A geometria diz 78×78 e o desenho ocupa
 * 78×(78+rótulo). Quem passar 78×78 ao layout entrega colisão rótulo–rótulo,
 * que é `A3.2` da rubrica (#8). O motor reserva a faixa do rótulo porque o
 * mxGraph não reserva.
 */

const path = require('path');

const CAMINHO_CATALOGO = path.join(__dirname, '..', '..', '..', 'catalog', 'aws-shapes.cjs');

// Tipo do modelo -> nome do grupo no catálogo. A subnet depende de `acesso`.
const GRUPO_DE = {
  nuvem: 'AWS Cloud',
  conta: 'AWS Account',
  regiao: 'Region',
  vpc: 'VPC',
  'grupo-seguranca': 'Security group',
  grupo: 'Generic group',
};

// Métrica de texto. Não há como medir fonte sem renderizar, então isto é
// estimativa calibrada — e é por isso que o validador geométrico (#18) existe.
const LARG_CAR = 6.4;          // largura média por caractere a ~11px
const ALT_LINHA = 15;
const ROTULO_MIN = 20;
// O rótulo do service icon quebra nesta largura. Fixá-la é o que permite manter
// a caixa do layout igual à caixa do ícone: o transbordo passa a ser uma
// constante conhecida, comprada em `spacing`, e não uma caixa de largura
// variável que desalinharia a âncora da aresta.
const ROTULO_W = 120;

/** Quantas linhas o rótulo ocupa se quebrado numa caixa de `larg` px. */
function linhasDoRotulo(texto, larg) {
  if (!texto) return 0;
  const porLinha = Math.max(1, Math.floor(larg / LARG_CAR));
  let linhas = 1, atual = 0;
  for (const palavra of String(texto).split(/\s+/)) {
    const custo = palavra.length + (atual ? 1 : 0);
    if (atual + custo > porLinha && atual > 0) { linhas++; atual = palavra.length; }
    else atual += custo;
  }
  return linhas;
}

function larguraDoTexto(texto) {
  return Math.ceil(String(texto || '').length * LARG_CAR);
}

function criar(dirCatalogo) {
  const cat = require(dirCatalogo || CAMINHO_CATALOGO).carregar();

  const usados = [];   // trilha de auditoria: como cada nome foi resolvido

  function grupoDoNo(no) {
    if (no.tipo === 'subnet') return no.acesso === 'publica' ? 'Public subnet' : 'Private subnet';
    return GRUPO_DE[no.tipo] || 'Generic group';
  }

  /** Container: style + faixa de título reservada. */
  function container(no) {
    const nome = grupoDoNo(no);
    const g = cat.grupo(nome);
    if (!g) throw new Error(`grupo "${nome}" ausente do catálogo`);
    usados.push({ id: no.id, pediu: no.tipo, virou: g.title, via: 'grupo', correcoes: g.correcoes });
    // `spacingLeft=30` no style do grupo é a janela do ícone: o rótulo começa
    // depois dele. A faixa de título é área do filho (#2 §3.2), então quem
    // reserva é o motor.
    const temIcone = /grIcon=/.test(g.style);
    return {
      style: g.style,
      tituloH: 34,
      recuoTitulo: temIcone ? 30 : 8,
      cor: (g.style.match(/strokeColor=(#[0-9A-Fa-f]{6})/) || [])[1] || '#5A6C86',
      correcoes: g.correcoes,
    };
  }

  /** Folha: style + caixa que já inclui a faixa do rótulo. */
  function folha(no) {
    if (no.tipo === 'bloco') {
      const larg = 170;
      const linhas = linhasDoRotulo(no.rotulo || no.id, larg - 16);
      usados.push({ id: no.id, pediu: 'bloco', virou: '(bloco lógico)', via: 'bloco' });
      return {
        style: 'rounded=1;arcSize=12;whiteSpace=wrap;html=1;fillColor=#FFFFFF;strokeColor=#232F3E;' +
               'fontColor=#232F3E;fontSize=12;verticalAlign=middle;align=center;strokeWidth=1.5;',
        rotulo: no.rotulo || no.id,
        formaW: larg, formaH: Math.max(56, 20 + linhas * ALT_LINHA),
        rotuloH: 0,                       // rótulo é interno — não há faixa a reservar
      };
    }

    const chave = no.servico || (no.tipo === 'ator' ? 'users' : null);
    if (!chave) throw new Error(`nó "${no.id}" do tipo "${no.tipo}" sem chave de serviço`);
    const s = cat.servico(chave);
    if (!s) throw new Error(`serviço "${chave}" não resolveu nem para o genérico`);
    usados.push({
      id: no.id, pediu: chave, virou: s.title, via: s.via,
      fallback: s.via === 'generico' || String(s.via).includes(':'),
    });

    const rotulo = no.rotulo || s.rotuloSugerido || s.title;
    const formaW = s.w || 78, formaH = s.h || 78;
    const linhas = linhasDoRotulo(rotulo, ROTULO_W);
    return {
      style: s.style,
      rotulo,
      formaW, formaH,
      rotuloH: Math.max(ROTULO_MIN, linhas * ALT_LINHA),
      rotuloW: Math.min(ROTULO_W, larguraDoTexto(rotulo)),
      caixaW: formaW,          // a caixa do layout É a caixa do ícone
    };
  }

  function faixa(f) {
    const nome = f.tipo === 'auto-scaling' ? 'Auto Scaling group' : 'Generic group';
    const g = cat.grupo(nome);
    usados.push({ id: f.id, pediu: f.tipo || 'generico', virou: g.title, via: 'faixa', correcoes: g.correcoes });
    // Uma faixa existe para CRUZAR outras caixas, então o rótulo dela nasce por
    // cima de bordas alheias — com 2 colunas de AZ o centro da faixa cai
    // exatamente na divisa entre as zonas, e a linha tracejada risca o texto.
    // O halo resolve sem tocar em cor nem em traço: a paleta continua sendo do
    // catálogo, a legibilidade é do motor.
    return {
      style: g.style + 'labelBackgroundColor=#FFFFFF;',
      cor: (g.style.match(/strokeColor=(#[0-9A-Fa-f]{6})/) || [])[1],
    };
  }

  function faixaAz() {
    const g = cat.grupo('Availability Zone');
    return { style: g.style, correcoes: g.correcoes };
  }

  return { container, folha, faixa, faixaAz, cat, usados, linhasDoRotulo, larguraDoTexto };
}

module.exports = { criar, linhasDoRotulo, larguraDoTexto, ALT_LINHA, LARG_CAR, ROTULO_W };
