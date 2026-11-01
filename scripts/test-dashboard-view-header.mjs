import assert from "node:assert/strict";
import { React, act, dom, load, createRoot, button } from "./lib/web-ui-harness.mjs";

const { DashboardViewHeader } = await import(load("src/modules/dashboard/components/dashboard-view-header.tsx"));
const container = document.createElement("div");
document.body.append(container);
const renderer = createRoot(container);
const changes = [];
const render = async (extra = {}) => act(async () => renderer.render(React.createElement(DashboardViewHeader, {
  name: "Adrian Guerrero", mode: "simple", canUseAdvanced: true, checkingAccess: false,
  onChange: (mode) => changes.push(mode), ...extra,
})));
await render();
assert.match(container.textContent, /Hola, Adrian/);
assert.equal(button(container, "Simple").getAttribute("aria-pressed"), "true");
await act(async () => button(container, "Avanzado").click());
assert.deepEqual(changes, ["advanced"]);
await render({ mode: "advanced" });
assert.equal(button(container, "Avanzado").getAttribute("aria-pressed"), "true");
await render({ updatedAt: Date.now() - 42000 });
assert.match(container.textContent, /Actualizado hace 42 s/);
await render({ updatedAt: Date.now() - 42000, refreshing: true });
assert.match(container.textContent, /Actualizando datos/);
await render({ mode: "simple", canUseAdvanced: false });
assert.equal(button(container, "Avanzado").disabled, true);
assert.match(container.textContent, /requiere Pro/);
await render({ canUseAdvanced: false, checkingAccess: true });
assert.match(container.textContent, /Comprobando acceso/);
await act(async () => renderer.unmount());

const { DashboardAnalysisSections } = await import(load("src/modules/dashboard/components/dashboard-analysis-sections.tsx"));
const integrated = createRoot(container);
function DashboardProbe() {
  const [mode, setMode] = React.useState("simple");
  return React.createElement(React.Fragment, null,
    React.createElement(DashboardViewHeader, { name: "Adrian", mode, canUseAdvanced: true, checkingAccess: false, onChange: setMode }),
    React.createElement(DashboardAnalysisSections, {
      enabled: mode === "advanced", summary: "Disponible hoy · Resumen financiero", patterns: () => "Patrones disponibles",
      flow: () => "Flujo", history: () => "Historial", health: () => "Salud",
    }));
}
await act(async () => integrated.render(React.createElement(DashboardProbe)));
assert.equal([...container.querySelectorAll("button")].some((node) => node.textContent === "Patrones"), false);
await act(async () => button(container, "Avanzado").click());
await act(async () => button(container, "Patrones").click());
assert.match(container.textContent, /Patrones disponibles/);
assert.doesNotMatch(container.textContent, /Disponible hoy/);
await act(async () => button(container, "Simple").click());
assert.match(container.textContent, /Disponible hoy · Resumen financiero/);
await act(async () => integrated.unmount());
container.remove(); dom.window.close();
console.log("Dashboard header: greeting, mode switching and Pro access passed.");
