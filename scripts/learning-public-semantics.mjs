#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const publicSemantics = [
  'Teaching Healthy Cultivation',
  'Learn in a sequence that makes the plant easier to understand.',
  'Open the THC Living Plant Atlas',
  'See how the systems connect before you go deep.',
  'Learn the plant as a connected system.',
  'Plant Health & IPM',
  'Cultivation Science',
  'Symptom Differentials',
  'Printable Field Tools',
  'Evidence & Sources'
];

export const publicRoutes = [
  '/learn/atlas/',
  '/learn/plant-health/',
  '/learn/cultivation-science/',
  '/learn/symptoms/',
  '/learn/tools/',
  '/learn/sources/'
];

const namedEntities = new Map([
  ['amp', '&'],
  ['quot', '"'],
  ['apos', "'"],
  ['lt', '<'],
  ['gt', '>'],
  ['nbsp', ' ']
]);

export function decodeHtmlEntities(value) {
  return String(value || '').replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z][a-z0-9]+);/gi, (match, token) => {
    if (token[0] === '#') {
      const raw = token.slice(1);
      const radix = raw[0]?.toLowerCase() === 'x' ? 16 : 10;
      const digits = radix === 16 ? raw.slice(1) : raw;
      const codePoint = Number.parseInt(digits, radix);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return match;
      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    }
    return namedEntities.get(token.toLowerCase()) ?? match;
  });
}

export function inspectLearningPublicHtml(html) {
  const decodedHtml = decodeHtmlEntities(html);
  const normalized = decodedHtml.toLowerCase();
  const missingSemantics = publicSemantics.filter((marker) => !normalized.includes(marker.toLowerCase()));
  const missingRoutes = publicRoutes.filter((href) => !decodedHtml.includes(href));
  return {
    ok: missingSemantics.length === 0 && missingRoutes.length === 0,
    missingSemantics,
    missingRoutes,
    decodedBytes: Buffer.byteLength(decodedHtml, 'utf8')
  };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error('Usage: node scripts/learning-public-semantics.mjs <html-file>');
  const html = await readFile(filePath, 'utf8');
  const result = inspectLearningPublicHtml(html);
  console.log(JSON.stringify({ filePath, ...result }, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
