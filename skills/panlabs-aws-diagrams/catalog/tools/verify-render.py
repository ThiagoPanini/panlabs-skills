#!/usr/bin/env python3
"""Verifica, shape a shape, que o PNG renderizado mostra o ícone — não caixa vazia.

    python3 verificar-render.py tests/amostra.png tests/amostra.manifesto.json

"Caixa vazia" tem uma definição mecânica, não visual:

  * Service Icon  — o quadrado é `fillColor` e o glifo é pintado em `strokeColor`
    (#ffffff) com 10% de inset. Se `resIcon` apontar para um stencil que não
    existe, o mxGraph pinta só o quadrado. Logo: dentro dos 80% centrais tem que
    haver pixel branco. Zero branco = caixa vazia.

  * Resource Icon plano — não há quadrado; o glifo é `fillColor` sobre o fundo
    da página. Stencil ausente não desenha nada. Logo: tem que haver pixel da
    cor de preenchimento na região.

  * Grupo — a borda em `strokeColor`, e o `grIcon` (25px) no canto superior
    esquerdo, ou centralizado no `groupCenter`. O rótulo começa depois de
    spacingLeft=30, então a janela do ícone não o alcança.

O mapeamento coordenada-do-diagrama -> pixel vem dos dois marcadores magenta,
não de adivinhar margem e escala do exportador.
"""
import json
import sys
from collections import Counter

from PIL import Image

TOL = 14            # tolerância por canal, para o antialias do exportador
MIN_GLIFO = 20      # pixels mínimos para chamar de "glifo desenhado"
MIN_BORDA = 20
TETO_SOLIDO = 0.90  # acima disto a caixa está preenchida, não desenhada


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def perto(px, alvo, tol=TOL):
    return all(abs(px[i] - alvo[i]) <= tol for i in range(3))


def contar(img, caixa, cor, tol=TOL):
    x0, y0, x1, y1 = [int(round(v)) for v in caixa]
    x0, y0 = max(x0, 0), max(y0, 0)
    x1, y1 = min(x1, img.width), min(y1, img.height)
    if x1 <= x0 or y1 <= y0:
        return 0, 0
    b = img.crop((x0, y0, x1, y1)).convert('RGB').tobytes()
    n = sum(1 for i in range(0, len(b), 3)
            if perto((b[i], b[i + 1], b[i + 2]), cor, tol))
    return n, len(b) // 3


def calibrar(img, calib):
    alvo = hex2rgb(calib['cor'])
    rgb = img.convert('RGB')
    pontos = [(x, y) for y in range(img.height) for x in range(img.width)
              if perto(rgb.getpixel((x, y)), alvo, 6)]
    if not pontos:
        sys.exit('FALHA: nenhum marcador de calibração magenta encontrado no PNG')

    meio_x = (min(p[0] for p in pontos) + max(p[0] for p in pontos)) / 2
    meio_y = (min(p[1] for p in pontos) + max(p[1] for p in pontos)) / 2
    a = [p for p in pontos if p[0] <= meio_x and p[1] <= meio_y]
    b = [p for p in pontos if p[0] > meio_x and p[1] > meio_y]
    if not a or not b:
        sys.exit('FALHA: marcadores de calibração não formam dois cantos distintos')

    ax, ay = min(p[0] for p in a), min(p[1] for p in a)
    bx, by = min(p[0] for p in b), min(p[1] for p in b)
    dx = calib['b']['x'] - calib['a']['x']
    dy = calib['b']['y'] - calib['a']['y']
    sx, sy = (bx - ax) / dx, (by - ay) / dy
    ox, oy = ax - calib['a']['x'] * sx, ay - calib['a']['y'] * sy
    return ox, oy, sx, sy


def main():
    png, man = sys.argv[1], sys.argv[2]
    img = Image.open(png)
    m = json.load(open(man))

    ox, oy, sx, sy = calibrar(img, m['calibracao'])
    print(f'{png}  {img.width}x{img.height}px')
    print(f'calibração: escala {sx:.3f}x{sy:.3f}, origem ({ox:.1f},{oy:.1f})')
    print()

    def caixa(x, y, w, h, inset=0.0):
        return (ox + (x + w * inset) * sx, oy + (y + h * inset) * sy,
                ox + (x + w * (1 - inset)) * sx, oy + (y + h * (1 - inset)) * sy)

    falhas, ok = [], 0

    def julgar(nome, cond, detalhe):
        nonlocal ok
        if cond:
            ok += 1
            print(f'  ok    {nome:34s} {detalhe}')
        else:
            falhas.append(f'  FALHA {nome:34s} {detalhe}')
            print(f'  FALHA {nome:34s} {detalhe}')

    def checar_icone(rotulo, c, fill, glifo, tipo):
        # glifo desenhado com 10% de inset -> olhar os 80% centrais
        n_glifo, _ = contar(img, caixa(c['x'], c['y'], c['w'], c['h'], 0.16),
                            hex2rgb(glifo))
        n_fill, total = contar(img, caixa(c['x'], c['y'], c['w'], c['h']), hex2rgb(fill))
        if tipo == 'svc':
            julgar(rotulo, n_glifo >= MIN_GLIFO and n_fill >= MIN_GLIFO,
                   f'glifo {n_glifo}px / quadrado {n_fill}px')
        else:
            # Um `shape=mxgraph.aws4.<inexistente>` NÃO desenha nada: o mxGraph
            # cai no retângulo padrão, que sai preenchido de ponta a ponta com
            # fillColor. Contar só "tem pixel da cor" aprovaria justamente o
            # caso que se quer pegar — por isso o teto de densidade.
            densidade = n_fill / total if total else 0
            julgar(rotulo, n_fill >= MIN_GLIFO and densidade < TETO_SOLIDO,
                   f'glifo {n_fill}px ({densidade:.0%} da caixa, cor {fill})'
                   + ('  <- bloco sólido, não é glifo' if densidade >= TETO_SOLIDO else ''))

    print('— ícones soltos —')
    for c in m['celulas']:
        if c['tipo'] in ('svc', 'res'):
            checar_icone(f"{c['pedido']} [{c['via']}]", c, c['fill'], c['glifo'], c['tipo'])

    print()
    print('— grupos —')
    for c in m['celulas']:
        if c['tipo'] != 'grupo':
            continue
        rot = c['pedido']

        if c['borda']:
            # anel externo: 4 faixas de 4px de espessura ao longo do perímetro
            b = hex2rgb(c['borda'])
            n = 0
            for cx in (caixa(c['x'], c['y'], c['w'], 4),
                       caixa(c['x'], c['y'] + c['h'] - 4, c['w'], 4),
                       caixa(c['x'], c['y'], 4, c['h']),
                       caixa(c['x'] + c['w'] - 4, c['y'], 4, c['h'])):
                n += contar(img, cx, b)[0]
            julgar(f'{rot} · borda', n >= MIN_BORDA, f'{n}px de {c["borda"]}')

        if c['grIcon'] and c['borda']:
            # janela do grIcon: 25px, canto sup. esq. (ou centralizada no
            # groupCenter), afastada 3px da borda e antes do spacingLeft=30
            if c['shapeClass'] == 'groupCenter':
                gx = c['x'] + c['w'] / 2 - 12
            else:
                gx = c['x'] + 3
            n, _ = contar(img, caixa(gx, c['y'] + 3, 22, 21), hex2rgb(c['borda']))
            julgar(f'{rot} · grIcon', n >= MIN_GLIFO,
                   f'{n}px de {c["borda"]} em {c["grIcon"]}')

        f = c['filho']
        checar_icone(f'{rot} · filho aninhado', f, f['fill'], f['glifo'], 'svc')

    print()
    if falhas:
        print(f'{len(falhas)} falha(s) de {ok + len(falhas)} checagens.')
        sys.exit(1)
    print(f'todas as {ok} checagens de pixel passaram — nenhum shape saiu caixa vazia.')


if __name__ == '__main__':
    main()
