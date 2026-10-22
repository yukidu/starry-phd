import fs from 'node:fs/promises';import {createRequire}from 'node:module';
const require=createRequire(import.meta.url);let ts;
try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const files=['src/App.tsx','src/main.tsx','src/api.ts','src/card.ts','src/media.ts','worker/index.ts','vite.config.ts'];
let bad=0;
for(const file of files){
 const content=await fs.readFile(new URL('../'+file,import.meta.url),'utf8');
 const result=ts.transpileModule(content,{fileName:file,reportDiagnostics:true,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,strict:true,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 const errors=(result.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
 if(errors.length){bad+=errors.length;console.error('INVALID',file,errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText,' ')))}else console.log('PARSE_OK',file)
}
if(bad)process.exit(1);
