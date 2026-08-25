'use strict';
/**
 * A ponte para o catálogo de shapes (#17), e a decisão de não depender dele.
 *
 * Cinco checagens querem saber o que é OFICIAL — o nome do serviço (A1.9), a
 * cor do ícone (A2.3), a vigência do id (A2.4). Esse conhecimento não é do
 * validador: é do catálogo, que é extraído do draw.io e datado.
 *
 * O acoplamento é opcional de propósito. O validador tem de rodar sobre um
 * plano que veio de qualquer lugar, e um `require` que estoura porque o
 * catálogo mudou de pasta transformaria as 60 checagens em zero. Sem catálogo,
 * as cinco viram `inaplicavel` — que é diferente de `ok`, e aparece no
 * relatório dizendo o que não foi conferido.
 */

const path = require('path');

const CAMINHO = path.join(__dirname, '..', '..', 'catalog', 'aws-shapes.cjs');

let cache;

/** `{ servico, grupo, titulos, vigencia, ids }`, ou `null` se o catálogo não carregar. */
function catalogo() {
  if (cache !== undefined) return cache;
  try {
    const cat = require(CAMINHO).carregar();
    const cru = cat.catalogo || {};
    const titulos = [];
    const ids = new Set();
    for (const grupo of ['services', 'resources', 'groups', 'other']) {
      const entradas = cru[grupo];
      if (!entradas) continue;
      for (const rec of Array.isArray(entradas) ? entradas : Object.values(entradas)) {
        if (!rec || typeof rec !== 'object') continue;
        if (rec.title) titulos.push(rec.title);
        if (rec.stencil) ids.add(String(rec.stencil));
      }
    }
    cache = {
      servico: nome => { try { return cat.servico(nome); } catch { return null; } },
      grupo: nome => { try { return cat.grupo(nome); } catch { return null; } },
      titulos,
      ids,
      vigencia: (cat.meta && cat.meta.drawio && cat.meta.drawio.date) || null,
      meta: cat.meta || null,
    };
  } catch {
    cache = null;
  }
  return cache;
}

/** O `fillColor` que o catálogo prescreve para um estilo, se houver. */
const preenchimentoDe = estilo => (String(estilo || '').match(/fillColor=(#[0-9A-Fa-f]{3,6})/) || [])[1] || null;

/**
 * O id de stencil de verdade.
 *
 * `shape=mxgraph.aws4.resourceIcon` é o INVÓLUCRO — o quadrado colorido que
 * todo service icon usa. Quem diz que serviço é aquilo é `resIcon`, e para
 * grupo é `grIcon`. Ler o `shape` e parar ali faz A2.4 reprovar todo ícone do
 * catálogo por não achar "resourceIcon" na lista de stencils, que é o oposto
 * do que a checagem quer dizer.
 */
function stencilDe(estilo) {
  const s = String(estilo || '');
  for (const chave of ['resIcon', 'grIcon', 'shape']) {
    const m = s.match(new RegExp(`(?:^|;)${chave}=mxgraph\\.aws4\\.([A-Za-z0-9_]+)`));
    if (m && m[1] !== 'resourceIcon') return m[1];
  }
  return null;
}

module.exports = { catalogo, preenchimentoDe, stencilDe, CAMINHO };
