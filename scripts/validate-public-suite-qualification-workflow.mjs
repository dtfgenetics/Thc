import fs from 'node:fs';

const path='.github/workflows/public-suite-build-qualification.yml';
const text=fs.readFileSync(path,'utf8');
const errors=[];
const ok=(value,message)=>{ if(!value) errors.push(message); };
const count=(token)=>text.split(token).length-1;

for (const [name, expected] of [
  ['Checkout branch qualification source',1],
  ['Dispatch branch build and require success',1],
  ['Download qualified branch artifact',1],
  ['Verify Grow Doc pinned source and reviewed-media payload',1],
  ['Package production archive and enforce protected size limit',1],
  ['Report production package qualification',1],
]) ok(count(`- name: ${name}`)===expected,`expected exactly ${expected} step named "${name}", found ${count(`- name: ${name}`)}`);

ok(count('jobs:')===1,'workflow must contain exactly one jobs mapping');
ok(count('qualify:')===1,'workflow must contain exactly one qualify job');
ok(count('gh run watch "$run_id" --repo "$GITHUB_REPOSITORY" --exit-status')===1,'qualification must wait for the dispatched build exactly once');
ok(count('gh run download "${{ steps.build.outputs.run_id }}"')===1,'qualification must download the dispatched artifact exactly once');
ok(!/status="\$\{state%%\s*\n\s*- name:/.test(text),'workflow step content is spliced into shell parameter expansion');
ok(!/conclusion="\$\{state#\*\s*\n\s*- name:/.test(text),'workflow step content is spliced into conclusion parsing');
ok(!text.includes('\\t\'*}'), 'workflow contains leaked shell/YAML corruption token');
ok(text.trimEnd().endsWith('} >> "$GITHUB_STEP_SUMMARY"'),'workflow has unexpected trailing duplicated content after report step');

if(errors.length){
  console.error(`Public Suite qualification workflow integrity failed with ${errors.length} issue(s):`);
  for(const error of errors) console.error(' - '+error);
  process.exit(1);
}
console.log('Public Suite qualification workflow integrity passed.');
