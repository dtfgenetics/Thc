import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function decodeHtmlEntity(entity) {
  const normalized = String(entity || '').toLowerCase();
  const named = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' '
  };
  if (Object.prototype.hasOwnProperty.call(named, normalized)) return named[normalized];

  const radix = normalized.startsWith('#x') ? 16 : 10;
  const numeric = normalized.startsWith('#x')
    ? normalized.slice(2)
    : normalized.startsWith('#')
      ? normalized.slice(1)
      : '';
  if (numeric) {
    const codePoint = Number.parseInt(numeric, radix);
    if (Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
      return String.fromCodePoint(codePoint);
    }
  }

  return `&${entity};`;
}

export function normalizeHtmlVisibleText(value) {
  return String(value || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (_match, entity) => decodeHtmlEntity(entity))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('Usage: node scripts/normalize-html-visible-text.mjs <html-file>');
    process.exit(2);
  }
  process.stdout.write(`${normalizeHtmlVisibleText(readFileSync(inputPath, 'utf8'))}\n`);
}
