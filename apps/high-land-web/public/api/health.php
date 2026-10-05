<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_send_json(['ok' => false, 'error' => 'GET required.'], 405);
}

$state = api_liveops_state();
$roomFiles = glob(api_rooms_dir() . '/*.json') ?: [];

api_send_json([
    'ok' => true,
    'service' => 'high-land-room-api',
    'apiVersion' => THC_GAME_API_VERSION,
    'maintenance' => $state['maintenance'],
    'multiplayerEnabled' => $state['multiplayerEnabled'],
    'roomsStored' => count($roomFiles),
    'metrics' => api_operation_metrics(),
    'serverTime' => api_now()
]);
