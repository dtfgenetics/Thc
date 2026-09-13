import { buildLevelIndex } from './level-catalog.mjs';
import { getWorldTheme } from './world-theme.mjs';
import { buildAuthoredLayoutIndex } from './authored-layout-compiler.mjs';

export function createLevelRuntime(catalog,{enemyCatalog,bossCatalog,recipeCatalog}={}){
  const index=buildLevelIndex(catalog);
  const authored=recipeCatalog?buildAuthoredLayoutIndex(recipeCatalog,catalog):new Map();
  return Object.freeze({
    get(id){
      const level=index.get(id);
      if(!level)throw new Error(`Unknown Seed Man level ${id}`);
      const theme=getWorldTheme(level.world);
      const layout=level.layout||authored.get(id)||null;
      const resolvedLength=layout?.length||level.length;
      return Object.freeze({
        ...level,
        length:resolvedLength,
        layout,
        authored:Boolean(layout&&['authored','authored-recipe'].includes(layout.mode)),
        theme,
        enemies:level.enemyPool.map(key=>enemyCatalog?.common?.[key]||{id:key}),
        boss:level.boss?(bossCatalog?.bosses?.[level.boss]||{id:level.boss}):null
      });
    },
    ids:()=>Object.freeze([...index.keys()]),
    authoredIds:()=>Object.freeze([...index.keys()].filter((id)=>Boolean(index.get(id)?.layout||authored.get(id)))),
    count:index.size
  });
}
