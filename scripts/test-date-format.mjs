import assert from "node:assert/strict";

import { formatDate } from "../src/lib/formatting/dates.ts";

process.env.TZ = "America/Lima";

assert.equal(formatDate("2026-09-30").slice(0, 2), "30", "Una fecha de calendario no debe retroceder un día");
assert.equal(formatDate("2026-09-30T00:00:00Z").slice(0, 2), "29", "Los instantes UTC conservan su conversión horaria");

console.log("date-format: OK");
