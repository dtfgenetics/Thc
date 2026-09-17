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
.dtf-disclosure-section[data-dtf-disclosure="v2"]{position:relative}
.dtf-disclosure-section[data-dtf-disclosure="v2"] .dtf-disclosure__controls{margin-top:18px}
.dtf-disclosure-section[data-dtf-disclosure="v2"] .dtf-disclosure__body{margin-top:22px}
.dtf-disclosure__toggle{
  display:inline-flex;align-items:center;gap:10px;min-height:46px;padding:10px 15px;
  border:1px solid rgba(22,73,42,.18);border-radius:999px;background:rgba(255,255,255,.82);
  color:#173322;font:inherit;font-weight:800;line-height:1.2;cursor:pointer;
  box-shadow:0 8px 22px rgba(12,39,23,.06);transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease,background .18s ease
}
.dtf-disclosure__toggle:hover{transform:translateY(-1px);border-color:rgba(33,108,61,.38);background:#fff;box-shadow:0 13px 30px rgba(12,39,23,.1)}
.dtf-disclosure__toggle:focus-visible{outline:3px solid #8fea76;outline-offset:3px}
.dtf-disclosure__icon{
  display:grid;place-items:center;flex:0 0 25px;width:25px;height:25px;border-radius:50%;
  background:#153a24;color:#f0d477;font-size:1.05rem;line-height:1
}
.dtf-disclosure__toggle[aria-expanded="true"] .dtf-disclosure__icon{background:#216c3d}
.v3[data-dtf-topic] .dtf-disclosure-section[data-dtf-expanded="false"],
.v3[data-dtf-layout="learn-v3"] .dtf-disclosure-section[data-dtf-expanded="false"]{padding-bottom:clamp(28px,4vw,46px)!important}
.v3[data-dtf-topic] .dtf-disclosure-section[data-dtf-expanded="false"] .heading,
.v3[data-dtf-layout="learn-v3"] .dtf-disclosure-section[data-dtf-expanded="false"] .heading{margin-bottom:0!important}
.v3[data-dtf-topic] .dtf-disclosure-section[data-dtf-expanded="false"] .heading>p,
.v3[data-dtf-layout="learn-v3"] .dtf-disclosure-section[data-dtf-expanded="false"] .heading>p{max-width:60ch!important}
.v3[data-dtf-layout="learn-v3"] .dtf-disclosure-section{
  border-top:1px solid rgba(16,43,26,.12)
}
.v3[data-dtf-layout="learn-v3"] .dtf-disclosure-section[data-dtf-expanded="false"]{
  background:linear-gradient(180deg,rgba(255,255,255,.28),rgba(242,244,237,.55))!important
}

/* Prevent visual-only leftovers from creating empty white cards after quarantine. */
.dtf-retired-copy-only{display:none!important}
.dtf-page .dtf-image-card.dtf-no-approved-visual .dtf-card-copy{padding-top:22px!important}
.dtf-page .dtf-image-card.dtf-no-approved-visual>.dtf-img,
.dtf-page .dtf-image-card.dtf-no-approved-visual>img{display:none!important}

/* Sitewide visual hierarchy: calm page canvas, stronger section rhythm, fewer flat white boxes. */
:where(.v3,.dtf-page,.game-hub-page,body:has(.tool-chooser)){
  --dtf-polish-ink:#102b1a;--dtf-polish-deep:#07190f;--dtf-polish-leaf:#216c3d;
  --dtf-polish-gold:#d6b75c;--dtf-polish-line:rgba(16,43,26,.13);--dtf-polish-muted:#59695e;
  --dtf-polish-surface:#fffdf8;--dtf-polish-soft:#f1f4ed;--dtf-polish-shadow:0 16px 40px rgba(10,37,21,.08)
}
.v3,.dtf-page{background:linear-gradient(180deg,#fbf8ef 0%,#f6f4eb 48%,#fbfaf4 100%)!important}
.v3 :where(.section,.hero),.dtf-page :where(.dtf-section,.dtf-hero){position:relative}
.v3 .section+.section,.dtf-page .dtf-section+.dtf-section{border-top:1px solid rgba(16,43,26,.08)}
.v3 .heading h2,.dtf-page .dtf-heading h2,.game-hub-page .section-heading h2,body:has(.tool-chooser) .section-heading h2{
  max-width:15ch;letter-spacing:-.045em!important;line-height:.98!important
}
.v3 .heading>p,.dtf-page .dtf-heading>p,.game-hub-page .section-heading>p,body:has(.tool-chooser) .section-heading>p{
  color:var(--dtf-polish-muted)!important;line-height:1.7!important
}

/* Premium hero treatment shared across public hubs while preserving each page identity. */
.v3 .hero-grid,.dtf-page .dtf-hero-grid,.game-hub-page .hero-grid,body:has(.tool-chooser) .hero-grid{
  position:relative;isolation:isolate
}
.v3 .hero-grid:after,.dtf-page .dtf-hero-grid:after,.game-hub-page .hero-grid:after,body:has(.tool-chooser) .hero-grid:after{
  content:"";position:absolute;z-index:-1;inset:auto -4% -14% 44%;height:48%;pointer-events:none;
  background:radial-gradient(circle,rgba(214,183,92,.13),rgba(33,108,61,.04) 44%,transparent 72%);filter:blur(18px)
}
.v3 .hero h1,.dtf-page .dtf-hero h1,.game-hub-page .hero h1,body:has(.tool-chooser) .hero h1{
  text-wrap:balance;letter-spacing:-.052em!important
}
.v3 .lede,.dtf-page .dtf-lede,.game-hub-page .hero p,body:has(.tool-chooser) .hero p{
  color:var(--dtf-polish-muted);max-width:66ch;line-height:1.72
}

/* Give cards a clear depth hierarchy and predictable action placement. */
.v3 :where(.feature,.release,.path,.lesson,.visual),
.dtf-page :where(.dtf-card,.dtf-path-card,.dtf-flow>article),
.game-hub-page .card,
body:has(.tool-chooser) :where(.tool-feature,.flow>article,.learn-rail>article){
  position:relative;overflow:hidden;border-color:var(--dtf-polish-line)!important;
  background:linear-gradient(180deg,rgba(255,255,255,.98),rgba(252,250,244,.96))!important;
  box-shadow:var(--dtf-polish-shadow)!important
}
.v3 :where(.feature,.release,.path,.visual):before,
.dtf-page :where(.dtf-card,.dtf-path-card):before,
.game-hub-page .card:before,
body:has(.tool-chooser) .tool-feature:before{
  content:"";position:absolute;inset:0 0 auto;height:3px;pointer-events:none;
  background:linear-gradient(90deg,rgba(33,108,61,.78),rgba(214,183,92,.72),transparent 84%);opacity:.7
}
.v3 :where(.release,.path,.lesson,.visual),.dtf-page :where(.dtf-card,.dtf-path-card),.game-hub-page .card,body:has(.tool-chooser) .tool-feature{
  transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease
}
.v3 :where(.release,.path,.lesson,.visual) :where(a,.v3-text-link),
.dtf-page :where(.dtf-card,.dtf-path-card) :where(a,.dtf-text-link),
.game-hub-page .card :where(a,.card-link),body:has(.tool-chooser) .tool-feature :where(a,.text-link){text-underline-offset:4px}

/* Home: keep three primary jobs and current releases visually dominant. */
.v3[data-dtf-layout="home-v3"] .feature-grid{gap:clamp(18px,2.4vw,28px)!important}
.v3[data-dtf-layout="home-v3"] .feature{min-height:0!important}
.v3[data-dtf-layout="home-v3"] .feature-copy{display:flex;flex-direction:column;min-height:280px}
.v3[data-dtf-layout="home-v3"] .feature-copy .v3-text-link{margin-top:auto;padding-top:22px}
.v3[data-dtf-layout="home-v3"] .release-grid{align-items:stretch}
.v3[data-dtf-layout="home-v3"] .release{display:flex;flex-direction:column;height:100%}
.v3[data-dtf-layout="home-v3"] .release-copy{display:flex;flex:1;flex-direction:column}
.v3[data-dtf-layout="home-v3"] .release-copy .v3-text-link{margin-top:auto;padding-top:14px}

/* Learn root: preserve the four entry goals and learning map; deeper libraries collapse cleanly. */
.v3[data-dtf-layout="learn-v3"] .path-grid{align-items:stretch}
.v3[data-dtf-layout="learn-v3"] .path{display:flex;flex-direction:column}
.v3[data-dtf-layout="learn-v3"] .path .v3-text-link{margin-top:auto;padding-top:18px}
.v3[data-dtf-layout="learn-v3"] .all-subjects{max-width:1120px}
.v3[data-dtf-layout="learn-v3"] .subject-mini{position:relative;padding-right:22px!important}
.v3[data-dtf-layout="learn-v3"] .subject-mini:after{
  content:"→";position:absolute;right:2px;top:24px;color:rgba(33,108,61,.5);font-weight:900
}
.v3[data-dtf-layout="learn-v3"] .ref-grid{max-width:1120px}
.v3[data-dtf-layout="learn-v3"] .ref-card{transition:background .18s ease,border-color .18s ease}
.v3[data-dtf-layout="learn-v3"] .ref-card:hover{background:rgba(255,255,255,.55)!important;border-left-color:rgba(33,108,61,.72)!important}

/* Topic pages: make long lessons feel like a reading system instead of a wall of cards. */
.v3[data-dtf-topic] .topic-hero{padding-bottom:clamp(36px,5vw,64px)!important}
.v3[data-dtf-topic] .lesson-grid{max-width:1180px}
.v3[data-dtf-topic] .lesson{box-shadow:0 10px 28px rgba(10,37,21,.055)!important}
.v3[data-dtf-topic] .lesson :where(p,li){max-width:74ch}
.v3[data-dtf-topic] .checks{border-top:1px solid rgba(16,43,26,.09);padding-top:16px}

/* Static Tools and Games: visually connect the hubs without erasing game/tool identity. */
.game-hub-page,body:has(.tool-chooser){background:linear-gradient(180deg,#07190f 0,#0a2115 28%,#0d2719 100%)!important}
.game-hub-page .content,body:has(.tool-chooser) .section{position:relative}
.game-hub-page .content:nth-of-type(even),body:has(.tool-chooser) .section:nth-of-type(even){background:rgba(255,255,255,.018)}
.game-hub-page .card,body:has(.tool-chooser) .tool-feature{
  background:linear-gradient(180deg,rgba(15,48,29,.96),rgba(8,30,19,.98))!important;
  border-color:rgba(151,193,157,.17)!important;color:#eef6ef!important;box-shadow:0 18px 42px rgba(0,0,0,.18)!important
}
.game-hub-page .card:before,body:has(.tool-chooser) .tool-feature:before{background:linear-gradient(90deg,#4fa663,#d6b75c,transparent 86%)}
.game-hub-page .card :where(p,li),body:has(.tool-chooser) .tool-feature :where(p,li){color:#bfd0c3!important}
.game-hub-page :where(.section-heading h2,.hero h1),body:has(.tool-chooser) :where(.section-heading h2,.hero h1){color:#f6f2e6!important}
.game-hub-page .section-heading>p,body:has(.tool-chooser) .section-heading>p{color:#b9cabc!important}
.game-hub-page :where(.button,.card-link),body:has(.tool-chooser) :where(.button,.text-link){font-weight:850;letter-spacing:.01em}

/* Sitewide resilience for dense generated content. */
.dtf-page :where(h1,h2,h3),.v3 :where(h1,h2,h3),.lhv3 :where(h1,h2,h3){overflow-wrap:normal;word-break:normal}
.dtf-page :where(p,li),.v3 :where(p,li),.lhv3 :where(p,li){overflow-wrap:break-word}
.dtf-page :where(.dtf-card,.dtf-path-card),.v3 :where(.release,.path,.lesson,.visual),.lhv3 :where(.lhv3-card,.lhv3-panel){min-width:0}
.dtf-page :where(img,video,svg,canvas),.v3 :where(img,video,svg,canvas),.lhv3 :where(img,video,svg,canvas){max-width:100%;height:auto}

@media(hover:hover) and (pointer:fine){
  .v3 :where(.release,.path,.visual):hover,.dtf-page :where(.dtf-card,.dtf-path-card):hover,.game-hub-page .card:hover,body:has(.tool-chooser) .tool-feature:hover{
    transform:translateY(-3px);border-color:rgba(33,108,61,.28)!important;box-shadow:0 24px 54px rgba(10,37,21,.13)!important
  }
  .game-hub-page .card:hover,body:has(.tool-chooser) .tool-feature:hover{border-color:rgba(214,183,92,.34)!important;box-shadow:0 26px 58px rgba(0,0,0,.25)!important}
}

@media(max-width:900px){
  .v3[data-dtf-topic] .topic-hero{gap:28px!important}
  .v3[data-dtf-topic] .lesson-grid{grid-template-columns:1fr!important}
  .v3 .heading h2,.dtf-page .dtf-heading h2,.game-hub-page .section-heading h2,body:has(.tool-chooser) .section-heading h2{max-width:19ch}
}
@media(max-width:700px){
  .dtf-visual-placeholder{min-height:170px;padding:22px}
  .v3 .hero-media>.dtf-visual-placeholder{min-height:230px}
  .v3[data-dtf-topic] .topic-meta{gap:6px!important}
  .v3[data-dtf-topic] .topic-meta span{font-size:.76rem!important}
  .dtf-disclosure-section[data-dtf-disclosure="v2"] .dtf-disclosure__controls{width:100%}
  .dtf-disclosure__toggle{width:100%;justify-content:flex-start;border-radius:14px;padding:12px 14px}
  .v3[data-dtf-layout="learn-v3"] .subject-mini{padding-right:30px!important}
  .v3[data-dtf-layout="home-v3"] .feature-copy{min-height:0}
  .game-hub-page .card,body:has(.tool-chooser) .tool-feature{box-shadow:0 12px 30px rgba(0,0,0,.16)!important}
}
@media(prefers-reduced-motion:reduce){
  .dtf-disclosure__toggle,.v3 :where(.release,.path,.lesson,.visual),.dtf-page :where(.dtf-card,.dtf-path-card),.game-hub-page .card,body:has(.tool-chooser) .tool-feature{transition:none!important;transform:none!important}
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
var DISCLOSURE_LABELS=['encyclopedia depth','core literature','visual references','continue learning','core visuals','related visuals','references','sources & further reading','further reading','downloads & references','expanded references','specialized subjects','choose the depth'];
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
  function setOpen(open){body.hidden=!open;button.setAttribute('aria-expanded',String(open));icon.textContent=open?'−':'+';copy.textContent=(open?'Close ':'Open ')+pretty;section.dataset.dtfExpanded=String(open);}
  button.addEventListener('click',function(){setOpen(button.getAttribute('aria-expanded')!=='true');});
  if(location.hash){try{var target=document.querySelector(location.hash);if(target&&body.contains(target))setOpen(true);}catch(e){}}
}
function applyLearnDensity(){
  var path=location.pathname==='/'?'/':'/'+String(location.pathname||'/').split('/').filter(Boolean).join('/')+'/';
  if(path.indexOf('/learn/')!==0||path.indexOf('/learn/learning-hub/')===0)return;
  var root=document.querySelector('.v3[data-dtf-topic],.v3[data-dtf-layout="learn-v3"],.dtf-page,main');if(!root)return;
  var sections=Array.prototype.slice.call(root.querySelectorAll('section'));
  var index=100;
  sections.forEach(function(section){var label=sectionLabel(section);if(DISCLOSURE_LABELS.indexOf(label)===-1)return;index+=1;enhanceDisclosure(section,index);});
}
function boot(){repairRetiredVisuals();cleanOrphanVisualCopy();applyLearnDensity();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();</script>`;
