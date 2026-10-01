import { readFileSync } from 'node:fs'

export function loadResourceRegistry(path = 'data/studio-resources.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'))
  if (config.schemaVersion !== 1) throw new Error('studio resource registry schemaVersion must be 1')
  return config
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort()
}

function dynamicResourceId(dynamic, resourceId) {
  const template = String(dynamic.idTemplate || '')
  const marker = '{id}'
  const at = template.indexOf(marker)
  if (at === -1) return null
  const prefix = template.slice(0, at)
  const suffix = template.slice(at + marker.length)
  if (!resourceId.startsWith(prefix) || !resourceId.endsWith(suffix)) return null
  const end = suffix ? resourceId.length - suffix.length : resourceId.length
  const id = resourceId.slice(prefix.length, end)
  if (!id || (dynamic.excludeIds || []).includes(id)) return null
  return id
}

function dynamicPatternToAllowedPath(pattern, id) {
  let value = String(pattern || '')
  if (!value.startsWith('^')) return null
  value = value.slice(1)
  value = value.replace('([^/]+)', id)
  value = value.replaceAll('\\/', '/')
  if (/[()[\]|+?]/.test(value)) return null
  value = value.replace(/\$$/, '')
  if (value.endsWith('/')) return `${value}**`
  return value
}

export function resolveResource(resourceId, config) {
  const staticResource = (config.staticResources || []).find((resource) => resource.id === resourceId)
  if (staticResource) {
    return {
      id: resourceId,
      kind: staticResource.kind || null,
      allowedPaths: unique([
        ...(staticResource.exactPaths || []),
        ...(staticResource.prefixes || []).map((prefix) => prefix.endsWith('/') ? `${prefix}**` : `${prefix}/**`),
      ]),
      productionTargets: unique(staticResource.productionTargets || []),
    }
  }

  for (const dynamic of config.dynamicResources || []) {
    const id = dynamicResourceId(dynamic, resourceId)
    if (!id) continue
    const allowedPaths = unique((dynamic.patterns || []).map((pattern) => dynamicPatternToAllowedPath(pattern, id)))
    return {
      id: resourceId,
      kind: dynamic.kind || null,
      allowedPaths,
      productionTargets: dynamic.productionTargetTemplate
        ? [String(dynamic.productionTargetTemplate).replaceAll('{id}', id)]
        : [],
    }
  }

  return null
}

export function resolveResourceSet(resourceIds = [], config = loadResourceRegistry()) {
  const resources = []
  const unknown = []
  for (const rawId of resourceIds || []) {
    const id = String(rawId || '').trim()
    if (!id) continue
    const resource = resolveResource(id, config)
    if (resource) resources.push(resource)
    else unknown.push(id)
  }
  return {
    resources,
    unknown: unique(unknown),
    allowedPaths: unique(resources.flatMap((resource) => resource.allowedPaths || [])),
    productionTargets: unique(resources.flatMap((resource) => resource.productionTargets || [])),
  }
}
