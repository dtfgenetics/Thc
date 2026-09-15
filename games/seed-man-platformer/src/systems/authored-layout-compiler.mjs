const CARRIER_ARCHETYPE = Object.freeze({ fire:'fire-carrier', electric:'electric-carrier', ice:'ice-carrier' });

function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function unique(values=[]){return [...new Set(values.filter(Boolean))];}

export function compileAuthoredRecipe(levelId, recipe, defaults={}, levelMeta={}) {
  if (!recipe?.world || !Array.isArray(recipe.sections) || recipe.sections.length === 0) {
    throw new Error(`Invalid authored recipe for ${levelId}`);
  }
  const groundY=finite(defaults.groundY,480);
  const sectionGap=finite(defaults.sectionGap,90);
  const pickupEvery=Math.max(180,finite(defaults.pickupEvery,340));
  const targetLength=Math.max(1400,finite(levelMeta.length,0));
  const targetCheckpointCount=Math.max(0,Math.floor(finite(levelMeta.checkpointCount,2)));
  const rawWidths=recipe.sections.map((section)=>Math.max(420,finite(section.width,1200)));
  const rawContentWidth=rawWidths.reduce((sum,width)=>sum+width,0);
  const rawGapWidth=sectionGap*Math.max(0,recipe.sections.length-1);
  const naturalLength=rawContentWidth+rawGapWidth;
  const length=targetLength||naturalLength;
  const scale=length/naturalLength;
  const platforms=[]; const hazards=[]; const pickups=[]; const checkpoints=[]; const enemySpawns=[];
  const phenotypeCarrierSpawns=[]; const encounterZones=[]; const mechanics=[]; const bosses=[];
  let x=0; let pickupSerial=1; let enemySerial=1; let hazardSerial=1;

  recipe.sections.forEach((section,index)=>{
    const width=Math.max(360,rawWidths[index]*scale);
    const gap=index<recipe.sections.length-1?sectionGap*scale:0;
    const startX=x;
    const endX=Math.min(length,startX+width);
    const usableWidth=Math.max(280,endX-startX);
    const surface=section.surface||'grass';
    const sectionId=`${levelId}-section-${index+1}`;
    const sectionMechanics=Array.isArray(section.mechanics)?section.mechanics:[];
    const sectionHazards=Array.isArray(section.hazards)?section.hazards:[];
    const ground={id:`${sectionId}-ground`,x:startX,y:groundY,width:usableWidth,height:60,surface};
    if(sectionMechanics.includes('slippery-ground'))ground.slippery=true;
    platforms.push(ground);

    mechanics.push(...sectionMechanics);
    const needsTraversalPlatforms=sectionMechanics.some((m)=>['moving-platforms','vertical-platforms','vine-platforms','wall-routes','crystal-bounce','conveyor-platforms','collapsing-platforms','springs'].includes(m));
    if(needsTraversalPlatforms){
      const count=sectionMechanics.includes('vertical-platforms')?4:3;
      for(let p=0;p<count;p+=1){
        const travel=Math.max(0,usableWidth-440);
        const platform={
          id:`${sectionId}-platform-${p+1}`,
          x:startX+220+p*(travel/Math.max(1,count-1)),
          y:groundY-100-(p%2)*70,
          width:180,
          height:22,
          surface:sectionMechanics.includes('crystal-bounce')?'ice':surface
        };
        if(sectionMechanics.includes('moving-platforms'))platform.motion={axis:p%2?'y':'x',distance:110,durationMs:2200};
        if(sectionMechanics.includes('conveyor-platforms'))platform.conveyor={speed:p%2?-55:55};
        if(sectionMechanics.includes('springs'))platform.bounce={multiplier:1.18};
        if(sectionMechanics.includes('crystal-bounce'))platform.bounce={multiplier:1.28};
        if(sectionMechanics.includes('collapsing-platforms'))platform.breakaway={cycleMs:2600,activeMs:1550,phaseMs:p*320};
        platforms.push(platform);
      }
    }

    sectionHazards.forEach((type,h)=>{
      const hx=startX+Math.min(Math.max(90,usableWidth-170),220+h*230);
      hazards.push({id:`${sectionId}-hazard-${hazardSerial++}`,x:hx,y:groundY+18,width:96,height:42,type,zoneId:sectionId});
    });

    for(let px=startX+180;px<endX-110;px+=pickupEvery*scale){
      pickups.push({id:`${levelId}-seed-${String(pickupSerial++).padStart(3,'0')}`,x:px,y:groundY-52,width:22,height:22,type:'seed'});
    }

    const enemies=section.enemies||[];
    enemies.forEach((type,e)=>{
      const ex=startX+Math.min(Math.max(140,usableWidth-160),260+e*230);
      enemySpawns.push({
        id:`${levelId}-enemy-${String(enemySerial++).padStart(3,'0')}`,
        type,
        x:ex,
        y:groundY-44,
        minX:Math.max(startX+80,ex-150),
        maxX:Math.min(endX-80,ex+180),
        zoneId:sectionId
      });
    });

    if(section.carrier){
      const phenotype=section.carrier;
      phenotypeCarrierSpawns.push({
        id:`${levelId}-${phenotype}-carrier-${index+1}`,
        type:CARRIER_ARCHETYPE[phenotype],
        form:phenotype,
        x:startX+Math.floor(usableWidth*.68),
        y:groundY-46,
        minX:startX+Math.floor(usableWidth*.48),
        maxX:startX+Math.floor(usableWidth*.86),
        zoneId:sectionId
      });
    }

    if(section.boss){
      bosses.push({id:`${levelId}-${section.boss}`,type:section.boss,x:startX+Math.floor(usableWidth*.68),y:groundY-120,arenaStartX:startX+100,arenaEndX:endX-100,zoneId:sectionId});
    }

    encounterZones.push({
      id:sectionId,
      startX,
      endX,
      purpose:section.kind||'traversal',
      surface,
      mechanics:[...sectionMechanics],
      hazards:[...sectionHazards]
    });
    x=endX+gap;
  });

  for(let index=0;index<targetCheckpointCount;index+=1){
    const checkpointX=Math.round(length*((index+1)/(targetCheckpointCount+1)));
    checkpoints.push({
      id:`${levelId}-checkpoint-${index+1}`,
      x:checkpointX,
      y:groundY-60,
      width:50,
      height:60,
      respawnX:Math.max(70,checkpointX-50),
      respawnY:groundY-80
    });
  }

  if(pickups.length<5){
    for(let index=pickups.length;index<5;index+=1){
      const px=Math.round(length*((index+1)/6));
      pickups.push({id:`${levelId}-seed-${String(pickupSerial++).padStart(3,'0')}`,x:px,y:groundY-52,width:22,height:22,type:'seed'});
    }
  }

  const finalX=Math.max(180,length-140);
  return Object.freeze({
    mode:'authored-recipe',revision:3,source:'authored-level-recipes-v1',world:recipe.world,length,
    spawn:{x:96,y:groundY-90},platforms,hazards,pickups,checkpoints,enemySpawns,phenotypeCarrierSpawns,bosses,encounterZones,
    mechanics:unique(mechanics),requiredPickups:pickups.length,
    finish:{x:finalX,y:groundY-90,width:50,height:90}
  });
}

export function buildAuthoredLayoutIndex(recipeCatalog,levelCatalog){
  const defaults=recipeCatalog?.defaults||{};
  const metaById=new Map((levelCatalog?.levels||[]).map((level)=>[level.id,level]));
  const entries=Object.entries(recipeCatalog?.levels||{}).map(([id,recipe])=>[id,compileAuthoredRecipe(id,recipe,defaults,metaById.get(id)||{})]);
  return new Map(entries);
}
