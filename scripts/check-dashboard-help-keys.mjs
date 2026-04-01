/**
 * Verifica que cada metricId usado en dashboard-page.tsx tenga entrada en
 * DASHBOARD_METRIC_HELP y en DASHBOARD_HELP_SIMPLE_WORDS.
 * Ejecutar: node scripts/check-dashboard-help-keys.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dashPath = path.join(root, "src/modules/dashboard/pages/dashboard-page.tsx");
const contentPath = path.join(root, "src/modules/dashboard/components/dashboard-metric-help-content.ts");
const simplePath = path.join(root, "src/modules/dashboard/components/dashboard-metric-help-simple.ts");

const dash = fs.readFileSync(dashPath, "utf8");
const content = fs.readFileSync(contentPath, "utf8");
const simple = fs.readFileSync(simplePath, "utf8");

const idFromStatic = [...dash.matchAll(/metricId="([a-z0-9_]+)"/g)].map((m) => m[1]);
const obligationBucketKeys = [
  "obligation_bucket_due_soon",
  "obligation_bucket_overdue_1_30",
  "obligation_bucket_overdue_31_60",
  "obligation_bucket_overdue_61_plus",
  "obligation_bucket_on_track",
];
const used = new Set([...idFromStatic, ...obligationBucketKeys]);

const helpKeys = new Set([...content.matchAll(/^  ([a-z0-9_]+): a\(/gm)].map((m) => m[1]));
const simpleKeys = new Set([...simple.matchAll(/^  ([a-z0-9_]+): S\(/gm)].map((m) => m[1]));

const missingHelp = [...used].filter((id) => !helpKeys.has(id)).sort();
const missingSimple = [...used].filter((id) => !simpleKeys.has(id)).sort();

let exit = 0;
if (missingHelp.length) {
  console.error("Faltan en DASHBOARD_METRIC_HELP:", missingHelp.join(", "));
  exit = 1;
}
if (missingSimple.length) {
  console.error("Faltan en DASHBOARD_HELP_SIMPLE_WORDS:", missingSimple.join(", "));
  exit = 1;
}

const orphanHelp = [...helpKeys].filter((k) => !used.has(k)).sort();
if (orphanHelp.length) {
  console.warn(
    "Claves de ayuda no referenciadas en dashboard-page (pueden ser para uso futuro o otras pantallas):",
    orphanHelp.join(", "),
  );
}

if (exit === 0) {
  console.log(`OK: ${used.size} metricId cubiertos por ayuda principal y simple.`);
}

process.exit(exit);
