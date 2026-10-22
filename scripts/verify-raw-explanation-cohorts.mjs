import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {additionalRawPlan} from './prepare-additional-raw-explanations.mjs';
import {loadRawCohorts} from './raw-explanation-cohorts.mjs';
const json=value=>JSON.stringify(value,null,2)+'\n',read=path=>JSON.parse(readFileSync(path,'utf8'));
const set=loadRawCohorts();
for(const cohort of set.cohorts.slice(1)){
 const protocol=read(cohort.protocol),beforeRegistries=protocol.originalCohorts.map(o=>read(o.registry));
 const tasks=new Map(beforeRegistries.flatMap(r=>r.tasks.map(t=>[t.id,t]))),trials=beforeRegistries.flatMap(r=>r.trials);
 const prior={registry:{...set.registry,tasks:[...tasks.values()],trials},cohorts:set.cohorts.filter(c=>protocol.originalCohorts.some(o=>o.experimentId===c.experimentId))};
 const own=read(cohort.registry),revisedPublicSpecOverrides=Object.fromEntries((own.revisions??[]).map(v=>[v.previousTaskId,own.tasks.find(t=>t.id===v.activeTaskId).publicSpec]));
 const result=additionalRawPlan({cohort:protocol.cohort,selection:read(cohort.selection),seed:protocol.randomSeed,declaredAt:protocol.declaredAt,prior,revisedPublicSpecOverrides});
 assert.equal(readFileSync(cohort.protocol,'utf8'),json(result.protocol),'Additional protocol does not reproduce');
 assert.equal(readFileSync(cohort.registry,'utf8'),json(result.registry),'Additional registry does not reproduce');
}
console.log(JSON.stringify({cohorts:set.cohorts.length,tasks:set.registry.tasks.length,trials:set.registry.trials.length,verified:true}));
