import { createVisualRuntimeV2 } from '../render/visual-runtime-v2.mjs';
import { createLevelRuntime } from './level-runtime.mjs';

export function createProductionAssets({manifest,levels,enemies,bosses,baseUrl='./'}={}){
  const visual=createVisualRuntimeV2(manifest,{baseUrl});
  const levelRuntime=createLevelRuntime(levels,{enemyCatalog:enemies,bossCatalog:bosses});
  return Object.freeze({visual,levels:levelRuntime,ready:true});
}
