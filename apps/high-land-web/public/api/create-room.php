<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_send_json(['ok' => false, 'error' => 'POST required.'], 405);
}

api_require_multiplayer_available();
api_record_operation('create');

$data = api_read_json_body();
$room = api_create_room($data);

api_send_json([
    'ok' => true,
    'room' => api_public_room($room)
]);
