export function collectObservation(form,spec){
  const values={};
  for(const field of [...spec.fields,...spec.measurementMetadata.map(id=>({id}))]){
    const input=form.elements.namedItem(field.id);
    values[field.id]=input?.value?.trim()??'';
  }
  return values;
}
function isRealLocalMinute(value){
  const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if(!match)return false;
  const [,year,month,day,hour,minute]=match.map(Number);
  if(year<1||month<1||month>12||day<1||hour>23||minute>59)return false;
  const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();
  return day<=lastDay;
}
export function validateObservation(values,spec){
  const errors=[],record={};
  for(const field of spec.fields){
    const raw=values[field.id]??'';
    if(raw==='' || raw===null){
      if(field.required) errors.push(field.label+' is required.');
      record[field.id]=null;
      continue;
    }
    if(field.kind==='number'){
      const num=Number(raw);
      if(typeof raw==='boolean'||typeof raw==='object'||!Number.isFinite(num)||(field.minimum!==undefined&&num<field.minimum)||(field.maximum!==undefined&&num>field.maximum)){
        errors.push(field.label+' must be a valid value'+(field.unit?' in '+field.unit:'')+'.');
      } else record[field.id]=num;
    } else if(field.kind==='enum'){
      if(!field.choices.includes(raw))errors.push(field.label+' has an invalid selection.');
      else record[field.id]=raw;
    } else if(field.kind==='datetime'){
      if(typeof raw!=='string'||!isRealLocalMinute(raw))errors.push('Observation date/time is invalid.');
      else record[field.id]=raw;
    } else record[field.id]=String(raw);
  }
  const hasMethodBound=spec.fields.some(f=>f.methodRequired&&record[f.id]!==null&&record[f.id]!==undefined);
  for(const key of spec.measurementMetadata){
    const value=String(values[key]??'').trim();
    record[key]=value||null;
  }
  if(hasMethodBound){
    for(const key of ['method','sampleLocation']){
      if(!record[key])errors.push(key+' is required when entering pH or EC.');
    }
  }
  return {ok:errors.length===0,errors,record};
}
