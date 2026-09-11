const finite = (value,fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function wrappedUnit(value){
  const wrapped=((finite(value)%1)+1)%1;
  return wrapped;
}

export function triangleWave(value){
  const unit=wrappedUnit(value);
  return unit<=0.5 ? unit*2 : (1-unit)*2;
}

export function resolveMovingPlatform(definition,timeMs,previousTimeMs=timeMs){
  if(!definition?.id) throw new Error('Moving platform requires an id');
  const motion=definition.motion||{};
  const periodMs=Math.max(400,finite(motion.periodMs,2400));
  const phase=finite(motion.phase,0);
  const startX=finite(definition.x);
  const startY=finite(definition.y);
  const endX=finite(motion.toX,startX);
  const endY=finite(motion.toY,startY);
  const progressAt=(ms)=>triangleWave((Math.max(0,finite(ms))/periodMs)+phase);
  const nowProgress=progressAt(timeMs);
  const previousProgress=progressAt(previousTimeMs);
  const x=startX+(endX-startX)*nowProgress;
  const y=startY+(endY-startY)*nowProgress;
  const previousX=startX+(endX-startX)*previousProgress;
  const previousY=startY+(endY-startY)*previousProgress;
  return Object.freeze({
    ...definition,
    x,
    y,
    moving:true,
    baseX:startX,
    baseY:startY,
    deltaX:x-previousX,
    deltaY:y-previousY,
    progress:nowProgress
  });
}

export function materializeMovingPlatforms(level,timeMs,previousTimeMs=timeMs){
  const source=Array.isArray(level?.movingPlatforms)?level.movingPlatforms:[];
  return Object.freeze(source.map((definition)=>resolveMovingPlatform(definition,timeMs,previousTimeMs)));
}

export function carryPlayerWithPlatform(player,platforms){
  const supportId=player?.supportPlatformId;
  if(!supportId) return {...player};
  const platform=platforms.find((entry)=>entry.id===supportId);
  if(!platform) return {...player,supportPlatformId:null};
  return {
    ...player,
    x:finite(player.x)+finite(platform.deltaX),
    y:finite(player.y)+finite(platform.deltaY)
  };
}

export function supportPlatformFor(player,platforms,tolerance=2){
  if(!player?.grounded) return null;
  const bottom=finite(player.y)+finite(player.height);
  return platforms.find((platform)=>{
    const horizontal=finite(player.x)<finite(platform.x)+finite(platform.width)&&finite(player.x)+finite(player.width)>finite(platform.x);
    return horizontal&&Math.abs(bottom-finite(platform.y))<=tolerance;
  })||null;
}
