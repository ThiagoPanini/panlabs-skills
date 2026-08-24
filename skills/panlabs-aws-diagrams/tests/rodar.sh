#!/usr/bin/env bash
# A régua da árvore de produção — a UNIÃO das suítes que nunca tinham rodado juntas.
#
#   ./tests/rodar.sh [binario-drawio]
#
# O #23 nasceu de uma frase: *"as duas suítes estão verdes, cada uma contra o seu
# próprio motor; ninguém rodou a união"*. Este arquivo é a união, e a ordem das
# camadas é a ordem em que uma falha invalida as seguintes.
#
#   0  A ÁRVORE      o contrato é único, nada aqui alcança `prototypes/`, e o
#                    pacote cabe no teto de 30 MB. Se isto falhar, todo verde
#                    abaixo pode estar medindo o protótipo — ou não poder subir.
#   1  A FRONTEIRA   o agente não tem onde escrever coordenada — nem no modelo,
#                    nem no modelo de sessão. É a invariante que o motor inteiro
#                    defende; se vazou, o resto está guardando uma regra morta.
#   2  O VALIDADOR   índice, primitivas e os defeitos plantados. O validador tem
#                    de PROVAR que mede antes de ser usado como régua.
#   3  O MOTOR       validação, determinismo, camada de rede, gatilhos, travessia.
#   4  O TEMA        vocabulário fechado, partição pintura×métrica, o portão de
#                    contraste, e os quatro estilos do #12 saindo de token.
#   5  A GEOMETRIA   o portão do #18 sobre o corpus inteiro, e o orçamento de
#                    roteamento do #24 (A5.5=0, A3.4=0, A3.5=0, A5.1 no teto).
#   6  A SESSÃO      projeção, manifesto, impressão, e a privacidade do dossiê.
#   7  O APP         round-trip pelo codec do próprio draw.io e render. DEPENDÊNCIA
#                    DE DESENVOLVIMENTO (premissa 8): sem o binário, avisa e segue.
#
# ⚠️ Duas exportações headless simultâneas do draw.io PENDURAM (achado do #13), e
# `timeout` mata o `xvfb-run` mas não os filhos Electron. Por isso a camada 7 é
# serial e nunca roda em paralelo com nada.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAIZ="$(dirname "$AQUI")"
# ⚠️ EXPORTADO, e não só passado como argumento — a versão anterior passava o
# binário para dois dos quatro checks da camada 7 e os outros dois caíam num
# default DIFERENTE (`AppRun` em vez de `drawio`), podendo pular em silêncio
# enquanto a camada se dizia executada. Com `export`, o resolvedor único
# (`tools/drawio.cjs`) e o `render.sh` herdam o mesmo valor.
DRAWIO="${1:-$HOME/.local/opt/drawio/squashfs-root/drawio}"
export DRAWIO
falhou=0
declare -a VERMELHAS=()

passo() {
  local titulo="$1"; shift
  printf '\n── %s\n' "$titulo"
  if "$@"; then :; else falhou=1; VERMELHAS+=("$titulo"); echo "   ✗ VERMELHO"; fi
}

echo "════ camada 0 · a árvore ════"
passo "contrato único (um \$id, um arquivo)"        node "$AQUI/check-esquema-unico.cjs"
passo "produção não alcança prototypes/"           node "$AQUI/check-sem-prototipo.cjs"
# O teto de 30 MB e DURO e so aparece na hora do upload. Medi-lo aqui e o que
# impede a arvore de voltar a 29 MB sem ninguem perceber — foi onde ela estava.
passo "o pacote cabe no teto de 30 MB"            "$RAIZ/tools/empacotar.sh" --conferir

echo
echo "════ camada 1 · a fronteira ════"
passo "modelo@1 não tem onde escrever coordenada"  node "$AQUI/check-fronteira-modelo.cjs"
passo "sessao@1 também não"                        node "$AQUI/check-fronteira-sessao.cjs"

echo
echo "════ camada 2 · o validador prova que mede ════"
passo "o índice bate com as 62 da rubrica"         node "$AQUI/check-indice.cjs"
passo "as primitivas batem com valor publicado"    node "$AQUI/check-primitivas.cjs"
passo "reprova os 16 defeitos e absolve o bom"     node "$AQUI/check-quebrados.cjs"

echo
echo "════ camada 3 · o motor ════"
passo "validação (reprova o que deve, e explica)"  node "$AQUI/check-validacao.cjs"
passo "geração do corpus inteiro"                  bash -c '
  for m in "'"$RAIZ"'"/modelo/*.json; do
    n="$(basename "$m" .json)"
    node "'"$RAIZ"'/motor/gerar.cjs" "$m" --saida "'"$RAIZ"'/saida/$n.drawio" > /dev/null || exit 1
  done
  echo "   ✓ $(ls "'"$RAIZ"'"/modelo/*.json | wc -l) modelos gerados"'
passo "determinismo (3 frentes, com reordenação)"  node "$AQUI/check-determinismo.cjs"
passo "camada de rede: a ordem sai do conteúdo"    node "$AQUI/check-camada.cjs"
passo "e é ela que o arquivo mostra"               node "$AQUI/check-no-arquivo.cjs"
passo "a candidata rival (distância da borda)"     node "$AQUI/check-saltos.cjs"
passo "revisão de lacunas: dispara E cala (#15)"   node "$AQUI/check-lacunas.cjs"
passo "gatilhos de multi-conta (OU, modo, nível)"  node "$AQUI/check-gatilhos.cjs"
passo "travessia: as decisões, no arquivo"         node "$AQUI/check-travessia.cjs"
passo "bissecção (a ferramenta que isola)"         node "$RAIZ/tools/bissecar-modelo.cjs" "$RAIZ/modelo/hub-tgw-3-contas.json"

echo
echo "════ camada 4 · o tema ════"
passo "o portão de contraste sabe falhar"          node "$AQUI/check-portao-contraste.cjs"
passo "a camada normativa é indizível"             node "$AQUI/check-vocabulario.cjs"
passo "partição: pintura pinta, métrica mede"      node "$AQUI/check-particao.cjs"
passo "os 4 estilos do #12 saem de token"          node "$AQUI/check-tokens-do-12.cjs"
passo "o portão reprova o tema errado"             bash -c '
  M="'"$RAIZ"'/modelo/pedidos-serverless.json"
  if node "'"$RAIZ"'/motor/gerar.cjs" "$M" --tema armadilha --saida /dev/null > /dev/null 2>&1; then
    echo "   ✗ o tema \"armadilha\" PASSOU no portão"; exit 1
  fi
  echo "   ✓ \"armadilha\" reprovado sem --forcar"
  if node "'"$RAIZ"'/motor/gerar.cjs" "$M" --tema armadilha --forcar --saida /dev/null > /dev/null 2>&1; then
    echo "   ✓ --forcar gera assim mesmo, para o estrago poder ser visto"
  else
    echo "   ✗ --forcar não gerou — a válvula de escape quebrou"; exit 1
  fi'

echo
echo "════ camada 5 · a geometria do corpus ════"
passo "o portão barra o que mente e cabe no meio"  node "$AQUI/check-portao-geometrico.cjs"
passo "o corpus laudado (sem quarentena aberta)"   node "$AQUI/check-bons.cjs"
passo "o orçamento de roteamento do #24"           node "$AQUI/check-roteamento.cjs"
# ⚠️ O CORPO DE PROVA MUDOU NO #24, e o motivo é o ticket ter dado certo.
#
# Até aqui o portão era exercitado contra `web-fluxo-3-az`, que mentia (`A5.5`
# ×2, a quarentena do #24). Ele parou de mentir — e um teste cujo sujeito é um
# defeito morre no dia em que o defeito é consertado. O sujeito passa a ser
# `modelo/recusa/faixa-que-mente.json`, feito PARA mentir e escolhido por não
# ter conserto de roteamento: a caixa da faixa é a UNIÃO dos membros, então um
# não-membro layoutado no meio cai dentro dela por definição, e nenhuma escolha
# de traçado desfaz isso. Corpo de prova que não se conserta por acidente.
#
# ⚠️ E `F1`/`F2` estão FORA das 62 de propósito (#18), então este passo sozinho
# não provaria que uma família DA RUBRICA barra. Quem prova isso é o passo acima:
# o `check-portao-geometrico.cjs` roda `A4.2`, `A4.4`, `A5.5`, `F1` e `F2` — as
# CINCO de tolerância zero —, cada uma contra o seu caso plantado, e exige que a
# mensagem nomeie a checagem. A divisão é: LÁ o portão prova que barra cada
# família; AQUI o motor prova que chama o portão e obedece ao nível. Não há
# modelo que faça `A5.5` nem `F2` ponta a ponta porque o motor não produz nenhum.
passo "e o portão está ENXERTADO no motor"         bash -c '
  G="'"$RAIZ"'/motor/gerar.cjs"
  M="'"$RAIZ"'/modelo/recusa/faixa-que-mente.json"
  if node "$G" "$M" --portao veracidade --saida /dev/null > /dev/null 2>&1; then
    echo "   ✗ o motor DESENHOU um plano que mente, com o portão pedido"; exit 1
  fi
  echo "   ✓ --portao veracidade recusa o desenho que mente"
  # e o controle: o mesmo nível deixa passar um que não mente
  node "$G" "'"$RAIZ"'/modelo/web-multi-az.json" --portao veracidade --saida /dev/null > /dev/null 2>&1 \
    && echo "   ✓ e deixa passar o que não mente" \
    || { echo "   ✗ recusou um desenho que não mente"; exit 1; }
  # sem portão, o motor desenha — mas AVISA
  node "$G" "$M" --saida /dev/null 2>&1 | grep -q "⛔ F1" \
    && echo "   ✓ e sem portão desenha, mas avisa da falha semântica" \
    || { echo "   ✗ desenhou em silêncio um plano que mente"; exit 1; }'

echo
echo "════ camada 6 · a sessão ════"
passo "o manifesto do motor de produção"           node "$AQUI/check-motor-intocado.cjs"
passo "a projeção, com 12 mutações de controle"    node "$AQUI/check-projecao.cjs"
passo "passo 5 — a vista lógica, aprovada"        node "$RAIZ/tools/aprovar.cjs" "$RAIZ/modelo/sessao/varejo-logica.json" --em 2026-08-21 --saida "$RAIZ/saida/varejo.drawio"
passo "passos 1 e 6 — retomada e vista técnica"   node "$RAIZ/tools/retomar.cjs" "$RAIZ/saida/varejo.drawio" --delta "$RAIZ/modelo/sessao/varejo-elaboracao.json"
passo "o arco ponta a ponta, num caso novo (#26)"  node "$AQUI/check-arco.cjs"
passo "a privacidade do dossiê"                    node "$AQUI/check-dossie.cjs"

echo
echo "════ camada 7 · o app (dependência de desenvolvimento) ════"
if [ ! -x "$DRAWIO" ]; then
  echo "   draw.io headless não encontrado em $DRAWIO — camada 7 pulada."
  echo "   (ver docs/research/drawio-headless-rendering-wsl2.md)"
else
  passo "impressão: 10 edições humanas × 3 esquemas" node "$AQUI/check-impressao.cjs" "$DRAWIO"
  passo "round-trip do modelo pelo codec do app"     node "$AQUI/check-roundtrip-modelo.cjs" "$DRAWIO"
  passo "round-trip do tema pelo codec do app"       node "$AQUI/check-roundtrip-tema.cjs" "$DRAWIO"
  passo "round-trip do arquivo de sessão"            node "$AQUI/check-roundtrip-sessao.cjs" "$DRAWIO"

  # O RENDER é a outra metade da validação em duas camadas (premissa 9), e a
  # ordem aqui não é acidental: primeiro o corpus, depois as variantes de tema,
  # e por último o pixel — porque a verificação de pixel LÊ o que o render
  # escreveu. Serial de propósito (achado do #13 sobre concorrência do Electron).
  passo "render do corpus" bash -c '
    "'"$RAIZ"'/tools/limpar-render.sh" > /dev/null 2>&1 || true
    falhou=0
    for d in "'"$RAIZ"'"/saida/*.drawio; do
      "'"$RAIZ"'/tools/render.sh" "$d" "${d%.drawio}.png" || falhou=1
    done
    exit $falhou'
  # ⚠️ REGENERADAS AQUI, e nao lidas de arquivo versionado.
  #
  # Ate o #29 `saida/temas/*.drawio` estava commitado, e a camada 7 rendia o que
  # achasse la. Isso punha 6,7 MB de saida gerada dentro do pacote que o usuario
  # instala — e a convencao oficial de autoria e a oposta: resultado de eval mora
  # em workspace irmao. `saida/` virou rascunho ignorado, e quem constroi as
  # variantes e quem sempre soube construi-las. Medido: a regeneracao sai byte a
  # byte igual ao que estava commitado.
  passo "as variantes de tema, reconstruidas"        bash -c '
    node "'"$RAIZ"'/tools/gerar-temas.cjs" > /dev/null && node "'"$RAIZ"'/tools/gerar-armadilha.cjs" > /dev/null
    n=$(ls "'"$RAIZ"'"/saida/temas/*.drawio | wc -l)
    [ "$n" -ge 7 ] && echo "   ✓ $n variante(s)" || { echo "   ✗ so $n variante(s)"; exit 1; }'
  passo "render das variantes de tema" bash -c '
    "'"$RAIZ"'/tools/limpar-render.sh" > /dev/null 2>&1 || true
    falhou=0
    for d in "'"$RAIZ"'"/saida/temas/*.drawio; do
      nome="$(basename "$d" .drawio)"
      # a animada só se vê em SVG — o #4 mediu que o PNG dela vira tracejado
      # ESTÁTICO sem erro nenhum, e um PNG aqui seria prova falsa
      if [ "$nome" = "f-fluxo-animado" ]; then
        "'"$RAIZ"'/tools/render.sh" "$d" "${d%.drawio}.svg" svg || falhou=1
        grep -q "ge-flow-animation" "${d%.drawio}.svg" || { echo "   ✗ $nome sem animação no SVG"; falhou=1; }
        continue
      fi
      "'"$RAIZ"'/tools/render.sh" "$d" "${d%.drawio}.png" || falhou=1
    done
    exit $falhou'
  if command -v python3 > /dev/null && python3 -c "import PIL" 2>/dev/null; then
    passo "o tema chegou no PIXEL (a lição do #17)"  python3 "$RAIZ/tools/verificar-tema.py" --todos
  else
    echo "   Pillow ausente — verificação de pixel pulada."
  fi
fi

echo
if [ "$falhou" -ne 0 ]; then
  echo "SUITE VERMELHA — ${#VERMELHAS[@]} camada(s):"
  for v in "${VERMELHAS[@]}"; do echo "  · $v"; done
  exit 1
fi
echo "suite verde — a união roda, e roda contra um motor só."
