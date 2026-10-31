# Beheerportaal

Adres: `<website>/beheer/` (bijv. https://www.ideaalmeubel.nl/beheer/).

- **Bestellingen:** elke aanvraag van de website komt hier binnen (en ook per e-mail). Zet de status op Nieuw, In behandeling of Afgerond.
- **Producten:** vloer toevoegen (foto, naam, beschrijving, prijs), bewerken of verwijderen. De website wordt direct bijgewerkt: productpagina, collectie, sitemap en de info voor Google en AI.

## Online zetten

Het portaal en het opslaan van bestellingen hebben **webhosting met PHP** nodig (8.0 of nieuwer, met GD voor foto's). GitHub Pages kan geen PHP draaien: daar werkt alleen de website, bestellingen gaan dan via de mail van de klant.

1. Upload alle bestanden naar de hosting.
2. Open direct daarna `/beheer/` en kies een wachtwoord. Wie als eerste het portaal opent, kiest het wachtwoord. Doe dit dus meteen.
3. Pas `website` in `data/winkel.json` aan naar het eigen domein en open het portaal; sla een product één keer op (of draai `php bouw.php`).
4. Pas `ONTVANGER` in `bestelling.php` aan naar het echte e-mailadres.

## Belangrijk

- Na de livegang is de **server de bron** van de producten. Overschrijf `data/winkel.json`, `js/data.js`, `laminaat/` en `img/laminaat/` dus niet met een oude kopie bij een volgende upload.
- Bestellingen en het wachtwoord staan in `prive/`. Die map wordt nooit naar GitHub gestuurd. Wachtwoord vergeten: verwijder `prive/account.php` via de hosting en kies een nieuw wachtwoord.
