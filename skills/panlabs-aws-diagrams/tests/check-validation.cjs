#!/usr/bin/env node
'use strict';
/**
 * O validador só vale se ele REPROVAR — e se disser por quê de um jeito que
 * quem escreveu o modelo consiga consertar. Cada caso abaixo é um erro que um
 * agente comete de verdade, e a asserção é sobre a MENSAGEM, não só sobre o
 * código de saída.
 */

const fs = require('fs');
const path = require('path');
const { validar, contraEsquema } = require(path.join(__dirname, '..', 'engine', 'validate.cjs'));
const { ESQUEMA } = require(path.join(__dirname, '..', 'engine', 'generate.cjs'));

// Um caso pode trazer o próprio esquema, e aí é medido por `contraEsquema` — o
// genérico. `validar` é o de `model@1`: ele soma checagens semânticas que
// pressupõem `nos`, e apontá-lo para outro contrato quebra antes de medir.
const ESQUEMA_ELABORACAO = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'session', 'elaboration.schema.json'), 'utf8'));
const elaboracao = extra => ({
  schema: 'panlabs-aws-diagrams/elaboration@1', about: 'target', ...extra,
});

const base = {
  schema: 'panlabs-aws-diagrams/model@1',
  id: 'teste', title: 'Teste', view: 'technical',
  nodes: [{ id: 'cloud', kind: 'cloud' }],
};
const com = extra => ({ ...base, ...extra });

const casos = [
  {
    name: 'coordenada contrabandeada no nó',
    modelo: com({ nodes: [{ id: 'a', kind: 'service', service: 'lambda', x: 10, y: 20 }] }),
    espera: 'propriedade desconhecida "x"',
  },
  {
    name: 'erro de digitação com vizinho óbvio',
    modelo: com({ nodes: [{ id: 'a', kind: 'service', service: 'lambda', dentroo: 'cloud' }] }),
    espera: 'você quis dizer "dentro"',
  },
  {
    name: 'pai que não existe',
    modelo: com({ nodes: [{ id: 'a', kind: 'service', service: 'lambda', inside: 'fantasma' }] }),
    espera: 'não existe',
  },
  {
    name: 'contenção cíclica',
    modelo: com({ nodes: [{ id: 'a', kind: 'group', inside: 'b' }, { id: 'b', kind: 'group', inside: 'a' }] }),
    espera: 'cíclica',
  },
  {
    name: 'aresta que termina num container',
    modelo: com({
      nodes: [{ id: 'vpc', kind: 'vpc' }, { id: 'l', kind: 'service', service: 'lambda' }],
      edges: [{ from: 'l', to: 'vpc' }],
    }),
    espera: 'é um container',
  },
  {
    name: 'subnet fora de VPC',
    modelo: com({ nodes: [{ id: 's', kind: 'subnet', access: 'private', inside: 'cloud' }, { id: 'cloud', kind: 'cloud' }] }),
    espera: 'fora de qualquer VPC',
  },
  {
    name: 'serviço AWS na vista lógica',
    modelo: com({ view: 'logical', nodes: [{ id: 'a', kind: 'service', service: 'lambda' }] }),
    espera: 'vista lógica é pré-serviços',
  },
  {
    name: 'AZ declarada em algo que não é subnet',
    modelo: com({ nodes: [{ id: 'a', kind: 'service', service: 'lambda', az: 'us-east-1a' }] }),
    espera: 'esperado o literal "subnet"',
  },
  {
    name: 'faixa misturando níveis da árvore',
    modelo: com({
      nodes: [{ id: 'v', kind: 'vpc' }, { id: 's', kind: 'subnet', inside: 'v', access: 'private' },
            { id: 'e', kind: 'service', service: 'ec2', inside: 's' }],
      bands: [{ id: 'f', members: ['s', 'e'] }],
    }),
    espera: 'profundidades diferentes',
  },
  {
    name: 'id fora do formato (vira id de mxCell)',
    modelo: com({ nodes: [{ id: 'Meu Lambda!', kind: 'service', service: 'lambda' }] }),
    espera: 'não casa com',
  },
  {
    name: 'modelo válido continua válido',
    modelo: com({ nodes: [{ id: 'a', kind: 'service', service: 'lambda' }] }),
    espera: null,
  },

  // ── patternProperties, as duas metades ──────────────────────────────────────
  // Um esquema fechado que ENUMERA comentário livre é contradição, e ela custou:
  // `elaboration@1` listava `_`, `_reparenta`, `_arestas` e `_refina` — as quatro
  // que existiam DENTRO da skill — e reprovava `_conferir`, que só aparecia num
  // artefato de caso que outro ticket havia movido para FORA dela. Verde nos dois
  // PRs, e o defeito só aparecia ao regerar o caso.
  //
  // As duas metades importam: permitir a chave sem validar o valor troca um
  // buraco por outro.
  {
    name: 'comentário livre em chave nova passa (a metade permissiva)',
    schema: ESQUEMA_ELABORACAO,
    modelo: elaboracao({ _conferir: 'a lição que o artefato de caso guarda' }),
    espera: null,
  },
  {
    name: 'e o VALOR dele ainda é validado (a metade que fecha o buraco)',
    schema: ESQUEMA_ELABORACAO,
    modelo: elaboracao({ _conferir: 123 }),
    espera: 'esperado string, veio integer',
  },
];

let falhas = 0;
for (const c of casos) {
  const r = c.schema
    ? (es => ({ ok: es.length === 0, erros: es }))(contraEsquema(c.modelo, c.schema, c.schema))
    : validar(c.modelo, ESQUEMA);
  const text = r.erros.join(' | ');
  const ok = c.espera === null ? r.ok : (!r.ok && text.includes(c.espera));
  if (!ok) falhas++;
  console.log(`  ${ok ? '✓' : '✗'} ${c.name}`);
  if (!ok) console.log(`      esperava conter ${JSON.stringify(c.espera)}, veio: ${text || '(passou)'}`);
  else if (c.espera) console.log(`      → ${r.erros[0]}`);
}

console.log(falhas ? `\n  ✗ ${falhas}/${casos.length} falharam` : `\n  ✓ ${casos.length}/${casos.length} — o validador reprova o que deve e explica por quê.`);
process.exit(falhas ? 1 : 0);
