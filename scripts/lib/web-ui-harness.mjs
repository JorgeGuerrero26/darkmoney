import assert from "node:assert/strict";
import { readFileSync,existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname,resolve } from "node:path";
import { fileURLToPath,pathToFileURL } from "node:url";
import ts from "typescript";
import React,{act} from "react";
export {React,act};
export const root=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const require=createRequire(resolve(root,"package.json"));
const {JSDOM}=createRequire(resolve(root,"../DarkMoneyApp/package.json"))("jsdom");
export const dom=new JSDOM("<!doctype html><html><body></body></html>",{url:"http://localhost",pretendToBeVisual:true});
for(const key of ["window","document","HTMLElement","KeyboardEvent","MutationObserver"])globalThis[key]=dom.window[key];
dom.window.HTMLElement.prototype.scrollIntoView=()=>{};
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
globalThis.requestAnimationFrame=fn=>setTimeout(fn,0);
export const {createRoot}=await import("react-dom/client");
export const {MemoryRouter}=await import("react-router-dom");
export const {QueryClient,QueryClientProvider}=await import(pathToFileURL(require.resolve("@tanstack/react-query")).href);
const virtual=source=>`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const mocks=new Map();
export const h=`import React from "${pathToFileURL(require.resolve("react")).href}";const h=React.createElement;`;
export function mock(path,source){mocks.set(resolve(root,path),virtual(source));}
export function load(path){
  const file=resolve(root,path);if(mocks.has(file))return mocks.get(file);
  const js=ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from "([^"]+)"/g,(_,specifier)=>{
    if(!specifier.startsWith("."))return `from "${pathToFileURL(require.resolve(specifier)).href}"`;
    const base=resolve(dirname(file),specifier),dep=[base,`${base}.tsx`,`${base}.ts`].find(existsSync);assert.ok(dep,specifier);return `from "${load(dep)}"`;
  });const url=virtual(js);mocks.set(file,url);return url;
}
export async function change(node,value){assert.ok(node);await act(async()=>{
  Object.getOwnPropertyDescriptor(node.tagName==="SELECT"?dom.window.HTMLSelectElement.prototype:node.tagName==="TEXTAREA"?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype,"value").set.call(node,value);
  node.dispatchEvent(new dom.window.Event(node.tagName==="SELECT"?"change":"input",{bubbles:true}));
});}
export function button(parent,label){const found=[...parent.querySelectorAll("button")].find(node=>node.textContent===label);assert.ok(found,label);return found;}
export async function settle(){await act(async()=>new Promise(resolve=>setTimeout(resolve,5)));}
