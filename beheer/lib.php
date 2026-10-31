<?php
/* Gedeelde functies voor het beheerportaal en bestelling.php.
   Privégegevens (bestellingen, wachtwoord) staan in prive/*.php. Elk bestand begint met
   "<?php exit;" zodat de inhoud nooit via de browser te lezen is, ook niet als .htaccess genegeerd wordt. */

const SITE = __DIR__ . '/..';
const PRIVE = SITE . '/prive';
const KOP = "<?php exit; ?>\n";

function prive_lees(string $naam, $standaard = [])
{
    $f = PRIVE . "/$naam.php";
    if (!is_file($f)) return $standaard;
    $d = json_decode(substr((string)file_get_contents($f), strlen(KOP)), true);
    return $d ?? $standaard;
}

function prive_schrijf(string $naam, $data): void
{
    if (!is_dir(PRIVE)) mkdir(PRIVE, 0750, true);
    $tmp = PRIVE . "/$naam." . bin2hex(random_bytes(4)) . '.tmp';
    file_put_contents($tmp, KOP . json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));
    rename($tmp, PRIVE . "/$naam.php");
}

/* Lezen + aanpassen + schrijven onder één slot, zodat twee gelijktijdige bestellingen elkaar niet overschrijven. */
function prive_wijzig(string $naam, callable $fn, $standaard = [])
{
    if (!is_dir(PRIVE)) mkdir(PRIVE, 0750, true);
    $slot = fopen(PRIVE . "/$naam.lock", 'c');
    flock($slot, LOCK_EX);
    try {
        $data = $fn(prive_lees($naam, $standaard));
        prive_schrijf($naam, $data);
        return $data;
    } finally {
        flock($slot, LOCK_UN);
        fclose($slot);
    }
}

function winkel_lees(): array
{
    return json_decode(file_get_contents(SITE . '/data/winkel.json'), true);
}

function winkel_schrijf(array $w): void
{
    $tmp = SITE . '/data/winkel.' . bin2hex(random_bytes(4)) . '.tmp';
    file_put_contents($tmp, json_encode($w, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
    rename($tmp, SITE . '/data/winkel.json');
}

function eur($n): string
{
    return '€ ' . number_format((float)$n, 2, ',', '.');
}

function h($s): string
{
    return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
