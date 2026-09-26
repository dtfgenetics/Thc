import fs from "node:fs";

const requiredFiles = [
  "docs/PRODUCTION_STANDARDS.md",
  "README.md",
  "package.json",
];

const missing = requiredFiles.filter((file) => !fs.existsSync(file));
if (missing.length) {
  console.error("Production standard validation failed. Missing required files:");
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}

const standards = fs.readFileSync("docs/PRODUCTION_STANDARDS.md", "utf8");
const requiredHeadings = [
  "Responsive standard",
  "Navigation and information architecture",
  "Tools UX standard",
  "Course standard",
  "Educational visual standard",
  "Accessibility",
  "Performance",
  "Required deterministic QA",
  "Definition of done",
];

const absent = requiredHeadings.filter((heading) => !standards.includes(heading));
if (absent.length) {
  console.error("Production standard validation failed. Required sections are missing:");
  for (const heading of absent) console.error(`- ${heading}`);
  process.exit(1);
}

const forbiddenRoutineQa = [
  /playwright[^\n]{0,80}(required|routine|standard|must pass)/i,
  /(required|routine|standard)[^\n]{0,80}playwright/i,
];

const repoDocs = fs.readFileSync("README.md", "utf8");
const playwrightLines = repoDocs.split(/\r?\n/).filter((line) => /playwright/i.test(line));
for (const line of playwrightLines) {
  const explicitlyProhibitsPlaywright = /\b(do not|don't|never|forbid(?:den)?|must not)\b/i.test(line);
  if (explicitlyProhibitsPlaywright) continue;
  for (const pattern of forbiddenRoutineQa) {
    if (pattern.test(line)) {
      console.error("Production standard validation failed: README makes Playwright part of routine/required QA.");
      process.exit(1);
    }
  }
}

console.log("Production standards verification passed.");
