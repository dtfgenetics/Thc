<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_send_json(['ok' => false, 'error' => 'POST required.'], 405);
}

$data = api_read_json_body();
$roomCode = api_clean_room_code($data['roomCode'] ?? $data['room'] ?? '');
$room = api_require_room($roomCode);

$players = is_array($room['players'] ?? null) ? $room['players'] : [];
$incomingPlayerId = api_clean_string($data['playerId'] ?? '', 80);
if ($incomingPlayerId !== '') {
    foreach ($players as $player) {
        if (($player['id'] ?? '') === $incomingPlayerId) {
            api_send_json(['ok' => true, 'room' => $room]);
        }
    }
}

if (($room['status'] ?? 'waiting') !== 'waiting') {
    api_send_json(['ok' => false, 'error' => 'Room already started.'], 409);
}

$maxPlayers = (int)($room['maxPlayers'] ?? THC_GAME_MAX_PLAYERS_DEFAULT);
if (count($players) >= $maxPlayers) {
    api_send_json(['ok' => false, 'error' => 'Room is full.'], 409);
}

$player = api_new_player($data, count($players));
$players[] = $player;
$room['players'] = $players;
$room['events'][] = [
    'type' => 'player_joined',
    'playerId' => $player['id'],
    'playerName' => $player['name'],
    'createdAt' => api_now()
];

$room = api_write_room($room);

api_send_json([
    'ok' => true,
    'room' => $room,
    'player' => $player
]);
