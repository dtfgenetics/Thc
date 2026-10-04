#!/usr/bin/env node
import fs from 'node:fs';
import { readCanonicalEncyclopediaLessons } from './lib/encyclopedia-canonical-lessons.mjs';
import { encyclopediaStructuredData, encyclopediaStructuredDataHtml } from './lib/encyclopedia-structured-data.mjs';

const lessons=readCanonicalEncyclopediaLessons(process.cwd());
const errors=[];
const muPluginPath='site/wordpress/mu-plugins/dtf-learning-search.php';
const publisherPath='scripts/publish-wordpress-encyclopedia-canonical-batch.mjs';
if(!fs.existsSync(muPluginPath)) errors.push('Missing WordPress MU-plugin structured-data runtime.');
const muPlugin=fs.existsSync(muPluginPath)?fs.readFileSync(muPluginPath,'utf8'):'';
const publisher=fs.existsSync(publisherPath)?fs.readFileSync(publisherPath,'utf8'):'';
for(const [label,needle] of [
  ['lesson route matcher','dtf_learning_encyclopedia_lesson_id'],
  ['wp_head hook',"add_action('wp_head'"],
  ['JSON-LD mime','application/ld+json'],
  ['schema marker','data-dtf-encyclopedia-schema'],
  ['Article type',"'Article'"],
  ['LearningResource type',"'LearningResource'"],
  ['BreadcrumbList type',"'BreadcrumbList'"],
  ['stable identifier',"'identifier' => $lesson_id"],
  ['datePublished',"'datePublished'"],
  ['dateModified',"'dateModified'"]
]) if(!muPlugin.includes(needle)) errors.push('MU-plugin structured-data runtime missing '+label);
if(publisher.includes('application/ld+json')||publisher.includes('encyclopediaStructuredDataHtml')) errors.push('Publisher must not embed JSON-LD into sanitizable WordPress post content');
if(lessons.length!==420) errors.push('Expected 420 canonical lessons; found '+lessons.length);

for(const lesson of lessons){
  const data=encyclopediaStructuredData(lesson,{site:'https://dtfseeds.com'});
  if(data['@context']!=='https://schema.org') errors.push(lesson.id+': wrong @context');
  if(!Array.isArray(data['@graph'])||data['@graph'].length!==2) errors.push(lesson.id+': expected Article/LearningResource + BreadcrumbList graph');
  const article=data['@graph']?.[0]||{};
  const breadcrumbs=data['@graph']?.[1]||{};
  const types=Array.isArray(article['@type'])?article['@type']:[article['@type']];
  if(!types.includes('Article')||!types.includes('LearningResource')) errors.push(lesson.id+': missing Article/LearningResource types');
  if(article.identifier!==lesson.id) errors.push(lesson.id+': identifier mismatch');
  if(article.headline!==lesson.title) errors.push(lesson.id+': headline mismatch');
  if(article.description!==lesson.objective||article.teaches!==lesson.objective) errors.push(lesson.id+': objective/teaches mismatch');
  if(article.inLanguage!=='en-US') errors.push(lesson.id+': inLanguage mismatch');
  if(!String(article.url||'').endsWith('/'+lesson.id.toLowerCase()+'/')) errors.push(lesson.id+': canonical lesson URL mismatch');
  if(article.publisher?.name!=='DTF Genetics') errors.push(lesson.id+': publisher mismatch');
  if(breadcrumbs['@type']!=='BreadcrumbList') errors.push(lesson.id+': BreadcrumbList missing');
  if(!Array.isArray(breadcrumbs.itemListElement)||breadcrumbs.itemListElement.length!==3) errors.push(lesson.id+': breadcrumb length mismatch');
  const html=encyclopediaStructuredDataHtml(lesson,{site:'https://dtfseeds.com'});
  if(!html.startsWith('<script type="application/ld+json">')) errors.push(lesson.id+': JSON-LD script wrapper missing');
  if(html.includes('<script type="application/ld+json"><script')) errors.push(lesson.id+': nested script corruption');
}

if(errors.length){
  console.error('Encyclopedia structured data validation failed with '+errors.length+' issue(s):');
  for(const error of errors.slice(0,100)) console.error(' - '+error);
  process.exit(1);
}
console.log('Encyclopedia structured data PASS: 420/420 canonical lesson schema contracts validate and WordPress emits JSON-LD server-side from the MU-plugin.');
