#!/usr/bin/env python3
"""Confere NO PIXEL que o tema chegou no render — não só na style string.

    python3 tools/verify-theme.py output/themes/a-light.png light
    python3 tools/verify-theme.py --all

A lição que obriga esta ferramenta é do #17: 24 checagens estáticas estavam
verdes quando o PNG revelou o SageMaker saindo com o ícone errado. Style string
correta não é render correto.

Cada tema vira uma lista de afirmações de cor, e cada afirmação é ou PRESENTE
(a cor tem de aparecer, acima de um piso de pixels) ou AUSENTE (a cor não pode
aparecer em lugar nenhum). As ausências são as mais informativas: são a prova
de que uma decisão do #13 de fato sobrescreveu o catálogo.
"""
import json
import sys
from collections import Counter
from pathlib import Path

from PIL import Image

# Duas tolerâncias, e a assimetria é o ponto.
#
# PRESENÇA aceita ±10 por canal, porque a cor pedida chega ao PNG rodeada de
# antialias e o miolo pode variar um pouco.
#
# AUSÊNCIA exige ±3, e um piso de área. Com ±10 a checagem acusava #232F3E "presente"
# no render escuro — 13.909 px. Localizando os pixels, eram ~80 pontos ESPARSOS
# espalhados de x=30 a x=2584: a franja de antialias de texto branco sobre fundo
# escuro passa por ali no caminho. Uma cor que de fato está no desenho forma
# REGIÃO; antialias forma poeira. O piso de área é o que separa as duas.
TOL_PRESENTE = 10
TOL_AUSENTE = 3
PISO_PRESENTE = 40      # pixels mínimos para chamar de "cor presente"
PISO_AUSENTE = 400      # abaixo disto é poeira de antialias, não região

AQUI = Path(__file__).resolve().parent.parent


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def contar(img, alvo, tol=TOL_PRESENTE):
    a = hex2rgb(alvo)
    n = 0
    for (c, px) in img.getcolors(maxcolors=1 << 24) or []:
        if all(abs(px[i] - a[i]) <= tol for i in range(3)):
            n += c
    return n


def dominante(img):
    cores = img.getcolors(maxcolors=1 << 24) or []
    c, px = max(cores, key=lambda t: t[0])
    return '#%02X%02X%02X' % px[:3], c / (img.width * img.height)


# As afirmações que não dependem do tema — são decisões do #13 contra o catálogo.
UNIVERSAIS = [
    ('ausente', '#AAB7B8', 'rótulo cinza do VPC: o catálogo entrega, o tema sobrescreve (2,06:1 no branco)'),
    ('ausente', '#248814', 'rótulo verde-escuro da Public subnet: idem'),
    # NÃO afirme aqui que o tingimento FIXO do draw.io (#E6F6F7) está ausente.
    # A afirmação seria INDECIDÍVEL, e por um motivo que é justamente o achado: o
    # valor derivado no tema claro é #E6F6F6 — um único degrau de azul de distância.
    # Nenhuma tolerância de pixel separa os dois, porque eles são a mesma cor.
    # Uma afirmação que não sabe falhar não vale mais do que uma checagem que não
    # sabe falhar. Onde ela DECIDE é no tema escuro, e é lá que ela mora.
]

POR_TEMA = {
    'claro':       [('presente', '#E6F6F6', 'tingimento derivado da Private subnet — 10% de #00A4A6 sobre branco'),
                    ('presente', '#F2F6E8', 'tingimento derivado da Public subnet — 10% de #7AA116, idêntico ao do draw.io'),
                    ('presente', '#FFFFFF', 'fundo da página'),
                    ('presente', '#232F3E', 'tinta forte / borda do AWS Cloud'),
                    ('presente', '#ED7100', 'quadrado do Lambda — cor de categoria intocada'),
                    ('presente', '#8C4FFF', 'borda do VPC — cor normativa intocada')],
    'escuro':      [('presente', '#1C1C1C', 'fundo da página, neutro e mais escuro (retorno do #13)'),
                    ('presente', '#192A2A', 'tingimento derivado no escuro: a MESMA regra, outro fundo'),
                    ('presente', '#FFFFFF', 'tinta forte / AWS Cloud invertido, como no deck escuro'),
                    ('ausente',  '#161E2D', 'o azul-noite anterior: substituído, não pode sobrar'),
                    ('ausente',  '#E6F6F7', 'o tingimento FIXO do draw.io: aqui a derivação DECIDE, e some'),
                    ('presente', '#ED7100', 'cor de categoria NÃO muda entre os decks'),
                    ('presente', '#8C4FFF', 'borda do VPC NÃO muda entre os decks'),
                    ('ausente',  '#232F3E', 'squid ink: 1,23:1 no fundo escuro — tem de ter sumido inteiro')],
    'corporativo': [('presente', '#FFFFFF', 'fundo — a régua não deixa off-white'),
                    ('presente', '#545B64', 'seta na tinta dos templates AWS do draw.io'),
                    ('presente', '#ED7100', 'cor de categoria intocada')],
    'armadilha':   [('presente', '#F2F3F5', 'o off-white que o portão reprova'),
                    ('presente', '#AAB7B8', 'a tinta pálida que o portão reprova')],
    # vista lógica: pré-serviços, então a paleta AWS quase não aparece — o que
    # aparece é a caixa da casa, e é a única prova visual de que os tokens
    # `bloco.*` chegam no render
    'logica':      [('presente', '#FFFFFF', 'fundo e preenchimento do bloco'),
                    ('presente', '#232F3E', 'borda do bloco na tinta forte do tema'),
                    ('ausente',  '#8C4FFF', 'nenhuma cor de categoria: não há serviço nomeado')],
    # o indizível: prova que o remendo bruto chegou, e que a legenda por cor sumiu.
    # `#8C4FFF` fica de fora de propósito: o remendo troca `strokeColor` (a borda do
    # VPC) e não `fillColor`, então o roxo continua legítimo no quadrado do API
    # Gateway — mesma cor, outro papel. É exatamente o que a cor-como-legenda perde.
    'indizivel':   [('presente', '#1B6AC9', 'o azul da casa injetado à mão nas TRÊS fronteiras'),
                    ('ausente',  '#00A4A6', 'teal de Region e Private subnet: apagado'),
                    ('ausente',  '#7AA116', 'verde de Public subnet: apagado')],
}

# esses dois existem para violar as universais; não as aplicamos neles
SEM_UNIVERSAIS = {'armadilha', 'indizivel'}


def verificar(png, tema):
    img = Image.open(png).convert('RGB')
    afirmacoes = list(POR_TEMA.get(tema, []))
    if tema not in SEM_UNIVERSAIS:
        afirmacoes += UNIVERSAIS
    dom, frac = dominante(img)
    print(f'\n{png.name}  ({img.width}×{img.height}, dominante {dom} em {frac:.0%})')
    falhou = 0
    for modo, cor, porque in afirmacoes:
        presente = modo == 'presente'
        n = contar(img, cor, TOL_PRESENTE if presente else TOL_AUSENTE)
        ok = (n >= PISO_PRESENTE) if presente else (n < PISO_AUSENTE)
        if not ok:
            falhou = 1
        print(f'  {"✓" if ok else "✗"} {modo:8} {cor}  {n:>8} px   {porque}')
    return falhou


def main():
    if '--all' in sys.argv:
        mapa = {'a-light': 'light', 'b-dark': 'dark',
                'c-corporate': 'corporate', 'd-trap': 'trap',
                'e-unspeakable': 'unspeakable', 'g-logical-view': 'logical'}
        falhou = 0
        for nome, tema in mapa.items():
            png = AQUI / 'output' / 'themes' / f'{nome}.png'
            if not png.exists():
                print(f'\n{png.name} não existe — render pulado (premissa 8)')
                continue
            falhou |= verificar(png, tema)
        print('\nVERIFICAÇÃO DE PIXEL VERMELHA' if falhou else '\nverificação de pixel verde')
        sys.exit(falhou)

    if len(sys.argv) < 3:
        sys.exit(__doc__)
    sys.exit(verificar(Path(sys.argv[1]), sys.argv[2]))


if __name__ == '__main__':
    main()
