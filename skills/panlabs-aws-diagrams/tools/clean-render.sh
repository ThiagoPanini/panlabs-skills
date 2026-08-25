#!/usr/bin/env bash
# Mata o que sobrou de um render abortado, sem tocar num X server que não é nosso.
#
# Existe porque um `drawio` pendurado NÃO é inofensivo: depois de meia dúzia
# deles, arquivos que rendiam passam a falhar, e a bisseção acusa o arquivo
# errado. Toda medição de render neste protótipo começa por aqui.
set -uo pipefail

# O `-` no fim do padrão não é enfeite — é a mesma cicatriz que o `render.sh`
# descreve em prosa e que este script ainda tinha em código.
#
# `pkill -f` casa contra a linha de comando INTEIRA, então o padrão sem o `-`
# casava também com quem apenas RECEBEU o caminho do binário como argumento:
# `./tests/run.sh /…/squashfs-root/drawio` é uma dessas. Uma suite que chama
# outra passando o binário adiante matava a suite chamada no meio da limpeza —
# ela imprimia "suite verde" e morria com SIGKILL logo depois, e o `pipefail`
# do chamador traduzia isso em vermelho sem uma linha de erro. Achado ao
# compor a suite do #22 sobre a do #12.
#
# Processo de render nosso SEMPRE tem flag depois do caminho (`-x -f png …`, ou
# `--type=…` nos filhos do Electron). Quem só carrega o caminho como argumento,
# não. É essa a diferença que o padrão passa a exigir.
pkill -9 -f 'squashfs-root/drawio -' 2>/dev/null || true

# só os Xvfb levantados por xvfb-run (têm -auth /tmp/xvfb-run.*); um X server
# pré-existente da máquina não leva essa flag e fica de fora
pgrep -a Xvfb 2>/dev/null | grep -F 'xvfb-run' | awk '{print $1}' | xargs -r kill -9 2>/dev/null || true

sleep 1
for lock in /tmp/.X*-lock; do
  [ -e "$lock" ] || continue
  n="${lock#/tmp/.X}"; n="${n%-lock}"
  pgrep -a Xvfb 2>/dev/null | grep -q ":$n " || rm -f "$lock"
done
rm -rf /tmp/xvfb-run.* 2>/dev/null || true

echo "xvfb vivos: $(pgrep -c Xvfb 2>/dev/null || echo 0)   drawio vivos: $(pgrep -cf 'squashfs-root/drawio' 2>/dev/null || echo 0)"
