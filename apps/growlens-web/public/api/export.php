<?php

declare(strict_types=1);

require_once __DIR__ . '/_operations.php';

growlens_require_method('GET');
growlens_begin_storage_access();
$context = growlens_current_session(true);
$data = growlens_load_user_data((string)$context['user']['id']);
$filename = 'growlens-account-export-' . gmdate('Y-m-d') . '.json';

http_response_code(200);
header('Content-Type: application/json; charset=utf-8');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');

echo json_encode([
    'app' => 'THC GrowLens',
    'apiVersion' => GROWLENS_API_VERSION,
    'exportedAt' => growlens_now(),
    'user' => growlens_public_user($context['user']),
    'revision' => $data['revision'],
    'updatedAt' => $data['updatedAt'],
    'state' => $data['state']
], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
