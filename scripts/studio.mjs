#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = dirname(fileURLToPath(import.meta.url))
const [command, ...args] = process.argv.slice(2)

const commands = {
  new: join(root, 'studio/start.mjs'),
  resume: join(root, 'studio/resume.mjs'),
  status: join(root, 'studio/status.mjs'),
  overlap: join(root, 'studio/overlap.mjs'),
  doctor: join(root, 'studio/doctor.mjs'),
  push: join(root, 'studio/push.mjs'),
  integrate: join(root, 'studio/integrate.mjs'),
  test: join(root, 'test-dtf-parallel-studio.mjs'),
}

if (!command || !commands[command]) {
  console.error('Usage: node scripts/studio.mjs <new|resume|status|overlap|doctor|push|integrate|test> [...args]')
  process.exit(2)
}

const result = spawnSync(process.execPath, [commands[command], ...args], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env,
})

if (result.error) throw result.error
process.exit(result.status ?? 1)
