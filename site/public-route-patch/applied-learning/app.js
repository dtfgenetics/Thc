const SOURCE_SHA='7ffb4810a48091c3c61714ccc1663d8a2a1d4e88';

const competencies=[
'COMP-BREED-GENOMICS-001','COMP-BREED-POP-001','COMP-CANOPY-001','COMP-CROP-PLAN-001','COMP-CULT-EQUIPMENT-CARE-001','COMP-CULT-TRACEABILITY-001','COMP-ENV-ADV-001','COMP-ENV-VPD-001','COMP-FLOWER-001','COMP-IPM-001','COMP-LIGHT-001','COMP-NUTRITION-001','COMP-PLANT-BIO-001','COMP-POSTHARVEST-001','COMP-PRO-QA-001','COMP-PRO-SOP-001','COMP-PROP-001','COMP-ROOTZONE-001','COMP-SAFETY-WORK-001','COMP-SPACE-BIOSEC-001','COMP-TC-ASEPTIC-001','COMP-TC-REGEN-001','COMP-WATER-001','COMP-PH-001','COMP-EC-001','COMP-HARVEST-001','COMP-DRY-CURE-001','COMP-SCOUTING-001','COMP-RECORDS-001','COMP-EQUIPMENT-001','COMP-AIRFLOW-001','COMP-SENSOR-001','COMP-IRRIGATION-001','COMP-MEDIA-001','COMP-GENETICS-001','COMP-TRACEABILITY-001','COMP-SANITATION-001','COMP-BIOSECURITY-001','COMP-QUALITY-001','COMP-DATA-001','COMP-HANDOFF-001','COMP-OBSERVATION-001'];
const claims=['CLAIM-CANOPY-001','CLAIM-ENV-VPD-001','CLAIM-IPM-001','CLAIM-LIGHT-001','CLAIM-NUTRITION-001','CLAIM-POSTHARVEST-001','CLAIM-PROP-001','CLAIM-WATER-001'];
const nodes=[...competencies.map(id=>({id,type:'competency'})),...claims.map(id=>({id,type:'claim'}))];

const filter=document.querySelector('#graph-filter');
const list=document.querySelector('#graph-nodes');
function renderGraph(){
 const q=filter.value.trim().toLowerCase();
 const visible=nodes.filter(n=>!q||n.id.toLowerCase().includes(q)||n.type.includes(q));
 list.replaceChildren(...visible.map(n=>{const li=document.createElement('li');const strong=document.createElement('strong');strong.textContent=n.id;const small=document.createElement('span');small.textContent=n.type;li.append(strong,small);return li;}));
 document.querySelector('#graph-stats').textContent=`${visible.length} of ${nodes.length} canonical IDs shown`;
}
filter.addEventListener('input',renderGraph);renderGraph();
document.querySelector('#graph-relationship').textContent='CLAIM-ENV-VPD-001 → supports-competency → COMP-ENV-VPD-001 · evidence REF-VPD-002';

document.querySelector('#measurement-form').addEventListener('submit',e=>{
 e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget).entries());
 document.querySelector('#measurement-output').textContent=JSON.stringify({status:'local-learning-evidence',sourceSha:SOURCE_SHA,values,note:'Stored nowhere; not credential evidence.'},null,2);
});

document.querySelector('#dli-form').addEventListener('submit',e=>{
 e.preventDefault();const fd=new FormData(e.currentTarget);const ppfd=Number(fd.get('ppfd'));const hours=Number(fd.get('hours'));
 const out=document.querySelector('#dli-result');
 if(!Number.isFinite(ppfd)||ppfd<0||!Number.isFinite(hours)||hours<=0||hours>24){out.textContent='Check the input values.';return;}
 const dli=ppfd*hours*3600/1000000;out.textContent=`${dli.toFixed(2)} mol/m²/day`;
});

const hypotheses=[
 {title:'Low supply or limited nutrient availability',why:'A tissue-age pattern can be consistent with a mobile-nutrient limitation, but the visual pattern alone is not proof.',up:['Feed/source analysis shows insufficient supply','Root-zone pH trend supports reduced availability'],down:['Root-zone EC is already excessive','Roots show clear water/oxygen stress']},
 {title:'Root-zone water, aeration or salinity stress',why:'Root dysfunction can limit uptake even when nutrients are present in the feed.',up:['Abnormal moisture/aeration history','Elevated root-zone EC or reduced root vigor'],down:['Root-zone measurements are stable while independent evidence supports a specific supply limitation']},
 {title:'Environmental or localized canopy stress',why:'Temperature, airflow, light distribution and local conditions can overlap visually with nutrient symptoms.',up:['Symptoms map to one zone','A recent equipment/setpoint change precedes the pattern'],down:['Pattern follows tissue age across the entire crop while environmental measurements are spatially uniform']}
];
const wrap=document.querySelector('#hypotheses');
wrap.replaceChildren(...hypotheses.map(h=>{const a=document.createElement('article');a.innerHTML='<h3></h3><p></p><h4>Raises confidence</h4><ul class="up"></ul><h4>Lowers confidence</h4><ul class="down"></ul>';a.querySelector('h3').textContent=h.title;a.querySelector('p').textContent=h.why;a.querySelector('.up').replaceChildren(...h.up.map(x=>{const li=document.createElement('li');li.textContent=x;return li;}));a.querySelector('.down').replaceChildren(...h.down.map(x=>{const li=document.createElement('li');li.textContent=x;return li;}));return a;}));
