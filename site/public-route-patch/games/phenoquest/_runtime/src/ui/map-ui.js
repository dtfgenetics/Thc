function findNpcAt(map, x, y) {
  return (map.npcs ?? []).find((npc) => npc.x === x && npc.y === y) ?? null;
}

function findObjectAt(map, x, y) {
  return (map.objects ?? []).find((object) => object.x === x && object.y === y) ?? null;
}

export function renderMapGrid({ container, map, player }) {
  if (!container || !map) return;

  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'map-grid';
  grid.style.setProperty('--map-width', map.width);

  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const tile = document.createElement('div');
      tile.className = 'map-tile';
      tile.dataset.x = x;
      tile.dataset.y = y;

      const npc = findNpcAt(map, x, y);
      const object = findObjectAt(map, x, y);

      if (npc) {
        tile.classList.add('npc-tile');
        tile.title = npc.id;
        tile.textContent = '●';
      }

      if (object) {
        tile.classList.add('object-tile');
        tile.title = object.id;
        tile.textContent = '■';
      }

      if (player?.position?.x === x && player?.position?.y === y) {
        tile.classList.add('player-tile');
        tile.textContent = '◆';
      }

      if (map.blocked?.some((blocked) => blocked.x === x && blocked.y === y)) {
        tile.classList.add('blocked-tile');
      }

      grid.appendChild(tile);
    }
  }

  container.appendChild(grid);
}

export function renderMapLabel({ container, map, player }) {
  if (!container || !map) return;
  const facing = player.facing ? ` Facing:${player.facing}` : '';
  container.textContent = `${map.displayName} — X:${player.position.x} Y:${player.position.y}${facing}`;
}
