const requireValue = (value, message) => {
  if (!value) throw new Error(message);
};

export function collectPublicLessonIds(release, modulesById) {
  const courseId = release?.courseId || 'unknown course';
  const scope = release?.publicScope || {};
  requireValue(Array.isArray(scope.modules) && scope.modules.length > 0, `${courseId}: public release must authorize at least one module.`);

  if (Number.isInteger(scope.releasedModuleCount)) {
    requireValue(scope.modules.length === scope.releasedModuleCount, `${courseId}: released module count does not match the public module list.`);
  }

  const studentSources = new Set(scope.studentSources || []);
  const lessonIds = [];
  const seen = new Set();
  for (const moduleId of scope.modules) {
    const module = modulesById.get(moduleId);
    requireValue(module?.id === moduleId, `${courseId}: source module ${moduleId} is missing or has the wrong identity.`);
    for (const lessonId of module.lessons || []) {
      requireValue(!seen.has(lessonId), `${courseId}: duplicate public lesson ${lessonId} across authorized modules.`);
      requireValue(studentSources.has(`content/lessons/${lessonId}.json`), `${courseId}: ${lessonId} is not authorized by the public release.`);
      seen.add(lessonId);
      lessonIds.push(lessonId);
    }
  }

  if (Number.isInteger(scope.releasedLessonCount)) {
    requireValue(lessonIds.length === scope.releasedLessonCount, `${courseId}: released lesson count ${lessonIds.length} does not match manifest ${scope.releasedLessonCount}.`);
  }
  requireValue(lessonIds.length > 0, `${courseId}: public release must authorize at least one lesson.`);
  return lessonIds;
}
