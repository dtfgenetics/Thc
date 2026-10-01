function norm(value) {
  return String(value || '').trim().replace(/\\/g, '/')
}

function lower(value) {
  return norm(value).toLowerCase()
}

function pathRuleMatches(path, rule) {
  const p = norm(path)
  const r = norm(rule)
  if (!p || !r) return false
  if (r.endsWith('/**')) {
    const prefix = r.slice(0, -3)
    return p === prefix || p.startsWith(`${prefix}/`)
  }
  if (r.endsWith('*')) {
    return p.startsWith(r.slice(0, -1))
  }
  if (r.endsWith('/')) {
    const prefix = r.slice(0, -1)
    return p === prefix || p.startsWith(`${prefix}/`)
  }
  return p === r
}

export function validateAgentContract(contract, {
  expectedRepository = null,
  expectedControlRepository = 'dtfgenetics/Thc',
} = {}) {
  if (!contract || contract.schemaVersion !== 1) throw new Error('agent contract schemaVersion must be 1')
  if (!contract.repository) throw new Error('agent contract repository is required')
  if (expectedRepository && contract.repository !== expectedRepository) {
    throw new Error(`agent contract repository mismatch: expected ${expectedRepository}, found ${contract.repository}`)
  }
  if (!contract.controlRepository) throw new Error('agent contract controlRepository is required')
  if (expectedControlRepository && contract.controlRepository !== expectedControlRepository) {
    throw new Error(`agent contract controlRepository mismatch: expected ${expectedControlRepository}, found ${contract.controlRepository}`)
  }
  if (!contract.defaultBranch) throw new Error('agent contract defaultBranch is required')
  if (!Array.isArray(contract.canonicalDomains) || contract.canonicalDomains.length === 0) {
    throw new Error('agent contract canonicalDomains must be non-empty')
  }
  if (!Array.isArray(contract.sourceRoots) || contract.sourceRoots.length === 0) {
    throw new Error('agent contract sourceRoots must be non-empty')
  }
  if (!contract.verificationProfiles || typeof contract.verificationProfiles !== 'object') {
    throw new Error('agent contract verificationProfiles are required')
  }
  for (const [name, profile] of Object.entries(contract.verificationProfiles)) {
    if (!Array.isArray(profile?.commands) || profile.commands.length === 0) {
      throw new Error(`verification profile ${name} requires commands`)
    }
  }
  if (!contract.production || typeof contract.production !== 'object') {
    throw new Error('agent contract production boundary is required')
  }
  return contract
}

export function verificationProfileFromContract(contract, profileName) {
  validateAgentContract(contract, { expectedControlRepository: contract.controlRepository })
  const name = String(profileName || 'default')
  const profile = contract.verificationProfiles?.[name]
  if (!profile) throw new Error(`agent contract has no verification profile: ${name}`)
  return { name, ...profile }
}

export function contractOwnsDomain(contract, canonicalDomain) {
  if (!canonicalDomain) return true
  const target = lower(canonicalDomain)
  return (contract.canonicalDomains || []).some((domain) => lower(domain) === target)
}

export function inspectContractScope(job, contract) {
  validateAgentContract(contract, { expectedRepository: job.repository })
  const violations = []

  if (job.baseBranch && job.baseBranch !== contract.defaultBranch) {
    violations.push({
      code: 'default-branch-mismatch',
      detail: `job base ${job.baseBranch}, contract default ${contract.defaultBranch}`,
    })
  }

  if (!contractOwnsDomain(contract, job.canonicalDomain)) {
    violations.push({
      code: 'canonical-domain-not-owned',
      detail: job.canonicalDomain,
    })
  }

  let profile = null
  try {
    profile = verificationProfileFromContract(contract, job.verificationProfile || 'default')
  } catch (error) {
    violations.push({ code: 'verification-profile-not-owned', detail: error.message })
  }

  const protectedKinds = new Set(['repo-maintenance', 'release'])
  for (const allowedPath of job.allowedPaths || []) {
    const underSourceRoot = (contract.sourceRoots || []).some((root) => pathRuleMatches(allowedPath, root))
    if (!underSourceRoot) {
      violations.push({ code: 'path-outside-source-roots', detail: allowedPath })
    }

    const protectedMatch = (contract.protectedPaths || []).find((rule) =>
      pathRuleMatches(allowedPath, rule) || pathRuleMatches(rule, allowedPath)
    )
    if (protectedMatch && !protectedKinds.has(job.workerKind)) {
      violations.push({
        code: 'protected-path-requires-maintenance-or-release-worker',
        detail: `${allowedPath} overlaps ${protectedMatch}`,
      })
    }
  }

  return {
    ok: violations.length === 0,
    repository: contract.repository,
    canonicalDomain: job.canonicalDomain || null,
    verificationProfile: profile,
    sourceRoots: contract.sourceRoots || [],
    protectedPaths: contract.protectedPaths || [],
    production: contract.production,
    violations,
  }
}
