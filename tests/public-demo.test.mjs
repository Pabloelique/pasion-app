import {test,after} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtempSync,writeFileSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const folder=mkdtempSync(join(tmpdir(),'pasion-public-demo-'));
after(()=>rmSync(folder,{recursive:true,force:true}));
for(const name of ['demo-score','demo-local']){
 const source=readFileSync(new URL(`../lib/${name}.ts`,import.meta.url),'utf8');
 writeFileSync(join(folder,`${name}.cjs`),ts.transpileModule(source.replace('"./demo-score"','"./demo-score.cjs"'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
}
const {demoFixtures,createLocalDemoClient,DEMO_USER}=createRequire(import.meta.url)(join(folder,'demo-local.cjs'));
test('public fixtures use real works and make simulated activity explicit',()=>{
 const data=demoFixtures(new Date('2026-11-01T12:00:00Z'));
 assert.deepEqual(data.tables.band_repertoire.map(row=>row.title),['Amarguras','Soleá, dame la mano']);
 assert.ok(data.tables.band_repertoire.every(row=>row.composer==='Manuel Font de Anta'));
 assert.ok(data.tables.band_events.every(row=>/simulada/i.test(row.description)));
 assert.ok(data.tables.app_notifications.every(row=>row.user_id===DEMO_USER));
 assert.equal(data.tables.march_scores[0].title,'Himno a la alegría - Trompeta');
});
test('demo client rejects every write and unknown RPC; data stays isolated',async()=>{
 const data=demoFixtures();const client=createLocalDemoClient(data);
 const before=JSON.stringify(data);
 for(const action of ['insert','update','upsert','delete']){
  const result=await client.from('board_posts')[action]({content:'must not be written'});
  assert.equal(result.error.code,'DEMO_READ_ONLY');assert.equal(result.data,null);
 }
 assert.equal((await client.rpc('approve_member')).error.code,'DEMO_READ_ONLY');
 assert.deepEqual((await client.from('profiles').select()).data,[]);
 const people=await client.rpc('board_people');people.data[0].display_name='changed';
 assert.equal(JSON.stringify(data),before);
 const other=demoFixtures();assert.notEqual(other.tables.board_posts,data.tables.board_posts);
});
test('only the local educational score can be opened; storage writes are blocked',async()=>{
 const storage=createLocalDemoClient(demoFixtures()).storage.from('march-scores');
 const score=await storage.createSignedUrl('demo/score-a');
 assert.equal(score.error,null);assert.match(decodeURIComponent(score.data.signedUrl),/Himno a la alegría/);
 assert.match(decodeURIComponent(score.data.signedUrl),/Ludwig van Beethoven/);
 assert.equal((await storage.createSignedUrl('private-band-file.pdf')).error.code,'DEMO_READ_ONLY');
 assert.equal((await storage.upload()).error.code,'DEMO_READ_ONLY');
 assert.equal((await storage.remove()).error.code,'DEMO_READ_ONLY');
});
