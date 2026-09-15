import { spawnSync } from 'node:child_process';
import process from 'node:process';

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error('Usage: node scripts/run-wordpress-with-retry.mjs <script> [...args]');
  process.exit(2);
}

const maxAttempts = Number.parseInt(process.env.WP_COMMAND_MAX_ATTEMPTS || '5', 10);
const transient = /(ETIMEDOUT|ENETUNREACH|ECONNRESET|ECONNREFUSED|EAI_AGAIN|fetch failed|UND_ERR_CONNECT_TIMEOUT|socket hang up|network timeout)/i;

for (let attempt = 1; attempt <= maxAttempts; attempt++) {
  const result = spawnSync(process.execPath, [script, ...args], {
    env: process.env,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status === 0) process.exit(0);

  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  const isTransient = transient.test(combined);
  if (!isTransient || attempt === maxAttempts) {
    console.error(`WordPress command failed on attempt ${attempt}/${maxAttempts}${isTransient ? ' after exhausting transient retries' : ' with a non-transient error'}.`);
    process.exit(result.status ?? 1);
  }

  const delayMs = Math.min(15000, attempt * 2500);
  console.error(`Transient WordPress/network failure detected. Retrying ${script} in ${delayMs}ms (attempt ${attempt + 1}/${maxAttempts}).`);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}
