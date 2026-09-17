import { SITEWIDE_HEADER_STYLE_TAG as V5_BASE_STYLE_TAG } from './sitewide-header-template.mjs';
import {
  SITEWIDE_CONTENT_DENSITY_SCRIPT_TAG,
  SITEWIDE_CONTENT_DENSITY_STYLE_TAG,
} from './sitewide-content-density-v1.mjs';
import {
  SITEWIDE_VISUAL_REPAIR_SCRIPT_TAG,
  SITEWIDE_VISUAL_REPAIR_STYLE_TAG,
} from './sitewide-visual-repair-v2.mjs';

export const SITEWIDE_HEADER_VERSION = 'v6';
export const SITEWIDE_HEADER_MARKER = `data-dtf-shell="header-${SITEWIDE_HEADER_VERSION}"`;
export const SITEWIDE_HEADER_REFERENCE = 'site/wordpress/assets/design-references/approved-sitewide-header-reference.json';

export const SITEWIDE_HEADER_STYLE_TAG = `${V5_BASE_STYLE_TAG}<style id="dtf-sitewide-header-v6-style">
.dtf-global-nav{gap:3px!important}
.dtf-global-nav a{padding-inline:10px!important}
@media(max-width:1320px){.dtf-global-nav a{padding-inline:8px!important;font-size:.86rem!important}}
@media(max-width:1120px){.dtf-global-nav{grid-template-columns:repeat(4,minmax(0,1fr))!important}}
@media(max-width:700px){.dtf-global-nav{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
@media(max-width:480px){.dtf-global-nav{grid-template-columns:1fr!important}}
</style>${SITEWIDE_CONTENT_DENSITY_STYLE_TAG}${SITEWIDE_VISUAL_REPAIR_STYLE_TAG}`;

const searchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.8-3.8"></path></svg>';
const userIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle></svg>';
const cartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1"></circle><circle cx="19" cy="20" r="1"></circle><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6"></path></svg>';

export const SITEWIDE_HEADER_HTML = String.raw`<header class="dtf-global-header" data-dtf-shell="header-v6" data-dtf-sitewide-header="canonical-eight-v1"><div class="dtf-global-header__inner"><a class="dtf-global-brand" href="/" aria-label="DTF Genetics home"><span class="dtf-global-brand__dtf">DTF</span><span class="dtf-global-brand__genetics">GENETICS</span><span class="dtf-global-brand__tag">DREAM THE FUTURE <span class="dtf-global-brand__arrow" aria-hidden="true">›</span></span></a><button class="dtf-global-menu" type="button" aria-expanded="false" aria-controls="dtf-global-primary-nav" aria-label="Open primary navigation">Menu</button><nav id="dtf-global-primary-nav" class="dtf-global-nav" aria-label="Primary navigation"><a href="/" data-dtf-nav-group="home">Home</a><a href="/seeds/">Seeds</a><a href="/learn/" data-dtf-nav-group="learn">Learn</a><a href="/courses/" data-dtf-nav-group="courses">Courses</a><a href="/tools/" data-dtf-nav-group="diagnostic">Diagnostic</a><a href="/games/">Games</a><a href="/community/">Community</a><a href="/shop/" data-dtf-nav-group="shop">Shop</a></nav><div class="dtf-global-actions"><div class="dtf-global-actions__icons"><a class="dtf-global-icon" href="/?s=" aria-label="Search DTF Genetics">${searchIcon}</a><a class="dtf-global-icon" href="/my-account/" aria-label="Account">${userIcon}</a><a class="dtf-global-icon" href="/cart/" aria-label="Cart">${cartIcon}</a></div><span class="dtf-global-tagline">Teaching<br>Healthy Cultivation</span></div></div></header>`;

export const SITEWIDE_HEADER_SCRIPT_TAG = `${String.raw`<script id="dtf-sitewide-header-v6-script">(function(){function norm(p){return p==='/'?'/':'/'+String(p||'/').split('/').filter(Boolean).join('/')+'/';}function enhanceCourseLayout(){var root=document.querySelector('.lhv3');if(!root||root.querySelector('.lhv3-right-rail'))return;var main=root.querySelector('.lhv3-main');var layout=root.querySelector('.lhv3-layout');if(!main||!layout)return;var toc=null,objective=null;Array.prototype.slice.call(main.children).forEach(function(child){if(child.classList.contains('lhv3-toc'))toc=child;if(child.classList.contains('lhv3-objective'))objective=child;});if(!toc&&!objective)return;var rail=document.createElement('aside');rail.className='lhv3-right-rail';rail.setAttribute('aria-label','Lesson context');if(toc)rail.appendChild(toc);if(objective)rail.appendChild(objective);layout.appendChild(rail);}function boot(){var header=document.querySelector('[data-dtf-shell="header-v6"]');if(!header)return;var menu=header.querySelector('.dtf-global-menu');var nav=header.querySelector('.dtf-global-nav');function setOpen(open){if(!menu||!nav)return;nav.classList.toggle('is-open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close primary navigation':'Open primary navigation');}if(menu&&nav&&!menu.dataset.bound){menu.dataset.bound='1';menu.addEventListener('click',function(){setOpen(!nav.classList.contains('is-open'));});nav.addEventListener('click',function(event){if(event.target&&event.target.closest('a'))setOpen(false);});document.addEventListener('keydown',function(event){if(event.key==='Escape'&&nav.classList.contains('is-open')){setOpen(false);menu.focus();}});window.addEventListener('resize',function(){if(window.innerWidth>1120)setOpen(false);});}var path=norm(location.pathname);header.querySelectorAll('.dtf-global-nav a').forEach(function(a){var href=norm(a.getAttribute('href')||'/');var group=a.dataset.dtfNavGroup||'';var active=false;if(group==='home')active=path==='/';else if(group==='courses')active=/^\/courses\//.test(path)||/^\/learn\/learning-hub\//.test(path);else if(group==='learn')active=(/^\/(learn|education|yellow-leaves)\//.test(path)&&!/^\/learn\/learning-hub\//.test(path));else if(group==='diagnostic')active=/^\/(tools|growlens|thc-grow-doc)\//.test(path);else if(group==='shop')active=/^\/(shop|product|cart|checkout|my-account)\//.test(path);else active=path.indexOf(href)===0;a.classList.toggle('is-active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});setOpen(false);enhanceCourseLayout();}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();})();</script>`}${SITEWIDE_CONTENT_DENSITY_SCRIPT_TAG}${SITEWIDE_VISUAL_REPAIR_SCRIPT_TAG}`;

export function getWordPressSitewideHeaderBlock(extraStyle = '') {
  return `<!-- wp:html -->${SITEWIDE_HEADER_STYLE_TAG}${extraStyle}${SITEWIDE_HEADER_HTML}${SITEWIDE_HEADER_SCRIPT_TAG}<!-- /wp:html -->`;
}
