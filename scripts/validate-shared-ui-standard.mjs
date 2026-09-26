import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const responsive = read('site/wordpress/assets/responsive-layout-v1.css');
const ux = read('site/wordpress/assets/sitewide-ux-polish-v1.css');
const header = read('scripts/lib/sitewide-header-template-v6.mjs');
const footer = read('scripts/lib/sitewide-footer-template-v6.mjs');

const failures = [];
const requireToken = (source, token, label) => {
  if (!source.includes(token)) failures.push(`${label}: missing ${token}`);
};

for (const token of [
  '--dtf-layout-max:1360px',
  '--dtf-reading-max:76ch',
  '--dtf-layout-gutter:clamp(14px,3vw,40px)',
  '--dtf-layout-touch:44px',
  '@media (min-width:701px) and (max-width:1120px)',
  '@media (max-width:700px)',
  '@media (max-width:420px)',
  'overflow-x:auto',
  'scroll-snap-type:x proximity',
  'prefers-reduced-motion:reduce',
]) requireToken(responsive, token, 'responsive system');

for (const token of [
  ':focus-visible',
  'min-height:44px',
  'scroll-padding-top:',
  '--dtf-ux-reading:72ch',
  '--dtf-ux-section:clamp(56px,7vw,92px)',
  'text-wrap:balance',
]) requireToken(ux, token, 'UX system');

for (const token of [
  'data-dtf-shell="header-v6"',
  'data-dtf-sitewide-header="canonical-eight-v1"',
  'href="/tools/" data-dtf-nav-group="tools">Tools</a>',
  'aria-expanded="false"',
  'aria-controls="dtf-global-primary-nav"',
  "event.key==='Escape'",
  "if(window.innerWidth>1120)setOpen(false)",
  'SITEWIDE_MOBILE_POLISH_STYLE_TAG',
]) requireToken(header, token, 'header');

for (const token of [
  'data-dtf-shell="footer-v6"',
  'data-dtf-sitewide-footer="canonical-eight-v1"',
  'href="/tools/">Tools</a>',
]) requireToken(footer, token, 'footer');

if (header.includes('>Diagnostic</a>') || footer.includes('>Diagnostic</a>')) {
  failures.push('canonical shell must label /tools/ as Tools, not Diagnostic');
}
if (header.includes('data-dtf-nav-group="diagnostic"')) {
  failures.push('canonical header still contains obsolete diagnostic nav-group');
}

if (failures.length) {
  console.error('Shared UI production standard verification failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  shell: 'header-v6/footer-v6',
  navigation: ['Home','Seeds','Learn','Courses','Tools','Games','Community','Shop'],
  responsiveStates: ['desktop','tablet','mobile','narrow-mobile'],
  enforced: [
    'shared container system',
    'minimum touch targets',
    'responsive tables/rails',
    'focus visibility',
    'reduced motion',
    'canonical Tools hub navigation',
  ],
}, null, 2));
