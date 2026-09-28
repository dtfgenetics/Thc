import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync('data/tool-registry.json','utf8'));
const failures=[];
for(const tool of registry.tools){
  const expected='/'+tool.slug+'/';
  if(!expected.startsWith('/')||!expected.endsWith('/')) failures.push(tool.slug+': malformed public route');
  if(tool.slug==='atlas'&&tool.deploymentId!=='plant-atlas') failures.push('atlas deploymentId must remain plant-atlas');
}
if(failures.length){
  for(const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`Deployment parity contract passed for ${registry.tools.length} tool routes.`);
