<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

growlens_require_method('GET');
$root = growlens_private_root();
$probePath = $root . DIRECTORY_SEPARATOR . '.health-probe';
$probe = bin2hex(random_bytes(12));
$ready = file_put_contents($probePath, $probe, LOCK_EX) !== false;
if ($ready) {
    @chmod($probePath, 0600);
    $ready = hash_equals($probe, (string)file_get_contents($probePath));
    @unlink($probePath);
}

growlens_send_json([
    'ok' => $ready,
    'service' => 'growlens-api',
    'apiVersion' => GROWLENS_API_VERSION,
    'storageReady' => $ready,
    'time' => growlens_now()
], $ready ? 200 : 503);
