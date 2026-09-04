import { randomBytes } from 'node:crypto'

export function slug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

export function createSessionId(now = Date.now(), entropy = randomBytes(3).toString('hex')) {
  return `${now.toString(36)}-${String(entropy).replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8)}`
}

export function makeWorkBranch(projectRaw, taskRaw, sessionId = createSessionId()) {
  const project = slug(projectRaw)
  const task = slug(taskRaw)
  const session = slug(sessionId)
  if (!project || !task || !session) throw new Error('Project, task, and session must normalize to non-empty slugs.')
  return `work/${project}/${task}/${session}`
}

export function parseWorkBranch(branch) {
  const match = /^work\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(String(branch || ''))
  if (!match) return null
  return { mode: 'work', projectId: match[1], task: match[2], sessionId: match[3] }
}

function staticMatch(resource, path) {
  if ((resource.exactPaths || []).includes(path)) return true
  return (resource.prefixes || []).some((prefix) => path === prefix || path.startsWith(prefix))
}

function fillTemplate(template, id) {
  return String(template || '').replaceAll('{id}', id)
}

export function classifyPaths(config, paths) {
  const resourceMap = new Map()
  const fileResources = {}
  const unmatched = []

  for (const path of paths) {
    const matched = []

    for (const resource of config.staticResources || []) {
      if (!staticMatch(resource, path)) continue
      matched.push(resource.id)
      if (!resourceMap.has(resource.id)) {
        resourceMap.set(resource.id, {
          id: resource.id,
          kind: resource.kind,
          productionTargets: [...(resource.productionTargets || [])],
          files: [],
        })
      }
      resourceMap.get(resource.id).files.push(path)
    }

    for (const dynamic of config.dynamicResources || []) {
      for (const pattern of dynamic.patterns || []) {
        const match = new RegExp(pattern).exec(path)
        if (!match) continue
        const id = slug(match[1])
        if (!id || (dynamic.excludeIds || []).includes(id)) continue
        const resourceId = fillTemplate(dynamic.idTemplate, id)
        matched.push(resourceId)
        if (!resourceMap.has(resourceId)) {
          resourceMap.set(resourceId, {
            id: resourceId,
            kind: dynamic.kind,
            productionTargets: dynamic.productionTargetTemplate ? [fillTemplate(dynamic.productionTargetTemplate, id)] : [],
            files: [],
          })
        }
        resourceMap.get(resourceId).files.push(path)
      }
    }

    fileResources[path] = [...new Set(matched)]
    if (!matched.length) unmatched.push(path)
  }

  const resources = [...resourceMap.values()].map((resource) => ({
    ...resource,
    files: [...new Set(resource.files)].sort(),
    productionTargets: [...new Set(resource.productionTargets)].sort(),
  })).sort((a, b) => a.id.localeCompare(b.id))

  return { resources, fileResources, unmatched }
}

export function assessOverlap(current, other) {
  const currentFiles = new Set(current.files || [])
  const currentResources = new Set((current.resources || []).map((item) => typeof item === 'string' ? item : item.id))
  const currentTargets = new Set((current.resources || []).flatMap((item) => typeof item === 'string' ? [] : item.productionTargets || []))

  const fileOverlap = [...new Set(other.files || [])].filter((path) => currentFiles.has(path)).sort()
  const resourceOverlap = [...new Set((other.resources || []).map((item) => typeof item === 'string' ? item : item.id))]
    .filter((id) => currentResources.has(id)).sort()
  const otherTargets = new Set((other.resources || []).flatMap((item) => typeof item === 'string' ? [] : item.productionTargets || []))
  const productionOverlap = [...otherTargets].filter((target) => currentTargets.has(target)).sort()

  let developmentRisk = 'green'
  if (fileOverlap.length || resourceOverlap.length) developmentRisk = 'yellow'
  if (other.mergeable === 'CONFLICTING' && (fileOverlap.length || resourceOverlap.length)) developmentRisk = 'red'

  return {
    developmentRisk,
    fileOverlap,
    resourceOverlap,
    productionOverlap,
    serializeProduction: productionOverlap.length > 0,
  }
}

export function candidateSupersession(current, other) {
  const overlap = assessOverlap(current, other)
  if (!overlap.fileOverlap.length || !overlap.resourceOverlap.length) return false
  const currentFiles = new Set(current.files || [])
  const otherFiles = new Set(other.files || [])
  const smaller = currentFiles.size <= otherFiles.size ? currentFiles : otherFiles
  const larger = currentFiles.size <= otherFiles.size ? otherFiles : currentFiles
  return [...smaller].every((path) => larger.has(path))
}
