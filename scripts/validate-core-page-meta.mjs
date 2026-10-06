#!/usr/bin/env node
import fs from 'node:fs';

const path = process.env.CORE_META_PATH || 'site/wordpress/seo/core-page-meta.json';
const manifest = JSON.parse(fs.readFileSync(path, 'utf8'));
const errors = [];
const expectedSlugs = ['home','learn','courses','community','gallery','about','contact'];

if (!Array.isArray(manifest.pages)) errors.push('pages must be an array');
const pages = Array.isArray(manifest.pages) ? manifest.pages : [];
const slugs = pages.map((page) => page?.slug);
const routes = pages.map((page) => page?.route);

if (JSON.stringify(slugs) !== JSON.stringify(expectedSlugs)) {
  errors.push('core metadata slugs must remain ordered and complete: ' + expectedSlugs.join(', '));
}
if (new Set(slugs).size !== slugs.length) errors.push('duplicate metadata slug');
if (new Set(routes).size !== routes.length) errors.push('duplicate metadata route');

for (const page of pages) {
  if (!page?.slug || !page?.route || !page?.title || !page?.description) {
    errors.push('every metadata record requires slug, route, title, and description');
    continue;
  }
  const expectedRoute = page.slug === 'home' ? '/' : '/' + page.slug + '/';
  if (page.route !== expectedRoute) errors.push(page.slug + ': route must be ' + expectedRoute);
  if (page.title.length > 60) errors.push(page.slug + ': title too long (' + page.title.length + ')');
  if (page.description.length < 80 || page.description.length > 160) {
    errors.push(page.slug + ': description must be 80–160 characters (' + page.description.length + ')');
  }
}

if (errors.length) {
  console.error('Core page metadata validation failed:');
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log('Core page metadata valid for ' + pages.length + ' canonical routes.');
