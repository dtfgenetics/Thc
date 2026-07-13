<?php

declare(strict_types=1);

require_once __DIR__ . '/_operations.php';
require_once __DIR__ . '/_state-v2.php';

growlens_require_method('GET');
growlens_begin_storage_access();
$context = growlens_current_session(false);

if (!is_array($context)) {
    growlens_send_json([
        'ok' => true,
        'authenticated' => false
    ]);
}

$data = growlens_v2_load_user_data((string)$context['user']['id']);

growlens_send_json([
    'ok' => true,
    'authenticated' => true,
    'user' => growlens_public_user($context['user']),
    'csrfToken' => (string)$context['session']['csrfToken'],
    'revision' => $data['revision'],
    'updatedAt' => $data['updatedAt']
]);
