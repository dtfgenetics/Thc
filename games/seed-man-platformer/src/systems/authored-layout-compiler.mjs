const CARRIER_ARCHETYPE = Object.freeze({ fire:'fire-carrier', electric:'electric-carrier', ice:'ice-carrier' });

function finite(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function unique(values=[]){return [...new Set(values.filter(Boolean))];}

export function compileAuthoredRecipe(levelId, recipe, defaults={}) {
  if (!recipe?.world || !Array.isArray(recipe.sections) || recipe.sections.length === 0) {
    throw new Error(`Invalid authored recipe for ${levelId}`);
  }
  const groundY=finite(defaults.groundY,480);
  const sectionGap=finite(defaults.sectionGap,90);
  const pickupEvery=Math.max(180,finite(defaults.pickupEvery,340));
  const checkpointEvery=Math.max(1,finite(defaults.checkpointEverySections,2));
  const platforms=[]; const hazards=[]; const pickups=[]; const checkpoints=[]; const enemySpawns=[];
  const phenotypeCarrierSpawns=[]; const encounterZones=[]; const mechanics=[]; const bosses=[];
  let x=0; let pickupSerial=1; let enemySerial=1; let hazardSerial=1;

  recipe.sections.forEach((section,index)=>{
    const width=Math.max(420,finite(section.width,1200));
    const startX=x;
    const endX=startX+width;
    const surface=section.surface||'grass';
    const sectionId=`${levelId}-section-${index+1}`;
    platforms.push({id:`${sectionId}-ground`,x:startX,y:groundY,width,height:60,surface});

    const sectionMechanics=Array.isArray(section.mechanics)?section.mechanics:[];
    mechanics.push(...sectionMechanics);
    if(sectionMechanics.some((m)=>['moving-platforms','vertical-platforms','vine-platforms','wall-routes','crystal-bounce'].includes(m))){
      const count=sectionMechanics.includes('vertical-platforms')?4:3;
      for(let p=0;p<count;p+=1){
        platforms.push({
          id:`${sectionId}-platform-${p+1}`,
          x:startX+220+p*((width-440)/Math.max(1,count-1)),
          y:groundY-100-(p%2)*70,
          width:180,
          height:22,
          surface:sectionMechanics.includes('crystal-bounce')?'ice':surface,
          motion:sectionMechanics.includes('moving-platforms')?{axis:p%2?'y':'x',distance:110,durationMs:2200}:undefined
        });
      }
    }

    (section.hazards||[]).forEach((type,h)=>{
      const hx=startX+Math.min(width-170,300+h*260);
      hazards.push({id:`${sectionId}-hazard-${hazardSerial++}`,x:hx,y:groundY+18,width:96,height:42,type});
    });

    for(let px=startX+220;px<endX-140;px+=pickupEvery){
      pickups.push({id:`${levelId}-seed-${String(pickupSerial++).padStart(3,'0')}`,x:px,y:groundY-52,width:22,height:22,type:'seed'});
    }

    const enemies=section.enemies||[];
    enemies.forEach((type,e)=>{
      const ex=startX+Math.min(width-180,340+e*250);
      enemySpawns.push({
        id:`${levelId}-enemy-${String(enemySerial++).padStart(3,'0')}`,
        type,
        x:ex,
        y:groundY-44,
        minX:Math.max(startX+100,ex-150),
        maxX:Math.min(endX-100,ex+180)
      });
    });

    if(section.carrier){
      const phenotype=section.carrier;
      phenotypeCarrierSpawns.push({
        id:`${levelId}-${phenotype}-carrier-${index+1}`,
        type:CARRIER_ARCHETYPE[phenotype],
        form:phenotype,
        x:startX+Math.floor(width*.68),
        y:groundY-46,
        minX:startX+Math.floor(width*.48),
        maxX:startX+Math.floor(width*.86)
      });
    }

    if(section.boss){
      bosses.push({id:`${levelId}-${section.boss}`,type:section.boss,x:startX+Math.floor(width*.68),y:groundY-120,arenaStartX:startX+100,arenaEndX:endX-100});
    }

    encounterZones.push({id:sectionId,startX,endX,purpose:section.kind||'traversal'});
    if(index>0 && index<recipe.sections.length-1 && index%checkpointEvery===0){
      checkpoints.push({id:`${levelId}-checkpoint-${checkpoints.length+1}`,x:startX+120,y:groundY-60,width:50,height:60,respawnX:startX+70,respawnY:groundY-80});
    }
    x=endX+sectionGap;
  });

  const length=Math.max(1400,x-sectionGap);
  const finalX=Math.max(180,length-140);
  return Object.freeze({
    mode:'authored-recipe',revision:1,source:'authored-level-recipes-v1',world:recipe.world,length,
    spawn:{x:96,y:groundY-90},platforms,hazards,pickups,checkpoints,enemySpawns,phenotypeCarrierSpawns,bosses,encounterZones,
    mechanics:unique(mechanics),requiredPickups:pickups.length,
    finish:{x:finalX,y:groundY-90,width:50,height:90}
  });
}

export function buildAuthoredLayoutIndex(recipeCatalog){
  const defaults=recipeCatalog?.defaults||{};
  const entries=Object.entries(recipeCatalog?.levels||{}).map(([id,recipe])=>[id,compileAuthoredRecipe(id,recipe,defaults)]);
  return new Map(entries);
}
