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
/** Map van de productpagina: PVC onder pvc/, de rest onder laminaat/. */
export const mapVan = (p) => (p.soort === 'PVC' ? 'pvc' : 'laminaat');
const soortVan = (p) => (p.soort === 'PVC' ? 'PVC' : 'laminaat');

/** De drie vloercollecties. Elke collectie is een eigen pagina met dezelfde opbouw (sjabloon laminaat.html). */
export const COLLECTIES = [
  { key: 'pvc', pad: 'pvc-vloeren.html', naam: 'PVC vloeren', filter: (p) => p.soort === 'PVC',
    title: 'PVC vloeren', desc: 'PVC vloeren bij Ideaal Meubel & Vloer in Amsterdam: stil, warm en waterbestendig. Bekijk de collectie en bereken direct hoeveel pakken u nodig hebt.',
    lead: 'Stil, warm aan de voeten en bestand tegen water. Kies uw PVC vloer, vul de maten van uw ruimte in en verstuur uw bestelaanvraag.' },
  { key: 'laminaat', pad: 'laminaat.html', naam: 'Laminaat vloeren', filter: (p) => p.soort !== 'PVC',
    title: 'Laminaat vloeren', desc: 'Laminaat vloeren bij Ideaal Meubel & Vloer in Amsterdam: plank, visgraat en tegeldessin. Bereken direct hoeveel pakken u nodig hebt.',
    lead: 'Slijtvast, warm en makkelijk in onderhoud. Kies uw vloer, vul de maten van uw ruimte in en verstuur uw bestelaanvraag.' },
  { key: 'visgraat', pad: 'visgraat.html', naam: 'Visgraat vloeren', filter: (p) => p.type === 'Visgraat',
    title: 'Visgraat vloeren', desc: 'Visgraat vloeren in laminaat en PVC bij Ideaal Meubel & Vloer in Amsterdam. Klassiek patroon, vakkundig gelegd. Bereken direct hoeveel pakken u nodig hebt.',
    lead: 'Het klassieke zigzagpatroon, in laminaat en PVC. Kies uw visgraatvloer, vul de maten in en wij rekenen het aantal pakken uit, inclusief 15% snijverlies.' },
];
export const collectieVan = (p) => COLLECTIES[p.soort === 'PVC' ? 0 : 1];

/** Echte Google-reviews (content/reviews.json). */
export function leesReviews(root) {
  try { return JSON.parse(readFileSync(join(root, 'content/reviews.json'), 'utf8')); } catch { return null; }
}

/** Leest de kennisbankartikelen (content/kennisbank/*.html met JSON-kop). */
export function leesArtikelen(root, map = 'content/kennisbank') {
  const dir = join(root, map);
  if (!existsSync(dir)) return [];
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
    description: 'Al 25 jaar specialist in vloeren, meubels, trapbekleding en raamdecoratie. Alles onder één dak.',
    telephone: '+31207526672', image: BASE + 'img/hero.jpg', logo: BASE + 'img/logo.svg',
    address: { '@type': 'PostalAddress', streetAddress: A.straat, postalCode: A.postcode, addressLocality: A.plaats, addressCountry: 'NL' },
    geo: { '@type': 'GeoCoordinates', latitude: W.geo.lat, longitude: W.geo.lng },
    areaServed: { '@type': 'City', name: A.plaats },
    openingHoursSpecification: W.openingstijden.map((o) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: 'https://schema.org/' + o.dag, opens: o.open, closes: o.dicht })),
    hasMap: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${NAAM}, ${adresRegel}`),
    sameAs: ['https://www.instagram.com/ideaalmeubel/'],
    knowsAbout: ['laminaat', 'PVC vloeren', 'visgraat laminaat', 'visgraat PVC', 'legservice', 'banken', 'bedden', 'jaloezieën', 'ondervloeren', 'traprenovatie', 'trapbekleding', 'meubels', 'raamdecoratie', 'vloeren leggen'],
  };
  const ORGC = { '@context': 'https://schema.org', ...ORG };
  const crumbs = (items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement:
    items.map(([n, u], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: BASE + u })) });

  // Info-pagina's: diensten en het assortiment in de winkel (banken, bedden, trappen, jaloezieën).
  const INFO = [...leesArtikelen(root, 'content/diensten').map((a) => ({ ...a, sectie: 'diensten' })),
    ...leesArtikelen(root, 'content/assortiment').map((a) => ({ ...a, sectie: 'assortiment' }))]
    .sort((x, y) => (x.volgorde || 99) - (y.volgorde || 99));
  const REV = leesReviews(root);

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
    const links = [['index.html', 'Home'], ...COLLECTIES.map((c) => [c.pad, c.naam]),
      ...INFO.map((a) => [`${a.sectie}/${a.slug}.html`, a.menu || a.titel]), ['kennisbank.html', 'Kennisbank'], ['bestellen.html', 'Bestelling'],
      ...P.map((p) => [`${mapVan(p)}/${p.id}.html`, p.naam + ' ' + soortVan(p)])];
    return '<div id="site-footer"><nav aria-label="Sitemap" class="wrap" style="padding:3rem 0;font-size:.85rem">'
      + links.map(([u, t]) => `<a href="${r}${u}">${e(t)}</a>`).join(' · ')
      + `<p>${e(NAAM)} · ${e(adresRegel)} · Telefoon 020-7526672</p></nav></div>`;
  };
  const foot = (r) => `${staticLinks(r)}\n<script src="${r}js/data.js?v=${V}"></script>\n<script src="${r}js/app.js?v=${V}"></script>\n</body>\n</html>\n`;
  const bodyOpen = (page, r, extra = '') => `<body data-page="${page}" data-root="${r}"${extra}>\n<a class="skip-link" href="#inhoud">Naar de inhoud</a>\n`
    + '<div id="site-header"></div>\n<main id="inhoud" tabindex="-1">\n';

  const card = (p, r) => {
    const tag = p.water ? '<span class="card-tag">Waterbestendig</span>' : '';
    return `<a class="card" href="${r}${mapVan(p)}/${p.id}.html"><div class="card-img">`
      + `<img src="${r}${fotoPad(p)}" alt="${e(p.naam)} ${soortVan(p)}" loading="lazy" width="800" height="800">${tag}</div>`
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
    const path = `${mapVan(p)}/${p.id}.html`;
    const S = soortVan(p), C = collectieVan(p);
    const sv = p.type === 'Visgraat' ? 15 : Math.round(W.snijverlies * 100);
    const title = `${p.naam} ${S}, ${p.dikte} mm ${p.klasse} | ${NAAM}`;
    const desc = `${p.naam} ${S}: ${p.type.toLowerCase()}, ${p.dikte} mm, slijtklasse ${p.klasse}`
      + (p.water ? ', waterbestendig' : '') + `. ${eur(p.prijs)} per m². Bereken direct hoeveel pakken u nodig hebt.`;
    const specs = [['Type', p.type], ['Dikte', `${p.dikte} mm`], ['Slijtklasse', p.klasse], ['Formaat plank', p.formaat],
      ['Inhoud per pak', m2(p.pak)], ['Waterbestendig', p.water ? 'Ja' : 'Nee']];
    const prijs = Number(p.prijs).toFixed(2);
    const productLd = { '@context': 'https://schema.org', '@type': 'Product', name: p.naam + ' ' + S, sku: p.id,
      image: BASE + fotoPad(p), description: p.tekst, category: C.naam, url: BASE + path,
      additionalProperty: specs.map(([n, v]) => ({ '@type': 'PropertyValue', name: n, value: v })),
      offers: { '@type': 'Offer', url: BASE + path, priceCurrency: 'EUR', price: prijs,
        priceSpecification: { '@type': 'UnitPriceSpecification', price: prijs, priceCurrency: 'EUR', unitCode: 'MTK', unitText: 'm²' },
        seller: { '@id': BASE + '#bedrijf' } } };
    const bc = crumbs([['Home', ''], [C.naam, C.pad], [p.naam, path]]);
    const related = P.filter((x) => x.id !== p.id && soortVan(x) === S && (x.type === p.type || x.tint === p.tint)).slice(0, 3);
    const want = S === 'PVC' ? ['laminaat-of-pvc', 'hoeveel-laminaat-nodig', 'ondervloer-laminaat'] : ['hoeveel-laminaat-nodig', 'ondervloer-laminaat', 'ac-klasse-laminaat'];
    if (p.type === 'Visgraat') want.unshift('visgraat-laminaat');
    if (p.water) want.splice(1, 0, 'waterbestendig-laminaat');
    const arts = want.map((s) => ART[s]).filter(Boolean).slice(0, 3);
    const specsHtml = specs.map(([a, b]) => `<div><dt>${a}</dt><dd>${e(b)}</dd></div>`).join('');

    let out = head(title, desc, path, r, ld(productLd) + '\n' + ld(bc), 'product', fotoPad(p));
    out += bodyOpen('product', r, ` data-product="${p.id}"`) + `<section class="section" style="padding-top:3rem"><div class="wrap">
  <nav class="crumbs" aria-label="Kruimelpad"><a href="../index.html">Home</a> / <a href="../${C.pad}">${C.naam}</a> / <span id="crumb-name">${e(p.naam)}</span></nav>
  <div class="product">
    <div class="product-img"><img id="p-img" src="../${fotoPad(p)}" alt="${e(p.naam)} ${S}" width="800" height="800" fetchpriority="high" style="height:auto"></div>
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

  const sjabloon = lees('laminaat.html');
  for (const C of COLLECTIES) {
    const lijst = P.filter(C.filter);
    const titel = `${C.title} | ${NAAM}`;
    let lam = fixHead(sjabloon, C.pad);
    const itemLd = { '@context': 'https://schema.org', '@type': 'ItemList', name: C.naam, itemListElement:
      lijst.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: BASE + `${mapVan(p)}/${p.id}.html`, name: p.naam + ' ' + soortVan(p) })) };
    lam = lam.replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
      .replace('</head>', ld(itemLd) + '\n' + ld(crumbs([['Home', ''], [C.naam, C.pad]])) + '\n</head>')
      .replace(/<title>[^<]*<\/title>/, `<title>${e(titel)}</title>`)
      .replace(/(<meta (?:name="description"|property="og:description") content=")[^"]*"/g, (m, a) => `${a}${e(C.desc)}"`)
      .replace(/(<meta property="og:title" content=")[^"]*"/, (m, a) => `${a}${e(titel)}"`)
      .replace(/<body data-page="laminaat"[^>]*>/, `<body data-page="laminaat" data-collectie="${C.key}">`)
      .replace(/(<div class="crumbs"><a href="index.html">Home<\/a> \/ )[^<]*(<\/div>)/, (m, a, b) => `${a}${C.naam}${b}`)
      .replace(/<h1>[^<]*<\/h1>/, `<h1>${C.naam}</h1>`)
      .replace(/(<h1>[^<]*<\/h1>\s*<p class="lead">)[^<]*/, (m, a) => a + e(C.lead));
    lam = fill(lam, 'products', lijst.length ? lijst.map((p) => card(p, '')).join('')
      : `<div class="leeg-blok"><span class="kicker">${e(C.naam)}</span><h2>Bekijk de ${e(C.naam)} in onze winkel</h2><p class="lead">Deze collectie staat binnenkort online. In de winkel aan de ${e(A.straat)} ziet en voelt u de vloeren in het echt, en wij adviseren u graag.</p><div class="hero-actions"><a class="btn btn-dark" href="${W.telefoonLink}">Bel ${e(W.telefoon)} <i class="arrow"></i></a><a class="btn btn-line dark" href="diensten/legservice.html">Onze legservice</a></div></div>`);
    uit.set(C.pad, lam);
  }

  // ---------- Reviews ----------
  const sterren = '<span class="sterren" aria-hidden="true">★★★★★</span>';
  const reviewsBlok = (r, tag = '', n = 6, klasse = 'section paper') => {
    if (!REV || !REV.reviews?.length) return '';
    let lijst = tag ? REV.reviews.filter((x) => (x.soort || []).includes(tag)) : REV.reviews;
    if (lijst.length < n) lijst = lijst.concat(REV.reviews.filter((x) => !lijst.includes(x)));
    lijst = lijst.slice(0, n);
    return `<section class="${klasse}" id="reviews" aria-labelledby="reviews-titel"><div class="wrap">
  <div class="section-head"><div><span class="kicker">Google reviews</span><h2 id="reviews-titel">Wat klanten zeggen</h2></div>
    <a class="rating" href="${e(REV.url)}" target="_blank" rel="noopener"><strong>${e(REV.score)}</strong><span>${sterren}<span>${e(REV.aantal)} reviews op Google</span></span></a></div>
  <div class="reviews">${lijst.map((x) => `<figure class="review">${sterren}<span class="sr">5 van 5 sterren</span><blockquote><p>${e(x.tekst)}</p></blockquote><figcaption>${e(x.naam)} <span>via Google</span></figcaption></figure>`).join('')}</div>
  <p class="reviews-meer"><a class="btn btn-line dark" href="${e(REV.url)}" target="_blank" rel="noopener">Lees alle reviews op Google <i class="arrow"></i></a></p>
</div></section>`;
  };
  home = fill(home, 'reviews', reviewsBlok(''));
  uit.set('index.html', home);

  // ---------- Info-pagina's (diensten en assortiment) ----------
  for (const a of INFO) {
    const r = '../';
    const path = `${a.sectie}/${a.slug}.html`;
    const isDienst = a.sectie === 'diensten';
    const sectieNaam = isDienst ? 'Diensten' : 'Producten';
    const faqLd = { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: (a.faq || []).map((q) =>
      ({ '@type': 'Question', name: q.vraag, acceptedAnswer: { '@type': 'Answer', text: q.antwoord } })) };
    const extraLd = isDienst
      ? { '@context': 'https://schema.org', '@type': 'Service', name: a.titel, description: a.beschrijving, url: BASE + path,
        provider: { '@id': BASE + '#bedrijf' }, areaServed: { '@type': 'City', name: A.plaats } }
      : { '@context': 'https://schema.org', '@type': 'WebPage', name: a.titel, description: a.beschrijving, url: BASE + path, about: { '@id': BASE + '#bedrijf' } };
    const bc = crumbs([['Home', ''], [a.titel, path]]);
    const anderen = INFO.filter((x) => x.sectie === a.sectie && x.slug !== a.slug);
    const faq = (a.faq || []).map((q) => `<details><summary>${e(q.vraag)}</summary><p>${e(q.antwoord)}</p></details>`).join('');
    const beeld = a.beeld || 'img/hero.jpg';
    let out = head(`${a.seo || a.titel} | ${NAAM}`, a.beschrijving, path, r, [ld(extraLd), ld(faqLd), ld(bc), ld(ORGC)].join('\n'), 'website', beeld);
    out += bodyOpen('info', r, ` data-sectie="${a.sectie}"`) + `<section class="page-head"><div class="wrap">
  <nav class="crumbs" aria-label="Kruimelpad"><a href="../index.html">Home</a> / ${sectieNaam} / ${e(a.titel)}</nav>
  <span class="kicker">${e(a.kicker || sectieNaam)}</span>
  <h1>${e(a.titel)}</h1>
  <p class="lead">${e(a.kort)}</p>
  <div class="hero-actions" style="margin-top:2rem">
    <a class="btn btn-dark" href="${W.telefoonLink}">Bel ${e(W.telefoon)} <i class="arrow"></i></a>
    <a class="btn btn-line dark" href="../index.html#contact">Kom langs in de winkel</a>
  </div>
</div></section>
<section class="section" style="padding-top:4rem"><div class="wrap info">
  <div class="info-tekst">
    <div class="prose">
${a.body}
    </div>
    ${faq ? `<section class="faq" aria-labelledby="faq-titel"><h2 id="faq-titel">Veelgestelde vragen</h2>${faq}</section>` : ''}
  </div>
  <aside class="info-aside">
    <img src="${r}${beeld}" alt="" loading="lazy" width="800" height="1000">
    <div class="info-kaart">
      <h2>Advies in de winkel</h2>
      <p>${e(A.straat)}<br>${e(A.postcode)} ${e(A.plaats)}</p>
      <a class="btn btn-brass" href="${W.telefoonLink}">Bel ${e(W.telefoon)}</a>
      ${REV ? `<a class="rating klein" href="${e(REV.url)}" target="_blank" rel="noopener"><strong>${e(REV.score)}</strong><span>${sterren}<span>${e(REV.aantal)} reviews op Google</span></span></a>` : ''}
    </div>
  </aside>
</div></section>
${reviewsBlok(r, a.reviews || '', 3)}
${anderen.length ? `<section class="section"><div class="wrap">
  <div class="section-head"><div><span class="kicker">${sectieNaam}</span><h2>Ook interessant</h2></div></div>
  <div class="kb-grid">${anderen.slice(0, 3).map((x) => `<a class="kb-item" href="${r}${x.sectie}/${x.slug}.html"><span class="kb-cat">${e(x.kicker || sectieNaam)}</span><h3>${e(x.titel)}</h3><p>${e(x.kort)}</p><span class="kb-more">Lees verder <i class="arrow"></i></span></a>`).join('')}</div>
</div></section>` : ''}
</main>
` + foot(r);
    uit.set(path, out);
  }

  uit.set('bestellen.html', fixHead(lees('bestellen.html'), 'bestellen.html'));

  uit.set('product.html', `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Laminaat | ${e(NAAM)}</title>
<script>var id=new URLSearchParams(location.search).get('id'),pvc=${JSON.stringify(P.filter((p) => p.soort === 'PVC').map((p) => p.id))};location.replace(/^[a-z0-9-]+$/.test(id||'')?(pvc.indexOf(id)>-1?'pvc/':'laminaat/')+id+'.html':'laminaat.html');</script>
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
  const urls = [['', '1.0'], ...COLLECTIES.map((c) => [c.pad, '0.9']), ...INFO.map((a) => [`${a.sectie}/${a.slug}.html`, '0.8']), ['kennisbank.html', '0.8'],
    ...P.map((p) => [`${mapVan(p)}/${p.id}.html`, '0.8']), ...ARTS.map((a) => [`kennisbank/${a.slug}.html`, '0.7'])];
  uit.set('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(([u, pr]) => `  <url><loc>${BASE}${u}</loc><lastmod>${TODAY}</lastmod><priority>${pr}</priority></url>\n`).join('') + '</urlset>\n');

  const bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot',
    'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'Googlebot'];
  uit.set('robots.txt', '# Zoekmachines en AI-assistenten zijn welkom.\n' + bots.map((b) => `User-agent: ${b}\nAllow: /\nDisallow: /beheer/\n\n`).join('')
    + `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /beheer/\n\nSitemap: ${BASE}sitemap.xml\n`);

  const llms = [`# ${NAAM}`, '',
    `> ${NAAM} is een woonwinkel in ${A.plaats} voor vloeren (laminaat), meubels, trapbekleding en raamdecoratie. `
    + 'Al 25 jaar experts in wonen, alles onder één dak. Klanten kunnen laminaat en PVC online uitzoeken, het aantal pakken '
    + 'laten berekenen en een bestelaanvraag versturen; betaling en levering worden daarna persoonlijk afgestemd.', '',
    `- Adres: ${adresRegel}`, '- Telefoon: 020-7526672',
    '- Openingstijden: ' + W.openingstijden.map((o) => `${o.naam} ${o.open}-${o.dicht}`).join(', '),
    '- Instagram: https://www.instagram.com/ideaalmeubel/', `- Website: ${BASE}`,
    ...(REV ? [`- Google-reviews: ${REV.score} uit 5 op basis van ${REV.aantal} reviews (${REV.url})`] : []), '', '## Vloeren', '',
    ...COLLECTIES.map((c) => `- [${c.naam}](${BASE}${c.pad}): ${c.desc}`), '', '## Vloercollectie', '',
    ...P.map((p) => `- [${p.naam} ${soortVan(p)}](${BASE}${mapVan(p)}/${p.id}.html): ${p.type.toLowerCase()}, ${p.dikte} mm, ${p.klasse}`
      + `${p.water ? ', waterbestendig' : ''}, ${p.formaat}, ${eur(p.prijs)} per m². ${p.tekst}`),
    '', '## Kennisbank', '', ...ARTS.map((a) => `- [${a.titel}](${BASE}kennisbank/${a.slug}.html): ${a.kort}`),
    '', '## Diensten', '', ...INFO.filter((a) => a.sectie === 'diensten').map((a) => `- [${a.titel}](${BASE}diensten/${a.slug}.html): ${a.kort}`),
    '', '## Ook in de winkel', '', ...INFO.filter((a) => a.sectie === 'assortiment').map((a) => `- [${a.titel}](${BASE}assortiment/${a.slug}.html): ${a.kort}`), ''];
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
  for (const map of ['laminaat', 'pvc']) {
    mkdirSync(join(root, map), { recursive: true });
    const ids = new Set(W.laminaat.filter((p) => mapVan(p) === map).map((p) => p.id));
    for (const f of readdirSync(join(root, map))) if (!ids.has(f.replace(/\.html$/, ''))) unlinkSync(join(root, map, f));
  }
  for (const [pad, inhoud] of uit) {
    mkdirSync(dirname(join(root, pad)), { recursive: true });
    const doel = join(root, pad);
    if (!existsSync(doel) || readFileSync(doel, 'utf8') !== inhoud) writeFileSync(doel, inhoud);
  }
  console.log(`${W.laminaat.length} productpagina's, ${uit.size} bestanden`);
}
