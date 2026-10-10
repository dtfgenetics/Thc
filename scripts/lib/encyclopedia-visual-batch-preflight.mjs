/** Validate the source queue before destructive regeneration of visual batches. */
export function validateVisualProductionQueue(queue) {
  if (!queue || !Array.isArray(queue.items) || !queue.summary || !Number.isInteger(queue.summary.visualTasksNeeded)) {
    throw new Error('Invalid visual production queue: missing items or visualTasksNeeded');
  }
  const keys = new Set();
  const lessonIds = new Set();
  let missing = 0;
  for (const lesson of queue.items) {
    if (!/^THC-ENC-\d{3,}$/.test(lesson?.lessonId || '') || !Array.isArray(lesson.visualRoles)) {
      throw new Error('Invalid visual queue lesson record');
    }
    if (lessonIds.has(lesson.lessonId)) throw new Error('Duplicate visual queue lesson ' + lesson.lessonId);
    lessonIds.add(lesson.lessonId);
    const ordinals = new Set();
    for (const role of lesson.visualRoles) {
      if (!role || typeof role.role !== 'string' || !Number.isInteger(role.ordinal) || role.ordinal < 1) {
        throw new Error('Invalid teaching visual role for ' + lesson.lessonId);
      }
      if (ordinals.has(role.ordinal)) throw new Error('Duplicate teaching visual ordinal ' + lesson.lessonId + ':' + role.ordinal);
      ordinals.add(role.ordinal);
      if (!['brief_ready_raster_artwork_needed', 'raster_artwork_produced_review_pending'].includes(role.status)) {
        throw new Error('Unknown teaching visual status ' + lesson.lessonId + ':' + role.role);
      }
      const key = lesson.lessonId + ':' + role.role;
      if (keys.has(key)) throw new Error('Duplicate teaching visual task ' + key);
      keys.add(key);
      if (role.status === 'brief_ready_raster_artwork_needed') missing++;
    }
  }
  if (missing !== queue.summary.visualTasksNeeded) {
    throw new Error('Visual queue task count mismatch: ' + missing + ' vs ' + queue.summary.visualTasksNeeded);
  }
  return missing;
}
