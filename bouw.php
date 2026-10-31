<?php
/* Bouwt de statische pagina's van Ideaal Meubel & Vloer uit data/winkel.json.

   Het beheerportaal (beheer/) draait dit automatisch na elke wijziging.
   Met de hand:  php bouw.php

   Maakt:
     js/data.js                 productgegevens voor de winkelwagen
     laminaat/<id>.html         productpagina per vloer (ook zonder JavaScript leesbaar)
     kennisbank.html            overzicht artikelen
     kennisbank/<slug>.html     artikelen met FAQ (bron: content/kennisbank/*.html)
     sitemap.xml, robots.txt, llms.txt, 404.html
   en vult de productlijsten, het adres en de openingstijden in index.html en laminaat.html.
*/

function bouw_site(): string
{
    $ROOT = __DIR__;
    $W = json_decode(file_get_contents("$ROOT/data/winkel.json"), true);
    if (!is_array($W) || !isset($W['laminaat'])) throw new RuntimeException('data/winkel.json is ongeldig');
    $BASE = $W['website'];
    $NAAM = $W['naam'];
    $P = $W['laminaat'];
    $TODAY = date('Y-m-d');
    $A = $W['adres'];
    $adresRegel = "{$A['straat']}, {$A['postcode']} {$A['plaats']}";

    $e = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $eur = fn($n) => '€ ' . number_format((float)$n, 2, ',', '');
    $m2 = fn($n) => number_format((float)$n, 2, ',', '') . ' m²';
    $ld = fn($o) => '<script type="application/ld+json">' . str_replace('</', '<\/', json_encode($o, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) . '</script>';
    $write = function ($path, $s) use ($ROOT) {
        if (@file_get_contents("$ROOT/$path") !== $s) file_put_contents("$ROOT/$path", $s, LOCK_EX);
    };

    // 1. js/data.js (wat de winkelwagen en filters gebruiken)
    $js = $W;
    unset($js['website']);
    $write('js/data.js', "/* Gemaakt door bouw.php uit data/winkel.json. Niet met de hand aanpassen: gebruik het beheerportaal (beheer/). */\n"
        . 'window.IDEAAL = ' . json_encode($js, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . ";\n");

    // Cacheversie: verandert vanzelf zodra css/js/data wijzigt.
    $V = substr(md5(file_get_contents("$ROOT/js/data.js") . file_get_contents("$ROOT/js/app.js") . file_get_contents("$ROOT/css/style.css")), 0, 8);

    $DAGEN = ['Monday' => 'Mo', 'Tuesday' => 'Tu', 'Wednesday' => 'We', 'Thursday' => 'Th', 'Friday' => 'Fr', 'Saturday' => 'Sa', 'Sunday' => 'Su'];
    $ORG = ['@type' => 'HomeGoodsStore', '@id' => $BASE . '#bedrijf', 'name' => $NAAM, 'url' => $BASE,
        'description' => 'Al 20 jaar specialist in vloeren, meubels, trapbekleding en raamdecoratie. Alles onder één dak.',
        'telephone' => '+31207526672', 'image' => $BASE . 'img/hero.jpg', 'logo' => $BASE . 'img/logo.svg',
        'address' => ['@type' => 'PostalAddress', 'streetAddress' => $A['straat'], 'postalCode' => $A['postcode'],
            'addressLocality' => $A['plaats'], 'addressCountry' => 'NL'],
        'geo' => ['@type' => 'GeoCoordinates', 'latitude' => $W['geo']['lat'], 'longitude' => $W['geo']['lng']],
        'areaServed' => ['@type' => 'City', 'name' => $A['plaats']],
        'openingHoursSpecification' => array_map(fn($o) => ['@type' => 'OpeningHoursSpecification',
            'dayOfWeek' => 'https://schema.org/' . $o['dag'], 'opens' => $o['open'], 'closes' => $o['dicht']], $W['openingstijden']),
        'hasMap' => 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode("$NAAM, $adresRegel"),
        'sameAs' => ['https://www.instagram.com/ideaalmeubel/'],
        'knowsAbout' => ['laminaat', 'visgraat laminaat', 'ondervloeren', 'traprenovatie', 'trapbekleding',
            'meubels', 'raamdecoratie', 'vloeren leggen']];
    $ORGC = ['@context' => 'https://schema.org'] + $ORG;

    $crumbs = fn($items) => ['@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' =>
        array_map(fn($i, $x) => ['@type' => 'ListItem', 'position' => $i + 1, 'name' => $x[0], 'item' => $BASE . $x[1]], array_keys($items), $items)];

    $head = function ($title, $desc, $path, $root, $extra = '', $ogType = 'website', $image = 'img/hero.jpg', $robots = '') use ($e, $BASE, $NAAM, $V) {
        $url = $BASE . $path;
        return <<<HTML
<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{$e($title)}</title>
<meta name="description" content="{$e($desc)}">
<link rel="canonical" href="$url">
{$robots}<link rel="icon" href="{$root}img/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="{$root}css/style.css?v=$V">
<meta name="theme-color" content="#141210">
<meta property="og:type" content="$ogType">
<meta property="og:locale" content="nl_NL">
<meta property="og:site_name" content="{$e($NAAM)}">
<meta property="og:title" content="{$e($title)}">
<meta property="og:description" content="{$e($desc)}">
<meta property="og:url" content="$url">
<meta property="og:image" content="$BASE$image">
<meta name="twitter:card" content="summary_large_image">
$extra
</head>
HTML;
    };

    // Gewone links in de footer-placeholder: crawlers zonder JavaScript zien zo de hele site. app.js vervangt dit blok.
    $staticLinks = function ($root) use ($P, $e, $NAAM, $adresRegel) {
        $links = [['index.html', 'Home'], ['laminaat.html', 'Laminaat'], ['kennisbank.html', 'Kennisbank'], ['bestellen.html', 'Bestelling']];
        foreach ($P as $p) $links[] = ["laminaat/{$p['id']}.html", $p['naam'] . ' laminaat'];
        return '<div id="site-footer"><nav aria-label="Sitemap" class="wrap" style="padding:3rem 0;font-size:.85rem">'
            . implode(' · ', array_map(fn($l) => "<a href=\"$root{$l[0]}\">{$e($l[1])}</a>", $links))
            . "<p>{$e($NAAM)} · {$e($adresRegel)} · Telefoon 020-7526672</p></nav></div>";
    };
    $foot = fn($root) => $staticLinks($root) . "\n<script src=\"{$root}js/data.js?v=$V\"></script>\n<script src=\"{$root}js/app.js?v=$V\"></script>\n</body>\n</html>\n";
    $bodyOpen = fn($page, $root, $extra = '') => "<body data-page=\"$page\" data-root=\"$root\"$extra>\n<a class=\"skip-link\" href=\"#inhoud\">Naar de inhoud</a>\n"
        . "<div id=\"site-header\"></div>\n<main id=\"inhoud\" tabindex=\"-1\">\n";

    $card = function ($p, $root) use ($e, $eur) {
        $tag = $p['water'] ? '<span class="card-tag">Waterbestendig</span>' : '';
        return "<a class=\"card\" href=\"{$root}laminaat/{$p['id']}.html\"><div class=\"card-img\">"
            . "<img src=\"{$root}img/laminaat/{$p['id']}.jpg\" alt=\"{$e($p['naam'])} laminaat\" loading=\"lazy\" width=\"800\" height=\"800\">$tag</div>"
            . "<div class=\"card-body\"><div><h3>{$e($p['naam'])}</h3><div class=\"card-meta\">{$e($p['type'])} · {$e($p['dikte'])} mm · {$e($p['klasse'])}</div></div>"
            . "<div class=\"card-price\"><strong>{$eur($p['prijs'])}</strong><span>per m²</span></div></div></a>";
    };

    // ---------- Kennisbank inlezen ----------
    $ARTS = [];
    foreach (glob("$ROOT/content/kennisbank/*.html") as $f) {
        if (!preg_match('/^\s*<!--(.*?)-->(.*)$/s', file_get_contents($f), $m)) continue;
        $a = json_decode($m[1], true);
        $a['slug'] = basename($f, '.html');
        $a['body'] = trim($m[2]);
        $a['woorden'] = count(preg_split('/\s+/u', trim(preg_replace('/<[^>]+>/', ' ', $a['body'])), -1, PREG_SPLIT_NO_EMPTY));
        $ARTS[] = $a;
    }
    $CAT = ['Kiezen', 'Leggen', 'Onderhoud'];
    usort($ARTS, function ($x, $y) use ($CAT) {
        $cx = array_search($x['categorie'], $CAT); $cy = array_search($y['categorie'], $CAT);
        return [$cx === false ? 9 : $cx, $x['titel']] <=> [$cy === false ? 9 : $cy, $y['titel']];
    });
    $ART = array_column($ARTS, null, 'slug');
    $artLink = fn($a, $root) => "<a class=\"kb-item\" href=\"{$root}kennisbank/{$a['slug']}.html\"><span class=\"kb-cat\">{$e($a['categorie'])}</span>"
        . "<h3>{$e($a['titel'])}</h3><p>{$e($a['kort'])}</p><span class=\"kb-more\">Lees verder <i class=\"arrow\"></i></span></a>";

    // ---------- Productpagina's ----------
    @mkdir("$ROOT/laminaat");
    $ids = array_column($P, 'id');
    foreach (glob("$ROOT/laminaat/*.html") as $f) if (!in_array(basename($f, '.html'), $ids, true)) unlink($f); // verwijderde vloeren
    foreach ($P as $p) {
        $r = '../';
        $path = "laminaat/{$p['id']}.html";
        $sv = $p['type'] === 'Visgraat' ? 10 : (int)round($W['snijverlies'] * 100);
        $title = "{$p['naam']} laminaat, {$p['dikte']} mm {$p['klasse']} | $NAAM";
        $desc = "{$p['naam']} laminaat: " . mb_strtolower($p['type']) . ", {$p['dikte']} mm, slijtklasse {$p['klasse']}"
            . ($p['water'] ? ', waterbestendig' : '') . ". {$eur($p['prijs'])} per m². Bereken direct hoeveel pakken u nodig hebt.";
        $specs = [['Type', $p['type']], ['Dikte', "{$p['dikte']} mm"], ['Slijtklasse', $p['klasse']], ['Formaat plank', $p['formaat']],
            ['Inhoud per pak', $m2($p['pak'])], ['Waterbestendig', $p['water'] ? 'Ja' : 'Nee']];
        $prijs = number_format((float)$p['prijs'], 2, '.', '');
        $productLd = ['@context' => 'https://schema.org', '@type' => 'Product', 'name' => $p['naam'] . ' laminaat', 'sku' => $p['id'],
            'image' => $BASE . "img/laminaat/{$p['id']}.jpg", 'description' => $p['tekst'], 'category' => 'Laminaat', 'url' => $BASE . $path,
            'additionalProperty' => array_map(fn($s) => ['@type' => 'PropertyValue', 'name' => $s[0], 'value' => $s[1]], $specs),
            'offers' => ['@type' => 'Offer', 'url' => $BASE . $path, 'priceCurrency' => 'EUR', 'price' => $prijs,
                'priceSpecification' => ['@type' => 'UnitPriceSpecification', 'price' => $prijs, 'priceCurrency' => 'EUR', 'unitCode' => 'MTK', 'unitText' => 'm²'],
                'seller' => ['@id' => $BASE . '#bedrijf']]];
        $bc = $crumbs([['Home', ''], ['Laminaat', 'laminaat.html'], [$p['naam'], $path]]);
        $related = array_slice(array_values(array_filter($P, fn($x) => $x['id'] !== $p['id'] && ($x['type'] === $p['type'] || $x['tint'] === $p['tint']))), 0, 3);
        $want = ['hoeveel-laminaat-nodig', 'ondervloer-laminaat', 'ac-klasse-laminaat'];
        if ($p['type'] === 'Visgraat') array_unshift($want, 'visgraat-laminaat');
        if ($p['water']) array_splice($want, 1, 0, 'waterbestendig-laminaat');
        $arts = array_slice(array_values(array_filter(array_map(fn($s) => $ART[$s] ?? null, $want))), 0, 3);
        $specsHtml = implode('', array_map(fn($s) => "<div><dt>{$s[0]}</dt><dd>{$e($s[1])}</dd></div>", $specs));

        $out = $head($title, $desc, $path, $r, $ld($productLd) . "\n" . $ld($bc), 'product', "img/laminaat/{$p['id']}.jpg");
        $out .= $bodyOpen('product', $r, " data-product=\"{$p['id']}\"") . <<<HTML
<section class="section" style="padding-top:3rem"><div class="wrap">
  <nav class="crumbs" aria-label="Kruimelpad"><a href="../index.html">Home</a> / <a href="../laminaat.html">Laminaat</a> / <span id="crumb-name">{$e($p['naam'])}</span></nav>
  <div class="product">
    <div class="product-img"><img id="p-img" src="../img/laminaat/{$p['id']}.jpg" alt="{$e($p['naam'])} laminaat" width="800" height="800" fetchpriority="high" style="height:auto"></div>
    <div class="product-info">
      <span class="kicker" id="p-lijn">Collectie {$e($p['lijn'])}</span>
      <h1 id="p-naam" style="font-size:clamp(2.4rem,4.5vw,3.8rem)">{$e($p['naam'])}</h1>
      <div class="price" id="p-prijs">{$eur($p['prijs'])} <small>per m² · {$eur($p['prijs'] * $p['pak'])} per pak</small></div>
      <p id="p-tekst">{$e($p['tekst'])}</p>
      <dl class="specs" id="p-specs">$specsHtml</dl>
      <div class="calc">
        <h2 class="calc-title">Bereken wat u nodig hebt</h2>
        <div class="row">
          <div class="field"><label for="lengte">Lengte ruimte (m)</label><input id="lengte" inputmode="decimal" placeholder="bijv. 5,2"></div>
          <div class="field"><label for="breedte">Breedte ruimte (m)</label><input id="breedte" inputmode="decimal" placeholder="bijv. 4"></div>
        </div>
        <div class="calc-result"><span>Oppervlakte</span><span id="r-opp">0,00 m²</span></div>
        <div class="calc-result"><span id="r-label">Benodigd incl. $sv% snijverlies</span><span id="r-pakken">0 pakken</span></div>
        <div class="calc-result"><span>Prijs</span><strong id="r-prijs">€ 0,00</strong></div>
        <button class="btn btn-brass" id="add" type="button" disabled>Toevoegen aan bestelling</button>
        <div class="added" id="added">Toegevoegd. <a href="../bestellen.html">Bekijk uw bestelling</a> of kies nog een vloer.</div>
        <p class="note">U betaalt niets online. Na uw aanvraag nemen wij contact op om alles te bevestigen.</p>
      </div>
    </div>
  </div>
</div></section>

HTML;
        if ($arts) {
            $out .= "<section class=\"section\"><div class=\"wrap\">\n  <div class=\"section-head\"><div><span class=\"kicker\">Kennisbank</span><h2>Goed om te weten</h2></div></div>\n"
                . '  <div class="kb-grid">' . implode('', array_map(fn($a) => $artLink($a, $r), $arts)) . "</div>\n</div></section>\n";
        }
        $out .= "<section class=\"section paper\"><div class=\"wrap\">\n  <div class=\"section-head\"><div><span class=\"kicker\">Ook interessant</span><h2>Vergelijkbare vloeren</h2></div></div>\n"
            . '  <div class="grid" id="related">' . implode('', array_map(fn($x) => $card($x, $r), $related)) . "</div>\n</div></section>\n</main>\n" . $foot($r);
        $write($path, $out);
    }

    // ---------- Kennisbank ----------
    @mkdir("$ROOT/kennisbank");
    foreach ($ARTS as $a) {
        $r = '../';
        $path = "kennisbank/{$a['slug']}.html";
        $artLd = ['@context' => 'https://schema.org', '@type' => 'Article', 'headline' => $a['titel'], 'description' => $a['beschrijving'],
            'abstract' => $a['kort'], 'inLanguage' => 'nl-NL', 'wordCount' => $a['woorden'], 'dateModified' => $TODAY,
            'mainEntityOfPage' => $BASE . $path, 'image' => $BASE . 'img/hero.jpg',
            'author' => ['@id' => $BASE . '#bedrijf'], 'publisher' => ['@id' => $BASE . '#bedrijf']];
        $faqLd = ['@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => array_map(fn($q) =>
            ['@type' => 'Question', 'name' => $q['vraag'], 'acceptedAnswer' => ['@type' => 'Answer', 'text' => $q['antwoord']]], $a['faq'])];
        $bc = $crumbs([['Home', ''], ['Kennisbank', 'kennisbank.html'], [$a['titel'], $path]]);
        $prods = array_slice(array_values(array_filter($P, fn($x) => in_array($x['id'], $a['gerelateerd'] ?? [], true))), 0, 3);
        $others = array_slice(array_values(array_filter($ARTS, fn($x) => $x['slug'] !== $a['slug'] && $x['categorie'] === $a['categorie'])), 0, 3);
        if (count($others) < 3) {
            $rest = array_values(array_filter($ARTS, fn($x) => $x['slug'] !== $a['slug'] && !in_array($x, $others, true)));
            $others = array_merge($others, array_slice($rest, 0, 3 - count($others)));
        }
        $min = max(1, (int)round($a['woorden'] / 200));
        $faq = implode('', array_map(fn($q) => "<details><summary>{$e($q['vraag'])}</summary><p>{$e($q['antwoord'])}</p></details>", $a['faq']));
        $out = $head($a['titel'] . ' | ' . $NAAM, $a['beschrijving'], $path, $r, implode("\n", [$ld($artLd), $ld($faqLd), $ld($bc), $ld($ORGC)]), 'article');
        $out .= $bodyOpen('kennisbank', $r) . <<<HTML
<article>
<header class="page-head"><div class="wrap article-wrap">
  <nav class="crumbs" aria-label="Kruimelpad"><a href="../index.html">Home</a> / <a href="../kennisbank.html">Kennisbank</a> / {$e($a['categorie'])}</nav>
  <h1>{$e($a['titel'])}</h1>
  <p class="article-meta">{$e($a['categorie'])} · ca. $min min lezen · {$e($NAAM)}</p>
</div></header>
<div class="section" style="padding-top:3.5rem"><div class="wrap article-wrap">
  <div class="kort"><strong>Kort antwoord</strong><p>{$e($a['kort'])}</p></div>
  <div class="prose">
{$a['body']}
  </div>
  <section class="faq" aria-labelledby="faq-titel">
    <h2 id="faq-titel">Veelgestelde vragen</h2>
    $faq
  </section>
</div></div>
</article>

HTML;
        if ($prods) {
            $out .= "<section class=\"section paper\"><div class=\"wrap\">\n  <div class=\"section-head\"><div><span class=\"kicker\">Uit de collectie</span><h2>Passende vloeren</h2></div>\n"
                . "  <a class=\"btn btn-line dark\" href=\"../laminaat.html\">Alle vloeren <i class=\"arrow\"></i></a></div>\n"
                . '  <div class="grid">' . implode('', array_map(fn($x) => $card($x, $r), $prods)) . "</div>\n</div></section>\n";
        }
        $out .= "<section class=\"section\"><div class=\"wrap\">\n  <div class=\"section-head\"><div><span class=\"kicker\">Kennisbank</span><h2>Lees ook</h2></div></div>\n"
            . '  <div class="kb-grid">' . implode('', array_map(fn($x) => $artLink($x, $r), $others)) . "</div>\n</div></section>\n</main>\n" . $foot($r);
        $write($path, $out);
    }

    // Overzicht kennisbank
    $groups = '';
    foreach ($CAT as $c) {
        $items = array_filter($ARTS, fn($a) => $a['categorie'] === $c);
        if ($items) $groups .= "<div class=\"kb-group\"><h2>$c</h2><div class=\"kb-grid\">" . implode('', array_map(fn($a) => $artLink($a, ''), $items)) . '</div></div>';
    }
    $listLd = ['@context' => 'https://schema.org', '@type' => 'CollectionPage', 'name' => 'Kennisbank laminaat', 'url' => $BASE . 'kennisbank.html',
        'hasPart' => array_map(fn($a) => ['@type' => 'Article', 'headline' => $a['titel'], 'url' => $BASE . "kennisbank/{$a['slug']}.html"], $ARTS)];
    $out = $head('Kennisbank laminaat: kiezen, leggen en onderhouden | ' . $NAAM,
        'Heldere antwoorden op vragen over laminaat: hoeveel u nodig hebt, welke slijtklasse, ondervloer, vloerverwarming, leggen en onderhoud.',
        'kennisbank.html', '', $ld($listLd) . "\n" . $ld($crumbs([['Home', ''], ['Kennisbank', 'kennisbank.html']])));
    $out .= $bodyOpen('kennisbank', '') . <<<HTML
<section class="page-head"><div class="wrap">
  <nav class="crumbs" aria-label="Kruimelpad"><a href="index.html">Home</a> / Kennisbank</nav>
  <h1>Kennisbank</h1>
  <p class="lead">Praktische antwoorden op de vragen die wij in de winkel het vaakst horen. Van de juiste slijtklasse tot het leggen van een visgraatvloer.</p>
</div></section>
<section class="section" style="padding-top:4rem"><div class="wrap">$groups</div></section>
</main>

HTML . $foot('');
    $write('kennisbank.html', $out);

    // ---------- Handgeschreven pagina's bijwerken ----------
    $fill = function ($s, $key, $content) {
        if (strpos($s, "<!--build:$key-->") === false) $s = preg_replace('/id="' . $key . '"><\/div>/', "id=\"$key\"><!--build:$key--><!--/build:$key--></div>", $s, 1);
        return preg_replace_callback("/<!--build:$key-->.*?<!--\/build:$key-->/s", fn() => "<!--build:$key-->$content<!--/build:$key-->", $s);
    };
    $fixHead = function ($s, $path) use ($BASE, $V, $staticLinks) {
        $s = preg_replace('/\s*<link rel="canonical"[^>]*>/', '', $s);
        $s = preg_replace('/\s*<meta property="og:url"[^>]*>/', '', $s);
        $s = preg_replace('/<meta name="theme-color"/', "<link rel=\"canonical\" href=\"$BASE$path\">\n<meta property=\"og:url\" content=\"$BASE$path\">\n<meta name=\"theme-color\"", $s, 1);
        $s = preg_replace('/content="(?:https?:\/\/[^"]*\/)?img\/hero\.jpg"/', "content=\"{$BASE}img/hero.jpg\"", $s);
        $s = preg_replace('/(style\.css|data\.js|app\.js)\?v=[0-9a-f]+/', '${1}?v=' . $V, $s);
        return preg_replace_callback('/<div id="site-footer">(?:<nav.*?<\/nav>)?<\/div>/s', fn() => $staticLinks(''), $s, 1);
    };

    $tijden = implode('', array_map(fn($o) => "<li><span>{$o['naam']}</span><span>{$o['open']} - {$o['dicht']}</span></li>", $W['openingstijden']));
    $kaart = $e($ORG['hasMap']);

    $home = $fixHead(file_get_contents("$ROOT/index.html"), '');
    $home = preg_replace_callback('/<script type="application\/ld\+json">.*?<\/script>/s', fn() => $ld($ORGC), $home, 1);
    $byId = array_column($P, null, 'id');
    $feat = array_values(array_filter(array_map(fn($i) => $byId[$i] ?? null, ['eiken-gerookt', 'visgraat-naturel', 'eiken-grijs-rustiek'])));
    foreach ($P as $p) if (count($feat) < 3 && !in_array($p, $feat, true)) $feat[] = $p;
    $home = $fill($home, 'featured', implode('', array_map(fn($x) => $card($x, ''), $feat)));
    $home = $fill($home, 'kb-home', implode('', array_map(fn($a) => $artLink($a, ''), array_filter(array_map(fn($s) => $ART[$s] ?? null, ['hoeveel-laminaat-nodig', 'laminaat-of-pvc', 'visgraat-laminaat'])))));
    $home = $fill($home, 'winkel-adres', "<a href=\"$kaart\" target=\"_blank\" rel=\"noopener\">{$e($A['straat'])}<br>{$e($A['postcode'])} {$e($A['plaats'])}</a>");
    $home = $fill($home, 'winkel-tijden', $tijden);
    $write('index.html', $home);

    $lam = $fixHead(file_get_contents("$ROOT/laminaat.html"), 'laminaat.html');
    $itemLd = ['@context' => 'https://schema.org', '@type' => 'ItemList', 'name' => 'Laminaat collectie', 'itemListElement' =>
        array_map(fn($i, $p) => ['@type' => 'ListItem', 'position' => $i + 1, 'url' => $BASE . "laminaat/{$p['id']}.html", 'name' => $p['naam'] . ' laminaat'], array_keys($P), $P)];
    $lam = preg_replace('/\s*<script type="application\/ld\+json">.*?<\/script>/s', '', $lam);
    $lam = preg_replace('/<\/head>/', $ld($itemLd) . "\n</head>", $lam, 1);
    $lam = $fill($lam, 'products', implode('', array_map(fn($p) => $card($p, ''), $P)));
    $write('laminaat.html', $lam);

    $write('bestellen.html', $fixHead(file_get_contents("$ROOT/bestellen.html"), 'bestellen.html'));

    // product.html blijft bestaan voor oude links en stuurt door
    $write('product.html', <<<HTML
<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Laminaat | {$e($NAAM)}</title>
<script>var id=new URLSearchParams(location.search).get('id');location.replace(/^[a-z0-9-]+$/.test(id||'')?'laminaat/'+id+'.html':'laminaat.html');</script>
</head><body><p><a href="laminaat.html">Naar de laminaatcollectie</a></p></body></html>

HTML);

    // 404 (absolute paden: de pagina kan op elke diepte getoond worden)
    $r404 = parse_url($BASE, PHP_URL_PATH) ?: '/';
    $write('404.html', $head('Pagina niet gevonden | ' . $NAAM, 'Deze pagina bestaat niet (meer).', '404.html', $r404, '', 'website', 'img/hero.jpg', "<meta name=\"robots\" content=\"noindex\">\n")
        . $bodyOpen('404', $r404) . <<<HTML
<section class="section"><div class="wrap done">
<span class="kicker">404</span><h1>Deze pagina bestaat niet (meer)</h1>
<p class="lead">Misschien is de link verouderd. Bekijk de collectie of de kennisbank.</p>
<a class="btn btn-dark" href="{$r404}laminaat.html">Bekijk laminaat <i class="arrow"></i></a></div></section></main>

HTML . $foot($r404));

    // ---------- sitemap, robots, llms ----------
    $urls = [['', '1.0'], ['laminaat.html', '0.9'], ['kennisbank.html', '0.8']];
    foreach ($P as $p) $urls[] = ["laminaat/{$p['id']}.html", '0.8'];
    foreach ($ARTS as $a) $urls[] = ["kennisbank/{$a['slug']}.html", '0.7'];
    $write('sitemap.xml', "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n"
        . implode('', array_map(fn($u) => "  <url><loc>$BASE{$u[0]}</loc><lastmod>$TODAY</lastmod><priority>{$u[1]}</priority></url>\n", $urls)) . "</urlset>\n");

    $bots = ['GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot',
        'Perplexity-User', 'Google-Extended', 'Applebot-Extended', 'Bingbot', 'Googlebot'];
    $write('robots.txt', "# Zoekmachines en AI-assistenten zijn welkom.\n" . implode('', array_map(fn($b) => "User-agent: $b\nAllow: /\nDisallow: /beheer/\n\n", $bots))
        . "User-agent: *\nAllow: /\nDisallow: /bestelling.php\nDisallow: /beheer/\n\nSitemap: {$BASE}sitemap.xml\n");

    $llms = ["# $NAAM", '',
        "> $NAAM is een woonwinkel in {$A['plaats']} voor vloeren (laminaat), meubels, trapbekleding en raamdecoratie. "
        . 'Al 20 jaar experts in wonen, alles onder één dak. Klanten kunnen laminaat online uitzoeken, het aantal pakken '
        . 'laten berekenen en een bestelaanvraag versturen; betaling en levering worden daarna persoonlijk afgestemd.', '',
        "- Adres: $adresRegel", '- Telefoon: 020-7526672',
        '- Openingstijden: ' . implode(', ', array_map(fn($o) => "{$o['naam']} {$o['open']}-{$o['dicht']}", $W['openingstijden'])),
        '- Instagram: https://www.instagram.com/ideaalmeubel/', "- Website: $BASE", '', '## Laminaat collectie', ''];
    foreach ($P as $p) $llms[] = "- [{$p['naam']} laminaat]({$BASE}laminaat/{$p['id']}.html): " . mb_strtolower($p['type']) . ", {$p['dikte']} mm, {$p['klasse']}"
        . ($p['water'] ? ', waterbestendig' : '') . ", {$p['formaat']}, {$eur($p['prijs'])} per m². {$p['tekst']}";
    array_push($llms, '', '## Kennisbank', '');
    foreach ($ARTS as $a) $llms[] = "- [{$a['titel']}]({$BASE}kennisbank/{$a['slug']}.html): {$a['kort']}";
    array_push($llms, '', '## Diensten', '', '- Vloeren leveren en leggen (laminaat in plank, visgraat en tegeldessin)',
        '- Trapbekleding en traprenovatie', '- Meubels', '- Raamdecoratie', '');
    $write('llms.txt', implode("\n", $llms));

    return count($P) . " productpagina's, " . count($ARTS) . ' artikelen, ' . count($urls) . " URL's in sitemap";
}

if (PHP_SAPI === 'cli' && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) echo bouw_site(), "\n";
