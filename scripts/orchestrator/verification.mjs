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


function normalizeAllowedPath(rule) {
  return String(rule || '').trim().replace(/\\/g, '/')
}

export function isPathAllowed(path, allowedPaths = []) {
  const normalizedPath = String(path || '').trim().replace(/\\/g, '/')
  if (!normalizedPath) return false
  const rules = allowedPaths.map(normalizeAllowedPath).filter(Boolean)
  if (rules.length === 0) return true

  return rules.some((rule) => {
    if (rule.endsWith('/**')) {
      const prefix = rule.slice(0, -3)
      return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    }
    if (rule.endsWith('/')) {
      const prefix = rule.slice(0, -1)
      return normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)
    }
    return normalizedPath === rule
  })
}

export function inspectAllowedPaths(changedPaths = [], allowedPaths = []) {
  const changed = [...new Set((changedPaths || []).map((path) => String(path || '').trim()).filter(Boolean))].sort()
  const allowed = [...new Set((allowedPaths || []).map(normalizeAllowedPath).filter(Boolean))].sort()
  if (allowed.length === 0) {
    return { ok: true, reason: 'legacy-unscoped-job', changed, allowed, violations: [] }
  }
  const violations = changed.filter((path) => !isPathAllowed(path, allowed))
  return {
    ok: violations.length === 0,
    reason: violations.length ? 'changed-files-outside-allowed-paths' : 'changed-files-within-allowed-paths',
    changed,
    allowed,
    violations,
  }
}
