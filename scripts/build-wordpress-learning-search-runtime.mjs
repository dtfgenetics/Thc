import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const outDir=path.join(root,'site/wordpress/mu-plugins/dtf-learning-search');
const check=process.argv.includes('--check');

const sources={
  'fuse-7.1.0.min.js':'site/public-route-patch/assets/vendor/fuse-7.1.0.min.mjs',
  'thc-search-explain-v1.js':'site/public-route-patch/learn/search/thc-search-explain-v1.mjs',
  'search-v1.js':'site/public-route-patch/learn/search/search-v1.mjs',
  'encyclopedia-v1.js':'site/public-route-patch/learn/encyclopedia/encyclopedia-v1.mjs'
};

function transform(name,text){
  let out=text;
  if(name==='search-v1.js'){
    out=out.replace("import Fuse from '/assets/vendor/fuse-7.1.0.min.mjs';","import Fuse from './fuse-7.1.0.min.js';");
    out=out.replace("from './thc-search-explain-v1.mjs'", "from './thc-search-explain-v1.js'");
  }
  if(name==='encyclopedia-v1.js'){
    out=out
      .replace("import Fuse from '/assets/vendor/fuse-7.1.0.min.mjs';","import Fuse from './fuse-7.1.0.min.js';")
      .replace("import {explainSearchMatch} from '../search/thc-search-explain-v1.mjs';","import {explainSearchMatch} from './thc-search-explain-v1.js';");
  }
  return out;
}

fs.mkdirSync(outDir,{recursive:true});
// Validate the transformed module graph, not merely byte agreement with source.
// A synchronized build can still reference a file that is never deployed.
for(const [name,rel] of Object.entries(sources)){
  const expected=transform(name,fs.readFileSync(path.join(root,rel),'utf8'));
  for(const match of expected.matchAll(/\bfrom\s*['"](\.[^'"]+)['"]/g)){
    const target=path.posix.normalize(path.posix.join(path.posix.dirname(name),match[1]));
    if(!Object.hasOwn(sources,target)){
      throw new Error(`WordPress learning-search unresolved import: ${name} -> ${match[1]}`);
    }
  }
}
let changed=0;
for(const [name,rel] of Object.entries(sources)){
  const expected=transform(name,fs.readFileSync(path.join(root,rel),'utf8'));
  const dest=path.join(outDir,name);
  if(check){
    const actual=fs.existsSync(dest)?fs.readFileSync(dest,'utf8'):'';
    if(actual!==expected){
      console.error(`WordPress learning-search asset drift: ${name}`);
      changed++;
    }
  }else{
    fs.writeFileSync(dest,expected);
    console.log(`Built ${path.relative(root,dest)}`);
  }
}
if(check&&changed){
  process.exit(1);
}
if(check)console.log('WordPress learning-search runtime assets are synchronized.');
