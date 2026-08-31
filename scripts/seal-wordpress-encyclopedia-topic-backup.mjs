import crypto from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const backupDir = process.argv[2] || process.env.ENCYCLOPEDIA_TOPIC_BACKUP_DIR || '';
if (!backupDir) throw new Error('Topic backup directory is required.');

const files = ['pre-write-pages.json', 'encyclopedia-topic-organization-report.json'];
const hashes = {};
for (const name of files) {
  const bytes = await readFile(`${backupDir}/${name}`);
  hashes[name] = crypto.createHash('sha256').update(bytes).digest('hex');
}
const seal = {
  schemaVersion: 1,
  backupDir,
  hashes,
  sealedAt: new Date().toISOString()
};
await writeFile(`${backupDir}/rollback-integrity.json`, `${JSON.stringify(seal, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, ...seal }, null, 2));
