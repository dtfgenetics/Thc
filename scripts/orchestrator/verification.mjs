const PASSING = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED'])
const TERMINAL_FAILURES = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STALE'])

export function normalizeCheck(entry = {}) {
  const name = entry.name || entry.context || entry.workflowName || 'unnamed-check'
  const status = String(entry.status || entry.state || '').toUpperCase()
  const conclusion = String(entry.conclusion || entry.state || '').toUpperCase()
  const completed = status === 'COMPLETED' || PASSING.has(conclusion) || TERMINAL_FAILURES.has(conclusion)
  return { name, status, conclusion, completed }
}

export function inspectCheckRollup(entries = []) {
  const checks = entries.map(normalizeCheck)
  if (checks.length === 0) return { ok: false, reason: 'no-checks-reported', checks }
  const pending = checks.filter((check) => !check.completed || (!check.conclusion && !PASSING.has(check.status)))
  if (pending.length) return { ok: false, reason: 'checks-pending', checks, pending }
  const failing = checks.filter((check) => !PASSING.has(check.conclusion || check.status))
  if (failing.length) return { ok: false, reason: 'checks-failing', checks, failing }
  return { ok: true, reason: 'all-reported-checks-passing', checks }
}

export function exactHeadMatches(expectedHeadSha, currentHeadSha, requiresExactHead = true) {
  if (!currentHeadSha) return false
  if (!requiresExactHead) return true
  if (!expectedHeadSha) return true
  return expectedHeadSha === currentHeadSha
}
