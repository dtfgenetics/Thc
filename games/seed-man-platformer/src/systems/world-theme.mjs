export const WORLD_THEMES=Object.freeze({
  'greenhouse-valley':Object.freeze({background:'world.greenhouse-valley.background',terrain:['grass','dirt','wood'],hazards:['spikes','toxic-slime'],ambient:['waterfall','leaves']}),
  'forest-ruins':Object.freeze({background:'world.forest-ruins.background',terrain:['grass','rock','wood'],hazards:['thorn-pits','spore-cloud'],ambient:['fog','leaves']}),
  'desert-canyon':Object.freeze({background:'world.desert-canyon.background',terrain:['sand','rock','stone'],hazards:['lava','rockfall'],ambient:['dust','heat-haze']}),
  'frozen-peaks':Object.freeze({background:'world.frozen-peaks.background',terrain:['ice','rock','metal'],hazards:['ice-spikes','falling-icicles'],ambient:['snow','wind']}),
  'eco-city':Object.freeze({background:'world.eco-city.background',terrain:['metal','grass','stone'],hazards:['electric-floor','toxic-slime','laser-grid'],ambient:['energy','waterfall']})
});

export function getWorldTheme(key){const theme=WORLD_THEMES[key];if(!theme)throw new Error(`Unknown Seed Man world theme ${key}`);return theme;}
