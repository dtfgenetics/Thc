<?php
declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');

const MAX_PLAYERS = 10;
const FINISH_INDEX = 110;
const ROOM_TTL_SECONDS = 86400;

$colors = ['#f43f5e', '#3b82f6', '#22c55e', '#eab308', '#a855f7', '#14b8a6', '#f97316', '#ec4899', '#84cc16', '#38bdf8'];
$tokens = ['tokenA', 'tokenB', 'tokenC', 'tokenD', 'tokenE', 'tokenF', 'tokenG', 'tokenH', 'tokenI', 'tokenJ'];
$storageDir = dirname(__DIR__, 6) . '/private/high-land-rooms';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['code' => 'method_not_allowed', 'message' => 'POST required.']);
}

$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > 262144) {
    respond(413, ['code' => 'request_too_large', 'message' => 'The multiplayer request was too large.']);
}

$input = json_decode((string) file_get_contents('php://input'), true);
if (!is_array($input)) {
    respond(400, ['code' => 'invalid_request', 'message' => 'The multiplayer request was invalid.']);
}

$action = (string) ($input['action'] ?? '');

if (!is_dir($storageDir) && !mkdir($storageDir, 0700, true) && !is_dir($storageDir)) {
    respond(503, ['code' => 'storage_unavailable', 'message' => 'Connection failed. You can still play High Land locally.']);
}

if ($action === 'create') {
    cleanupOldRooms($storageDir);
    $gameId = createRoomCode($storageDir);
    $player = createPlayer($input['name'] ?? '', 0, [], $colors, $tokens);
    $playerToken = bin2hex(random_bytes(24));
    $now = time();
    $room = [
        'gameId' => $gameId,
        'status' => 'lobby',
        'hostPlayerId' => $player['id'],
        'players' => [$player],
        'gameState' => null,
        'version' => 1,
        'updatedAt' => $now * 1000,
        'maxPlayers' => MAX_PLAYERS,
        'auth' => [$player['id'] => $playerToken],
        'lastSeen' => [$player['id'] => $now]
    ];
    $path = roomPath($storageDir, $gameId);
    if (file_put_contents($path, json_encode($room, JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
        respond(503, ['code' => 'storage_unavailable', 'message' => 'The game lobby could not be created.']);
    }
    @chmod($path, 0600);
    respond(200, [
        'room' => publicRoom($room),
        'credentials' => credentials($room, $player['id'])
    ]);
}

$gameId = normalizeGameId($input['gameId'] ?? '');
if ($gameId === null) {
    respond(404, ['code' => 'not_found', 'message' => 'This game invite could not be found. Create a new High Land game.']);
}

$path = roomPath($storageDir, $gameId);
if (!is_file($path)) {
    respond(404, ['code' => 'not_found', 'message' => 'This game invite could not be found. Create a new High Land game.']);
}

$handle = fopen($path, 'c+');
if ($handle === false || !flock($handle, LOCK_EX)) {
    respond(503, ['code' => 'storage_unavailable', 'message' => 'Connection failed. You can still play High Land locally.']);
}

rewind($handle);
$room = json_decode((string) stream_get_contents($handle), true);
if (!is_array($room)) {
    unlockAndRespond($handle, 404, ['code' => 'not_found', 'message' => 'This game invite could not be found. Create a new High Land game.']);
}

$dirty = false;
$status = 200;
$payload = null;

if ($action === 'inspect') {
    if (count($room['players']) >= (int) $room['maxPlayers']) {
        $status = 409;
        $payload = ['code' => 'room_full', 'message' => 'This High Land game is full.', 'room' => publicRoom($room)];
    } else {
        $payload = ['room' => publicRoom($room)];
    }
} elseif ($action === 'join') {
    if ($room['status'] !== 'lobby') {
        $status = 409;
        $payload = ['code' => 'game_started', 'message' => 'This High Land game has already started.', 'room' => publicRoom($room)];
    } elseif (count($room['players']) >= (int) $room['maxPlayers']) {
        $status = 409;
        $payload = ['code' => 'room_full', 'message' => 'This High Land game is full.', 'room' => publicRoom($room)];
    } else {
        $existingNames = array_map(static fn(array $player): string => (string) $player['name'], $room['players']);
        $index = count($room['players']);
        $player = createPlayer($input['name'] ?? '', $index, $existingNames, $colors, $tokens);
        $playerToken = bin2hex(random_bytes(24));
        $room['players'][] = $player;
        $room['auth'][$player['id']] = $playerToken;
        $room['lastSeen'][$player['id']] = time();
        $room['version'] = (int) $room['version'] + 1;
        $room['updatedAt'] = time() * 1000;
        $dirty = true;
        $payload = ['room' => publicRoom($room), 'credentials' => credentials($room, $player['id'])];
    }
} else {
    $playerId = (string) ($input['playerId'] ?? '');
    $playerToken = (string) ($input['playerToken'] ?? '');
    if ($playerId === '' || $playerToken === '' || !isset($room['auth'][$playerId]) || !hash_equals((string) $room['auth'][$playerId], $playerToken)) {
        unlockAndRespond($handle, 401, [
            'code' => 'reconnect_failed',
            'message' => 'Your player session could not be restored. Rejoin the lobby.',
            'room' => publicRoom($room)
        ]);
    }

    if ($action === 'sync') {
        $payload = ['room' => publicRoom($room)];
    } elseif ($action === 'start') {
        if ($playerId !== $room['hostPlayerId']) {
            $status = 403;
            $payload = ['code' => 'host_only', 'message' => 'Only the host can start this High Land game.', 'room' => publicRoom($room)];
        } elseif (count($room['players']) < 2) {
            $status = 409;
            $payload = ['code' => 'not_enough_players', 'message' => 'At least 2 players are needed to start.', 'room' => publicRoom($room)];
        } else {
            if ($room['status'] === 'lobby') {
                $room['gameState'] = createGameState($room['players']);
                $room['status'] = 'playing';
                $room['version'] = (int) $room['version'] + 1;
                $room['updatedAt'] = time() * 1000;
                $dirty = true;
            }
            $payload = ['room' => publicRoom($room)];
        }
    } elseif ($action === 'commit') {
        if ($room['status'] !== 'playing' || !is_array($room['gameState'])) {
            $status = 409;
            $payload = ['code' => 'not_playing', 'message' => 'This High Land game is not accepting moves.', 'room' => publicRoom($room)];
        } elseif ((int) ($input['expectedVersion'] ?? -1) !== (int) $room['version']) {
            $status = 409;
            $payload = ['code' => 'conflict', 'message' => 'The board changed before your move was saved. The latest turn has been restored.', 'room' => publicRoom($room)];
        } else {
            $currentIndex = (int) ($room['gameState']['currentPlayerIndex'] ?? -1);
            $currentPlayers = $room['gameState']['players'] ?? [];
            $activeId = is_array($currentPlayers) && isset($currentPlayers[$currentIndex]['id'])
                ? (string) $currentPlayers[$currentIndex]['id']
                : '';
            if ($activeId !== $playerId) {
                $status = 403;
                $payload = ['code' => 'not_your_turn', 'message' => 'Only the active player can make this move.', 'room' => publicRoom($room)];
            } elseif (!isValidGameState($input['gameState'] ?? null, $room['players'])) {
                $status = 422;
                $payload = ['code' => 'invalid_state', 'message' => 'The submitted board state was invalid.', 'room' => publicRoom($room)];
            } else {
                $room['gameState'] = $input['gameState'];
                $room['status'] = !empty($room['gameState']['winnerId']) ? 'finished' : 'playing';
                $room['version'] = (int) $room['version'] + 1;
                $room['updatedAt'] = time() * 1000;
                $dirty = true;
                $payload = ['room' => publicRoom($room)];
            }
        }
    } else {
        $status = 400;
        $payload = ['code' => 'invalid_action', 'message' => 'Unknown room action.'];
    }
}

if ($dirty) {
    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, (string) json_encode($room, JSON_UNESCAPED_SLASHES));
    fflush($handle);
}
flock($handle, LOCK_UN);
fclose($handle);
respond($status, $payload ?? ['code' => 'invalid_request', 'message' => 'The multiplayer request was invalid.']);

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function unlockAndRespond($handle, int $status, array $payload): void
{
    flock($handle, LOCK_UN);
    fclose($handle);
    respond($status, $payload);
}

function normalizeGameId($value): ?string
{
    $normalized = strtoupper(trim((string) $value));
    return preg_match('/^[A-Z2-9]{6}$/', $normalized) === 1 ? $normalized : null;
}

function roomPath(string $storageDir, string $gameId): string
{
    return $storageDir . '/' . $gameId . '.json';
}

function createRoomCode(string $storageDir): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    do {
        $bytes = random_bytes(6);
        $code = '';
        for ($index = 0; $index < 6; $index++) {
            $code .= $alphabet[ord($bytes[$index]) % strlen($alphabet)];
        }
    } while (is_file(roomPath($storageDir, $code)));
    return $code;
}

function createPlayer($nameValue, int $index, array $existingNames, array $colors, array $tokens): array
{
    $baseName = preg_replace('/\s+/', ' ', trim((string) $nameValue));
    $baseName = mb_substr($baseName ?: 'Player ' . ($index + 1), 0, 24);
    $name = $baseName;
    $suffix = 2;
    $lowerNames = array_map('mb_strtolower', $existingNames);
    while (in_array(mb_strtolower($name), $lowerNames, true)) {
        $name = mb_substr($baseName . ' ' . $suffix, 0, 24);
        $suffix++;
    }
    $now = time();
    return [
        'id' => 'player-' . bin2hex(random_bytes(8)),
        'name' => $name,
        'color' => $colors[$index],
        'token' => $tokens[$index],
        'connected' => true,
        'joinedAt' => $now * 1000
    ];
}

function createGameState(array $players): array
{
    $gamePlayers = array_map(static fn(array $player): array => [
        'id' => $player['id'],
        'name' => $player['name'],
        'token' => $player['token'],
        'color' => $player['color'],
        'positionIndex' => 0,
        'skipTurns' => 0,
        'protectedFromBackward' => 0
    ], $players);
    return [
        'players' => $gamePlayers,
        'currentPlayerIndex' => 0,
        'phase' => 'ready',
        'turnDirection' => 1,
        'reverseTurnsRemaining' => 0,
        'lastRoll' => null,
        'lastCard' => null,
        'message' => ($players[0]['name'] ?? 'Player 1') . "'s turn.",
        'winnerId' => null,
        'cardCursor' => 0,
        'pendingChoice' => null
    ];
}

function publicRoom(array $room): array
{
    $players = array_map(static function (array $player): array {
        $player['connected'] = true;
        return $player;
    }, $room['players']);
    return [
        'gameId' => $room['gameId'],
        'status' => $room['status'],
        'hostPlayerId' => $room['hostPlayerId'],
        'players' => $players,
        'gameState' => $room['gameState'],
        'version' => (int) $room['version'],
        'updatedAt' => (int) $room['updatedAt'],
        'maxPlayers' => (int) $room['maxPlayers']
    ];
}

function credentials(array $room, string $playerId): array
{
    return ['gameId' => $room['gameId'], 'playerId' => $playerId, 'playerToken' => $room['auth'][$playerId]];
}

function isValidGameState($value, array $roomPlayers): bool
{
    if (!is_array($value) || !isset($value['players']) || !is_array($value['players'])) return false;
    if (count($value['players']) !== count($roomPlayers)) return false;
    foreach ($value['players'] as $index => $player) {
        if (!is_array($player) || ($player['id'] ?? null) !== $roomPlayers[$index]['id']) return false;
        $position = filter_var($player['positionIndex'] ?? null, FILTER_VALIDATE_INT);
        if ($position === false || $position < 0 || $position > FINISH_INDEX) return false;
    }
    $currentIndex = filter_var($value['currentPlayerIndex'] ?? null, FILTER_VALIDATE_INT);
    return $currentIndex !== false && $currentIndex >= 0 && $currentIndex < count($roomPlayers);
}

function cleanupOldRooms(string $storageDir): void
{
    if (random_int(1, 20) !== 1) return;
    $cutoff = time() - ROOM_TTL_SECONDS;
    foreach (glob($storageDir . '/*.json') ?: [] as $path) {
        if (is_file($path) && filemtime($path) < $cutoff) @unlink($path);
    }
}

