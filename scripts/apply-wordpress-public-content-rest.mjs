import { resolve } from 'node:path';
import process from 'node:process';

// Temporary one-time bridge: reuse the already-registered production REST
// workflow to verify the dedicated THC article publisher end-to-end.
process.env.ARTICLE_FILE = resolve('site/wordpress/articles/yellow-leaves.json');
process.env.ARTICLE_DIR = resolve('site/wordpress/articles');
process.env.BACKUP_ROOT = process.env.BACKUP_ROOT || process.cwd();

await import('./publish-wordpress-articles-rest.mjs');
