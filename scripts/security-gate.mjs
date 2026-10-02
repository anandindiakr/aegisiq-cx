// Runs `bun audit --json` and fails only when findings appear that are not in
// security-baseline.json. Run with `--update` to accept the current findings.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const BASELINE = "security-baseline.json";
let raw = "{}";
try {
  raw = execSync("bun audit --json", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch (e) {
  raw = e.stdout || "{}";
}
let report = {};
try {
  report = JSON.parse(raw || "{}");
} catch {
  console.error("Could not parse audit output.");
  process.exit(1);
}

const current = [];
for (const [pkg, advisories] of Object.entries(report)) {
  for (const a of Array.isArray(advisories) ? advisories : []) {
    current.push(`${pkg}:${a.id ?? a.url ?? a.title}`);
  }
}
current.sort();

if (process.argv.includes("--update")) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  console.log(`Baseline updated with ${current.length} known finding(s).`);
  process.exit(0);
}

const known = new Set(existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, "utf8")) : []);
const fresh = current.filter((id) => !known.has(id));
if (fresh.length) {
  console.error("New security findings introduced:\n" + fresh.map((f) => `  - ${f}`).join("\n"));
  process.exit(1);
}
console.log(`Security gate passed (${current.length} known, 0 new).`);
