import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import vm from "node:vm";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const app=readFileSync(path.join(root,"src/app.js"),"utf8");
const definitions=vm.runInNewContext(app.slice(0,app.indexOf("const realms="))+";definitions");
const questions=vm.runInNewContext(app.slice(0,app.indexOf("const realms="))+";questions");
test("60 original unique questions and 16 distinct planets",()=>{
 assert.equal(questions.length,60);
 assert.equal(new Set(questions.map(q=>q.t)).size,60);
 assert.equal(definitions.length,16);
 assert.equal(new Set(definitions.map(d=>d[0])).size,16);
});
test("each axis has 15 correctly keyed statements",()=>{
 for(let i=0;i<4;i++)assert.equal(questions.filter(q=>q.d===i).length,15);
 assert.ok(questions.every(q=>q.r===1||q.r===-1));
});
test("all sixteen planet results can be produced",()=>{
 const outcomes=new Set();
 for(let bits=0;bits<16;bits++){
  const values=questions.map(q=>((bits>>q.d)&1)?(q.r>0?5:1):(q.r>0?1:5));
  const scores=[0,0,0,0];
  questions.forEach((q,i)=>scores[q.d]+=(values[i]-3)*q.r);
  outcomes.add(scores.map((s,i)=>s>=0?["E","N","T","J"][i]:["I","S","F","P"][i]).join(""));
 }
 assert.deepEqual([...outcomes].sort(),Array.from(definitions,d=>d[0]).sort());
});
test("answers stay in browser and official status is not overstated",()=>{
 assert.ok(app.includes("localStorage"));
 assert.equal(/fetch\s*\(/.test(app),false);
 assert.ok(readFileSync(path.join(root,"src/index.html"),"utf8").includes('lang="zh-Hant"'));
});
