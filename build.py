#!/usr/bin/env python3
"""Bouwt de statische SEO-pagina's van Ideaal Meubel & Vloer.

Draai na elke wijziging in js/data.js of content/kennisbank/*.html:
    python3 build.py

Maakt:
  laminaat/<id>.html        productpagina per vloer (volledig in HTML, ook zonder JavaScript leesbaar)
  kennisbank.html           overzicht artikelen
  kennisbank/<slug>.html    artikelen met FAQ
  sitemap.xml, robots.txt, llms.txt, 404.html
en vult vooraf de productlijsten in index.html en laminaat.html.
"""
import html, json, re, subprocess
from datetime import date
from pathlib import Path

# ⚠️ Pas aan zodra het eigen domein bekend is (met / aan het eind).
BASE = 'https://yasar1453.github.io/ideaal-meubel-vloer/'
V = '3'  # cache-versie css/js
ROOT = Path(__file__).parent
TODAY = date.today().isoformat()
NAAM = 'Ideaal Meubel & Vloer'

D = json.loads(subprocess.check_output(
    ['node', '-e', "global.window={};require('./js/data.js');process.stdout.write(JSON.stringify(window.IDEAAL))"],
    cwd=ROOT))
P = D['laminaat']
e = lambda s: html.escape(str(s), quote=True)
eur = lambda n: '€ ' + f'{n:.2f}'.replace('.', ',')
m2 = lambda n: f'{n:.2f}'.replace('.', ',') + ' m²'


def ld(obj):
    return '<script type="application/ld+json">' + json.dumps(obj, ensure_ascii=False).replace('</', '<\\/') + '</script>'


ORG = {'@type': 'HomeGoodsStore', '@id': BASE + '#bedrijf', 'name': NAAM, 'url': BASE,
       'description': 'Al 20 jaar specialist in vloeren, meubels, trapbekleding en raamdecoratie. Alles onder één dak.',
       'telephone': '+31207526672', 'image': BASE + 'img/hero.jpg', 'logo': BASE + 'img/logo.svg',
       'sameAs': ['https://www.instagram.com/ideaalmeubel/'],
       'knowsAbout': ['laminaat', 'visgraat laminaat', 'ondervloeren', 'traprenovatie', 'trapbekleding',
                      'meubels', 'raamdecoratie', 'vloeren leggen']}


def crumbs_ld(items):
    return {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': BASE + u} for i, (n, u) in enumerate(items)]}


def head(title, desc, path, root, extra='', og_type='website', image='img/hero.jpg', robots=''):
    url = BASE + path
    return f'''<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{url}">
{robots}<link rel="icon" href="{root}img/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{root}css/style.css?v={V}">
<meta name="theme-color" content="#141210">
<meta property="og:type" content="{og_type}">
<meta property="og:locale" content="nl_NL">
<meta property="og:site_name" content="{e(NAAM)}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE + image}">
<meta name="twitter:card" content="summary_large_image">
{extra}
</head>'''


def static_links(root):
    """Gewone links in de footer-placeholder: crawlers zonder JavaScript zien zo de hele site.
    app.js vervangt dit blok door de echte footer."""
    links = [('index.html', 'Home'), ('laminaat.html', 'Laminaat'), ('kennisbank.html', 'Kennisbank'),
             ('bestellen.html', 'Bestelling')] + [(f'laminaat/{p["id"]}.html', p['naam'] + ' laminaat') for p in P]
    return ('<div id="site-footer"><nav aria-label="Sitemap" class="wrap" style="padding:3rem 0;font-size:.85rem">'
            + ' · '.join(f'<a href="{root}{u}">{e(t)}</a>' for u, t in links)
            + f'<p>{e(NAAM)} · Telefoon 020-7526672</p></nav></div>')


def foot(root):
    return f'''{static_links(root)}
<script src="{root}js/data.js?v={V}"></script>
<script src="{root}js/app.js?v={V}"></script>
</body>
</html>
'''


def body_open(page, root, extra=''):
    return (f'<body data-page="{page}" data-root="{root}"{extra}>\n<a class="skip-link" href="#inhoud">Naar de inhoud</a>\n'
            '<div id="site-header"></div>\n<main id="inhoud" tabindex="-1">\n')


def card(p, root):
    tag = '<span class="card-tag">Waterbestendig</span>' if p['water'] else ''
    return (f'<a class="card" href="{root}laminaat/{p["id"]}.html"><div class="card-img">'
            f'<img src="{root}img/laminaat/{p["id"]}.jpg" alt="{e(p["naam"])} laminaat" loading="lazy" width="800" height="800">{tag}</div>'
            f'<div class="card-body"><div><h3>{e(p["naam"])}</h3><div class="card-meta">{e(p["type"])} · {p["dikte"]} mm · {p["klasse"]}</div></div>'
            f'<div class="card-price"><strong>{eur(p["prijs"])}</strong><span>per m²</span></div></div></a>')


# ---------- Kennisbank inlezen ----------
ARTS = []
for f in sorted((ROOT / 'content/kennisbank').glob('*.html')):
    raw = f.read_text()
    m = re.match(r'\s*<!--(.*?)-->(.*)', raw, re.S)
    meta = json.loads(m.group(1))
    meta['slug'], meta['body'] = f.stem, m.group(2).strip()
    meta['woorden'] = len(re.sub('<[^>]+>', ' ', meta['body']).split())
    ARTS.append(meta)
CAT_ORDER = ['Kiezen', 'Leggen', 'Onderhoud']
ARTS.sort(key=lambda a: (CAT_ORDER.index(a['categorie']) if a['categorie'] in CAT_ORDER else 9, a['titel']))
ART = {a['slug']: a for a in ARTS}


def art_link(a, root):
    return (f'<a class="kb-item" href="{root}kennisbank/{a["slug"]}.html"><span class="kb-cat">{e(a["categorie"])}</span>'
            f'<h3>{e(a["titel"])}</h3><p>{e(a["kort"])}</p><span class="kb-more">Lees verder <i class="arrow"></i></span></a>')


def product_articles(p):
    """Welke kennisbankartikelen passen bij een vloer."""
    want = ['hoeveel-laminaat-nodig', 'ondervloer-laminaat', 'ac-klasse-laminaat']
    if p['type'] == 'Visgraat': want.insert(0, 'visgraat-laminaat')
    if p['water']: want.insert(1, 'waterbestendig-laminaat')
    return [ART[s] for s in want if s in ART][:3]


# ---------- Productpagina's ----------
(ROOT / 'laminaat').mkdir(exist_ok=True)
for p in P:
    r = '../'
    path = f'laminaat/{p["id"]}.html'
    sv = 10 if p['type'] == 'Visgraat' else round(D['snijverlies'] * 100)
    title = f'{p["naam"]} laminaat, {p["dikte"]} mm {p["klasse"]} | {NAAM}'
    desc = f'{p["naam"]} laminaat: {p["type"].lower()}, {p["dikte"]} mm, slijtklasse {p["klasse"]}' + \
           (', waterbestendig' if p['water'] else '') + f'. {eur(p["prijs"])} per m². Bereken direct hoeveel pakken u nodig hebt.'
    specs = [('Type', p['type']), ('Dikte', f'{p["dikte"]} mm'), ('Slijtklasse', p['klasse']), ('Formaat plank', p['formaat']),
             ('Inhoud per pak', m2(p['pak'])), ('Waterbestendig', 'Ja' if p['water'] else 'Nee')]
    product_ld = {'@context': 'https://schema.org', '@type': 'Product', 'name': p['naam'] + ' laminaat', 'sku': p['id'],
                  'image': BASE + f'img/laminaat/{p["id"]}.jpg', 'description': p['tekst'], 'category': 'Laminaat',
                  'url': BASE + path,
                  'additionalProperty': [{'@type': 'PropertyValue', 'name': n, 'value': v} for n, v in specs],
                  'offers': {'@type': 'Offer', 'url': BASE + path, 'priceCurrency': 'EUR', 'price': f'{p["prijs"]:.2f}',
                             'priceSpecification': {'@type': 'UnitPriceSpecification', 'price': f'{p["prijs"]:.2f}',
                                                    'priceCurrency': 'EUR', 'unitCode': 'MTK', 'unitText': 'm²'},
                             'seller': {'@id': BASE + '#bedrijf'}}}
    bc = crumbs_ld([('Home', ''), ('Laminaat', 'laminaat.html'), (p['naam'], path)])
    related = [x for x in P if x['id'] != p['id'] and (x['type'] == p['type'] or x['tint'] == p['tint'])][:3]
    arts = product_articles(p)
    out = head(title, desc, path, r, ld(product_ld) + '\n' + ld(bc), 'product', f'img/laminaat/{p["id"]}.jpg')
    out += body_open('product', r, f' data-product="{p["id"]}"') + f'''<section class="section" style="padding-top:3rem"><div class="wrap">
  <nav class="crumbs" aria-label="Kruimelpad"><a href="../index.html">Home</a> / <a href="../laminaat.html">Laminaat</a> / <span id="crumb-name">{e(p["naam"])}</span></nav>
  <div class="product">
    <div class="product-img"><img id="p-img" src="../img/laminaat/{p["id"]}.jpg" alt="{e(p["naam"])} laminaat" width="800" height="800" fetchpriority="high" style="height:auto"></div>
    <div class="product-info">
      <span class="kicker" id="p-lijn">Collectie {e(p["lijn"])}</span>
      <h1 id="p-naam" style="font-size:clamp(2.4rem,4.5vw,3.8rem)">{e(p["naam"])}</h1>
      <div class="price" id="p-prijs">{eur(p["prijs"])} <small>per m² · {eur(p["prijs"] * p["pak"])} per pak</small></div>
      <p id="p-tekst">{e(p["tekst"])}</p>
      <dl class="specs" id="p-specs">{''.join(f'<div><dt>{a}</dt><dd>{e(b)}</dd></div>' for a, b in specs)}</dl>
      <div class="calc">
        <h2 class="calc-title">Bereken wat u nodig hebt</h2>
        <div class="row">
          <div class="field"><label for="lengte">Lengte ruimte (m)</label><input id="lengte" inputmode="decimal" placeholder="bijv. 5,2"></div>
          <div class="field"><label for="breedte">Breedte ruimte (m)</label><input id="breedte" inputmode="decimal" placeholder="bijv. 4"></div>
        </div>
        <div class="calc-result"><span>Oppervlakte</span><span id="r-opp">0,00 m²</span></div>
        <div class="calc-result"><span id="r-label">Benodigd incl. {sv}% snijverlies</span><span id="r-pakken">0 pakken</span></div>
        <div class="calc-result"><span>Prijs</span><strong id="r-prijs">€ 0,00</strong></div>
        <button class="btn btn-brass" id="add" type="button" disabled>Toevoegen aan bestelling</button>
        <div class="added" id="added">Toegevoegd. <a href="../bestellen.html">Bekijk uw bestelling</a> of kies nog een vloer.</div>
        <p class="note">U betaalt niets online. Na uw aanvraag nemen wij contact op om alles te bevestigen.</p>
      </div>
    </div>
  </div>
</div></section>
'''
    if arts:
        out += f'''<section class="section"><div class="wrap">
  <div class="section-head"><div><span class="kicker">Kennisbank</span><h2>Goed om te weten</h2></div></div>
  <div class="kb-grid">{''.join(art_link(a, r) for a in arts)}</div>
</div></section>
'''
    out += f'''<section class="section paper"><div class="wrap">
  <div class="section-head"><div><span class="kicker">Ook interessant</span><h2>Vergelijkbare vloeren</h2></div></div>
  <div class="grid" id="related">{''.join(card(x, r) for x in related)}</div>
</div></section>
</main>
''' + foot(r)
    (ROOT / path).write_text(out)

# ---------- Kennisbank ----------
(ROOT / 'kennisbank').mkdir(exist_ok=True)
for a in ARTS:
    r = '../'
    path = f'kennisbank/{a["slug"]}.html'
    art_ld = {'@context': 'https://schema.org', '@type': 'Article', 'headline': a['titel'], 'description': a['beschrijving'],
              'abstract': a['kort'], 'inLanguage': 'nl-NL', 'wordCount': a['woorden'], 'dateModified': TODAY,
              'mainEntityOfPage': BASE + path, 'image': BASE + 'img/hero.jpg',
              'author': {'@id': BASE + '#bedrijf'}, 'publisher': {'@id': BASE + '#bedrijf'}}
    faq_ld = {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': q['vraag'], 'acceptedAnswer': {'@type': 'Answer', 'text': q['antwoord']}} for q in a['faq']]}
    org = dict(ORG, **{'@context': 'https://schema.org'})
    bc = crumbs_ld([('Home', ''), ('Kennisbank', 'kennisbank.html'), (a['titel'], path)])
    prods = [x for x in P if x['id'] in a.get('gerelateerd', [])][:3]
    others = [x for x in ARTS if x['slug'] != a['slug'] and x['categorie'] == a['categorie']][:3]
    if len(others) < 3: others += [x for x in ARTS if x['slug'] != a['slug'] and x not in others][:3 - len(others)]
    out = head(a['titel'] + ' | ' + NAAM, a['beschrijving'], path, r,
               '\n'.join([ld(art_ld), ld(faq_ld), ld(bc), ld(org)]), 'article')
    out += body_open('kennisbank', r) + f'''<article>
<header class="page-head"><div class="wrap article-wrap">
  <nav class="crumbs" aria-label="Kruimelpad"><a href="../index.html">Home</a> / <a href="../kennisbank.html">Kennisbank</a> / {e(a["categorie"])}</nav>
  <h1>{e(a["titel"])}</h1>
  <p class="article-meta">{e(a["categorie"])} · ca. {max(1, round(a["woorden"] / 200))} min lezen · {e(NAAM)}</p>
</div></header>
<div class="section" style="padding-top:3.5rem"><div class="wrap article-wrap">
  <div class="kort"><strong>Kort antwoord</strong><p>{e(a["kort"])}</p></div>
  <div class="prose">
{a["body"]}
  </div>
  <section class="faq" aria-labelledby="faq-titel">
    <h2 id="faq-titel">Veelgestelde vragen</h2>
    {''.join(f'<details><summary>{e(q["vraag"])}</summary><p>{e(q["antwoord"])}</p></details>' for q in a["faq"])}
  </section>
</div></div>
</article>
'''
    if prods:
        out += f'''<section class="section paper"><div class="wrap">
  <div class="section-head"><div><span class="kicker">Uit de collectie</span><h2>Passende vloeren</h2></div>
  <a class="btn btn-line dark" href="../laminaat.html">Alle vloeren <i class="arrow"></i></a></div>
  <div class="grid">{''.join(card(x, r) for x in prods)}</div>
</div></section>
'''
    out += f'''<section class="section"><div class="wrap">
  <div class="section-head"><div><span class="kicker">Kennisbank</span><h2>Lees ook</h2></div></div>
  <div class="kb-grid">{''.join(art_link(x, r) for x in others)}</div>
</div></section>
</main>
''' + foot(r)
    (ROOT / path).write_text(out)

# Overzicht
r = ''
groups = ''
for c in CAT_ORDER:
    items = [a for a in ARTS if a['categorie'] == c]
    if items:
        groups += f'<div class="kb-group"><h2>{c}</h2><div class="kb-grid">{"".join(art_link(a, r) for a in items)}</div></div>'
list_ld = {'@context': 'https://schema.org', '@type': 'CollectionPage', 'name': 'Kennisbank laminaat', 'url': BASE + 'kennisbank.html',
           'hasPart': [{'@type': 'Article', 'headline': a['titel'], 'url': BASE + f'kennisbank/{a["slug"]}.html'} for a in ARTS]}
out = head('Kennisbank laminaat: kiezen, leggen en onderhouden | ' + NAAM,
           'Heldere antwoorden op vragen over laminaat: hoeveel u nodig hebt, welke slijtklasse, ondervloer, vloerverwarming, leggen en onderhoud.',
           'kennisbank.html', r, ld(list_ld) + '\n' + ld(crumbs_ld([('Home', ''), ('Kennisbank', 'kennisbank.html')])))
out += body_open('kennisbank', r) + f'''<section class="page-head"><div class="wrap">
  <nav class="crumbs" aria-label="Kruimelpad"><a href="index.html">Home</a> / Kennisbank</nav>
  <h1>Kennisbank</h1>
  <p class="lead">Praktische antwoorden op de vragen die wij in de winkel het vaakst horen. Van de juiste slijtklasse tot het leggen van een visgraatvloer.</p>
</div></section>
<section class="section" style="padding-top:4rem"><div class="wrap">{groups}</div></section>
</main>
''' + foot(r)
(ROOT / 'kennisbank.html').write_text(out)

# ---------- Handgeschreven pagina's bijwerken ----------
def fill(s, key, content):
    """Zet content tussen <!--build:key--> markers (maakt markers bij eerste run)."""
    if f'<!--build:{key}-->' not in s:
        s = s.replace(f'id="{key}"></div>', f'id="{key}"><!--build:{key}--><!--/build:{key}--></div>', 1)
    return re.sub(f'<!--build:{key}-->.*?<!--/build:{key}-->', lambda m: f'<!--build:{key}-->{content}<!--/build:{key}-->', s, flags=re.S)


def fix_head(s, path):
    s = re.sub(r'\s*<link rel="canonical"[^>]*>', '', s)
    s = re.sub(r'\s*<meta property="og:url"[^>]*>', '', s)
    s = s.replace('<meta name="theme-color"', f'<link rel="canonical" href="{BASE + path}">\n<meta property="og:url" content="{BASE + path}">\n<meta name="theme-color"', 1)
    s = s.replace('content="img/hero.jpg"', f'content="{BASE}img/hero.jpg"')
    s = re.sub(r'(style\.css|data\.js|app\.js)\?v=\d+', rf'\1?v={V}', s)
    s = re.sub(r'<div id="site-footer">(?:<nav.*?</nav>)?</div>', lambda m: static_links(''), s, count=1, flags=re.S)
    return s


home = (ROOT / 'index.html').read_text()
home = fix_head(home, '')
home = re.sub(r'<script type="application/ld\+json">.*?</script>', lambda m: ld(dict(ORG, **{'@context': 'https://schema.org'})), home, count=1, flags=re.S)
home = fill(home, 'featured', ''.join(card(x, '') for x in [p for p in P if p['id'] in ('eiken-gerookt', 'visgraat-naturel', 'eiken-grijs-rustiek')]))
home = fill(home, 'kb-home', ''.join(art_link(a, '') for a in [ART[s] for s in ('hoeveel-laminaat-nodig', 'laminaat-of-pvc', 'visgraat-laminaat') if s in ART]))
(ROOT / 'index.html').write_text(home)

lam = (ROOT / 'laminaat.html').read_text()
lam = fix_head(lam, 'laminaat.html')
item_ld = {'@context': 'https://schema.org', '@type': 'ItemList', 'name': 'Laminaat collectie', 'itemListElement': [
    {'@type': 'ListItem', 'position': i + 1, 'url': BASE + f'laminaat/{p["id"]}.html', 'name': p['naam'] + ' laminaat'} for i, p in enumerate(P)]}
lam = re.sub(r'\s*<script type="application/ld\+json">.*?</script>', '', lam, flags=re.S)
lam = lam.replace('</head>', ld(item_ld) + '\n</head>', 1)
lam = fill(lam, 'products', ''.join(card(p, '') for p in P))
(ROOT / 'laminaat.html').write_text(lam)

best = fix_head((ROOT / 'bestellen.html').read_text(), 'bestellen.html')
(ROOT / 'bestellen.html').write_text(best)

# product.html blijft bestaan voor oude links en stuurt door
(ROOT / 'product.html').write_text(f'''<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Laminaat | {e(NAAM)}</title>
<script>var id=new URLSearchParams(location.search).get('id');location.replace(/^[a-z0-9-]+$/.test(id||'')?'laminaat/'+id+'.html':'laminaat.html');</script>
</head><body><p><a href="laminaat.html">Naar de laminaatcollectie</a></p></body></html>
''')

# 404
(ROOT / '404.html').write_text(head('Pagina niet gevonden | ' + NAAM, 'Deze pagina bestaat niet (meer).', '404.html', '/ideaal-meubel-vloer/' if 'github.io' in BASE else '/',
                                    robots='<meta name="robots" content="noindex">\n')
                               + body_open('404', '/ideaal-meubel-vloer/' if 'github.io' in BASE else '/') + '''<section class="section"><div class="wrap done">
<span class="kicker">404</span><h1>Deze pagina bestaat niet (meer)</h1>
<p class="lead">Misschien is de link verouderd. Bekijk de collectie of de kennisbank.</p>
<a class="btn btn-dark" href="laminaat.html">Bekijk laminaat <i class="arrow"></i></a></div></section></main>
''' + foot('/ideaal-meubel-vloer/' if 'github.io' in BASE else '/'))

# ---------- sitemap, robots, llms ----------
urls = [('', '1.0'), ('laminaat.html', '0.9'), ('kennisbank.html', '0.8')] + \
       [(f'laminaat/{p["id"]}.html', '0.8') for p in P] + [(f'kennisbank/{a["slug"]}.html', '0.7') for a in ARTS]
(ROOT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
                                  ''.join(f'  <url><loc>{BASE + u}</loc><lastmod>{TODAY}</lastmod><priority>{pr}</priority></url>\n' for u, pr in urls) +
                                  '</urlset>\n')
bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot',
        'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'Googlebot']
(ROOT / 'robots.txt').write_text('# Zoekmachines en AI-assistenten zijn welkom.\n' +
                                 ''.join(f'User-agent: {b}\nAllow: /\n\n' for b in bots) +
                                 'User-agent: *\nAllow: /\nDisallow: /bestelling.php\n\n' + f'Sitemap: {BASE}sitemap.xml\n')
llms = [f'# {NAAM}', '',
        f'> {NAAM} is een woonwinkel voor vloeren (laminaat), meubels, trapbekleding en raamdecoratie. '
        'Al 20 jaar experts in wonen, alles onder één dak. Klanten kunnen laminaat online uitzoeken, het aantal pakken '
        'laten berekenen en een bestelaanvraag versturen; betaling en levering worden daarna persoonlijk afgestemd.', '',
        '- Telefoon: 020-7526672', '- Instagram: https://www.instagram.com/ideaalmeubel/', f'- Website: {BASE}', '',
        '## Laminaat collectie', '']
llms += [f'- [{p["naam"]} laminaat]({BASE}laminaat/{p["id"]}.html): {p["type"].lower()}, {p["dikte"]} mm, {p["klasse"]}'
         f'{", waterbestendig" if p["water"] else ""}, {p["formaat"]}, {eur(p["prijs"])} per m². {p["tekst"]}' for p in P]
llms += ['', '## Kennisbank', '']
llms += [f'- [{a["titel"]}]({BASE}kennisbank/{a["slug"]}.html): {a["kort"]}' for a in ARTS]
llms += ['', '## Diensten', '', '- Vloeren leveren en leggen (laminaat in plank, visgraat en tegeldessin)',
         '- Trapbekleding en traprenovatie', '- Meubels', '- Raamdecoratie', '']
(ROOT / 'llms.txt').write_text('\n'.join(llms))

print(f'{len(P)} productpagina\'s, {len(ARTS)} artikelen, {len(urls)} URL\'s in sitemap')
