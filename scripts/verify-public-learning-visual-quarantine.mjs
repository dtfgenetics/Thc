import { readFile } from 'node:fs/promises';
import process from 'node:process';

const [htmlPath, route = '/'] = process.argv.slice(2);
const policyPath = process.env.DTF_VISUAL_POLICY || 'site/wordpress/visual-quality-policy.json';
if (!htmlPath) throw new Error('Usage: node scripts/verify-public-learning-visual-quarantine.mjs <html-file> [route]');

const html = await readFile(htmlPath, 'utf8');
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
const stripped = html
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

const retiredSource = /(?:THC[-_ ]?C[0-9]{3}|THC[-_ ]?ENC[-_ ]?[0-9]{3}|Outdoor[-_ ]?[0-9]{2}|Cannabis[_ -]Plant[_ -]Anatomy[_ -]Infographic|Cannabis[_ -]Plant[_ -]Life[_ -]Cycle[_ -]Seed[_ -]to[_ -]Harvest[_ -]Infographic|Cannabis[_ -]Sex[_ -]Expression[_ -]and[_ -]Chromosome[_ -]Combinations|Beneficial[_ -]Insects[_ -]and[_ -]Biological[_ -]Controls|C[0-9]{3}[_ -]Companion)/i;
const learningProduct = /(?:dtf[-_ ]?strain[-_ ]?card|Strain[_ -]Card|DTF[ _-]+Genetics[ _-]+strain[ _-]+card|Mystery[_ -]Line[_ -]F1[_ -]Regular|Rainbow[_ -]Bubblegum[_ -]F1[_ -]Regular)/i;
const retiredAlt = /^\s*Teaching[ _-]+Healthy[ _-]+Cultivation/i;

const decode = (value = '') => String(value)
  .replaceAll('&quot;', '"')
  .replaceAll('&#34;', '"')
  .replaceAll('&#39;', "'")
  .replaceAll('&amp;', '&');

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i'));
  return match ? decode(match[2]) : '';
}

const findings = [];
const mediaTags = stripped.match(/<(?:img|source)\b[^>]*>/gi) || [];
for (const tag of mediaTags) {
  const sourceValues = ['src', 'srcset', 'data-src', 'data-srcset'].map((name) => attr(tag, name)).filter(Boolean);
  const alt = attr(tag, 'alt');

  for (const value of sourceValues) {
    if (retiredSource.test(value)) findings.push({ kind: 'retired-media-source', route, value, tag: tag.slice(0, 1200) });
    for (const banned of policy?.bannedMedia?.urlContains || []) {
      if (banned && value.toLowerCase().includes(String(banned).toLowerCase())) findings.push({ kind: 'policy-banned-url', route, value, banned, tag: tag.slice(0, 1200) });
    }
    for (const prefix of policy?.bannedMedia?.slugPrefixes || []) {
      if (prefix && value.toLowerCase().includes(String(prefix).toLowerCase())) findings.push({ kind: 'policy-banned-slug', route, value, prefix, tag: tag.slice(0, 1200) });
    }
    if (route.startsWith('/learn/') && learningProduct.test(value)) findings.push({ kind: 'learning-product-visual', route, value, tag: tag.slice(0, 1200) });
  }

  if (alt && retiredAlt.test(alt)) findings.push({ kind: 'retired-media-alt', route, value: alt, tag: tag.slice(0, 1200) });
  if (route.startsWith('/learn/') && learningProduct.test(alt)) findings.push({ kind: 'learning-product-alt', route, value: alt, tag: tag.slice(0, 1200) });
}

// Inline style attributes can render background images without img/source tags.
// Inspect only actual element attributes after style/script blocks are removed;
// never scan stylesheet selector text such as img[src*="..."] as rendered media.
const tagsWithStyle = stripped.match(/<[a-z][^>]*\bstyle\s*=\s*(["'])[^>]*>/gi) || [];
for (const tag of tagsWithStyle) {
  const style = attr(tag, 'style');
  if (!style) continue;
  if (retiredSource.test(style)) findings.push({ kind: 'retired-inline-background', route, value: style, tag: tag.slice(0, 1200) });
  for (const banned of policy?.bannedMedia?.urlContains || []) {
    if (banned && style.toLowerCase().includes(String(banned).toLowerCase())) findings.push({ kind: 'policy-banned-inline-background', route, value: style, banned, tag: tag.slice(0, 1200) });
  }
}

const unique = [];
const seen = new Set();
for (const finding of findings) {
  const key = `${finding.kind}\n${finding.value}\n${finding.tag}`;
  if (seen.has(key)) continue;
  seen.add(key);
  unique.push(finding);
}

const result = {
  ok: unique.length === 0,
  route,
  htmlPath,
  mediaTagCount: mediaTags.length,
  inlineStyleTagCount: tagsWithStyle.length,
  findingCount: unique.length,
  findings: unique.slice(0, 25)
};
console.log(JSON.stringify(result, null, 2));
if (unique.length) process.exit(1);
