import fs from 'node:fs';

const site=(process.env.SITE||'https://dtfseeds.com').replace(/\/$/,'');
const gameBase=`${site}/games/crossword/`;
const pin=fs.readFileSync('site/public-route-patch/games/crossword/source-revision.txt','utf8');
const expectedRevision=pin.match(/^commit=([0-9a-f]{40})$/m)?.[1];
if(!expectedRevision) throw new Error('Pinned Crossword revision is missing.');

async function getAbsolute(url,label){
  const response=await fetch(url,{
    redirect:'follow',
    cache:'no-store',
    signal:AbortSignal.timeout(15000),
    headers:{
      'user-agent':'DTFSeeds-Crossword-live-verifier/1.0',
      'cache-control':'no-cache, no-store, max-age=0',
      pragma:'no-cache'
    }
  });
  if(!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  return {text:await response.text(),type:response.headers.get('content-type')||'',url:response.url};
}
const getGame=(path,label)=>getAbsolute(new URL(path,gameBase),label);

const [page,revision,currentPuzzle,indexData]=await Promise.all([
  getGame('./','Crossword route'),
  getGame('./source-revision.txt','Crossword source revision'),
  getAbsolute(`${site}/puzzles/current.json`,'Current crossword puzzle'),
  getAbsolute(`${site}/puzzles/index.json`,'Crossword archive index')
]);

if(!/text\/html/i.test(page.type)) throw new Error('Crossword route did not return HTML.');
for(const marker of ['THC Daily Crossword','DTF Genetics']){
  if(!page.text.includes(marker)) throw new Error(`Crossword HTML missing marker: ${marker}`);
}
if(page.text.includes('/src/main.js') || page.text.includes('/src/keyboard-polish.js')){
  throw new Error('Crossword live route is serving development Vite entrypoints.');
}

const moduleSrcs=[...page.text.matchAll(/<script[^>]+type=["']module["'][^>]+src=["']([^"']+\.js)["']/gi)].map(m=>m[1]);
const cssHrefs=[...page.text.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css)["']/gi)].map(m=>m[1]);
if(!moduleSrcs.length || !cssHrefs.length) throw new Error('Crossword built JS/CSS assets were not discoverable.');
for(const asset of [...moduleSrcs,...cssHrefs]){
  const absolute=new URL(asset,page.url).href;
  if(!absolute.includes('/games/crossword/')) throw new Error(`Crossword asset escaped game base path: ${absolute}`);
}

const bundles=await Promise.all(moduleSrcs.map((src,i)=>getAbsolute(new URL(src,page.url),`Crossword JS bundle ${i+1}`)));
const styles=await Promise.all(cssHrefs.map((href,i)=>getAbsolute(new URL(href,page.url),`Crossword CSS bundle ${i+1}`)));
const js=bundles.map(x=>x.text).join('\n');
const css=styles.map(x=>x.text).join('\n');
const compactCss=css.replace(/\s+/g,'');

for(const marker of [
  '/puzzles/current.json',
  '/puzzles/index.json',
  'Crossword letter input',
  'Progress:',
  'Solved. Nice work.',
  'How to play',
  'Current clue'
]){
  if(!js.includes(marker)) throw new Error(`Crossword production JS missing marker: ${marker}`);
}
for(const marker of ['touch-action:manipulation','min-height:44px','overscroll-behavior-inline:contain','prefers-reduced-motion:reduce']){
  if(!compactCss.includes(marker)) throw new Error(`Crossword production CSS missing marker: ${marker}`);
}

const puzzle=JSON.parse(currentPuzzle.text);
if(!puzzle.id || !Array.isArray(puzzle.grid) || !puzzle.grid.length) throw new Error('Current crossword puzzle is incomplete.');
if(!Array.isArray(puzzle.words) || puzzle.words.length < 10) throw new Error(`Current crossword puzzle has too few words: ${puzzle.words?.length||0}`);
if(!puzzle.clues?.across?.length || !puzzle.clues?.down?.length) throw new Error('Current crossword puzzle must contain across and down clues.');
if(puzzle.rows!==puzzle.grid.length) throw new Error('Current crossword row metadata does not match grid.');

const archive=JSON.parse(indexData.text);
if(!Array.isArray(archive.puzzles)) throw new Error('Crossword archive index is missing puzzles array.');
if(archive.puzzles.length && !archive.puzzles.some(entry=>entry.id===puzzle.id)){
  throw new Error(`Current puzzle ${puzzle.id} is missing from archive index.`);
}

if(!revision.text.includes(`commit=${expectedRevision}`)) throw new Error(`Live Crossword source revision does not match ${expectedRevision}`);
if(!revision.text.includes('repository=dtfgenetics/Thc-crossword-')) throw new Error('Live Crossword source repository marker missing.');

console.log(`THC Daily Crossword live verification passed at ${gameBase}; puzzle ${puzzle.id}; pinned ${expectedRevision}.`);
