export const SITEWIDE_FOOTER_VERSION = 'v6';
export const SITEWIDE_FOOTER_MARKER = `data-dtf-shell="footer-${SITEWIDE_FOOTER_VERSION}"`;

export const SITEWIDE_FOOTER_STYLE_TAG = String.raw`<style id="dtf-shared-footer-v6-style">
.dtf-footer-v3{margin:0;background:#081b11;color:#dfe9e2;border-top:1px solid rgba(214,183,92,.12)}
.dtf-footer-v3 *{box-sizing:border-box}
.dtf-footer-v3 .inner{width:min(1240px,calc(100% - 36px));margin:auto;padding:52px 0 28px}
.dtf-footer-grid{display:grid;grid-template-columns:minmax(280px,1.4fr) repeat(2,minmax(170px,.7fr));gap:36px}
.dtf-footer-v3 p{color:#b9ccbf;line-height:1.7}
.dtf-footer-v3 .links{display:grid;gap:9px;margin-top:14px}
.dtf-footer-v3 .links a{color:#dfe9e2!important;text-decoration:none!important;min-height:36px;display:flex;align-items:center;border-radius:8px;padding-inline:6px;margin-inline:-6px}
.dtf-footer-v3 .links a:hover{text-decoration:underline!important}
.dtf-footer-v3 .links a:focus-visible{outline:3px solid rgba(214,183,92,.52);outline-offset:2px;background:rgba(255,255,255,.08)}
.dtf-footer-v3 .links .discord{color:#d6b75c!important;font-weight:850}
.dtf-footer-v3 hr{border:0;border-top:1px solid rgba(255,255,255,.12);margin:34px 0 22px}
.dtf-footer-v3 .legal{margin:0;color:#91aa9a;font-size:.86rem}
.dtf-footer-brand{display:flex!important;align-items:center;gap:12px;min-width:0;color:#fff!important;text-decoration:none!important}
.dtf-footer-brand img{display:block;width:50px!important;height:50px!important;object-fit:contain}
.dtf-footer-brand strong{display:block;font-size:1.18rem!important;line-height:1;letter-spacing:.035em;text-transform:uppercase;font-weight:900}
.dtf-footer-brand small{display:block;margin-top:5px;color:#d8bd68!important;font-size:.62rem!important;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
@media(max-width:760px){.dtf-footer-grid{grid-template-columns:1fr 1fr}.dtf-footer-grid>div:first-child{grid-column:1/-1}}
@media(max-width:620px){.dtf-footer-v3 .inner{width:min(100% - 28px,1240px);padding-top:42px}.dtf-footer-grid{grid-template-columns:1fr;gap:25px}.dtf-footer-grid>div:first-child{grid-column:auto}.dtf-footer-v3 .links a{min-height:44px}}
</style>`;

const esc = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export function getSitewideFooterHtml({ brandImageUrl = '' } = {}) {
  const brandMedia = brandImageUrl
    ? `<img src="${esc(brandImageUrl)}" alt="DTF Genetics cannabis leaf" width="50" height="50">`
    : '';
  return `<footer class="dtf-footer-v3" data-dtf-shell="footer-v6" data-dtf-sitewide-footer="canonical-eight-v1"><div class="inner"><div class="dtf-footer-grid"><div><a class="dtf-footer-brand" href="/" aria-label="DTF Genetics home">${brandMedia}<span><strong>DTF Genetics</strong><small>Dream the Future</small></span></a><p>Documented genetics, Teaching Healthy Cultivation, practical grow tools, original games, and the community connecting them.</p></div><nav aria-label="Site map"><strong>Explore</strong><div class="links"><a href="/">Home</a><a href="/seeds/">Seeds</a><a href="/learn/">Learn</a><a href="/courses/">Courses</a><a href="/tools/">Diagnostic</a><a href="/games/">Games</a><a href="/community/">Community</a><a href="/shop/">Shop</a></div></nav><nav aria-label="Company and community links"><strong>Connect &amp; company</strong><div class="links"><a href="/gallery/">Gallery</a><a href="/about/">About</a><a href="/contact/">Contact</a><a class="discord" href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer">Discord</a></div></nav></div><hr><p class="legal">© 2026 DTF Genetics · Dream the Future · Adults only. Follow applicable local laws.</p></div></footer>`;
}

export const SITEWIDE_FOOTER_HTML = getSitewideFooterHtml();

export function getWordPressSitewideFooterBlock(options = {}) {
  return `<!-- wp:html -->${getSitewideFooterHtml(options)}<!-- /wp:html -->`;
}
