// Counts authored tasks separately from cross-language implementations and
// numeric variants. Estimated times are design targets, not human measurements.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {skillQuizCatalog,skillQuizById,gradeSkillQuiz,SKILL_QUIZ_LANGUAGES,SKILL_QUIZ_SUBJECTS} from '../src/skillquiz.js';
import {challengeCatalog} from '../src/challengecatalog.js';
import {firstProjectQuizCatalog} from '../src/firstproject.js';
import {BALANCE_VERSION} from '../src/core.js';
const quizzes=skillQuizCatalog(),challenges=challengeCatalog(),first=firstProjectQuizCatalog();
for(const quiz of quizzes){
 assert.equal(quiz.code.split('____').length,2,quiz.id);
 assert.ok(gradeSkillQuiz(quiz,quiz.answer).passed,quiz.id);
 for(const wrong of quiz.incorrect)assert.ok(!gradeSkillQuiz(quiz,wrong).passed,quiz.id+' distractor');
 for(const ref of quiz.prerequisites)assert.ok(skillQuizById(ref),quiz.id+' prerequisite');
}
const rows=SKILL_QUIZ_LANGUAGES.flatMap(language=>SKILL_QUIZ_SUBJECTS.map(subject=>{
 const syntax=quizzes.filter(q=>q.language===language&&q.subject===subject),io=challenges.filter(q=>q.language===language&&q.subject===subject);
 return {language,subject,quizCount:syntax.length,quizByDifficulty:[1,2,3,4].map(difficulty=>syntax.filter(q=>q.difficulty===difficulty).length),challengeCount:io.length,newChallengeCount:io.filter(q=>q.id.startsWith('challenge/')).length,
  challengeByDifficulty:[1,2,3,4].map(difficulty=>io.filter(q=>q.difficulty===difficulty).length)};
}));
const report={schemaVersion:1,balanceVersion:BALANCE_VERSION,reproduce:'node scripts/analyze-learning-catalog.mjs --write',
 interpretation:{quiz:'Constrained blanks with an explicit required technique and full lexical-token answer validation. Not an arbitrary-program compiler.',challenge:'Open implementations tested by real browser language runtimes. Correct alternative algorithms are accepted.',
  counts:'Language-specific questions are counted individually. A shared Challenge family translated into another language is not counted as a new algorithm.',times:'Per-question estimatedMinutes are authored pacing targets. Reading, thinking and retry time have not been measured in a human study.',typing:'The existing 8192 built-in copying prompts are 512 templates with 16 input-data variants; they are not 8192 distinct concepts. Exercism copying courses remain separate.'},
 totals:{quizzes:quizzes.length,challenges:challenges.length,firstProjectChallenges:first.length,newChallenges:challenges.filter(q=>q.id.startsWith('challenge/')).length,
  challengeFamilies:new Set(challenges.map(q=>q.familyId||q.id)).size,executableTestCases:[...challenges,...first].reduce((sum,q)=>sum+q.cases.length,0)},
 coverage:{arrayInput:challenges.filter(q=>q.parameters?.some(p=>p.type==='array')).length,stringInput:challenges.filter(q=>q.parameters?.some(p=>p.type==='string')).length,
  arrayOutput:challenges.filter(q=>q.cases.some(c=>Array.isArray(c.expected))).length,stringOutput:challenges.filter(q=>q.cases.some(c=>typeof c.expected==='string')).length},rows};
if(process.argv.includes('--write')){writeFileSync(new URL('../research/learning-catalog.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.totals));}else console.log(JSON.stringify(report,null,2));
