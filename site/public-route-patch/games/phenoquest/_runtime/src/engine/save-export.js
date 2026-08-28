import { migrateSave } from './save-migration.js';

export function exportSave(saveData) {
  return JSON.stringify(saveData, null, 2);
}

export function importSave(rawJson, defaults) {
  const parsed = JSON.parse(rawJson);
  return migrateSave(parsed, defaults);
}

export function createSaveDownloadName(saveData, date = new Date()) {
  const version = saveData?.version ?? 'unknown';
  const stamp = date.toISOString().slice(0, 10);
  return `phenoquest_save_${version}_${stamp}.json`;
}
