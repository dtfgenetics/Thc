import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const projectRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const repoRoot=path.resolve(projectRoot,"..","..");
const dataRoot=path.join(projectRoot,"data");
const publicRoot=path.join(repoRoot,"site","public-route-patch","games","strain-showdown");
const manifest=JSON.parse(fs.readFileSync(path.join(dataRoot,"roster-manifest.json"),"utf8"));
const canonicalCards=manifest.files.flatMap((file)=>JSON.parse(fs.readFileSync(path.join(dataRoot,file),"utf8"))).sort((a,b)=>a.id.localeCompare(b.id));
const publicCards=manifest.files.flatMap((file)=>JSON.parse(fs.readFileSync(path.join(publicRoot,"data",file),"utf8"))).sort((a,b)=>a.id.localeCompare(b.id));
const canonicalFamilies=JSON.parse(fs.readFileSync(path.join(dataRoot,"families.json"),"utf8"));
const publicFamilies=JSON.parse(fs.readFileSync(path.join(publicRoot,"data","families.json"),"utf8"));
if(JSON.stringify(canonicalCards)!==JSON.stringify(publicCards))throw new Error("Public Strain Showdown roster data is not synchronized with the canonical 96-card roster.");
if(JSON.stringify(canonicalFamilies)!==JSON.stringify(publicFamilies))throw new Error("Public Strain Showdown family data is not synchronized with canonical families.json.");
for(const file of ["index.html","app.js","engine.mjs","styles.css"]){const full=path.join(publicRoot,file);if(!fs.existsSync(full)||fs.statSync(full).size===0)throw new Error(`Missing public runtime file: ${file}`)}
const html=fs.readFileSync(path.join(publicRoot,"index.html"),"utf8");if(!html.includes("https://dtfseeds.com/games/strain-showdown/"))throw new Error("Canonical production URL missing from index.html");if(!html.includes('type="module" src="./app.js"'))throw new Error("Browser module entrypoint missing from index.html");console.log("Strain Showdown public browser data is synchronized.");
