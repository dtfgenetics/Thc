<?php
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

const BOB_TTL = 14400;
const BOB_MAX_PLAYERS = 10;
const BOB_DEFAULT_ROUNDS = 12;
const BOB_MIN_ROUNDS = 6;
const BOB_MAX_ROUNDS = 20;
const BOB_VOTE_MS = 24000;
const BOB_REVEAL_MS = 9000;

function out(array $payload, int $status = 200): void { http_response_code($status); echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE); exit; }
function fail(string $message, int $status = 400): void { out(['error' => $message], $status); }
function body(): array { $raw = file_get_contents('php://input') ?: '{}'; $data = json_decode($raw, true); if (!is_array($data)) fail('Invalid JSON body.'); return $data; }
function cut_text(string $value, int $limit): string { return function_exists('mb_substr') ? mb_substr($value, 0, $limit) : substr($value, 0, $limit); }
function clean_name($value): string { $v = trim(preg_replace('/[\x00-\x1F\x7F]/u', '', strval($value))); if ($v === '') fail('Player name is required.'); return cut_text($v, 24); }
function clean_text($value): string { $v = trim(preg_replace('/[\x00-\x1F\x7F]/u', ' ', strval($value))); return cut_text($v, 240); }
function rid(int $bytes = 12): string { return rtrim(strtr(base64_encode(random_bytes($bytes)), '+/', '-_'), '='); }
function now_ms(): int { return (int) round(microtime(true) * 1000); }
function room_code(): string { $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $s = ''; for ($i=0; $i<6; $i++) $s .= $alphabet[random_int(0, strlen($alphabet)-1)]; return $s; }
function normalize_code($value): string { $code = strtoupper(trim(strval($value))); if (!preg_match('/^[A-Z0-9]{6}$/', $code)) fail('A valid 6-character room code is required.'); return $code; }

$root = dirname(__DIR__, 2) . '/wp-load.php';
$useWp = is_file($root);
if ($useWp) require_once $root;
function store_get(string $key) { global $useWp; if ($useWp) return get_transient($key); $path = sys_get_temp_dir() . '/' . $key . '.json'; if (!is_file($path)) return false; $data = json_decode(file_get_contents($path), true); if (!is_array($data) || ($data['_expires'] ?? 0) < time()) { @unlink($path); return false; } unset($data['_expires']); return $data; }
function store_set(string $key, array $value, int $ttl = BOB_TTL): void { global $useWp; if ($useWp) { set_transient($key, $value, $ttl); return; } $value['_expires'] = time() + $ttl; file_put_contents(sys_get_temp_dir() . '/' . $key . '.json', json_encode($value), LOCK_EX); }
function room_get(string $code): array { $room = store_get('bob_room_' . $code); if (!$room) fail('Room not found or expired.', 404); return $room; }
function room_save(array $room): void { $room['updatedAt'] = now_ms(); store_set('bob_room_' . $room['code'], $room); foreach ($room['players'] as $p) store_set('bob_player_' . $p['id'], ['code' => $room['code'], 'token' => $p['token']], BOB_TTL); }

function cards(): array {
  return [
    ['id'=>'BOB-001','name'=>'Purple Monkey Balls','answer'=>'BUD','difficulty'=>'Hard','category'=>'Real But Ridiculous','clue'=>'Mendo Purps × Deep Chunk background','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-002','name'=>'Cat Piss','answer'=>'BUD','difficulty'=>'Medium','category'=>'Real But Ridiculous','clue'=>'Old-school clone background','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-003','name'=>'Crouching Tiger Hidden Alien','answer'=>'BUD','difficulty'=>'Hard','category'=>'Real But Ridiculous','clue'=>"Tiger's Milk × Starfighter",'reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-004','name'=>'Slap N Tickle','answer'=>'BUD','difficulty'=>'Hard','category'=>'Real But Ridiculous','clue'=>'GMO × Grape Pie','reality'=>'Documented as a real cannabis strain name.','source'=>'SeedFinder + Weedmaps'],
    ['id'=>'BOB-005','name'=>'Dog Shit','answer'=>'BUD','difficulty'=>'Medium','category'=>'Real But Ridiculous','clue'=>'Old-school legendary line','reality'=>'Documented as a real cannabis strain name.','source'=>'SeedFinder'],
    ['id'=>'BOB-006','name'=>'Donkey Butter','answer'=>'BUD','difficulty'=>'Medium','category'=>'Real But Ridiculous','clue'=>'Grease Monkey family','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-007','name'=>'Meat Breath','answer'=>'BUD','difficulty'=>'Hard','category'=>'Real But Ridiculous','clue'=>'Meatloaf × Mendo Breath family','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-008','name'=>'Unicorn Poop','answer'=>'BUD','difficulty'=>'Hard','category'=>'Real But Ridiculous','clue'=>'GMO × Sophisticated Lady family','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-009','name'=>'Peanut Butter Breath','answer'=>'BUD','difficulty'=>'Easy','category'=>'Real But Ridiculous','clue'=>'Do-Si-Dos × Mendo Breath family','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-010','name'=>'Garlic Breath','answer'=>'BUD','difficulty'=>'Medium','category'=>'Real But Ridiculous','clue'=>'GMO / Breath-family naming lane','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-011','name'=>'Duct Tape','answer'=>'BUD','difficulty'=>'Medium','category'=>'Real But Ridiculous','clue'=>'GG4 × Do-Si-Dos style lineage','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly'],
    ['id'=>'BOB-012','name'=>'Alaskan Thunder Fuck','answer'=>'BUD','difficulty'=>'Easy','category'=>'Real But Ridiculous','clue'=>'Old-school Alaskan / Matanuska family','reality'=>'Documented as a real cannabis strain name, also known as ATF.','source'=>'Leafly'],
    ['id'=>'BOB-014','name'=>'Jillybean','answer'=>'BUD','difficulty'=>'Medium','category'=>'Real But Ridiculous','clue'=>'Orange Velvet × Space Queen','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-015','name'=>'Afgooey','answer'=>'BUD','difficulty'=>'Medium','category'=>'Real But Ridiculous','clue'=>'Afghani × Maui Haze style background','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-016','name'=>'Poochie Love','answer'=>'BUD','difficulty'=>'Hard','category'=>'Real But Ridiculous','clue'=>'Dogshit clone × Face/Off OG bx1','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-018','name'=>'Monkey Balls','answer'=>'BUD','difficulty'=>'Hard','category'=>'Real But Ridiculous','clue'=>'Purple-family naming lane','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly'],
    ['id'=>'BOB-020','name'=>"Where's My Bike",'answer'=>'BUD','difficulty'=>'Hard','category'=>'Real But Ridiculous','clue'=>'Amnesia × Biker Kush','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-041','name'=>'Cheetah Piss','answer'=>'BUD','difficulty'=>'Medium','category'=>'Real But Ridiculous','clue'=>'Lemonnade × Gelato 42 × London Pound Cake','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-046','name'=>'Cheese Quake','answer'=>'BUD','difficulty'=>'Hard','category'=>'Real But Ridiculous','clue'=>'Cheese × Querkle','reality'=>'Documented as a real cannabis strain name.','source'=>'Leafly + SeedFinder'],
    ['id'=>'BOB-060','name'=>'Wet Wet','answer'=>'BUD','difficulty'=>'Hard','category'=>'Real But Ridiculous','clue'=>'Cheetah Piss × Runtz','reality'=>'Documented as a real cannabis strain name.','source'=>'SeedFinder'],
    ['id'=>'BOB-021','name'=>'Blueberry Parking Lot','answer'=>'BLUFF','difficulty'=>'Medium','category'=>'Fake But Believable','clue'=>'Blueberry Muffin × Asphalt OG','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-022','name'=>"Grandma's Gas Tank",'answer'=>'BLUFF','difficulty'=>'Hard','category'=>'Fake But Believable','clue'=>"Grandpa's Stash × Gas Mask",'reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-023','name'=>'Mango Court Date','answer'=>'BLUFF','difficulty'=>'Hard','category'=>'Fake But Believable','clue'=>'Mango Haze × Jury Duty OG','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-025','name'=>'Glitter Skunk 91','answer'=>'BLUFF','difficulty'=>'Hard','category'=>'Fake But Believable','clue'=>'Skunk #1 × Glitter Bomb','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-026','name'=>'Runtz of Evidence','answer'=>'BLUFF','difficulty'=>'Medium','category'=>'Fake But Believable','clue'=>'White Runtz × Witness OG','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-027','name'=>'Banana Bail Money','answer'=>'BLUFF','difficulty'=>'Hard','category'=>'Fake But Believable','clue'=>'Banana OG × PayDay Kush','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-028','name'=>'Cookies & Confusion','answer'=>'BLUFF','difficulty'=>'Medium','category'=>'Fake But Believable','clue'=>'Forum Cookies × Hazy OG','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-029','name'=>'Sour Tax Refund','answer'=>'BLUFF','difficulty'=>'Hard','category'=>'Fake But Believable','clue'=>'Sour Diesel × PayDay Kush','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-030','name'=>'Pineapple Probation','answer'=>'BLUFF','difficulty'=>'Medium','category'=>'Fake But Believable','clue'=>'Pineapple Express × Parole OG','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-031','name'=>'Diesel Pickle Breath','answer'=>'BLUFF','difficulty'=>'Hard','category'=>'Fake But Believable','clue'=>'Sour Diesel × Garlic Breath','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-032','name'=>'Wedding Cake Wreck','answer'=>'BLUFF','difficulty'=>'Easy','category'=>'Fake But Believable','clue'=>'Wedding Cake × Trainwreck','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-033','name'=>'Blue Zaza Buffet','answer'=>'BLUFF','difficulty'=>'Medium','category'=>'Fake But Believable','clue'=>'Blue Cookies × Zaza','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-034','name'=>'Grape Custody Battle','answer'=>'BLUFF','difficulty'=>'Hard','category'=>'Fake But Believable','clue'=>'Grape Pie × Divorce Cake','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-036','name'=>'Strawberry Courtroom','answer'=>'BLUFF','difficulty'=>'Hard','category'=>'Fake But Believable','clue'=>'Strawberry Cough × Judge OG','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-038','name'=>'Turbo Grandpa Haze','answer'=>'BLUFF','difficulty'=>'Hard','category'=>'Fake But Believable','clue'=>"Grandpa's Stash × Super Silver Haze",'reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-039','name'=>'Cream Soda Felony','answer'=>'BLUFF','difficulty'=>'Medium','category'=>'Fake But Believable','clue'=>'Cream Soda × Felony Fuel','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-040','name'=>'Alien Lunch Money','answer'=>'BLUFF','difficulty'=>'Hard','category'=>'Fake But Believable','clue'=>'Alien OG × PayDay Kush','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-061','name'=>'Blueberry Bootleg','answer'=>'BLUFF','difficulty'=>'Medium','category'=>'Fake But Believable','clue'=>'Blueberry Muffin × Moonshine OG','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-067','name'=>'Mango Bench Warrant','answer'=>'BLUFF','difficulty'=>'Medium','category'=>'Fake But Believable','clue'=>'Mango Haze × Bench Warrant OG','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
    ['id'=>'BOB-076','name'=>'Pineapple Panic Button','answer'=>'BLUFF','difficulty'=>'Hard','category'=>'Fake But Believable','clue'=>'Pineapple Express × Anxiety OG','reality'=>'Created for Bud or Bluff; preliminary exact-name collision pass found no clear strain match.','source'=>'Game-created / recheck before print'],
  ];
}

function shuffle_indices(int $count): array { $idx = range(0, $count - 1); for ($i = $count - 1; $i > 0; $i--) { $j = random_int(0, $i); [$idx[$i], $idx[$j]] = [$idx[$j], $idx[$i]]; } return $idx; }
function player_new(string $name, bool $host = false): array { return ['id'=>rid(),'token'=>rid(24),'name'=>$name,'host'=>$host,'score'=>0,'streak'=>0,'bestStreak'=>0,'doubleUsed'=>false,'vote'=>null,'voteDouble'=>false,'joinedAt'=>now_ms(),'lastSeen'=>now_ms()]; }
function find_player(array $room, string $pid): int { foreach ($room['players'] as $i => $p) if (($p['id'] ?? '') === $pid) return $i; return -1; }
function auth(): array { $code = normalize_code($_GET['code'] ?? ''); $pid = $_SERVER['HTTP_X_PLAYER_ID'] ?? ''; $token = $_SERVER['HTTP_X_PLAYER_TOKEN'] ?? ''; if (!$pid || !$token) fail('Player session required.', 401); $room = room_get($code); $idx = find_player($room, $pid); if ($idx < 0 || !hash_equals($room['players'][$idx]['token'], $token)) fail('Invalid player session.', 401); $room['players'][$idx]['lastSeen'] = now_ms(); return [$room, $idx]; }
function system_msg(array &$room, string $text): void { $room['chat'][] = ['id'=>rid(8),'kind'=>'system','text'=>$text,'at'=>now_ms()]; if (count($room['chat']) > 80) $room['chat'] = array_slice($room['chat'], -80); }
function all_voted(array $room): bool { if (($room['status'] ?? '') !== 'voting') return false; foreach ($room['players'] as $p) if (($p['vote'] ?? null) === null) return false; return count($room['players']) >= 2; }
function current_card(array $room): array { $deck = cards(); $round = intval($room['round'] ?? 0); $index = $room['deckOrder'][$round] ?? null; if ($index === null || !isset($deck[$index])) fail('Card deck is out of sync.', 500); return $deck[$index]; }
function begin_round(array &$room): void { foreach ($room['players'] as &$p) { $p['vote'] = null; $p['voteDouble'] = false; } unset($p); $room['status'] = 'voting'; $room['voteEndsAt'] = now_ms() + BOB_VOTE_MS; $room['revealEndsAt'] = null; $room['lastEvent'] = ['id'=>rid(8),'type'=>'round-start','round'=>$room['round']+1]; }
function reveal_round(array &$room): void {
  if (($room['status'] ?? '') !== 'voting') return;
  $card = current_card($room);
  foreach ($room['players'] as &$p) {
    $vote = $p['vote'] ?? null; $correct = $vote !== null && $vote === $card['answer']; $double = !empty($p['voteDouble']); $delta = $double ? ($correct ? 2 : -1) : ($correct ? 1 : 0);
    $p['score'] += $delta; if ($correct) { $p['streak'] += 1; $p['bestStreak'] = max($p['bestStreak'], $p['streak']); } else { $p['streak'] = 0; } if ($double) $p['doubleUsed'] = true;
  }
  unset($p); $room['status'] = 'reveal'; $room['revealEndsAt'] = now_ms() + BOB_REVEAL_MS; $room['lastEvent'] = ['id'=>rid(8),'type'=>'round-reveal','round'=>$room['round']+1,'answer'=>$card['answer']];
}
function next_round(array &$room): void { if (($room['status'] ?? '') !== 'reveal') return; $room['round'] += 1; if ($room['round'] >= $room['roundLimit']) { $room['status'] = 'finished'; $room['voteEndsAt'] = null; $room['revealEndsAt'] = null; $room['lastEvent'] = ['id'=>rid(8),'type'=>'game-finished']; return; } begin_round($room); }
function advance_clock(array &$room): bool { $changed = false; $now = now_ms(); if (($room['status'] ?? '') === 'voting' && (($room['voteEndsAt'] ?? PHP_INT_MAX) <= $now || all_voted($room))) { reveal_round($room); $changed = true; } if (($room['status'] ?? '') === 'reveal' && ($room['revealEndsAt'] ?? PHP_INT_MAX) <= $now) { next_round($room); $changed = true; } return $changed; }
function public_player(array $p, string $status): array { $base = ['id'=>$p['id'],'name'=>$p['name'],'host'=>$p['host'],'score'=>$p['score'],'streak'=>$p['streak'],'bestStreak'=>$p['bestStreak'],'doubleAvailable'=>!$p['doubleUsed'],'hasVoted'=>$p['vote'] !== null]; if ($status === 'reveal' || $status === 'finished') { $base['vote'] = $p['vote']; $base['usedDouble'] = $p['voteDouble']; } return $base; }
function standings(array $players): array { $copy = array_map(fn($p) => ['id'=>$p['id'],'name'=>$p['name'],'score'=>$p['score'],'bestStreak'=>$p['bestStreak']], $players); usort($copy, fn($a,$b) => ($b['score'] <=> $a['score']) ?: ($b['bestStreak'] <=> $a['bestStreak']) ?: strcmp($a['name'],$b['name'])); return $copy; }
function public_state(array $room, int $meIndex): array {
  $status = $room['status']; $card = null;
  if (in_array($status, ['voting','reveal'], true)) { $raw = current_card($room); $card = ['id'=>$raw['id'],'name'=>$raw['name'],'difficulty'=>$raw['difficulty'],'category'=>$raw['category'],'clue'=>$raw['clue']]; if ($status === 'reveal') { $card['answer']=$raw['answer']; $card['reality']=$raw['reality']; $card['source']=$raw['source']; } }
  return ['code'=>$room['code'],'status'=>$status,'round'=>$room['round']+1,'roundLimit'=>$room['roundLimit'],'voteEndsAt'=>$room['voteEndsAt'],'revealEndsAt'=>$room['revealEndsAt'],'updatedAt'=>$room['updatedAt'],'hostId'=>$room['hostId'],'me'=>public_player($room['players'][$meIndex],$status),'players'=>array_map(fn($p)=>public_player($p,$status),$room['players']),'card'=>$card,'chat'=>$room['chat'],'standings'=>standings($room['players']),'lastEvent'=>$room['lastEvent']];
}

$action = $_GET['action'] ?? 'state';
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') out([], 204);
if ($action === 'create' && $_SERVER['REQUEST_METHOD'] === 'POST') { $b = body(); $name = clean_name($b['name'] ?? ''); $rounds = max(BOB_MIN_ROUNDS, min(BOB_MAX_ROUNDS, intval($b['rounds'] ?? BOB_DEFAULT_ROUNDS))); do { $code = room_code(); $exists = store_get('bob_room_' . $code); } while ($exists); $p = player_new($name, true); $deck = cards(); $room = ['code'=>$code,'status'=>'lobby','hostId'=>$p['id'],'players'=>[$p],'round'=>0,'roundLimit'=>min($rounds,count($deck)),'deckOrder'=>shuffle_indices(count($deck)),'voteEndsAt'=>null,'revealEndsAt'=>null,'chat'=>[],'lastEvent'=>null,'createdAt'=>now_ms(),'updatedAt'=>now_ms()]; system_msg($room, $name . ' opened the room.'); room_save($room); out(['code'=>$code,'playerId'=>$p['id'],'token'=>$p['token']]); }
if ($action === 'join' && $_SERVER['REQUEST_METHOD'] === 'POST') { $b = body(); $code = normalize_code($b['code'] ?? ''); $name = clean_name($b['name'] ?? ''); $room = room_get($code); if ($room['status'] !== 'lobby') fail('This game has already started.'); if (count($room['players']) >= BOB_MAX_PLAYERS) fail('This room is full.'); foreach ($room['players'] as $existing) if (strcasecmp($existing['name'], $name) === 0) fail('That player name is already in this room.'); $p = player_new($name, false); $room['players'][] = $p; system_msg($room, $name . ' joined the room.'); room_save($room); out(['code'=>$code,'playerId'=>$p['id'],'token'=>$p['token']]); }
if ($action === 'active') { $pid = $_SERVER['HTTP_X_PLAYER_ID'] ?? ''; $token = $_SERVER['HTTP_X_PLAYER_TOKEN'] ?? ''; $record = $pid ? store_get('bob_player_' . $pid) : false; if (!$record || !hash_equals($record['token'] ?? '', $token)) out(['game'=>null]); $room = room_get($record['code']); if (($room['status'] ?? '') === 'finished') out(['game'=>null]); $idx = find_player($room, $pid); if ($idx < 0) out(['game'=>null]); out(['game'=>public_state($room,$idx)]); }

[$room, $meIndex] = auth();
if (advance_clock($room)) room_save($room);
$me = $room['players'][$meIndex];
if ($action === 'state' && $_SERVER['REQUEST_METHOD'] === 'GET') { room_save($room); out(public_state($room,$meIndex)); }
if ($action === 'start' && $_SERVER['REQUEST_METHOD'] === 'POST') { if ($me['id'] !== $room['hostId']) fail('Only the host can start the game.', 403); if ($room['status'] !== 'lobby') fail('The game has already started.'); if (count($room['players']) < 2) fail('At least two players are required.'); begin_round($room); system_msg($room, 'The game started. Lock in BUD or BLUFF.'); room_save($room); out(public_state($room,$meIndex)); }
if ($action === 'vote' && $_SERVER['REQUEST_METHOD'] === 'POST') { if ($room['status'] !== 'voting') fail('Voting is closed.'); if (($room['players'][$meIndex]['vote'] ?? null) !== null) fail('Your vote is already locked.'); $b = body(); $vote = strtoupper(trim(strval($b['vote'] ?? ''))); if (!in_array($vote,['BUD','BLUFF'],true)) fail('Vote must be BUD or BLUFF.'); $useDouble = !empty($b['double']); if ($useDouble && $room['players'][$meIndex]['doubleUsed']) fail('Double Hit was already used.'); $room['players'][$meIndex]['vote'] = $vote; $room['players'][$meIndex]['voteDouble'] = $useDouble; $room['lastEvent'] = ['id'=>rid(8),'type'=>'vote-locked','playerId'=>$me['id']]; if (all_voted($room)) reveal_round($room); room_save($room); out(public_state($room,$meIndex)); }
if ($action === 'next' && $_SERVER['REQUEST_METHOD'] === 'POST') { if ($me['id'] !== $room['hostId']) fail('Only the host can advance the round.', 403); if ($room['status'] !== 'reveal') fail('The round is not ready to advance.'); next_round($room); room_save($room); out(public_state($room,$meIndex)); }
if ($action === 'chat' && $_SERVER['REQUEST_METHOD'] === 'POST') { $b = body(); $text = clean_text($b['text'] ?? ''); if ($text === '') fail('Message is empty.'); $room['chat'][] = ['id'=>rid(8),'kind'=>'player','playerId'=>$me['id'],'name'=>$me['name'],'text'=>$text,'at'=>now_ms()]; if (count($room['chat']) > 80) $room['chat'] = array_slice($room['chat'], -80); room_save($room); out(public_state($room,$meIndex)); }
fail('Unsupported request.', 405);
