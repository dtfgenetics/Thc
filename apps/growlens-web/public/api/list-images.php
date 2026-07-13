<?php

declare(strict_types=1);

require_once __DIR__ . '/_images.php';
require_once __DIR__ . '/_operations.php';

growlens_require_method('GET');
growlens_begin_storage_access();
$context = growlens_current_session(true);
$images = growlens_list_image_metadata((string)$context['user']['id']);

growlens_send_json([
    'ok' => true,
    'images' => $images
]);
