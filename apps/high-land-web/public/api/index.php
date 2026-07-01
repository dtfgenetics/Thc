<?php

declare(strict_types=1);

http_response_code(404);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => false,
    'error' => 'Use a specific game API endpoint.'
]);
