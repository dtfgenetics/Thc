<?php

declare(strict_types=1);

require_once __DIR__ . '/_images.php';

growlens_require_method('POST');
growlens_require_same_origin();
$context = growlens_current_session(true);
growlens_require_csrf($context);
$userId = (string)$context['user']['id'];
growlens_rate_limit('image-delete-' . $userId, 120, 3600);

$body = growlens_read_json_body(32768);
$photoId = growlens_validate_photo_id($body['photoId'] ?? '');
$deleted = growlens_delete_image($userId, $photoId);

if (!$deleted) {
    growlens_send_json([
        'ok' => false,
        'error' => 'Image not found.'
    ], 404);
}

growlens_send_json([
    'ok' => true,
    'deleted' => true,
    'photoId' => $photoId
]);
