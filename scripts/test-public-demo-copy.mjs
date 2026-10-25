import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { React, act, createRoot, dom, load, MemoryRouter } from "./lib/web-ui-harness.mjs";

const { DashboardPreview } = await import(load("src/modules/public/components/landing/dashboard-preview.tsx"));
const { AuthShell } = await import(load("src/app/layouts/auth-shell.tsx"));
const container = document.createElement("div"); document.body.append(container);
const renderer = createRoot(container);
const labels = ["Transferencia enviada", "Pago de sueldo", "Compra de alimentos"];
for (const Component of [DashboardPreview, AuthShell]) {
  await act(async () => renderer.render(React.createElement(MemoryRouter, null, React.createElement(Component))));
  for (const label of labels) assert.ok(container.textContent.includes(label), label);
  assert.doesNotMatch(container.textContent, /AGV|Lucía|Rappi|\bAG\b/);
  assert.ok(container.textContent.includes("4,226.92"), "Do not change sample balances or financial rules");
  if (Component === DashboardPreview) {
    assert.match(container.textContent, /Transporte/);
    assert.ok(container.querySelector('[role="img"][aria-label="Perfil de ejemplo"] svg'));
  }
}
const svg = readFileSync(new URL("../public/og-darkmoney-source.svg", import.meta.url), "utf8");
for (const label of labels) assert.ok(svg.includes(`>${label}</text>`));
assert.doesNotMatch(svg, /AGV|Lucía|Rappi/);
await act(async () => renderer.unmount()); container.remove(); dom.window.close();
console.log("public-demo-copy: OK (actual landing/access render and sharing SVG use generic examples; sample balances preserved)");
