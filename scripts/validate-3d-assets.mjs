#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const MAX_BYTES = Number(process.env.DTF_3D_MAX_BYTES || 25 * 1024 * 1024);
const SEARCH_ROOTS = [
  "apps",
  "games",
  "site",
  "public",
  "assets"
].map((p) => path.join(ROOT, p)).filter(fs.existsSync);

const errors = [];
const warnings = [];
const files = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (["node_modules", ".git", "dist", "build", ".next", "coverage"].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(glb|gltf)$/i.test(entry.name)) files.push(full);
  }
}

function rel(file) {
  return path.relative(ROOT, file).replaceAll(path.sep, "/");
}

function validateGlb(file) {
  const stat = fs.statSync(file);
  if (stat.size < 12) {
    errors.push(`${rel(file)}: GLB is smaller than the 12-byte header.`);
    return;
  }
  if (stat.size > MAX_BYTES) {
    errors.push(`${rel(file)}: ${stat.size} bytes exceeds DTF_3D_MAX_BYTES=${MAX_BYTES}.`);
  }
  const fd = fs.openSync(file, "r");
  try {
    const header = Buffer.alloc(12);
    fs.readSync(fd, header, 0, 12, 0);
    const magic = header.toString("ascii", 0, 4);
    const version = header.readUInt32LE(4);
    const declaredLength = header.readUInt32LE(8);
    if (magic !== "glTF") errors.push(`${rel(file)}: invalid GLB magic "${magic}".`);
    if (version !== 2) errors.push(`${rel(file)}: GLB version ${version}; DTF runtime requires glTF 2.0.`);
    if (declaredLength !== stat.size) {
      errors.push(`${rel(file)}: GLB declared length ${declaredLength} does not match file size ${stat.size}.`);
    }
  } finally {
    fs.closeSync(fd);
  }
}

function validateUri(uri, file) {
  if (!uri || uri.startsWith("data:")) return;
  if (/^https?:\/\//i.test(uri)) {
    warnings.push(`${rel(file)}: external URI "${uri}" reduces portability; prefer packaged assets.`);
    return;
  }
  const base = path.dirname(file);
  const resolved = path.resolve(base, uri);
  if (!resolved.startsWith(path.resolve(base) + path.sep) && resolved !== path.resolve(base)) {
    errors.push(`${rel(file)}: URI escapes asset directory: "${uri}".`);
    return;
  }
  if (!fs.existsSync(resolved)) errors.push(`${rel(file)}: referenced URI does not exist: "${uri}".`);
}

function validateGltf(file) {
  const stat = fs.statSync(file);
  if (stat.size > MAX_BYTES) {
    warnings.push(`${rel(file)}: JSON glTF alone exceeds ${MAX_BYTES} bytes.`);
  }
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (err) {
    errors.push(`${rel(file)}: invalid JSON (${err.message}).`);
    return;
  }
  if (doc?.asset?.version !== "2.0") errors.push(`${rel(file)}: asset.version must be "2.0".`);
  for (const buffer of doc.buffers || []) validateUri(buffer.uri, file);
  for (const image of doc.images || []) validateUri(image.uri, file);

  const names = new Set();
  for (const node of doc.nodes || []) {
    if (!node?.name) continue;
    if (names.has(node.name)) warnings.push(`${rel(file)}: duplicate node name "${node.name}".`);
    names.add(node.name);
  }
  for (const mesh of doc.meshes || []) {
    if (!mesh?.name) warnings.push(`${rel(file)}: unnamed mesh found; semantic/runtime targeting is harder.`);
  }
}

for (const root of SEARCH_ROOTS) walk(root);
for (const file of files) {
  if (/\.glb$/i.test(file)) validateGlb(file);
  else validateGltf(file);
}

console.log(`3D validation scanned ${files.length} glTF/GLB asset(s).`);
for (const warning of warnings) console.warn(`WARN: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`ERROR: ${error}`);
  process.exit(1);
}
console.log(`3D validation passed with ${warnings.length} warning(s).`);
