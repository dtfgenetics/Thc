export type ProcessedImage = {
  blob: Blob;
  width: number;
  height: number;
  sourceBytes: number;
  outputBytes: number;
  mimeType: 'image/jpeg';
};

export type ImageDimensions = {
  width: number;
  height: number;
};

export const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;
export const DEFAULT_MAX_IMAGE_EDGE = 1600;
export const DEFAULT_IMAGE_QUALITY = 0.82;

export function calculateImageDimensions(
  sourceWidth: number,
  sourceHeight: number,
  maxEdge = DEFAULT_MAX_IMAGE_EDGE,
): ImageDimensions {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
    throw new Error('Image dimensions are invalid.');
  }
  if (!Number.isFinite(maxEdge) || maxEdge <= 0) {
    throw new Error('Maximum image edge must be positive.');
  }

  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function validateSourceImage(file: File): void {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
    throw new Error('Use a JPEG, PNG, or WebP image.');
  }
  if (file.size <= 0) {
    throw new Error('The selected image is empty.');
  }
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    throw new Error('The selected image is larger than 15 MB.');
  }
}

async function decodeWithImageElement(file: File): Promise<{ image: HTMLImageElement; revoke: () => void }> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  const loaded = new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('The selected image could not be decoded.'));
  });
  image.src = url;
  await loaded;
  return { image, revoke: () => URL.revokeObjectURL(url) };
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The browser could not encode the image.'));
    }, 'image/jpeg', quality);
  });
}

export async function processImage(
  file: File,
  options: { maxEdge?: number; quality?: number } = {},
): Promise<ProcessedImage> {
  validateSourceImage(file);
  const maxEdge = options.maxEdge ?? DEFAULT_MAX_IMAGE_EDGE;
  const quality = Math.min(0.95, Math.max(0.5, options.quality ?? DEFAULT_IMAGE_QUALITY));
  const decoded = await decodeWithImageElement(file);

  try {
    const dimensions = calculateImageDimensions(
      decoded.image.naturalWidth,
      decoded.image.naturalHeight,
      maxEdge,
    );
    const canvas = document.createElement('canvas');
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('The browser cannot process images on this device.');

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, dimensions.width, dimensions.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded.image, 0, 0, dimensions.width, dimensions.height);

    const blob = await canvasToJpeg(canvas, quality);
    return {
      blob,
      width: dimensions.width,
      height: dimensions.height,
      sourceBytes: file.size,
      outputBytes: blob.size,
      mimeType: 'image/jpeg',
    };
  } finally {
    decoded.revoke();
  }
}
