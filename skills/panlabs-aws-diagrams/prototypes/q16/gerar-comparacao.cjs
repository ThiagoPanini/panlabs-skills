#!/usr/bin/env node
'use strict';
/**
 * Monta `comparacao.html` — três renders num só toggle, mesmo padrão do
 * `prototypes/q1/comparacao.html`. Lê os PNGs do disco e embute como
 * data URI; não reinventa layout, só troca as imagens e o texto.
 *
 *   node gerar-comparacao.cjs
 */

const fs = require('fs');
const path = require('path');

const AQUI = __dirname;
const b64 = p => fs.readFileSync(p).toString('base64');

const IMGS = [
  { titulo: '1 · Exemplo do context pack', arq: path.join(AQUI, 'exemplo-context-pack', 'exemplos', 'referencia.png') },
  { titulo: '2 · Candidato — antes', arq: path.join(AQUI, 'saida', 'candidato-antes.png') },
  { titulo: '3 · Candidato — depois', arq: path.join(AQUI, 'saida', 'candidato-depois.png') },
];

const S = IMGS.map(i => `data:image/png;base64,${b64(i.arq)}`);

const botoes = IMGS.map((im, n) =>
  `  <button id="b${n}" class="${n === 0 ? 'on' : ''}" onclick="ver(${n})">${im.titulo}</button>`).join('\n');

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Q16 &mdash; contrato do context pack corporativo</title>
<style>
:root{--bg:#faf9f7;--ink:#1c1a17;--dim:#6b6560;--line:#e3ded7;--accent:#c2410c}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
 font:16px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,system-ui,sans-serif}
.wrap{max-width:1180px;margin:0 auto;padding:36px 24px 70px}
h1{font-size:26px;margin:0 0 6px;letter-spacing:-.02em}
p.lede{color:var(--dim);max-width:74ch;margin:0 0 4px}
p.lede strong{color:var(--ink)}
.switch{display:flex;gap:8px;margin:26px 0 14px;align-items:center;flex-wrap:wrap}
button{font:inherit;font-size:14px;padding:9px 16px;border-radius:8px;cursor:pointer;
 border:1px solid var(--line);background:#fff;color:var(--ink)}
button.on{background:var(--ink);color:#fff;border-color:var(--ink)}
button:hover:not(.on){border-color:var(--accent);color:var(--accent)}
.hint{color:var(--dim);font-size:13px;margin-left:6px}
.stage{background:#fff;border:1px solid var(--line);border-radius:12px;padding:10px;
 box-shadow:0 1px 3px rgba(0,0,0,.05);overflow-x:auto}
.stage img{display:block;width:100%;min-width:520px;height:auto;border-radius:6px}
.note{background:#fff8ed;border-left:3px solid var(--accent);padding:14px 18px;
 border-radius:0 8px 8px 0;margin:26px 0 0;font-size:15px;max-width:80ch}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.88em;
 background:#f1eeea;padding:1px 5px;border-radius:4px}
</style></head><body><div class="wrap">

<h1>Q16 &mdash; o context pack muda o candidato?</h1>
<p class="lede">O mesmo IR (<code>web-multi-az</code>, do #11) antes e depois de passar pelo
context pack sint&eacute;tico da Acme &mdash; e o exemplo que a Acme forneceu, pra comparar
conven&ccedil;&atilde;o visual com os dois candidatos.</p>

<div class="switch">
${botoes}
  <span class="hint">&larr; &rarr; tamb&eacute;m alternam</span>
</div>
<div class="stage"><img id="img" alt=""></div>

<div class="note">
<strong>O que muda entre 2 e 3.</strong> Subnet p&uacute;blica com NAT vira subnet privada
com attachment ao Transit Gateway, r&oacute;tulos passam a seguir <code>acme-&lt;camada&gt;-&lt;sufixo&gt;</code>,
e duas notas <code>origem=premissa</code> ficam pendentes (CMK e VPC endpoint) &mdash;
nenhuma reescrita silenciosa. Detalhe que n&atilde;o aparece no desenho: o caminho de
layout tamb&eacute;m mudou (grade &rarr; elk), porque a nomenclatura reescreveu o mesmo
campo que o #19 usa pra reconhecer redund&acirc;ncia zonal. Ver o README.
</div>

<script>
const S=${JSON.stringify(S)};
let i=0;
function ver(n){i=n;document.getElementById('img').src=S[n];
${IMGS.map((_, n) => ` document.getElementById('b${n}').className=n===${n}?'on':'';`).join('\n')}
}
addEventListener('keydown',e=>{if(e.key==='ArrowLeft')ver(Math.max(0,i-1));if(e.key==='ArrowRight')ver(Math.min(${IMGS.length - 1},i+1));});
ver(0);
</script>
</div></body></html>
`;

fs.writeFileSync(path.join(AQUI, 'comparacao.html'), html);
console.log('escrito:', path.join(AQUI, 'comparacao.html'), `(${(html.length / 1024).toFixed(0)} KB)`);
