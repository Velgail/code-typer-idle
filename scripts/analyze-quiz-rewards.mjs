// Rule measurements, not observed human completion times. Canonical source
// length and submitted answer length are deliberately not reward inputs.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import * as game from '../src/core.js';
import { challengeCatalog } from '../src/challengecatalog.js';
import { skillQuizCatalog } from '../src/skillquiz.js';

const flags=process.argv.slice(2);
if(flags.some(flag=>flag!=='--write'))throw new Error('Usage: node scripts/analyze-quiz-rewards.mjs [--write]');
const clone=value=>structuredClone(value), challenges=challengeCatalog(),syntax=skillQuizCatalog();
function fixture(lab=0,knowledge=0){const s=game.createState(0);s.mode='study';s.studyStyle='skill-quiz';s.subject='syntax';s.typing.language='cpp';s.items.lab=lab;s.skills.syntax=knowledge;game.openOnlineMaterial(s);return s;}
function distribution(values){const sorted=[...values].sort((a,b)=>a-b);return {min:sorted[0],mean:sorted.reduce((a,b)=>a+b,0)/sorted.length,median:sorted[Math.floor(sorted.length/2)],max:sorted.at(-1)};}
function metadata(catalog){return {count:catalog.length,estimatedMinutes:distribution(catalog.map(q=>q.estimatedMinutes)),difficultyCounts:Object.fromEntries([1,2,3,4].map(n=>[n,catalog.filter(q=>q.difficulty===n).length])),languages:[...new Set(catalog.map(q=>q.language))].map(language=>({language,count:catalog.filter(q=>q.language===language).length}))};}
function measure(state,role){
 const s=clone(state);s.studyStyle=role==='skill-quiz'?'skill-quiz':'quiz';
 const q=role==='skill-quiz'?game.skillQuizLesson(s):game.quizLesson(s),before=JSON.stringify(s);
 const preview=role==='skill-quiz'?game.skillQuizRewardPreview(s):game.quizRewardPreview(s);
 assert.equal(JSON.stringify(s),before,'Preview must be pure');
 const reward=role==='skill-quiz'?game.completeSkillQuiz(s,q.id,q.answer):game.completeQuiz(s,q.id);
 for(const key of ['amount','learned','verified','studyUnits','progress'])assert.equal(reward[key],preview[key]);
 const seconds=q.estimatedMinutes*60,power=game.typingPower(state,'study',q.subject),typingUnits=seconds*80*power;
 const typing=clone(state),copied=game.input(typing,{mode:'study',subject:q.subject,chars:typingUnits,manual:true,countManual:false});
 const again=role==='skill-quiz'?game.completeSkillQuiz(s,q.id,q.answer):game.completeQuiz(s,q.id);
 assert.equal(again.studyUnits,0);assert.equal(again.verified,0);
 return {role,id:q.id,concept:q.concept,difficulty:q.difficulty,estimatedMinutes:q.estimatedMinutes,typingPower:power,typingAtEstimatedTime:{workUnits:typingUnits,nominalKnowledge:game.studyGain(state,typingUnits,q.subject),confirmedKnowledge:copied.amount},reward,studyWorkRatio:reward.studyUnits/typingUnits,nominalKnowledgeRatio:reward.learned/game.studyGain(state,typingUnits,q.subject),repeatWithoutResearch:again};
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
const report={schemaVersion:2,balanceVersion:game.BALANCE_VERSION,reproduce:'node scripts/analyze-quiz-rewards.mjs --write',assumptions:{
 roles:'Quiz is constrained syntax completion graded in core. Challenge is open implementation with executable test cases. Learning and implementation are separate outputs; they cannot be added as one utility unit.',
 fixtures:'Actual createState with only the stated lab level directly assigned to isolate equipment effects. Free syntax material opened; no books/monitor/keyboard/experience/assets. Equipment scenarios begin at K500; initial scenarios begin at K0. This is not an equipment affordability route.',
 effort:'80 work units/second is perfect typing at 300 physical keys/min with 12 character + 4 completion units. Reward time comes from authored estimatedMinutes; difficulty is represented by that estimate, not multiplied again.',
 policy:'New Quiz initial study = authored seconds * 80 * 1.5 * study typingPower. Challenge initial study = authored seconds * 80 * 4 * study typingPower; initial implementation = authored seconds * 80 * 2 * dev typingPower. Same-family transfer into another language pays 60%; previously implemented same ID pays 25% on another project.',
 firstProject:'The first fixed project retains its separate three staged implementation components and their canonical-source rewards. Generic Challenge estimated-time policy does not replace those components.',
 verification:'First success also confirms at most three new nominal gains of the existing unverified pool, including the one gain confirmed by input. Known correct answers confirm only available auto-derived gaps and grant no new nominal XP. Topic watermarks prevent repeating the same success without further research.',
 time:'Eight hours is 28800 simulation seconds. No time passes between answers. Reading, thinking, editing, compilation, mistakes and retries are unmeasured. Four times effort is not four times knowledge or hourly earnings.',
 historical:'This schema supersedes earlier 1200-unit/typing-source-length comparisons and old finite 512-Challenge totals. Those figures are not current reward formulas.'
},catalogs:{skillQuiz:metadata(syntax),challenge:metadata(challenges)},initial:{skillQuiz:measure(fixture(),'skill-quiz'),challenge:measure(fixture(),'challenge')},equipment,gapRecovery};
if(flags.includes('--write')){writeFileSync(new URL('../research/quiz-rewards.json',import.meta.url),`${JSON.stringify(report,null,2)}\n`);console.log('Wrote research/quiz-rewards.json');console.table(gapRecovery.map(row=>({lab:row.lab,role:row.role,gap:row.unverifiedBefore,confirmed:row.reconfirmation.verified,repeat:row.repeatedWithoutResearch.verified})));}else console.log(JSON.stringify(report,null,2));
