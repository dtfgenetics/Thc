import { createHash } from 'node:crypto';
import { readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const dir = process.env.INFOGRAPHIC_SOURCE_DIR || join(process.cwd(), 'site/wordpress/assets/infographics');
const entries = (await readdir(dir)).filter((name) => /\.jpe?g\.b64$/i.test(name)).sort();

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
let created = 0;
let reused = 0;

for (const name of entries) {
  const source = join(dir, name);
  const destination = join(dir, name.replace(/\.b64$/i, ''));
  const encoded = (await readFile(source, 'utf8')).replace(/\s+/g, '');
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
    throw new Error(`Inline intake is not a JPEG: ${name}`);
  }

  let existing = null;
  try { existing = await readFile(destination); } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (existing) {
    if (hash(existing) !== hash(bytes)) {
      throw new Error(`Refusing to replace distinct canonical image: ${destination}`);
    }
    reused += 1;
  } else {
    await writeFile(destination, bytes);
    created += 1;
  }
  await unlink(source);
  console.log(`${existing ? 'Reused' : 'Decoded'} ${name} -> ${destination.split('/').pop()} (${bytes.length} bytes, sha256 ${hash(bytes)})`);
}

console.log(`INLINE_INFOGRAPHIC_B64_RESULT created=${created} reused=${reused} processed=${entries.length}`);
