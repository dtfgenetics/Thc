/** Parse the permanent lesson ID from a canonical raster filename without truncating 1000+ IDs. */
export function lessonIdFromVisualFilename(name) {
  if (typeof name !== 'string' || !/\.(?:png|jpe?g|webp)$/i.test(name)) return null;
  const match = name.match(/^(THC-ENC-\d{3,})(?=_|\.)/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Match one exact numbered teaching role, allowing supported raster formats.
 * Prevents role 01 being satisfied by role 010, or an unrelated lesson's image.
 */
export function visualFilenameMatchesRole(filename, lessonId, role, ordinal) {
  if (lessonIdFromVisualFilename(filename) !== lessonId || !Number.isInteger(ordinal) || ordinal < 1) return false;
  if (typeof role !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(role)) return false;
  const exactStem = lessonId + '_' + String(ordinal).padStart(2, '0') + '_' + role;
  const match = filename.match(/^(.*)\.(png|jpe?g|webp)$/i);
  return Boolean(match && match[1].toLowerCase() === exactStem.toLowerCase());
}
