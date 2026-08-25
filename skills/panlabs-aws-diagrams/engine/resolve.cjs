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

const CATALOG_PATH = path.join(__dirname, '..', 'catalog', 'aws-shapes.cjs');

// Tipo do modelo -> nome do grupo no catálogo. A subnet depende de `acesso`.
const GROUP_OF = {
  cloud: 'AWS Cloud',
  account: 'AWS Account',
  region: 'Region',
  vpc: 'VPC',
  'security-group': 'Security group',
  group: 'Generic group',
};

// Métrica de texto. Não há como medir fonte sem renderizar, então isto é
// estimativa calibrada — e é por isso que o validador geométrico (#18) existe.
// As styles do catálogo desenham rótulo de folha com `fontSize=12`, não 10 —
// a primeira versão estimou por 10 e subdimensionou a faixa do rótulo em ~25%.
// Foi assim que o "VPC endpoint" encostou no rótulo "Catálogo" do RDS.
const MIN_LABEL = 23;
/**
 * ⚠️ NÃO HÁ MÉTRICA DE TEXTO AQUI — ela vem do tema.
 *
 * A largura por caractere e a altura de linha do #11 estavam calibradas contra
 * `fontSize=12`, o corpo que as styles do catálogo desenham e que o `N11` do #5
 * prescreve. Mudar o corpo muda a caixa reservada, que muda o vão, que muda a
 * geometria — então essa conta é do tema, e o tema entra no pipeline ANTES do
 * layout. Ver `tools/check-partition.cjs`.
 */

/** Quantas linhas o rótulo ocupa se quebrado numa caixa de `larg` px. */
function labelLines(text, larg, largCar) {
  if (!text) return 0;
  // um rótulo com qualificador (O21) já traz a quebra dentro dele
  const forcadas = String(text).split(/<br\s*\/?>/i);
  if (forcadas.length > 1)
    return forcadas.reduce((n, p) => n + labelLines(p.replace(/<[^>]+>/g, ''), larg, largCar), 0);
  const porLinha = Math.max(1, Math.floor(larg / largCar));
  let linhas = 1, atual = 0;
  for (const palavra of String(text).split(/\s+/)) {
    const custo = palavra.length + (atual ? 1 : 0);
    if (atual + custo > porLinha && atual > 0) { linhas++; atual = palavra.length; }
    else atual += custo;
  }
  return linhas;
}

function textWidth(text, largCar) {
  return Math.ceil(String(text || '').length * largCar);
}

function create(tema, dirCatalogo) {
  if (!tema) throw new Error('resolver.criar exige um tema — não existe caminho sem tema');
  const cat = require(dirCatalogo || CATALOG_PATH).load();

  const usados = [];   // trilha de auditoria: como cada nome foi resolvido
  const M = tema.metrica;

  function grupoDoNo(no) {
    if (no.kind === 'subnet') return no.access === 'public' ? 'Public subnet' : 'Private subnet';
    return GROUP_OF[no.kind] || 'Generic group';
  }

  /** Container: style + faixa de título reservada. */
  function container(no) {
    const name = grupoDoNo(no);
    const g = cat.group(name);
    if (!g) throw new Error(`grupo "${name}" ausente do catálogo`);
    usados.push({ id: no.id, pediu: no.kind, virou: g.title, via: 'group', corrections: g.corrections });
    const style = tema.group(g.style, g.title);
    // `spacingLeft=30` no style do grupo é a janela do ícone: o rótulo começa
    // depois dele. A faixa de título é área do filho (#2 §3.2), então quem
    // reserva é o motor.
    const temIcone = /grIcon=/.test(g.style);
    return {
      style,
      // A faixa de título é CALHA: reserva de rótulo, e portanto derivada do corpo
      // do texto do grupo — não da densidade. `check-partition.cjs` pegou isto: com
      // a faixa fixa em 4 degraus, subir `texto.grupo` para 16 pt não movia uma
      // coordenada e o rótulo passava a raspar a borda de cima.
      tituloH: Math.max(tema.lane(4), Math.round(tema.tokens.text.group * 2.2)),
      recuoTitulo: temIcone ? 30 : 8,
      color: (style.match(/strokeColor=(#[0-9A-Fa-f]{6})/) || [])[1] || '#5A6C86',
      corrections: g.corrections,
    };
  }

  /** Folha: style + caixa que já inclui a faixa do rótulo. */
  function leaf(no) {
    if (no.kind === 'block') {
      const larg = 170;
      const linhas = labelLines(no.label || no.id, larg - 16, M.largCar);
      usados.push({ id: no.id, pediu: 'block', virou: '(bloco lógico)', via: 'block' });
      return {
        // vista lógica: pré-serviços, portanto fora do alcance da convenção AWS.
        // É o único lugar onde a casa escolhe cor de caixa sem contrariar ninguém.
        style: tema.block(),
        label: no.label || no.id,
        formaW: larg, formaH: Math.max(56, 20 + linhas * M.altLinha),
        rotuloH: 0,                       // rótulo é interno — não há faixa a reservar
      };
    }

    const key = no.service || (no.kind === 'actor' ? 'users' : null);
    if (!key) throw new Error(`nó "${no.id}" do tipo "${no.kind}" sem chave de serviço`);
    const s = cat.service(key);
    if (!s) throw new Error(`serviço "${key}" não resolveu nem para o genérico`);
    usados.push({
      id: no.id, pediu: key, virou: s.title, via: s.via,
      fallback: s.via === 'generic' || String(s.via).includes(':'),
    });

    const name = no.label || s.rotuloSugerido || s.title;
    // O21 do #5: o nome diz o que É, o itálico diz o que faz AQUI. Quem decide
    // se mostra é o tema; o texto em si é fato do modelo — o único token de
    // estilo deste protótipo que precisou de um campo novo no IR.
    const label = tema.rotuloDeFolha(name, no.qualifier);
    const formaW = s.w || 78, formaH = s.h || 78;
    // #33/#35: a caixa é a largura MEDIDA do rótulo, não uma quebra assumida —
    // o mxGraph não quebra a linha do jeito que `linhasDoRotulo` supunha (ela
    // sai inteira, e o "quebrado" vinha só do `<br>` explícito de
    // `rotuloDeFolha`). Medir cada linha explícita e alargar até a mais larga
    // é o que faz o transbordo deixar de existir como conceito: o ícone fica
    // centrado dentro da caixa porque o style do catálogo já traz
    // `aspect=fixed` — não há offset para calcular aqui.
    const rotuloW = Math.max(0, ...label.split(/<br\s*\/?>/i)
      .map(row => textWidth(row.replace(/<[^>]+>/g, ''), M.largCar)));
    const caixaW = Math.max(formaW, rotuloW);
    const linhas = labelLines(label, caixaW, M.largCar);
    return {
      style: tema.service(s.style, s),
      label,
      formaW, formaH,
      rotuloH: Math.max(MIN_LABEL, linhas * M.altLinha),
      rotuloW,
      caixaW,
    };
  }

  function band(f) {
    const name = f.kind === 'auto-scaling' ? 'Auto Scaling group' : 'Generic group';
    const g = cat.group(name);
    usados.push({ id: f.id, pediu: f.kind || 'generic', virou: g.title, via: 'band', corrections: g.corrections });
    // Uma faixa existe para CRUZAR outras caixas, então o rótulo dela nasce por
    // cima de bordas alheias — com 2 colunas de AZ o centro da faixa cai
    // exatamente na divisa entre as zonas, e a linha tracejada risca o texto.
    // O halo resolve sem tocar em cor nem em traço: a paleta continua sendo do
    // catálogo, a legibilidade é do motor.
    const style = tema.band(g.style);
    return {
      style,
      color: (style.match(/strokeColor=(#[0-9A-Fa-f]{6})/) || [])[1],
    };
  }

  function faixaAz() {
    const g = cat.group('Availability Zone');
    return { style: tema.group(g.style, g.title), corrections: g.corrections };
  }

  return {
    container, leaf, band, faixaAz, cat, usados, tema,
    labelLines: (t, l) => labelLines(t, l, M.largCar),
    textWidth: t => textWidth(t, M.largCar),
    larguraDaAresta: t => textWidth(t, M.largCarAresta),
    larguraDoRotuloDeGrupo: t => textWidth(t, M.largCarGrupo),
  };
}

module.exports = { create, labelLines, textWidth };
