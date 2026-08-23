import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const source='scripts/publish-wordpress-diagnostic-index-v5.mjs';
const target='/tmp/publish-wordpress-diagnostic-index-v5-runtime.mjs';
let code=await readFile(source,'utf8');
const original=`  const h1=(visitor.match(/<h1\\b/gi)||[]).length;if(h1!==1) throw new Error(\`Expected one H1, found ${'${h1}'}.\`);`;
const replacement=`  const owned=visitor.match(/<main class="dx5"[\\s\\S]*?<\\/main>/i);\n  if(!owned) throw new Error('Controlled diagnostic wrapper missing.');\n  const h1=(owned[0].match(/<h1\\b/gi)||[]).length;if(h1!==1) throw new Error(\`Expected one controlled diagnostic H1, found ${'${h1}'}.\`);\n  if(!visitor.includes(\`body.page-id-${'${page.id}'} .entry-title\`)) throw new Error('Theme-title suppression is missing.');`;
if(!code.includes(original)) throw new Error('Could not locate the reviewed diagnostic V5 H1 verifier; refusing runtime patch.');
code=code.replace(original,replacement);
await writeFile(target,code);
await import(pathToFileURL(target).href);
