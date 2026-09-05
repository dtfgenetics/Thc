import { readFile, writeFile } from 'node:fs/promises';

const v4SourcePath = process.env.LEARNING_V4_SOURCE_PUBLISHER || 'scripts/improve-wordpress-learning-v4.mjs';
const v4OutputPath = process.env.LEARNING_V4_OWNER_AWARE_PUBLISHER || '/tmp/improve-wordpress-learning-v4-owner-aware.mjs';
const visualSourcePath = process.env.LEARNING_VISUAL_SOURCE_PUBLISHER || 'scripts/apply-learning-visual-v1.mjs';
const visualOutputPath = process.env.LEARNING_VISUAL_OWNER_AWARE_PUBLISHER || '/tmp/apply-learning-visual-v1-owner-aware.mjs';

let v4 = await readFile(v4SourcePath, 'utf8');
const v4Pattern = /if \(apply\) \{\n  await request\(`\/wp-json\/wp\/v2\/pages\/\$\{page\.id\}`,[\s\S]*?if \(!verified\) throw new Error\('Live Learn page did not expose the canonical Learning V3 \+ connected Learning V4 map after publication\.'\);\n\}/;
const v4Replacement = `if (apply) {
  await request(\`/wp-json/wp/v2/pages/\${page.id}\`, { method: 'POST', body: JSON.stringify({ content, status: 'publish' }) });
  const storedPage = await request(\`/wp-json/wp/v2/pages/\${page.id}?context=edit\`);
  const storedContent = raw(storedPage?.content);
  const storedRequirements = ['data-dtf-layout="learn-v3"', styleId, 'data-dtf-learning-map="v4"', goalHeading, mapHeading, foundationHeading];
  const storedMissing = storedRequirements.filter(marker => !storedContent.includes(marker));
  if (Number(storedPage?.id || 0) !== Number(page.id) || storedPage?.status !== 'publish' || storedMissing.length) {
    throw new Error(\`Stored Learn V4 owner verification failed: id=\${storedPage?.id || 0} status=\${storedPage?.status || 'missing'} missing=\${storedMissing.join(',')}\`);
  }
}`;
if (!v4Pattern.test(v4)) throw new Error('Could not locate the reviewed Learning V4 anonymous-root verifier; refusing an unreviewed patch.');
v4 = v4.replace(v4Pattern, v4Replacement).replace("  learningMapSteps: 6\n};", "  learningMapSteps: 6,\n  storageVerification: apply ? 'success' : 'not-applied'\n};");
await writeFile(v4OutputPath, v4, 'utf8');

let visual = await readFile(visualSourcePath, 'utf8');
const visualPattern = /if \(apply\) \{\n  for \(const target of targets\) \{[\s\S]*?report\.liveVerification = 'success';\n\}/;
const visualReplacement = `if (apply) {
  for (const target of targets) {
    const evidence = report.pages.find(item => item.slug === target.slug);
    if (!evidence?.pageId) throw new Error(\`Missing transaction page evidence for /\${target.slug}/\`);
    const storedPage = await request(\`/wp-json/wp/v2/pages/\${evidence.pageId}?context=edit\`);
    const storedContent = raw(storedPage?.content);
    const required = [\`data-dtf-layout="\${target.layout}"\`, 'data-dtf-visual="v1"', 'dtf-visual-v1-shared', 'dtf-learning-owner-v1', ...target.required];
    const missing = required.filter(marker => !storedContent.includes(marker));
    if (Number(storedPage?.id || 0) !== Number(evidence.pageId) || storedPage?.status !== 'publish' || missing.length) {
      throw new Error(\`Stored /\${target.slug}/ Learning Visual V1 verification failed: id=\${storedPage?.id || 0} status=\${storedPage?.status || 'missing'} missing=\${missing.join(',')}\`);
    }
  }
  report.storageVerification = 'success';
}`;
if (!visualPattern.test(visual)) throw new Error('Could not locate the reviewed Learning Visual V1 anonymous-root verifier; refusing an unreviewed patch.');
visual = visual.replace(visualPattern, visualReplacement);
await writeFile(visualOutputPath, visual, 'utf8');

console.log(JSON.stringify({
  v4: { sourcePath: v4SourcePath, outputPath: v4OutputPath, verification: 'wordpress-rest-storage' },
  visual: { sourcePath: visualSourcePath, outputPath: visualOutputPath, verification: 'wordpress-rest-storage' }
}, null, 2));
