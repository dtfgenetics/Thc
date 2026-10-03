import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
let manifest = { master: head };
let manifestStatus = 200;
let routeStatus = 200;
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/dtf-build.json')) {
    res.writeHead(manifestStatus, { 'Content-Type': 'application/json' });
    res.end(typeof manifest === 'string' ? manifest : JSON.stringify(manifest));
  } else {
    res.writeHead(routeStatus, { 'Content-Type': 'text/html' });
    res.end('<html><head><title>Fixture</title><link rel="canonical" href="https://dtfseeds.com/"></head><body><h1>Fixture</h1></body></html>');
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function run(flags = ['--strict-live']) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scripts/report-platform-convergence.mjs', '--json', `--base-url=${base}`, ...flags]);
    let output = '', stderr = '';
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => stderr += data);
    child.on('error', reject);
    child.on('close', code => {
      try { resolve({ code, report: JSON.parse(output) }); }
      catch (error) { reject(new Error(`${error.message}: ${stderr}`)); }
    });
  });
}
try {
  let result = await run();
  assert.equal(result.code, 0);
  assert.equal(result.report.ok, true);
  assert.equal(result.report.live.sourceMatchesDeployment, true);
  for (const value of ['broken JSON', [], {}, { master: 'short' }, { master: 'f'.repeat(40) }]) {
    manifest = value;
    result = await run();
    assert.equal(result.code, 1, `strict mode must reject ${JSON.stringify(value)}`);
    assert.equal(result.report.ok, false);
    assert.ok(result.report.errors.length);
  }
  manifestStatus = 404;
  result = await run();
  assert.equal(result.code, 1);
  assert.match(result.report.errors.join(' '), /manifest unavailable/);
  result = await run(['--live']);
  assert.equal(result.code, 0, 'non-strict audit remains informational');
  assert.ok(result.report.warnings.length);
  manifestStatus = 200;
  manifest = { master: head };
  routeStatus = 503;
  result = await run();
  assert.equal(result.code, 1, 'a valid revision cannot excuse failed routes');
  assert.equal(result.report.ok, false);
  console.log('Platform convergence live regression checks passed.');
} finally {
  await new Promise(resolve => server.close(resolve));
}
