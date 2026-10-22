import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let ts;try{ts=require('typescript')}catch{ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const source=await fs.readFile(new URL('../worker/index.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {inspectVideo}=await import('data:text/javascript;base64,'+Buffer.from(compiled+'\nexport {inspectVideo};').toString('base64'));
function be(n,len){let v=BigInt(n),b=Buffer.alloc(len);for(let i=len-1;i>=0;i--){b[i]=Number(v&255n);v>>=8n;}return b}
function atom(name,...parts){const payload=Buffer.concat(parts);return Buffer.concat([be(payload.length+8,4),Buffer.from(name,'ascii'),payload])}
function mp4(w,h,sec){
 const mvhd=Buffer.alloc(28);mvhd.writeUInt32BE(1000,12);mvhd.writeUInt32BE(sec*1000,16);
 const tkhd=Buffer.alloc(84);tkhd.writeUInt32BE(w*65536,76);tkhd.writeUInt32BE(h*65536,80);
 const hdlr=Buffer.alloc(13);hdlr.write('vide',8,'ascii');
 return Buffer.concat([atom('ftyp',Buffer.from('isom0000')),atom('free'),atom('moov',atom('mvhd',mvhd),atom('trak',atom('tkhd',tkhd),atom('mdia',atom('hdlr',hdlr)))),atom('mdat',Buffer.from([0,0,0,0]))]);
}
function element(id,...parts){const payload=Buffer.concat(parts);if(payload.length>16383)throw Error('test too large');const size=payload.length<127?Buffer.from([0x80|payload.length]):Buffer.from([0x40|payload.length>>8,payload.length&255]);return Buffer.concat([be(id,id>0xffffff?4:id>0xffff?3:id>0xff?2:1),size,payload]);}
function webm(w,h,sec){
 const e=element;
 const time=Buffer.alloc(8);time.writeDoubleBE(sec*1000);
 return Buffer.concat([e(0x1a45dfa3,e(0x4286,Buffer.from([1]))),e(0x18538067,
   e(0x1549a966,e(0x2ad7b1,be(1000000,3)),e(0x4489,time)),
   e(0x1654ae6b,e(0xae,e(0x83,Buffer.from([1])),e(0xe0,e(0xb0,be(w,2)),e(0xba,be(h,2))))))]);
}
test('MP4 inspection uses encoded track metadata, not request headers',()=>{
 assert.deepEqual(inspectVideo(mp4(640,360,2),'video/mp4'),{width:640,height:360,duration:2});
 assert.deepEqual(inspectVideo(mp4(1920,1080,31),'video/mp4'),{width:1920,height:1080,duration:31});
 assert.equal(inspectVideo(mp4(640,360,2).subarray(0,33),'video/mp4'),null);
});
test('WebM inspection reads pixel dimensions and duration from EBML',()=>{
 assert.deepEqual(inspectVideo(webm(640,360,2),'video/webm'),{width:640,height:360,duration:2});
 assert.deepEqual(inspectVideo(webm(1920,1080,31),'video/webm'),{width:1920,height:1080,duration:31});
 assert.equal(inspectVideo(Buffer.from([0x1a,0x45,0xdf,0xa3,0,0]),'video/webm'),null);
});
test('Unknown-size live WebM metadata parses safely without unsafe integers',()=>{
 const clip=webm(640,360,2);
 const idx=clip.indexOf(Buffer.from([0x18,0x53,0x80,0x67]));
 assert.ok(idx>=0);
 const segmentPayload=clip.subarray(idx+5);
 const live=Buffer.concat([clip.subarray(0,idx+4),Buffer.from([0x01,0xff,0xff,0xff,0xff,0xff,0xff,0xff]),segmentPayload]);
 assert.deepEqual(inspectVideo(live,'video/webm'),{width:640,height:360,duration:2});
});
test('Untrusted client metadata does not bypass server video verification',()=>{
 assert.match(source,/const examined=inspectVideo\(bytes,mime\)/);
 assert.match(source,/examined\.width!==width\|\|examined\.height!==height/);
 assert.match(source,/examined\.duration>policy\.seconds\+0\.25/);
});