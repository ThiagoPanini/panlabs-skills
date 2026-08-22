# Premissas de arquitetura — Acme Corp (sintético)

> Material fictício, escrito para este protótipo. Nenhum dado real. Serve para
> projetar o contrato do context pack contra algo concreto, como a premissa 10
> do mapa manda — o usuário real não tem este material hoje.

## Catálogo de serviços

### Proibidos

- Internet Gateway anexado a uma VPC de conta de aplicação.
- NAT Gateway em qualquer subnet de conta de aplicação.

### Obrigatórios quando aplicável

- Transit Gateway para toda rota entre VPCs e para toda saída à internet.
- VPC endpoint (interface ou gateway) para qualquer serviço AWS alcançado a
  partir de uma subnet privada — nunca sai pela internet.

## Topologia obrigatória

- Toda subnet de conta de aplicação é **privada**. Não existe subnet pública
  em conta de aplicação — sem exceção de workload.
- Todo egress, de qualquer natureza (internet, on-prem, outra VPC), atravessa
  a **conta de trânsito** via Transit Gateway. Uma VPC de aplicação nunca tem
  rota direta para um Internet Gateway.
- A conta de trânsito é compartilhada por todas as contas de aplicação. Contas
  de aplicação anexam (`attach`) ao Transit Gateway; nunca se conectam direto
  entre si (sem VPC peering ponto-a-ponto entre contas de workload).

## Nomenclatura

- Recurso: `acme-<camada>-<sufixo>`, minúsculo, kebab-case. Exemplos:
  `acme-app-1a`, `acme-tgw-hub`.
- VPC: `acme-vpc-<propósito>`. Exemplos: `acme-vpc-workload`,
  `acme-vpc-transito`.

## Padrões de segurança

- Toda subnet com dado em repouso referencia uma chave gerenciada pelo
  cliente (KMS CMK) — nunca a chave gerenciada pela AWS (`aws/service`).
- Todo serviço que fala com uma API AWS a partir de subnet privada usa VPC
  endpoint — ver "Catálogo de serviços" acima.
