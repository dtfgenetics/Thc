<?php
/**
 * Shared file-backed room API helpers for DTF/THC browser games.
 *
 * This is intentionally dependency-free for shared hosting such as Hostinger.
 * It stores room JSON files beside the deployed game under api/_rooms/.
 */

declare(strict_types=1);

const THC_GAME_API_VERSION = '1.0.0';
const THC_GAME_ROOM_CODE_LENGTH = 6;
const THC_GAME_MAX_PLAYERS_DEFAULT = 10;
const THC_GAME_ROOM_TTL_SECONDS = 86400;

function api_send_json(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function api_read_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        api_send_json([
            'ok' => false,
            'error' => 'Invalid JSON body.'
        ], 400);
    }

    return $decoded;
}

/**
 * @param mixed $value
 */
function api_clean_string($value, int $maxLength = 80): string
{
    $text = is_string($value) ? $value : '';
    $text = trim(preg_replace('/\s+/', ' ', $text) ?? '');
    $text = strip_tags($text);
    if (function_exists('mb_substr')) {
        return mb_substr($text, 0, $maxLength);
    }
    return substr($text, 0, $maxLength);
}

/**
 * @param mixed $value
 */
function api_clean_slug($value, string $fallback = 'high-land'): string
{
    $text = strtolower(api_clean_string($value, 60));
    $text = preg_replace('/[^a-z0-9-]/', '-', $text) ?? '';
    $text = trim(preg_replace('/-+/', '-', $text) ?? '', '-');
    return $text !== '' ? $text : $fallback;
}

/**
 * @param mixed $value
 */
function api_clean_room_code($value): string
{
    $text = strtoupper(api_clean_string($value, 16));
    return preg_replace('/[^A-Z0-9]/', '', $text) ?? '';
}

function api_now(): string
{
    return gmdate('c');
}

function api_rooms_dir(): string
{
    $dir = __DIR__ . '/_rooms';
    if (!is_dir($dir) && !mkdir($dir, 0755, true) && !is_dir($dir)) {
        api_send_json([
            'ok' => false,
            'error' => 'Could not create room storage directory.'
        ], 500);
    }
    return $dir;
}

function api_room_path(string $roomCode): string
{
    $code = api_clean_room_code($roomCode);
    if ($code === '') {
        api_send_json([
            'ok' => false,
            'error' => 'Room code is required.'
        ], 400);
    }
    return api_rooms_dir() . '/' . $code . '.json';
}

function api_generate_room_code(): string
{
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $max = strlen($alphabet) - 1;
    $code = '';
    for ($i = 0; $i < THC_GAME_ROOM_CODE_LENGTH; $i++) {
        $code .= $alphabet[random_int(0, $max)];
    }
    return $code;
}

function api_new_player(array $data, int $index): array
{
    $defaultName = 'Player ' . ($index + 1);
    $name = api_clean_string($data['playerName'] ?? $data['name'] ?? $defaultName, 40);
    if ($name === '') {
        $name = $defaultName;
    }

    $id = api_clean_string($data['playerId'] ?? '', 80);
    if ($id === '') {
        $id = 'player-' . bin2hex(random_bytes(6));
    }

    return [
        'id' => $id,
        'name' => $name,
        'token' => api_clean_string($data['token'] ?? 'token' . strtoupper(chr(65 + min($index, 25))), 20),
        'color' => api_clean_string($data['color'] ?? api_default_player_color($index), 20),
        'host' => (bool)($data['host'] ?? false),
        'connected' => true,
        'joinedAt' => api_now()
    ];
}

function api_default_player_color(int $index): string
{
    $colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#84cc16'];
    return $colors[$index % count($colors)];
}

function api_read_room(string $roomCode): ?array
{
    $path = api_room_path($roomCode);
    if (!is_file($path)) {
        return null;
    }

    $contents = file_get_contents($path);
    if ($contents === false) {
        return null;
    }

    $room = json_decode($contents, true);
    return is_array($room) ? $room : null;
}

function api_write_room(array $room): array
{
    $room['updatedAt'] = api_now();
    $path = api_room_path((string)$room['code']);
    $encoded = json_encode($room, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    if ($encoded === false) {
        api_send_json([
            'ok' => false,
            'error' => 'Could not encode room state.'
        ], 500);
    }

    $lockPath = $path . '.lock';
    $lock = fopen($lockPath, 'c');
    if ($lock === false) {
        api_send_json([
            'ok' => false,
            'error' => 'Could not open room lock.'
        ], 500);
    }

    flock($lock, LOCK_EX);
    $result = file_put_contents($path, $encoded, LOCK_EX);
    flock($lock, LOCK_UN);
    fclose($lock);

    if ($result === false) {
        api_send_json([
            'ok' => false,
            'error' => 'Could not save room state.'
        ], 500);
    }

    return $room;
}

function api_create_room(array $data): array
{
    api_cleanup_old_rooms();

    $game = api_clean_slug($data['game'] ?? 'high-land');
    $maxPlayers = (int)($data['maxPlayers'] ?? THC_GAME_MAX_PLAYERS_DEFAULT);
    $maxPlayers = max(2, min(THC_GAME_MAX_PLAYERS_DEFAULT, $maxPlayers));

    do {
        $code = api_generate_room_code();
        $path = api_room_path($code);
    } while (is_file($path));

    $hostData = $data;
    $hostData['host'] = true;
    $host = api_new_player($hostData, 0);

    return api_write_room([
        'apiVersion' => THC_GAME_API_VERSION,
        'code' => $code,
        'game' => $game,
        'status' => 'waiting',
        'maxPlayers' => $maxPlayers,
        'players' => [$host],
        'state' => $data['state'] ?? null,
        'events' => [],
        'createdAt' => api_now(),
        'updatedAt' => api_now()
    ]);
}

function api_require_room(string $roomCode): array
{
    $room = api_read_room($roomCode);
    if ($room === null) {
        api_send_json([
            'ok' => false,
            'error' => 'Room not found.'
        ], 404);
    }
    return $room;
}

function api_cleanup_old_rooms(): void
{
    $dir = api_rooms_dir();
    $cutoff = time() - THC_GAME_ROOM_TTL_SECONDS;
    foreach (glob($dir . '/*.json') ?: [] as $file) {
        if (is_file($file) && filemtime($file) !== false && filemtime($file) < $cutoff) {
            @unlink($file);
            @unlink($file . '.lock');
        }
    }
}
