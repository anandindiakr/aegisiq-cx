// Fails when a source file imports a package that is not declared in package.json.
// Catches the "missing framer-motion" class of bugs before it reaches main.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
const declared = new Set([
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.devDependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]);

const BUILTIN = /^(node:|bun:)/;
const LOCAL = /^[./]|^@\//;
const IMPORT_RE = /(?:from\s+|import\s+|require\()\s*["']([^"']+)["']/g;

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if ([".ts", ".tsx", ".js", ".jsx", ".mjs"].includes(extname(full))) out.push(full);
  }
  return out;
}

function packageNameOf(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

const missing = new Map();
for (const file of walk("src")) {
  const source = readFileSync(file, "utf8");
  for (const [, specifier] of source.matchAll(IMPORT_RE)) {
    if (LOCAL.test(specifier) || BUILTIN.test(specifier)) continue;
    const name = packageNameOf(specifier.split("?")[0]);
    if (declared.has(name)) continue;
    if (!missing.has(name)) missing.set(name, new Set());
    missing.get(name).add(file);
  }
}

if (missing.size > 0) {
  console.error("Missing dependencies in package.json:\n");
  for (const [name, files] of missing) {
    console.error(`  ${name}\n    used by: ${[...files].join(", ")}`);
  }
  process.exit(1);
}

console.log("Dependency check passed: every imported package is declared.");
