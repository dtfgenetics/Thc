#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const output = execFileSync(process.execPath, ['scripts/validate-external-agent-contract-registry.mjs'], {encoding:'utf8'});
assert.match(output, /External agent contract registry valid:/);

const registry = JSON.parse(await import('node:fs').then(({readFileSync}) => readFileSync('data/external-agent-contract-registry.json','utf8')));
const byRepo = new Map(registry.repositories.map(entry => [entry.repo, entry]));
assert.equal(byRepo.get('dtfgenetics/Tools')?.mode, 'external-executor');
assert.equal(byRepo.get('dtfgenetics/Dtf420')?.mode, 'migration-only');
assert.equal(byRepo.get('dtfgenetics/dtf-thc-hub')?.mode, 'migration-only');
assert.equal(byRepo.get('dtfgenetics/Thc-guess-who')?.mode, 'external-executor');

console.log('External agent contract registry regression tests passed.');
