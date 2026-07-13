import type { LocalPhotoAsset } from './photoStore';
import { normalizeState } from './storage';
import { mergeGrowLensStates } from './syncMerge';
import type { GrowLensState } from './types';

export const COMPLETE_BACKUP_FORMAT = 'thc-growlens-complete-backup';
export const COMPLETE_BACKUP_VERSION = 1;
export const MAX_COMPLETE_BACKUP_BYTES = 200 * 1024 * 1024;
export const MAX_COMPLETE_BACKUP_PHOTOS = 5000;
export const MAX_COMPLETE_BACKUP_PHOTO_BYTES = 12 * 1024 * 1024;
export const MAX_COMPLETE_BACKUP_TOTAL_PHOTO_BYTES = 150 * 1024 * 1024;

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const photoIdPattern = /^photo-[A-Za-z0-9-]{8,130}$/;

type CompleteBackupPhoto = {
  id: string;
  plantId: string | null;
  observationId: string;
  capturedAt: string;
  width: number;
  height: number;
  mimeType: string;
  bytes: number;
  wasUploaded: boolean;
  dataBase64: string;
};

export type CompleteBackupDocument = {
  format: typeof COMPLETE_BACKUP_FORMAT;
  version: typeof COMPLETE_BACKUP_VERSION;
  app: 'THC GrowLens';
  exportedAt: string;
  state: GrowLensState;
  photos: CompleteBackupPhoto[];
};

export type ParsedCompleteBackup = {
  state: GrowLensState;
  photos: LocalPhotoAsset[];
  exportedAt: string;
  summary: {
    records: number;
    photos: number;
    photoBytes: number;
  };
};

function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  let binary = '';
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    throw new Error('Backup contains invalid photo data.');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validInteger(value: unknown, minimum: number, maximum: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error('Backup contains invalid photo dimensions or byte counts.');
  }
  return parsed;
}

function validatePhotoMetadata(value: unknown): Omit<CompleteBackupPhoto, 'dataBase64'> & { dataBase64: string } {
  if (!isRecord(value)) throw new Error('Backup contains an invalid photo record.');
  const id = typeof value.id === 'string' ? value.id : '';
  const observationId = typeof value.observationId === 'string' ? value.observationId.trim() : '';
  const plantId = typeof value.plantId === 'string' && value.plantId.trim() !== '' ? value.plantId.trim() : null;
  const capturedAt = typeof value.capturedAt === 'string' ? value.capturedAt : '';
  const mimeType = typeof value.mimeType === 'string' ? value.mimeType.toLowerCase() : '';
  const dataBase64 = typeof value.dataBase64 === 'string' ? value.dataBase64 : '';

  if (!photoIdPattern.test(id)) throw new Error('Backup contains an invalid photo identifier.');
  if (observationId === '') throw new Error('Backup photo is missing its observation identifier.');
  if (capturedAt === '' || Number.isNaN(new Date(capturedAt).getTime())) {
    throw new Error('Backup photo contains an invalid capture date.');
  }
  if (!acceptedMimeTypes.has(mimeType)) throw new Error('Backup contains an unsupported photo type.');
  if (dataBase64 === '') throw new Error('Backup photo data is missing.');

  return {
    id,
    plantId,
    observationId,
    capturedAt,
    width: validInteger(value.width, 1, 4000),
    height: validInteger(value.height, 1, 4000),
    mimeType,
    bytes: validInteger(value.bytes, 1, MAX_COMPLETE_BACKUP_PHOTO_BYTES),
    wasUploaded: value.wasUploaded === true,
    dataBase64,
  };
}

function countStateRecords(state: GrowLensState): number {
  return state.spaces.length
    + state.cycles.length
    + state.plants.length
    + state.diary.length
    + state.tasks.length
    + state.readings.length
    + state.calibrationProfiles.length
    + state.observations.length;
}

export async function serializeCompleteBackup(
  stateValue: unknown,
  photoAssets: LocalPhotoAsset[],
): Promise<string> {
  if (photoAssets.length > MAX_COMPLETE_BACKUP_PHOTOS) {
    throw new Error(`A complete backup can contain at most ${MAX_COMPLETE_BACKUP_PHOTOS} photos.`);
  }

  let totalPhotoBytes = 0;
  const photos: CompleteBackupPhoto[] = [];
  for (const asset of photoAssets) {
    if (!photoIdPattern.test(asset.id)) throw new Error(`Photo ${asset.id} has an invalid identifier.`);
    if (!acceptedMimeTypes.has(asset.mimeType.toLowerCase())) {
      throw new Error(`Photo ${asset.id} has an unsupported type.`);
    }
    if (asset.blob.size <= 0 || asset.blob.size > MAX_COMPLETE_BACKUP_PHOTO_BYTES) {
      throw new Error(`Photo ${asset.id} exceeds the backup photo-size limit.`);
    }
    totalPhotoBytes += asset.blob.size;
    if (totalPhotoBytes > MAX_COMPLETE_BACKUP_TOTAL_PHOTO_BYTES) {
      throw new Error('Local photos exceed the 150 MB complete-backup limit. Export smaller groups or remove unneeded local photos.');
    }
    const bytes = new Uint8Array(await asset.blob.arrayBuffer());
    photos.push({
      id: asset.id,
      plantId: asset.plantId,
      observationId: asset.observationId,
      capturedAt: asset.capturedAt,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType,
      bytes: bytes.byteLength,
      wasUploaded: asset.uploaded,
      dataBase64: bytesToBase64(bytes),
    });
  }

  const document: CompleteBackupDocument = {
    format: COMPLETE_BACKUP_FORMAT,
    version: COMPLETE_BACKUP_VERSION,
    app: 'THC GrowLens',
    exportedAt: new Date().toISOString(),
    state: normalizeState(stateValue),
    photos,
  };
  const serialized = JSON.stringify(document);
  if (new Blob([serialized]).size > MAX_COMPLETE_BACKUP_BYTES) {
    throw new Error('Complete backup exceeds the 200 MB archive limit.');
  }
  return serialized;
}

export async function parseCompleteBackup(raw: string): Promise<ParsedCompleteBackup> {
  if (new Blob([raw]).size > MAX_COMPLETE_BACKUP_BYTES) {
    throw new Error('Complete backup exceeds the 200 MB archive limit.');
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error('Complete backup is not valid JSON.');
  }
  if (!isRecord(decoded)) throw new Error('Complete backup root is invalid.');
  if (decoded.format !== COMPLETE_BACKUP_FORMAT || decoded.version !== COMPLETE_BACKUP_VERSION) {
    throw new Error('This is not a supported GrowLens complete backup.');
  }
  const exportedAt = typeof decoded.exportedAt === 'string' ? decoded.exportedAt : '';
  if (exportedAt === '' || Number.isNaN(new Date(exportedAt).getTime())) {
    throw new Error('Complete backup has an invalid export date.');
  }

  const photoValues = Array.isArray(decoded.photos) ? decoded.photos : [];
  if (photoValues.length > MAX_COMPLETE_BACKUP_PHOTOS) {
    throw new Error(`Complete backup contains more than ${MAX_COMPLETE_BACKUP_PHOTOS} photos.`);
  }

  let totalPhotoBytes = 0;
  const seenPhotoIds = new Set<string>();
  const photos: LocalPhotoAsset[] = [];
  for (const value of photoValues) {
    const photo = validatePhotoMetadata(value);
    if (seenPhotoIds.has(photo.id)) throw new Error(`Complete backup contains duplicate photo ID ${photo.id}.`);
    seenPhotoIds.add(photo.id);
    const bytes = base64ToBytes(photo.dataBase64);
    if (bytes.byteLength !== photo.bytes || bytes.byteLength > MAX_COMPLETE_BACKUP_PHOTO_BYTES) {
      throw new Error(`Backup photo ${photo.id} failed its byte-length check.`);
    }
    totalPhotoBytes += bytes.byteLength;
    if (totalPhotoBytes > MAX_COMPLETE_BACKUP_TOTAL_PHOTO_BYTES) {
      throw new Error('Complete backup photos exceed the 150 MB import limit.');
    }
    photos.push({
      id: photo.id,
      blob: new Blob([bytes], { type: photo.mimeType }),
      plantId: photo.plantId,
      observationId: photo.observationId,
      capturedAt: photo.capturedAt,
      width: photo.width,
      height: photo.height,
      mimeType: photo.mimeType,
      bytes: bytes.byteLength,
      uploaded: false,
    });
  }

  const state = normalizeState(decoded.state);
  return {
    state,
    photos,
    exportedAt,
    summary: {
      records: countStateRecords(state),
      photos: photos.length,
      photoBytes: totalPhotoBytes,
    },
  };
}

export function mergeCompleteBackup(
  localStateValue: unknown,
  localPhotos: LocalPhotoAsset[],
  imported: ParsedCompleteBackup,
): { state: GrowLensState; photos: LocalPhotoAsset[] } {
  const photos = new Map<string, LocalPhotoAsset>();
  for (const photo of imported.photos) photos.set(photo.id, photo);
  for (const photo of localPhotos) photos.set(photo.id, photo);
  return {
    state: mergeGrowLensStates(localStateValue, imported.state),
    photos: [...photos.values()].sort((first, second) => second.capturedAt.localeCompare(first.capturedAt)),
  };
}
