#!/usr/bin/env node

import {
  createDisposableCredentials,
  validatePasswordSeed,
} from './growlens-live-acceptance-lib.mjs';

const confirmation = process.env.GROWLENS_RECOVERY_CONFIRM ?? '';
const runId = String(process.argv[2] ?? '').trim();
const domain = process.env.GROWLENS_TEST_EMAIL_DOMAIN || 'example.com';

if (confirmation !== 'PRINT-RECOVERY-CREDENTIALS') {
  throw new Error('Set GROWLENS_RECOVERY_CONFIRM=PRINT-RECOVERY-CREDENTIALS before printing disposable acceptance credentials.');
}
if (!/^\d{14}-[a-z0-9]{1,24}$/.test(runId)) {
  throw new Error('Provide the acceptance run ID as the first argument, for example 20260713203000-abc123.');
}

const seed = validatePasswordSeed(process.env.GROWLENS_ACCEPTANCE_PASSWORD_SEED);
const accountA = createDisposableCredentials(runId, 'a', domain, seed);
const accountB = createDisposableCredentials(runId, 'b', domain, seed);

process.stdout.write('Disposable GrowLens acceptance credentials\n');
process.stdout.write(`Run ID: ${runId}\n`);
process.stdout.write(`Account A email: ${accountA.email}\n`);
process.stdout.write(`Account A password: ${accountA.password}\n`);
process.stdout.write(`Account B email: ${accountB.email}\n`);
process.stdout.write(`Account B password: ${accountB.password}\n`);
process.stdout.write('Use only for manual cleanup of an orphaned acceptance run, then delete the accounts.\n');
