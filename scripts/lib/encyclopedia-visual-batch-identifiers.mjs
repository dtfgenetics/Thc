/** Controlled identifiers for visual batch files and expanding encyclopedia lessons. */
export const isVisualBatchFilePath = value =>
  typeof value === 'string' &&
  /^content\/encyclopedia\/visual-production-batches\/batch-\d{3,}\.json$/.test(value);

export const isVisualBatchOutputFilename = value =>
  typeof value === 'string' &&
  /^batch-\d{3,}\.(?:json|md)$/i.test(value);

export const isVisualLessonId = value =>
  typeof value === 'string' && /^THC-ENC-\d{3,}$/.test(value);
