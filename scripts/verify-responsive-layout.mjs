import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const warnings = [];

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    failures.push(`Missing required responsive file: ${rel}`);
    return "";
  }
  return fs.readFileSync(file, "utf8");
}

function requireMatch(content, regex, message) {
  if (!regex.test(content)) failures.push(message);
}

const responsivePath = "site/wordpress/assets/responsive-layout-v1.css";
const responsive = read(responsivePath);

requireMatch(
  responsive,
  /--dtf-layout-gutter\s*:\s*clamp\(/,
  "Shared responsive CSS must keep a fluid page gutter token."
);
requireMatch(
  responsive,
  /--dtf-layout-touch\s*:\s*44px/,
  "Shared responsive CSS must keep the 44px minimum touch target token."
);
requireMatch(
  responsive,
  /@media\s*\(min-width:\s*701px\)\s*and\s*\(max-width:\s*1120px\)/,
  "Shared responsive CSS must keep the deliberate tablet/compact band (701–1120px)."
);
requireMatch(
  responsive,
  /@media\s*\(max-width:\s*900px\)/,
  "Shared responsive CSS must keep the intermediate 900px composition breakpoint."
);
requireMatch(
  responsive,
  /@media\s*\(max-width:\s*700px\)/,
  "Shared responsive CSS must keep the phone breakpoint at 700px."
);
requireMatch(
  responsive,
  /@media\s*\(max-width:\s*420px\)/,
  "Shared responsive CSS must keep the small-phone breakpoint at 420px."
);
requireMatch(
  responsive,
  /minmax\(0\s*,\s*1fr\)/,
  "Shared responsive CSS must use shrink-safe grid columns (minmax(0,1fr))."
);
requireMatch(
  responsive,
  /min-width\s*:\s*0/,
  "Shared responsive CSS must preserve min-width:0 overflow protection."
);
requireMatch(
  responsive,
  /overflow-x\s*:\s*auto/,
  "Shared responsive CSS must preserve local horizontal scrolling for dense content."
);
requireMatch(
  responsive,
  /100dvh/,
  "Shared responsive CSS must account for dynamic mobile viewport height (100dvh)."
);

const docs = read("docs/RESPONSIVE_LAYOUT_STANDARD.md");
const headerTemplate = read("scripts/lib/sitewide-header-template.mjs");
const courseUi = read("scripts/enhance-wordpress-learning-hub-course1-ui-v3.mjs");
const toolsHub = read("site/public-route-patch/tools/index.html");
const gamesHub = read("site/public-route-patch/games/index.html");
const visualV1 = read("site/design-system/dtf-visual-v1.css");
const touchTargetFiles = [
  ["apps/growlens-web/src/account.css", [/\.account-tabs button[^}]*min-height:\s*(?:3\d|4[0-3])px/]],
  ["apps/high-land-web/src/highLandUiV2.css", [/\.player-select button[^}]*min-height:\s*(?:3\d|4[0-3])px/]],
  ["scripts/publish-wordpress-interface-v7.mjs", [/\.dtf-shell-menu[^}]*min-height:(?:3\d|4[0-3])px/, /\.dtf-shell-nav a[^}]*min-height:(?:3\d|4[0-3])px/]],
  ["scripts/style-wordpress-woocommerce-archive.mjs", [/woocommerce-ordering select[^}]*min-height:(?:3\d|4[0-3])px/]],
  ["scripts/publish-wordpress-tech1-courses-2-7-v2.mjs", [/\.t1c-nav a[^}]*min-height:(?:3\d|4[0-3])px/, /\.t1c-crumbs a[^}]*min-height:(?:3\d|4[0-3])px/]],
  ["scripts/publish-wordpress-tech2-courses-1-8.mjs", [/\.t2c-crumbs a[^}]*min-height:(?:3\d|4[0-3])px/]],
  ["scripts/publish-wordpress-certification-catalog-v6.mjs", [/\.dc6-jump a[^}]*min-height:(?:3\d|4[0-3])px/]],
  ["site/public-route-patch/games/strain-showdown/runtime-v2.css", [/#restartButton[^}]*min-height:(?:3\d|4[0-3])px/]],
  ["site/public-route-patch/games/high-iq/high-iq-v3-3.css", [/\.high-iq-hero \.actions a[^}]*min-height:(?:3\d|4[0-3])px/]],
];

const growLensAccount = read("apps/growlens-web/src/account.css");
const productionHighIq = read("site/public-route-patch/games/high-iq/high-iq-v3-4.css");
const productionStrainShowdown = read("site/public-route-patch/games/strain-showdown/runtime-v4.css");
const tech1Courses = read("scripts/publish-wordpress-tech1-courses-2-7-v2.mjs");
const tech2Courses = read("scripts/publish-wordpress-tech2-courses-1-8.mjs");
const course1Layout = read("scripts/apply-wordpress-learning-hub-course1-layout-v4.mjs");
if (!/height:\s*100dvh/.test(growLensAccount) || !/max-height:\s*100dvh/.test(growLensAccount)) {
  failures.push("GrowLens account drawer must remain bounded to the dynamic viewport height.");
}
if (!/@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*560px\)/.test(productionHighIq)) {
  failures.push("Production High IQ must keep a short-landscape gameplay layout in the active v3.4 stylesheet.");
}
if (!/@media\s*\(orientation:\s*landscape\)\s*and\s*\(max-height:\s*560px\)/.test(productionStrainShowdown)) {
  failures.push("Production Strain Showdown must keep a short-landscape gameplay layout in runtime-v4.css.");
}
if (/@media\s*\(max-width:\s*720px\)/.test(productionStrainShowdown)) {
  failures.push("Production Strain Showdown must use the canonical 700px phone band, not the legacy 720px breakpoint.");
}

for (const [label, source] of [
  ["Tech 1 course navigation", tech1Courses],
  ["Tech 2 course navigation", tech2Courses],
  ["Course 1 navigation", course1Layout],
]) {
  if (/position:\s*fixed/.test(source) && !/safe-area-inset-bottom/.test(source)) {
    failures.push(`${label} uses fixed mobile navigation without bottom safe-area protection.`);
  }
}

const dynamicViewportFiles = [
  "apps/growlens-web/src/backup.css",
  "apps/growlens-web/src/camera.css",
  "apps/growlens-web/src/routines.css",
  "apps/growlens-web/src/reports.css",
  "apps/growlens-web/src/photo-comparison.css",
  "apps/growlens-web/src/styles.css",
  "apps/high-land-web/src/styles.css",
  "scripts/apply-wordpress-learning-hub-course1-layout-v4.mjs",
  "site/public-route-patch/games/high-lines/high-lines.css",
  "site/public-route-patch/games/phenoquest/style.css",
  "site/public-route-patch/games/pheno-draft/pheno-draft.css",
  "site/public-route-patch/games/strain-match/strain-match-v2.css",
];

if (/lhv3[\s\S]{0,1500}100vh/.test(headerTemplate)) {
  failures.push("Course sticky rails must use 100dvh, not 100vh.");
}
if (/@media\s*\(max-width:\s*950px\)/.test(courseUi)) {
  failures.push("Course UI must not reintroduce the legacy 950px collapse breakpoint; use the canonical 900px band.");
}
const forbiddenLegacy = [
  ["Tools hub", toolsHub, /@media\s*\(max-width:\s*(?:980|680)px\)/],
  ["Games hub", gamesHub, /@media\s*\(max-width:\s*(?:1050|780)px\)/],
  ["DTF visual v1", visualV1, /@media\s*\(max-width:\s*(?:980|640)px\)/],
];
for (const [label, source, pattern] of forbiddenLegacy) {
  if (pattern.test(source)) failures.push(`${label} reintroduced a legacy responsive breakpoint that conflicts with the shared bands.`);
}
for (const rel of dynamicViewportFiles) {
  const source = read(rel);
  if (/100vh/.test(source)) {
    failures.push(`${rel} uses 100vh; responsive shells and panels must use 100dvh so mobile browser chrome cannot clip content.`);
  }
}
for (const [rel, patterns] of touchTargetFiles) {
  const source = read(rel);
  for (const pattern of patterns) {
    if (pattern.test(source)) failures.push(`${rel} contains an interactive control below the 44px touch-target floor.`);
  }
}

const toolsTabletBlock = toolsHub.match(/@media\s*\(max-width:\s*900px\)\s*\{([\s\S]*?)\}\s*\/\* Shared phone breakpoint/);
if (toolsTabletBlock && /\.tool-chooser\s*\{[^}]*grid-template-columns\s*:\s*1fr/.test(toolsTabletBlock[1])) {
  failures.push("Tools hub must keep the tool chooser multi-column through tablet widths; collapse it at the phone band instead.");
}

const gamesTabletBlock = gamesHub.match(/@media\s*\(max-width:\s*900px\)\s*\{([\s\S]*?)\}\s*\/\* Shared phone breakpoint/);
if (gamesTabletBlock && /\.grid\.two[^}]*grid-template-columns\s*:\s*1fr/.test(gamesTabletBlock[1])) {
  failures.push("Games hub must not collapse the library grid to one column at tablet width.");
}
requireMatch(
  docs,
  /360\s*[×x]\s*800/,
  "Responsive standard must retain the phone QA matrix."
);
requireMatch(
  docs,
  /768\s*[×x]\s*1024/,
  "Responsive standard must retain the tablet QA matrix."
);
requireMatch(
  docs,
  /1440\s*[×x]\s*900/,
  "Responsive standard must retain the desktop QA matrix."
);
requireMatch(docs, /844\s*[×x]\s*390/, "Responsive standard must retain the landscape-phone QA case.");

const criticalHtml = [
  "site/public-route-patch/tools/index.html",
  "site/public-route-patch/games/index.html",
  "site/public-route-patch/games/high-iq/index.html",
  "site/public-route-patch/atlas/index.html",
  "site/public-route-patch/terpene-atlas/index.html",
];

for (const rel of criticalHtml) {
  const html = read(rel);
  if (!html) continue;
  if (!/<meta\s+name=["']viewport["'][^>]*width=device-width/i.test(html)) {
    failures.push(`${rel} is missing a responsive viewport meta tag.`);
  }
}

const localCssRoots = [
  "site/public-route-patch",
  "apps/growlens-web",
  "apps/high-land-web",
];

const breakpointPattern = /@media[^\{]*(?:max-width|min-width)\s*:\s*(\d+)px/gi;
const unusualCounts = new Map();

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(full));
    else if (ent.isFile() && /\.css$/i.test(ent.name)) out.push(full);
  }
  return out;
}

for (const relRoot of localCssRoots) {
  for (const file of walk(path.join(root, relRoot))) {
    const css = fs.readFileSync(file, "utf8");
    let match;
    while ((match = breakpointPattern.exec(css))) {
      const width = Number(match[1]);
      if (![420, 700, 900, 1120, 1121].includes(width)) {
        const rel = path.relative(root, file).replaceAll("\\", "/");
        const key = `${rel}:${width}`;
        unusualCounts.set(key, (unusualCounts.get(key) || 0) + 1);
      }
    }
  }
}

if (unusualCounts.size) {
  const examples = [...unusualCounts.keys()].slice(0, 20);
  warnings.push(
    "Local component breakpoints outside the canonical shared bands exist. They are allowed only for documented content-driven reasons. Review when touching these files:\n  - " +
      examples.join("\n  - ") +
      (unusualCounts.size > examples.length ? `\n  - …and ${unusualCounts.size - examples.length} more` : "")
  );
}

if (warnings.length) {
  console.warn("\nResponsive verifier warnings:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (failures.length) {
  console.error("\nResponsive verifier failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Responsive layout contract verified.");
