'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { gerar } = require('../gerar.cjs');

function modelo(subnets) {
  return {
    titulo: 'Ordem das camadas de rede',
    nos: [
      { id: 'vpc', tipo: 'vpc', rotulo: 'VPC' },
      ...subnets.flatMap(s => [
        { id: s.id, tipo: 'subnet', rotulo: s.rotulo, acesso: s.acesso || 'privada',
          dentro: 'vpc', ...(s.camada ? { camada: s.camada } : {}) },
        ...(s.servicos || (s.servico ? [s.servico] : [])).map((servico, i) =>
          ({ id: `${s.id}-svc-${i}`, tipo: 'servico', servico, dentro: s.id })),
      ]),
    ],
  };
}

function yDaSubnet(xml, id) {
  const trecho = new RegExp(`<object[^>]+id="${id}"[\\s\\S]*?<mxGeometry[^>]+y="([0-9.]+)"`).exec(xml);
  assert.ok(trecho, `subnet ${id} existe no XML público`);
  return Number(trecho[1]);
}

test('App subnet fica acima de Data subnet pelo conteúdo, não pelo rótulo', () => {
  const entrada = modelo([
    { id: 'data', rotulo: 'Data subnet', servico: 'rds' },
    { id: 'app', rotulo: 'App subnet', servico: 'ec2' },
  ]);

  const { xml } = gerar(entrada);

  assert.ok(yDaSubnet(xml, 'app') < yDaSubnet(xml, 'data'));
});

for (const [nome, aplicacao, dados] of [
  ['Web subnet fica acima de Data subnet', { id: 'web', rotulo: 'Web subnet', servico: 'ecs' },
    { id: 'data', rotulo: 'Data subnet', servico: 'aurora' }],
  ['Ingest subnet fica acima de Core subnet', { id: 'ingest', rotulo: 'Ingest subnet', servico: 'lambda' },
    { id: 'core', rotulo: 'Core subnet', servico: 'dynamodb' }],
]) {
  test(`${nome}, mesmo quando o alfabeto pede o contrário`, () => {
    const entrada = modelo([dados, aplicacao]);
    const direto = gerar(entrada);
    const embaralhado = gerar({ ...entrada, nos: [...entrada.nos].reverse() });

    assert.ok(yDaSubnet(direto.xml, aplicacao.id) < yDaSubnet(direto.xml, dados.id));
    assert.equal(embaralhado.xml, direto.xml, 'a ordem do arquivo não muda o desenho');
  });
}

test('subnet vazia fica por último, marcada como indefinida e com aviso', () => {
  const { xml, relatorio } = gerar(modelo([
    { id: 'empty', rotulo: 'AAA subnet vazia' },
    { id: 'app', rotulo: 'Web subnet', servico: 'ec2' },
    { id: 'data', rotulo: 'Data subnet', servico: 'rds' },
  ]));

  assert.ok(yDaSubnet(xml, 'app') < yDaSubnet(xml, 'data'));
  assert.ok(yDaSubnet(xml, 'data') < yDaSubnet(xml, 'empty'));
  assert.match(xml, /id="empty"[^>]+panlabsCamada="indefinida"[^>]+panlabsOrigem="sem-evidencia"/);
  assert.deepEqual(relatorio.avisos, [
    'subnet "empty" ficou na camada indefinida (sem conteúdo classificável); use "camada" como escape semântico',
  ]);
});

test('camada declarada resolve subnet vazia sem introduzir ordem geométrica', () => {
  const { xml, relatorio } = gerar(modelo([
    { id: 'empty', rotulo: 'Subnet vazia', camada: 'aplicacao' },
    { id: 'data', rotulo: 'Data subnet', servico: 'rds' },
  ]));

  assert.ok(yDaSubnet(xml, 'empty') < yDaSubnet(xml, 'data'));
  assert.match(xml, /id="empty"[^>]+panlabsCamada="aplicacao"[^>]+panlabsOrigem="declarada"/);
  assert.deepEqual(relatorio.avisos, []);
});

test('conteúdo misto não é adivinhado', () => {
  const { xml, relatorio } = gerar(modelo([
    { id: 'mixed', rotulo: 'Mixed subnet', servicos: ['ec2', 'rds'] },
    { id: 'app', rotulo: 'App subnet', servico: 'ec2' },
  ]));

  assert.ok(yDaSubnet(xml, 'app') < yDaSubnet(xml, 'mixed'));
  assert.match(xml, /id="mixed"[^>]+panlabsCamada="indefinida"[^>]+panlabsOrigem="conteudo-misto"/);
  assert.match(relatorio.avisos[0], /conteúdo aponta para mais de uma camada/);
});

test('exposição pública continua sendo o primeiro critério', () => {
  const { xml } = gerar(modelo([
    { id: 'data', rotulo: 'Data subnet', servico: 'rds' },
    { id: 'public', rotulo: 'Public subnet', acesso: 'publica', servico: 'rds' },
    { id: 'app', rotulo: 'App subnet', servico: 'ec2' },
  ]));

  assert.ok(yDaSubnet(xml, 'public') < yDaSubnet(xml, 'app'));
  assert.ok(yDaSubnet(xml, 'app') < yDaSubnet(xml, 'data'));
  assert.match(xml, /id="public"[^>]+panlabsCamada="borda"[^>]+panlabsOrigem="exposicao"/);
});

test('camada é semântica fechada, não um número de posição', () => {
  assert.throws(
    () => gerar(modelo([{ id: 'bad', rotulo: 'Bad subnet', camada: '2' }])),
    /camada desconhecida/,
  );
});
