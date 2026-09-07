# O conjunto de ícones

Vendorizado de [`lucide-static`](https://github.com/lucide-icons/lucide) 1.30.0, ISC — a licença completa, com a nota MIT para os ícones herdados do Feather, está ao lado em [`LICENSE`](LICENSE). Nada aqui é buscado em tempo de instalação nem em tempo de build: `lucide-icon-nodes.json` é o próprio pacote publicado, e é lido apenas por [`compiler/icons.py`](../../../compiler/icons.py).

**Por que mora em `base` e não num `themes/` compartilhado.** Um ícone de traço fino não carrega marca nenhuma — o `SKILL.md` cobra isso da própria definição de tema —, e `base` é o tema que empresta a TODOS os outros a estrutura que não é marca. Um tema futuro que quisesse um conjunto diferente teria de dizer por quê; até lá, o mesmo conjunto serve a qualquer tema que a skill venha a ter.

**O que é embutido, e o que fica de fora.** Cada `.deck.html` só embute os ícones que de fato usa: o compilador lê o nome de cada slot de papel ícone, confere contra este registro e escreve um `<symbol>` por nome usado — os outros 1700-e-tantos nunca chegam à página construída. Um nome que este arquivo não conhece reprova a construção, com a lista de nomes possíveis um `python3 -c "import json; print(sorted(json.load(open('lucide-icon-nodes.json'))))"` de distância.
