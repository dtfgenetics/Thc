import { validateObservation, collectObservation } from './observation-validation.mjs';
const form = document.getElementById('intake');
const fields = document.getElementById('fields');
const metadata = document.getElementById('metadata');
const errors = document.getElementById('error');
const status = document.getElementById('status');
const slots = document.getElementById('image-slots');
const spec = await fetch('./root-zone-observation-template.json').then(response => {
  if (!response.ok) throw new Error('Unable to load observation schema');
  return response.json();
});
function addField(f, container) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const label = document.createElement('label');
  label.htmlFor = f.id;
  label.textContent = f.label + (f.unit ? ' (' + f.unit + ')' : '') + (f.required ? ' *' : '');
  let input;
  if (f.kind === 'enum') {
    input = document.createElement('select');
    const blank = document.createElement('option');
    blank.value = ''; blank.textContent = 'Unknown / not recorded'; input.append(blank);
    for (const value of f.choices) {
      const option = document.createElement('option');
      option.value = value; option.textContent = value.replaceAll('_', ' '); input.append(option);
    }
  } else {
    input = document.createElement('input');
    input.type = f.kind === 'datetime' ? 'datetime-local' : f.kind === 'number' ? 'number' : 'text';
    if (f.kind === 'number') {input.step='any'; if (f.minimum !== undefined) input.min=String(f.minimum); if (f.maximum !== undefined) input.max=String(f.maximum);}
  }
  input.id=f.id;input.name=f.id;input.required=Boolean(f.required);
  wrap.append(label,input);
  if (f.methodRequired) { const hint = document.createElement('small');hint.textContent='Record measurement method below.';wrap.append(hint); }
  container.append(wrap);
}
for (const field of spec.fields) addField(field, fields);
for (const id of spec.measurementMetadata) addField({id,label:id.replace(/([A-Z])/g,' $1').replace(/^./,c=>c.toUpperCase()),kind:'text'},metadata);
for (const slot of spec.imageSlots){const li=document.createElement('li');li.textContent=slot.description;slots.append(li);}
form.addEventListener('submit',event=>{
  event.preventDefault(); errors.textContent='';status.textContent='';
  const values=collectObservation(form,spec);
  const result=validateObservation(values,spec);
  if (!result.ok){errors.textContent=result.errors.join(' ');return;}
  const payload={schemaVersion:spec.schemaVersion,templateId:spec.id,caseId:spec.caseId,record:result.record,exportedAt:new Date().toISOString()};
  const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='thc-root-zone-observation.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  status.textContent='Validated. JSON export initiated. Nothing was uploaded.';
});
form.addEventListener('reset',()=>{errors.textContent='';status.textContent='';});
