<?php

declare(strict_types=1);

$apiRoot = realpath(__DIR__ . '/../public/api');
if ($apiRoot === false) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Test API root is unavailable.']);
    exit;
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$endpoint = basename(is_string($path) ? $path : '');
$allowed = [
    'index.php',
    'create-room.php',
    'join-room.php',
    'get-room.php',
    'update-room.php',
    'append-event.php'
];

if (!in_array($endpoint, $allowed, true)) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Unknown test endpoint.']);
    exit;
}

$target = $apiRoot . DIRECTORY_SEPARATOR . $endpoint;
if (!is_file($target)) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Test endpoint file is missing.']);
    exit;
}

require $target;
