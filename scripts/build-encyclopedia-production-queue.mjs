import fs from 'node:fs';
import path from 'node:path';
import { buildProductionQueue } from './lib/encyclopedia-production-queue.mjs';
const root=process.cwd();
const input=path.join(root,'data/encyclopedia-learning-quality-audit.json');
const output=path.join(root,'data/encyclopedia-production-work-queue.json');
if(!fs.existsSync(input)) {
  console.error('Missing audit report. First run: node scripts/audit-encyclopedia-learning-quality.mjs');
  process.exit(1);
}
const queue=buildProductionQueue(JSON.parse(fs.readFileSync(input,'utf8')));
if(process.argv.includes('--check')) {
  if(!fs.existsSync(output) || fs.readFileSync(output,'utf8')!==JSON.stringify(queue,null,2)+'\n') {
    console.error('Production work queue is missing or out of date. Run: node scripts/build-encyclopedia-production-queue.mjs');
    process.exit(1);
  }
} else {
  fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(queue,null,2)+'\n');
}
console.log(JSON.stringify({summary:queue.summary,topFive:queue.items.slice(0,5)},null,2));
