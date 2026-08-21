// #21 · O modelo compartilhado pelos geradores e pelos medidores.
'use strict';
// ============================================================== o modelo
// App web 3 camadas multi-AZ com fluxo de requisição numerado.
// Atinge T1 (referência com consciência de rede) e T4 (fluxo numerado) de uma vez.
const ZONES = ['us-east-1a', 'us-east-1b', 'us-east-1c'];

const baseModel = () => ({
  zones: ZONES.slice(),
  stages: [
    { id: 'client' }, { id: 'edge' }, { id: 'public' },
    { id: 'app' }, { id: 'data' }, { id: 'object' },
  ],
  nodes: [
    { id: 'user',  svc: 'users',     label: 'Usuários',      stage: 'client', zone: null, box: null, outside: true },
    { id: 'r53',   svc: 'route 53',  label: 'Route 53',      stage: 'edge',   zone: null, box: null },
    { id: 'alb',   svc: 'application load balancer', label: 'Application<br>Load Balancer', stage: 'public', zone: null, box: 'pub', boxLabel: 'Sub-redes públicas · 1a · 1b · 1c' },
    { id: 'ec2-a', svc: 'ec2', label: 'EC2', stage: 'app',  zone: 'us-east-1a', box: 'priv', boxLabel: 'Sub-rede privada' },
    { id: 'ec2-b', svc: 'ec2', label: 'EC2', stage: 'app',  zone: 'us-east-1b', box: 'priv', boxLabel: 'Sub-rede privada' },
    { id: 'ec2-c', svc: 'ec2', label: 'EC2', stage: 'app',  zone: 'us-east-1c', box: 'priv', boxLabel: 'Sub-rede privada' },
    { id: 'rds-a', svc: 'rds', label: 'RDS<br>primário', stage: 'data', zone: 'us-east-1a', box: 'priv', boxLabel: 'Sub-rede privada' },
    { id: 'rds-b', svc: 'rds', label: 'RDS<br>standby',  stage: 'data', zone: 'us-east-1b', box: 'priv', boxLabel: 'Sub-rede privada' },
    { id: 's3',    svc: 's3',  label: 'S3',  stage: 'object', zone: null, box: null },
  ],
  bands: [
    { id: 'az-a', kind: 'az', label: 'Availability Zone · us-east-1a', members: ['ec2-a', 'rds-a'] },
    { id: 'az-b', kind: 'az', label: 'Availability Zone · us-east-1b', members: ['ec2-b', 'rds-b'] },
    { id: 'az-c', kind: 'az', label: 'Availability Zone · us-east-1c', members: ['ec2-c'] },
    { id: 'asg',  kind: 'member', label: 'Auto Scaling group', members: ['ec2-a', 'ec2-b', 'ec2-c'] },
  ],
  edges: [
    { from: 'user',  to: 'r53',   n: '1' },
    { from: 'r53',   to: 'alb',   n: '2' },
    { from: 'alb',   to: 'ec2-a', slot: -18 },
    { from: 'alb',   to: 'ec2-b', n: '3' },
    { from: 'alb',   to: 'ec2-c', slot:  18 },
    { from: 'ec2-a', to: 'rds-a', n: '4' },
    { from: 'ec2-b', to: 'rds-a', slot: -14 },
    { from: 'ec2-c', to: 'rds-a', slot: -26 },
    { from: 'rds-a', to: 'rds-b', across: true, dash: true, tag: 'replicação síncrona' },
    { from: 'ec2-a', to: 's3',    n: '5', slot: 40 },
  ],
  vpcStages: ['public', 'app', 'data'],
  vpcLabel: 'VPC · 10.0.0.0/16',
});


module.exports = { baseModel, ZONES };
