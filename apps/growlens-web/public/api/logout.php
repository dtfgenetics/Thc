<?php

declare(strict_types=1);

require_once __DIR__ . '/_operations.php';

growlens_require_method('POST');
growlens_require_same_origin();
growlens_begin_storage_access();
$context = growlens_current_session(true);
growlens_require_csrf($context);
growlens_delete_session($context);

growlens_send_json([
    'ok' => true,
    'authenticated' => false
]);
