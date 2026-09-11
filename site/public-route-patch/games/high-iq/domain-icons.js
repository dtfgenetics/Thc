const ICON_MANIFEST_URL = new URL('./assets/domains/manifest.json', import.meta.url);

let iconMap = new Map();

function iconUrl(file) {
  return new URL(`./assets/domains/${file}`, import.meta.url).href;
}

function buildIcon(category, className = 'hiq-domain-icon') {
  const record = iconMap.get(category);
  if (!record) return null;
  const img = document.createElement('img');
  img.className = className;
  img.src = iconUrl(record.file);
  img.alt = '';
  img.setAttribute('aria-hidden', 'true');
  img.decoding = 'async';
  return img;
}

function decorateTopicMap() {
  const map = document.querySelector('#topic-map');
  if (!map) return;
  for (const card of map.querySelectorAll(':scope > article')) {
    const heading = card.querySelector('.topic-map-heading');
    const title = heading?.querySelector('h3');
    if (!heading || !title || heading.querySelector('.hiq-domain-icon')) continue;
    const icon = buildIcon(title.textContent.trim());
    if (!icon) continue;
    const labelWrap = document.createElement('div');
    labelWrap.className = 'hiq-topic-label';
    heading.insertBefore(labelWrap, title);
    labelWrap.append(icon, title);
  }
}

function decorateQuestionCategory() {
  const badge = document.querySelector('#question-category');
  if (!badge) return;
  const category = badge.textContent.trim();
  if (!category || badge.querySelector('.hiq-domain-icon-inline')) return;
  const icon = buildIcon(category, 'hiq-domain-icon hiq-domain-icon-inline');
  if (icon) badge.prepend(icon);
}

function installStyles() {
  if (document.querySelector('#hiq-domain-icon-styles')) return;
  const style = document.createElement('style');
  style.id = 'hiq-domain-icon-styles';
  style.textContent = `
    .hiq-topic-label{display:flex;align-items:center;gap:10px;min-width:0}
    .hiq-domain-icon{width:34px;height:34px;flex:0 0 auto;object-fit:contain}
    .hiq-domain-icon-inline{width:18px;height:18px;margin-right:5px}
    .topic-map-heading h3{margin:0}
    @media (max-width:520px){.hiq-domain-icon{width:30px;height:30px}.hiq-domain-icon-inline{width:17px;height:17px}}
    @media (forced-colors:active){.hiq-domain-icon{filter:grayscale(1) contrast(2)}}
  `;
  document.head.append(style);
}

async function initDomainIcons() {
  try {
    const response = await fetch(`${ICON_MANIFEST_URL.href}?v=2`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const manifest = await response.json();
    iconMap = new Map((manifest.categories || []).map((record) => [record.category, record]));
    installStyles();
    decorateTopicMap();
    decorateQuestionCategory();

    const topicMap = document.querySelector('#topic-map');
    if (topicMap) new MutationObserver(decorateTopicMap).observe(topicMap, { childList: true, subtree: true });

    const categoryBadge = document.querySelector('#question-category');
    if (categoryBadge) new MutationObserver(decorateQuestionCategory).observe(categoryBadge, { childList: true, characterData: true, subtree: true });
  } catch {
    // Icons are progressive enhancement only; quiz logic remains authoritative.
  }
}

if (typeof document !== 'undefined') initDomainIcons();
