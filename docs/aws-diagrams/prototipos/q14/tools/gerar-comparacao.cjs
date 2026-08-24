#!/usr/bin/env node
'use strict';
/**
 * Gera `comparacao.html` — autocontido, abre com duplo clique, sem instalar nada.
 *
 * Mesma convencao do `q1/comparacao.html` e do `q21/comparacao.html`: a decisao
 * deste mapa se olha, nao se le. O que esta pagina tem a mais e que as duas
 * imagens NAO sao duas alternativas — sao a mesma coisa vista de dois jeitos, e
 * o alternador existe para deixar isso obvio: alterne e repare que as caixas
 * SAO as mesmas caixas.
 */

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const b64 = f => fs.readFileSync(path.join(RAIZ, 'saida', f)).toString('base64');

const LOGICA = b64('1-logica.png');
const TECNICA = b64('2-tecnica.png');

const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8">
<title>#14 · vista lógica → vista técnica</title>
<style>
  :root { --tinta:#232F3E; --fraco:#5A6C86; --linha:#DDE3EA; --fundo:#FBFCFD; --realce:#E7157B; }
  * { box-sizing:border-box; }
  body { margin:0; padding:28px 32px 64px; background:var(--fundo); color:var(--tinta);
         font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  h1 { font-size:21px; margin:0 0 4px; letter-spacing:-.01em; }
  .sub { color:var(--fraco); margin:0 0 22px; max-width:76ch; }
  .abas { display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap; align-items:center; }
  button { font:600 13px/1 inherit; padding:9px 16px; border-radius:7px; border:1px solid var(--linha);
           background:#fff; color:var(--tinta); cursor:pointer; }
  button[aria-pressed="true"] { background:var(--tinta); color:#fff; border-color:var(--tinta); }
  .dica { color:var(--fraco); font-size:13px; margin-left:6px; }
  .palco { border:1px solid var(--linha); border-radius:10px; background:#fff; overflow:auto; padding:10px; }
  .palco img { display:block; max-width:none; height:auto; }
  figcaption { color:var(--fraco); font-size:13px; margin:10px 2px 0; }
  .grade { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:18px; margin-top:34px; }
  .cartao { border:1px solid var(--linha); border-radius:10px; background:#fff; padding:16px 18px; }
  .cartao h2 { font-size:14px; margin:0 0 8px; text-transform:uppercase; letter-spacing:.05em; color:var(--fraco); }
  table { border-collapse:collapse; width:100%; font-size:13px; }
  td,th { padding:5px 8px; border-bottom:1px solid var(--linha); text-align:left; vertical-align:top; }
  th { color:var(--fraco); font-weight:600; }
  tr:last-child td { border-bottom:0; }
  code { font:12px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace; background:#F2F5F8; padding:1px 5px; border-radius:4px; }
  .sim { color:#1D8102; font-weight:600; } .nao { color:var(--realce); font-weight:600; }
  .nota { margin-top:34px; padding:14px 18px; border-left:3px solid var(--realce); background:#fff;
          border-radius:0 8px 8px 0; max-width:88ch; }
</style></head><body>

<h1>#14 · a mesma arquitetura, dois casacos</h1>
<p class="sub">Não são duas alternativas — é <strong>um modelo só</strong>, projetado em duas vistas.
Alterne entre elas e repare: são as mesmas caixas, com os mesmos ids, dentro das mesmas fronteiras.
A vista técnica só acrescenta o que só ela tem (VPC, subnet, endpoint, papel de IAM) e troca o casaco
de cada nó. A tradução <em>fronteira de responsabilidade → conta AWS</em> é troca de style, não de estrutura.</p>

<div class="abas">
  <button id="bL" aria-pressed="true">Vista lógica</button>
  <button id="bT" aria-pressed="false">Vista técnica</button>
  <span class="dica">as duas saíram do mesmo <code>varejo.drawio</code>, páginas 1 e 2</span>
</div>

<figure style="margin:0">
  <div class="palco"><img id="img" alt="" src="data:image/png;base64,${LOGICA}"></div>
  <figcaption id="cap">Capacidades e fronteiras de responsabilidade. Zero nome de serviço AWS — é a vista
  que a diretoria vê. Foi esta que o usuário aprovou, e é a impressão dela que o acordo guarda.</figcaption>
</figure>

<div class="grade">
  <div class="cartao">
    <h2>Onde o metadado sobrevive</h2>
    <table><tr><th>hospedeiro</th><th>volta íntegro</th></tr>
      <tr><td>atributo no <code>&lt;mxfile&gt;</code></td><td class="sim">sim</td></tr>
      <tr><td>atributo no <code>&lt;diagram&gt;</code></td><td class="sim">sim</td></tr>
      <tr><td>atributo no <code>&lt;mxGraphModel&gt;</code></td><td class="nao">NÃO</td></tr>
      <tr><td><code>&lt;object&gt;</code> na camada</td><td class="sim">sim</td></tr>
      <tr><td><code>&lt;object&gt;</code> oculto ← adotado</td><td class="sim">sim</td></tr>
      <tr><td><code>&lt;UserObject&gt;</code> oculto</td><td class="sim">sim</td></tr>
      <tr><td><code>&lt;object&gt;</code> na 2ª página</td><td class="sim">sim</td></tr>
    </table>
    <p style="font-size:13px;color:var(--fraco);margin:10px 0 0">
      E o <code>host</code> volta como <code>"Electron"</code> — o app escreve o próprio nome nele.
      Reconhecer o arquivo pelo <code>host</code> não funciona.</p>
  </div>

  <div class="cartao">
    <h2>Detectar edição humana</h2>
    <table><tr><th>esquema</th><th>acertos</th></tr>
      <tr><td>hash do arquivo inteiro</td><td class="nao">5/10</td></tr>
      <tr><td>semântica <em>sem cor</em> + aparência</td><td>9/10</td></tr>
      <tr><td>semântica <em>com cor</em> + aparência</td><td class="sim">10/10</td></tr>
    </table>
    <p style="font-size:13px;color:var(--fraco);margin:10px 0 0">
      O caso que separa os dois últimos: <code>Public subnet</code> e <code>Private subnet</code> têm o
      mesmo <code>shape</code> e o mesmo <code>grIcon</code>. Diferem <strong>só no hex</strong>.
      Num diagrama AWS, cor não é cosmético.</p>
  </div>

  <div class="cartao">
    <h2>O acordo, com controle</h2>
    <table>
      <tr><td>tirar o casaco lógico de uma capacidade</td><td class="sim">✓ pego</td></tr>
      <tr><td>renomear capacidade aprovada</td><td class="sim">✓ pego</td></tr>
      <tr><td>mudar capacidade de fronteira</td><td class="sim">✓ pego</td></tr>
      <tr><td>apagar capacidade aprovada</td><td class="sim">✓ pego</td></tr>
      <tr><td>acrescentar capacidade não discutida</td><td class="sim">✓ pego</td></tr>
      <tr><td>apagar a nota do achado recusado</td><td class="sim">✓ pego</td></tr>
      <tr><td>hub só-técnico com 2 entradas e 2 saídas</td><td class="sim">✓ pego</td></tr>
      <tr><td>acrescentar infraestrutura</td><td>✓ passou</td></tr>
      <tr><td>trocar o serviço AWS</td><td>✓ passou</td></tr>
      <tr><td>enfiar nível de rede e reparentar</td><td>✓ passou</td></tr>
      <tr><td>mudar o número da conta</td><td>✓ passou</td></tr>
      <tr><td>rótulo técnico novo numa aresta</td><td>✓ passou</td></tr>
    </table>
  </div>
</div>

<div class="nota">
  <strong>O que o alternador mostra e a prosa não mostra:</strong> a vista lógica não é a técnica com
  ícones trocados. <code>Processar na chegada</code> vira <code>Lambda</code> <em>e</em> muda de lugar na
  árvore — passa a viver dentro de <code>VPC › Private subnet</code>. A projeção lógica sai idêntica assim
  mesmo, porque ela <strong>colapsa</strong> os níveis que só a camada técnica tem. É isso que deixa a fase
  técnica detalhar sem mexer no que foi aprovado.
</div>

<script>
  var img = document.getElementById('img'), cap = document.getElementById('cap');
  var bL = document.getElementById('bL'), bT = document.getElementById('bT');
  var fontes = {
    L: ['data:image/png;base64,${LOGICA}',
        'Capacidades e fronteiras de responsabilidade. Zero nome de serviço AWS — é a vista que a diretoria vê. Foi esta que o usuário aprovou, e é a impressão dela que o acordo guarda.'],
    T: ['data:image/png;base64,${TECNICA}',
        'Serviços AWS, três contas, VPC e subnet privada. Mesmos ids, mesmas fronteiras — a fronteira de responsabilidade virou conta AWS. O VPC endpoint, o papel cross-account e o EventBridge só existem aqui.']
  };
  function mostrar(k) {
    img.src = fontes[k][0]; cap.textContent = fontes[k][1];
    bL.setAttribute('aria-pressed', k === 'L'); bT.setAttribute('aria-pressed', k === 'T');
  }
  bL.onclick = function () { mostrar('L'); };
  bT.onclick = function () { mostrar('T'); };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') mostrar('L');
    if (e.key === 'ArrowRight') mostrar('T');
  });
</script>
</body></html>
`;

const saida = path.join(RAIZ, 'comparacao.html');
fs.writeFileSync(saida, html);
console.log(`  → comparacao.html  (${Math.round(html.length / 1024)} KB, autocontido)`);
