<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_send_json(['ok' => false, 'error' => 'POST required.'], 405);
}

$data = api_read_json_body();
$roomCode = api_clean_room_code($data['roomCode'] ?? $data['room'] ?? '');
$room = api_require_room($roomCode);

$playerId = api_clean_string($data['playerId'] ?? '', 80);
if ($playerId === '') {
    api_send_json(['ok' => false, 'error' => 'playerId is required.'], 400);
}

$players = is_array($room['players'] ?? null) ? $room['players'] : [];
$playerIds = [];
foreach ($players as $player) {
    $playerIds[] = is_array($player) ? ($player['id'] ?? '') : '';
}

if (!in_array($playerId, $playerIds, true)) {
    api_send_json(['ok' => false, 'error' => 'Player is not in this room.'], 403);
}

$incomingStatus = isset($data['status']) ? api_clean_string($data['status'], 20) : null;
$storedStatus = api_clean_string($room['status'] ?? 'waiting', 20);
$hostPlayerId = api_clean_string($room['players'][0]['id'] ?? '', 80);
$storedState = is_array($room['state'] ?? null) ? $room['state'] : null;
$currentPlayerIndex = is_array($storedState) ? (int)($storedState['currentPlayerIndex'] ?? 0) : 0;
$storedGamePlayers = is_array($storedState['players'] ?? null) ? $storedState['players'] : [];
$activePlayerId = api_clean_string($storedGamePlayers[$currentPlayerIndex]['id'] ?? '', 80);

if (($storedStatus === 'waiting' || $storedStatus === 'complete') && $incomingStatus === 'playing' && $playerId !== $hostPlayerId) {
    api_send_json(['ok' => false, 'error' => 'Only the room host can start or restart the game.'], 403);
}

if ($storedStatus === 'playing' && array_key_exists('state', $data) && $activePlayerId !== '' && $playerId !== $activePlayerId) {
    api_send_json(['ok' => false, 'error' => 'It is not this player\'s turn.'], 409);
}

if (array_key_exists('state', $data)) {
    $room['state'] = $data['state'];
}

if ($incomingStatus !== null) {
    $status = $incomingStatus;
    if (!in_array($status, ['waiting', 'playing', 'complete'], true)) {
        api_send_json(['ok' => false, 'error' => 'Invalid room status.'], 400);
    }
    $room['status'] = $status;
}

if (isset($data['event']) && is_array($data['event'])) {
    $event = $data['event'];
    $event['playerId'] = $playerId;
    $event['createdAt'] = api_now();
    $room['events'][] = $event;
}

$room = api_write_room($room);

api_send_json([
    'ok' => true,
    'room' => $room
]);
