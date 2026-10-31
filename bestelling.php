<?php
// Verstuurt een bestelaanvraag per e-mail. Werkt op gewone webhosting met PHP mail().
// ⚠️ Pas het ontvangstadres aan naar het echte adres van Ideaal.
const ONTVANGER = 'info@ideaalmeubel.nl';

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

// Geen regeleinden of stuurtekens in naam/e-mail: voorkomt header-injectie.
$naam = trim(preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $str('naam')) ?? '');
$email = trim($str('email'));
$tekst = trim(str_replace("\r\n", "\n", $str('tekst')));

if ($naam === '' || mb_strlen($naam) > 100) stop(400);
if (preg_match('/[\r\n]/', $email) || strlen($email) > 254 || !filter_var($email, FILTER_VALIDATE_EMAIL)) stop(400);
if ($tekst === '' || strlen($tekst) > 8000 || !mb_check_encoding($tekst, 'UTF-8') || !mb_check_encoding($naam, 'UTF-8')) stop(400);

$onderwerp = '=?UTF-8?B?' . base64_encode('Bestelaanvraag laminaat - ' . $naam) . '?=';
$headers = "MIME-Version: 1.0\r\n"
  . "Content-Type: text/plain; charset=UTF-8\r\n"
  . "Content-Transfer-Encoding: 8bit\r\n"
  . "Reply-To: $email\r\n";
$ok = mail(ONTVANGER, $onderwerp, $tekst, $headers);
if (!$ok) http_response_code(500);
echo json_encode(['ok' => $ok]);
