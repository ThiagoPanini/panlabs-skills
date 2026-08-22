#!/usr/bin/env node
'use strict';
/**
 * Aplica `restricoes.json` a um IR (#11) e devolve o IR compatibilizado +
 * as notas que documentam cada mudança — nunca calado (mesma régua do #15
 * Fase 5: "relato + proposta").
 *
 *   node aplicar.cjs restricoes.json modelo.json saida.json
 *
 * A régua que decide REESCREVER vs SÓ SINALIZAR:
 *
 *   Reescreve quando o context pack fornece TANTO a regra de violação QUANTO
 *   o fato de substituição — aplicar não inventa arquitetura, só troca um
 *   fato do modelo por outro que a prosa já afirmou (subnet pública -> privada
 *   porque a prosa também afirma "egress via Transit Gateway", então o motor
 *   sabe o que colocar no lugar). Isso cobre topologia e nomenclatura.
 *
 *   Só sinaliza quando obedecer exigiria INVENTAR um fato que nem o modelo
 *   nem o context pack respondem — qual CMK, se é uma por serviço ou uma por
 *   conta. Isso é o mesmo caso do #15 Fase 5 (SPOF, DLQ ausente): a checagem
 *   é análise de grafo, a resposta cabe só ao humano. Cobre segurança.
 */

const fs = require('fs');
const path = require('path');

const CAMADA_DE = { 'App subnet': 'app', 'Data subnet': 'dado' };

function sufixoAz(az) {
  const m = String(az || '').match(/([0-9][a-z])$/);
  return m ? m[1] : az;
}

function aplicar(restricoes, modelo) {
  const notas = modelo.notas ? [...modelo.notas] : [];
  let nos = modelo.nos.map(n => ({ ...n }));
  let idSeq = 0;
  const novoId = prefixo => `${prefixo}-ctx-${++idSeq}`;

  // `texto` é o que o motor DESENHA (#11 planejar.cjs vira caixa de legenda,
  // presa ao nó se `sobre` vier junto) — curto, uma frase, sem citação
  // embutida: a primeira versão colava a premissa inteira ali e o render
  // saiu ilegível, caixas de nota se empilhando em cima dos ícones. A
  // citação completa mora em `dossie.contextPack`, que o esquema já marca
  // OPACO AO MOTOR — feito pra isto: auditoria que persiste sem virar
  // desenho.
  const auditoria = [];
  const nota = (texto, sobre, detalhe) => {
    notas.push({ id: novoId('nota'), texto, origem: 'premissa', ...(sobre ? { sobre } : {}) });
    auditoria.push({ sobre: sobre || null, resumo: texto, premissa: detalhe });
  };

  // ---- 1. topologia: subnet pública -> privada, NAT -> Transit Gateway ----
  const regraZeroPublica = restricoes.topologia.find(r => /subnet p[uú]blica/i.test(r.texto));
  const regraEgressTgw = restricoes.topologia.find(r => /egress/i.test(r.texto));
  if (regraZeroPublica && regraEgressTgw) {
    const publicas = nos.filter(n => n.tipo === 'subnet' && n.acesso === 'publica');
    for (const subnet of publicas) {
      const rotuloAntigo = subnet.rotulo;
      subnet.acesso = 'privada';
      subnet.rotulo = `acme-tgw-${sufixoAz(subnet.az)}`;
      // remove os NAT gateways que moravam dentro desta subnet — proibidos
      // pelo catálogo do context pack, e o motivo de existir já foi
      // substituído (regraEgressTgw diz o que assume o lugar).
      const filhos = nos.filter(n => n.dentro === subnet.id);
      for (const filho of filhos) {
        if (filho.tipo === 'servico' && restricoes.catalogo.proibidos.includes(filho.servico)) {
          nos = nos.filter(n => n.id !== filho.id);
          nota(`"${filho.rotulo}" removido — proibido pelo context pack.`, subnet.id,
            `catálogo.proibidos inclui "${filho.servico}"`);
        }
      }
      const attach = { id: novoId('tgw'), tipo: 'servico', servico: 'transit gateway', rotulo: `${subnet.rotulo} (attach)`, dentro: subnet.id };
      nos.push(attach);
      nota(`Virou subnet privada + attachment ao Transit Gateway (context pack).`, subnet.id,
        `${regraZeroPublica.texto} | ${regraEgressTgw.texto}`);
    }
  }

  // ---- 2. nomenclatura: rótulo de VPC e das subnets restantes ----
  for (const r of restricoes.nomenclatura) {
    if (/^VPC:/.test(r.texto)) {
      const vpc = nos.find(n => n.tipo === 'vpc');
      if (vpc && !/^acme-vpc-/.test(vpc.rotulo)) {
        const cidr = (vpc.rotulo.match(/[\d.]+\/\d+/) || [])[0];
        const antigo = vpc.rotulo;
        vpc.rotulo = `acme-vpc-workload${cidr ? ' · ' + cidr : ''}`;
        nota(`Renomeado de "${antigo}" — nomenclatura do context pack.`, vpc.id, r.texto);
      }
    }
    if (/^Recurso:/.test(r.texto)) {
      for (const n of nos) {
        if (n.tipo !== 'subnet' || !CAMADA_DE[n.rotulo]) continue;
        const antigo = n.rotulo;
        n.rotulo = `acme-${CAMADA_DE[antigo]}-${sufixoAz(n.az)}`;
        nota(`Renomeado de "${antigo}" — nomenclatura do context pack.`, n.id, r.texto);
      }
    }
  }

  // ---- 3. segurança: SÓ sinaliza — falta o fato de qual CMK/endpoint ----
  const regraCmk = restricoes.seguranca.find(r => /chave gerenciada/i.test(r.texto));
  if (regraCmk) {
    const comDadoEmRepouso = nos.filter(n => n.tipo === 'subnet' &&
      nos.some(f => f.dentro === n.id && f.tipo === 'servico' && /^rds$/.test(f.servico)));
    for (const subnet of comDadoEmRepouso) {
      nota(`Falta CMK do cliente para o dado em repouso — confirmar antes de aprovar.`, subnet.id, regraCmk.texto);
    }
  }
  const regraEndpoint = restricoes.seguranca.find(r => /VPC endpoint/i.test(r.texto) || /API AWS/i.test(r.texto));
  if (regraEndpoint) {
    nota(`Serviços em subnet privada podem precisar de VPC endpoint — confirmar integrações antes de aprovar.`, undefined, regraEndpoint.texto);
  }

  const dossie = { ...(modelo.dossie || {}), contextPack: auditoria };
  return { ...modelo, id: `${modelo.id}-compatibilizado`, titulo: `${modelo.titulo} (compatibilizado com o context pack)`, nos, notas, dossie };
}

if (require.main === module) {
  const [caminhoRestricoes, caminhoModelo, caminhoSaida] = process.argv.slice(2);
  if (!caminhoRestricoes || !caminhoModelo) {
    console.error('uso: node aplicar.cjs restricoes.json modelo.json [saida.json]');
    process.exit(1);
  }
  const restricoes = JSON.parse(fs.readFileSync(caminhoRestricoes, 'utf8'));
  const modelo = JSON.parse(fs.readFileSync(caminhoModelo, 'utf8'));
  const resultado = aplicar(restricoes, modelo);
  const texto = JSON.stringify(resultado, null, 2) + '\n';
  if (caminhoSaida) { fs.writeFileSync(caminhoSaida, texto); console.log('escrito:', caminhoSaida); }
  else process.stdout.write(texto);

  const auditoria = resultado.dossie.contextPack;
  console.error(`\n${auditoria.length} mudança(s) — texto curto é o que vai pro desenho, premissa é o que fica só em dossie.contextPack:`);
  for (const a of auditoria) console.error(`  - [${a.sobre || 'página'}] ${a.resumo}\n      premissa: ${a.premissa}`);
}

module.exports = { aplicar };
