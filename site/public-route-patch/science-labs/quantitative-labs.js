/* THC quantitative science exercises. Educational calculations, not crop prescriptions. */
(()=>{'use strict';
const es=t=>0.6108*Math.exp(17.27*t/(t+237.3));
const toNumber=(id)=>Number(document.getElementById(id).value);
const fmt=(x,d=2)=>Number.isFinite(x)?x.toFixed(d):'—';
const add=(tag,parent,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=text;parent.append(x);return x};
const modules={
vpd:function(parent){
 const w=add('section',parent,'stage');add('h3',w,'','Measurement uncertainty laboratory');
 add('p',w,'muted','A single calculated VPD number hides sensor uncertainty. Adjust plausible measurement errors and inspect the interval of calculated values. This is a worst-case parameter interval, not a statistical confidence interval.');
 const controls=add('div',w,'tools');
 function slider(id,title,max,value,step){const label=add('label',controls,'control');label.textContent=title+' ';const val=add('strong',label,'',String(value));const input=add('input',label);input.type='range';input.id=id;input.min=0;input.max=max;input.step=step;input.value=value;input.setAttribute('aria-label',title);return {input,val}}
 const a=slider('uncertT','Air thermometer tolerance ±°C',3,0.5,.1),r=slider('uncertRH','Humidity sensor tolerance ±RH points',10,3,.5),l=slider('uncertL','Leaf offset tolerance ±°C',4,1,.1);
 const out=add('div',w,'metricbox');out.setAttribute('aria-live','polite');const caveat=add('p',w,'muted','This assumes uniform bounded errors and independent feasible input extremes. A leaf IR thermometer also depends on emissivity, spot size, reflected radiation and sampling location.');
 const read=()=>{const air=toNumber('tmp'),rh=toNumber('rh'),off=toNumber('off'),t=+a.input.value,h=+r.input.value,k=+l.input.value;
 const lo=es(air-t+off-k)-es(air+t)*Math.min(100,rh+h)/100;
 const hi=es(air+t+off+k)-es(air-t)*Math.max(0,rh-h)/100;
 a.val.textContent='±'+t.toFixed(1);r.val.textContent='±'+h.toFixed(1);l.val.textContent='±'+k.toFixed(1);
 out.textContent='Estimated range: '+fmt(lo)+' to '+fmt(hi)+' kPa';};
 [a.input,r.input,l.input,document.getElementById('tmp'),document.getElementById('rh'),document.getElementById('off')].forEach(x=>x?.addEventListener('input',read));read();},
lighting:function(parent){
 const w=add('section',parent,'stage');add('h3',w,'','Uniformity sampling exercise');
 add('p',w,'muted','A mean PPFD can hide nonuniformity. Change the corners and center of a five-point illustrative grid. Calculate average, minimum, maximum and coefficient of variation.');
 const grid=add('div',w,'tools'),inputs=[];
 for(let i=0;i<5;i++){let label=add('label',grid,'control','Point '+(i+1));const input=add('input',label);input.type='number';input.min='0';input.max='3000';input.step='10';input.value=String([380,450,550,450,380][i]);input.setAttribute('aria-label','Sample point '+(i+1)+' PPFD in micromoles per square meter per second');inputs.push(input)}
 const result=add('div',w,'metricbox');result.setAttribute('role','status');
 const calc=()=>{const a=inputs.map(x=>x.value.trim()===''?NaN:Number(x.value));if(a.some(x=>!Number.isFinite(x)||x<0||x>3000)){result.textContent='Enter five valid PPFD readings (0–3000); blank readings are not zero.';return}
 const mean=a.reduce((x,y)=>x+y)/a.length,sd=Math.sqrt(a.reduce((x,y)=>x+(y-mean)**2,0)/a.length);
 result.textContent='Mean '+fmt(mean,0)+' µmol m⁻² s⁻¹ · minimum '+fmt(Math.min(...a),0)+' · maximum '+fmt(Math.max(...a),0)+' · CV '+(mean>0?fmt(sd/mean*100,1)+'%':'undefined at zero mean');};
 inputs.forEach(x=>x.addEventListener('input',calc));calc();add('p',w,'muted','Five points are illustrative, not an adequate measurement grid for every grow space; choose sampling density to match actual geometry and fixture variation.');},
genetics:function(parent){
 const w=add('section',parent,'stage');add('h3',w,'','Genotype frequency explorer');
 add('p',w,'muted','Set the probability of allele A in gametes from each parent. For a single diploid locus with independent gamete pairing, compute offspring probabilities.');
 const controls=add('div',w,'tools');
 const inputs=[0,1].map((n)=>{let label=add('label',controls,'control','Parent '+(n+1)+' gamete P(A)');let input=add('input',label);input.type='range';input.min=0;input.max=1;input.step='.05';input.value='.5';let out=add('strong',label,'','0.50');return {input,out}});
 const result=add('div',w,'metricbox');result.setAttribute('role','status');
 function calc(){const p=+inputs[0].input.value,q=+inputs[1].input.value;inputs[0].out.textContent=fmt(p);inputs[1].out.textContent=fmt(q);const aa=p*q,hetero=p*(1-q)+(1-p)*q,recessive=(1-p)*(1-q);result.textContent='AA: '+fmt(100*aa,1)+'% · Aa: '+fmt(100*hetero,1)+'% · aa: '+fmt(100*recessive,1)+'%';}
 inputs.forEach(x=>x.input.addEventListener('input',calc));calc();add('p',w,'muted','No predictions of vigor, yield, cannabinoid concentration or other quantitative traits are justified by this one-locus probability model.');}
};
function mount(id){const area=document.getElementById('interactive');if(!area)return;area.querySelector('[data-quantitative-lab]')?.remove();if(!modules[id])return;const slot=add('div',area);slot.dataset.quantitativeLab=id;modules[id](slot)}
window.addEventListener('thc:lab-change',event=>mount(event.detail?.id||''));
mount(location.hash.slice(1)||'anatomy');
})();