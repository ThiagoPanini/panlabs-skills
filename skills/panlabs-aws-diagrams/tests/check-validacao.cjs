#!/usr/bin/env node
'use strict';
/**
 * O validador só vale se ele REPROVAR — e se disser por quê de um jeito que
 * quem escreveu o modelo consiga consertar. Cada caso abaixo é um erro que um
 * agente comete de verdade, e a asserção é sobre a MENSAGEM, não só sobre o
 * código de saída.
 */

const path = require('path');
const { validar } = require(path.join(__dirname, '..', 'motor', 'validar.cjs'));
const { ESQUEMA } = require(path.join(__dirname, '..', 'motor', 'gerar.cjs'));

const base = {
  esquema: 'panlabs-aws-diagrams/modelo@1',
  id: 'teste', titulo: 'Teste', vista: 'tecnica',
  nos: [{ id: 'nuvem', tipo: 'nuvem' }],
};
const com = extra => ({ ...base, ...extra });

const casos = [
  {
    nome: 'coordenada contrabandeada no nó',
    modelo: com({ nos: [{ id: 'a', tipo: 'servico', servico: 'lambda', x: 10, y: 20 }] }),
    espera: 'propriedade desconhecida "x"',
  },
  {
    nome: 'erro de digitação com vizinho óbvio',
    modelo: com({ nos: [{ id: 'a', tipo: 'servico', servico: 'lambda', dentroo: 'nuvem' }] }),
    espera: 'você quis dizer "dentro"',
  },
  {
    nome: 'pai que não existe',
    modelo: com({ nos: [{ id: 'a', tipo: 'servico', servico: 'lambda', dentro: 'fantasma' }] }),
    espera: 'não existe',
  },
  {
    nome: 'contenção cíclica',
    modelo: com({ nos: [{ id: 'a', tipo: 'grupo', dentro: 'b' }, { id: 'b', tipo: 'grupo', dentro: 'a' }] }),
    espera: 'cíclica',
  },
  {
    nome: 'aresta que termina num container',
    modelo: com({
      nos: [{ id: 'vpc', tipo: 'vpc' }, { id: 'l', tipo: 'servico', servico: 'lambda' }],
      arestas: [{ de: 'l', para: 'vpc' }],
    }),
    espera: 'é um container',
  },
  {
    nome: 'subnet fora de VPC',
    modelo: com({ nos: [{ id: 's', tipo: 'subnet', acesso: 'privada', dentro: 'nuvem' }, { id: 'nuvem', tipo: 'nuvem' }] }),
    espera: 'fora de qualquer VPC',
  },
  {
    nome: 'serviço AWS na vista lógica',
    modelo: com({ vista: 'logica', nos: [{ id: 'a', tipo: 'servico', servico: 'lambda' }] }),
    espera: 'vista lógica é pré-serviços',
  },
  {
    nome: 'AZ declarada em algo que não é subnet',
    modelo: com({ nos: [{ id: 'a', tipo: 'servico', servico: 'lambda', az: 'us-east-1a' }] }),
    espera: 'esperado o literal "subnet"',
  },
  {
    nome: 'faixa misturando níveis da árvore',
    modelo: com({
      nos: [{ id: 'v', tipo: 'vpc' }, { id: 's', tipo: 'subnet', dentro: 'v', acesso: 'privada' },
            { id: 'e', tipo: 'servico', servico: 'ec2', dentro: 's' }],
      faixas: [{ id: 'f', membros: ['s', 'e'] }],
    }),
    espera: 'profundidades diferentes',
  },
  {
    nome: 'id fora do formato (vira id de mxCell)',
    modelo: com({ nos: [{ id: 'Meu Lambda!', tipo: 'servico', servico: 'lambda' }] }),
    espera: 'não casa com',
  },
  {
    nome: 'modelo válido continua válido',
    modelo: com({ nos: [{ id: 'a', tipo: 'servico', servico: 'lambda' }] }),
    espera: null,
  },
];

let falhas = 0;
for (const c of casos) {
  const r = validar(c.modelo, ESQUEMA);
  const texto = r.erros.join(' | ');
  const ok = c.espera === null ? r.ok : (!r.ok && texto.includes(c.espera));
  if (!ok) falhas++;
  console.log(`  ${ok ? '✓' : '✗'} ${c.nome}`);
  if (!ok) console.log(`      esperava conter ${JSON.stringify(c.espera)}, veio: ${texto || '(passou)'}`);
  else if (c.espera) console.log(`      → ${r.erros[0]}`);
}

console.log(falhas ? `\n  ✗ ${falhas}/${casos.length} falharam` : `\n  ✓ ${casos.length}/${casos.length} — o validador reprova o que deve e explica por quê.`);
process.exit(falhas ? 1 : 0);
