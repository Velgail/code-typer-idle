import test from 'node:test';
import assert from 'node:assert/strict';
import {skillQuizCatalog,skillQuizTopics,skillQuizById,gradeSkillQuiz,skillQuizTokens,SKILL_QUIZ_LANGUAGES,SKILL_QUIZ_SUBJECTS} from '../src/skillquiz.js';

test('syntax quizzes have distinct objectives, ordered difficulty and valid prerequisite references',()=>{
 const catalog=skillQuizCatalog();assert.equal(catalog.length,1024);assert.equal(new Set(catalog.map(q=>q.id)).size,catalog.length);
 for(const language of SKILL_QUIZ_LANGUAGES)for(const subject of SKILL_QUIZ_SUBJECTS){
  const pool=skillQuizTopics(language,subject);assert.equal(pool.length,32,`${language}/${subject}`);
  for(let difficulty=1;difficulty<=4;difficulty++)assert.equal(pool.filter(q=>q.difficulty===difficulty).length,8);
  assert.deepEqual(pool.map(q=>q.difficulty),pool.map(q=>q.difficulty).sort());
 }
 for(const q of catalog){
  assert.equal(q.code.split('____').length,2,q.id);assert.ok(q.title&&q.prompt&&q.explanation&&q.concept,q.id);
  assert.ok(q.estimatedMinutes>0&&q.estimatedMinutes<=30,q.id);assert.ok(q.incorrect.length>=2,q.id);
  for(const ref of q.prerequisites){const prior=skillQuizById(ref);assert.ok(prior,`${q.id} prerequisite ${ref}`);assert.equal(prior.language,q.language);assert.notEqual(prior.id,q.id);}
 }
});
test('every canonical answer and accepted alternative passes; distractors and keyword comments fail',()=>{
 for(const q of skillQuizCatalog()){
  for(const answer of [q.answer,...(q.alternatives||[])])assert.equal(gradeSkillQuiz(q,answer).passed,true,`${q.id}: ${answer}`);
  for(const answer of q.incorrect)assert.equal(gradeSkillQuiz(q,answer).passed,false,`${q.id}: ${answer}`);
  assert.equal(gradeSkillQuiz(q,'').passed,false,q.id);
  const comment=q.language==='python'?'#':q.language==='lua'||q.language==='sql'?'--':'//';
  assert.equal(gradeSkillQuiz(q,`${comment} ${q.answer}`).passed,false,q.id);
 }
});
test('token comparison permits formatting and keeps identifiers and string values intact',()=>{
 const quiz={language:'cpp',answer:'std::move(source)',code:'____'};
 assert.equal(gradeSkillQuiz(quiz,' std :: move ( source ) ').passed,true);
 assert.equal(gradeSkillQuiz(quiz,'st d::move(source)').passed,false);
 assert.equal(gradeSkillQuiz(quiz,'std::move(source); return value;').passed,false);
 assert.deepEqual(skillQuizTokens("'a",'rust'),["'a"]);
 assert.deepEqual(skillQuizTokens("'a'",'rust'),["'a'"]);
 const sql={language:'sql',answer:"COALESCE(name, 'Guest User')",code:'____'};
 assert.equal(gradeSkillQuiz(sql,"coalesce ( name , 'Guest User' )").passed,true);
 assert.equal(gradeSkillQuiz(sql,"COALESCE(name, 'guest user')").passed,false);
 assert.equal(gradeSkillQuiz(sql,"COALESCE(name, 'GuestUser')").passed,false);
});
