import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/wordpress-presentation-backups';
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const backupDir = join(backupRoot, `presentation-${stamp}`);

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'DTFSeeds-Presentation-Repair/1.0'
};

function rawText(value) {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') return value.raw || value.rendered || '';
  return '';
}

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000)
  });
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 2000) }; }
  if (!response.ok) {
    throw new Error(`WordPress ${path} returned HTTP ${response.status}${body?.code ? ` (${body.code})` : ''}${body?.message ? `: ${body.message}` : ''}`);
  }
  return body;
}

const canonicalNavigation = [
  ['Home', '/'],
  ['Seeds', '/seeds/'],
  ['Learn', '/learn/'],
  ['Games', '/games/'],
  ['Community', '/community/'],
  ['Shop', '/shop/'],
  ['Gallery', '/gallery/'],
  ['About', '/about/'],
  ['Contact', '/contact/']
];

function navBlockContent(items) {
  return items.map(([label, url]) =>
    `<!-- wp:navigation-link {"label":"${label}","url":"${url}","kind":"custom","isTopLevelLink":true} /-->`
  ).join('\n');
}

const footerContent = `<!-- wp:group {"tagName":"footer","layout":{"type":"constrained"}} -->
<footer class="wp-block-group">
<!-- wp:heading {"level":3} --><h3 class="wp-block-heading">DTF Genetics</h3><!-- /wp:heading -->
<!-- wp:paragraph --><p>Dream the Future. Genetics, cultivation education, practical tools, original games, and community.</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p><a href="/">Home</a> · <a href="/seeds/">Seeds</a> · <a href="/learn/">Learn</a> · <a href="/games/">Games</a> · <a href="/community/">Community</a> · <a href="/shop/">Shop</a> · <a href="/gallery/">Gallery</a> · <a href="/about/">About</a> · <a href="/contact/">Contact</a></p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p><a href="https://discord.gg/xJbUeHFPMt" target="_blank" rel="noopener noreferrer">Join the DTF / Teaching Healthy Cultivation Discord</a></p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>© 2026 DTF Genetics. All rights reserved.</p><!-- /wp:paragraph -->
</footer>
<!-- /wp:group -->`;

await mkdir(backupDir, { recursive: true });

const themes = await request('/wp-json/wp/v2/themes?status=active');
const activeTheme = Array.isArray(themes) ? themes[0] : null;
if (!activeTheme || activeTheme.stylesheet !== 'hostinger-ai-theme' || !activeTheme.is_block_theme) {
  throw new Error(`Refusing presentation repair: expected active block theme hostinger-ai-theme, received ${activeTheme?.stylesheet || 'none'}`);
}
await writeFile(join(backupDir, 'active-theme.json'), `${JSON.stringify(activeTheme, null, 2)}\n`, 'utf8');

const templateParts = await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
if (!Array.isArray(templateParts)) throw new Error('Unexpected template-parts response');
const footer = templateParts.find((part) => part?.id === 'hostinger-ai-theme//footer' && part?.slug === 'footer' && part?.source === 'custom');
if (!footer?.id) throw new Error('Refusing presentation repair: custom Hostinger footer template part was not found');
await writeFile(join(backupDir, 'footer-before.json'), `${JSON.stringify(footer, null, 2)}\n`, 'utf8');

const footerBefore = rawText(footer.content);
const footerNeedsRepair = footerBefore.includes('email@email.com') || footerBefore.includes('+123456789') || footerBefore.includes('© 2025') || footerBefore.includes('2025 DTF GENETICS');
let footerChanged = false;
if (footerNeedsRepair) {
  const encodedId = encodeURIComponent(footer.id);
  const updatedFooter = await request(`/wp-json/wp/v2/template-parts/${encodedId}`, {
    method: 'POST',
    body: JSON.stringify({ content: footerContent })
  });
  await writeFile(join(backupDir, 'footer-after.json'), `${JSON.stringify(updatedFooter, null, 2)}\n`, 'utf8');
  footerChanged = true;
  console.log(`Updated custom footer template part ${footer.id} (wp_id ${footer.wp_id || 'unknown'}).`);
} else {
  console.log('Custom footer already has no fake contact/copyright markers.');
}

const navigations = await request('/wp-json/wp/v2/navigation?context=edit&per_page=100&status=publish');
if (!Array.isArray(navigations)) throw new Error('Unexpected navigation response');
const staleNavigations = navigations.filter((nav) => {
  const slug = String(nav?.slug || '');
  const content = rawText(nav?.content).toLowerCase();
  return slug === 'navigation' || slug.startsWith('ai-menu') || content.includes('blog') || content.includes('knowledge');
});
await writeFile(join(backupDir, 'navigation-before.json'), `${JSON.stringify(staleNavigations, null, 2)}\n`, 'utf8');

const canonicalNavContent = navBlockContent(canonicalNavigation);
const navigationResults = [];
for (const nav of staleNavigations) {
  const updated = await request(`/wp-json/wp/v2/navigation/${nav.id}`, {
    method: 'POST',
    body: JSON.stringify({ content: canonicalNavContent, status: 'publish' })
  });
  navigationResults.push({ id: updated.id, slug: updated.slug, status: updated.status, modified: updated.modified });
  console.log(`Updated navigation ${nav.id} (${nav.slug}).`);
}
await writeFile(join(backupDir, 'navigation-after.json'), `${JSON.stringify(navigationResults, null, 2)}\n`, 'utf8');

const verifyParts = await request('/wp-json/wp/v2/template-parts?context=edit&per_page=100');
const verifiedFooter = verifyParts.find((part) => part?.id === 'hostinger-ai-theme//footer');
const verifiedFooterText = rawText(verifiedFooter?.content);
const footerDefectsRemain = ['email@email.com', '+123456789', '2025 DTF GENETICS'].filter((marker) => verifiedFooterText.includes(marker));
if (footerDefectsRemain.length) throw new Error(`Footer verification failed; stale markers remain: ${footerDefectsRemain.join(', ')}`);
if (!verifiedFooterText.includes('discord.gg/xJbUeHFPMt')) throw new Error('Footer verification failed; official Discord CTA is missing');

const verifyNavigation = await request('/wp-json/wp/v2/navigation?context=edit&per_page=100&status=publish');
const verifiedTargets = verifyNavigation.filter((nav) => staleNavigations.some((before) => before.id === nav.id));
for (const nav of verifiedTargets) {
  const content = rawText(nav.content);
  if (/\bBlog\b/i.test(content) || /\bKnowledge\b/i.test(content)) {
    throw new Error(`Navigation verification failed for ${nav.id}; stale Blog/Knowledge link remains`);
  }
  for (const required of ['Seeds', 'Learn', 'Games', 'Community', 'Shop']) {
    if (!content.includes(`\"label\":\"${required}\"`) && !content.includes(`"label":"${required}"`)) {
      throw new Error(`Navigation verification failed for ${nav.id}; required ${required} link missing`);
    }
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  activeTheme: activeTheme.stylesheet,
  footerTemplatePartId: footer.id,
  footerWpId: footer.wp_id || null,
  footerChanged,
  navigationRecordsMatched: staleNavigations.length,
  navigationRecordsUpdated: navigationResults.length,
  officialDiscord: 'https://discord.gg/xJbUeHFPMt',
  backupDir,
  verification: {
    footerFakeMarkersRemoved: true,
    officialDiscordPresent: true,
    staleBlogKnowledgeNavigationRemoved: true,
    canonicalNavigationPresent: true
  }
};
await writeFile(join(backupDir, 'presentation-repair-result.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
await writeFile(join(backupRoot, 'presentation-backup-path.txt'), `${backupDir}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
