import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const workflow = fs.readFileSync(new URL('../../.github/workflows/dtfseeds-public-suite-watch.yml', import.meta.url), 'utf8');
const block = workflow.split('      - name: Audit live public application suite\n')[1]
  .split('\n      - name:')[0].split('        run: |\n')[1]
  .split('\n').map(line => line.replace(/^          /, '')).join('\n');

test('watchdog checks the immutable Tools pin instead of moving main', () => {
  assert.match(workflow, /tools_sha.*sed -n 's\/\^commit=\/\/p'/);
  assert.match(workflow, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(workflow, /repository: dtfgenetics\/Tools\n          ref: \$\{\{ steps.tools_pin.outputs.sha \}\}/);
  assert.match(workflow, /path: \.qa-tools\n          persist-credentials: false/);
  assert.match(block, /node \.qa-tools\/scripts\/verify-cultivation-reference-tools-live.mjs/);
});

for (const [suite, tools] of [[0, 0], [0, 1], [1, 0], [1, 1], [0, 127], [137, 0]]) {
  test(`live audit propagates suite=${suite}, Tools=${tools}`, () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dtf-live-watch-'));
    try {
      const output = path.join(tmp, 'output');
      const calls = path.join(tmp, 'calls');
      // The fake node records that both audits ran even when the first failed.
      fs.writeFileSync(path.join(tmp, 'node'), '#!/bin/bash\nprintf "%s\\n" "$1" >> "$WATCH_CALLS"\ncase "$1" in\n scripts/audit-dtfseeds-public-suite.mjs) exit "$SUITE_STATUS";;\n .qa-tools/scripts/verify-cultivation-reference-tools-live.mjs) exit "$TOOLS_STATUS";;\n *) exit 99;;\nesac\n', { mode: 0o755 });
      const result = spawnSync('bash', ['-e', '-o', 'pipefail', '-c', block], {
        encoding: 'utf8', env: { ...process.env, PATH: tmp + path.delimiter + process.env.PATH,
          GITHUB_OUTPUT: output, WATCH_CALLS: calls, SUITE_STATUS: String(suite), TOOLS_STATUS: String(tools) }
      });
      assert.equal(result.status, 0, result.stderr);
      const statuses = Object.fromEntries(fs.readFileSync(output, 'utf8').trim().split('\n').map(line => line.split('=')));
      assert.deepEqual(statuses, { status: suite || tools ? '1' : '0', suite_status: String(suite), tools_status: String(tools) });
      assert.equal(fs.readFileSync(calls, 'utf8').trim().split('\n').length, 2);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  });
}

test('repair attempts cannot turn a failed audit into a green workflow', () => {
  assert.match(workflow, /name: Fail when live audits require reconciliation\n        if: always\(\) && \(steps.audit.outcome != 'success' \|\| steps.audit.outputs.status != '0'\)/);
  assert.match(workflow, /A repair dispatch is not live acceptance\." >&2\n          exit 1/);
  assert.doesNotMatch(workflow, /continue-on-error: true/);
});
