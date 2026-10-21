// Review records describe the reasoning behind a label. They do not turn
// authored reward budgets or compiler execution times into measured solve times.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {challengeCatalog} from '../src/challengecatalog.js';
import {requiredChallengeBookLevel} from '../src/challengeaccess.js';

const flags=process.argv.slice(2);
if(flags.some(flag=>flag!=='--write'))throw Error('Usage: node scripts/analyze-challenge-difficulty.mjs [--write]');
const catalog=challengeCatalog();
const previous={
 'binary-search-minimum-capacity':[5,25], 'weighted-interval-planning':[5,35],
 'traveling-courier':[6,55], 'key-door-shortest-path':[6,50],
 'interval-merge-cost':[5,35], 'dynamic-range-sums':[4,15],
 'largest-histogram-rectangle':[5,30], 'rectangle-union-area':[6,45],
 'atomic-transfer-batch':[4,18], 'idempotent-stock-requests':[4,20],
 'optimistic-versioned-save':[4,18], 'retry-deadline-policy':[4,22]
};
const reviewed=catalog.filter(q=>q.difficultyRationale);
const representatives=reviewed.filter(q=>q.language==='cpp');
for(const slug of Object.keys(previous)){
 const q=representatives.find(q=>q.topicId===slug);
 assert.ok(q,`Missing reviewed published family: ${slug}`);
 assert.ok(q.difficulty<=3,`A standard reference alone does not warrant an upper-tier label: ${slug}`);
}
for(const slug of ['windowed-pickup-delivery','consumable-gate-route'])assert.ok(representatives.some(q=>q.topicId===slug));
const families=representatives.map(q=>{
 const implementations=reviewed.filter(other=>other.familyId===q.familyId);
 for(const other of implementations)assert.deepEqual(other.difficultyRationale,q.difficultyRationale);
 const old=previous[q.topicId];
 return {id:q.familyId,title:q.title,subject:q.subject,implementations:implementations.map(other=>({language:other.language,id:other.id,index:other.index})),
  previous:old?{revision:'159da4a593b5fb2922d7dc4ca0365efc427f12cc',difficulty:old[0],rewardBudgetMinutes:old[1]}:null,
  current:{difficulty:q.difficulty,label:q.difficultyLabel,requiredBookLevel:requiredChallengeBookLevel(q),rewardBudgetMinutes:q.estimatedMinutes},
  rationale:q.difficultyRationale,caseCount:q.cases.length};
});
const report={schemaVersion:1,reproduce:'node scripts/analyze-challenge-difficulty.mjs --write',
 scope:{catalogImplementations:catalog.length,reviewedFamilies:families.length,reviewedImplementations:reviewed.length,implementationsOutsideThisReview:catalog.length-reviewed.length},
 interpretation:{basis:'Required knowledge, valid simpler solutions under the actual constraints, state design, and interactions between conditions.',
  upperTiers:'The name of a standard algorithm, statement length, or large input alone does not establish an upper-tier difficulty.',
  modelEvidence:'research/model-difficulty-evaluation.json records exploratory gpt-6-luna/low trials; instant is not selectable in this environment.',
  rewardBudget:'estimatedMinutes is a provisional game pacing budget. It is not a conversion from model seconds or an observed human solve time.',
  coverage:'This review covers the twelve reclassified families and two new compound families. Other catalog entries are not newly calibrated by this report.',
  emptyTiers:'A difficulty tier can be empty. Book access rules for a tier do not prove that the tier currently contains tasks.'},
 families};
const output=JSON.stringify(report,null,2)+'\n';
if(flags.includes('--write')){writeFileSync(new URL('../research/challenge-difficulty-review.json',import.meta.url),output);console.log(JSON.stringify(report.scope));}
else console.log(output);
