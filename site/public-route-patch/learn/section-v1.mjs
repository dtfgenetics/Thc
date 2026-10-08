// Progressive, data-driven THC learning sections. Keep destination URLs on this site.
const key = document.body.dataset.sectionKey || 'home';
const title = document.querySelector('[data-title]');
const intro = document.querySelector('[data-intro]');
const eyebrow = document.querySelector('[data-eyebrow]');
const cards = document.querySelector('[data-cards]');

function internalHref(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return null;
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.origin === window.location.origin ? parsed.pathname + parsed.search + parsed.hash : null;
  } catch { return null; }
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = String(content);
  return node;
}

function renderGroups(groups) {
  const fragment = document.createDocumentFragment();
  let visible = 0;
  for (const group of groups) {
    if (!group || typeof group.title !== 'string' || !group.title.trim()) continue;
    const article = element('article', 'card');
    article.append(element('h2', '', group.title));
    if (group.text) article.append(element('p', '', group.text));
    const links = element('div', 'links');
    for (const entry of Array.isArray(group.links) ? group.links : []) {
      if (!Array.isArray(entry) || typeof entry[0] !== 'string') continue;
      const href = internalHref(entry[1]);
      if (!href || !entry[0].trim()) continue;
      const anchor = element('a', '', entry[0]);
      anchor.href = href;
      links.append(anchor);
    }
    if (!links.childElementCount) continue;
    article.append(links);
    fragment.append(article);
    visible++;
  }
  if (!visible) throw new Error('No valid learning destinations');
  cards.replaceChildren(fragment);
}

function fallback() {
  title.textContent = 'Teaching Healthy Cultivation';
  intro.textContent = 'This learning section is temporarily unavailable. You can still search the education library.';
  eyebrow.textContent = 'Education navigation';
  const card = element('article', 'card');
  card.append(element('h2', '', 'Find educational material'));
  const links = element('div', 'links');
  const search = element('a', '', 'Search education');
  search.href = '/learn/search/';
  links.append(search);
  card.append(links);
  cards.replaceChildren(card);
}

async function load() {
  if (!title || !intro || !eyebrow || !cards) return;
  cards.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch('/learn/section-data-v1.json', {cache: 'no-store'});
    if (!response.ok) throw new Error('Learning navigation data failed to load');
    const payload = await response.json();
    const section = payload?.sections?.[key];
    if (!section || typeof section.title !== 'string' || !Array.isArray(section.groups)) {
      throw new Error('Unknown or invalid education section');
    }
    renderGroups(section.groups);
    document.title = section.title + ' | THC Education | DTF Genetics';
    title.textContent = section.title;
    intro.textContent = section.intro || '';
    eyebrow.textContent = section.eyebrow || 'Teaching Healthy Cultivation';
  } catch (error) {
    console.error('[THC learn section]', error);
    fallback();
  } finally {
    cards.removeAttribute('aria-busy');
  }
}
void load();
