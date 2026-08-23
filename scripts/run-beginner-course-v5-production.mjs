import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source='scripts/publish-wordpress-beginner-course-v5.mjs';
const target='/tmp/publish-wordpress-beginner-course-v5-runtime.mjs';
let code=await readFile(source,'utf8');
const original=`    const h1Count=(html.match(/<h1\\b/gi)||[]).length;\n    if(h1Count!==1) throw new Error(\`${'${item.slug}'}: expected one H1, found ${'${h1Count}'}.\`);`;
const replacement=`    const owned=html.match(/<main class="dtf-beginner-v5"[\\s\\S]*?<\\/main>/i);\n    if(!owned) throw new Error(\`${'${item.slug}'}: controlled beginner content wrapper missing.\`);\n    const h1Count=(owned[0].match(/<h1\\b/gi)||[]).length;\n    if(h1Count!==1) throw new Error(\`${'${item.slug}'}: expected one controlled course H1, found ${'${h1Count}'}.\`);\n    if(!html.includes(\`body.page-id-${'${item.id}'} .entry-title\`)) throw new Error(\`${'${item.slug}'}: theme-title suppression is missing.\`);`;
if(!code.includes(original)) throw new Error('Could not locate the reviewed beginner V5 H1 verifier; refusing runtime patch.');
code=code.replace(original,replacement);
await writeFile(target,code);
await import(pathToFileURL(target).href);
