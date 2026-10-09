/** Validate the source queue before destructive regeneration of visual batches. */
export function validateVisualProductionQueue(queue) {
  if (!queue || !Array.isArray(queue.items) || !queue.summary || !Number.isInteger(queue.summary.visualTasksNeeded)) {
    throw new Error('Invalid visual production queue: missing items or visualTasksNeeded');
  }
  const keys = new Set();
  let missing = 0;
  for (const lesson of queue.items) {
    if (!/^THC-ENC-\d{3,}$/.test(lesson?.lessonId || '') || !Array.isArray(lesson.visualRoles)) {
      throw new Error('Invalid visual queue lesson record');
    }
    for (const role of lesson.visualRoles) {
      if (!role || typeof role.role !== 'string' || !Number.isInteger(role.ordinal) || role.ordinal < 1) {
        throw new Error('Invalid teaching visual role for ' + lesson.lessonId);
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
