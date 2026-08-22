'use strict';

const CAMADAS = ['borda', 'aplicacao', 'dados'];
const ORDEM_CAMADA = new Map(CAMADAS.map((camada, i) => [camada, i]));
const ORDEM_ACESSO = new Map([['publica', 0], ['privada', 1]]);

const CAMADA_POR_PALETA = new Map([
  ['network_content_delivery', 'borda'],
  ['compute', 'aplicacao'],
  ['containers', 'aplicacao'],
  ['serverless', 'aplicacao'],
  ['front_end_web_mobile', 'aplicacao'],
  ['database', 'dados'],
  ['storage', 'dados'],
]);

const chaveTexto = valor => String(valor || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

function indexarFilhos(nos) {
  const filhos = new Map(nos.map(no => [no.id, []]));
  for (const no of nos) {
    if (no.dentro && filhos.has(no.dentro)) filhos.get(no.dentro).push(no);
  }
  return filhos;
}

function descendentesDe(id, filhos) {
  const resultado = [];
  const visitar = pai => {
    for (const filho of filhos.get(pai) || []) {
      resultado.push(filho);
      visitar(filho.id);
    }
  };
  visitar(id);
  return resultado;
}

function classificar(subnet, filhos, catalogo) {
  if (subnet.acesso === 'publica') {
    return { camada: 'borda', origem: 'exposicao', evidencias: [] };
  }
  if (subnet.camada !== undefined) {
    if (!CAMADAS.includes(subnet.camada))
      throw new Error(`subnet "${subnet.id}" tem camada desconhecida: "${subnet.camada}"`);
    return { camada: subnet.camada, origem: 'declarada', evidencias: [] };
  }

  const evidencias = descendentesDe(subnet.id, filhos)
    .filter(no => no.tipo === 'servico')
    .map(no => {
      const shape = catalogo.servico(no.servico);
      const camada = shape && !shape.via.startsWith('generico')
        ? CAMADA_POR_PALETA.get(shape.palette)
        : undefined;
      return { no: no.id, servico: no.servico, palette: shape && shape.palette, camada };
    })
    .filter(e => e.camada);
  const candidatas = [...new Set(evidencias.map(e => e.camada))];

  if (candidatas.length === 1)
    return { camada: candidatas[0], origem: 'catalogo', evidencias };
  return {
    camada: 'indefinida',
    origem: candidatas.length ? 'conteudo-misto' : 'sem-evidencia',
    evidencias,
  };
}

function ordenarCamadas(modelo, catalogo) {
  const filhos = indexarFilhos(modelo.nos);
  const subnets = modelo.nos.filter(no => no.tipo === 'subnet').map(no => ({
    no,
    ...classificar(no, filhos, catalogo),
  }));

  subnets.sort((a, b) =>
    (ORDEM_ACESSO.get(a.no.acesso) ?? 2) - (ORDEM_ACESSO.get(b.no.acesso) ?? 2) ||
    (ORDEM_CAMADA.get(a.camada) ?? CAMADAS.length) - (ORDEM_CAMADA.get(b.camada) ?? CAMADAS.length) ||
    chaveTexto(a.no.rotulo || a.no.id).localeCompare(chaveTexto(b.no.rotulo || b.no.id), 'en') ||
    a.no.id.localeCompare(b.no.id, 'en'));

  return subnets;
}

module.exports = { CAMADAS, CAMADA_POR_PALETA, classificar, indexarFilhos, ordenarCamadas };
