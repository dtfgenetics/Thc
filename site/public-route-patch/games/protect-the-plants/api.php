<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

const PTP_TTL = 10800;
const PTP_GRID = 15;
const PTP_MAX_BODY = 16384;
const PTP_MAX_EVENTS = 80;
const PTP_FORMATIONS = [
    ['id' => 'mother-row', 'name' => 'Mother Row', 'size' => 5],
    ['id' => 'trellis-row', 'name' => 'Trellis Row', 'size' => 4],
    ['id' => 'tall-pheno', 'name' => 'Tall Pheno', 'size' => 3],
    ['id' => 'bushy-pheno', 'name' => 'Bushy Pheno', 'size' => 3],
    ['id' => 'solo-pots', 'name' => 'Solo Pots', 'size' => 2],
];

function out(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $status = 400): void
{
    out(['error' => $message], $status);
}

function body(): array
{
    $raw = file_get_contents('php://input') ?: '{}';
    if (strlen($raw) > PTP_MAX_BODY) {
        fail('Request body is too large.', 413);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail('Invalid JSON body.');
    }
    return $data;
}

function cut_text(string $value, int $limit): string
{
    return function_exists('mb_substr') ? mb_substr($value, 0, $limit) : substr($value, 0, $limit);
}

function clean_name($value): string
{
    $v = trim(preg_replace('/[\x00-\x1F\x7F]/u', '', strval($value)));
    if ($v === '') {
        fail('Player name is required.');
    }
    return cut_text($v, 24);
}

function clean_text($value): string
{
    $v = trim(preg_replace('/[\x00-\x1F\x7F]/u', ' ', strval($value)));
    return cut_text($v, 280);
}

function rid(int $bytes = 12): string
{
    return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '=');
}

function room_code(): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $s = '';
    for ($i = 0; $i < 6; $i++) {
        $s .= $alphabet[random_int(0, strlen($alphabet) - 1)];
    }
    return $s;
}

function now_ms(): int
{
    return (int) round(microtime(true) * 1000);
}

$root = dirname(__DIR__, 2) . '/wp-load.php';
$useWp = is_file($root);
if ($useWp) {
    require_once $root;
}

function store_get(string $key)
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

function store_set(string $key, array $value, int $ttl = PTP_TTL): void
{
    global $useWp;
    if ($useWp) {
        set_transient($key, $value, $ttl);
        return;
    }
    $value['_expires'] = time() + $ttl;
    file_put_contents(sys_get_temp_dir() . '/' . $key . '.json', json_encode($value), LOCK_EX);
}

function room_get(string $code): array
{
    $room = store_get('ptp_room_' . $code);
    if (!$room) {
        fail('Room not found or expired.', 404);
    }
    $room['events'] = is_array($room['events'] ?? null) ? $room['events'] : [];
    $room['round'] = max(1, intval($room['round'] ?? 1));
    $room['rematchVotes'] = is_array($room['rematchVotes'] ?? null) ? $room['rematchVotes'] : [];
    return $room;
}

function room_save(array $room): void
{
    $room['updatedAt'] = now_ms();
    store_set('ptp_room_' . $room['code'], $room);
    foreach ($room['players'] as $p) {
        store_set('ptp_player_' . $p['id'], ['code' => $room['code'], 'token' => $p['token']], PTP_TTL);
    }
}

function auth(): array
{
    $code = strtoupper(trim($_GET['code'] ?? ''));
    if (!preg_match('/^[A-Z0-9]{6}$/', $code)) {
        fail('Room code required.', 401);
    }
    $pid = $_SERVER['HTTP_X_PLAYER_ID'] ?? '';
    $token = $_SERVER['HTTP_X_PLAYER_TOKEN'] ?? '';
    if (!$pid || !$token) {
        fail('Player session required.', 401);
    }
    $room = room_get($code);
    foreach ($room['players'] as $i => $p) {
        if (hash_equals($p['id'], $pid) && hash_equals($p['token'], $token)) {
            return [$room, $i];
        }
    }
    fail('Invalid player session.', 401);
}

function player_public(array $p, bool $revealFleet = true): array
{
    return [
        'id' => $p['id'],
        'name' => $p['name'],
        'ready' => $p['ready'],
        'fleet' => $revealFleet ? $p['fleet'] : [],
        'shots' => $p['shots'],
        'shotsReceived' => $p['shotsReceived'],
        'stats' => [
            'shots' => count($p['shots']),
            'hits' => count(array_filter($p['shots'], fn($s) => !empty($s['hit']))),
        ],
    ];
}

function formation_lost(array $target, string $formationId): bool
{
    $cells = [];
    foreach ($target['fleet'] as $f) {
        if ($f['id'] === $formationId) {
            $cells = $f['cells'];
            break;
        }
    }
    foreach ($cells as $c) {
        $hit = false;
        foreach ($target['shotsReceived'] as $s) {
            if ($s['row'] === $c['row'] && $s['col'] === $c['col'] && !empty($s['hit'])) {
                $hit = true;
                break;
            }
        }
        if (!$hit) {
            return false;
        }
    }
    return count($cells) > 0;
}

function opponent_public(array $p, bool $finished): array
{
    $base = player_public($p, false);
    $base['fleet'] = $finished
        ? $p['fleet']
        : array_values(array_filter($p['fleet'], fn($f) => formation_lost($p, $f['id'])));
    return $base;
}

function rematch_public(array $room, int $meIndex): array
{
    $meId = $room['players'][$meIndex]['id'];
    $oppIndex = $meIndex === 0 ? 1 : 0;
    $oppId = $room['players'][$oppIndex]['id'] ?? '';
    return [
        'meRequested' => in_array($meId, $room['rematchVotes'], true),
        'opponentRequested' => $oppId !== '' && in_array($oppId, $room['rematchVotes'], true),
    ];
}

function public_state(array $room, int $meIndex): array
{
    $oppIndex = $meIndex === 0 ? 1 : 0;
    $me = $room['players'][$meIndex];
    $opp = $room['players'][$oppIndex] ?? null;
    return [
        'code' => $room['code'],
        'status' => $room['status'],
        'turnPlayerId' => $room['turnPlayerId'],
        'winnerId' => $room['winnerId'],
        'updatedAt' => $room['updatedAt'],
        'round' => $room['round'],
        'rematch' => rematch_public($room, $meIndex),
        'events' => array_values(array_slice($room['events'], -PTP_MAX_EVENTS)),
        'me' => player_public($me, true),
        'opponent' => $opp ? opponent_public($opp, $room['status'] === 'finished') : null,
        'chat' => $room['chat'],
        'lastEvent' => $room['lastEvent'],
    ];
}

function cell_key(int $r, int $c): string
{
    return $r . ':' . $c;
}

function validate_fleet($fleet): array
{
    if (!is_array($fleet) || count($fleet) !== count(PTP_FORMATIONS)) {
        fail('All plant formations are required.');
    }
    $specs = [];
    foreach (PTP_FORMATIONS as $s) {
        $specs[$s['id']] = $s;
    }
    $seen = [];
    $used = [];
    $normalized = [];
    foreach ($fleet as $f) {
        $id = $f['id'] ?? '';
        if (!isset($specs[$id]) || isset($seen[$id])) {
            fail('Invalid plant formation.');
        }
        $seen[$id] = true;
        $cells = $f['cells'] ?? [];
        if (!is_array($cells) || count($cells) !== $specs[$id]['size']) {
            fail('Formation has wrong size.');
        }
        $norm = [];
        foreach ($cells as $c) {
            $r = intval($c['row'] ?? -1);
            $col = intval($c['col'] ?? -1);
            if ($r < 0 || $col < 0 || $r >= PTP_GRID || $col >= PTP_GRID) {
                fail('Formation is outside the garden.');
            }
            $key = cell_key($r, $col);
            if (isset($used[$key])) {
                fail('Plant formations cannot overlap.');
            }
            $used[$key] = true;
            $norm[] = ['row' => $r, 'col' => $col];
        }
        $rows = array_column($norm, 'row');
        $cols = array_column($norm, 'col');
        $horizontal = count(array_unique($rows)) === 1;
        $vertical = count(array_unique($cols)) === 1;
        if (!$horizontal && !$vertical) {
            fail('Formations must be straight.');
        }
        sort($rows);
        sort($cols);
        $vals = $horizontal ? $cols : $rows;
        for ($i = 1; $i < count($vals); $i++) {
            if ($vals[$i] !== $vals[$i - 1] + 1) {
                fail('Formation cells must be consecutive.');
            }
        }
        $normalized[] = ['id' => $id, 'cells' => $norm];
    }
    return $normalized;
}

function formation_at(array $fleet, int $row, int $col): ?string
{
    foreach ($fleet as $f) {
        foreach ($f['cells'] as $c) {
            if ($c['row'] === $row && $c['col'] === $col) {
                return $f['id'];
            }
        }
    }
    return null;
}

function all_lost(array $p): bool
{
    foreach ($p['fleet'] as $f) {
        if (!formation_lost($p, $f['id'])) {
            return false;
        }
    }
    return count($p['fleet']) > 0;
}

function system_msg(array &$room, string $text): void
{
    $room['chat'][] = ['id' => rid(8), 'kind' => 'system', 'text' => $text, 'at' => now_ms()];
    if (count($room['chat']) > 120) {
        $room['chat'] = array_slice($room['chat'], -120);
    }
}

function append_event(array &$room, array $event): array
{
    $event['id'] = $event['id'] ?? rid(8);
    $event['at'] = $event['at'] ?? now_ms();
    $room['events'][] = $event;
    if (count($room['events']) > PTP_MAX_EVENTS) {
        $room['events'] = array_slice($room['events'], -PTP_MAX_EVENTS);
    }
    $room['lastEvent'] = $event;
    return $event;
}

function reset_for_rematch(array &$room): void
{
    $room['round'] = max(1, intval($room['round'] ?? 1)) + 1;
    $room['status'] = 'placement';
    $room['turnPlayerId'] = null;
    $room['winnerId'] = null;
    $room['rematchVotes'] = [];
    foreach ($room['players'] as &$player) {
        $player['ready'] = false;
        $player['fleet'] = [];
        $player['shots'] = [];
        $player['shotsReceived'] = [];
    }
    unset($player);
    system_msg($room, 'Rematch accepted. Round ' . $room['round'] . ' is ready for placement.');
    append_event($room, ['type' => 'rematch-started', 'round' => $room['round']]);
}

$action = $_GET['action'] ?? 'state';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    out([], 204);
}

if ($action === 'create' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body();
    $name = clean_name($b['name'] ?? '');
    do {
        $code = room_code();
        $exists = store_get('ptp_room_' . $code);
    } while ($exists);
    $p = [
        'id' => rid(),
        'token' => rid(24),
        'name' => $name,
        'ready' => false,
        'fleet' => [],
        'shots' => [],
        'shotsReceived' => [],
    ];
    $room = [
        'code' => $code,
        'status' => 'waiting',
        'players' => [$p],
        'turnPlayerId' => null,
        'winnerId' => null,
        'chat' => [],
        'events' => [],
        'lastEvent' => null,
        'round' => 1,
        'rematchVotes' => [],
        'createdAt' => now_ms(),
        'updatedAt' => now_ms(),
    ];
    system_msg($room, $name . ' created the garden.');
    room_save($room);
    out(['code' => $code, 'playerId' => $p['id'], 'token' => $p['token']]);
}

if ($action === 'join' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body();
    $code = strtoupper(trim($b['code'] ?? ''));
    $name = clean_name($b['name'] ?? '');
    $room = room_get($code);
    if (count($room['players']) >= 2) {
        fail('This garden already has two players.');
    }
    if ($room['status'] !== 'waiting') {
        fail('This game has already started.');
    }
    $p = [
        'id' => rid(),
        'token' => rid(24),
        'name' => $name,
        'ready' => false,
        'fleet' => [],
        'shots' => [],
        'shotsReceived' => [],
    ];
    $room['players'][] = $p;
    $room['status'] = 'placement';
    system_msg($room, $name . ' joined the garden.');
    room_save($room);
    out(['code' => $code, 'playerId' => $p['id'], 'token' => $p['token']]);
}

if ($action === 'active') {
    $pid = $_SERVER['HTTP_X_PLAYER_ID'] ?? '';
    $token = $_SERVER['HTTP_X_PLAYER_TOKEN'] ?? '';
    $record = $pid ? store_get('ptp_player_' . $pid) : false;
    if (!$record || !hash_equals($record['token'] ?? '', $token)) {
        out(['game' => null]);
    }
    $room = room_get($record['code']);
    $idx = 0;
    foreach ($room['players'] as $i => $p) {
        if ($p['id'] === $pid) {
            $idx = $i;
            break;
        }
    }
    $opp = $room['players'][$idx === 0 ? 1 : 0] ?? null;
    if ($room['status'] === 'playing') {
        $label = $room['turnPlayerId'] === $pid ? 'Your turn' : 'Opponent turn';
    } elseif ($room['status'] === 'finished') {
        $label = 'Finished · Rematch available';
    } else {
        $label = ucfirst($room['status']);
    }
    out([
        'game' => [
            'code' => $room['code'],
            'opponentName' => $opp['name'] ?? 'Waiting for opponent',
            'label' => $label,
            'round' => $room['round'],
        ],
    ]);
}

[$room, $meIndex] = auth();
$oppIndex = $meIndex === 0 ? 1 : 0;

if ($action === 'state' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    out(public_state($room, $meIndex));
}

if ($action === 'place' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!in_array($room['status'], ['waiting', 'placement'], true)) {
        fail('Placement is closed.');
    }
    $b = body();
    $room['players'][$meIndex]['fleet'] = validate_fleet($b['fleet'] ?? null);
    $room['players'][$meIndex]['ready'] = true;
    system_msg($room, $room['players'][$meIndex]['name'] . ' locked their garden.');
    $event = append_event($room, [
        'type' => 'placement',
        'playerId' => $room['players'][$meIndex]['id'],
        'byPlayerId' => $room['players'][$meIndex]['id'],
        'round' => $room['round'],
    ]);
    if (count($room['players']) === 2 && $room['players'][0]['ready'] && $room['players'][1]['ready']) {
        $room['status'] = 'playing';
        $starterIndex = (($room['round'] - 1) % 2 === 0) ? 0 : 1;
        $room['turnPlayerId'] = $room['players'][$starterIndex]['id'];
        system_msg($room, 'Both gardens are locked. Round ' . $room['round'] . ' begins.');
    }
    $room['lastEvent'] = $event;
    room_save($room);
    out(public_state($room, $meIndex));
}

if ($action === 'fire' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($room['status'] !== 'playing') {
        fail('Game is not active.');
    }
    $me =& $room['players'][$meIndex];
    $opp =& $room['players'][$oppIndex];
    if ($room['turnPlayerId'] !== $me['id']) {
        fail('It is not your turn.');
    }
    $b = body();
    $row = intval($b['row'] ?? -1);
    $col = intval($b['col'] ?? -1);
    if ($row < 0 || $col < 0 || $row >= PTP_GRID || $col >= PTP_GRID) {
        fail('Plot is outside the garden.');
    }
    foreach ($me['shots'] as $s) {
        if ($s['row'] === $row && $s['col'] === $col) {
            fail('You already scouted that plot.');
        }
    }
    $fid = formation_at($opp['fleet'], $row, $col);
    $hit = $fid !== null;
    $shot = ['row' => $row, 'col' => $col, 'hit' => $hit];
    $me['shots'][] = $shot;
    $opp['shotsReceived'][] = $shot;
    $event = [
        'type' => 'scout',
        'byPlayerId' => $me['id'],
        'row' => $row,
        'col' => $col,
        'hit' => $hit,
        'round' => $room['round'],
    ];
    if ($hit && formation_lost($opp, $fid)) {
        $event['type'] = 'formation-lost';
        $event['formationId'] = $fid;
        system_msg($room, $me['name'] . ' found an entire plant formation.');
    }
    if (all_lost($opp)) {
        $room['status'] = 'finished';
        $room['winnerId'] = $me['id'];
        $room['turnPlayerId'] = null;
        $event['type'] = 'game-finished';
        $event['winnerId'] = $me['id'];
        if ($fid !== null) {
            $event['formationId'] = $fid;
        }
        system_msg($room, $me['name'] . ' protected their garden and won round ' . $room['round'] . '.');
    } else {
        $room['turnPlayerId'] = $opp['id'];
    }
    $event = append_event($room, $event);
    room_save($room);
    out(public_state($room, $meIndex));
}

if ($action === 'rematch' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($room['status'] !== 'finished') {
        fail('Rematch is available after the round ends.');
    }
    $meId = $room['players'][$meIndex]['id'];
    if (!in_array($meId, $room['rematchVotes'], true)) {
        $room['rematchVotes'][] = $meId;
        system_msg($room, $room['players'][$meIndex]['name'] . ' requested a rematch.');
        append_event($room, [
            'type' => 'rematch-requested',
            'byPlayerId' => $meId,
            'round' => $room['round'],
        ]);
    }
    if (count(array_unique($room['rematchVotes'])) >= 2) {
        reset_for_rematch($room);
    }
    room_save($room);
    out(public_state($room, $meIndex));
}

if ($action === 'chat' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = body();
    $text = clean_text($b['text'] ?? '');
    if ($text === '') {
        fail('Message is empty.');
    }
    $p = $room['players'][$meIndex];
    $room['chat'][] = [
        'id' => rid(8),
        'kind' => 'player',
        'playerId' => $p['id'],
        'name' => $p['name'],
        'text' => $text,
        'at' => now_ms(),
    ];
    if (count($room['chat']) > 120) {
        $room['chat'] = array_slice($room['chat'], -120);
    }
    room_save($room);
    out(public_state($room, $meIndex));
}

fail('Unsupported request.', 405);
