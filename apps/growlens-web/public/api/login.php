<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

growlens_require_method('POST');
growlens_require_same_origin();
growlens_rate_limit('login', 10, 900);

$body = growlens_read_json_body(32768);
$email = growlens_clean_email($body['email'] ?? '');
$password = is_string($body['password'] ?? null) ? (string)$body['password'] : '';
$user = $email !== '' ? growlens_find_user_by_email($email) : null;

if (!is_array($user) || !password_verify($password, (string)($user['passwordHash'] ?? ''))) {
    usleep(random_int(150000, 350000));
    growlens_send_json([
        'ok' => false,
        'error' => 'Invalid email or password.'
    ], 401);
}

if (password_needs_rehash((string)$user['passwordHash'], PASSWORD_DEFAULT)) {
    $user['passwordHash'] = password_hash($password, PASSWORD_DEFAULT);
    $user['updatedAt'] = growlens_now();
    growlens_atomic_write_json(growlens_user_path((string)$user['id']), $user);
}

$createdSession = growlens_create_session($user);
$data = growlens_load_user_data((string)$user['id']);

growlens_send_json([
    'ok' => true,
    'user' => growlens_public_user($user),
    'csrfToken' => (string)$createdSession['session']['csrfToken'],
    'revision' => $data['revision'],
    'updatedAt' => $data['updatedAt'],
    'state' => $data['state']
]);
