import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const site = (process.env.SITE || 'https://dtfseeds.com').replace(/\/$/, '')
const endpoint = `${site}/thc-grow-doc/api/visual-observations.php`
const evidenceDir = process.env.DTF_GROW_DOC_VISUAL_API_EVIDENCE || 'test-results/grow-doc-visual-api-live'
const markerPath = 'site/public-route-patch/assets/release-source-revisions/thc-grow-doc.txt'
const fixtureId = 'frontiers-cannabis-ammonium-toxicity-figure-2'
const profilePath = 'data/profiles/nut-tox-n.json'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function parseMarker(text) {
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const index = line.indexOf('=')
        assert(index > 0, `Invalid Grow Doc release marker line: ${line}`)
        return [line.slice(0, index), line.slice(index + 1)]
      }),
  )
}

async function fetchJson(url, label) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  assert(response.ok, `${label} returned HTTP ${response.status}`)
  return response.json()
}

async function expectStatus(responsePromise, expected, label) {
  const response = await responsePromise
  const text = await response.text()
  assert(response.status === expected, `${label}: expected HTTP ${expected}, received ${response.status}: ${text.slice(0, 500)}`)
  return { status: response.status, body: text.slice(0, 500) }
}

function hasSecretLikeField(value) {
  if (Array.isArray(value)) return value.some(hasSecretLikeField)
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, child]) => /(?:api.?key|secret|access.?token|authorization)/i.test(key) || hasSecretLikeField(child))
}

await mkdir(evidenceDir, { recursive: true })

const marker = parseMarker(await readFile(markerPath, 'utf8'))
assert(marker.repository === 'dtfgenetics/Thc-dataset', `Unexpected Grow Doc source repository: ${marker.repository}`)
assert(/^[0-9a-f]{40}$/.test(marker.commit || ''), `Invalid Grow Doc source commit: ${marker.commit}`)
assert(marker.route === '/thc-grow-doc/', `Unexpected Grow Doc route in release marker: ${marker.route}`)

const rawBase = `https://raw.githubusercontent.com/${marker.repository}/${marker.commit}`
const manifest = await fetchJson(`${rawBase}/images/reference/manifest.json`, 'Reference image manifest')
const fixture = manifest.records?.find((record) => record.id === fixtureId)
assert(fixture, `Reference fixture ${fixtureId} was not found in canonical manifest`)
assert(fixture.host_context === 'cannabis', `Reference fixture is not cannabis-context evidence: ${fixture.host_context}`)
assert(/^CC BY(?: |$)/.test(fixture.license || ''), `Reference fixture is not under the expected attribution-friendly license: ${fixture.license}`)
assert(['image/jpeg', 'image/png', 'image/webp'].includes(fixture.mime_type), `Unsupported fixture MIME type: ${fixture.mime_type}`)
assert(/^[0-9a-f]{64}$/.test(fixture.sha256 || ''), 'Reference fixture is missing a valid SHA-256')

const fixtureResponse = await fetch(`${rawBase}/${fixture.repository_path}`, { signal: AbortSignal.timeout(30_000) })
assert(fixtureResponse.ok, `Reference fixture download returned HTTP ${fixtureResponse.status}`)
const fixtureBytes = Buffer.from(await fixtureResponse.arrayBuffer())
const fixtureSha = createHash('sha256').update(fixtureBytes).digest('hex')
assert(fixtureSha === fixture.sha256, `Reference fixture checksum mismatch: expected ${fixture.sha256}, received ${fixtureSha}`)

const profile = await fetchJson(`${rawBase}/${profilePath}`, 'Controlled-indicator profile')
const allowedIndicators = Array.isArray(profile.indicators) ? profile.indicators.filter((item) => typeof item === 'string' && item.trim()) : []
assert(allowedIndicators.length >= 1, 'Controlled-indicator profile provided no indicators')
const allowedSet = new Set(allowedIndicators)

const methodCheck = await expectStatus(
  fetch(endpoint, { method: 'GET', headers: { Origin: site }, signal: AbortSignal.timeout(15_000) }),
  405,
  'GET method protection',
)

const markerCheck = await expectStatus(
  fetch(endpoint, { method: 'POST', headers: { Origin: site }, signal: AbortSignal.timeout(15_000) }),
  400,
  'Explicit request-marker protection',
)

const originCheck = await expectStatus(
  fetch(endpoint, {
    method: 'POST',
    headers: { Origin: 'https://example.invalid', 'X-THC-Visual-Request': '1' },
    signal: AbortSignal.timeout(15_000),
  }),
  403,
  'Same-origin protection',
)

const form = new FormData()
form.append('allowedIndicators', JSON.stringify(allowedIndicators))
form.append('files', new Blob([fixtureBytes], { type: fixture.mime_type }), path.basename(fixture.repository_path))

const liveResponse = await fetch(endpoint, {
  method: 'POST',
  headers: { Origin: site, 'X-THC-Visual-Request': '1' },
  body: form,
  signal: AbortSignal.timeout(70_000),
})
const liveText = await liveResponse.text()
let result
try {
  result = JSON.parse(liveText)
} catch {
  throw new Error(`Live visual API returned non-JSON HTTP ${liveResponse.status}: ${liveText.slice(0, 800)}`)
}

assert(liveResponse.status === 200, `Live visual API expected HTTP 200, received ${liveResponse.status}: ${liveText.slice(0, 800)}`)
assert((liveResponse.headers.get('cache-control') || '').toLowerCase().includes('no-store'), 'Live visual API response is missing Cache-Control: no-store')
assert((liveResponse.headers.get('content-type') || '').toLowerCase().includes('application/json'), 'Live visual API response is not JSON')
assert(result.provider === 'Google Gemini API', `Unexpected visual provider: ${result.provider}`)
assert(typeof result.model === 'string' && result.model.length >= 3, 'Live visual API did not report a configured model')
assert(typeof result.summary === 'string' && result.summary.trim().length >= 10, 'Live visual API returned no useful neutral summary')
assert(Array.isArray(result.matchedIndicators), 'matchedIndicators is not an array')
assert(Array.isArray(result.visibleFeatures), 'visibleFeatures is not an array')
assert(Array.isArray(result.uncertainFeatures), 'uncertainFeatures is not an array')
assert(Array.isArray(result.qualityNotes), 'qualityNotes is not an array')
assert(Array.isArray(result.suggestedNextViews), 'suggestedNextViews is not an array')
assert(typeof result.unknownOrOutOfScope === 'boolean', 'unknownOrOutOfScope is not a boolean')
assert(typeof result.providerDataUseNotice === 'string' && result.providerDataUseNotice.length > 20, 'Provider data-use notice is missing')
assert(result.visibleFeatures.length > 0 || result.matchedIndicators.length > 0, 'Live visual API returned no controlled visual observations')

for (const indicator of result.matchedIndicators) {
  assert(typeof indicator === 'string' && allowedSet.has(indicator), `Provider returned an indicator outside the controlled vocabulary: ${indicator}`)
}
for (const feature of result.visibleFeatures) {
  assert(feature && typeof feature.observation === 'string' && feature.observation.trim(), 'visibleFeatures contains an invalid observation')
  assert(['low', 'moderate', 'high'].includes(feature.confidence), `visibleFeatures contains invalid confidence: ${feature.confidence}`)
}
const allowedNextViews = new Set(['whole-plant', 'affected-close-up', 'leaf-underside', 'roots-or-crown', 'natural-light-retake', 'magnified-pest-view'])
for (const nextView of result.suggestedNextViews) {
  assert(allowedNextViews.has(nextView), `Provider returned an invalid suggested next view: ${nextView}`)
}

assert(!hasSecretLikeField(result), 'Live visual API response exposed a secret-like field name')
assert(!/AIza[0-9A-Za-z_-]{20,}/.test(liveText), 'Live visual API response appears to expose a Google API key')

const report = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  site,
  endpoint,
  canonicalSource: { repository: marker.repository, commit: marker.commit },
  fixture: {
    id: fixture.id,
    repositoryPath: fixture.repository_path,
    sourceArticle: fixture.source_article,
    creator: fixture.creator,
    license: fixture.license,
    sha256: fixtureSha,
    bytes: fixtureBytes.length,
  },
  protections: {
    getMethodStatus: methodCheck.status,
    missingMarkerStatus: markerCheck.status,
    crossOriginStatus: originCheck.status,
  },
  live: {
    status: liveResponse.status,
    provider: result.provider,
    model: result.model,
    cacheControl: liveResponse.headers.get('cache-control'),
    matchedIndicatorCount: result.matchedIndicators.length,
    visibleFeatureCount: result.visibleFeatures.length,
    uncertainFeatureCount: result.uncertainFeatures.length,
    qualityNoteCount: result.qualityNotes.length,
    suggestedNextViews: result.suggestedNextViews,
    unknownOrOutOfScope: result.unknownOrOutOfScope,
    secretLikeFieldExposed: false,
    googleApiKeyPatternExposed: false,
  },
  ok: true,
}

await writeFile(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`)
console.log(JSON.stringify(report))
