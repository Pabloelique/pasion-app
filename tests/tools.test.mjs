import {test,after} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const folder=mkdtempSync(join(tmpdir(),'pasion-tools-'));
after(()=>rmSync(folder,{recursive:true,force:true}));
const load=name=>{
 const source=readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');
 writeFileSync(join(folder,`${name}.cjs`),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
 return createRequire(import.meta.url)(join(folder,`${name}.cjs`));
};
const tuning=load('tuning'),holy=load('semana-santa');

test('transposing instruments show the written note of their part',()=>{
 const sib=tuning.TRANSPOSITIONS.find(t=>t.id==='sib').semitones;
 const concertBb=tuning.midiToFrequency(70,442); // Si♭ real
 const r=tuning.readPitch(concertBb,442,sib);
 assert.equal(tuning.noteName(r.writtenMidi).name,'Do');   // la trompeta lee Do
 assert.equal(tuning.noteName(r.concertMidi).name,'Si♭');
 assert.equal(r.cents,0);
 const fa=tuning.TRANSPOSITIONS.find(t=>t.id==='fa').semitones;
 assert.equal(tuning.noteName(tuning.readPitch(concertBb,442,fa).writtenMidi).name,'Fa');
 const sharp=tuning.readPitch(442*Math.pow(2,10/1200),442,0);
 assert.equal(sharp.cents,10);
});

test('band parts map to sensible default instruments',()=>{
 const id=p=>tuning.presetForPart(p).id;
 assert.equal(id('Trompeta 2'),'trompeta');
 assert.equal(id('Corneta 1'),'corneta');
 assert.equal(id('Corneta Do/Reb'),'corneta-do');
 assert.equal(id('Tuba en Si bemol'),'tuba-sib');
 assert.equal(id('Tuba en Do'),'tuba-do');
 assert.equal(id('Trombón de varas'),'trombon');
 assert.equal(id('Tambores'),'concierto');
});

test('pitch detection finds a pure tone within a few cents',()=>{
 const rate=48000,buffer=new Float32Array(4096);
 for(const hz of [116.54,233.08,466.16]){
  for(let i=0;i<buffer.length;i++)buffer[i]=0.5*Math.sin(2*Math.PI*hz*i/rate);
  const found=tuning.detectPitch(buffer,rate);
  assert.ok(Math.abs(1200*Math.log2(found/hz))<5,`${hz} → ${found}`);
 }
 assert.equal(tuning.detectPitch(new Float32Array(4096),rate),-1);
});

test('pitch detection handles brass timbres, low tubas and quiet microphones',()=>{
 const rate=48000,buffer=new Float32Array(4096);
 for(const hz of [41.2,58.27,87.31,174.6,349.2,698.5,932.3]){
  for(const amp of [0.01,0.1,0.6]){
   for(let i=0;i<buffer.length;i++){const x=2*Math.PI*hz*i/rate;buffer[i]=amp*(0.5*Math.sin(x)+0.9*Math.sin(2*x)+0.6*Math.sin(3*x)+0.4*Math.sin(4*x))/2+amp*0.15*(Math.random()*2-1);}
   const found=tuning.detectPitch(buffer,rate);
   assert.ok(found>0&&Math.abs(1200*Math.log2(found/hz))<10,`${hz} Hz a ${amp} → ${found}`);
  }
 }
 for(let i=0;i<buffer.length;i++)buffer[i]=0.05*(Math.random()*2-1);
 assert.equal(tuning.detectPitch(buffer,rate),-1);
});

test('Semana Santa dates and countdown',()=>{
 assert.deepEqual(holy.easterSunday(2027),{year:2027,month:3,day:28});
 assert.deepEqual(holy.easterSunday(2028),{year:2028,month:4,day:16});
 const before=holy.semanaSantaCountdown(new Date('2026-11-06T10:00:00Z'));
 assert.equal(before.state,'before');
 assert.equal(before.dolores.toISOString(),'2027-03-18T23:00:00.000Z'); // 19/03/2027 00:00 Madrid
 assert.equal(before.ramos.toISOString(),'2027-03-20T23:00:00.000Z');
 assert.equal(holy.semanaSantaCountdown(new Date('2027-03-26T12:00:00Z')).state,'during');
 assert.equal(holy.semanaSantaCountdown(new Date('2027-04-05T12:00:00Z')).year,2028);
});

test('social handles accept @user, plain user or full profile links',()=>{
 const p=load('profile-utils');
 assert.equal(p.cleanHandle('instagram','@la.pasion_mzr'),'la.pasion_mzr');
 assert.equal(p.cleanHandle('instagram','https://www.instagram.com/lapasion/?hl=es'),'lapasion');
 assert.equal(p.cleanHandle('tiktok','https://www.tiktok.com/@banda.pasion'),'banda.pasion');
 assert.equal(p.cleanHandle('facebook','facebook.com/agrupacion.pasion'),'agrupacion.pasion');
 assert.equal(p.cleanHandle('instagram',''),'');
 assert.equal(p.cleanHandle('instagram','con espacios'),null);
 assert.equal(p.cleanHandle('instagram','https://evil.com/usuario'),null);
 assert.equal(p.initials('pablo','jiménez'),'PJ');
 assert.equal(p.socialUrl('tiktok','x.y'),'https://www.tiktok.com/@x.y');
});
