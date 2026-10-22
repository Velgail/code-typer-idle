import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('fresh declaration covers each actual family and never requests rewritten explanations',()=>{
 const registry=JSON.parse(readFileSync('research/raw-explanation-registry.json','utf8'));
 const primary=registry.trials.filter(t=>t.cohort==='primary'),comparison=registry.trials.filter(t=>t.cohort==='comparison');
 assert.equal(registry.tasks.filter(t=>t.analysisKind==='challenge').length,321);
 assert.equal(primary.length,369);assert.equal(comparison.length,20);
 const tangent=registry.tasks.find(t=>t.sourceId==='control-tan-one-degree');
 assert.doesNotMatch(JSON.stringify(tangent.publicSpec),/加法定理|特殊角|閉性|無理数/);
});
