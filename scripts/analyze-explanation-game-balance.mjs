// Replay only the new direct-observation reward table and actual game APIs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import * as game from '../src/core.js';
import {challengeCatalog} from '../src/challengecatalog.js';
import {skillQuizCatalog} from '../src/skillquiz.js';
import {FIRST_PROJECT_LANGUAGES,FIRST_PROJECT_PARTS} from '../src/firstproject.js';
import {curricularAnchor,loadChallengeCalibration,validateLiveCalibration,CALIBRATION_PATH} from './challenge-calibration.mjs';
import {distribution,rawSha} from './analyze-raw-explanations.mjs';
const flags=process.argv.slice(2);assert.ok(flags.every(f=>f==='--write'));
const read=name=>JSON.parse(readFileSync(new URL('../research/'+name,import.meta.url),'utf8'));
const frozen=loadChallengeCalibration(),derived=validateLiveCalibration(frozen),scale=curricularAnchor();
assert.equal(frozen.commonWorkAnchor,scale.commonWorkAnchor);
const challenges=challengeCatalog(),syntax=skillQuizCatalog();
function student(q){const s=game.createState(0);s.autoEnabled=false;s.mode='study';s.studyStyle=q.kind==='challenge'?'quiz':'skill-quiz';s.subject=q.subject;s.typing.language=q.language;game.openOnlineMaterial(s,q.subject);if(q.kind==='challenge')s.items[`book-${q.subject}`]=game.challengeAccess(s,q).requiredLevel;return s;}
const byFamily=new Map(derived.families.map(r=>[r.familyId,r]));
for(const q of challenges){assert.equal(q.rewardCalibration.baseWorkUnits,byFamily.get(q.familyId).baseWorkUnits);assert.equal(q.rewardCalibration.basis,'direct-raw-explanation-observation');}
const syntaxStudy=syntax.map(q=>game.skillQuizRewardPreview(student(q),q).studyUnits);
const defaultSyntax=syntax.find(q=>q.id==='skill-quiz/v1/cpp/syntax/value-init');
const defaultChallenge=challenges.find(q=>q.id==='quiz/v1/cpp/syntax/clamp_health');
const syntaxDefault=game.skillQuizRewardPreview(student(defaultSyntax),defaultSyntax);
function example(q){const preview=game.quizRewardPreview(student(q),q),r=byFamily.get(q.familyId);return {id:q.id,familyId:q.familyId,difficulty:q.difficulty,basis:r.basis,measuredCanonicalLanguage:r.canonicalLanguage,baseWorkUnits:r.baseWorkUnits,studyWorkUnits:preview.studyUnits,knowledgeGainAtFreshSubject:preview.learned,baseImplementationWorkUnits:r.baseWorkUnits*game.QUIZ_IMPLEMENTATION_MULTIPLIER};}
const names=['legacy/syntax/clamp_health','io/sum-sequence','io/traveling-courier','io/dynamic-parity-component-cost','io/hamiltonian-floor-cycles'];
const examples=names.map(f=>challenges.find(q=>q.familyId===f&&q.language==='cpp')).filter(Boolean).map(example);
const challengeDefault=example(defaultChallenge),challengeStudy=challenges.map(q=>byFamily.get(q.familyId).baseWorkUnits*game.QUIZ_STUDY_MULTIPLIER);
const tutorial=FIRST_PROJECT_LANGUAGES.map(language=>{
 const s=game.createState(0);game.openOnlineMaterial(s,'syntax');s.autoEnabled=false;s.mode='dev';s.devStyle='quiz';s.subject='syntax';s.typing.language=language;
 const steps=FIRST_PROJECT_PARTS.map(part=>{const q=game.quizLesson(s),reward=game.completeQuiz(s,q.id);assert.equal(reward.progress,1000);assert.equal(s.progress,part.end);assert.ok(game.skillKnowledge(s,'syntax')>=4*(part.index+1));return {partId:q.id,studyWorkUnits:reward.studyUnits,knowledge:game.skillKnowledge(s,'syntax'),progress:s.progress};});
 assert.equal(s.cash,100);assert.equal(s.progress,3000);return {language,initialCash:100,finalCash:s.cash,steps};
});
const career=read('quiz-career.json'),reward=read('quiz-rewards.json');
assert.equal(career.balanceVersion,game.BALANCE_VERSION);assert.equal(reward.balanceVersion,game.BALANCE_VERSION);
assert.equal(reward.initial.challenge.reward.studyUnits,challengeDefault.studyWorkUnits);
const finiteBanks=career.careers.map(c=>({scenario:c.scenario.id,snapshots:c.snapshots.filter(s=>s.banks).map(s=>({stage:s.key,banks:s.banks.map(b=>({language:b.language,newLearning:b.newLearning,availableQuestions:b.availableQuestions,implementationQuestions:b.implementationQuestions,reviewQuestions:b.reviewQuestions,progressPercent:b.progressPercent,completeAndClean:b.completeAndClean,releaseAcceptedByCore:b.releaseAcceptedByCore}))}))}));
const report={schemaVersion:2,balanceVersion:game.BALANCE_VERSION,experimentId:frozen.experimentId,reproduce:'node scripts/analyze-explanation-game-balance.mjs --write',rewardTableSource:CALIBRATION_PATH,rewardTableSha256:rawSha(readFileSync(CALIBRATION_PATH)),
 policy:{relativeEffort:'New accepted original-answer exposition time only; no previous times, summaries, code-size proxy or missing-family prediction.',absoluteScale:scale.anchorPolicy,humanTime:'Observed exposition time includes model service and tools; it is not human solving time.'},
 syntaxQuiz:{count:syntax.length,initialStudyWorkUnits:distribution(syntaxStudy),default:{id:defaultSyntax.id,studyWorkUnits:syntaxDefault.studyUnits,knowledgeGainAtFreshSubject:syntaxDefault.learned}},
 finalScale:{commonWorkAnchor:scale.commonWorkAnchor,initialStudyWorkUnits:distribution(challengeStudy),examples,defaultChallengeToDefaultSyntaxStudyRatio:challengeDefault.studyWorkUnits/syntaxDefault.studyUnits,maximumChallengeToMaximumSyntaxStudyRatio:Math.max(...challengeStudy)/Math.max(...syntaxStudy)},
 tutorial:{policy:'Actual separate three-component tutorial replay; no generic Challenge can finish every implementation component at once.',routes:tutorial},
 finiteBankExperiment:{source:'research/quiz-career.json',meaning:'Counterfactual work capacity at actual career snapshots, assuming all answers instantly correct. No claim of human Challenge career completion time.',results:finiteBanks},
 limitations:['The common absolute scale is game policy, not a measured difficulty truth.','Syntax Quiz budgets remain authored game rules and were not validated as human effort.','Most families have one direct primary observation, so no repeat variance estimate exists for them.','A shared family price is based on its canonical language, not a timing study of every port.','All original failures, reviews and selection decisions remain in the external audit archive; the compact input retains accepted-clock trial identities.']};
const serialized=JSON.stringify(report,(_key,n)=>typeof n==='number'&&Number.isFinite(n)&&!Number.isInteger(n)?Number(n.toPrecision(12)):n,2)+'\n';
if(flags.includes('--write')){writeFileSync(new URL('../research/explanation-game-balance.json',import.meta.url),serialized);console.log(JSON.stringify({output:'research/explanation-game-balance.json',families:derived.families.length,defaultRatio:report.finalScale.defaultChallengeToDefaultSyntaxStudyRatio}));}else process.stdout.write(serialized);
