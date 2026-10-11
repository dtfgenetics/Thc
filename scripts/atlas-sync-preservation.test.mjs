import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workflow = fs.readFileSync(new URL('../.github/workflows/sync-canonical-tools.yml', import.meta.url), 'utf8');
const start = workflow.indexOf("const meaningful = value => ");
assert.ok(start !== -1, 'Atlas preservation text measurement must exist');
const end = workflow.indexOf('const oldSize = meaningful(existing);', start);
assert.ok(end > start, 'Atlas measurement expression must terminate');
const expression = workflow.slice(start, end);
const meaningful = new Function(expression + '\nreturn meaningful;')();

test('Atlas content measurement excludes inert HTML', () => {
  const visible = '<main><h1>Lesson</h1><p>Photosynthesis matters.</p></main>';
  const inert = '<!-- ' + 'a'.repeat(1000) + ' --><template>' + 'b'.repeat(1000) + '</template><script>' + 'c'.repeat(1000) + '</script><style>' + 'd'.repeat(1000) + '</style>';
  assert.equal(meaningful(visible + inert), meaningful(visible));
});
test('Atlas content measurement detects substantial visible-text loss', () => {
  const original = '<main>' + 'visible science content '.repeat(100) + '</main>';
  const shortened = '<main>Short summary.</main><!-- ' + 'filler '.repeat(1000) + ' -->';
  assert.ok(meaningful(original) >= 600);
  assert.ok(meaningful(shortened) < meaningful(original) * 0.7);
});
test('Atlas sync workflow rejects missing lessons and unsafe entries', () => {
  assert.match(workflow, /Canonical Atlas would remove an existing lesson/);
  assert.match(workflow, /Unsafe Atlas filesystem entry/);
  assert.match(workflow, /No existing Atlas mirror lessons found/);
  assert.match(workflow, /THC main advanced after Atlas preservation validation/);
});
