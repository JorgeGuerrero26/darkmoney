import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import ts from 'typescript';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { JSDOM } = createRequire(resolve(root, '../DarkMoneyApp/package.json'))('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
for (const key of ['window', 'document', 'HTMLElement', 'MouseEvent']) globalThis[key] = dom.window[key];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const cache = new Map();
const requireWeb = createRequire(resolve(root, 'package.json'));
function load(file) {
  if (cache.has(file)) return cache.get(file);
  let code = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  code = code.replace(/from "([^"]+)"/g, (_, specifier) => {
    if (!specifier.startsWith('.')) return `from "${pathToFileURL(requireWeb.resolve(specifier)).href}"`;
    const base = resolve(dirname(file), specifier);
    const dependency = [base, `${base}.tsx`, `${base}.ts`].find(existsSync);
    assert.ok(dependency, specifier);
    return `from "${load(dependency)}"`;
  });
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
  cache.set(file, url);
  return url;
}
const { ToastProvider, useToast } = await import(load(resolve(root, 'src/components/ui/toast-provider.tsx')));
const { UndoQueueProvider, useUndoQueue } = await import(load(resolve(root, 'src/components/ui/undo-queue.tsx')));
let api, commits = 0, undos = 0;
function Harness() { api = { ...useToast(), ...useUndoQueue() }; return null; }
const container = document.createElement('div'); document.body.append(container);
const rootView = createRoot(container);
await act(async () => rootView.render(React.createElement(ToastProvider, null, React.createElement(UndoQueueProvider, null, React.createElement(Harness)))));
await act(async () => { api.schedule({ label: 'Eliminar uno', duration: 100, onCommit: () => { commits++; }, onUndo: () => { undos++; } }); });
await act(async () => { api.showToast({ title: 'Error 1', description: 'Uno', tone: 'error' }); api.showToast({ title: 'Error 2', description: 'Dos', tone: 'error' }); });
assert.equal(container.querySelectorAll('[role="status"], [role="alert"]').length, 2);
await act(async () => { await new Promise((done) => setTimeout(done, 160)); });
assert.equal(commits, 0, 'una acción oculta no debe confirmarse');
await act(async () => { container.querySelector('button[aria-label="Cerrar notificación"]').click(); });
const undo = [...container.querySelectorAll('button')].find((button) => button.textContent === 'Deshacer');
assert.ok(undo, 'la acción vuelve a ser visible');
await act(async () => undo.click());
assert.equal(undos, 1);
assert.equal(commits, 0);
await act(async () => rootView.unmount());
dom.window.close();
console.log('toast-runtime: OK (React, dos visibles, pausa en espera, deshacer)');
