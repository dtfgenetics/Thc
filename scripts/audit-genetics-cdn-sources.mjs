import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const catalogPath = process.env.SEED_LINE_CATALOG || 'site/wordpress/products/seed-line-catalog.json';
const output = process.env.GENETICS_CDN_REPORT || 'genetics-cdn-source-report.json';
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));

if (catalog?.schemaVersion !== 1 || !Array.isArray(catalog?.lines) || catalog.lines.length === 0) {
  throw new Error('Canonical genetics catalog is missing or empty.');
}

const expectedCardCount = catalog.lines.reduce((count, line) => count + (Array.isArray(line.releaseCards) ? line.releaseCards.length : 0), 0);
if (expectedCardCount === 0) throw new Error('Canonical genetics catalog contains no reviewed cards.');

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function imageInfo(bytes) {
  if (bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') {
    return { mime: 'image/png', width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.subarray(0, 3).toString('hex') === 'ffd8ff') {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 255) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      if (marker === 216 || marker === 217) { offset += 2; continue; }
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) break;
      if ([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)) {
        return { mime: 'image/jpeg', height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  throw new Error('Unsupported or invalid image');
}

const rows = [];
for (const line of catalog.lines) {
  for (const card of line.releaseCards || []) {
    if (!card.sourceUrl) throw new Error(`${line.id}: card source URL missing`);
    const response = await fetch(card.sourceUrl, {
      headers: {
        Accept: 'image/*',
        'Cache-Control': 'no-cache, no-store, max-age=0',
        'User-Agent': 'DTFSeeds-Genetics-CDN-Audit/1.1'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(60_000)
    });
    if (!response.ok) throw new Error(`${line.id} ${card.generation} ${card.seedType}: CDN HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const info = imageInfo(bytes);
    if (info.width !== Number(card.expectedWidth) || info.height !== Number(card.expectedHeight)) {
      throw new Error(`${line.id} ${card.generation}: dimensions ${info.width}x${info.height} != ${card.expectedWidth}x${card.expectedHeight}`);
    }
    rows.push({
      lineId: line.id,
      lineName: line.name,
      generation: card.generation,
      seedType: card.seedType,
      wordpressSlug: card.wordpressSlug,
      url: card.sourceUrl,
      mimeType: info.mime,
      width: info.width,
      height: info.height,
      cdnByteLength: bytes.length,
      cdnSha256: sha256(bytes),
      provenanceByteLength: card.sourceByteLength ?? null,
      provenanceSha256: card.sourceSha256 ?? null
    });
  }
}

if (rows.length !== expectedCardCount) {
  throw new Error(`Catalog expected ${expectedCardCount} reviewed card sources; audited ${rows.length}.`);
}

const report = {
  generatedAt: new Date().toISOString(),
  catalogPath,
  lineCount: catalog.lines.length,
  count: rows.length,
  rows
};
await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
