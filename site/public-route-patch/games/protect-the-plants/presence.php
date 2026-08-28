<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

const BURN_BUDS_PRESENCE_TTL = 30;
const BURN_BUDS_ONLINE_WINDOW_MS = 15000;

function presence_out(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function presence_fail(string $message, int $status = 400): void
{
    presence_out(['error' => $message], $status);
}

function presence_now_ms(): int
{
    return (int) round(microtime(true) * 1000);
}

$root = dirname(__DIR__, 2) . '/wp-load.php';
$useWp = is_file($root);
if ($useWp) {
    require_once $root;
}

function presence_store_get(string $key)
{
    global $useWp;
    if ($useWp) {
        return get_transient($key);
    }
    $path = sys_get_temp_dir() . '/' . $key . '.json';
    if (!is_file($path)) {
        return false;
    }
    $data = json_decode(file_get_contents($path), true);
    if (!is_array($data) || ($data['_expires'] ?? 0) < time()) {
        @unlink($path);
        return false;
    }
    unset($data['_expires']);
    return $data;
}

function presence_store_set(string $key, array $value, int $ttl): void
{
    global $useWp;
    if ($useWp) {
        set_transient($key, $value, $ttl);
        return;
    }
    $value['_expires'] = time() + $ttl;
    file_put_contents(sys_get_temp_dir() . '/' . $key . '.json', json_encode($value), LOCK_EX);
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    presence_fail('Unsupported request.', 405);
}

$code = strtoupper(trim($_GET['code'] ?? ''));
$playerId = $_SERVER['HTTP_X_PLAYER_ID'] ?? '';
$token = $_SERVER['HTTP_X_PLAYER_TOKEN'] ?? '';

if (!preg_match('/^[A-Z0-9]{6}$/', $code) || $playerId === '' || $token === '') {
    presence_fail('Player session required.', 401);
}

$playerRecord = presence_store_get('ptp_player_' . $playerId);
if (!$playerRecord || !hash_equals(strval($playerRecord['token'] ?? ''), $token) || ($playerRecord['code'] ?? '') !== $code) {
    presence_fail('Invalid player session.', 401);
}

$room = presence_store_get('ptp_room_' . $code);
if (!$room || !is_array($room['players'] ?? null)) {
    presence_fail('Room not found or expired.', 404);
}

$meIndex = null;
foreach ($room['players'] as $i => $player) {
    if (($player['id'] ?? '') === $playerId) {
        $meIndex = $i;
        break;
    }
}
if ($meIndex === null) {
    presence_fail('Invalid player session.', 401);
}

$now = presence_now_ms();
presence_store_set('ptp_presence_' . $playerId, ['seenAt' => $now], BURN_BUDS_PRESENCE_TTL);

$opponentIndex = $meIndex === 0 ? 1 : 0;
$opponent = $room['players'][$opponentIndex] ?? null;
$opponentSeenAt = null;
$opponentOnline = false;

if ($opponent) {
    $opponentPresence = presence_store_get('ptp_presence_' . $opponent['id']);
    if (is_array($opponentPresence)) {
        $opponentSeenAt = intval($opponentPresence['seenAt'] ?? 0) ?: null;
        $opponentOnline = $opponentSeenAt !== null && ($now - $opponentSeenAt) <= BURN_BUDS_ONLINE_WINDOW_MS;
    }
}

presence_out([
    'serverTime' => $now,
    'opponent' => $opponent ? [
        'id' => $opponent['id'],
        'name' => $opponent['name'],
        'online' => $opponentOnline,
        'lastSeenAt' => $opponentSeenAt,
    ] : null,
]);