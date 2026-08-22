// #19 · O gatilho decidido: a AZ vira faixa desenhada, ou vira rótulo?
// Regra: >=2 AZs distintas E algum PAPEL de subnet presente em >=2 AZs.
// O papel é escopado por VPC — "private subnet" na VPC A e na VPC B são redes
// diferentes, e a repetição entre elas não afirma redundância zonal nenhuma.

function papel(vpcId, s) { return vpcId + '|' + s.kind + '|' + s.label; }

function desenharFaixasAZ(model) {
  const subnets = model.vpcs.flatMap(v => v.subnets.map(s => ({ ...s, vpc: v.id })));
  const azs = new Set(subnets.map(s => s.az).filter(Boolean));
  if (azs.size < 2) return { draw: false, why: `só ${azs.size} AZ distinta no modelo` };

  const porPapel = new Map();
  for (const s of subnets) {
    if (!s.az) continue;
    const k = papel(s.vpc, s);
    if (!porPapel.has(k)) porPapel.set(k, new Set());
    porPapel.get(k).add(s.az);
  }
  const redundantes = [...porPapel.entries()].filter(([, zs]) => zs.size >= 2);
  if (!redundantes.length)
    return { draw: false, why: `${azs.size} AZs, mas nenhum papel de subnet se repete entre elas` };
  return { draw: true, why: `${redundantes.length} papel(is) em ≥2 AZs: ` +
    redundantes.map(([k, zs]) => `${k.split('|')[0]}/${k.split('|')[2]}×${zs.size}`).join(', ') };
}

// ---------------------------------------------------------------- casos de prova
const casos = [
  { nome: 'prod 3 AZs (público+privado) + inspeção 2 AZs — o cenário do protótipo',
    esperado: true,
    vpcs: [{ id:'prod', subnets:[
        {kind:'pub',label:'Public subnet',az:'us-east-1a'},{kind:'pub',label:'Public subnet',az:'us-east-1b'},
        {kind:'pub',label:'Public subnet',az:'us-east-1c'},{kind:'priv',label:'Private subnet',az:'us-east-1a'},
        {kind:'priv',label:'Private subnet',az:'us-east-1b'},{kind:'priv',label:'Private subnet',az:'us-east-1c'}]},
      { id:'insp', subnets:[
        {kind:'pub',label:'Firewall subnet',az:'us-east-1a'},{kind:'pub',label:'Firewall subnet',az:'us-east-1b'}]}]},

  { nome: 'uma AZ só, com público e privado — não afirma nada zonal',
    esperado: false,
    vpcs: [{ id:'v', subnets:[
        {kind:'pub',label:'Public subnet',az:'us-east-1a'},{kind:'priv',label:'Private subnet',az:'us-east-1a'}]}]},

  { nome: '2 AZs mas papéis DIFERENTES em cada — zonas por acidente, não por projeto',
    esperado: false,
    vpcs: [{ id:'v', subnets:[
        {kind:'pub',label:'Public subnet',az:'us-east-1a'},{kind:'priv',label:'Private subnet',az:'us-east-1b'}]}]},

  { nome: 'AWS SRA — subnets sem zona declarada (o corpus real medido)',
    esperado: false,
    vpcs: [{ id:'insp', subnets:[{kind:'pub',label:'Firewall subnet'}]},
           { id:'app',  subnets:[{kind:'priv',label:'Private subnet'},{kind:'priv',label:'Private subnet'}]}]},

  { nome: 'mesmo papel em 2 VPCs distintas, 1 AZ cada — NÃO conta (papel é escopado por VPC)',
    esperado: false,
    vpcs: [{ id:'a', subnets:[{kind:'priv',label:'Private subnet',az:'us-east-1a'}]},
           { id:'b', subnets:[{kind:'priv',label:'Private subnet',az:'us-east-1b'}]}]},

  { nome: 'par mínimo que afirma redundância — mesmo papel, mesma VPC, 2 AZs',
    esperado: true,
    vpcs: [{ id:'v', subnets:[
        {kind:'priv',label:'Private subnet',az:'us-east-1a'},{kind:'priv',label:'Private subnet',az:'us-east-1b'}]}]},
];

let falhas = 0;
for (const c of casos) {
  const r = desenharFaixasAZ(c);
  const ok = r.draw === c.esperado;
  if (!ok) falhas++;
  console.log(`${ok ? '✓' : '✗'} ${r.draw ? 'DESENHA' : ' OMITE '} — ${c.nome}\n            ${r.why}`);
}
console.log(falhas ? `\n${falhas} FALHA(S)` : '\n6/6 — a regra distingue redundância projetada de zona acidental.');
