import { readFile } from "node:fs/promises";
const report = JSON.parse(await readFile("artifacts/game-live-evidence.json", "utf8"));
const passed = report.evidence.filter((item) => item.ok);
const failed = report.evidence.filter((item) => !item.ok);
console.log("# Public game portfolio verification");
console.log("");
console.log("- Checked: " + report.evidence.length);
console.log("- Passed route shell: " + passed.length);
console.log("- Failed route shell: " + failed.length);
if (failed.length) {
  console.log("");
  console.log("## Failed routes");
  for (const item of failed) console.log("- " + item.id + ": " + item.route + " — " + (item.error || ("HTTP " + item.status)));
}
