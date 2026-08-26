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
function fail(string $message, int $status = 400): void { out(['error'=>$message], $status); }
function body(): array { $data=json_decode(file_get_contents('php://input') ?: '{}', true); if(!is_array($data)) fail('Invalid JSON body.'); return $data; }
function cut_text(string $v,int $n): string { return function_exists('mb_substr') ? mb_substr($v,0,$n) : substr($v,0,$n); }
function clean_name($v): string { $v=trim(preg_replace('/[\x00-\x1F\x7F]/u','',strval($v))); if($v==='') fail('Player name is required.'); return cut_text($v,24); }
function clean_text($v): string { return cut_text(trim(preg_replace('/[\x00-\x1F\x7F]/u',' ',strval($v))),240); }
function rid(int $bytes=12): string { return rtrim(strtr(base64_encode(random_bytes($bytes)),'+/','-_'),'='); }
function now_ms(): int { return (int)round(microtime(true)*1000); }
function room_code(): string { $a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; $s=''; for($i=0;$i<6;$i++)$s.=$a[random_int(0,strlen($a)-1)]; return $s; }
function normalize_code($v): string { $c=strtoupper(trim(strval($v))); if(!preg_match('/^[A-Z0-9]{6}$/',$c)) fail('A valid 6-character room code is required.'); return $c; }
function cards(): array { static $deck=null; if($deck===null){ $file=__DIR__.'/deck.php'; if(!is_file($file)) fail('Private card deck is not built.',500); $deck=require $file; if(!is_array($deck)||count($deck)<2) fail('Private card deck is invalid.',500); } return $deck; }

$root=dirname(__DIR__,2).'/wp-load.php';
$useWp=is_file($root);
if($useWp) require_once $root;
function store_get(string $key){ global $useWp; if($useWp) return get_transient($key); $p=sys_get_temp_dir().'/'.$key.'.json'; if(!is_file($p)) return false; $d=json_decode(file_get_contents($p),true); if(!is_array($d)||($d['_expires']??0)<time()){ @unlink($p); return false; } unset($d['_expires']); return $d; }
function store_set(string $key,array $value,int $ttl=BOB_TTL): void { global $useWp; if($useWp){ set_transient($key,$value,$ttl); return; } $value['_expires']=time()+$ttl; file_put_contents(sys_get_temp_dir().'/'.$key.'.json',json_encode($value),LOCK_EX); }
function room_get(string $code): array { $room=store_get('bob_room_'.$code); if(!$room) fail('Room not found or expired.',404); return $room; }
function room_save(array $room): void { $room['updatedAt']=now_ms(); store_set('bob_room_'.$room['code'],$room); foreach($room['players'] as $p) store_set('bob_player_'.$p['id'],['code'=>$room['code'],'token'=>$p['token']],BOB_TTL); }
function room_lock(string $code){ $fh=fopen(sys_get_temp_dir().'/bob_lock_'.$code.'.lock','c'); if(!$fh||!flock($fh,LOCK_EX)) fail('Could not lock room state.',503); return $fh; }
function room_unlock($fh): void { if(is_resource($fh)){ flock($fh,LOCK_UN); fclose($fh); } }
function locked_out($fh,array $payload,int $status=200): void { room_unlock($fh); out($payload,$status); }

function shuffled_indices(int $count): array { $a=range(0,$count-1); for($i=$count-1;$i>0;$i--){$j=random_int(0,$i);[$a[$i],$a[$j]]=[$a[$j],$a[$i]];} return $a; }
function new_player(string $name,bool $host=false): array { return ['id'=>rid(),'token'=>rid(24),'name'=>$name,'host'=>$host,'score'=>0,'streak'=>0,'bestStreak'=>0,'doubleUsed'=>false,'vote'=>null,'voteDouble'=>false,'joinedAt'=>now_ms(),'lastSeen'=>now_ms()]; }
function find_player(array $room,string $pid): int { foreach($room['players'] as $i=>$p) if(($p['id']??'')===$pid) return $i; return -1; }
function auth_room(array &$room): int { $pid=$_SERVER['HTTP_X_PLAYER_ID']??''; $token=$_SERVER['HTTP_X_PLAYER_TOKEN']??''; if(!$pid||!$token) fail('Player session required.',401); $i=find_player($room,$pid); if($i<0||!hash_equals($room['players'][$i]['token'],$token)) fail('Invalid player session.',401); $room['players'][$i]['lastSeen']=now_ms(); return $i; }
function system_msg(array &$room,string $text): void { $room['chat'][]=['id'=>rid(8),'kind'=>'system','text'=>$text,'at'=>now_ms()]; if(count($room['chat'])>80)$room['chat']=array_slice($room['chat'],-80); }
function current_card(array $room): array { $deck=cards(); $idx=$room['deckOrder'][$room['round']]??null; if($idx===null||!isset($deck[$idx])) fail('Card deck is out of sync.',500); return $deck[$idx]; }
function all_voted(array $room): bool { if(($room['status']??'')!=='voting'||count($room['players'])<2) return false; foreach($room['players'] as $p) if(($p['vote']??null)===null) return false; return true; }
function begin_round(array &$room): void { foreach($room['players'] as &$p){$p['vote']=null;$p['voteDouble']=false;} unset($p); $room['status']='voting'; $room['voteEndsAt']=now_ms()+BOB_VOTE_MS; $room['revealEndsAt']=null; $room['lastEvent']=['id'=>rid(8),'type'=>'round-start','round'=>$room['round']+1]; }
function reveal_round(array &$room): void { if(($room['status']??'')!=='voting') return; $card=current_card($room); foreach($room['players'] as &$p){ $correct=($p['vote']??null)===$card['answer']; $double=!empty($p['voteDouble']); $p['score'] += $double ? ($correct?2:-1) : ($correct?1:0); if($correct){$p['streak']++;$p['bestStreak']=max($p['bestStreak'],$p['streak']);}else{$p['streak']=0;} if($double)$p['doubleUsed']=true; } unset($p); $room['status']='reveal'; $room['revealEndsAt']=now_ms()+BOB_REVEAL_MS; $room['lastEvent']=['id'=>rid(8),'type'=>'round-reveal','round'=>$room['round']+1,'answer'=>$card['answer']]; }
function next_round(array &$room): void { if(($room['status']??'')!=='reveal') return; $room['round']++; if($room['round'] >= $room['roundLimit']){ $room['status']='finished'; $room['voteEndsAt']=null; $room['revealEndsAt']=null; $room['lastEvent']=['id'=>rid(8),'type'=>'game-finished']; return; } begin_round($room); }
function advance_clock(array &$room): bool { $changed=false;$now=now_ms(); if(($room['status']??'')==='voting'&&(($room['voteEndsAt']??PHP_INT_MAX)<=$now||all_voted($room))){reveal_round($room);$changed=true;} if(($room['status']??'')==='reveal'&&($room['revealEndsAt']??PHP_INT_MAX)<=$now){next_round($room);$changed=true;} return $changed; }
function public_player(array $p,string $status): array { $x=['id'=>$p['id'],'name'=>$p['name'],'host'=>$p['host'],'score'=>$p['score'],'streak'=>$p['streak'],'bestStreak'=>$p['bestStreak'],'doubleAvailable'=>!$p['doubleUsed'],'hasVoted'=>$p['vote']!==null]; if(in_array($status,['reveal','finished'],true)){ $x['vote']=$p['vote'];$x['usedDouble']=$p['voteDouble']; } return $x; }
function standings(array $players): array { $x=array_map(fn($p)=>['id'=>$p['id'],'name'=>$p['name'],'score'=>$p['score'],'bestStreak'=>$p['bestStreak']],$players); usort($x,fn($a,$b)=>($b['score']<=>$a['score'])?:($b['bestStreak']<=>$a['bestStreak'])?:strcmp($a['name'],$b['name'])); return $x; }
function public_state(array $room,int $meIndex): array { $status=$room['status'];$card=null; if(in_array($status,['voting','reveal'],true)){ $raw=current_card($room);$card=['id'=>$raw['id'],'name'=>$raw['name'],'difficulty'=>$raw['difficulty'],'category'=>$raw['category'],'clue'=>$raw['clue']]; if($status==='reveal'){$card['answer']=$raw['answer'];$card['reality']=$raw['reality'];$card['source']=$raw['source'];} } $me=public_player($room['players'][$meIndex],$status); if($status==='voting'){$me['vote']=$room['players'][$meIndex]['vote'];$me['usedDouble']=$room['players'][$meIndex]['voteDouble'];} return ['code'=>$room['code'],'status'=>$status,'round'=>$room['round']+1,'roundLimit'=>$room['roundLimit'],'voteEndsAt'=>$room['voteEndsAt'],'revealEndsAt'=>$room['revealEndsAt'],'updatedAt'=>$room['updatedAt'],'hostId'=>$room['hostId'],'me'=>$me,'players'=>array_map(fn($p)=>public_player($p,$status),$room['players']),'card'=>$card,'chat'=>$room['chat'],'standings'=>standings($room['players']),'lastEvent'=>$room['lastEvent']]; }

$action=$_GET['action']??'state';
if($_SERVER['REQUEST_METHOD']==='OPTIONS') out([],204);
if($action==='create'&&$_SERVER['REQUEST_METHOD']==='POST'){ $b=body();$name=clean_name($b['name']??'');$rounds=max(BOB_MIN_ROUNDS,min(BOB_MAX_ROUNDS,intval($b['rounds']??BOB_DEFAULT_ROUNDS))); do{$code=room_code();$exists=store_get('bob_room_'.$code);}while($exists); $p=new_player($name,true);$deck=cards();$room=['code'=>$code,'status'=>'lobby','hostId'=>$p['id'],'players'=>[$p],'round'=>0,'roundLimit'=>min($rounds,count($deck)),'deckOrder'=>shuffled_indices(count($deck)),'voteEndsAt'=>null,'revealEndsAt'=>null,'chat'=>[],'lastEvent'=>null,'createdAt'=>now_ms(),'updatedAt'=>now_ms()];system_msg($room,$name.' opened the room.');room_save($room);out(['code'=>$code,'playerId'=>$p['id'],'token'=>$p['token']]); }
if($action==='join'&&$_SERVER['REQUEST_METHOD']==='POST'){ $b=body();$code=normalize_code($b['code']??'');$name=clean_name($b['name']??'');$lock=room_lock($code);$room=room_get($code);if($room['status']!=='lobby')fail('This game has already started.');if(count($room['players'])>=BOB_MAX_PLAYERS)fail('This room is full.');foreach($room['players'] as $p)if(strcasecmp($p['name'],$name)===0)fail('That player name is already in this room.');$p=new_player($name);$room['players'][]=$p;system_msg($room,$name.' joined the room.');room_save($room);locked_out($lock,['code'=>$code,'playerId'=>$p['id'],'token'=>$p['token']]); }
if($action==='active'){ $pid=$_SERVER['HTTP_X_PLAYER_ID']??'';$token=$_SERVER['HTTP_X_PLAYER_TOKEN']??'';$record=$pid?store_get('bob_player_'.$pid):false;if(!$record||!hash_equals($record['token']??'',$token))out(['game'=>null]);$room=room_get($record['code']);if(($room['status']??'')==='finished')out(['game'=>null]);$i=find_player($room,$pid);if($i<0)out(['game'=>null]);out(['game'=>public_state($room,$i)]); }

$code=normalize_code($_GET['code']??'');$lock=room_lock($code);$room=room_get($code);$meIndex=auth_room($room);if(advance_clock($room))room_save($room);$me=$room['players'][$meIndex];
if($action==='state'&&$_SERVER['REQUEST_METHOD']==='GET'){room_save($room);locked_out($lock,public_state($room,$meIndex));}
if($action==='start'&&$_SERVER['REQUEST_METHOD']==='POST'){if($me['id']!==$room['hostId'])fail('Only the host can start the game.',403);if($room['status']!=='lobby')fail('The game has already started.');if(count($room['players'])<2)fail('At least two players are required.');begin_round($room);system_msg($room,'The game started. Lock in BUD or BLUFF.');room_save($room);locked_out($lock,public_state($room,$meIndex));}
if($action==='vote'&&$_SERVER['REQUEST_METHOD']==='POST'){if($room['status']!=='voting')fail('Voting is closed.');if(($room['players'][$meIndex]['vote']??null)!==null)fail('Your vote is already locked.');$b=body();$vote=strtoupper(trim(strval($b['vote']??'')));if(!in_array($vote,['BUD','BLUFF'],true))fail('Vote must be BUD or BLUFF.');$double=!empty($b['double']);if($double&&$room['players'][$meIndex]['doubleUsed'])fail('Double Hit was already used.');$room['players'][$meIndex]['vote']=$vote;$room['players'][$meIndex]['voteDouble']=$double;$room['lastEvent']=['id'=>rid(8),'type'=>'vote-locked','playerId'=>$me['id']];if(all_voted($room))reveal_round($room);room_save($room);locked_out($lock,public_state($room,$meIndex));}
if($action==='next'&&$_SERVER['REQUEST_METHOD']==='POST'){if($me['id']!==$room['hostId'])fail('Only the host can advance the round.',403);if($room['status']!=='reveal')fail('The round is not ready to advance.');next_round($room);room_save($room);locked_out($lock,public_state($room,$meIndex));}
if($action==='chat'&&$_SERVER['REQUEST_METHOD']==='POST'){ $b=body();$text=clean_text($b['text']??'');if($text==='')fail('Message is empty.');$room['chat'][]=['id'=>rid(8),'kind'=>'player','playerId'=>$me['id'],'name'=>$me['name'],'text'=>$text,'at'=>now_ms()];if(count($room['chat'])>80)$room['chat']=array_slice($room['chat'],-80);room_save($room);locked_out($lock,public_state($room,$meIndex)); }
fail('Unsupported request.',405);
