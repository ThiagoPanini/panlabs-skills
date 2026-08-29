#!/usr/bin/env python3
# Generates one canonical deck in the measured PDI identity plus one variant per planted defect.
import base64, pathlib, sys

HERE = pathlib.Path(__file__).parent
FONTS = HERE / "fonts"
OUT = HERE / "decks"
OUT.mkdir(exist_ok=True)

def b64(p):
    return base64.b64encode((FONTS / p).read_bytes()).decode()

ANTON = b64("Anton-Regular.ttf")
BARLOW = b64("Barlow-Light.ttf")
BARLOW_XB = b64("Barlow-ExtraBold.ttf")

# Measured identity (issue #90)
SURFACE = "#141415"; FG = "#F3F3F3"; CARD = "#2C2C2F"; WHITE = "#FFFFFF"
ACCENTS = ["#CD1335", "#C75000", "#7634D2", "#4EA9D0", "#5FAB80"]
METRIC = "#FF6201"

def deck(defect=None):
    runtime_fetch = ""
    anton_src = f"url(data:font/ttf;base64,{ANTON}) format('truetype')"
    barlow_src = f"url(data:font/ttf;base64,{BARLOW}) format('truetype')"
    xb_src = f"url(data:font/ttf;base64,{BARLOW_XB}) format('truetype')"
    head_extra = ""
    css_extra = ""
    surface, fg = SURFACE, FG
    h1_size = "8.9cqh"

    if defect == "external-link":
        head_extra = '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&display=swap">'
    elif defect == "external-script":
        head_extra = '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>'
    elif defect == "css-url-http":
        css_extra = "  .stage { background-image: url(https://example.com/topo.png); }\n"
    elif defect == "offpalette-hex":
        css_extra = "  .kicker { color: #667eea; }\n"
    elif defect == "font-not-embedded":
        anton_src = "local('Anton')"
    elif defect == "font-base64-corrupt":
        # Same declaration, same length class, payload truncated in the middle:
        # every static check still passes; the face never loads.
        anton_src = f"url(data:font/ttf;base64,{ANTON[:400]}{'A' * (len(ANTON) - 400)}) format('truetype')"
    elif defect == "scale-collapse":
        h1_size = "26px"
    elif defect == "palette-repaint":
        # Uses ONLY declared palette tokens -- no off-palette hex anywhere.
        css_extra = "  #s2 { background: var(--accent-purple); }\n"
    elif defect == "inverted":
        surface, fg = FG, SURFACE
    elif defect == "runtime-fetch":
        runtime_fetch = ("var h = String.fromCharCode(104,116,116,112,115) + '://' +\n"
                         "  ['fonts','gstatic','com'].join('.') + '/s/anton/v27/1Ptgg87LROyAm0K0.ttf';\n"
                         "var im = new Image(); im.src = h;")
    elif defect == "palette-repaint-single":
        css_extra = "  #s-divider { background: var(--accent-purple); }\n"
    elif defect == "invisible-text":
        css_extra = "  .lead { color: var(--surface); }\n"
    elif defect == "wrong-display-font":
        css_extra = "  h1, h2 { font-family: Arial, Helvetica, sans-serif; }\n"
    elif defect == "legit-divider":
        css_extra = "  #s-divider { background: var(--accent-rust); color: var(--surface); }\n"
    elif defect == "bleed":
        css_extra = "  #s2 .lead { width: 160%; white-space: nowrap; }\n"

    accents_css = "\n".join(
        f"    --accent-{n}: {h};" for n, h in
        zip(["crimson", "rust", "purple", "cyan", "green"], ACCENTS))

    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>deck</title>
{head_extra}
<style>
  @font-face {{ font-family: 'Anton'; font-style: normal; font-weight: 400;
    src: {anton_src}; }}
  @font-face {{ font-family: 'DeckBody'; font-style: normal; font-weight: 300;
    src: {barlow_src}; }}
  @font-face {{ font-family: 'DeckBody'; font-style: normal; font-weight: 800;
    src: {xb_src}; }}
  :root {{
    --surface: {surface};
    --fg: {fg};
    --card: {CARD};
    --white: {WHITE};
{accents_css}
    --metric: {METRIC};
    --font-display: 'Anton', sans-serif;
    --font-body: 'DeckBody', sans-serif;
    --margin: 7.874%;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ height: 100%; overflow: hidden; background: #000; }}
  .stage {{ position: absolute; inset: 0; margin: auto;
    aspect-ratio: 16 / 9; max-width: 100vw; max-height: 100vh;
    background: var(--surface); overflow: hidden;
    container-type: size; container-name: stage; }}
  .slide {{ position: absolute; inset: 0; display: none;
    padding: 10.5% var(--margin) 10.48%; color: var(--fg);
    font-family: var(--font-body); font-weight: 300; }}
  .slide.is-active {{ display: flex; flex-direction: column; justify-content: center; }}
  h1 {{ font-family: var(--font-display); font-weight: 400;
       font-size: {h1_size}; line-height: 0.8; letter-spacing: 0.01em; }}
  h2 {{ font-family: var(--font-display); font-weight: 400; font-size: 6.9cqh; line-height: 0.85; }}
  h3 {{ font-family: var(--font-body); font-weight: 800; font-size: 5.9cqh; line-height: 1.05; }}
  .lead {{ font-size: 4.0cqh; line-height: 1.15; }}
  .body {{ font-size: 3.5cqh; line-height: 1.15; }}
  .kicker {{ font-size: 2.5cqh; letter-spacing: 0.18em; text-transform: uppercase; }}
  .rule {{ height: 1px; background: var(--card); margin: 2.2% 0; }}
  .cards {{ display: flex; gap: 2.85%; margin-top: 3%; }}
  .card {{ flex: 1; border: 0.75px solid var(--card); padding: 2.4%;
    box-shadow: 0 1.5pt 4.5pt rgba(0,0,0,.32); }}
  .chip {{ width: 1.6%; aspect-ratio: 1; margin-bottom: 6%; }}
  .metric {{ font-family: var(--font-display); color: var(--metric); font-size: 11.9cqh; }}
  [data-step] {{ opacity: 0; }}
  [data-step].is-shown {{ opacity: 1; }}
{css_extra}</style>
</head>
<body>
<div class="stage">
  <section class="slide is-active" data-slide="1">
    <p class="kicker">Panlabs</p>
    <h1>A APRESENTACAO<br>QUE NAO DERRETE</h1>
    <div class="rule"></div>
    <p class="lead">Identidade medida, nao inventada.</p>
  </section>
  <section class="slide" id="s2" data-slide="2">
    <h2>OS CINCO PILARES</h2>
    <p class="lead">Cada cor carrega um significado fixo.</p>
    <div class="cards">
      <div class="card" data-step="1"><div class="chip" style="background: var(--accent-crimson)"></div><h3>Capacitacao</h3><p class="body">Quem entende.</p></div>
      <div class="card" data-step="2"><div class="chip" style="background: var(--accent-rust)"></div><h3>Engenharia</h3><p class="body">Quem cria processos.</p></div>
      <div class="card" data-step="3"><div class="chip" style="background: var(--accent-purple)"></div><h3>Analytics</h3><p class="body">Quem decide.</p></div>
    </div>
  </section>
  <section class="slide" id="s-divider" data-slide="3">
    <p class="kicker">Parte 02</p>
    <h1>ENGENHARIA</h1>
  </section>
  <section class="slide" data-slide="4">
    <p class="kicker">Resultado</p>
    <p class="metric">+52k</p>
    <p class="body">visualizacoes acumuladas no periodo.</p>
  </section>
</div>
<script>
{runtime_fetch}
(function () {{
  var slides = [].slice.call(document.querySelectorAll('.slide'));
  var i = 0;
  function steps(s) {{ return [].slice.call(s.querySelectorAll('[data-step]')); }}
  function shown(s) {{ return steps(s).filter(function (e) {{ return e.classList.contains('is-shown'); }}).length; }}
  function render() {{
    slides.forEach(function (s, n) {{ s.classList.toggle('is-active', n === i); }});
  }}
  function next() {{
    var s = slides[i], st = steps(s);
    if (shown(s) < st.length) {{ st[shown(s)].classList.add('is-shown'); return; }}
    if (i < slides.length - 1) {{ i++; render(); }}
  }}
  function prev() {{
    var s = slides[i], st = steps(s), k = shown(s);
    if (k > 0) {{ st[k - 1].classList.remove('is-shown'); return; }}
    if (i > 0) {{ i--; render(); }}
  }}
  document.addEventListener('keydown', function (e) {{
    if (e.key === 'ArrowRight' || e.key === ' ') {{ e.preventDefault(); next(); }}
    if (e.key === 'ArrowLeft') {{ prev(); }}
  }});
  render();
}})();
</script>
</body>
</html>
"""

VARIANTS = [None, "external-link", "external-script", "css-url-http", "offpalette-hex",
            "font-not-embedded", "font-base64-corrupt", "scale-collapse",
            "palette-repaint", "inverted", "bleed", "legit-divider", "invisible-text", "wrong-display-font", "palette-repaint-single", "runtime-fetch"]

for v in VARIANTS:
    name = "good" if v is None else v
    p = OUT / f"{name}.html"
    p.write_text(deck(v), encoding="utf-8")
    print(f"{p.name:28} {p.stat().st_size:>8} bytes")
