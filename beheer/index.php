<?php
/* Beheerportaal Ideaal Meubel & Vloer: bestellingen bijhouden en producten toevoegen of verwijderen. */
require __DIR__ . '/lib.php';
require SITE . '/bouw.php';

header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');
header('Cache-Control: no-store');

$https = ($_SERVER['HTTPS'] ?? '') !== '' && $_SERVER['HTTPS'] !== 'off';
session_name('ideaal_beheer');
session_set_cookie_params(['lifetime' => 0, 'path' => dirname($_SERVER['SCRIPT_NAME']) . '/', 'httponly' => true, 'samesite' => 'Strict', 'secure' => $https]);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));

const TYPES = ['Plank', 'Visgraat', 'Tegeldessin'];
const TINTEN = ['Licht', 'Naturel', 'Grijs', 'Donker'];
const KLASSEN = ['AC3', 'AC4', 'AC5'];
const STATUS = ['nieuw' => 'Nieuw', 'bezig' => 'In behandeling', 'klaar' => 'Afgerond'];

function ga($url, $melding = null)
{
    if ($melding) $_SESSION['melding'] = $melding;
    header('Location: ' . $url, true, 303);
    exit;
}

function slug($s)
{
    $s = mb_strtolower($s, 'UTF-8');
    $s = strtr($s, ['à' => 'a', 'á' => 'a', 'â' => 'a', 'ä' => 'a', 'ã' => 'a', 'å' => 'a', 'ç' => 'c', 'è' => 'e', 'é' => 'e', 'ê' => 'e', 'ë' => 'e',
        'ì' => 'i', 'í' => 'i', 'î' => 'i', 'ï' => 'i', 'ñ' => 'n', 'ò' => 'o', 'ó' => 'o', 'ô' => 'o', 'ö' => 'o', 'õ' => 'o', 'ø' => 'o',
        'ù' => 'u', 'ú' => 'u', 'û' => 'u', 'ü' => 'u', 'ý' => 'y', 'ÿ' => 'y', 'ß' => 'ss', 'ğ' => 'g', 'ş' => 's', 'ı' => 'i', '&' => 'en']);
    return trim(preg_replace('/[^a-z0-9]+/', '-', $s), '-') ?: 'vloer';
}

/* Maakt van een geüploade foto een vierkante jpg van 800 × 800 (zoals de andere vloeren). */
function bewaar_foto(array $f, string $id): ?string
{
    if (($f['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) return null;
    if ($f['error'] !== UPLOAD_ERR_OK) return 'De foto is te groot of kwam niet goed door. Probeer een kleinere foto.';
    $info = @getimagesize($f['tmp_name']);
    if (!$info || !in_array($info[2], [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_WEBP], true)) return 'Kies een foto in JPG, PNG of WEBP.';
    $doel = SITE . "/img/laminaat/$id.jpg";
    if (!function_exists('imagecreatefromstring')) {
        if ($info[2] !== IMAGETYPE_JPEG) return 'Kies een JPG-foto.';
        return move_uploaded_file($f['tmp_name'], $doel) ? null : 'De foto kon niet worden opgeslagen.';
    }
    $src = @imagecreatefromstring(file_get_contents($f['tmp_name']));
    if (!$src) return 'Deze foto kan niet worden gelezen.';
    $w = imagesx($src); $hgt = imagesy($src); $z = min($w, $hgt);
    $dst = imagecreatetruecolor(800, 800);
    imagecopyresampled($dst, $src, 0, 0, (int)(($w - $z) / 2), (int)(($hgt - $z) / 2), 800, 800, $z, $z);
    $ok = imagejpeg($dst, $doel, 84);
    imagedestroy($src); imagedestroy($dst);
    return $ok ? null : 'De foto kon niet worden opgeslagen.';
}

function bouw_veilig(): string
{
    try { bouw_site(); return ''; }
    catch (Throwable $e) { error_log('bouw.php: ' . $e->getMessage()); return ' Let op: de website kon niet worden bijgewerkt (' . $e->getMessage() . ').'; }
}

$account = prive_lees('account', null);
$p = $_GET['p'] ?? 'bestellingen';
$fout = '';

/* ---------- Acties (POST) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!hash_equals($_SESSION['csrf'], $_POST['csrf'] ?? '')) ga('./', 'Sessie verlopen. Probeer het opnieuw.');
    $actie = $_POST['actie'] ?? '';

    if ($actie === 'instellen' && !$account) {
        $w1 = $_POST['wachtwoord'] ?? ''; $w2 = $_POST['wachtwoord2'] ?? '';
        if (mb_strlen($w1) < 8) $fout = 'Kies een wachtwoord van minstens 8 tekens.';
        elseif ($w1 !== $w2) $fout = 'De twee wachtwoorden zijn niet hetzelfde.';
        else {
            prive_schrijf('account', ['hash' => password_hash($w1, PASSWORD_DEFAULT)]);
            session_regenerate_id(true);
            $_SESSION['in'] = true;
            ga('./', 'Wachtwoord ingesteld. Welkom in het beheerportaal.');
        }
    } elseif ($actie === 'inloggen' && $account) {
        $pogingen = prive_lees('inlog', ['n' => 0, 't' => 0]);
        if ($pogingen['n'] >= 5 && $pogingen['t'] > time() - 900) $fout = 'Te vaak een verkeerd wachtwoord. Probeer het over 15 minuten opnieuw.';
        elseif (password_verify($_POST['wachtwoord'] ?? '', $account['hash'])) {
            prive_schrijf('inlog', ['n' => 0, 't' => 0]);
            session_regenerate_id(true);
            $_SESSION['in'] = true;
            ga('./');
        } else {
            sleep(1);
            prive_schrijf('inlog', ['n' => ($pogingen['t'] > time() - 900 ? $pogingen['n'] : 0) + 1, 't' => time()]);
            $fout = 'Wachtwoord klopt niet.';
        }
    } elseif (!empty($_SESSION['in'])) {
        if ($actie === 'uitloggen') { $_SESSION = []; session_destroy(); ga('./'); }

        if ($actie === 'status') {
            $id = $_POST['id'] ?? ''; $st = $_POST['status'] ?? '';
            if (isset(STATUS[$st])) prive_wijzig('bestellingen', fn($l) => array_map(fn($b) => $b['id'] === $id ? ['status' => $st] + $b : $b, $l));
            ga('./?p=bestellingen&f=' . urlencode($_POST['f'] ?? 'open') . '#b-' . $id, 'Status aangepast.');
        }
        if ($actie === 'bestelling-weg') {
            $id = $_POST['id'] ?? '';
            prive_wijzig('bestellingen', fn($l) => array_values(array_filter($l, fn($b) => $b['id'] !== $id)));
            ga('./?p=bestellingen&f=' . urlencode($_POST['f'] ?? 'open'), 'Bestelling verwijderd.');
        }
        if ($actie === 'product-weg') {
            $id = $_POST['id'] ?? '';
            $w = winkel_lees();
            $naam = '';
            $w['laminaat'] = array_values(array_filter($w['laminaat'], function ($x) use ($id, &$naam) { if ($x['id'] === $id) $naam = $x['naam']; return $x['id'] !== $id; }));
            if ($naam !== '') {
                winkel_schrijf($w);
                if (preg_match('/^[a-z0-9-]+$/', $id)) @unlink(SITE . "/img/laminaat/$id.jpg");
            }
            ga('./?p=producten', ($naam !== '' ? "$naam is verwijderd van de website." : 'Product niet gevonden.') . bouw_veilig());
        }
        if ($actie === 'product-opslaan') {
            $w = winkel_lees();
            $oudId = $_POST['id'] ?? '';
            $bestaand = null;
            foreach ($w['laminaat'] as $x) if ($x['id'] === $oudId) $bestaand = $x;
            $getal = fn($k) => (float)str_replace(',', '.', trim($_POST[$k] ?? ''));
            $tekst = fn($k, $max) => mb_substr(trim(preg_replace('/\s+/u', ' ', $_POST[$k] ?? '')), 0, $max);
            $prod = [
                'id' => $oudId,
                'naam' => $tekst('naam', 60),
                'lijn' => $tekst('lijn', 30) ?: 'Classic',
                'type' => in_array($_POST['type'] ?? '', TYPES, true) ? $_POST['type'] : 'Plank',
                'tint' => in_array($_POST['tint'] ?? '', TINTEN, true) ? $_POST['tint'] : 'Naturel',
                'dikte' => (int)$getal('dikte'),
                'klasse' => in_array($_POST['klasse'] ?? '', KLASSEN, true) ? $_POST['klasse'] : 'AC4',
                'formaat' => $tekst('formaat', 40),
                'pak' => round($getal('pak'), 2),
                'prijs' => round($getal('prijs'), 2),
                'water' => !empty($_POST['water']),
                'tekst' => $tekst('tekst', 600),
            ];
            if ($prod['naam'] === '') $fout = 'Vul een naam in.';
            elseif ($prod['tekst'] === '') $fout = 'Vul een beschrijving in.';
            elseif ($prod['prijs'] <= 0 || $prod['prijs'] > 1000) $fout = 'Vul een geldige prijs per m² in.';
            elseif ($prod['pak'] <= 0 || $prod['pak'] > 20) $fout = 'Vul in hoeveel m² er in een pak zit.';
            elseif ($prod['dikte'] < 4 || $prod['dikte'] > 20) $fout = 'Vul een dikte in millimeters in (bijv. 8).';
            elseif (!$bestaand && ($_FILES['foto']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) $fout = 'Kies een foto van de vloer.';
            if ($prod['formaat'] === '') $prod['formaat'] = '-';

            if (!$fout) {
                if (!$bestaand) { // nieuw: unieke id op basis van de naam
                    $ids = array_column($w['laminaat'], 'id');
                    $basis = slug($prod['naam']); $id = $basis; $i = 2;
                    while (in_array($id, $ids, true)) $id = $basis . '-' . $i++;
                    $prod['id'] = $id;
                }
                $fotoFout = bewaar_foto($_FILES['foto'] ?? [], $prod['id']);
                if ($fotoFout) $fout = $fotoFout;
            }
            if (!$fout) {
                if ($bestaand) $w['laminaat'] = array_map(fn($x) => $x['id'] === $oudId ? $prod : $x, $w['laminaat']);
                else $w['laminaat'][] = $prod;
                winkel_schrijf($w);
                ga('./?p=producten', "{$prod['naam']} is opgeslagen en staat op de website." . bouw_veilig());
            }
            $p = 'product';
            $formProduct = $prod; // ingevulde waarden terugzetten
        }
    }
}

$ingelogd = !empty($_SESSION['in']) && $account;
$melding = $_SESSION['melding'] ?? '';
unset($_SESSION['melding']);
$csrf = '<input type="hidden" name="csrf" value="' . h($_SESSION['csrf']) . '">';

/* ---------- Weergave ---------- */
$W = winkel_lees();
$bestellingen = $ingelogd ? prive_lees('bestellingen', []) : [];
$aantalNieuw = count(array_filter($bestellingen, fn($b) => $b['status'] === 'nieuw'));
?>
<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Beheer | Ideaal Meubel &amp; Vloer</title>
<link rel="icon" href="../img/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="beheer.css?v=1">
</head>
<body>
<?php if (!$ingelogd): ?>
<main class="login">
  <img src="../img/logo.svg" alt="" width="56" height="56">
  <h1>Beheerportaal</h1>
  <?php if (!$account): ?>
    <p>Welkom. Kies eerst een wachtwoord. Daarmee logt u voortaan in.</p>
    <form method="post">
      <?= $csrf ?><input type="hidden" name="actie" value="instellen">
      <label>Nieuw wachtwoord <input type="password" name="wachtwoord" autocomplete="new-password" minlength="8" required autofocus></label>
      <label>Herhaal wachtwoord <input type="password" name="wachtwoord2" autocomplete="new-password" minlength="8" required></label>
      <?php if ($fout): ?><p class="fout" role="alert"><?= h($fout) ?></p><?php endif ?>
      <button class="knop">Wachtwoord opslaan</button>
    </form>
  <?php else: ?>
    <form method="post">
      <?= $csrf ?><input type="hidden" name="actie" value="inloggen">
      <label>Wachtwoord <input type="password" name="wachtwoord" autocomplete="current-password" required autofocus></label>
      <?php if ($fout): ?><p class="fout" role="alert"><?= h($fout) ?></p><?php endif ?>
      <?php if ($melding): ?><p class="fout" role="alert"><?= h($melding) ?></p><?php endif ?>
      <button class="knop">Inloggen</button>
    </form>
  <?php endif ?>
  <a class="terug" href="../index.html">Naar de website</a>
</main>
<?php else: ?>
<header class="balk">
  <div class="balk-in">
    <a class="merk" href="./"><img src="../img/logo-licht.svg" alt="" width="34" height="34"><span>Beheer</span></a>
    <nav>
      <a href="./?p=bestellingen" class="<?= $p === 'bestellingen' ? 'actief' : '' ?>">Bestellingen<?php if ($aantalNieuw): ?> <b class="teller"><?= $aantalNieuw ?></b><?php endif ?></a>
      <a href="./?p=producten" class="<?= in_array($p, ['producten', 'product'], true) ? 'actief' : '' ?>">Producten</a>
    </nav>
    <div class="balk-rechts">
      <a href="../index.html" target="_blank" rel="noopener">Website</a>
      <form method="post"><?= $csrf ?><input type="hidden" name="actie" value="uitloggen"><button class="link">Uitloggen</button></form>
    </div>
  </div>
</header>
<main class="inhoud">
<?php if ($melding): ?><p class="melding" role="status"><?= h($melding) ?></p><?php endif ?>

<?php if ($p === 'bestellingen'):
    $f = $_GET['f'] ?? 'open';
    $filters = ['open' => 'Open', 'klaar' => 'Afgerond', 'alle' => 'Alle'];
    if (!isset($filters[$f])) $f = 'open';
    $lijst = array_filter($bestellingen, fn($b) => $f === 'alle' || ($f === 'klaar' ? $b['status'] === 'klaar' : $b['status'] !== 'klaar'));
?>
  <div class="kop"><h1>Bestellingen</h1></div>
  <div class="tabs">
    <?php foreach ($filters as $k => $t): $n = count(array_filter($bestellingen, fn($b) => $k === 'alle' || ($k === 'klaar' ? $b['status'] === 'klaar' : $b['status'] !== 'klaar'))); ?>
      <a href="./?p=bestellingen&f=<?= $k ?>" class="<?= $f === $k ? 'actief' : '' ?>"><?= $t ?> <span><?= $n ?></span></a>
    <?php endforeach ?>
  </div>
  <?php if (!$lijst): ?>
    <div class="leeg"><?= $f === 'open' ? 'Geen open bestellingen. Nieuwe aanvragen van de website verschijnen hier vanzelf.' : 'Nog niets te tonen.' ?></div>
  <?php endif ?>
  <?php foreach ($lijst as $b): $d = strtotime($b['datum']); ?>
  <details class="bestelling st-<?= h($b['status']) ?>" id="b-<?= h($b['id']) ?>"<?= $b['status'] === 'nieuw' ? ' open' : '' ?>>
    <summary>
      <span class="b-naam"><?= h($b['naam']) ?></span>
      <span class="b-datum"><?= date('d-m-Y H:i', $d) ?></span>
      <span class="b-bedrag"><?= eur($b['totaal']) ?></span>
      <span class="pil"><?= h(STATUS[$b['status']] ?? $b['status']) ?></span>
    </summary>
    <div class="b-body">
      <div class="b-kolommen">
        <div>
          <h3>Klant</h3>
          <p><?= h($b['naam']) ?><br><?= h($b['adres']) ?></p>
          <p><a href="tel:<?= h(preg_replace('/[^0-9+]/', '', $b['telefoon'])) ?>"><?= h($b['telefoon']) ?></a><br><a href="mailto:<?= h($b['email']) ?>"><?= h($b['email']) ?></a></p>
        </div>
        <div>
          <h3>Vloeren</h3>
          <?php if ($b['regels']): ?>
          <table><?php foreach ($b['regels'] as $r): ?><tr><td><?= h($r['naam']) ?></td><td><?= (int)$r['pakken'] ?> pak<?= $r['pakken'] == 1 ? '' : 'ken' ?> (<?= number_format($r['m2'], 2, ',', '') ?> m²)</td><td><?= eur($r['bedrag']) ?></td></tr><?php endforeach ?></table>
          <?php else: ?><p>Zie de volledige aanvraag hieronder.</p><?php endif ?>
          <?php
          // Belangrijkste keuzes uit de aanvraagtekst halen.
          $extra = [];
          foreach (explode("\n", $b['tekst']) as $regel)
              foreach (['Ondervloer', 'Plinten', 'Leggen door Ideaal', 'Levering', 'Opmerking'] as $k)
                  if (str_starts_with($regel, "$k: ")) $extra[$k === 'Leggen door Ideaal' ? 'Leggen' : $k] = substr($regel, strlen($k) + 2);
          if (($extra['Opmerking'] ?? '-') === '-') unset($extra['Opmerking']);
          if (str_starts_with($extra['Plinten'] ?? '0 m', '0 m')) unset($extra['Plinten']);
          if (str_starts_with($extra['Ondervloer'] ?? 'Geen', 'Geen')) unset($extra['Ondervloer']);
          ?>
          <?php if ($extra): ?><dl class="extra"><?php foreach ($extra as $k => $v): ?><dt><?= h($k) ?></dt><dd><?= h($v) ?></dd><?php endforeach ?></dl><?php endif ?>
        </div>
      </div>
      <details class="volledig"><summary>Volledige aanvraag</summary><pre><?= h($b['tekst']) ?></pre></details>
      <div class="b-acties">
        <form method="post" class="status-form">
          <?= $csrf ?><input type="hidden" name="actie" value="status"><input type="hidden" name="id" value="<?= h($b['id']) ?>"><input type="hidden" name="f" value="<?= h($f) ?>">
          <label for="s-<?= h($b['id']) ?>">Status</label>
          <select id="s-<?= h($b['id']) ?>" name="status"><?php foreach (STATUS as $k => $t): ?><option value="<?= $k ?>"<?= $b['status'] === $k ? ' selected' : '' ?>><?= $t ?></option><?php endforeach ?></select>
          <button class="knop klein">Opslaan</button>
        </form>
        <form method="post" data-bevestig="Bestelling van <?= h($b['naam']) ?> definitief verwijderen?">
          <?= $csrf ?><input type="hidden" name="actie" value="bestelling-weg"><input type="hidden" name="id" value="<?= h($b['id']) ?>"><input type="hidden" name="f" value="<?= h($f) ?>">
          <button class="link rood">Verwijderen</button>
        </form>
      </div>
    </div>
  </details>
  <?php endforeach ?>

<?php elseif ($p === 'producten'): ?>
  <div class="kop"><h1>Producten <small><?= count($W['laminaat']) ?></small></h1><a class="knop" href="./?p=product">+ Nieuw product</a></div>
  <ul class="producten">
    <?php foreach ($W['laminaat'] as $x): ?>
    <li>
      <img src="../img/laminaat/<?= h($x['id']) ?>.jpg?<?= @filemtime(SITE . "/img/laminaat/{$x['id']}.jpg") ?>" alt="" width="64" height="64" loading="lazy">
      <div class="pr-info"><strong><?= h($x['naam']) ?></strong><span><?= h($x['type']) ?> · <?= (int)$x['dikte'] ?> mm · <?= h($x['klasse']) ?></span></div>
      <div class="pr-prijs"><?= eur($x['prijs']) ?><span>per m²</span></div>
      <div class="pr-acties">
        <a class="knop klein licht" href="./?p=product&id=<?= urlencode($x['id']) ?>">Bewerken</a>
        <form method="post" data-bevestig="<?= h($x['naam']) ?> verwijderen van de website?">
          <?= $csrf ?><input type="hidden" name="actie" value="product-weg"><input type="hidden" name="id" value="<?= h($x['id']) ?>">
          <button class="link rood">Verwijderen</button>
        </form>
      </div>
    </li>
    <?php endforeach ?>
  </ul>

<?php elseif ($p === 'product'):
    $x = $formProduct ?? null;
    if (!$x) foreach ($W['laminaat'] as $y) if ($y['id'] === ($_GET['id'] ?? '')) $x = $y;
    $nieuw = !$x || $x['id'] === '';
    $x = ($x ?? []) + ['id' => '', 'naam' => '', 'lijn' => '', 'type' => 'Plank', 'tint' => 'Naturel', 'dikte' => 8, 'klasse' => 'AC4', 'formaat' => '', 'pak' => '', 'prijs' => '', 'water' => false, 'tekst' => ''];
    $getal = fn($n) => $n === '' ? '' : str_replace('.', ',', (string)$n);
?>
  <div class="kop"><h1><?= $nieuw ? 'Nieuw product' : 'Product bewerken' ?></h1><a class="link" href="./?p=producten">Terug naar producten</a></div>
  <?php if ($fout): ?><p class="fout" role="alert"><?= h($fout) ?></p><?php endif ?>
  <form method="post" enctype="multipart/form-data" class="product-form">
    <?= $csrf ?><input type="hidden" name="actie" value="product-opslaan"><input type="hidden" name="id" value="<?= h($x['id']) ?>">
    <div class="pf-grid">
      <div class="pf-foto">
        <label for="foto">Foto <?= $nieuw ? '' : '<small>(alleen kiezen om te vervangen)</small>' ?></label>
        <div class="foto-vak"><img id="foto-voorbeeld" src="<?= $nieuw ? '' : '../img/laminaat/' . h($x['id']) . '.jpg?' . @filemtime(SITE . "/img/laminaat/{$x['id']}.jpg") ?>" alt=""<?= $nieuw ? ' hidden' : '' ?>><span<?= $nieuw ? '' : ' hidden' ?>>Nog geen foto</span></div>
        <input type="file" id="foto" name="foto" accept="image/jpeg,image/png,image/webp"<?= $nieuw ? ' required' : '' ?>>
        <p class="hint">Een vierkante uitsnede wordt automatisch gemaakt.</p>
      </div>
      <div class="pf-velden">
        <label>Naam <input name="naam" value="<?= h($x['naam']) ?>" maxlength="60" required placeholder="bijv. Eiken Naturel"></label>
        <label>Beschrijving <textarea name="tekst" rows="4" maxlength="600" required placeholder="Korte beschrijving voor op de website"><?= h($x['tekst']) ?></textarea></label>
        <div class="rij">
          <label>Prijs per m² (€) <input name="prijs" value="<?= h($getal($x['prijs'])) ?>" inputmode="decimal" required placeholder="24,95"></label>
          <label>m² per pak <input name="pak" value="<?= h($getal($x['pak'])) ?>" inputmode="decimal" required placeholder="2,13"></label>
        </div>
        <div class="rij">
          <label>Soort <select name="type"><?php foreach (TYPES as $o): ?><option<?= $x['type'] === $o ? ' selected' : '' ?>><?= $o ?></option><?php endforeach ?></select></label>
          <label>Kleur <select name="tint"><?php foreach (TINTEN as $o): ?><option<?= $x['tint'] === $o ? ' selected' : '' ?>><?= $o ?></option><?php endforeach ?></select></label>
        </div>
        <div class="rij">
          <label>Dikte (mm) <input name="dikte" value="<?= h($x['dikte']) ?>" inputmode="numeric" required></label>
          <label>Slijtklasse <select name="klasse"><?php foreach (KLASSEN as $o): ?><option<?= $x['klasse'] === $o ? ' selected' : '' ?>><?= $o ?></option><?php endforeach ?></select></label>
        </div>
        <div class="rij">
          <label>Formaat plank <input name="formaat" value="<?= h($x['formaat'] === '-' ? '' : $x['formaat']) ?>" maxlength="40" placeholder="bijv. 1380 × 193 mm"></label>
          <label>Collectie <input name="lijn" value="<?= h($x['lijn']) ?>" maxlength="30" placeholder="bijv. Classic"></label>
        </div>
        <label class="vink"><input type="checkbox" name="water" value="1"<?= $x['water'] ? ' checked' : '' ?>> Waterbestendig</label>
        <div class="pf-acties"><button class="knop">Opslaan en op de website zetten</button><a class="link" href="./?p=producten">Annuleren</a></div>
      </div>
    </div>
  </form>
<?php endif ?>
</main>
<?php endif ?>
<script src="beheer.js?v=1"></script>
</body>
</html>
