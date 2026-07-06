<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_send_json(['ok' => false, 'error' => 'POST required.'], 405);
}

$data = api_read_json_body();
$roomCode = api_clean_room_code($data['roomCode'] ?? $data['room'] ?? '');
$room = api_require_room($roomCode);

$event = is_array($data['event'] ?? null) ? $data['event'] : [];
if ($event === []) {
    api_send_json(['ok' => false, 'error' => 'event is required.'], 400);
}

$playerId = api_clean_string($data['playerId'] ?? $event['playerId'] ?? '', 80);
if ($playerId === '') {
    $playerId = 'system-event';
}

if ($playerId !== 'system-event') {
    $players = is_array($room['players'] ?? null) ? $room['players'] : [];
    $playerIds = [];
    foreach ($players as $player) {
        $playerIds[] = is_array($player) ? ($player['id'] ?? '') : '';
    }

    if (!in_array($playerId, $playerIds, true)) {
        api_send_json(['ok' => false, 'error' => 'Player is not in this room.'], 403);
    }
}

$event['playerId'] = $playerId === 'system-event' ? ($event['playerId'] ?? null) : $playerId;
$event['createdAt'] = api_now();
$room['events'][] = $event;
$room = api_write_room($room);

api_send_json([
    'ok' => true,
    'room' => $room
]);
