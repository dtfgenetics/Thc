import { createVisualRuntimeV2 } from '../render/visual-runtime-v2.mjs';
import { createLevelRuntime } from './level-runtime.mjs';
import { createWorldVisualSystem } from './world-visual-system.mjs';

export function createProductionAssets({manifest,levels,enemies,bosses,recipes,worlds,powerups,baseUrl='./'}={}){
  const visual=createVisualRuntimeV2(manifest,{baseUrl});
  const levelRuntime=createLevelRuntime(levels,{enemyCatalog:enemies,bossCatalog:bosses,recipeCatalog:recipes});
  const worldVisuals=worlds?createWorldVisualSystem(worlds,manifest):null;
  return Object.freeze({visual,levels:levelRuntime,worldVisuals,powerups:powerups||null,ready:true});
}
