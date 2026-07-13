<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
if (!in_array($method, ['GET', 'POST'], true)) {
    header('Allow: GET, POST');
    growlens_send_json([
        'ok' => false,
        'error' => 'Method not allowed.'
    ], 405);
}

$context = growlens_current_session(true);
$userId = (string)$context['user']['id'];

if ($method === 'GET') {
    $data = growlens_load_user_data($userId);
    growlens_send_json([
        'ok' => true,
        'user' => growlens_public_user($context['user']),
        'revision' => $data['revision'],
        'updatedAt' => $data['updatedAt'],
        'state' => $data['state']
    ]);
}

growlens_require_same_origin();
growlens_require_csrf($context);
growlens_rate_limit('sync-write-' . $userId, 120, 3600);

$body = growlens_read_json_body(GROWLENS_MAX_BODY_BYTES);
$expectedRevision = $body['expectedRevision'] ?? null;
if (!is_int($expectedRevision) && !(is_string($expectedRevision) && ctype_digit($expectedRevision))) {
    growlens_send_json([
        'ok' => false,
        'error' => 'expectedRevision must be a non-negative integer.'
    ], 400);
}

$expectedRevision = (int)$expectedRevision;
if ($expectedRevision < 0) {
    growlens_send_json([
        'ok' => false,
        'error' => 'expectedRevision must be a non-negative integer.'
    ], 400);
}

$state = growlens_validate_state($body['state'] ?? null);
$saved = growlens_save_user_data($userId, $state, $expectedRevision);

growlens_send_json([
    'ok' => true,
    'revision' => $saved['revision'],
    'updatedAt' => $saved['updatedAt'],
    'state' => $saved['state']
]);
