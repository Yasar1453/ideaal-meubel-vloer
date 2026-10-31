# Beheerportaal

Website: https://ideaal-meubel-vloer.netlify.app
Portaal: https://ideaal-meubel-vloer.netlify.app/beheer/

- **Bestellingen:** elke aanvraag van de website komt hier binnen. Zet de status op Nieuw, In behandeling of Afgerond.
- **Producten:** vloer toevoegen (foto, naam, beschrijving, prijs), bewerken of verwijderen. De website past zich direct aan: productpagina, collectie, sitemap en de info voor Google en AI.
- **Account:** wachtwoord wijzigen.

## Hoe het werkt

- Hosting: Netlify (project `ideaal-meubel-vloer`). Producten, foto's, bestellingen en het wachtwoord staan in Netlify Blobs, niet in GitHub.
- `netlify/functions/pagina.mjs` maakt de pagina's met de actuele producten (via `lib/bouw.mjs`) en het CDN bewaart ze tot er iets verandert.
- `data/winkel.json` is alleen de startversie. Zodra in het portaal iets is opgeslagen, is Netlify de bron.
- Nieuwe versie van de code online zetten: `netlify deploy --build --prod`. Producten en bestellingen blijven daarbij staan.
- Artikelen (content/kennisbank) wijzigen: bestand aanpassen en opnieuw deployen.

## Eigen domein

In Netlify: Domain management > Add a domain (bijv. ideaalmeubel.nl) en de DNS bij de registrar naar Netlify laten wijzen. Canonical-links en sitemap nemen het nieuwe domein automatisch over. Pas daarna `website` in `data/winkel.json` aan (voor de statische kopie).

## Nog niet

- Geen e-mailmelding bij een nieuwe bestelling: kijk in het portaal (de teller bij Bestellingen toont nieuwe aanvragen).
