#!/usr/bin/env node
/**
 * Catálogo de shapes AWS — resolução de nome e montagem de style string.
 *
 * O catálogo é compacto de propósito: 403 service icons + 606 resource icons
 * não viram 1009 strings literais, e sim `template + (categoria, stencil)`.
 * A style só existe quando alguém pede.
 *
 *   const cat = require('./aws-shapes.cjs').carregar();
 *   cat.servico('lambda');   // -> { style, w, h, via: 'servico', ... }
 *   cat.grupo('vpc');        // -> { style, w, h, ... }  (já corrigido)
 *
 * Referência: docs/research/drawio-aws-shape-catalog.md
 */
'use strict';

const fs = require('fs');
const path = require('path');

// ------------------------------------------------------------ normalização

/**
 * Um nome de serviço chega de muitos jeitos: "Amazon S3", "s3",
 * "Simple Storage Service (S3)", "simple_storage_service". Todos precisam
 * cair no mesmo balde antes de qualquer comparação.
 */
function normalizar(nome) {
  return String(nome)
    .toLowerCase()
    .replace(/[_\-/]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(aws|amazon)\s+/, '')
    .trim();
}

/** "Simple Storage Service (S3)" indexa também como "s3" e como "simple storage service". */
function variantes(titulo) {
  const out = new Set([normalizar(titulo)]);
  const m = String(titulo).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    out.add(normalizar(m[1]));
    out.add(normalizar(m[2]));
  }
  return [...out].filter(Boolean);
}

// ------------------------------------------------------------------ styles

function aplicarTemplate(tpl, { fill, stencil }) {
  return tpl
    .split('${FILL}').join(fill)
    .split('${STENCIL}').join(stencil);
}

/** Troca o valor de uma chave de style, preservando a ordem das demais. */
function setChave(style, chave, valor) {
  const partes = style.split(';');
  let achou = false;
  const novas = partes.map(p => {
    if (p.startsWith(chave + '=')) { achou = true; return chave + '=' + valor; }
    return p;
  });
  if (!achou) {
    // insere antes do terminador vazio final, se houver
    const i = novas.length && novas[novas.length - 1] === '' ? novas.length - 1 : novas.length;
    novas.splice(i, 0, chave + '=' + valor);
  }
  return novas.join(';');
}

function temChave(style, chave) {
  return style.split(';').some(p => p === chave || p.startsWith(chave + '='));
}

// ---------------------------------------------------------------- correções

/**
 * Aplica ao grupo o delta "o que o draw.io entrega" -> "o que a AWS prescreve":
 * cores da paleta pré-2022 e a falta de container=1. Ver correcoes.json.
 */
function corrigirGrupo(style, correcoes) {
  let s = style;
  const aplicadas = [];

  for (const [legado, info] of Object.entries(correcoes.paletaLegada)) {
    if (legado.startsWith('_')) continue;
    if (s.includes(legado)) {
      s = s.split(legado).join(info.para);
      aplicadas.push(`${legado}->${info.para}`);
    }
  }

  if (!temChave(s, 'container')) {
    const sufixo = correcoes.container.sufixo;
    s = (s.endsWith(';') ? s : s + ';') + sufixo;
    aplicadas.push('container=1');
  }

  return { style: s, correcoes: aplicadas };
}

// ------------------------------------------------------------------ carga

function carregar(dir) {
  const base = dir || __dirname;
  const catalogo = JSON.parse(fs.readFileSync(path.join(base, 'aws4.catalog.json'), 'utf8'));
  const correcoes = JSON.parse(fs.readFileSync(path.join(base, 'correcoes.json'), 'utf8'));

  const corDaCategoria = cat => (catalogo.categories[cat] || {}).fill || '#232F3D';

  // ---- índices -------------------------------------------------------

  const porNome = new Map();      // nome normalizado -> [entradas]
  const porStencil = new Map();   // stencil -> entrada (service icon vence)
  const gruposPorNome = new Map();

  function indexar(entrada, tipo) {
    const rec = { ...entrada, tipo };
    for (const v of variantes(entrada.title)) {
      if (!porNome.has(v)) porNome.set(v, []);
      porNome.get(v).push(rec);
    }
    const sn = normalizar(entrada.stencil);
    if (sn && !porNome.has(sn)) porNome.set(sn, []);
    if (sn) porNome.get(sn).push(rec);

    // service icon tem precedência sobre resource icon no mesmo stencil
    if (!porStencil.has(entrada.stencil) || tipo === 'servico') {
      if (!(porStencil.get(entrada.stencil) || {}).tipo || tipo === 'servico') {
        porStencil.set(entrada.stencil, rec);
      }
    }
    return rec;
  }

  for (const s of catalogo.services) indexar(s, 'servico');
  for (const r of catalogo.resources) indexar(r, 'recurso');
  for (const g of catalogo.groups) {
    for (const v of variantes(g.title)) {
      if (!gruposPorNome.has(v)) gruposPorNome.set(v, g);   // 1ª variante vence
    }
  }

  // ---- montagem de style ---------------------------------------------

  function montar(rec) {
    if (rec.style) {                       // fora do template: literal do upstream
      return { style: rec.style, literal: true };
    }
    const tpl = rec.tipo === 'servico' ? catalogo.templates.svc.style : catalogo.templates.res.style;
    const fill = rec.fill || corDaCategoria(rec.palette);
    return { style: aplicarTemplate(tpl, { fill, stencil: rec.stencil }), literal: false };
  }

  function entregar(rec, via) {
    const { style, literal } = montar(rec);
    return {
      style, via, literal,
      title: rec.title, stencil: rec.stencil, palette: rec.palette,
      fill: rec.fill || corDaCategoria(rec.palette),
      w: rec.w, h: rec.h
    };
  }

  // ---- busca ----------------------------------------------------------

  function buscar(nome) {
    const n = normalizar(nome);

    // 0. título que existe em mais de uma paleta com cor/ícone divergente.
    //    Vem ANTES da busca por nome: é justamente o caso em que o nome sozinho
    //    não decide, e "o primeiro que casar" faria a mesma arquitetura sair
    //    com cores diferentes conforme a ordem da paleta.
    const des = correcoes.desambiguacao[n];
    if (des && !n.startsWith('_')) {
      const escolhido = (porNome.get(n) || []).find(
        c => c.stencil === des.stencil && c.palette === des.palette);
      if (escolhido) return { candidatos: [escolhido], via: 'desambiguado:' + des.origem };
    }

    // 1. rename congelado (OpenSearch -> elasticsearch_service).
    //    ANTES da busca por título, e não depois: o rename é um override
    //    curado, e o caso que obriga a essa ordem é o SageMaker — pedir
    //    "sagemaker" casa por título exato com 'Sagemaker' (sagemaker_2, roxo
    //    de Analytics) e nunca chegaria em 'SageMaker AI' (sagemaker, teal).
    //    O título que o upstream não atualizou venceria o nome atual.
    const ren = correcoes.renomes[n];
    if (ren && porStencil.has(ren)) return { candidatos: [porStencil.get(ren)], via: 'renome' };

    // 2. título ou nome de stencil, direto
    if (porNome.has(n)) return { candidatos: porNome.get(n), via: 'nome' };

    // 3. sigla / apelido — DEPOIS do título: conveniência nossa não derruba
    //    um casamento real com o catálogo.
    const sin = correcoes.sinonimos[n];
    if (sin && porStencil.has(sin)) return { candidatos: [porStencil.get(sin)], via: 'sinonimo' };

    // 4. substring, e SÓ se for inequívoca. "trainium" acha "Trainium Instance";
    //    "gateway" não acha nada, porque casa com dezenas — e adivinhar qual
    //    seria pior que cair no fallback.
    //    A fronteira de palavra não é preciosismo: sem ela "trainium" casa com
    //    a chave "ai", porque a substring crua está lá dentro.
    const contemPalavra = (hay, needle) => (' ' + hay + ' ').includes(' ' + needle + ' ');
    const chaves = [...porNome.keys()].filter(
      k => contemPalavra(k, n) || contemPalavra(n, k));
    const alvos = new Set();
    for (const k of chaves) for (const c of porNome.get(k)) alvos.add(c);
    if (alvos.size === 1) return { candidatos: [...alvos], via: 'substring' };
    if (alvos.size > 1) {
      // desempate: um único service icon entre os candidatos ainda é inequívoco
      const svcs = [...alvos].filter(c => c.tipo === 'servico');
      const stencils = new Set(svcs.map(c => c.stencil));
      if (stencils.size === 1) return { candidatos: svcs, via: 'substring' };
    }

    return null;
  }

  /**
   * Escada de fallback (pesquisa §5.6):
   *   service icon > resource icon > ícone da categoria > genérico > grupo genérico
   */
  function servico(nome, opts = {}) {
    const achado = buscar(nome);

    if (achado) {
      const svc = achado.candidatos.find(c => c.tipo === 'servico');
      if (svc) return entregar(svc, achado.via === 'nome' ? 'servico' : 'servico:' + achado.via);
      const res = achado.candidatos.find(c => c.tipo === 'recurso');
      if (res) return entregar(res, achado.via === 'nome' ? 'recurso' : 'recurso:' + achado.via);
    }

    if (opts.categoria) {
      const cat = normalizar(opts.categoria);
      const porCategoria = catalogo.services.find(
        s => s.palette === cat.replace(/ /g, '_') && normalizar(s.title) === cat);
      if (porCategoria) return entregar({ ...porCategoria, tipo: 'servico' }, 'categoria');
      const iconeCat = buscar(opts.categoria);
      if (iconeCat) {
        const c = iconeCat.candidatos.find(x => x.tipo === 'servico') || iconeCat.candidatos[0];
        if (c) return entregar(c, 'categoria');
      }
    }

    const generico = porStencil.get('generic_application');
    if (generico) return { ...entregar(generico, 'generico'), rotuloSugerido: String(nome) };

    return null;
  }

  function grupo(nome) {
    const g = gruposPorNome.get(normalizar(nome));
    if (!g) return null;
    const { style, correcoes: aplicadas } = corrigirGrupo(g.style, correcoes);
    return {
      style, title: g.title, w: g.w, h: g.h,
      shapeClass: g.shapeClass, grIcon: g.grIcon,
      correcoes: aplicadas,
      styleUpstream: g.style
    };
  }

  return {
    catalogo, correcoes,
    meta: catalogo.meta,
    servico, grupo, buscar, normalizar,
    grupos: () => catalogo.groups.map(g => g.title),
    categorias: () => catalogo.categories,
    corDaCategoria
  };
}

module.exports = { carregar, normalizar, variantes, aplicarTemplate, setChave, corrigirGrupo };

// --------------------------------------------------------------------- CLI

if (require.main === module) {
  const cat = carregar();
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log(`catálogo aws4 — draw.io ${cat.meta.drawio && cat.meta.drawio.version} (${cat.meta.commit && cat.meta.commit.slice(0, 8)})`);
    console.log(`  ${cat.catalogo.services.length} service icons · ${cat.catalogo.resources.length} resource icons · ${cat.catalogo.groups.length} grupos`);
    console.log(`uso: node aws-shapes.cjs <nome do serviço|grupo> ...`);
    process.exit(0);
  }
  for (const a of args) {
    const s = cat.servico(a);
    const g = cat.grupo(a);
    if (g) console.log(`grupo   ${a} -> ${g.title} [${g.correcoes.join(' ') || 'sem correção'}]\n  ${g.style}`);
    else if (s) console.log(`serviço ${a} -> ${s.title} (${s.stencil}, ${s.via}, ${s.fill})\n  ${s.style}`);
    else console.log(`?       ${a} -> não resolvido`);
  }
}
