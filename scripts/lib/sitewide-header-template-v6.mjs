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
</style><style id="dtf-sitewide-mobile-polish-v1-style">
@media(max-width:700px){
:root{--dtf-mobile-gutter:16px;--dtf-mobile-section:clamp(38px,10vw,54px);--dtf-mobile-radius:16px;--dtf-global-header-height:66px}
html{scroll-padding-top:calc(var(--dtf-global-header-height) + 12px)!important}
body{font-size:16px!important;overflow-x:clip!important}
.dtf-global-header__inner{width:calc(100% - 20px)!important;min-height:66px!important;padding:7px 0!important;gap:6px!important}
.dtf-global-brand__dtf{font-size:1.72rem!important;line-height:.78!important}
.dtf-global-brand__genetics{margin-top:5px!important;font-size:.62rem!important;letter-spacing:.13em!important}
.dtf-global-brand__tag,.dtf-global-tagline{display:none!important}
.dtf-global-actions__icons .dtf-global-icon:nth-child(2){display:none!important}
.dtf-global-icon{width:36px!important;height:40px!important;border-radius:10px!important}
.dtf-global-menu{min-width:44px!important;height:40px!important;border-radius:10px!important;padding-inline:10px!important;background:rgba(255,255,255,.065)!important}
.dtf-global-nav,.dtf-global-nav.is-open{grid-template-columns:repeat(2,minmax(0,1fr))!important}
.dtf-global-nav.is-open{margin:4px 0 2px!important;padding:10px!important;gap:7px!important;border:1px solid rgba(126,207,126,.2)!important;border-radius:15px!important;background:linear-gradient(180deg,rgba(5,31,18,.99),rgba(3,23,14,.99))!important;box-shadow:0 16px 36px rgba(0,0,0,.24)!important}
.dtf-global-nav a{min-height:46px!important;padding:10px 12px!important;border:1px solid rgba(255,255,255,.055)!important;border-radius:10px!important;background:rgba(255,255,255,.025)!important;font-size:.82rem!important;line-height:1.15!important;white-space:normal!important;text-align:center!important}
.dtf-global-nav a[aria-current="page"],.dtf-global-nav a.is-active{border-color:rgba(129,224,132,.28)!important;background:linear-gradient(180deg,#247d40,#155d2e)!important}
.v3 .wrap,.dtf-page .dtf-wrap,.dtf-v1 .wrap,.dtf-v1 .gen-wrap,.dtf-v1 .adult-note,.game-hub-page .wrap,body:has(.tool-chooser) .wrap,.dtf-footer-v3 .inner{width:calc(100% - (var(--dtf-mobile-gutter) * 2))!important;margin-inline:auto!important}
.v3 .hero,.dtf-page .dtf-hero,.dtf-v1 .site-hero,.dtf-v1 .genetics-hero{padding-block:clamp(36px,10vw,52px)!important}
.v3 .hero h1,.dtf-page .dtf-hero h1,.dtf-v1 h1,.game-hub-page .hero h1{font-size:clamp(2.15rem,10vw,3.25rem)!important;line-height:.98!important;letter-spacing:-.045em!important;text-wrap:balance!important}
.v3 .lede,.dtf-page .dtf-lede,.dtf-v1 .hero-copy>p:not(.eyebrow),.dtf-v1 .genetics-hero-copy>p:not(:first-child),.game-hub-page .hero p,body:has(.tool-chooser) .hero p{font-size:1rem!important;line-height:1.58!important}
.v3 .section,.dtf-page .dtf-section,.dtf-v1 .section,.dtf-v1 .gen-section,.game-hub-page .content,body:has(.tool-chooser) .section{padding-block:var(--dtf-mobile-section)!important}
.v3 .heading,.dtf-page .dtf-heading,.dtf-v1 .section-heading,.dtf-v1 .gen-heading,.game-hub-page .section-heading,body:has(.tool-chooser) .section-heading{grid-template-columns:1fr!important;align-items:start!important;margin-bottom:22px!important;gap:10px!important}
.v3 .heading h2,.dtf-page .dtf-heading h2,.dtf-v1 .section-heading h2,.dtf-v1 .gen-heading h2,.game-hub-page .section-heading h2,body:has(.tool-chooser) .section-heading h2{font-size:clamp(1.75rem,8vw,2.5rem)!important;line-height:1.02!important}
.v3 :where(p,li),.dtf-page :where(p,li),.dtf-v1 :where(p,li),.lhv3 :where(p,li),.game-hub-page :where(p,li),body:has(.tool-chooser) :where(p,li){font-size:1rem!important;line-height:1.58!important}
.v3 .feature,.v3 .release,.v3 .path,.v3 .lesson,.v3 .visual,.dtf-page .dtf-card,.dtf-page .dtf-path-card,.dtf-page .dtf-flow>article,.dtf-v1 .collection-card,.dtf-v1 .line-card,.game-hub-page .card,body:has(.tool-chooser) .tool-feature,body:has(.tool-chooser) .flow>article{min-height:0!important;border-radius:var(--dtf-mobile-radius)!important;box-shadow:0 8px 20px rgba(12,39,23,.07)!important}
.v3 .feature-copy,.v3 .release-copy,.v3 .path,.v3 .lesson,.dtf-page .dtf-card-copy,.dtf-page .dtf-path-card,.dtf-page .dtf-flow>article,.dtf-v1 .collection-card,.dtf-v1 .line-card,.game-hub-page .card,body:has(.tool-chooser) .tool-feature,body:has(.tool-chooser) .flow>article{padding:18px!important}
.v3 .actions,.dtf-page .dtf-actions,.dtf-v1 .actions,.dtf-v1 .genetics-actions,.game-hub-page .actions,body:has(.tool-chooser) .actions{display:grid!important;grid-template-columns:1fr!important;width:100%!important;gap:9px!important}
.v3 .actions>*,.dtf-page .dtf-actions>*,.dtf-v1 .actions>*,.dtf-v1 .genetics-actions>*,.game-hub-page .actions>*,body:has(.tool-chooser) .actions>*{width:100%!important;min-height:48px!important;justify-content:center!important;text-align:center!important;border-radius:12px!important}
.dtf-v1 .hero-grid,.dtf-v1 .genetics-hero,.dtf-v1 .gallery-standard,.dtf-v1 .parent-panel,.dtf-v1 .release-panel,.dtf-v1 .catalog-standard{grid-template-columns:1fr!important;gap:22px!important}
.dtf-v1 .collection-grid,.dtf-v1 .line-grid{grid-template-columns:1fr!important;gap:14px!important}
.dtf-v1 .genetics-board,.dtf-v1 .gallery-stage,.dtf-v1 .standard-intro,.dtf-v1 .parent-panel,.dtf-v1 .release-copy,.dtf-v1 .standard-copy{padding:20px!important;border-radius:18px!important}
.dtf-v1 .gallery-stage{min-height:0!important}
.dtf-v1 .board-stats{grid-template-columns:1fr!important;gap:8px!important}
.dtf-v1 .standard-intro,.dtf-v1 .standard-title{position:relative!important;top:auto!important}
.dtf-v1 .release-list li a{padding:15px 16px!important;align-items:flex-start!important}
.dtf-page .dtf-quickgrid,.game-hub-page .quicknav,body:has(.tool-chooser) .quicknav{margin-inline:calc(var(--dtf-mobile-gutter) * -1)!important;width:calc(100% + (var(--dtf-mobile-gutter) * 2))!important;padding:8px var(--dtf-mobile-gutter) 10px!important;scroll-padding-inline:var(--dtf-mobile-gutter)!important}
.dtf-page .dtf-quickgrid a,.game-hub-page .quicknav a,body:has(.tool-chooser) .quicknav a{min-width:126px!important;border-radius:12px!important}
.dtf-page :where(figure,picture),.v3 :where(figure,picture),.dtf-v1 :where(figure,picture),.lhv3 :where(figure,picture){max-width:100%!important;margin-inline:0!important}
.dtf-page :where(img,video),.v3 :where(img,video),.dtf-v1 :where(img,video),.lhv3 :where(img,video){max-width:100%!important;height:auto!important}
.lhv3{padding-top:8px!important}
.lhv3 .lhv3-wrap{width:calc(100% - 20px)!important}
.lhv3 .lhv3-hero,.lhv3 .lhv3-content,.lhv3 .lhv3-sidebar,.lhv3 .lhv3-right-rail{border-radius:14px!important}
.lhv3 .lhv3-content{padding:20px 16px!important}
.lhv3 .lhv3-hero{padding:20px 16px!important}
.lhv3 .lhv3-right-rail{gap:10px!important}
.dtf-footer-v3{padding-bottom:max(22px,env(safe-area-inset-bottom))!important}
}
@media(max-width:420px){
:root{--dtf-mobile-gutter:14px}
.dtf-global-header__inner{width:calc(100% - 14px)!important}
.dtf-global-brand__dtf{font-size:1.58rem!important}
.dtf-global-brand__genetics{font-size:.56rem!important}
.dtf-global-icon{width:32px!important}
.dtf-global-menu{min-width:40px!important;padding-inline:8px!important}
.dtf-global-nav,.dtf-global-nav.is-open{grid-template-columns:repeat(2,minmax(0,1fr))!important}
.dtf-global-nav a{min-height:44px!important;padding:9px 8px!important;font-size:.78rem!important}
.v3 .hero h1,.dtf-page .dtf-hero h1,.dtf-v1 h1,.game-hub-page .hero h1{font-size:clamp(2rem,10.5vw,2.8rem)!important}
.v3 .feature-copy,.v3 .release-copy,.v3 .path,.v3 .lesson,.dtf-page .dtf-card-copy,.dtf-page .dtf-path-card,.dtf-page .dtf-flow>article,.dtf-v1 .collection-card,.dtf-v1 .line-card,.game-hub-page .card,body:has(.tool-chooser) .tool-feature,body:has(.tool-chooser) .flow>article{padding:16px!important}
.dtf-v1 .genetics-board,.dtf-v1 .gallery-stage,.dtf-v1 .standard-intro,.dtf-v1 .parent-panel,.dtf-v1 .release-copy,.dtf-v1 .standard-copy{padding:18px!important}
}
</style>${SITEWIDE_CONTENT_DENSITY_STYLE_TAG}${SITEWIDE_VISUAL_REPAIR_STYLE_TAG}`;

const searchIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.8-3.8"></path></svg>';
const userIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"></path><circle cx="12" cy="7" r="4"></circle></svg>';
const cartIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="20" r="1"></circle><circle cx="19" cy="20" r="1"></circle><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.6L21 8H6"></path></svg>';

export const SITEWIDE_HEADER_HTML = String.raw`<header class="dtf-global-header" data-dtf-shell="header-v6" data-dtf-sitewide-header="canonical-eight-v1"><div class="dtf-global-header__inner"><a class="dtf-global-brand" href="/" aria-label="DTF Genetics home"><span class="dtf-global-brand__dtf">DTF</span><span class="dtf-global-brand__genetics">GENETICS</span><span class="dtf-global-brand__tag">DREAM THE FUTURE <span class="dtf-global-brand__arrow" aria-hidden="true">›</span></span></a><button class="dtf-global-menu" type="button" aria-expanded="false" aria-controls="dtf-global-primary-nav" aria-label="Open primary navigation">Menu</button><nav id="dtf-global-primary-nav" class="dtf-global-nav" aria-label="Primary navigation"><a href="/" data-dtf-nav-group="home">Home</a><a href="/seeds/">Seeds</a><a href="/learn/" data-dtf-nav-group="learn">Learn</a><a href="/courses/" data-dtf-nav-group="courses">Courses</a><a href="/tools/" data-dtf-nav-group="diagnostic">Diagnostic</a><a href="/games/">Games</a><a href="/community/">Community</a><a href="/shop/" data-dtf-nav-group="shop">Shop</a></nav><div class="dtf-global-actions"><div class="dtf-global-actions__icons"><a class="dtf-global-icon" href="/?s=" aria-label="Search DTF Genetics">${searchIcon}</a><a class="dtf-global-icon" href="/my-account/" aria-label="Account">${userIcon}</a><a class="dtf-global-icon" href="/cart/" aria-label="Cart">${cartIcon}</a></div><span class="dtf-global-tagline">Teaching<br>Healthy Cultivation</span></div></div></header>`;

export const SITEWIDE_HEADER_SCRIPT_TAG = `${String.raw`<script id="dtf-sitewide-header-v6-script">(function(){function norm(p){return p==='/'?'/':'/'+String(p||'/').split('/').filter(Boolean).join('/')+'/';}function enhanceCourseLayout(){var root=document.querySelector('.lhv3');if(!root||root.querySelector('.lhv3-right-rail'))return;var main=root.querySelector('.lhv3-main');var layout=root.querySelector('.lhv3-layout');if(!main||!layout)return;var toc=null,objective=null;Array.prototype.slice.call(main.children).forEach(function(child){if(child.classList.contains('lhv3-toc'))toc=child;if(child.classList.contains('lhv3-objective'))objective=child;});if(!toc&&!objective)return;var rail=document.createElement('aside');rail.className='lhv3-right-rail';rail.setAttribute('aria-label','Lesson context');if(toc)rail.appendChild(toc);if(objective)rail.appendChild(objective);layout.appendChild(rail);}function boot(){var header=document.querySelector('[data-dtf-shell="header-v6"]');if(!header)return;var menu=header.querySelector('.dtf-global-menu');var nav=header.querySelector('.dtf-global-nav');function setOpen(open){if(!menu||!nav)return;nav.classList.toggle('is-open',open);menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close primary navigation':'Open primary navigation');}if(menu&&nav&&!menu.dataset.bound){menu.dataset.bound='1';menu.addEventListener('click',function(){setOpen(!nav.classList.contains('is-open'));});nav.addEventListener('click',function(event){if(event.target&&event.target.closest('a'))setOpen(false);});document.addEventListener('keydown',function(event){if(event.key==='Escape'&&nav.classList.contains('is-open')){setOpen(false);menu.focus();}});window.addEventListener('resize',function(){if(window.innerWidth>1120)setOpen(false);});}var path=norm(location.pathname);header.querySelectorAll('.dtf-global-nav a').forEach(function(a){var href=norm(a.getAttribute('href')||'/');var group=a.dataset.dtfNavGroup||'';var active=false;if(group==='home')active=path==='/';else if(group==='courses')active=/^\/courses\//.test(path)||/^\/learn\/learning-hub\//.test(path);else if(group==='learn')active=(/^\/(learn|education|yellow-leaves)\//.test(path)&&!/^\/learn\/learning-hub\//.test(path));else if(group==='diagnostic')active=/^\/(tools|growlens|thc-grow-doc)\//.test(path);else if(group==='shop')active=/^\/(shop|product|cart|checkout|my-account)\//.test(path);else active=path.indexOf(href)===0;a.classList.toggle('is-active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});setOpen(false);enhanceCourseLayout();}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();})();</script>`}${SITEWIDE_CONTENT_DENSITY_SCRIPT_TAG}${SITEWIDE_VISUAL_REPAIR_SCRIPT_TAG}`;

export function getWordPressSitewideHeaderBlock(extraStyle = '') {
  return `<!-- wp:html -->${SITEWIDE_HEADER_STYLE_TAG}${extraStyle}${SITEWIDE_HEADER_HTML}${SITEWIDE_HEADER_SCRIPT_TAG}<!-- /wp:html -->`;
}