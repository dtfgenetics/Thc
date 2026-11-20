import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('scripts/publish-wordpress-beginner-course-v5.mjs', 'utf8');

test('general beginner lessons contain evidence explanations, not assessments', () => {
  assert.match(source, /Why measurements and observations need context/);
  assert.match(source, /Four observations before interpreting a deficiency/);
  assert.doesNotMatch(source, /Self-check|Fast self-check|Can you explain the reasoning\?|Make sure you can answer these questions|<summary>/i);
  for (const topic of ['Symptom overlap:', 'Sample identity:', 'Canopy variability:', 'Evidence of response:',
    'Pattern and progression:', 'Recent changes:', 'Root-zone conditions:', 'Follow-up evidence:']) {
    assert.ok(source.includes(topic), 'missing educational explanation: ' + topic);
  }
});

test('WordPress publication acceptance expects updated scientific explanatory content', () => {
  assert.match(source, /'Why measurements and observations need context\.'/);
  assert.match(source, /expected one H1/);
  assert.match(source, /data-dtf-beginner-v5=/);
});

test('protected WordPress publisher checks live pages for reference copy without prompts',()=>{
 const workflow=readFileSync('.github/workflows/wordpress-beginner-course-v5.yml','utf8');
 assert.match(workflow,/forbidden=\('Self-check','Fast self-check','Can you explain the reasoning\?'\)/);
 assert.match(workflow,/updated reference notes not live/);
 assert.match(workflow,/GITHUB_STEP_SUMMARY/);
 assert.doesNotMatch(workflow,/issue_number:46|issues:\s*write/);
});
