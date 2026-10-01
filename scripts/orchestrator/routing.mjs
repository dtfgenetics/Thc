import { readFileSync } from 'node:fs'

export function loadVerificationProfiles(path = 'configuration/orchestrator/verification-profiles.json') {
  const config = JSON.parse(readFileSync(path, 'utf8'))
  if (config.schemaVersion !== 1) throw new Error('verification profiles schemaVersion must be 1')
  if (!config.profiles || typeof config.profiles !== 'object') throw new Error('verification profiles are required')
  return config
}

function profileForResource(resourceId, config) {
  const routing = config.routing || {}
  if (routing.exact?.[resourceId]) return routing.exact[resourceId]

  const suffix = String(resourceId || '').split('.').slice(1).join('.')
  if (routing.preferMatchingProfile !== false && suffix && config.profiles[suffix]) return suffix

  for (const [prefix, profile] of Object.entries(routing.prefix || {})) {
    if (String(resourceId || '').startsWith(prefix)) return profile
  }

  return routing.fallback || 'repo-control'
}

export function resolveVerificationProfile(resourceSet = [], explicitProfile = null, config = loadVerificationProfiles()) {
  if (explicitProfile) {
    if (!config.profiles[explicitProfile]) throw new Error(`Unknown verification profile: ${explicitProfile}`)
    return explicitProfile
  }

  const resources = [...new Set((resourceSet || []).map((value) => String(value || '').trim()).filter(Boolean))]
  if (resources.length === 0) return config.routing?.fallback || 'repo-control'

  const profiles = [...new Set(resources.map((resource) => profileForResource(resource, config)))]
  for (const profile of profiles) {
    if (!config.profiles[profile]) throw new Error(`Resource routing references unknown verification profile: ${profile}`)
  }

  if (profiles.length > 1) {
    throw new Error(`Resources require multiple verification profiles (${profiles.join(', ')}); set an explicit composite verificationProfile`)
  }
  return profiles[0]
}
