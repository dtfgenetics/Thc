<?php

declare(strict_types=1);

require_once __DIR__ . '/_images.php';
require_once __DIR__ . '/_operations.php';

growlens_require_method('POST');
growlens_require_same_origin();
growlens_begin_storage_access();
$context = growlens_current_session(true);
growlens_require_csrf($context);
$userId = (string)$context['user']['id'];
growlens_rate_limit('delete-account-' . $userId, 5, 3600);

$body = growlens_read_json_body(32768);
$password = is_string($body['password'] ?? null) ? (string)$body['password'] : '';
$passwordHash = (string)($context['user']['passwordHash'] ?? '');

if ($password === '' || $passwordHash === '' || !password_verify($password, $passwordHash)) {
    growlens_send_json([
        'ok' => false,
        'error' => 'Password verification failed.'
    ], 401);
}

$accountLockPath = growlens_path('data', $userId . '.account.lock');
$accountLock = fopen($accountLockPath, 'c');
if ($accountLock === false || !flock($accountLock, LOCK_EX)) {
    if (is_resource($accountLock)) {
        fclose($accountLock);
    }
    growlens_send_json([
        'ok' => false,
        'error' => 'Could not lock the account for deletion.'
    ], 500);
}

growlens_delete_user_images($userId);
growlens_delete_account_data($context['user']);
flock($accountLock, LOCK_UN);
fclose($accountLock);
@unlink($accountLockPath);

growlens_send_json([
    'ok' => true,
    'deleted' => true,
    'authenticated' => false
]);
