import fs from 'node:fs';

const local=fs.readFileSync('scripts/validate-thc-tool-suite-v1.mjs','utf8');
const live=fs.readFileSync('scripts/verify-cultivation-reference-tools-live.mjs','utf8');

const failures=[];
const ok=(value,message)=>{if(!value)failures.push(message)};

for(const [name,source] of [['local validator',local],['live verifier',live]]){
  ok(source.includes('data/tool-registry.json'),`${name} must consume data/tool-registry.json`);
}

ok(!/const\s+tools\s*=\s*\[/.test(local),'local validator must not own an independent hard-coded tool route array');
ok(!/const\s+routes\s*=\s*\[/.test(live),'live verifier must not own an independent hard-coded route array');

for(const slug of ['ipm-scout','grow-planner','breeder-pedigree']){
  const registry=JSON.parse(fs.readFileSync('data/tool-registry.json','utf8'));
  ok(registry.tools.some(tool=>tool.slug===slug),`registry must include ${slug}`);
}

if(failures.length){
  console.error(`Tool registry validation contract failed with ${failures.length} issue(s):`);
  for(const failure of failures) console.error(' - '+failure);
  process.exit(1);
}

console.log('Tool registry validation contract passed: local and live validation share the canonical registry.');
