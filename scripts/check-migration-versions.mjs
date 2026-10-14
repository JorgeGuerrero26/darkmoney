import assert from "node:assert/strict";
import { readdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const folder = resolve(root, "supabase/migrations");
const byVersion = new Map();
for (const file of readdirSync(folder).filter(name => name.endsWith(".sql"))) {
  const match = /^(\d{12,14})_.+\.sql$/.exec(file);
  assert.ok(match, `Invalid migration filename: ${file}`);
  assert.ok(!byVersion.has(match[1]), `Duplicate migration version ${match[1]}: ${byVersion.get(match[1])} / ${file}`);
  byVersion.set(match[1], file);
}
const mobileFolder = resolve(root, "../DarkMoneyApp/supabase/migrations");
// Check the two newly reserved versions against the other developer's local tree.
// Existing historical differences are not repaired or treated as a deployment plan.
if (existsSync(mobileFolder)) {
  for (const version of ["202610150001", "202610150002"]) {
    const reserved = byVersion.get(version);
    assert.ok(reserved, `Missing reserved migration ${version}`);
    const mobile = readdirSync(mobileFolder).filter(file => file.startsWith(`${version}_`) && file.endsWith(".sql"));
    assert.ok(mobile.length <= 1 && mobile.every(file => file === reserved), `Reserved version ${version} conflicts with mobile: ${mobile.join(", ")}`);
  }
}
console.log("migration-versions: OK (unique web versions and two local cross-repo reservations; remote history not inspected)");
