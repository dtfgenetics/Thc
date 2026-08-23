<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_send_json(['ok' => false, 'error' => 'POST required.'], 405);
}

$data = api_read_json_body();
$roomCode = api_clean_room_code($data['roomCode'] ?? $data['room'] ?? '');
$event = is_array($data['event'] ?? null) ? $data['event'] : [];
if ($event === []) {
    api_send_json(['ok' => false, 'error' => 'event is required.'], 400);
}

$playerId = api_clean_string($data['playerId'] ?? $event['playerId'] ?? '', 80);
$authKey = api_clean_auth_key($data['authKey'] ?? '');
if ($playerId === '') {
    api_send_json(['ok' => false, 'error' => 'playerId is required.'], 400);
}

$room = api_mutate_room($roomCode, function (array $room) use ($event, $playerId, $authKey): array {
    api_require_player_auth($room, $playerId, $authKey);

    $nextEvent = $event;
    $nextEvent['playerId'] = $playerId;
    $nextEvent['createdAt'] = api_now();
    $room['events'][] = $nextEvent;

    return $room;
});

api_send_json([
    'ok' => true,
    'room' => api_public_room($room)
]);
