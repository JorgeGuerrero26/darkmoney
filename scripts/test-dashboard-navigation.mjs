import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { React, act, dom, root, load, createRoot, MemoryRouter, button } from "./lib/web-ui-harness.mjs";
const { DashboardAnalysisSections }=await import(load("src/modules/dashboard/components/dashboard-analysis-sections.tsx"));
const { useResourceLink }=await import(load("src/hooks/use-resource-link.ts"));
const container=document.createElement('div');document.body.append(container);const renderer=createRoot(container);const calls=[];
const props={enabled:true,summary:React.createElement('p',null,'Resumen financiero'),patterns:()=>{calls.push('patterns');return 'Patrones nativos'},flow:()=>{calls.push('flow');return 'Flujo nativo'},history:()=>{calls.push('history');return 'Historial nativo'},health:()=>{calls.push('health');return 'Salud nativa'}};
async function render(extra={},key='alice:8'){await act(async()=>renderer.render(React.createElement(DashboardAnalysisSections,{...props,...extra,key})));}
await render();assert.equal(calls.length,0);assert.match(container.textContent,/Resumen financiero/);assert.equal(button(container,'Resumen').getAttribute('aria-pressed'),'true');
for(const [label,kind,text]of [['Patrones','patterns','Patrones nativos'],['Flujo','flow','Flujo nativo'],['Historial','history','Historial nativo'],['Salud','health','Salud nativa']]){const before=calls.length;await act(async()=>button(container,label).click());assert.deepEqual(calls.slice(before),[kind]);assert.match(container.textContent,new RegExp(text));assert.doesNotMatch(container.textContent,/Resumen financiero/);assert.equal(button(container,label).getAttribute('aria-pressed'),'true');}
await render({},'alice:9');assert.equal(button(container,'Resumen').getAttribute('aria-pressed'),'true');await act(async()=>button(container,'Flujo').click());const before=calls.length;await render({enabled:false},'alice:9');assert.match(container.textContent,/Resumen financiero/);assert.equal(container.querySelectorAll('button').length,0);assert.equal(calls.length,before);await render({},'alice:9');assert.equal(button(container,'Resumen').getAttribute('aria-pressed'),'true');
await act(async()=>renderer.unmount());container.textContent='';
// Actual resource-opening arguments from RecurringIncomePage and the real router hook.
const path=resolve(root,'src/modules/recurring-income/pages/recurring-income-page.tsx');const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let resourceCall;
function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(source)==='useResourceLink')resourceCall=node.getText(source);ts.forEachChild(node,visit);}visit(source);assert.ok(resourceCall);
const code=ts.transpileModule(resourceCall,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const invoke=new Function('useResourceLink','snapshot','activeWorkspace','snapshotQuery','recurringIncome','openEditEditor',code),opened=[];
function ResourceHost({ready,foreign=false}){invoke(useResourceLink,{workspace:{id:foreign?9:8}},{id:8},{isFetching:!ready,isPlaceholderData:false,isError:false},[{id:20,name:'Sueldo'}],row=>opened.push(row.id));return React.createElement('p',null,'Ingresos fijos');}
const next=createRoot(container);async function resource(ready,foreign=false){await act(async()=>next.render(React.createElement(MemoryRouter,{initialEntries:['/app/recurring-income?resource=20']},React.createElement(ResourceHost,{ready,foreign}))));}
await resource(false);assert.equal(opened.length,0);await resource(true,true);assert.equal(opened.length,0);await resource(true);assert.deepEqual(opened,[20]);await resource(true);assert.deepEqual(opened,[20]);await act(async()=>next.unmount());container.remove();dom.window.close();
console.log('Dashboard navigation: five native sections, lazy advanced calculations, workspace reset/Pro gating, actual recurring-income resource hook with fresh scoped read and one-time opening passed locally.');
