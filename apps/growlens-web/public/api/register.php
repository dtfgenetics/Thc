<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

growlens_require_method('POST');
growlens_require_same_origin();
growlens_rate_limit('register', 5, 3600);

$body = growlens_read_json_body(32768);
$email = growlens_clean_email($body['email'] ?? '');
if ($email === '') {
    growlens_send_json([
        'ok' => false,
        'error' => 'A valid email address is required.'
    ], 400);
}

$password = growlens_require_password($body['password'] ?? '');
$user = growlens_create_user($email, $password);
$createdSession = growlens_create_session($user);
$data = growlens_load_user_data((string)$user['id']);

growlens_send_json([
    'ok' => true,
    'user' => growlens_public_user($user),
    'csrfToken' => (string)$createdSession['session']['csrfToken'],
    'revision' => $data['revision'],
    'updatedAt' => $data['updatedAt'],
    'state' => $data['state']
], 201);
