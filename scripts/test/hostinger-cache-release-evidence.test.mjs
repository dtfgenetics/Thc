import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const workflow=readFileSync('.github/workflows/hostinger-mcp-cache-flush.yml','utf8');
test('Hostinger cache failure cannot suppress independent site verification',()=>{
  assert.match(workflow,/name: Purge LiteSpeed through authenticated Hostinger MCP/);
  assert.match(workflow,/name: Test public sales-hold verifier\n\s+if: always\(\)/);
  assert.match(workflow,/name: Verify plain and cache-busted public sales-hold pages\n\s+if: always\(\)/);
  assert.match(workflow,/node scripts\/verify-public-sales-hold-after-cache\.mjs/);
  assert.doesNotMatch(workflow,/continue-on-error:\s*true/);
});
test('release summary does not fail attempting to comment on saturated issue 46',()=>{
  assert.match(workflow,/name: Report cache repair result\n\s+if: always\(\)/);
  assert.match(workflow,/GITHUB_STEP_SUMMARY/);
  assert.match(workflow,/PURGE_OUTCOME/);
  assert.match(workflow,/VERIFY_OUTCOME/);
  assert.doesNotMatch(workflow,/issues\.createComment|issue_number:\s*46/);
  assert.doesNotMatch(workflow,/issues:\s*write/);
});
