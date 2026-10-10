<?php

declare(strict_types=1);

require_once __DIR__ . '/_shared.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_send_json(['ok' => false, 'error' => 'POST required.'], 405);
}

api_require_multiplayer_available();
api_record_operation('update');

$data = api_read_json_body();
$roomCode = api_clean_room_code($data['roomCode'] ?? $data['room'] ?? '');
$playerId = api_clean_string($data['playerId'] ?? '', 80);
$credential = api_clean_string($data['credential'] ?? '', 256);
$hasState = array_key_exists('state', $data);
$hasStatus = array_key_exists('status', $data);
if ($hasState !== $hasStatus) {
    api_send_json(['ok' => false, 'error' => 'Game state and status must be updated together.'], 400);
}
if ($hasState) {
    if (!is_array($data['state'])) {
        api_send_json(['ok' => false, 'error' => 'Game state must be an object.'], 400);
    }
    $gamePlayers = $data['state']['players'] ?? null;
    $playerIndex = $data['state']['currentPlayerIndex'] ?? null;
    if (!is_array($gamePlayers) || $gamePlayers === [] || !is_int($playerIndex)
        || $playerIndex < 0 || $playerIndex >= count($gamePlayers)) {
        api_send_json(['ok' => false, 'error' => 'Game state requires a valid active player index.'], 400);
    }
    $requestedStatus = api_clean_string($data['status'], 20);
    if (!in_array($requestedStatus, ['playing', 'complete'], true)) {
        api_send_json(['ok' => false, 'error' => 'Invalid game state transition.'], 400);
    }
    $phase = api_clean_string($data['state']['phase'] ?? '', 32);
    if (($requestedStatus === 'complete') !== ($phase === 'game_over')) {
        api_send_json(['ok' => false, 'error' => 'Game phase must agree with room completion status.'], 400);
    }
    $winnerId = api_clean_string($data['state']['winnerId'] ?? '', 80);
    if (($winnerId !== '') !== ($requestedStatus === 'complete')) {
        api_send_json(['ok' => false, 'error' => 'Game status must agree with winner state.'], 400);
    }
    if ($winnerId !== '') {
        $playerIds = array_column(is_array($data['state']['players'] ?? null) ? $data['state']['players'] : [], 'id');
        if (!in_array($winnerId, $playerIds, true)) {
            api_send_json(['ok' => false, 'error' => 'Game winner must be a participating player.'], 400);
        }
    }
}
if ($playerId === '') {
    api_send_json(['ok' => false, 'error' => 'playerId is required.'], 400);
}

$room = api_mutate_room($roomCode, function (array $room) use ($data, $playerId, $credential, $hasState): array {
    api_require_player_credential($room, $playerId, $credential);

    if (array_key_exists('state', $data)) {
        $storedRevision = (int)($room['stateRevision'] ?? 0);
        $expectedRevision = $data['expectedRevision'] ?? null;
        if (!is_int($expectedRevision) || $expectedRevision < 0) {
            api_send_json(['ok' => false, 'error' => 'A valid expectedRevision is required for game state changes.'], 400);
        }
        if ($expectedRevision !== $storedRevision) {
            api_send_json(['ok' => false, 'error' => 'Stale room state revision. Refresh the room before trying again.'], 409);
        }
    }

    $incomingStatus = isset($data['status']) ? api_clean_string($data['status'], 20) : null;
    $storedStatus = api_clean_string($room['status'] ?? 'waiting', 20);
    $hostPlayerId = api_clean_string($room['players'][0]['id'] ?? '', 80);
    if ($hasState && $incomingStatus === 'complete') {
        $winnerId = api_clean_string($data['state']['winnerId'] ?? '', 80);
        $roomPlayerIds = array_column($room['players'] ?? [], 'id');
        if (!in_array($winnerId, $roomPlayerIds, true)) {
            api_send_json(['ok' => false, 'error' => 'Game winner must belong to this room.'], 400);
        }
    }

    $storedState = is_array($room['state'] ?? null) ? $room['state'] : null;
    $currentPlayerIndex = is_array($storedState) ? (int)($storedState['currentPlayerIndex'] ?? 0) : 0;
    $storedGamePlayers = is_array($storedState['players'] ?? null) ? $storedState['players'] : [];
    $activePlayerId = api_clean_string($storedGamePlayers[$currentPlayerIndex]['id'] ?? '', 80);

    if (($storedStatus === 'waiting' || $storedStatus === 'complete') && $hasState && $playerId !== $hostPlayerId) {
        api_send_json(['ok' => false, 'error' => 'Only the room host can start or restart the game.'], 403);
    }

    if ($storedStatus === 'complete' && $hasState && $incomingStatus !== 'playing') {
        api_send_json(['ok' => false, 'error' => 'Completed games must be restarted by the host before state updates.'], 409);
    }

    if (($storedStatus === 'waiting' || $storedStatus === 'complete') && $hasState && $incomingStatus === 'playing' && count($room['players'] ?? []) < 2) {
        api_send_json(['ok' => false, 'error' => 'At least two joined players are required to start the game.'], 409);
    }

    if ($storedStatus === 'waiting' && $incomingStatus === 'complete') {
        api_send_json(['ok' => false, 'error' => 'A waiting room must be started before it can finish.'], 409);
    }

    if ($storedStatus === 'playing' && $hasState && ($activePlayerId === '' || $playerId !== $activePlayerId)) {
        api_send_json(['ok' => false, 'error' => 'It is not this player\'s turn.'], 409);
    }

    if (array_key_exists('state', $data)) {
        $room['state'] = $data['state'];
        $room['stateRevision'] = ((int)($room['stateRevision'] ?? 0)) + 1;
    }

    if ($incomingStatus !== null) {
        $status = $incomingStatus;
        if (!in_array($status, ['waiting', 'playing', 'complete'], true)) {
            api_send_json(['ok' => false, 'error' => 'Invalid room status.'], 400);
        }
        $room['status'] = $status;
    }

    if (isset($data['event']) && is_array($data['event'])) {
        $event = $data['event'];
        $event['playerId'] = $playerId;
        $event['createdAt'] = api_now();
        $room['events'][] = $event;
    }

    return $room;
});

api_send_json([
    'ok' => true,
    'room' => api_public_room($room)
]);
