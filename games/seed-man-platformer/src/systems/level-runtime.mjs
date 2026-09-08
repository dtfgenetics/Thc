import { buildLevelIndex } from './level-catalog.mjs';
import { getWorldTheme } from './world-theme.mjs';

export function createLevelRuntime(catalog,{enemyCatalog,bossCatalog}={}){
  const index=buildLevelIndex(catalog);
  return Object.freeze({
    get(id){const level=index.get(id);if(!level)throw new Error(`Unknown Seed Man level ${id}`);const theme=getWorldTheme(level.world);return Object.freeze({...level,theme,enemies:level.enemyPool.map(key=>enemyCatalog?.common?.[key]||{id:key}),boss:level.boss?(bossCatalog?.bosses?.[level.boss]||{id:level.boss}):null});},
    ids:()=>Object.freeze([...index.keys()]),
    count:index.size
  });
}
