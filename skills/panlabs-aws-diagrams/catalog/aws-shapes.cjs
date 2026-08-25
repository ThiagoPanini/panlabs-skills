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
 * Referência: a pesquisa de shapes do #17, cristalizada em `aws4.catalog.json`
 * e `corrections.json` — que são a única fonte que este arquivo lê.
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
function normalize(name) {
  return String(name)
    .toLowerCase()
    .replace(/[_\-/]+/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(aws|amazon)\s+/, '')
    .trim();
}

/** "Simple Storage Service (S3)" indexa também como "s3" e como "simple storage service". */
function variants(title) {
  const out = new Set([normalize(title)]);
  const m = String(title).match(/^(.*?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    out.add(normalize(m[1]));
    out.add(normalize(m[2]));
  }
  return [...out].filter(Boolean);
}

// ------------------------------------------------------------------ styles

function applyTemplate(tpl, { fill, stencil }) {
  return tpl
    .split('${FILL}').join(fill)
    .split('${STENCIL}').join(stencil);
}

/** Troca o valor de uma chave de style, preservando a ordem das demais. */
function setKey(style, key, valor) {
  const partes = style.split(';');
  let achou = false;
  const novas = partes.map(p => {
    if (p.startsWith(key + '=')) { achou = true; return key + '=' + valor; }
    return p;
  });
  if (!achou) {
    // insere antes do terminador vazio final, se houver
    const i = novas.length && novas[novas.length - 1] === '' ? novas.length - 1 : novas.length;
    novas.splice(i, 0, key + '=' + valor);
  }
  return novas.join(';');
}

function temChave(style, key) {
  return style.split(';').some(p => p === key || p.startsWith(key + '='));
}

// ---------------------------------------------------------------- correções

/**
 * Aplica ao grupo o delta "o que o draw.io entrega" -> "o que a AWS prescreve":
 * cores da paleta pré-2022, a falta de container=1 e o tingimento das duas
 * subnets. Ver corrections.json.
 */
function fixGroup(style, corrections, title) {
  let s = style;
  const aplicadas = [];

  for (const [legado, info] of Object.entries(corrections.paletaLegada)) {
    if (legado.startsWith('_')) continue;
    if (s.includes(legado)) {
      s = s.split(legado).join(info.to);
      aplicadas.push(`${legado}->${info.to}`);
    }
  }

  if (!temChave(s, 'container')) {
    const sufixo = corrections.container.sufixo;
    s = (s.endsWith(';') ? s : s + ';') + sufixo;
    aplicadas.push('container=1');
  }

  // Duas subnets saem do draw.io TINGIDAS (#E6F6F7 / #F2F6E8) enquanto as outras
  // 18 são `none`. O deck é `<a:noFill/>` em todos (A2), e o tingimento derruba
  // #ED7100 de 3,02 para 2,71:1 em quem cai dentro. Ver preenchimentoDeGrupo.
  const pg = corrections.preenchimentoDeGrupo;
  if (pg && (pg.afeta || []).includes(title)) {
    const antes = (/(?:^|;)fillColor=([^;]*)/.exec(s) || [])[1];
    if (antes && antes !== pg.to) {
      s = setKey(s, 'fillColor', pg.to);
      aplicadas.push(`fillColor ${antes}->${pg.to}`);
    }
  }

  return { style: s, corrections: aplicadas };
}

// ------------------------------------------------------------------ carga

function load(dir) {
  const base = dir || __dirname;
  const catalog = JSON.parse(fs.readFileSync(path.join(base, 'aws4.catalog.json'), 'utf8'));
  const corrections = JSON.parse(fs.readFileSync(path.join(base, 'corrections.json'), 'utf8'));

  const corDaCategoria = cat => (catalog.categories[cat] || {}).fill || '#232F3D';

  // ---- índices -------------------------------------------------------

  const porNome = new Map();      // nome normalizado -> [entradas]
  const porStencil = new Map();   // stencil -> entrada (service icon vence)
  const gruposPorNome = new Map();

  function buildIndex(input, kind) {
    const rec = { ...input, kind };
    for (const v of variants(input.title)) {
      if (!porNome.has(v)) porNome.set(v, []);
      porNome.get(v).push(rec);
    }
    const sn = normalize(input.stencil);
    if (sn && !porNome.has(sn)) porNome.set(sn, []);
    if (sn) porNome.get(sn).push(rec);

    // service icon tem precedência sobre resource icon no mesmo stencil
    if (!porStencil.has(input.stencil) || kind === 'service') {
      if (!(porStencil.get(input.stencil) || {}).kind || kind === 'service') {
        porStencil.set(input.stencil, rec);
      }
    }
    return rec;
  }

  for (const s of catalog.services) buildIndex(s, 'service');
  for (const r of catalog.resources) buildIndex(r, 'recurso');
  for (const g of catalog.groups) {
    for (const v of variants(g.title)) {
      if (!gruposPorNome.has(v)) gruposPorNome.set(v, g);   // 1ª variante vence
    }
  }

  // ---- montagem de style ---------------------------------------------

  function build(rec) {
    if (rec.style) {                       // fora do template: literal do upstream
      return { style: rec.style, literal: true };
    }
    const tpl = rec.kind === 'service' ? catalog.templates.svc.style : catalog.templates.res.style;
    const fill = rec.fill || corDaCategoria(rec.palette);
    return { style: applyTemplate(tpl, { fill, stencil: rec.stencil }), literal: false };
  }

  function deliver(rec, via) {
    const { style, literal } = build(rec);
    return {
      style, via, literal,
      title: rec.title, stencil: rec.stencil, palette: rec.palette,
      fill: rec.fill || corDaCategoria(rec.palette),
      w: rec.w, h: rec.h
    };
  }

  // ---- busca ----------------------------------------------------------

  function lookup(name) {
    const n = normalize(name);

    // 0. título que existe em mais de uma paleta com cor/ícone divergente.
    //    Vem ANTES da busca por nome: é justamente o caso em que o nome sozinho
    //    não decide, e "o primeiro que casar" faria a mesma arquitetura sair
    //    com cores diferentes conforme a ordem da paleta.
    const des = corrections.desambiguacao[n];
    if (des && !n.startsWith('_')) {
      const chosen = (porNome.get(n) || []).find(
        c => c.stencil === des.stencil && c.palette === des.palette);
      if (chosen) return { candidatos: [chosen], via: 'desambiguado:' + des.origin };
    }

    // 1. rename congelado (OpenSearch -> elasticsearch_service).
    //    ANTES da busca por título, e não depois: o rename é um override
    //    curado, e o caso que obriga a essa ordem é o SageMaker — pedir
    //    "sagemaker" casa por título exato com 'Sagemaker' (sagemaker_2, roxo
    //    de Analytics) e nunca chegaria em 'SageMaker AI' (sagemaker, teal).
    //    O título que o upstream não atualizou venceria o nome atual.
    const ren = corrections.renomes[n];
    if (ren && porStencil.has(ren)) return { candidatos: [porStencil.get(ren)], via: 'renome' };

    // 2. título ou nome de stencil, direto
    if (porNome.has(n)) return { candidatos: porNome.get(n), via: 'name' };

    // 3. sigla / apelido — DEPOIS do título: conveniência nossa não derruba
    //    um casamento real com o catálogo.
    const sin = corrections.sinonimos[n];
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
      const svcs = [...alvos].filter(c => c.kind === 'service');
      const stencils = new Set(svcs.map(c => c.stencil));
      if (stencils.size === 1) return { candidatos: svcs, via: 'substring' };
    }

    return null;
  }

  /**
   * Escada de fallback (pesquisa §5.6):
   *   service icon > resource icon > ícone da categoria > genérico > grupo genérico
   */
  function service(name, opts = {}) {
    const finding = lookup(name);

    if (finding) {
      const svc = finding.candidatos.find(c => c.kind === 'service');
      if (svc) return deliver(svc, finding.via === 'name' ? 'service' : 'servico:' + finding.via);
      const res = finding.candidatos.find(c => c.kind === 'recurso');
      if (res) return deliver(res, finding.via === 'name' ? 'recurso' : 'recurso:' + finding.via);
    }

    if (opts.categoria) {
      const cat = normalize(opts.categoria);
      const porCategoria = catalog.services.find(
        s => s.palette === cat.replace(/ /g, '_') && normalize(s.title) === cat);
      if (porCategoria) return deliver({ ...porCategoria, kind: 'service' }, 'categoria');
      const iconeCat = lookup(opts.categoria);
      if (iconeCat) {
        const c = iconeCat.candidatos.find(x => x.kind === 'service') || iconeCat.candidatos[0];
        if (c) return deliver(c, 'categoria');
      }
    }

    const generic = porStencil.get('generic_application');
    if (generic) return { ...deliver(generic, 'generic'), rotuloSugerido: String(name) };

    return null;
  }

  function group(name) {
    const g = gruposPorNome.get(normalize(name));
    if (!g) return null;
    const { style, corrections: aplicadas } = fixGroup(g.style, corrections, g.title);
    return {
      style, title: g.title, w: g.w, h: g.h,
      shapeClass: g.shapeClass, grIcon: g.grIcon,
      corrections: aplicadas,
      styleUpstream: g.style
    };
  }

  return {
    catalog, corrections,
    meta: catalog.meta,
    service, group, lookup, normalize,
    grupos: () => catalog.groups.map(g => g.title),
    categorias: () => catalog.categories,
    corDaCategoria
  };
}

module.exports = { load, normalize, variants, applyTemplate, setKey, fixGroup };

// --------------------------------------------------------------------- CLI

if (require.main === module) {
  const cat = load();
  const args = process.argv.slice(2);
  if (!args.length) {
    console.log(`catálogo aws4 — draw.io ${cat.meta.drawio && cat.meta.drawio.version} (${cat.meta.commit && cat.meta.commit.slice(0, 8)})`);
    console.log(`  ${cat.catalog.services.length} service icons · ${cat.catalog.resources.length} resource icons · ${cat.catalog.groups.length} grupos`);
    console.log(`uso: node aws-shapes.cjs <nome do serviço|grupo> ...`);
    process.exit(0);
  }
  for (const a of args) {
    const s = cat.service(a);
    const g = cat.group(a);
    if (g) console.log(`grupo   ${a} -> ${g.title} [${g.corrections.join(' ') || 'sem correção'}]\n  ${g.style}`);
    else if (s) console.log(`serviço ${a} -> ${s.title} (${s.stencil}, ${s.via}, ${s.fill})\n  ${s.style}`);
    else console.log(`?       ${a} -> não resolvido`);
  }
}
