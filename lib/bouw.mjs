/* Maakt alle pagina's van Ideaal Meubel & Vloer uit de winkelgegevens.

   Wordt op twee manieren gebruikt:
   - Online (Netlify): de functie netlify/functions/pagina.mjs maakt elke pagina met de actuele producten uit het portaal.
   - Lokaal:  node lib/bouw.mjs  schrijft alle bestanden naar de map (voor GitHub Pages of een gewone webserver).
*/
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, unlinkSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[c]);
const nf = (n) => Number(n).toFixed(2).replace('.', ',');
const eur = (n) => '€ ' + nf(n);
const m2 = (n) => nf(n) + ' m²';
const ld = (o) => '<script type="application/ld+json">' + JSON.stringify(o).replaceAll('</', '<\\/') + '</script>';
const isoDag = () => new Date().toISOString().slice(0, 10);
export const fotoPad = (p) => p.foto || `img/laminaat/${p.id}.jpg`;

/** Leest de kennisbankartikelen (content/kennisbank/*.html met JSON-kop). */
export function leesArtikelen(root) {
  const dir = join(root, 'content/kennisbank');
  const arts = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
    const m = readFileSync(join(dir, f), 'utf8').match(/^\s*<!--([\s\S]*?)-->([\s\S]*)$/);
    if (!m) continue;
    const a = JSON.parse(m[1]);
    a.slug = f.replace(/\.html$/, '');
    a.body = m[2].trim();
    a.woorden = a.body.replace(/<[^>]+>/g, ' ').trim().split(/\s+/).filter(Boolean).length;
    arts.push(a);
  }
  return arts;
}

/**
 * @param W      winkelgegevens (data/winkel.json)
 * @param bron   { root, BASE } : root = map met de sjablonen (index.html, laminaat.html, bestellen.html, content/, js/app.js, css/style.css)
 * @returns Map  pad -> inhoud
 */
export function bouwSite(W, { root, BASE }) {
  const lees = (p) => readFileSync(join(root, p), 'utf8');
  const NAAM = W.naam;
  const P = W.laminaat;
  const TODAY = isoDag();
  const A = W.adres;
  const adresRegel = `${A.straat}, ${A.postcode} ${A.plaats}`;
  const uit = new Map();

  // 1. js/data.js
  const { website, ...js } = W;
  const dataJs = '/* Gemaakt uit de winkelgegevens. Niet met de hand aanpassen: gebruik het beheerportaal (beheer/). */\n'
    + 'window.IDEAAL = ' + JSON.stringify(js, null, 4) + ';\n';
  uit.set('js/data.js', dataJs);

  const V = createHash('md5').update(dataJs + lees('js/app.js') + lees('css/style.css')).digest('hex').slice(0, 8);

  const ORG = {
    '@type': 'HomeGoodsStore', '@id': BASE + '#bedrijf', name: NAAM, url: BASE,
    description: 'Al 20 jaar specialist in vloeren, meubels, trapbekleding en raamdecoratie. Alles onder één dak.',
    telephone: '+31207526672', image: BASE + 'img/hero.jpg', logo: BASE + 'img/logo.svg',
    address: { '@type': 'PostalAddress', streetAddress: A.straat, postalCode: A.postcode, addressLocality: A.plaats, addressCountry: 'NL' },
    geo: { '@type': 'GeoCoordinates', latitude: W.geo.lat, longitude: W.geo.lng },
    areaServed: { '@type': 'City', name: A.plaats },
    openingHoursSpecification: W.openingstijden.map((o) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/' + o.dag, opens: o.open, closes: o.dicht })),
    hasMap: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${NAAM}, ${adresRegel}`),
    sameAs: ['https://www.instagram.com/ideaalmeubel/'],
    knowsAbout: ['laminaat', 'visgraat laminaat', 'ondervloeren', 'traprenovatie', 'trapbekleding', 'meubels', 'raamdecoratie', 'vloeren leggen'],
  };
  const ORGC = { '@context': 'https://schema.org', ...ORG };
  const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement:
    items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: BASE + u })) });

  const head = (title, desc, path, r, extra = '', ogType = 'website', image = 'img/hero.jpg', robots = '') => {
    const url = BASE + path;
    return `<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(desc)}">
<link rel="canonical" href="${url}">
${robots}<link rel="icon" href="${r}img/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${r}css/style.css?v=${V}">
<meta name="theme-color" content="#141210">
<meta property="og:type" content="${ogType}">
<meta property="og:locale" content="nl_NL">
<meta property="og:site_name" content="${e(NAAM)}">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}${image}">
<meta name="twitter:card" content="summary_large_image">
${extra}
</head>`;
  };

  // Gewone links in de footer-placeholder: crawlers zonder JavaScript zien zo de hele site. app.js vervangt dit blok.
  const staticLinks = (r) => {
    const links = [['index.html', 'Home'], ['laminaat.html', 'Laminaat'], ['kennisbank.html', 'Kennisbank'], ['bestellen.html', 'Bestelling'],
      ...P.map((p) => [`laminaat/${p.id}.html`, p.naam + ' laminaat'])];
    return '<div id="site-footer"><nav aria-label="Sitemap" class="wrap" style="padding:3rem 0;font-size:.85rem">'
      + links.map(([u, t]) => `<a href="${r}${u}">${e(t)}</a>`).join(' · ')
      + `<p>${e(NAAM)} · ${e(adresRegel)} · Telefoon 020-7526672</p></nav></div>`;
  };
  const foot = (r) => `${staticLinks(r)}\n<script src="${r}js/data.js?v=${V}"></script>\n<script src="${r}js/app.js?v=${V}"></script>\n</body>\n</html>\n`;
  const bodyOpen = (page, r, extra = '') => `<body data-page="${page}" data-root="${r}"${extra}>\n<a class="skip-link" href="#inhoud">Naar de inhoud</a>\n`
    + '<div id="site-header"></div>\n<main id="inhoud" tabindex="-1">\n';

  const card = (p, r) => {
    const tag = p.water ? '<span class="card-tag">Waterbestendig</span>' : '';
    return `<a class="card" href="${r}laminaat/${p.id}.html"><div class="card-img">`
      + `<img src="${r}${fotoPad(p)}" alt="${e(p.naam)} laminaat" loading="lazy" width="800" height="800">${tag}</div>`
      + `<div class="card-body"><div><h3>${e(p.naam)}</h3><div class="card-meta">${e(p.type)} · ${e(p.dikte)} mm · ${e(p.klasse)}</div></div>`
      + `<div class="card-price"><strong>${eur(p.prijs)}</strong><span>per m²</span></div></div></a>`;
  };

  // ---------- Kennisbank ----------
  const CAT = ['Kiezen', 'Leggen', 'Onderhoud'];
  const ci = (c) => (CAT.indexOf(c) === -1 ? 9 : CAT.indexOf(c));
  const ARTS = leesArtikelen(root).sort((x, y) => ci(x.categorie) - ci(y.categorie) || (x.titel < y.titel ? -1 : x.titel > y.titel ? 1 : 0));
  const ART = Object.fromEntries(ARTS.map((a) => [a.slug, a]));
  const artLink = (a, r) => `<a class="kb-item" href="${r}kennisbank/${a.slug}.html"><span class="kb-cat">${e(a.categorie)}</span>`
    + `<h3>${e(a.titel)}</h3><p>${e(a.kort)}</p><span class="kb-more">Lees verder <i class="arrow"></i></span></a>`;

  // ---------- Productpagina's ----------
  for (const p of P) {
    const r = '../';
    const path = `laminaat/${p.id}.html`;
    const sv = p.type === 'Visgraat' ? 10 : Math.round(W.snijverlies * 100);
    const title = `${p.naam} laminaat, ${p.dikte} mm ${p.klasse} | ${NAAM}`;
    const desc = `${p.naam} laminaat: ${p.type.toLowerCase()}, ${p.dikte} mm, slijtklasse ${p.klasse}`
      + (p.water ? ', waterbestendig' : '') + `. ${eur(p.prijs)} per m². Bereken direct hoeveel pakken u nodig hebt.`;
    const specs = [['Type', p.type], ['Dikte', `${p.dikte} mm`], ['Slijtklasse', p.klasse], ['Formaat plank', p.formaat],
      ['Inhoud per pak', m2(p.pak)], ['Waterbestendig', p.water ? 'Ja' : 'Nee']];
    const prijs = Number(p.prijs).toFixed(2);
    const productLd = { '@context': 'https://schema.org', '@type': 'Product', name: p.naam + ' laminaat', sku: p.id,
      image: BASE + fotoPad(p), description: p.tekst, category: 'Laminaat', url: BASE + path,
      additionalProperty: specs.map(([n, v]) => ({ '@type': 'PropertyValue', name: n, value: v })),
      offers: { '@type': 'Offer', url: BASE + path, priceCurrency: 'EUR', price: prijs,
        priceSpecification: { '@type': 'UnitPriceSpecification', price: prijs, priceCurrency: 'EUR', unitCode: 'MTK', unitText: 'm²' },
        seller: { '@id': BASE + '#bedrijf' } } };
    const bc = crumbs([['Home', ''], ['Laminaat', 'laminaat.html'], [p.naam, path]]);
    const related = P.filter((x) => x.id !== p.id && (x.type === p.type || x.tint === p.tint)).slice(0, 3);
    const want = ['hoeveel-laminaat-nodig', 'ondervloer-laminaat', 'ac-klasse-laminaat'];
    if (p.type === 'Visgraat') want.unshift('visgraat-laminaat');
    if (p.water) want.splice(1, 0, 'waterbestendig-laminaat');
    const arts = want.map((s) => ART[s]).filter(Boolean).slice(0, 3);
    const specsHtml = specs.map(([a, b]) => `<div><dt>${a}</dt><dd>${e(b)}</dd></div>`).join('');

    let out = head(title, desc, path, r, ld(productLd) + '\n' + ld(bc), 'product', fotoPad(p));
    out += bodyOpen('product', r, ` data-product="${p.id}"`) + `<section class="section" style="padding-top:3rem"><div class="wrap">
  <nav class="crumbs" aria-label="Kruimelpad"><a href="../index.html">Home</a> / <a href="../laminaat.html">Laminaat</a> / <span id="crumb-name">${e(p.naam)}</span></nav>
  <div class="product">
    <div class="product-img"><img id="p-img" src="../${fotoPad(p)}" alt="${e(p.naam)} laminaat" width="800" height="800" fetchpriority="high" style="height:auto"></div>
    <div class="product-info">
      <span class="kicker" id="p-lijn">Collectie ${e(p.lijn)}</span>
      <h1 id="p-naam" style="font-size:clamp(2.4rem,4.5vw,3.8rem)">${e(p.naam)}</h1>
      <div class="price" id="p-prijs">${eur(p.prijs)} <small>per m² · ${eur(p.prijs * p.pak)} per pak</small></div>
      <p id="p-tekst">${e(p.tekst)}</p>
      <dl class="specs" id="p-specs">${specsHtml}</dl>
      <div class="calc">
        <h2 class="calc-title">Bereken wat u nodig hebt</h2>
        <div class="row">
          <div class="field"><label for="lengte">Lengte ruimte (m)</label><input id="lengte" inputmode="decimal" placeholder="bijv. 5,2"></div>
          <div class="field"><label for="breedte">Breedte ruimte (m)</label><input id="breedte" inputmode="decimal" placeholder="bijv. 4"></div>
        </div>
        <div class="calc-result"><span>Oppervlakte</span><span id="r-opp">0,00 m²</span></div>
        <div class="calc-result"><span id="r-label">Benodigd incl. ${sv}% snijverlies</span><span id="r-pakken">0 pakken</span></div>
        <div class="calc-result"><span>Prijs</span><strong id="r-prijs">€ 0,00</strong></div>
        <button class="btn btn-brass" id="add" type="button" disabled>Toevoegen aan bestelling</button>
        <div class="added" id="added">Toegevoegd. <a href="../bestellen.html">Bekijk uw bestelling</a> of kies nog een vloer.</div>
        <p class="note">U betaalt niets online. Na uw aanvraag nemen wij contact op om alles te bevestigen.</p>
      </div>
    </div>
  </div>
</div></section>
`;
    if (arts.length) {
      out += '<section class="section"><div class="wrap">\n  <div class="section-head"><div><span class="kicker">Kennisbank</span><h2>Goed om te weten</h2></div></div>\n'
        + '  <div class="kb-grid">' + arts.map((a) => artLink(a, r)).join('') + '</div>\n</div></section>\n';
    }
    out += '<section class="section paper"><div class="wrap">\n  <div class="section-head"><div><span class="kicker">Ook interessant</span><h2>Vergelijkbare vloeren</h2></div></div>\n'
      + '  <div class="grid" id="related">' + related.map((x) => card(x, r)).join('') + '</div>\n</div></section>\n</main>\n' + foot(r);
    uit.set(path, out);
  }

  // ---------- Kennisbankartikelen ----------
  for (const a of ARTS) {
    const r = '../';
    const path = `kennisbank/${a.slug}.html`;
    const artLd = { '@context': 'https://schema.org', '@type': 'Article', headline: a.titel, description: a.beschrijving,
      abstract: a.kort, inLanguage: 'nl-NL', wordCount: a.woorden, dateModified: TODAY,
      mainEntityOfPage: BASE + path, image: BASE + 'img/hero.jpg',
      author: { '@id': BASE + '#bedrijf' }, publisher: { '@id': BASE + '#bedrijf' } };
    const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: a.faq.map((q) =>
      ({ '@type': 'Question', name: q.vraag, acceptedAnswer: { '@type': 'Answer', text: q.antwoord } })) };
    const bc = crumbs([['Home', ''], ['Kennisbank', 'kennisbank.html'], [a.titel, path]]);
    const prods = P.filter((x) => (a.gerelateerd || []).includes(x.id)).slice(0, 3);
    let others = ARTS.filter((x) => x.slug !== a.slug && x.categorie === a.categorie).slice(0, 3);
    if (others.length < 3) others = others.concat(ARTS.filter((x) => x.slug !== a.slug && !others.includes(x)).slice(0, 3 - others.length));
    const min = Math.max(1, Math.round(a.woorden / 200));
    const faq = a.faq.map((q) => `<details><summary>${e(q.vraag)}</summary><p>${e(q.antwoord)}</p></details>`).join('');
    let out = head(a.titel + ' | ' + NAAM, a.beschrijving, path, r, [ld(artLd), ld(faqLd), ld(bc), ld(ORGC)].join('\n'), 'article');
    out += bodyOpen('kennisbank', r) + `<article>
<header class="page-head"><div class="wrap article-wrap">
  <nav class="crumbs" aria-label="Kruimelpad"><a href="../index.html">Home</a> / <a href="../kennisbank.html">Kennisbank</a> / ${e(a.categorie)}</nav>
  <h1>${e(a.titel)}</h1>
  <p class="article-meta">${e(a.categorie)} · ca. ${min} min lezen · ${e(NAAM)}</p>
</div></header>
<div class="section" style="padding-top:3.5rem"><div class="wrap article-wrap">
  <div class="kort"><strong>Kort antwoord</strong><p>${e(a.kort)}</p></div>
  <div class="prose">
${a.body}
  </div>
  <section class="faq" aria-labelledby="faq-titel">
    <h2 id="faq-titel">Veelgestelde vragen</h2>
    ${faq}
  </section>
</div></div>
</article>
`;
    if (prods.length) {
      out += '<section class="section paper"><div class="wrap">\n  <div class="section-head"><div><span class="kicker">Uit de collectie</span><h2>Passende vloeren</h2></div>\n'
        + '  <a class="btn btn-line dark" href="../laminaat.html">Alle vloeren <i class="arrow"></i></a></div>\n'
        + '  <div class="grid">' + prods.map((x) => card(x, r)).join('') + '</div>\n</div></section>\n';
    }
    out += '<section class="section"><div class="wrap">\n  <div class="section-head"><div><span class="kicker">Kennisbank</span><h2>Lees ook</h2></div></div>\n'
      + '  <div class="kb-grid">' + others.map((x) => artLink(x, r)).join('') + '</div>\n</div></section>\n</main>\n' + foot(r);
    uit.set(path, out);
  }

  // Overzicht kennisbank
  let groups = '';
  for (const c of CAT) {
    const items = ARTS.filter((a) => a.categorie === c);
    if (items.length) groups += `<div class="kb-group"><h2>${c}</h2><div class="kb-grid">${items.map((a) => artLink(a, '')).join('')}</div></div>`;
  }
  const listLd = { '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Kennisbank laminaat', url: BASE + 'kennisbank.html',
    hasPart: ARTS.map((a) => ({ '@type': 'Article', headline: a.titel, url: BASE + `kennisbank/${a.slug}.html` })) };
  uit.set('kennisbank.html', head('Kennisbank laminaat: kiezen, leggen en onderhouden | ' + NAAM,
    'Heldere antwoorden op vragen over laminaat: hoeveel u nodig hebt, welke slijtklasse, ondervloer, vloerverwarming, leggen en onderhoud.',
    'kennisbank.html', '', ld(listLd) + '\n' + ld(crumbs([['Home', ''], ['Kennisbank', 'kennisbank.html']])))
    + bodyOpen('kennisbank', '') + `<section class="page-head"><div class="wrap">
  <nav class="crumbs" aria-label="Kruimelpad"><a href="index.html">Home</a> / Kennisbank</nav>
  <h1>Kennisbank</h1>
  <p class="lead">Praktische antwoorden op de vragen die wij in de winkel het vaakst horen. Van de juiste slijtklasse tot het leggen van een visgraatvloer.</p>
</div></section>
<section class="section" style="padding-top:4rem"><div class="wrap">${groups}</div></section>
</main>
` + foot(''));

  // ---------- Handgeschreven pagina's (sjablonen met <!--build:x--> markers) ----------
  const fill = (s, key, content) => {
    if (!s.includes(`<!--build:${key}-->`)) s = s.replace(`id="${key}"></div>`, `id="${key}"><!--build:${key}--><!--/build:${key}--></div>`);
    return s.replace(new RegExp(`<!--build:${key}-->[\\s\\S]*?<!--/build:${key}-->`, 'g'), () => `<!--build:${key}-->${content}<!--/build:${key}-->`);
  };
  const fixHead = (s, path) => {
    s = s.replace(/\s*<link rel="canonical"[^>]*>/g, '').replace(/\s*<meta property="og:url"[^>]*>/g, '');
    s = s.replace('<meta name="theme-color"', `<link rel="canonical" href="${BASE}${path}">\n<meta property="og:url" content="${BASE}${path}">\n<meta name="theme-color"`);
    s = s.replace(/content="(?:https?:\/\/[^"]*\/)?img\/hero\.jpg"/g, `content="${BASE}img/hero.jpg"`);
    s = s.replace(/(style\.css|data\.js|app\.js)\?v=[0-9a-f]+/g, `$1?v=${V}`);
    return s.replace(/<div id="site-footer">(?:<nav[\s\S]*?<\/nav>)?<\/div>/, () => staticLinks(''));
  };

  const tijden = W.openingstijden.map((o) => `<li><span>${o.naam}</span><span>${o.open} - ${o.dicht}</span></li>`).join('');
  let home = fixHead(lees('index.html'), '');
  home = home.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => ld(ORGC));
  const byId = Object.fromEntries(P.map((p) => [p.id, p]));
  const feat = ['eiken-gerookt', 'visgraat-naturel', 'eiken-grijs-rustiek'].map((i) => byId[i]).filter(Boolean);
  for (const p of P) if (feat.length < 3 && !feat.includes(p)) feat.push(p);
  home = fill(home, 'featured', feat.map((x) => card(x, '')).join(''));
  home = fill(home, 'kb-home', ['hoeveel-laminaat-nodig', 'laminaat-of-pvc', 'visgraat-laminaat'].map((s) => ART[s]).filter(Boolean).map((a) => artLink(a, '')).join(''));
  home = fill(home, 'winkel-adres', `<a href="${e(ORG.hasMap)}" target="_blank" rel="noopener">${e(A.straat)}<br>${e(A.postcode)} ${e(A.plaats)}</a>`);
  home = fill(home, 'winkel-tijden', tijden);
  uit.set('index.html', home);

  let lam = fixHead(lees('laminaat.html'), 'laminaat.html');
  const itemLd = { '@context': 'https://schema.org', '@type': 'ItemList', name: 'Laminaat collectie', itemListElement:
    P.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: BASE + `laminaat/${p.id}.html`, name: p.naam + ' laminaat' })) };
  lam = lam.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '').replace('</head>', ld(itemLd) + '\n</head>');
  lam = fill(lam, 'products', P.map((p) => card(p, '')).join(''));
  uit.set('laminaat.html', lam);

  uit.set('bestellen.html', fixHead(lees('bestellen.html'), 'bestellen.html'));

  uit.set('product.html', `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Laminaat | ${e(NAAM)}</title>
<script>var id=new URLSearchParams(location.search).get('id');location.replace(/^[a-z0-9-]+$/.test(id||'')?'laminaat/'+id+'.html':'laminaat.html');</script>
</head><body><p><a href="laminaat.html">Naar de laminaatcollectie</a></p></body></html>
`);

  const r404 = new URL(BASE).pathname || '/';
  uit.set('404.html', head('Pagina niet gevonden | ' + NAAM, 'Deze pagina bestaat niet (meer).', '404.html', r404, '', 'website', 'img/hero.jpg', '<meta name="robots" content="noindex">\n')
    + bodyOpen('404', r404) + `<section class="section"><div class="wrap done">
<span class="kicker">404</span><h1>Deze pagina bestaat niet (meer)</h1>
<p class="lead">Misschien is de link verouderd. Bekijk de collectie of de kennisbank.</p>
<a class="btn btn-dark" href="${r404}laminaat.html">Bekijk laminaat <i class="arrow"></i></a></div></section></main>
` + foot(r404));

  // ---------- sitemap, robots, llms ----------
  const urls = [['', '1.0'], ['laminaat.html', '0.9'], ['kennisbank.html', '0.8'],
    ...P.map((p) => [`laminaat/${p.id}.html`, '0.8']), ...ARTS.map((a) => [`kennisbank/${a.slug}.html`, '0.7'])];
  uit.set('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(([u, pr]) => `  <url><loc>${BASE}${u}</loc><lastmod>${TODAY}</lastmod><priority>${pr}</priority></url>\n`).join('') + '</urlset>\n');

  const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot',
    'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'Googlebot'];
  uit.set('robots.txt', '# Zoekmachines en AI-assistenten zijn welkom.\n' + bots.map((b) => `User-agent: ${b}\nAllow: /\nDisallow: /beheer/\n\n`).join('')
    + `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /beheer/\n\nSitemap: ${BASE}sitemap.xml\n`);

  const llms = [`# ${NAAM}`, '',
    `> ${NAAM} is een woonwinkel in ${A.plaats} voor vloeren (laminaat), meubels, trapbekleding en raamdecoratie. `
    + 'Al 20 jaar experts in wonen, alles onder één dak. Klanten kunnen laminaat online uitzoeken, het aantal pakken '
    + 'laten berekenen en een bestelaanvraag versturen; betaling en levering worden daarna persoonlijk afgestemd.', '',
    `- Adres: ${adresRegel}`, '- Telefoon: 020-7526672',
    '- Openingstijden: ' + W.openingstijden.map((o) => `${o.naam} ${o.open}-${o.dicht}`).join(', '),
    '- Instagram: https://www.instagram.com/ideaalmeubel/', `- Website: ${BASE}`, '', '## Laminaat collectie', '',
    ...P.map((p) => `- [${p.naam} laminaat](${BASE}laminaat/${p.id}.html): ${p.type.toLowerCase()}, ${p.dikte} mm, ${p.klasse}`
      + `${p.water ? ', waterbestendig' : ''}, ${p.formaat}, ${eur(p.prijs)} per m². ${p.tekst}`),
    '', '## Kennisbank', '', ...ARTS.map((a) => `- [${a.titel}](${BASE}kennisbank/${a.slug}.html): ${a.kort}`),
    '', '## Diensten', '', '- Vloeren leveren en leggen (laminaat in plank, visgraat en tegeldessin)',
    '- Trapbekleding en traprenovatie', '- Meubels', '- Raamdecoratie', ''];
  uit.set('llms.txt', llms.join('\n'));

  return uit;
}

// ---------- Lokaal: node lib/bouw.mjs ----------
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const W = JSON.parse(readFileSync(join(root, 'data/winkel.json'), 'utf8'));
  // js/data.js eerst schrijven: de cacheversie wordt mede daaruit berekend.
  let uit = bouwSite(W, { root, BASE: W.website });
  writeFileSync(join(root, 'js/data.js'), uit.get('js/data.js'));
  uit = bouwSite(W, { root, BASE: W.website });
  const ids = new Set(W.laminaat.map((p) => p.id));
  for (const f of readdirSync(join(root, 'laminaat'))) if (!ids.has(f.replace(/\.html$/, ''))) unlinkSync(join(root, 'laminaat', f));
  for (const [pad, inhoud] of uit) {
    mkdirSync(dirname(join(root, pad)), { recursive: true });
    const doel = join(root, pad);
    if (!existsSync(doel) || readFileSync(doel, 'utf8') !== inhoud) writeFileSync(doel, inhoud);
  }
  console.log(`${W.laminaat.length} productpagina's, ${uit.size} bestanden`);
}
