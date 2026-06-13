// Runner del smoke de paridad. El repo usa "type":"module", pero el smoke se
// compila a CommonJS en .tmp/, así que marcamos esa carpeta como commonjs antes
// de ejecutarlo con node.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

writeFileSync(".tmp/parity-tests/package.json", JSON.stringify({ type: "commonjs" }));

execFileSync("node", [".tmp/parity-tests/tests/parity/parity-smoke.js"], {
  stdio: "inherit",
});
