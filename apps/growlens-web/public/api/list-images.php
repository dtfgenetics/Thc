<?php

declare(strict_types=1);

require_once __DIR__ . '/_images.php';

growlens_require_method('GET');
$context = growlens_current_session(true);
$images = growlens_list_image_metadata((string)$context['user']['id']);

growlens_send_json([
    'ok' => true,
    'images' => $images
]);
