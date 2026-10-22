import test from 'node:test';
import assert from 'node:assert/strict';
import {quizCatalog} from '../src/quizcatalog.js';
import {SQL_CHALLENGES} from '../src/challengesql.js';

const legacy=new Map(quizCatalog().filter(q=>q.language==='sql').map(q=>[q.topicId,q]));
const authored=new Map(SQL_CHALLENGES.map(q=>[q.slug,q]));
const table=(fixture,name)=>{
 const found=fixture.fixtureTables.find(t=>t.name===name);
 assert.ok(found,name);
 return found.rows.map(row=>Object.fromEntries(found.columns.map((column,index)=>[column,row[index]])));
};
const nonnull=(rows,columns,message)=>{
 for(const row of rows)for(const column of columns)assert.notEqual(row[column],null,`${message}: ${column}`);
};
const unique=(rows,column,message)=>assert.equal(new Set(rows.map(row=>row[column])).size,rows.length,message);

test('legacy scalar and window targets publish existence promises satisfied by every fixture',()=>{
 const ids={select_amount:2,case_discount:4,draw_rank:2,running_position:3,neighbor_gap:3,next_position:2,layer_sum:1,screen_transform:1,stable_layer_order:4,partition_average:4,running_maximum:3};
 for(const [topic,id] of Object.entries(ids)){
  const q=legacy.get(topic);
  assert.match(q.description,new RegExp(`id=${id}の行.*必ず存在する`),topic);
  for(const c of q.cases)assert.ok(c.fixtureRows.some(row=>row[0]===id),`${topic}/${c.id}`);
 }
 for(const c of legacy.get('neighbor_gap').cases)assert.ok(c.fixtureRows.some(row=>row[0]<3),c.id);
 for(const c of legacy.get('next_position').cases)assert.ok(c.fixtureRows.some(row=>row[0]>2),c.id);
 for(const [topic,column,value] of [['layer_first',2,2],['first_job',3,1]]){
  const q=legacy.get(topic);
  assert.match(q.description,/行は必ず存在する/,topic);
  for(const c of q.cases)assert.ok(c.fixtureRows.some(row=>row[column]===value),`${topic}/${c.id}`);
 }
 const recursive=legacy.get('recursive_counter');
 assert.match(recursive.description,/quiz_configはcounter_limitを持つ1行の表/);
 for(const [index,c] of recursive.cases.entries()){
  const fixtureSql=recursive.createHarness(recursive.referenceSource).executions[index].fixtureSql;
  assert.match(fixtureSql,/CREATE TABLE quiz_config\(counter_limit INTEGER NOT NULL\)/);
  assert.match(fixtureSql,new RegExp(`INSERT INTO quiz_config VALUES \\(${c.counterLimit}\\)`));
 }
});

test('published join and aggregation keys hold without assuming referential integrity',()=>{
 const playerKeys=['team-population','player-spending','frequent-buyers','teammate-pairs','independent-child-summaries','team-best-spender','team-spending-share'];
 const teamKeys=['membership-roster','team-population','team-best-spender','team-spending-share'];
 for(const [slugs,name] of [[playerKeys,'players'],[teamKeys,'teams']])for(const slug of slugs){
  const q=authored.get(slug);
  assert.match(q.description,/NULLでなく一意/,slug);
  for(const c of q.cases){const rows=table(c,name);nonnull(rows,['id'],slug);unique(rows,'id',slug);}
 }
 for(const c of authored.get('membership-roster').cases)nonnull(table(c,'teams'),['name'],c.id);
 for(const c of authored.get('frequent-buyers').cases)nonnull(table(c,'buys'),['id'],c.id);
 for(const slug of ['player-spending','independent-child-summaries','team-best-spender','team-spending-share']){
  const q=authored.get(slug);
  assert.match(q.description,/buys.amountはNULLでない/,slug);
  for(const c of q.cases)nonnull(table(c,'buys'),['amount'],slug);
 }
 const relationCases=authored.get('player-spending').cases;
 assert.ok(relationCases.some(c=>table(c,'players').some(p=>p.team_id!==null&&!table(c,'teams').some(t=>t.id===p.team_id))));
 assert.ok(relationCases.some(c=>table(c,'buys').some(b=>!table(c,'players').some(p=>p.id===b.player_id))));
 assert.match(authored.get('co-purchased-items').description,/playersに対応行がなくても/);
});

test('ordered windows and tree traversals have the keys and values their public contracts require',()=>{
 for(const q of SQL_CHALLENGES.filter(q=>q.cases[0].fixtureTables.some(t=>t.name==='frames'))){
  assert.match(q.description,/tickはentity内で一意|tickはNULLでなく、entity内で一意/,q.slug);
  for(const c of q.cases){
   const rows=table(c,'frames');nonnull(rows,['tick'],q.slug);
   assert.equal(new Set(rows.map(row=>JSON.stringify([row.entity,row.tick]))).size,rows.length,q.slug);
   if(/tickとxはNULLでなく/.test(q.description))nonnull(rows,['x'],q.slug);
   if(q.slug==='playhead-interpolation'){
    nonnull(rows,['entity','x'],q.slug);nonnull(table(c,'playhead'),['tick'],q.slug);
   }
  }
 }
 for(const [slug,name] of [['running-known-stock','items'],['visible-layer-content','objects'],['tree-paths','nodes'],['tree-depths','nodes'],['descendant-counts','nodes']]){
  const q=authored.get(slug);assert.match(q.description,/idはNULLでなく一意/,slug);
  for(const c of q.cases){const rows=table(c,name);nonnull(rows,['id'],slug);unique(rows,'id',slug);}
 }
 for(const [slug,name] of [['tree-paths','nodes'],['visible-layer-content','objects']]){
  for(const c of authored.get(slug).cases)nonnull(table(c,name),['name'],slug);
 }
 assert.ok(authored.get('state-segment-identifiers').cases.some(c=>table(c,'frames').some(row=>row.label===null)));
});

test('singleton controls, numeric domains and empty audit match their published promises',()=>{
 for(const [slugs,name] of [
  [['visible-command-list','clipped-render-rectangles','origin-cell-density'],'viewport'],
  [['guarded-account-purchase','keep-base-rollback-optional'],'operation'],
  [['remove-expired-cache'],'clock']
 ])for(const slug of slugs){
  const q=authored.get(slug);assert.match(q.description,new RegExp(`${name}は1行`),slug);
  for(const c of q.cases)assert.equal(table(c,name).length,1,slug);
 }
 for(const c of authored.get('stock-status').cases)assert.ok(table(c,'items').every(row=>row.stock===null||row.stock>=0));
 for(const [slug,name,columns] of [
  ['remove-expired-cache','clock',['now']],['retry-failed-jobs','jobs',['attempts']],
  ['deduplicate-cache-revisions','cache',['revision']],['claim-one-pending-job','jobs',['priority']]
 ])for(const c of authored.get(slug).cases)nonnull(table(c,name),columns,slug);
 const audit=authored.get('audit-account-deletion');assert.match(audit.description,/auditは最初は空/);
 for(const c of audit.cases)assert.equal(table(c,'audit').length,0,c.id);
});

test('import keys are non-null while optional payloads, values and cache keys retain NULL coverage',()=>{
 const event=authored.get('idempotent-event-registration');
 assert.match(event.description,/incoming内のidはNULLでなく一意/);
 for(const c of event.cases){const rows=table(c,'incoming');nonnull(rows,['id'],c.id);unique(rows,'id',c.id);}
 const snapshot=authored.get('version-guarded-snapshot-import');
 assert.match(snapshot.description,/snapshotsとincomingのkey,revisionはNULLでない/);
 for(const c of snapshot.cases)for(const name of ['snapshots','incoming'])nonnull(table(c,name),['key','revision'],name);
 assert.ok(event.cases.some(c=>['seen','incoming'].some(name=>table(c,name).some(row=>row.payload===null))));
 assert.ok(snapshot.cases.some(c=>['snapshots','incoming'].some(name=>table(c,name).some(row=>row.value===null))));
 const cache=authored.get('deduplicate-cache-revisions');
 assert.match(cache.description,/NULLのkeyも一つの分類/);
 assert.ok(cache.cases.some(c=>table(c,'cache').some(row=>row.key===null)));
});

test('rectangle geometry explicitly declares the numeric non-null domain used by its fixtures',()=>{
 const q=authored.get('clipped-render-rectangles');
 assert.match(q.description,/objectsのid,x,y,width,height,visibleとviewportの全列はNULLを含まない/);
 for(const c of q.cases){
  const objects=table(c,'objects'),viewport=table(c,'viewport');
  nonnull(objects,['id','x','y','width','height','visible'],c.id);unique(objects,'id',c.id);
  nonnull(viewport,['width','height','camera_x','camera_y'],c.id);
  assert.ok([...objects,...viewport].every(r=>r.width>=0&&r.height>=0));
 }
});
