#!/usr/bin/env bash
# Expõe a skill nos dois lugares onde os harnesses da casa procuram.
#
#   tools/install.sh              instala (ou reaponta) os dois links
#   tools/install.sh --conferir   só confere, não escreve nada
#   tools/install.sh --forcar     substitui até diretório real (perigoso)
#
# A premissa 7 do mapa exige a skill auto-contida e publicável: zero binário,
# zero rede, zero `npm install` em runtime. Instalar, então, é só apontar — e
# apontar por LINK e não por cópia, para que a skill instalada seja sempre a que
# está no repositório em vez de uma fotografia dela que envelhece em silêncio.
#
#   ~/.agents/skills/<nome>   → o repositório (link absoluto)
#   ~/.claude/skills/<nome>   → ../../.agents/skills/<nome>  (link relativo)
#
# Os dois níveis são a convenção que as outras skills da casa já usam
# (`panlabs-python-standards`, `caveman`, `frontend-design`): um lado carrega, o
# outro aponta.
#
# ⚠️ O LINK NUNCA APONTA PARA UM WORKTREE, e isso não é preferência.
#
# Um worktree do Claude Code vive em `.claude/worktrees/` e é APAGADO junto com a
# sessão que o criou. Um link para lá funciona hoje e vira link quebrado amanhã,
# sem nada avisar — a skill simplesmente some do harness. Se este script for
# rodado de dentro de um worktree, ele resolve o checkout principal pelo
# `--git-common-dir` e aponta para lá, dizendo em voz alta que fez isso.
set -uo pipefail

AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_LOCAL="$(dirname "$AQUI")"
NOME="$(basename "$SKILL_LOCAL")"

CONFERIR=0; FORCAR=0
for a in "$@"; do
  case "$a" in
    --conferir) CONFERIR=1 ;;
    --forcar)   FORCAR=1 ;;
    *) echo "argumento desconhecido: $a"; exit 2 ;;
  esac
done

# ---------------------------------------------------- para onde o link aponta
ALVO="$SKILL_LOCAL"
if [[ "$SKILL_LOCAL" == *"/.claude/worktrees/"* ]]; then
  COMUM="$(git -C "$SKILL_LOCAL" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)"
  PRINCIPAL="$(dirname "${COMUM:-}")"
  CANDIDATO="$PRINCIPAL/skills/$NOME"
  if [ -d "$CANDIDATO" ]; then
    ALVO="$CANDIDATO"
    echo "  ⚠ rodando de um worktree — apontando para o checkout principal:"
    echo "      worktree:  $SKILL_LOCAL"
    echo "      alvo:      $ALVO"
    echo "    (um link para worktree quebra quando a sessão é apagada, sem avisar)"
  else
    echo "  ⚠ rodando de um worktree e não achei o checkout principal em $CANDIDATO."
    echo "    Vou apontar para o worktree — REAPONTE depois do merge."
  fi
fi

[ -f "$ALVO/SKILL.md" ] || { echo "  ✗ $ALVO não parece a raiz da skill (sem SKILL.md)"; exit 1; }

falhou=0
ok()  { echo "  ✓ $1"; }
ruim() { echo "  ✗ $1"; falhou=1; }

# ------------------------------------------------------------------ um link
# $1 = caminho do link · $2 = o texto que o link carrega · $3 = onde ele tem de
# ACABAR depois de resolvido
#
# ⚠️ Os dois últimos são coisas diferentes, e confundi-los foi um bug real aqui.
# O link de `~/.claude/` carrega um caminho RELATIVO (`../../.agents/…`), e
# `readlink -f` sobre uma string relativa resolve contra o diretório de trabalho
# de quem chama — não contra o diretório do link. O `--conferir` reprovava um
# link perfeitamente correto. Quem decide é o DESTINO FINAL: os dois links têm de
# acabar na mesma raiz da skill, qualquer que seja o texto que carreguem.
ligar() {
  local link="$1" para="$2" destino="$3"
  local dir; dir="$(dirname "$link")"

  if [ ! -d "$dir" ]; then
    [ "$CONFERIR" = 1 ] && { ruim "$dir não existe"; return; }
    mkdir -p "$dir" || { ruim "não consegui criar $dir"; return; }
  fi

  if [ -L "$link" ]; then
    local atual; atual="$(readlink -f "$link" 2>/dev/null || true)"
    if [ "$atual" = "$(readlink -f "$destino")" ]; then ok "$link → $atual (já estava)"; return; fi
    [ "$CONFERIR" = 1 ] && { ruim "$link resolve para $atual, não para $destino"; return; }
    rm -f "$link"
  elif [ -e "$link" ]; then
    # diretório REAL: pode ser uma skill de outra origem. Não se apaga por conta.
    if [ "$FORCAR" != 1 ]; then
      ruim "$link já existe e NÃO é link — não vou substituir sem --forcar"
      return
    fi
    [ "$CONFERIR" = 1 ] && { ruim "$link existe e não é link"; return; }
    rm -rf "$link"
  else
    [ "$CONFERIR" = 1 ] && { ruim "$link não existe"; return; }
  fi

  ln -s "$para" "$link" && ok "$link → $para" || ruim "não consegui ligar $link"
}

echo
echo "instalando \"$NOME\""
echo
ligar "$HOME/.agents/skills/$NOME" "$ALVO" "$ALVO"
ligar "$HOME/.claude/skills/$NOME" "../../.agents/skills/$NOME" "$ALVO"

# --------------------------------------------- e a prova: rodar DE LÁ, não daqui
echo
echo "conferindo pelo caminho instalado (premissa 7: nada além do Node)"
echo
for base in "$HOME/.claude/skills/$NOME" "$HOME/.agents/skills/$NOME"; do
  if [ ! -r "$base/SKILL.md" ]; then ruim "$base/SKILL.md ilegível"; continue; fi
  ok "$base/SKILL.md legível"
  [ -r "$base/agents/openai.yaml" ] && ok "$base/agents/openai.yaml presente" \
    || ruim "$base/agents/openai.yaml ausente"
  # o teste que importa: um comando da skill RODANDO a partir do link
  if saida="$(cd "$base" && node catalog/aws-shapes.cjs lambda 2>&1)"; then
    echo "$saida" | grep -q "mxgraph.aws4.lambda" \
      && ok "\`node catalog/aws-shapes.cjs lambda\` roda de $base" \
      || ruim "rodou mas não resolveu o shape"
  else
    ruim "não consegui rodar um comando da skill a partir de $base"
  fi
done

echo
[ "$falhou" = 0 ] && echo "  a skill está exposta nos dois caminhos, e roda a partir dos dois." \
  || echo "  ✗ a instalação não fechou."
exit "$falhou"
