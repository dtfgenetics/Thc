export const PLAYER_SIZE = { width: 34, height: 46 };
export const DEFAULTS = Object.freeze({
  moveSpeed: 250,
  jumpSpeed: 520,
  gravity: 1450,
  maxFallSpeed: 900,
  coyoteTime: 0.09,
  jumpBuffer: 0.1
});

export function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function createPlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    width: PLAYER_SIZE.width,
    height: PLAYER_SIZE.height,
    vx: 0,
    vy: 0,
    grounded: false,
    coyote: 0,
    jumpBuffer: 0,
    checkpoint: { x: spawn.x, y: spawn.y },
    collected: [],
    deaths: 0,
    finished: false,
    state: 'idle'
  };
}

function solidCollisionX(player, platform) {
  if (!overlaps(player, platform)) return;
  if (player.vx > 0) player.x = platform.x - player.width;
  else if (player.vx < 0) player.x = platform.x + platform.width;
  player.vx = 0;
}

function solidCollisionY(player, platform) {
  if (!overlaps(player, platform)) return;
  if (player.vy > 0) {
    player.y = platform.y - player.height;
    player.vy = 0;
    player.grounded = true;
  } else if (player.vy < 0) {
    player.y = platform.y + platform.height;
    player.vy = 0;
  }
}

function respawn(player) {
  player.x = player.checkpoint.x;
  player.y = player.checkpoint.y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.deaths += 1;
  player.state = 'hurt';
}

export function stepPlayer(inputPlayer, input, level, dt, config = DEFAULTS) {
  const player = JSON.parse(JSON.stringify(inputPlayer));
  if (player.finished) return player;
  const step = Math.min(Math.max(dt, 0), 1 / 20);

  player.jumpBuffer = input.jumpPressed ? config.jumpBuffer : Math.max(0, player.jumpBuffer - step);
  player.coyote = player.grounded ? config.coyoteTime : Math.max(0, player.coyote - step);

  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  player.vx = direction * config.moveSpeed;
  if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = -config.jumpSpeed;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
  }

  player.x += player.vx * step;
  for (const platform of level.platforms) solidCollisionX(player, platform);

  player.grounded = false;
  player.vy = Math.min(config.maxFallSpeed, player.vy + config.gravity * step);
  player.y += player.vy * step;
  for (const platform of level.platforms) solidCollisionY(player, platform);

  for (const pickup of level.pickups) {
    if (!player.collected.includes(pickup.id) && overlaps(player, pickup)) player.collected.push(pickup.id);
  }

  if (level.checkpoint && overlaps(player, level.checkpoint)) {
    player.checkpoint = { x: level.checkpoint.respawnX, y: level.checkpoint.respawnY };
  }

  if (level.hazards.some((hazard) => overlaps(player, hazard)) || player.y > level.worldHeight + 160) {
    respawn(player);
    return player;
  }

  if (level.finish && overlaps(player, level.finish)) {
    player.finished = true;
    player.vx = 0;
    player.vy = 0;
    player.state = 'finish';
    return player;
  }

  if (!player.grounded) player.state = player.vy < 0 ? 'jump' : 'fall';
  else if (Math.abs(player.vx) > 1) player.state = 'run';
  else player.state = 'idle';
  return player;
}
