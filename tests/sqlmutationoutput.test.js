import test from 'node:test';
import assert from 'node:assert/strict';
import {challengeById} from '../src/challengecatalog.js';

const question=slug=>challengeById('challenge/v1/sql/systems/'+slug);

test('mutation fixtures retain complete submitted SQL and collect only database readback',()=>{
 const q=question('atomic-balance-transfer');
 const submitted=q.referenceSource+"\nSELECT 'literal;not a delimiter' AS note, id, coins FROM accounts ORDER BY id; -- trailing comment";
 const h=q.createHarness(submitted),output=h.sqlProgram.filter(s=>s.captureOutput);
 assert.equal(output.length,q.cases.length);
 assert.equal(h.sqlProgram.filter(s=>s.source===submitted).length,q.cases.length);
 assert.ok(h.sqlProgram.filter(s=>s.source===submitted).every(s=>s.captureOutput===false));
 assert.deepEqual(h.expected,q.cases.map(c=>c.expected));
});

test('repeated mutation checks execute the exact same submitted program twice per fixture',()=>{
 const q=question('idempotent-event-registration');
 const submitted=q.referenceSource+'\nSELECT id,payload FROM seen ORDER BY id;';
 const h=q.createHarness(submitted);
 assert.equal(h.sqlProgram.filter(s=>s.source===submitted).length,q.cases.length*2);
 assert.equal(h.sqlProgram.filter(s=>s.captureOutput).length,q.cases.length);
});

test('trigger verification remains after the full submitted trigger definition',()=>{
 const q=question('audit-account-deletion'),h=q.createHarness(q.referenceSource);
 assert.equal(h.sqlProgram[1].source,q.referenceSource);
 assert.match(h.sqlProgram[1].source,/BEGIN INSERT INTO audit[\s\S]*; END;/);
 assert.match(h.sqlProgram[2].source,/DELETE FROM accounts/);
 assert.equal(h.sqlProgram[2].captureOutput,false);
 assert.equal(h.sqlProgram[3].captureOutput,true);
});

test('ordinary SELECT challenges keep the submitted-column-shape check',()=>{
 const q=challengeById('challenge/v1/sql/syntax/available-catalog');
 const source='SELECT id,name,price FROM items ORDER BY id;',h=q.createHarness(source);
 assert.equal(h.sqlProgram,undefined);
 assert.equal(h.sqlChecks.length,q.cases.length);
 assert.ok(h.sqlChecks.every(c=>c.columns===2));
});
