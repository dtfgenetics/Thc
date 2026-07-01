<?php

declare(strict_types=1);

http_response_code(403);
header('Content-Type: application/json; charset=utf-8');
echo json_encode([
    'ok' => false,
    'error' => 'Room storage is private.'
]);
