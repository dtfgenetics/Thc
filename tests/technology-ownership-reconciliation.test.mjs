import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
test('technology ownership report uses authoritative registry without mutations',()=>{
 const output=execFileSync(process.execPath,['scripts/report-technology-ownership.mjs'],{cwd:root,encoding:'utf8'});
 const result=JSON.parse(output);
 assert.equal(result.schema_version,1);
 assert.ok(Number.isInteger(result.candidate_count));
 assert.ok(result.public_tool_count>=23);
 assert.equal(result.candidate_count,result.mapped.length+result.unmatched.length);
 for(const item of [...result.mapped,...result.unmatched]){
   assert.ok(item.id);
   assert.ok(Array.isArray(item.matching_tools));
 }
 assert.deepEqual(result.errors,[]);
});
