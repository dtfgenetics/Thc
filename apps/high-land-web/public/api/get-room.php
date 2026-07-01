<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_send_json(['ok' => false, 'error' => 'GET required.'], 405);
}

$roomCode = api_clean_room_code($_GET['room'] ?? $_GET['roomCode'] ?? '');
$room = api_require_room($roomCode);

api_send_json([
    'ok' => true,
    'room' => $room
]);
