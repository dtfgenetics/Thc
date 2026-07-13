export type LocalPhotoAsset = {
  id: string;
  blob: Blob;
  plantId: string | null;
  observationId: string;
  capturedAt: string;
  width: number;
  height: number;
  mimeType: string;
  bytes: number;
  uploaded: boolean;
};

const DATABASE_NAME = 'growlens-media-v1';
const DATABASE_VERSION = 1;
const PHOTO_STORE = 'photos';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
  });
}

export async function openPhotoDatabase(): Promise<IDBDatabase> {
  if (!('indexedDB' in globalThis)) {
    throw new Error('Offline photo storage is not available in this browser.');
  }

  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(PHOTO_STORE)) {
      const store = database.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
      store.createIndex('capturedAt', 'capturedAt');
      store.createIndex('uploaded', 'uploaded');
    }
  };
  return requestResult(request);
}

export async function putPhoto(asset: LocalPhotoAsset): Promise<void> {
  const database = await openPhotoDatabase();
  try {
    const transaction = database.transaction(PHOTO_STORE, 'readwrite');
    transaction.objectStore(PHOTO_STORE).put(asset);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function getPhoto(photoId: string): Promise<LocalPhotoAsset | null> {
  const database = await openPhotoDatabase();
  try {
    const transaction = database.transaction(PHOTO_STORE, 'readonly');
    const result = await requestResult(transaction.objectStore(PHOTO_STORE).get(photoId));
    await transactionDone(transaction);
    return result ?? null;
  } finally {
    database.close();
  }
}

export async function listPhotos(): Promise<LocalPhotoAsset[]> {
  const database = await openPhotoDatabase();
  try {
    const transaction = database.transaction(PHOTO_STORE, 'readonly');
    const results = await requestResult(transaction.objectStore(PHOTO_STORE).getAll());
    await transactionDone(transaction);
    return results.sort((first, second) => second.capturedAt.localeCompare(first.capturedAt));
  } finally {
    database.close();
  }
}

export async function deletePhoto(photoId: string): Promise<void> {
  const database = await openPhotoDatabase();
  try {
    const transaction = database.transaction(PHOTO_STORE, 'readwrite');
    transaction.objectStore(PHOTO_STORE).delete(photoId);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
}

export async function markPhotoUploaded(photoId: string, uploaded = true): Promise<LocalPhotoAsset | null> {
  const asset = await getPhoto(photoId);
  if (!asset) return null;
  const updated = { ...asset, uploaded };
  await putPhoto(updated);
  return updated;
}
