/* THC differential reasoning practicum: educational decision support, not image diagnosis. */
(()=>{'use strict';
const models=[
{id:'water',name:'Root-zone water / oxygen imbalance',checks:['substrate','irrigation'],why:'Waterlogged or very dry media can limit root function and change water uptake.',verify:'Measure medium moisture, inspect drainage, compare irrigation records and root condition.'},
{id:'salts',name:'Salt accumulation / osmotic stress',checks:['ec','edge'],why:'High soluble salts can reduce water uptake and cause marginal damage, depending on context.',verify:'Check calibrated media-solution EC using a method appropriate to the substrate and compare feed and runoff history.'},
{id:'nutrition',name:'Nutrient availability or imbalance',checks:['older','younger','ph'],why:'Nutrient supply, transport and root-zone chemistry can influence tissue symptoms.',verify:'Measure pH and EC correctly, inspect the spatial pattern and review nutrient inputs; leaf analysis may be appropriate.'},
{id:'light',name:'Light / heat / climate injury',checks:['upper','heat','light'],why:'Exposed tissue can be affected by radiation, temperature and dry-air conditions.',verify:'Map canopy exposure; record leaf and air temperature, humidity, PPFD and airflow.'},
{id:'biotic',name:'Pest or pathogen injury',checks:['lesions','pests','patchy'],why:'Organisms may cause localized lesions, distortions or tissue decline, with substantial overlap among causes.',verify:'Inspect leaf surfaces and roots under magnification; use appropriately validated diagnostics when infection is suspected.'}
];
const options=[
{id:'upper',group:'Location',label:'Mostly upper canopy'},
{id:'older',group:'Location',label:'Mostly older leaves'},
{id:'younger',group:'Location',label:'Mostly new growth'},
{id:'patchy',group:'Location',label:'Localized or patchy distribution'},
{id:'edge',group:'Symptoms',label:'Marginal browning / tip damage'},
{id:'lesions',group:'Symptoms',label:'Distinct spots or lesions'},
{id:'heat',group:'Conditions',label:'Elevated leaf temperature measured'},
{id:'light',group:'Conditions',label:'High light exposure measured'},
{id:'irrigation',group:'Conditions',label:'Recent irrigation change'},
{id:'substrate',group:'Conditions',label:'Moisture or drainage concern'},
{id:'ec',group:'Measurements',label:'EC is outside the recorded baseline'},
{id:'ph',group:'Measurements',label:'pH is outside the recorded baseline'},
{id:'pests',group:'Observations',label:'Visible organisms or characteristic signs'}
];
let state=new Set();
function el(tag,cls,content){const n=document.createElement(tag);if(cls)n.className=cls;if(content!==undefined)n.textContent=content;return n}
function mount(){const area=document.getElementById('interactive');if(!area)return;area.querySelector('[data-differential-tool]')?.remove();if(location.hash!=='#diagnostics')return;
const box=el('section','stage');box.dataset.differentialTool='true';box.setAttribute('aria-label','Differential diagnosis reasoning exercise');
box.append(el('h3','','Observation-based differential explorer'),el('p','muted','Mark available observations. The tool groups relevant hypotheses for verification; it does not determine a diagnosis or assign disease probabilities.'));
const controls=el('div','path'),results=el('div','');results.setAttribute('aria-live','polite');
options.forEach(o=>{const button=el('button','node',o.label);button.type='button';button.dataset.observation=o.id;button.setAttribute('aria-pressed',String(state.has(o.id)));button.addEventListener('click',()=>{if(state.has(o.id))state.delete(o.id);else state.add(o.id);button.setAttribute('aria-pressed',String(state.has(o.id)));render()});controls.append(button)});
const actions=el('div','links');const reset=el('button','node','Clear observations');reset.type='button';reset.addEventListener('click',()=>{state.clear();controls.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed','false'));render()});actions.append(reset);
box.append(controls,actions,results);area.prepend(box);
function render(){results.replaceChildren();const count=state.size;results.append(el('h3','',count?'Hypotheses to investigate':'Begin with observations'));
if(!count){results.append(el('p','muted','Select one or more measured or observed findings. Avoid interpreting symptom color as proof of one cause.'));return}
const scored=models.map(m=>({...m,matched:m.checks.filter(c=>state.has(c))})).sort((a,b)=>b.matched.length-a.matched.length||a.name.localeCompare(b.name));
const max=scored[0].matched.length;
results.append(el('p','muted','Showing possible causes ordered by matching teaching cues. Match counts are not statistical probabilities and do not indicate that a cause is confirmed.'));
scored.forEach(m=>{const card=el('section','detail');card.append(el('h4','',m.name),el('p','',m.why),el('p','',m.matched.length?'Matches '+m.matched.length+' selected cue(s).':'No direct cue selected; not ruled out.'),el('p','', 'Verification: '+m.verify));results.append(card)});
const warning=el('p','note','Always check measurement method, baseline and time course. More than one stressor may be present at once; incompatible findings are not automatically excluded.');results.append(warning)}
render()}
window.addEventListener('thc:lab-change',e=>{if(e.detail?.id==='diagnostics')mount()});
if(location.hash==='#diagnostics')mount();
})();