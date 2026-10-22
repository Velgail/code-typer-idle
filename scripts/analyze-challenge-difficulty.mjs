// Review records describe the reasoning behind a label. They do not turn
// authored reward budgets or compiler execution times into measured solve times.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {challengeCatalog} from '../src/challengecatalog.js';
import {requiredChallengeBookLevel} from '../src/challengeaccess.js';

const flags=process.argv.slice(2);
if(flags.some(flag=>flag!=='--write'))throw Error('Usage: node scripts/analyze-challenge-difficulty.mjs [--write]');
const catalog=challengeCatalog();
const standardFamilies=['binary-search-minimum-capacity','weighted-interval-planning',
 'traveling-courier','key-door-shortest-path','interval-merge-cost','dynamic-range-sums',
 'largest-histogram-rectangle','rectangle-union-area','atomic-transfer-batch',
 'idempotent-stock-requests','optimistic-versioned-save','retry-deadline-policy'];
const reviewed=catalog.filter(q=>q.difficultyRationale);
const representatives=reviewed.filter(q=>q.language==='cpp');
for(const slug of standardFamilies){
 const q=representatives.find(q=>q.topicId===slug);
 assert.ok(q,`Missing reviewed published family: ${slug}`);
 assert.ok(q.difficulty<=3,`A standard reference alone does not warrant an upper-tier label: ${slug}`);
}
for(const slug of ['windowed-pickup-delivery','consumable-gate-route'])assert.ok(representatives.some(q=>q.topicId===slug));
const families=representatives.map(q=>{
 const implementations=reviewed.filter(other=>other.familyId===q.familyId);
 for(const other of implementations)assert.deepEqual(other.difficultyRationale,q.difficultyRationale);
 return {id:q.familyId,title:q.title,subject:q.subject,implementations:implementations.map(other=>({language:other.language,id:other.id,index:other.index})),
  current:{difficulty:q.difficulty,label:q.difficultyLabel,requiredBookLevel:requiredChallengeBookLevel(q),rewardCalibration:q.rewardCalibration},
  rationale:q.difficultyRationale,caseCount:q.cases.length};
});
const report={schemaVersion:2,reproduce:'node scripts/analyze-challenge-difficulty.mjs --write',
 scope:{catalogImplementations:catalog.length,reviewedFamilies:families.length,reviewedImplementations:reviewed.length,implementationsOutsideThisReview:catalog.length-reviewed.length},
 interpretation:{basis:'Required knowledge, valid simpler solutions under the actual constraints, state design, and interactions between conditions.',
  upperTiers:'The name of a standard algorithm, statement length, or large input alone does not establish an upper-tier difficulty.',
  modelEvidence:'Historical exploratory measurements and paired-model trials are withdrawn as current numerical evidence. The original declarations, submissions and decisions remain in the pinned external audit Release referenced by research/audit-evidence.json. Current rewards use research/challenge-calibration.json and are checked against the original corpus by npm run audit:verify. low is the available substitute for instant, not an identical setting.',
  rewardBudget:'Catalog Challenge rewards use frozen family baseWorkUnits, not estimatedMinutes. The new raw-explanation protocol requires a direct observation for every family in its canonical language. It excludes rewritten summaries, summary-length regression, unmeasured-family predictions and implementation-size calibration. Other language implementations share the family work without claiming separate timing. Difficulty controls book access independently.',
  coverage:'This difficulty-label review covers the reclassified and subsequently added families carrying difficultyRationale. It does not establish a new model success rate or human difficulty estimate. The separate raw-explanation protocol covers every catalog family; accepted observations and their reward mapping are recorded in research/challenge-calibration.json.',
  emptyTiers:'A difficulty tier can be empty. Book access rules for a tier do not prove that the tier currently contains tasks.'},
 families};
const output=JSON.stringify(report,null,2)+'\n';
if(flags.includes('--write')){writeFileSync(new URL('../research/challenge-difficulty-review.json',import.meta.url),output);console.log(JSON.stringify(report.scope));}
else console.log(output);
