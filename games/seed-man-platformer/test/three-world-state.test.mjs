import assert from 'node:assert/strict';
import {
  buildPlayerLightState,
  buildThreeCameraState,
  buildThreeWorldDescriptor,
  gameRectToWorldBox
} from '../src/render/three-world-state.mjs';

const level = {
  worldWidth: 7800,
  worldHeight: 540,
  platforms: [
    { id: 'ground-a', x: 0, y: 500, width: 960, height: 40 },
    { id: 'ledge-a', x: 1040, y: 390, width: 240, height: 24 }
  ],
  hazards: [
    { id: 'hazard-a', x: 720, y: 486, width: 120, height: 14 }
  ],
  checkpoints: [
    { id: 'cp-1', x: 2500, y: 420, width: 40, height: 80, respawnX: 2480, respawnY: 350 }
  ],
  finish: { id: 'finish', x: 7700, y: 380, width: 48, height: 120 }
};

const ground = gameRectToWorldBox(level.platforms[0], level.worldHeight, {
  pixelsPerUnit: 80,
  depth: 0.85
});
assert.equal(ground.id, 'ground-a');
assert.deepEqual(ground.size, { x: 12, y: 0.5, z: 0.85 });
assert.equal(ground.position.x, 6);
assert.equal(ground.position.y, 0.25);

const descriptor = buildThreeWorldDescriptor(level);
assert.equal(descriptor.version, 'seed-man-three-world-v1');
assert.equal(descriptor.world.width, 97.5);
assert.equal(descriptor.world.height, 6.75);
assert.equal(descriptor.platforms.length, 2);
assert.equal(descriptor.hazards.length, 1);
assert.equal(descriptor.checkpoints.length, 1);
assert.equal(descriptor.finish.id, 'finish');
assert.equal(descriptor.checkpoints[0].source.id, 'cp-1');

const cameraAtStart = buildThreeCameraState({
  cameraX: 0,
  viewportWidth: 960,
  viewportHeight: 540,
  worldHeight: 540,
  pixelsPerUnit: 80
});
assert.deepEqual(cameraAtStart.center, { x: 6, y: 3.375, z: 0 });
assert.deepEqual(cameraAtStart.visible, { width: 12, height: 6.75 });
assert.equal(cameraAtStart.aspect, 960 / 540);

const cameraLater = buildThreeCameraState({
  cameraX: 1600,
  viewportWidth: 960,
  viewportHeight: 540,
  worldHeight: 540,
  pixelsPerUnit: 80
});
assert.equal(cameraLater.center.x, 26);
assert.equal(cameraLater.center.y, 3.375);

const playerLight = buildPlayerLightState({
  x: 80,
  y: 414,
  width: 34,
  height: 46
}, 540, { pixelsPerUnit: 80, z: 2.2 });
assert.equal(playerLight.x, 97 / 80);
assert.equal(playerLight.y, (540 - 437) / 80);
assert.equal(playerLight.z, 2.2);

assert.throws(
  () => buildThreeWorldDescriptor({ ...level, worldWidth: 0 }),
  /worldWidth must be greater than zero/
);
assert.throws(
  () => gameRectToWorldBox({ x: 0, y: 0, width: -1, height: 5 }, 540),
  /width must be greater than zero/
);

console.log('Seed Man Three.js render bridge tests passed.');
