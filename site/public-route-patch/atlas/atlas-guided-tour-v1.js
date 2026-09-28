(()=>{
  const root=document.querySelector('[data-atlas-tour]');
  if(!root)return;
  const steps=[
    {id:'root-system',title:'1 · Root system',description:'Start below ground. Fine roots and root hairs acquire water and mineral ions while root respiration and the rhizosphere shape uptake capacity.',question:'Which measurement best confirms the root zone itself rather than assuming room conditions?',options:['Root-zone temperature','Room wall color','Cultivar name'],answer:0},
    {id:'stem-vascular',title:'2 · Stem & vascular transport',description:'Move upward through the structural stem. Xylem carries water and dissolved ions while phloem redistributes assimilates among sources and sinks.',question:'Which tissue primarily conducts water upward through the plant?',options:['Xylem','Stigma','Trichome gland head'],answer:0},
    {id:'nodes-branching',title:'3 · Nodes, meristems & branching',description:'Nodes position leaves, branches, and axillary buds. Architecture reflects genetics, light distribution, developmental signaling, and recent training.',question:'What should be recorded before assigning a single cause to internode changes?',options:['Stage and light context','Only the strain name','Only one node'],answer:0},
    {id:'leaf-module',title:'4 · Leaf system',description:'Leaves connect light capture, carbon fixation, gas exchange, transpiration, and vascular delivery. Tissue age and canopy position change how symptoms should be interpreted.',question:'A visible leaf pattern should first be treated as…',options:['Evidence requiring context','Proof of one deficiency','A cultivar identifier'],answer:0},
    {id:'flower-anatomy',title:'5 · Flower anatomy',description:'Female inflorescences contain many individual flowers, bracts, sugar leaves, stigmas, and resinous surfaces that change through maturation.',question:'Which structure closely surrounds female reproductive tissues and is often resinous?',options:['Bract','Root cap','Cotyledon'],answer:0},
    {id:'trichomes-resin',title:'6 · Glandular trichomes',description:'Capitate-stalked trichomes contain secretory cells and a gland head where specialized metabolites accumulate. Their abundance and chemistry vary with tissue, stage, genetics, and environment.',question:'Does trichome appearance alone prove a specific terpene percentage?',options:['No — analytical measurement is required','Yes — appearance fixes chemistry','Yes — cultivar name is enough'],answer:0}
  ];
  const copy=root.querySelector('[data-tour-copy]'),stepBox=root.querySelector('[data-tour-step]'),title=root.querySelector('[data-tour-title]'),description=root.querySelector('[data-tour-description]'),question=root.querySelector('[data-tour-question]'),options=root.querySelector('[data-tour-options]'),feedback=root.querySelector('[data-tour-feedback]'),progress=root.querySelector('[data-tour-progress]'),start=root.querySelector('[data-tour-start]'),prev=root.querySelector('[data-tour-prev]'),next=root.querySelector('[data-tour-next]'),end=root.querySelector('[data-tour-end]');
  let index=-1;
  const focus=id=>window.dispatchEvent(new CustomEvent('plant-atlas:focus',{detail:{id}}));
  function render(){
    const active=index>=0&&index<steps.length;
    stepBox.hidden=!active;prev.hidden=!active;next.hidden=!active;end.hidden=!active;start.hidden=active;
    if(!active){progress.textContent=steps.length+' stops';copy.hidden=false;return}
    copy.hidden=true;
    const step=steps[index];progress.textContent=(index+1)+' / '+steps.length;title.textContent=step.title;description.textContent=step.description;question.textContent=step.question;feedback.textContent='';options.innerHTML=step.options.map((label,i)=>'<button type="button" data-tour-answer="'+i+'">'+label+'</button>').join('');prev.disabled=index===0;next.textContent=index===steps.length-1?'Finish':'Next';focus(step.id);
    for(const button of options.querySelectorAll('[data-tour-answer]'))button.addEventListener('click',()=>{const chosen=Number(button.dataset.tourAnswer),correct=chosen===step.answer;for(const candidate of options.querySelectorAll('[data-tour-answer]'))candidate.dataset.state=Number(candidate.dataset.tourAnswer)===step.answer?'correct':candidate===button&&!correct?'incorrect':'';feedback.textContent=correct?'Correct. '+step.description:'Not quite. Review the focused structure and try again.'});
  }
  start.addEventListener('click',()=>{index=0;render();document.querySelector('#interactive-plant')?.scrollIntoView({behavior:'smooth',block:'start'})});
  prev.addEventListener('click',()=>{if(index>0){index--;render()}});
  next.addEventListener('click',()=>{if(index<steps.length-1){index++;render()}else{index=-1;render()}});
  end.addEventListener('click',()=>{index=-1;render()});
  render();
})();