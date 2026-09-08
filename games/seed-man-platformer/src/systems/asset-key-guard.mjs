const RAW_ASSET_PATTERN=/\.(?:png|jpe?g|webp|svg|gif)$/i;

export function assertManifestAssetKey(value,{allowData=false}={}){
  if(typeof value!=='string'||!value.trim()) throw new Error('Asset reference must be a manifest key');
  if(!allowData&&RAW_ASSET_PATTERN.test(value)) throw new Error(`Raw asset filename is forbidden in Seed Man production: ${value}`);
  if(value.includes('/')||value.includes('\\')) throw new Error(`Asset path is forbidden; use a manifest key: ${value}`);
  if(!/^[a-z0-9][a-z0-9.-]+$/i.test(value)) throw new Error(`Invalid Seed Man manifest key: ${value}`);
  return value;
}

export function validateLevelAssetKeys(level){
  assertManifestAssetKey(level.background);
  assertManifestAssetKey(level.tiles);
  return true;
}

export function scanForRawAssetReferences(value,path='root'){
  const violations=[];
  const visit=(node,current)=>{
    if(typeof node==='string'){
      if((node.includes('/')||RAW_ASSET_PATTERN.test(node))&&/asset|background|atlas|sprite|tile|texture/i.test(current)) violations.push({path:current,value:node});
      return;
    }
    if(Array.isArray(node)){node.forEach((item,index)=>visit(item,`${current}[${index}]`));return;}
    if(node&&typeof node==='object') for(const [key,item] of Object.entries(node)) visit(item,`${current}.${key}`);
  };
  visit(value,path);
  return violations;
}
