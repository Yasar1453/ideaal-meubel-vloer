<?php
// Slaat een bestelaanvraag op (zichtbaar in het beheerportaal) en stuurt hem ook per e-mail.
// ⚠️ Pas het ontvangstadres aan naar het echte adres van Ideaal.
const ONTVANGER = 'info@ideaalmeubel.nl';

require __DIR__ . '/beheer/lib.php';

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function stop($code) { http_response_code($code); echo '{"ok":false}'; exit; }

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Allow: POST'); stop(405); }

// Alleen aanvragen vanaf de eigen site (als de browser een Origin meestuurt).
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '' && parse_url($origin, PHP_URL_HOST) !== parse_url('//' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) stop(403);

$body = file_get_contents('php://input', false, null, 0, 20000);
$data = json_decode($body, true);
if (!is_array($data)) stop(400);

$str = function ($k) use ($data) { return isset($data[$k]) && is_string($data[$k]) ? $data[$k] : ''; };
$regel = fn($k, $max) => mb_substr(trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $str($k)) ?? ''), 0, $max);

// Geen regeleinden of stuurtekens in naam/e-mail: voorkomt header-injectie.
$naam = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $str('naam')) ?? '');
$email = trim($str('email'));
$tekst = trim(str_replace("\r\n", "\n", $str('tekst')));

if ($naam === '' || mb_strlen($naam) > 100) stop(400);
if (preg_match('/[\r\n]/', $email) || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) stop(400);
if ($tekst === '' || strlen($tekst) > 8000 || !mb_check_encoding($tekst, 'UTF-8') || !mb_check_encoding($naam, 'UTF-8')) stop(400);

// Maximaal 10 aanvragen per uur per bezoeker (tegen spam).
$ip = hash('sha256', $_SERVER['REMOTE_ADDR'] ?? '');
$teVeel = false;
prive_wijzig('limiet', function ($l) use ($ip, &$teVeel) {
    $nu = time();
    $l = array_filter($l, fn($t) => max($t) > $nu - 3600);
    $l[$ip] = array_values(array_filter($l[$ip] ?? [], fn($t) => $t > $nu - 3600));
    if (count($l[$ip]) >= 10) { $teVeel = true; return $l; }
    $l[$ip][] = $nu;
    return $l;
});
if ($teVeel) stop(429);

// Regels opnieuw opbouwen met de prijzen van de server.
$producten = array_column(winkel_lees()['laminaat'], null, 'id');
$regels = [];
foreach (array_slice(is_array($data['regels'] ?? null) ? $data['regels'] : [], 0, 50) as $r) {
    $p = $producten[$r['id'] ?? ''] ?? null;
    $n = (int)($r['pakken'] ?? 0);
    if (!$p || $n < 1 || $n > 999) continue;
    $regels[] = ['id' => $p['id'], 'naam' => $p['naam'], 'pakken' => $n, 'm2' => round($n * $p['pak'], 2), 'bedrag' => round($n * $p['pak'] * $p['prijs'], 2)];
}

$bestelling = [
    'id' => date('ymd-His') . '-' . bin2hex(random_bytes(2)),
    'datum' => date('c'),
    'status' => 'nieuw',
    'naam' => $naam,
    'email' => $email,
    'telefoon' => $regel('telefoon', 40),
    'adres' => $regel('adres', 200),
    'regels' => $regels,
    'totaal' => min(1000000, max(0, (float)($data['totaal'] ?? 0))),
    'tekst' => $tekst,
];
$opgeslagen = false;
try {
    prive_wijzig('bestellingen', function ($lijst) use ($bestelling) { array_unshift($lijst, $bestelling); return $lijst; });
    $opgeslagen = true;
} catch (Throwable $e) {
    error_log('Bestelling niet opgeslagen: ' . $e->getMessage());
}

$onderwerp = '=?UTF-8?B?' . base64_encode('Bestelaanvraag laminaat - ' . $naam) . '?=';
$headers = "MIME-Version: 1.0\r\n"
  . "Content-Type: text/plain; charset=UTF-8\r\n"
  . "Content-Transfer-Encoding: 8bit\r\n"
  . "Reply-To: $email\r\n";
$gemaild = @mail(ONTVANGER, $onderwerp, $tekst . "\n\nBekijk alle bestellingen in het beheerportaal: /beheer/", $headers);

$ok = $opgeslagen || $gemaild;
if (!$ok) http_response_code(500);
echo json_encode(['ok' => $ok]);
