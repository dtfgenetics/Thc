const REQUIRED_LAYERS=Object.freeze(['sky','far-bg','mid-bg','near-bg','gameplay','foreground','vfx']);

export function createWorldVisualSystem(worldCatalog,artManifest){
  const worlds=worldCatalog?.worlds||{};
  return Object.freeze({
    ids:()=>Object.freeze(Object.keys(worlds)),
    get(worldId){
      const world=worlds[worldId];
      if(!world)throw new Error(`Unknown Seed Man world: ${worldId}`);
      const layerMap=world.layerAssetKeys||{};
      const layers=REQUIRED_LAYERS.map((layer)=>{
        const key=layerMap[layer];
        if(!key)throw new Error(`Missing ${worldId} visual layer key: ${layer}`);
        const asset=artManifest?.assets?.[key]||null;
        return Object.freeze({layer,key,asset,ready:Boolean(asset?.src),renderer:asset?.renderer||null,fallbackRenderer:asset?.fallbackRenderer||null});
      });
      return Object.freeze({...world,layers:Object.freeze(layers)});
    },
    readiness(worldId){
      const resolved=this.get(worldId);
      const authored=resolved.layers.filter((layer)=>layer.ready).length;
      return Object.freeze({worldId,required:REQUIRED_LAYERS.length,authored,complete:authored===REQUIRED_LAYERS.length});
    }
  });
}

export { REQUIRED_LAYERS };
