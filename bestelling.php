<?php
// Verstuurt een bestelaanvraag per e-mail. Werkt op gewone webhosting met PHP mail().
// ⚠️ Pas het ontvangstadres aan naar het echte adres van Ideaal.
const ONTVANGER = 'info@ideaalmeubel.nl';

header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo '{"ok":false}'; exit; }
$data = json_decode(file_get_contents('php://input'), true);
$naam = trim(preg_replace('/[\r\n]+/', ' ', $data['naam'] ?? ''));
$email = filter_var($data['email'] ?? '', FILTER_VALIDATE_EMAIL);
$tekst = trim($data['tekst'] ?? '');
if ($naam === '' || !$email || $tekst === '' || strlen($tekst) > 8000) { http_response_code(400); echo '{"ok":false}'; exit; }

$onderwerp = '=?UTF-8?B?' . base64_encode('Bestelaanvraag laminaat - ' . $naam) . '?=';
$headers = "Content-Type: text/plain; charset=UTF-8\r\nReply-To: $email\r\n";
$ok = mail(ONTVANGER, $onderwerp, $tekst, $headers);
echo json_encode(['ok' => $ok]);
