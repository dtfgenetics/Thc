export const SITEWIDE_VISUAL_REPAIR_VERSION = 'v2';

export const SITEWIDE_VISUAL_REPAIR_STYLE_TAG = String.raw`<style id="dtf-sitewide-visual-repair-v2-style">
/* DTFSeeds sitewide visual repair v2
 * Render-time guard for retired education media, orphan visual cards, long reference
 * sections, and responsive presentation. This layer does not un-retire any asset.
 */
[data-dtf-retired-visual="true"]{display:none!important}
.dtf-no-approved-visual{position:relative}
.dtf-no-approved-visual>.dtf-visual-placeholder,
.dtf-visual-placeholder{
  display:grid;place-items:center;align-content:center;gap:7px;min-height:220px;width:100%;
  padding:28px;border:1px dashed rgba(33,108,61,.34);border-radius:18px;
  background:linear-gradient(145deg,#eef3eb,#f8f5ec);color:#31533e;text-align:center
}
.dtf-visual-placeholder strong{font-size:1rem;line-height:1.2;color:#173322}
.dtf-visual-placeholder span{max-width:34ch;font-size:.82rem;line-height:1.5;color:#5d7163}
.v3 .hero-media>.dtf-visual-placeholder{min-height:360px;border-radius:24px;background:linear-gradient(145deg,#143522,#0d2518);border-color:rgba(214,183,92,.4);color:#dce9df}
.v3 .hero-media>.dtf-visual-placeholder strong{color:#f0d477;font-size:1.08rem}
.v3 .hero-media>.dtf-visual-placeholder span{color:#c0d1c4}
.v3 .hero-media:has(>.dtf-visual-placeholder):before{display:none!important}
.v3 .visual-grid:empty,.dtf-page .dtf-grid-2:empty,.dtf-page .dtf-grid-3:empty,.dtf-page .dtf-grid-4:empty{display:none!important}

/* Long subject/reference pages should scan first and expand on demand. */
.dtf-disclosure-section[data-dtf-disclosure="v2"] .dtf-disclosure__controls{margin-top:18px}
.dtf-disclosure-section[data-dtf-disclosure="v2"] .dtf-disclosure__body{margin-top:22px}
.v3[data-dtf-topic] .dtf-disclosure-section[data-dtf-expanded="false"]{padding-bottom:clamp(28px,4vw,46px)!important}
.v3[data-dtf-topic] .dtf-disclosure-section[data-dtf-expanded="false"] .heading{margin-bottom:0!important}
.v3[data-dtf-topic] .dtf-disclosure-section[data-dtf-expanded="false"] .heading>p{max-width:60ch!important}

/* Prevent visual-only leftovers from creating empty white cards after quarantine. */
.dtf-retired-copy-only{display:none!important}
.dtf-page .dtf-image-card.dtf-no-approved-visual .dtf-card-copy{padding-top:22px!important}
.dtf-page .dtf-image-card.dtf-no-approved-visual>.dtf-img,
.dtf-page .dtf-image-card.dtf-no-approved-visual>img{display:none!important}

/* Sitewide resilience for dense generated content. */
.dtf-page :where(h1,h2,h3),.v3 :where(h1,h2,h3),.lhv3 :where(h1,h2,h3){overflow-wrap:normal;word-break:normal}
.dtf-page :where(p,li),.v3 :where(p,li),.lhv3 :where(p,li){overflow-wrap:break-word}
.dtf-page :where(.dtf-card,.dtf-path-card),.v3 :where(.release,.path,.lesson,.visual),.lhv3 :where(.lhv3-card,.lhv3-panel){min-width:0}
.dtf-page :where(img,video,svg,canvas),.v3 :where(img,video,svg,canvas),.lhv3 :where(img,video,svg,canvas){max-width:100%;height:auto}

@media(max-width:900px){
  .v3[data-dtf-topic] .topic-hero{gap:28px!important}
  .v3[data-dtf-topic] .lesson-grid{grid-template-columns:1fr!important}
}
@media(max-width:700px){
  .dtf-visual-placeholder{min-height:170px;padding:22px}
  .v3 .hero-media>.dtf-visual-placeholder{min-height:230px}
  .v3[data-dtf-topic] .topic-meta{gap:6px!important}
  .v3[data-dtf-topic] .topic-meta span{font-size:.76rem!important}
  .dtf-disclosure-section[data-dtf-disclosure="v2"] .dtf-disclosure__controls{width:100%}
}
</style>`;

export const SITEWIDE_VISUAL_REPAIR_SCRIPT_TAG = String.raw`<script id="dtf-sitewide-visual-repair-v2-script">(function(){
var APPROVED_RE=/(?:DTF_APPROVED_PUBLIC_VISUAL|dtf[-_ ]approved[-_ ]public[-_ ]visual|dtf-approved-visual-)/i;
var RETIRED_RE=[
  /Teaching[ _-]+Healthy[ _-]+Cultivation/i,
  /Cannabis[ _-]+Plant[ _-]+Anatomy[ _-]+Infographic/i,
  /Cannabis[ _-]+Nutrition[ _-]+Science[ _-]+Behind[ _-]+Healthy[ _-]+Growth/i,
  /Diagnosing[ _-]+Deficiency[ _-]+vs[ _-]+Toxicity[ _-]+Infographic/i,
  /Beneficial[ _-]+Insects[ _-]+and[ _-]+Biological[ _-]+Controls/i,
  /Cloning[ _-]+Guide[ _-]+with[ _-]+Environment[ _-]+Targets/i,
  /Cannabis[ _-]+Plant[ _-]+Life[ _-]+Cycle[ _-]+Seed[ _-]+to[ _-]+Harvest[ _-]+Infographic/i,
  /Cannabis[ _-]+Sex[ _-]+Expression[ _-]+and[ _-]+Chromosome[ _-]+Combinations/i,
  /(?:^|[\/_ .-])(?:THC[ _-]?)?C\d{3}(?:[\/_ .-]|$)/i,
  /(?:^|[\/_ .-])(?:THC[ _-]?)?ENC[ _-]?\d{3}(?:[\/_ .-]|$)/i,
  /(?:^|[\/_ .-])Outdoor[ _-]?\d{2}(?:[\/_ .-]|$)/i,
  /Stage[ _-]?\d+.*Infographic/i
];
var DISCLOSURE_LABELS=['encyclopedia depth','core literature','visual references','continue learning','core visuals','related visuals','references','sources & further reading','further reading','downloads & references'];
function txt(node){return String(node&&node.textContent||'').replace(/\s+/g,' ').trim();}
function norm(value){return String(value||'').replace(/\s+/g,' ').trim().toLowerCase();}
function signature(node){if(!node)return '';return [node.getAttribute&&node.getAttribute('src'),node.getAttribute&&node.getAttribute('srcset'),node.getAttribute&&node.getAttribute('alt'),node.getAttribute&&node.getAttribute('title'),node.getAttribute&&node.getAttribute('data-dtf-visual-status'),node.className].filter(Boolean).join(' ');}
function isApproved(node){var source=signature(node);var parent=node&&node.closest?node.closest('[data-dtf-approved-public-visual],.dtf-approved-public-visual'):null;return !!parent||APPROVED_RE.test(source);}
function isRetired(node){if(!node||isApproved(node))return false;var source=signature(node);return RETIRED_RE.some(function(re){return re.test(source);});}
function placeholder(){var box=document.createElement('div');box.className='dtf-visual-placeholder';box.setAttribute('role','img');box.setAttribute('aria-label','Approved visual pending');box.innerHTML='<strong>Approved visual pending</strong><span>This reference is being kept image-free until a production-quality replacement is approved.</span>';return box;}
function repairRetiredVisuals(){
  Array.prototype.slice.call(document.querySelectorAll('img,source')).forEach(function(media){
    if(!isRetired(media))return;
    var hero=media.closest('.hero-media');
    var usefulCard=media.closest('.dtf-image-card,.release,.feature');
    var visualOnly=media.closest('.visual,figure,picture,.wp-block-image');
    if(hero){
      if(media.parentNode)media.parentNode.removeChild(media);
      if(!hero.querySelector('img,source,.dtf-visual-placeholder'))hero.appendChild(placeholder());
      hero.classList.add('dtf-no-approved-visual');
      return;
    }
    if(usefulCard){
      if(media.parentNode)media.parentNode.removeChild(media);
      usefulCard.classList.add('dtf-no-approved-visual');
      return;
    }
    if(visualOnly&&visualOnly!==document.body){
      visualOnly.setAttribute('data-dtf-retired-visual','true');
      visualOnly.hidden=true;
      return;
    }
    if(media.parentNode)media.parentNode.removeChild(media);
  });
}
function cleanOrphanVisualCopy(){
  Array.prototype.slice.call(document.querySelectorAll('p,small,figcaption')).forEach(function(node){
    if(!/Open the image for the full-size WordPress media asset\.?/i.test(txt(node)))return;
    var card=node.closest('article,.dtf-card,.visual,.image-card,.media-card,.wp-block-group,li');
    if(card&&txt(card).length<420&&!card.querySelector('img')){
      card.classList.add('dtf-retired-copy-only');
      card.setAttribute('aria-hidden','true');
    }else{
      node.classList.add('dtf-retired-copy-only');
      node.setAttribute('aria-hidden','true');
    }
  });
}
function sectionLabel(section){var eyebrow=section.querySelector('.dtf-eyebrow,.eyebrow,.kicker');if(eyebrow&&txt(eyebrow))return norm(txt(eyebrow));var h2=section.querySelector('h2');return norm(txt(h2));}
function enhanceDisclosure(section,index){
  if(!section||section.dataset.dtfDisclosure)return;
  var heading=section.querySelector('.dtf-heading,.heading');
  var directTitle=null;
  if(!heading){
    var children=Array.prototype.slice.call(section.children||[]);
    directTitle=children.find(function(child){return child.tagName==='H2';})||null;
    heading=directTitle;
  }
  if(!heading||!heading.parentElement)return;
  var wrap=heading.parentElement;
  var children=Array.prototype.slice.call(wrap.children);
  var start=children.indexOf(heading);
  if(start<0)return;
  var bodyNodes=children.slice(start+1).filter(function(node){return !(node.classList&&node.classList.contains('dtf-disclosure__controls'));});
  if(!bodyNodes.length)return;
  var label=sectionLabel(section)||norm(txt(directTitle));
  var pretty=label?label.replace(/(^|\s)\S/g,function(ch){return ch.toUpperCase();}):'details';
  var id='dtf-v2-disclosure-'+index;
  var body=document.createElement('div');body.className='dtf-disclosure__body';body.id=id;body.hidden=true;
  bodyNodes.forEach(function(node){body.appendChild(node);});
  var controls=document.createElement('div');controls.className='dtf-disclosure__controls';
  var button=document.createElement('button');button.type='button';button.className='dtf-disclosure__toggle';button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',id);
  var icon=document.createElement('span');icon.className='dtf-disclosure__icon';icon.setAttribute('aria-hidden','true');icon.textContent='+';
  var copy=document.createElement('span');copy.className='dtf-disclosure__copy';copy.textContent='Open '+pretty;
  button.appendChild(icon);button.appendChild(copy);controls.appendChild(button);wrap.appendChild(controls);wrap.appendChild(body);
  section.classList.add('dtf-disclosure-section');section.dataset.dtfDisclosure='v2';section.dataset.dtfExpanded='false';
  function setOpen(open){body.hidden=!open;button.setAttribute('aria-expanded',String(open));copy.textContent=(open?'Close ':'Open ')+pretty;section.dataset.dtfExpanded=String(open);}
  button.addEventListener('click',function(){setOpen(button.getAttribute('aria-expanded')!=='true');});
  if(location.hash){try{var target=document.querySelector(location.hash);if(target&&body.contains(target))setOpen(true);}catch(e){}}
}
function applyLearnDensity(){
  var path=location.pathname==='/'?'/':'/'+String(location.pathname||'/').split('/').filter(Boolean).join('/')+'/';
  if(path.indexOf('/learn/')!==0||path==='/learn/'||path.indexOf('/learn/learning-hub/')===0)return;
  var root=document.querySelector('.v3[data-dtf-topic],.dtf-page,main');if(!root)return;
  var sections=Array.prototype.slice.call(root.querySelectorAll('section'));
  var index=100;
  sections.forEach(function(section){var label=sectionLabel(section);if(DISCLOSURE_LABELS.indexOf(label)===-1)return;index+=1;enhanceDisclosure(section,index);});
}
function boot(){repairRetiredVisuals();cleanOrphanVisualCopy();applyLearnDensity();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();</script>`;
