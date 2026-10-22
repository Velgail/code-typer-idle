// Replay the frozen game work policy and its equipment/conversion effects.
// Player answer length and time are never reward inputs.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import * as game from '../src/core.js';
import { challengeCatalog } from '../src/challengecatalog.js';
import { skillQuizCatalog } from '../src/skillquiz.js';

const flags=process.argv.slice(2);
if(flags.some(flag=>flag!=='--write'))throw new Error('Usage: node scripts/analyze-quiz-rewards.mjs [--write]');
const clone=value=>structuredClone(value), challenges=challengeCatalog(),syntax=skillQuizCatalog();
function fixture(lab=0,knowledge=0){const s=game.createState(0);s.mode='study';s.studyStyle='skill-quiz';s.subject='syntax';s.typing.language='cpp';s.items.lab=lab;s.skills.syntax=knowledge;game.openOnlineMaterial(s);return s;}
function distribution(values){const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return {min:sorted[0],mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,median:sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2,max:sorted.at(-1)};}
const baseWork=q=>q.kind==='challenge'?q.rewardCalibration.baseWorkUnits:q.estimatedMinutes*60*80;
function metadata(catalog){return {count:catalog.length,baseWorkUnits:distribution(catalog.map(baseWork)),initialStudyWorkUnits:distribution(catalog.map(q=>baseWork(q)*(q.kind==='challenge'?game.QUIZ_STUDY_MULTIPLIER:game.SKILL_QUIZ_REWARD_MULTIPLIER))),rewardBasisCounts:catalog.reduce((counts,q)=>{const key=q.rewardCalibration?.basis || 'syntax-quiz-authored-budget';counts[key]=(counts[key] || 0)+1;return counts;},{}),difficultyCounts:Object.fromEntries([1,2,3,4,5,6,7].map(n=>[n,catalog.filter(q=>q.difficulty===n).length])),languages:[...new Set(catalog.map(q=>q.language))].map(language=>({language,count:catalog.filter(q=>q.language===language).length}))};}
function measure(state,role){
 const s=clone(state);s.studyStyle=role==='skill-quiz'?'skill-quiz':'quiz';
 const q=role==='skill-quiz'?game.skillQuizLesson(s):game.quizLesson(s),before=JSON.stringify(s);
 const preview=role==='skill-quiz'?game.skillQuizRewardPreview(s):game.quizRewardPreview(s);
 assert.equal(JSON.stringify(s),before,'Preview must be pure');
 const reward=role==='skill-quiz'?game.completeSkillQuiz(s,q.id,q.answer):game.completeQuiz(s,q.id);
 for(const key of ['amount','learned','verified','studyUnits','progress'])assert.equal(reward[key],preview[key]);
 const power=game.typingPower(state,'study',q.subject),typingUnits=baseWork(q)*power;
 const typing=clone(state),copied=game.input(typing,{mode:'study',subject:q.subject,chars:typingUnits,manual:true,countManual:false});
 const again=role==='skill-quiz'?game.completeSkillQuiz(s,q.id,q.answer):game.completeQuiz(s,q.id);
 assert.equal(again.studyUnits,0);assert.equal(again.verified,0);
 return {role,id:q.id,concept:q.concept,difficulty:q.difficulty,baseWorkUnits:baseWork(q),rewardCalibration:q.rewardCalibration || null,typingPower:power,typingAtSameBaseWork:{workUnits:typingUnits,nominalKnowledge:game.studyGain(state,typingUnits,q.subject),confirmedKnowledge:copied.amount},reward,studyWorkRatio:reward.studyUnits/typingUnits,nominalKnowledgeRatio:reward.learned/game.studyGain(state,typingUnits,q.subject),repeatWithoutResearch:again};
}
const equipment=[0,1,5,20].map(lab=>({lab,labUnitsPerSecond:game.unitRate(fixture(lab),'lab'),initialKnowledge:500,roles:['skill-quiz','challenge'].map(role=>measure(fixture(lab,500),role))}));
const gapRecovery=[1,5,20].flatMap(lab=>['skill-quiz','challenge'].map(role=>{
 const s=fixture(lab,500);s.studyStyle=role==='skill-quiz'?'skill-quiz':'quiz';
 const q=role==='skill-quiz'?game.skillQuizLesson(s):game.quizLesson(s);
 const success=()=>role==='skill-quiz'?game.completeSkillQuiz(s,q.id,q.answer):game.completeQuiz(s,q.id);
 success();game.tick(s,8*3600);
 const nominal=s.skills.syntax,gap=s.studyGaps.syntax,work=s.stats.study,first=success(),second=success();
 assert.equal(s.skills.syntax,nominal,'Known success must not grant another nominal XP reward');
 assert.equal(s.stats.study,work);assert.equal(second.verified,0);
 return {lab,role,elapsedSeconds:28800,elapsedGameDays:28800/game.DAY,nominalKnowledge:nominal,unverifiedBefore:gap,reconfirmation:first,repeatedWithoutResearch:second,remainingGap:s.studyGaps.syntax};
}));
const measuredTopics=['sum-sequence','merge-sorted','atomic-transfer-batch','max-subarray','binary-search-minimum-capacity','rectangle-union-area','traveling-courier','lru-cache','windowed-pickup-delivery','consumable-gate-route','dynamic-parity-component-cost','hamiltonian-floor-cycles'];
const tierRewards=challenges.filter(q=>(q.language==='cpp'&&[...measuredTopics,'coordinate-skill-sequence','clamp_health'].includes(q.topicId)) || (q.language==='sql'&&q.subject==='syntax'&&q.index===0)).map(q=>{
 const state=game.createState(0);state.autoEnabled=false;state.mode='study';state.studyStyle='quiz';state.subject=q.subject;state.typing.language=q.language;
 state.onlineMaterials=[q.subject];state.quiz.cursors[`${q.language}/${q.subject}`]=q.index;
 const access=game.challengeAccess(state,q);state.items[access.bookId]=access.requiredLevel;
 const before=JSON.stringify(state),preview=game.quizRewardPreview(state);
 assert.equal(JSON.stringify(state),before,'Tier reward preview must not mutate the save');
 assert.ok(game.challengeAccess(state,q).available,'The stated book tier opens this reward');
 assert.equal(preview.studyUnits,baseWork(q)*4,'Study work follows the frozen family work, before knowledge conversion');
 return {id:q.id,difficulty:q.difficulty,label:q.difficultyLabel,requiredBookLevel:access.requiredLevel,rewardCalibration:q.rewardCalibration,
  baseWorkUnits:baseWork(q),baseStudyWorkUnits:baseWork(q)*4,baseImplementationWorkUnits:baseWork(q)*2,
  interpretation:'Frozen family work before equipment, transfer/reuse, project capacity, development efficiency and knowledge conversion. Every family uses a new direct raw-explanation observation in its canonical language. Other language implementations share that family work; they are not individually timed. No summary-length predictions or human completion-time estimates are used.',studyPreviewWithRequiredBook:preview};
});
const rewardComparisons={
 byDifficulty:[1,2,3,4,5,6,7].map(difficulty=>{const rows=challenges.filter(q=>q.difficulty===difficulty);return {difficulty,count:rows.length,baseWorkUnits:rows.length?distribution(rows.map(baseWork)):null};}),
 measurementCoverage:{directRawObservedImplementations:challenges.filter(q=>q.rewardCalibration.basis==='direct-raw-explanation-observation').length},
 canonicalCppIntroductoryExamples:challenges.filter(q=>q.language==='cpp'&&q.legacy&&q.index<5).map(q=>({id:q.id,difficulty:q.difficulty,baseWorkUnits:baseWork(q),initialStudyWorkUnits:baseWork(q)*4,initialImplementationWorkUnits:baseWork(q)*2,basis:q.rewardCalibration.basis})),
 interpretation:'These distributions reveal potential reward-selection incentives. Each family has a directly observed canonical-language submission; its other language implementations share the family work. No unmeasured-family interpolation, regression or summary-length estimate is included.'
};
const report={schemaVersion:3,balanceVersion:game.BALANCE_VERSION,reproduce:'node scripts/analyze-quiz-rewards.mjs --write',assumptions:{
 roles:'Quiz is constrained syntax completion graded in core. Challenge is open implementation with executable test cases. Learning and implementation are separate outputs; they cannot be added as one utility unit.',
 fixtures:'Actual createState with only the stated lab level directly assigned to isolate equipment effects. Free syntax material opened; no books/monitor/keyboard/experience/assets. Equipment scenarios begin at K500; initial scenarios begin at K0. This is not an equipment affordability route.',
 effort:'Challenge uses frozen baseWorkUnits from new directly observed, accepted raw public explanations for every family. Original text and mechanical character counts are retained, but neither explanation length nor implementation/source size is a reward input. The observation includes tool and model waiting time; it is not internal reasoning time or human solving time. Authored estimatedMinutes is historical metadata and does not set a catalog Challenge reward. At 300 physical keys/min, perfect copying produces 80 base work units/second, before mode multipliers.',
 policy:'Syntax Quiz retains authored seconds * 80 * 1.5 * study typingPower. Challenge initial study = frozen base work * 4 * study typingPower; initial implementation = frozen base work * 2 * dev typingPower. Same-family transfer into another language pays 60%; previously implemented same ID pays 25% on another project. Difficulty still controls textbook access; it is not an extra reward multiplier.',
 firstProject:'The first fixed project retains its separate three staged implementation components and three equal shares of the free-material study work required for K0 to K12. The generic Challenge calibration does not replace those components.',
 verification:'First success also confirms at most three new nominal gains of the existing unverified pool, including the one gain confirmed by input. Known correct answers confirm only available auto-derived gaps and grant no new nominal XP. Topic watermarks prevent repeating the same success without further research.',
 time:'Eight hours is 28800 simulation seconds. No time passes between answers in this replay. The separate calibration report measures tool-inclusive read-to-public-explanation model wall time, excluding the subsequent code phase; compiler/runtime costs are excluded. This rule replay does not infer human solve time, thinking time or retry time. Four times base work is not four times knowledge or hourly earnings.',
 historical:'This schema supersedes the Challenge authored-minute budgets, including the unsupported 90-minute ultra-tier budget, and earlier 1200-unit/finite-512-Challenge comparisons. Syntax Quiz time budgets remain a separate policy.'
},catalogs:{skillQuiz:metadata(syntax),challenge:metadata(challenges)},rewardComparisons,tierRewards,initial:{skillQuiz:measure(fixture(),'skill-quiz'),challenge:measure(fixture(),'challenge')},equipment,gapRecovery};
if(flags.includes('--write')){writeFileSync(new URL('../research/quiz-rewards.json',import.meta.url),`${JSON.stringify(report,null,2)}\n`);console.log('Wrote research/quiz-rewards.json');console.table(gapRecovery.map(row=>({lab:row.lab,role:row.role,gap:row.unverifiedBefore,confirmed:row.reconfirmation.verified,repeat:row.repeatedWithoutResearch.verified})));}else console.log(JSON.stringify(report,null,2));
