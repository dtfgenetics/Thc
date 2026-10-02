import fs from 'node:fs';

const read = path => fs.readFileSync(path, 'utf8');
const responsive = read('site/wordpress/assets/responsive-layout-v1.css');
const ux = read('site/wordpress/assets/sitewide-ux-polish-v1.css');
const header = read('scripts/lib/sitewide-header-template-v6.mjs');
const footer = read('scripts/lib/sitewide-footer-template-v6.mjs');
const publicNav = JSON.parse(read('data/public-navigation.json'));
const siteNav = JSON.parse(read('data/site-navigation-v6.json'));
const siteRegistry = JSON.parse(read('data/site-registry.json'));

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
  '--dtf-ux-max:var(--dtf-layout-max,1360px)',
  '--dtf-ux-section:var(--dtf-layout-section,clamp(56px,7vw,92px))',
  'text-wrap:balance',
  'body:has(.dc6) :where(.wp-block-post-title,.entry-title,.page-title)',
  'body:has(.dtf-courses) :where(.wp-block-post-title,.entry-title,.page-title)',
]) requireToken(ux, token, 'UX system');

for (const token of [
  'data-dtf-shell="header-v6"',
  'data-dtf-sitewide-header="canonical-five-v1"',
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

const canonicalLabels = ['Home','Seeds','Learn','Courses','Tools','Games','Community','Shop'];
for (const [label, nav] of [['public-navigation', publicNav.primaryNavigation], ['site-navigation-v6', siteNav.primaryNavigation]]) {
  const labels = (nav || []).map(item => item.label);
  if (JSON.stringify(labels) !== JSON.stringify(canonicalLabels)) failures.push(`${label}: canonical labels drifted: ${JSON.stringify(labels)}`);
}

const registryFamilies = siteRegistry.information_architecture?.route_families || [];
for (const required of canonicalLabels) {
  const route = required === 'Home' ? '/' : `/${required.toLowerCase()}/`;
  if (!registryFamilies.some(item => item.root === route)) failures.push(`site-registry: missing canonical route family ${route}`);
}

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
  navigation: canonicalLabels,
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
