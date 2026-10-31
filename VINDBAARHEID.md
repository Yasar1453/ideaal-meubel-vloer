# Vindbaarheid Ideaal Meubel & Vloer

Wat op de site al geregeld is en wat Ideaal zelf moet doen. Doel: gevonden worden in Google én genoemd worden door AI-assistenten (ChatGPT, Gemini, Claude, Perplexity) als iemand vraagt naar laminaat.

## Al geregeld op de site

- Elke vloer heeft een eigen pagina die zonder JavaScript leesbaar is (AI-crawlers lezen geen JavaScript).
- Kennisbank met artikelen die vragen direct beantwoorden, plus veelgestelde vragen.
- Gestructureerde data: bedrijf, product met prijs per m², artikel, FAQ en kruimelpad.
- `sitemap.xml`, `robots.txt` (AI-crawlers expliciet toegestaan) en `llms.txt` (samenvatting voor AI).
- Producten wijzigen gaat via het beheerportaal (`/beheer/`); de pagina's worden dan vanzelf opnieuw gemaakt. Na een wijziging in artikelen: `php bouw.php` draaien.

## Nodig van Ideaal (belangrijkste eerst)

1. **Eigen domein.** ideaalmeubel.nl wijst nu naar een Shopify-winkel die niet actief is ("Store unavailable"). Na de verhuizing `website` in `data/winkel.json` aanpassen en `php bouw.php` draaien.
2. ~~Adres en openingstijden~~ Gedaan: Jan Evertsenstraat 10H, 1056 EC Amsterdam, tijden van Google Maps (31-10-2026). Staan op de site en in de gegevens voor Google en AI.
3. **Echte prijzen, producten en e-mailadres** (nu voorbeeldwaarden; aanpassen in het beheerportaal). Let op: ideaalmeubel.nl heeft geen mailserver, dus info@ideaalmeubel.nl werkt nu niet.

## Backlinks en vermeldingen (door Ideaal zelf aan te maken)

AI-assistenten en Google vertrouwen een bedrijf meer als dezelfde naam, hetzelfde adres en hetzelfde telefoonnummer op veel plekken staan. Gebruik overal exact: **Ideaal Meubel & Vloer**, **Jan Evertsenstraat 10H, 1056 EC Amsterdam** en **020-7526672**, met link naar de website.

| Plek | Waarom | Prioriteit |
|---|---|---|
| Google Bedrijfsprofiel | Kaarten, lokale zoekresultaten, reviews; Gemini en Google AI-overzichten gebruiken dit | Hoogste |
| Bing Places | ChatGPT en Copilot zoeken via Bing | Hoogste |
| Apple Bedrijfsgegevens (Apple Business Connect) | Apple Kaarten en Siri | Hoog |
| Instagram-bio | Link naar de website toevoegen | Hoog |
| Facebook-bedrijfspagina | Extra vermelding met dezelfde gegevens | Middel |
| Trustoo, Werkspot, Homedeal | Vergelijkingssites voor vloerenleggers, met reviews | Middel |
| Telefoonboek.nl, Openingstijden.com, Cylex | Bedrijvengidsen | Middel |
| Leveranciers / merken | Veel vloerenmerken hebben een "dealer zoeken"-pagina; vraag om vermelding met link | Hoog |
| Lokale media of wijkblad | Een artikel over 20 jaar in het vak | Laag, wel sterk |

## Reviews

Vraag elke tevreden klant om een Google-review (het Bedrijfsprofiel geeft een directe link). Reviews met woorden als "laminaat", "visgraat" of "traprenovatie" helpen extra. Op Instagram staan al reviewvideo's; die kunnen ook op de site.

## Inhoud die nog meer oplevert

- Projectpagina's met eigen foto's (voor/na, wijk, type vloer). Echte foto's scoren beter dan stockfoto's.
- Artikelen over meubels, trapbekleding en raamdecoratie (nu alleen vloeren).
- De Instagram-video's insluiten bij passende artikelen.
