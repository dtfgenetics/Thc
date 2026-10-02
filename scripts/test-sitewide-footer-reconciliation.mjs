import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = await mkdtemp(join(tmpdir(), 'dtf-footer-'));
const run = (...args) => execFileSync(process.execPath, ['scripts/apply-sitewide-header.mjs', root, ...args], { encoding: 'utf8' });
try {
  const projects = await readFile('site/public-route-patch/projects/index.html', 'utf8');
  await writeFile(join(root, 'projects.html'), projects);
  for (const quote of ["'", '"']) {
    await writeFile(join(root, `quote-${quote === "'" ? 'single' : 'double'}.html`),
      `<html><head></head><body><main>Content</main><footer id="article">Article attribution</footer><footer id="legacy">DTF Genetics Dream the Future <a href=${quote}/seeds/${quote}>Seeds</a><a href = ${quote}/learn/${quote}>Learn</a></footer></body></html>`);
  }
  run();
  for (const name of ['projects.html', 'quote-single.html', 'quote-double.html']) {
    const output = await readFile(join(root, name), 'utf8');
    assert.equal((output.match(/data-dtf-sitewide-footer="canonical-eight-v1"/g) || []).length, 1, name);
    assert.equal((output.match(/<footer\b/gi) || []).length, name === 'projects.html' ? 1 : 2, name);
    assert.doesNotMatch(output, /id="legacy"/, name);
    if (name !== 'projects.html') assert.match(output, /<footer id="article">Article attribution<\/footer>/);
  }
  run('--check');
  const once = await readFile(join(root, 'projects.html'), 'utf8');
  run();
  const twice = await readFile(join(root, 'projects.html'), 'utf8');
  assert.equal((twice.match(/<footer\b/gi) || []).length, 1, 'Repeated reconciliation keeps one footer');
  assert.equal(twice.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0], once.match(/<footer\b[^>]*>[\s\S]*?<\/footer>/i)?.[0], 'Repeated reconciliation preserves the shared footer');
  console.log('Footer reconciliation passed: Projects, both quote styles, article preservation, repeated reconciliation.');
} finally {
  await rm(root, { recursive: true, force: true });
}
