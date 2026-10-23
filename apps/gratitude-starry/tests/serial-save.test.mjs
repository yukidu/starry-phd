import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const source=await fs.readFile(new URL('../src/serialSave.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {createSerialSaver}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('Rapid edits of same slot are serialized, with newest content saved last',async()=>{
  const calls=[];
  let releaseOld;
  const oldBlocked=new Promise(resolve=>{releaseOld=resolve});
  const saver=createSerialSaver(async(day,slot,text)=>{
    calls.push({day,slot,text});
    if(text==='old')await oldBlocked;
  });
  const first=saver.queue('2026-10-23',1,'old');
  const second=saver.queue('2026-10-23',1,'new');
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls.map(c=>c.text),['old']);
  releaseOld();
  await Promise.all([first,second,saver.waitAll()]);
  assert.deepEqual(calls.map(c=>c.text),['old','new']);
});

test('Independent days and slots do not block each other',async()=>{
  const seen=[];
  const saver=createSerialSaver(async(day,slot,text)=>{seen.push(day+'/'+slot+':'+text)});
  await Promise.all([saver.queue('2026-10-22',1,'A'),saver.queue('2026-10-23',1,'B'),saver.queue('2026-10-23',2,'C')]);
  assert.deepEqual(seen.sort(),['2026-10-22/1:A','2026-10-23/1:B','2026-10-23/2:C']);
});

test('A failed older save cannot permanently block a newer edit',async()=>{
  const seen=[];
  const saver=createSerialSaver(async(day,slot,text)=>{
    seen.push(text);
    if(text==='fail')throw Error('network');
  });
  const first=saver.queue('2026-10-23',1,'fail');
  const second=saver.queue('2026-10-23',1,'recovered');
  await assert.rejects(first,/network/);
  await second;
  assert.deepEqual(seen,['fail','recovered']);
});

test('waitAll reports pending failed saves instead of silently discarding them',async()=>{
  let rejectSave;
  const blocked=new Promise((_,reject)=>{rejectSave=reject});
  const saver=createSerialSaver(()=>blocked);
  const pending=saver.queue('2026-10-23',1,'important');
  const drained=saver.waitAll();
  rejectSave(Error('not saved'));
  await assert.rejects(pending,/not saved/);
  await assert.rejects(drained,/not saved/);
});
