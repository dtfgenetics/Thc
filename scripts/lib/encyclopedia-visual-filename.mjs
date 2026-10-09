/** Parse the permanent lesson ID from a canonical raster filename without truncating 1000+ IDs. */
export function lessonIdFromVisualFilename(name) {
  if (typeof name !== 'string' || !/\.(?:png|jpe?g|webp)$/i.test(name)) return null;
  const match = name.match(/^(THC-ENC-\d{3,})(?=_|\.)/i);
  return match ? match[1].toUpperCase() : null;
}
