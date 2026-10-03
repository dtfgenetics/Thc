import { readFileSync } from 'node:fs'

function normalize(value) {
  return String(value || '').trim().toLowerCase()
}

export function loadRepositoryRegistry(path = 'data/repository-registry.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'))
  if (config.schema_version !== 1) throw new Error('repository registry schema_version must be 1')
  if (!Array.isArray(config.repositories)) throw new Error('repository registry requires repositories')
  return config
}

export function repositoryEntry(repo, config = loadRepositoryRegistry()) {
  return (config.repositories || []).find((entry) => entry.repo === repo) || null
}

export function loadProjectRegistry(path = 'data/project-registry.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'))
  if (!String(config.schema_version || '').startsWith('1.')) throw new Error('project registry schema_version must be 1.x')
  if (!Array.isArray(config.projects)) throw new Error('project registry requires projects')
  return config
}

export function resolveProjectRepository(projectId, {
  projectConfig = loadProjectRegistry(),
  repositoryConfig = loadRepositoryRegistry(),
} = {}) {
  const id = normalize(projectId)
  if (!id || id === 'general') return null
  const project = (projectConfig.projects || []).find((entry) => normalize(entry.id) === id)
  if (!project?.repo) return null
  const entry = repositoryEntry(project.repo, repositoryConfig)
  if (!entry || !['canonical', 'standalone_canonical'].includes(entry.status)) return null
  return {
    projectId: project.id,
    repository: project.repo,
    project,
    entry,
  }
}

export function resolveCanonicalRepository({
  canonicalDomain = null,
  explicitRepository = null,
  controlRepository = 'dtfgenetics/Thc',
  config = loadRepositoryRegistry(),
} = {}) {
  const domain = normalize(canonicalDomain)

  if (explicitRepository) {
    const entry = repositoryEntry(explicitRepository, config)
    if (!entry) throw new Error(`Unknown target repository: ${explicitRepository}`)
    if (!['canonical', 'standalone_canonical'].includes(entry.status)) {
      throw new Error(`Target repository ${explicitRepository} is not canonical; status=${entry.status}`)
    }
    if (domain) {
      const ownsDomain = (entry.canonical_for || []).some((item) => normalize(item) === domain)
      if (!ownsDomain) {
        throw new Error(`Repository ${explicitRepository} is not canonical for domain: ${canonicalDomain}`)
      }
    }
    return {
      repository: explicitRepository,
      canonicalDomain: canonicalDomain || null,
      external: explicitRepository !== controlRepository,
      entry,
    }
  }

  if (!domain) {
    const entry = repositoryEntry(controlRepository, config)
    if (!entry) throw new Error(`Control repository missing from registry: ${controlRepository}`)
    return {
      repository: controlRepository,
      canonicalDomain: null,
      external: false,
      entry,
    }
  }

  const matches = (config.repositories || []).filter((entry) =>
    ['canonical', 'standalone_canonical'].includes(entry.status) &&
    (entry.canonical_for || []).some((item) => normalize(item) === domain)
  )

  if (matches.length === 0) throw new Error(`No canonical repository owns domain: ${canonicalDomain}`)
  if (matches.length > 1) {
    throw new Error(`Multiple canonical repositories claim domain ${canonicalDomain}: ${matches.map((entry) => entry.repo).join(', ')}`)
  }

  const entry = matches[0]
  return {
    repository: entry.repo,
    canonicalDomain,
    external: entry.repo !== controlRepository,
    entry,
  }
}
