export function validateEpicManifest(manifest) {
  if (!manifest || manifest.schemaVersion !== 1) throw new Error('epic manifest schemaVersion must be 1')
  if (!manifest.epic?.title) throw new Error('epic.title is required')
  if (!manifest.epic?.goal) throw new Error('epic.goal is required')
  if (!manifest.epic?.project) throw new Error('epic.project is required')
  if (!Array.isArray(manifest.jobs) || manifest.jobs.length === 0) throw new Error('epic manifest requires at least one job')

  const keys = new Set()
  for (const job of manifest.jobs) {
    if (!job?.key) throw new Error('every job requires key')
    if (keys.has(job.key)) throw new Error(`duplicate job key: ${job.key}`)
    keys.add(job.key)
    if (!job.title) throw new Error(`job ${job.key} requires title`)
    if (!job.goal) throw new Error(`job ${job.key} requires goal`)
    if (!job.workerKind) throw new Error(`job ${job.key} requires workerKind`)
    if (!Array.isArray(job.resourceSet) || job.resourceSet.length === 0) throw new Error(`job ${job.key} requires resourceSet`)
    if (!Array.isArray(job.acceptanceCriteria) || job.acceptanceCriteria.length === 0) throw new Error(`job ${job.key} requires acceptanceCriteria`)
    if (job.dependencies && !Array.isArray(job.dependencies)) throw new Error(`job ${job.key} dependencies must be an array`)
  }

  for (const job of manifest.jobs) {
    for (const dep of job.dependencies || []) {
      if (!keys.has(dep)) throw new Error(`job ${job.key} references unknown dependency ${dep}`)
      if (dep === job.key) throw new Error(`job ${job.key} cannot depend on itself`)
    }
  }

  topologicalJobOrder(manifest)
  return manifest
}

export function topologicalJobOrder(manifest) {
  const jobs = new Map((manifest.jobs || []).map((job) => [job.key, job]))
  const temporary = new Set()
  const permanent = new Set()
  const ordered = []

  function visit(key, stack = []) {
    if (permanent.has(key)) return
    if (temporary.has(key)) throw new Error(`dependency cycle detected: ${[...stack, key].join(' -> ')}`)
    temporary.add(key)
    const job = jobs.get(key)
    if (!job) throw new Error(`unknown job key: ${key}`)
    for (const dep of job.dependencies || []) visit(dep, [...stack, key])
    temporary.delete(key)
    permanent.add(key)
    ordered.push(job)
  }

  for (const key of jobs.keys()) visit(key)
  return ordered
}

export function materializeJobPlan(job, issueNumbersByKey = new Map()) {
  return {
    planVersion: 1,
    canonicalDomain: job.canonicalDomain || null,
    targetRepository: job.targetRepository || null,
    resourceSet: [...new Set(job.resourceSet || [])],
    allowedPaths: [...new Set(job.allowedPaths || [])],
    verificationProfile: job.verificationProfile || null,
    dependencies: (job.dependencies || []).map((key) => {
      const number = issueNumbersByKey.get(key)
      if (!number) throw new Error(`dependency ${key} has no created issue number`)
      return `issue-${number}`
    }),
    acceptanceCriteria: [...new Set(job.acceptanceCriteria || [])],
    productionTargets: [...new Set(job.productionTargets || [])],
    productionImpact: Boolean(job.productionImpact || (job.productionTargets || []).length),
  }
}

export function epicSummary(manifest) {
  validateEpicManifest(manifest)
  const ordered = topologicalJobOrder(manifest)
  return {
    title: manifest.epic.title,
    goal: manifest.epic.goal,
    project: manifest.epic.project,
    system: manifest.epic.system || null,
    jobs: ordered.map((job) => ({
      key: job.key,
      title: job.title,
      workerKind: job.workerKind,
      project: job.project || manifest.epic.project,
      dependencies: job.dependencies || [],
      resources: job.resourceSet || [],
    })),
  }
}
