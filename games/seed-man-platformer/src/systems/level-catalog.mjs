export function validateLevelCatalog(catalog,{expectedCount=20}={}){
  if(!catalog||catalog.id!=='seed-man-levels-20-v1') throw new Error('Invalid Seed Man level catalog id');
  if(!Array.isArray(catalog.levels)||catalog.levels.length!==expectedCount) throw new Error(`Seed Man level catalog must contain ${expectedCount} levels`);
  const ids=new Set();
  const orders=new Set();
  for(const level of catalog.levels){
    if(!level.id||ids.has(level.id)) throw new Error(`Duplicate or missing Seed Man level id: ${level.id}`);
    if(!Number.isInteger(level.order)||orders.has(level.order)) throw new Error(`Duplicate or invalid Seed Man level order: ${level.order}`);
    if(!level.world||!level.background||!level.tiles) throw new Error(`Seed Man level ${level.id} missing visual keys`);
    if(!Array.isArray(level.enemyPool)||!Array.isArray(level.hazards)||!Array.isArray(level.mechanics)) throw new Error(`Seed Man level ${level.id} missing gameplay arrays`);
    ids.add(level.id);orders.add(level.order);
  }
  const expected=Array.from({length:expectedCount},(_,i)=>i+1);
  const actual=[...orders].sort((a,b)=>a-b);
  if(expected.some((value,index)=>value!==actual[index])) throw new Error('Seed Man level ordering must be contiguous 1..20');
  return catalog;
}

export function buildLevelIndex(catalog){
  validateLevelCatalog(catalog);
  return new Map(catalog.levels.map(level=>[level.id,Object.freeze({...level})]));
}

export function getWorldLevels(catalog,worldKey){
  validateLevelCatalog(catalog);
  return catalog.levels.filter(level=>level.world===worldKey).sort((a,b)=>a.order-b.order);
}

export function getNextLevel(catalog,currentId){
  validateLevelCatalog(catalog);
  const current=catalog.levels.find(level=>level.id===currentId);
  if(!current) throw new Error(`Unknown Seed Man level ${currentId}`);
  return catalog.levels.find(level=>level.order===current.order+1)||null;
}

export function getBossLevels(catalog){
  validateLevelCatalog(catalog);
  return catalog.levels.filter(level=>Boolean(level.boss));
}
