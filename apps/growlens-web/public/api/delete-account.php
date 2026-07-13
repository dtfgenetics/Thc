<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

growlens_require_method('POST');
growlens_require_same_origin();
$context = growlens_current_session(true);
growlens_require_csrf($context);
growlens_rate_limit('delete-account-' . (string)$context['user']['id'], 5, 3600);

$body = growlens_read_json_body(32768);
$password = is_string($body['password'] ?? null) ? (string)$body['password'] : '';
$passwordHash = (string)($context['user']['passwordHash'] ?? '');

if ($password === '' || $passwordHash === '' || !password_verify($password, $passwordHash)) {
    growlens_send_json([
        'ok' => false,
        'error' => 'Password verification failed.'
    ], 401);
}

growlens_delete_account_data($context['user']);

growlens_send_json([
    'ok' => true,
    'deleted' => true,
    'authenticated' => false
]);
