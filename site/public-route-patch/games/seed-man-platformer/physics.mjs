export const PLAYER_SIZE = { width: 34, height: 46 };
export const DEFAULTS = Object.freeze({
  moveSpeed: 270,
  groundAcceleration: 2600,
  groundDeceleration: 3200,
  airAcceleration: 1600,
  airDeceleration: 700,
  jumpSpeed: 640,
  doubleJumpSpeed: 590,
  gravity: 1450,
  jumpCutGravityMultiplier: 2.35,
  maxFallSpeed: 900,
  coyoteTime: 0.11,
  jumpBuffer: 0.12,
  maxAirJumps: 1
});

export function overlaps(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

export function approach(current, target, maxDelta) {
  if (current < target) return Math.min(target, current + maxDelta);
  if (current > target) return Math.max(target, current - maxDelta);
  return target;
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
    airJumpsRemaining: DEFAULTS.maxAirJumps,
    checkpoint: { x: spawn.x, y: spawn.y, id: 'start' },
    collected: [],
    power: { invulnerableTimer: 0 },
    deaths: 0,
    finished: false,
    finishBlocked: false,
    missingPickups: 0,
    state: 'idle'
  };
}

function solidCollisionX(player, platform) {
  if (!overlaps(player, platform)) return;
  if (player.vx > 0) player.x = platform.x - player.width;
  else if (player.vx < 0) player.x = platform.x + platform.width;
  player.vx = 0;
}

function solidCollisionY(player, platform, config) {
  if (!overlaps(player, platform)) return;
  if (player.vy > 0) {
    player.y = platform.y - player.height;
    player.vy = 0;
    player.grounded = true;
    player.airJumpsRemaining = config.maxAirJumps;
  } else if (player.vy < 0) {
    player.y = platform.y + platform.height;
    player.vy = 0;
  }
}

function respawn(player, config) {
  player.x = player.checkpoint.x;
  player.y = player.checkpoint.y;
  player.vx = 0;
  player.vy = 0;
  player.grounded = false;
  player.coyote = 0;
  player.jumpBuffer = 0;
  player.airJumpsRemaining = config.maxAirJumps;
  player.power = player.power || {};
  player.power.invulnerableTimer = 0.45;
  player.deaths += 1;
  player.finishBlocked = false;
  player.state = 'hurt';
}

function pickupRequirement(level) {
  const explicit = Number(level?.requiredPickups);
  if (Number.isInteger(explicit) && explicit >= 0) return explicit;
  return Array.isArray(level?.pickups) ? level.pickups.length : 0;
}

function checkpointsFor(level) {
  if (Array.isArray(level?.checkpoints)) return level.checkpoints;
  return level?.checkpoint ? [level.checkpoint] : [];
}

export function stepPlayer(inputPlayer, input, level, dt, config = DEFAULTS) {
  const player = JSON.parse(JSON.stringify(inputPlayer));
  if (player.finished) return player;
  player.power = player.power || { invulnerableTimer: 0 };
  player.power.invulnerableTimer = Math.max(0, Number(player.power.invulnerableTimer || 0));
  if (!Number.isInteger(player.airJumpsRemaining)) player.airJumpsRemaining = config.maxAirJumps;

  const step = Math.min(Math.max(dt, 0), 1 / 20);
  const requiredPickups = pickupRequirement(level);
  player.power.invulnerableTimer = Math.max(0, player.power.invulnerableTimer - step);
  player.finishBlocked = false;
  player.missingPickups = Math.max(0, requiredPickups - player.collected.length);

  player.jumpBuffer = input.jumpPressed ? config.jumpBuffer : Math.max(0, player.jumpBuffer - step);
  player.coyote = player.grounded ? config.coyoteTime : Math.max(0, player.coyote - step);

  const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const targetVx = direction * config.moveSpeed;
  const acceleration = player.grounded ? config.groundAcceleration : config.airAcceleration;
  const deceleration = player.grounded ? config.groundDeceleration : config.airDeceleration;
  player.vx = approach(player.vx, targetVx, (direction === 0 ? deceleration : acceleration) * step);

  let jumped = false;
  if (player.jumpBuffer > 0 && player.coyote > 0) {
    player.vy = -config.jumpSpeed;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    jumped = true;
  } else if (input.jumpPressed && player.airJumpsRemaining > 0) {
    player.vy = -config.doubleJumpSpeed;
    player.grounded = false;
    player.coyote = 0;
    player.jumpBuffer = 0;
    player.airJumpsRemaining -= 1;
    jumped = true;
  }

  if (jumped) player.state = player.airJumpsRemaining < config.maxAirJumps ? 'double-jump' : 'jump';

  player.x += player.vx * step;
  player.x = Math.max(0, Math.min(Math.max(0, level.worldWidth - player.width), player.x));
  for (const platform of level.platforms) solidCollisionX(player, platform);

  player.grounded = false;
  const jumpCut = !jumped && input.jumpHeld === false && player.vy < 0;
  const gravityMultiplier = jumpCut ? config.jumpCutGravityMultiplier : 1;
  player.vy = Math.min(config.maxFallSpeed, player.vy + config.gravity * gravityMultiplier * step);
  player.y += player.vy * step;
  for (const platform of level.platforms) solidCollisionY(player, platform, config);

  for (const pickup of level.pickups || []) {
    if (!player.collected.includes(pickup.id) && overlaps(player, pickup)) player.collected.push(pickup.id);
  }
  player.missingPickups = Math.max(0, requiredPickups - player.collected.length);

  for (const checkpoint of checkpointsFor(level)) {
    if (overlaps(player, checkpoint)) {
      player.checkpoint = {
        x: checkpoint.respawnX,
        y: checkpoint.respawnY,
        id: checkpoint.id || `${checkpoint.respawnX}:${checkpoint.respawnY}`
      };
    }
  }

  const hitHazard = (level.hazards || []).some((hazard) => overlaps(player, hazard)) || player.y > level.worldHeight + 160;
  if (hitHazard && player.power.invulnerableTimer <= 0) {
    respawn(player, config);
    return player;
  }

  if (level.finish && player.x + player.width >= level.finish.x) {
    player.finished = true;
    player.finishBlocked = false;
    player.vx = 0;
    player.vy = 0;
    player.state = 'finish';
    return player;
  }

  if (!player.grounded && player.state !== 'double-jump') player.state = player.vy < 0 ? 'jump' : 'fall';
  else if (player.grounded && Math.abs(player.vx) > 1) player.state = 'run';
  else if (player.grounded) player.state = 'idle';
  return player;
}
