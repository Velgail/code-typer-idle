import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createState, SKILLS, BALANCE_VERSION, openOnlineMaterial, hasStudyMaterial,
  hasTextbook, studyMultiplier, studyGain, studyPreview, input, handPower,
  typingPower, autoStudySubject, tick, skillKnowledge, answerReading,
  readingLesson, nextReading, READING_UNITS, buy, serialize, deserialize,
  applyOffline, prestige
} from '../src/core.js';
import {acceptCharacter, currentPrompt} from '../src/typing.js';

const near=(a,b)=>assert.ok(Math.abs(a-b)<=Math.max(1,Math.abs(a),Math.abs(b))*1e-10,`${a} != ${b}`);
const snapshot=s=>JSON.stringify(s);

test('opening an online subject is free and changes only access and its first log entry',()=>{
  const s=createState(0);assert.deepEqual(s.onlineMaterials,[]);
  for(const {id,name} of SKILLS){
    const before=structuredClone(s);assert.equal(openOnlineMaterial(s,id),true);
    assert.ok(s.onlineMaterials.includes(id));assert.equal(hasStudyMaterial(s,id),true);assert.equal(hasTextbook(s,id),false);
    assert.equal(s.log.length,before.log.length+1);assert.match(s.log.at(-1).text,new RegExp(name));
    const {onlineMaterials:opened,log:messages,...afterRest}=s;
    const {onlineMaterials:previous,log:oldMessages,...beforeRest}=before;
    assert.deepEqual(afterRest,beforeRest,'opening must not award cash, knowledge, manual input, or learning credit');
  }
  const selected=createState(0);selected.subject='graphics';assert.equal(openOnlineMaterial(selected),true);
  assert.deepEqual(selected.onlineMaterials,['graphics']);
});

test('reopening a material and requesting unknown subjects have no effects',()=>{
  const s=createState(0);openOnlineMaterial(s,'syntax');const before=snapshot(s);
  assert.equal(openOnlineMaterial(s,'syntax'),false);assert.equal(snapshot(s),before);
  for(const invalid of ['',null,0,{},['design'],'__proto__','constructor','Syntax','unknown']){
    assert.equal(openOnlineMaterial(s,invalid),false);assert.equal(snapshot(s),before);
  }
  assert.equal(hasStudyMaterial(s,'design'),false);assert.equal(hasTextbook(s,'syntax'),false);
});

test('online materials provide the base multiplier while textbooks retain their additive paid benefit',()=>{
  for(const {id} of SKILLS){
    const free=createState(0),paid=createState(0);free.subject=id;paid.subject=id;
    free.items.monitor=4;assert.equal(studyMultiplier(free),0,'equipment alone cannot substitute for material');
    assert.equal(openOnlineMaterial(free),true);assert.equal(studyMultiplier(free),2);
    free.items.monitor=0;paid.items[`book-${id}`]=1;
    assert.equal(studyMultiplier(free),1);assert.equal(studyMultiplier(paid),2);
    near(studyGain(free,200),studyGain(paid,100));
    assert.equal(openOnlineMaterial(paid),true);assert.equal(studyMultiplier(paid),2,'free and paid access do not multiply each other');
    paid.items[`book-${id}`]=2;assert.equal(studyMultiplier(paid),3);
    assert.equal(hasTextbook(free),false);assert.equal(hasTextbook(paid),true);
  }
  const s=createState(0);openOnlineMaterial(s);s.cash=1500;
  assert.equal(buy(s,'book-syntax'),true);assert.equal(s.cash,0);assert.equal(studyMultiplier(s),2);
  assert.deepEqual(s.onlineMaterials,['syntax'],'buying the book must not remove an opened online resource');
});

test('manual learning requires material for that subject and works with online access without a book',()=>{
  for(const {id} of SKILLS){
    const s=createState(0);s.mode='study';s.subject=id;
    assert.equal(input(s,{chars:1000}).kind,'textbook');assert.equal(s.stats.study,0);
    openOnlineMaterial(s);const expected=studyGain(s,1000),result=input(s,{chars:1000});
    assert.equal(result.kind,'study');near(result.amount,expected);near(skillKnowledge(s,id),expected);
    assert.equal(s.stats.study,1000);assert.equal(s.stats.manual,1);assert.equal(s.studyGaps[id],0);
    assert.equal(hasTextbook(s),false);assert.deepEqual(s.items,{});
    for(const other of SKILLS.filter(skill=>skill.id!==id)){
      assert.equal(hasStudyMaterial(s,other.id),false);assert.equal(s.skills[other.id],0);
      assert.equal(input(s,{subject:other.id,chars:1000}).kind,'textbook');
    }
  }
});

test('reading with free material keeps finite first-answer credit and the paid book still doubles study input',()=>{
  const free=createState(0),paid=createState(0);paid.items['book-syntax']=1;
  const first=readingLesson(free);
  assert.equal(answerReading(free,first.answer).kind,'textbook');assert.deepEqual(free.reading.answers,{});
  openOnlineMaterial(free);
  const freeResult=answerReading(free,first.answer),paidResult=answerReading(paid,first.answer);
  assert.equal(freeResult.kind,'correct');assert.ok(freeResult.amount>0);near(paidResult.amount,2*freeResult.amount);
  assert.equal(free.stats.study,READING_UNITS);assert.equal(free.stats.manual,0);assert.equal(free.studyGaps.syntax,0);
  const earned=free.skills.syntax;assert.equal(answerReading(free,first.answer).kind,'answered');assert.equal(free.skills.syntax,earned);
  for(let index=1;index<16;index++){nextReading(free);assert.equal(answerReading(free,readingLesson(free).answer).kind,'correct');}
  nextReading(free);assert.equal(answerReading(free,readingLesson(free).answer).kind,'answered');
  assert.equal(free.stats.study,READING_UNITS*16);
  free.subject='design';assert.equal(answerReading(free,readingLesson(free).answer).kind,'textbook');
});

test('labs use opened free subjects, retain unverified knowledge, and pause when the missing subjects have no material',()=>{
  const s=createState(0);s.projectIndex=1;s.mode='study';s.subject='design';s.items.lab=1;s.skills.syntax=24;
  assert.equal(autoStudySubject(s),null);assert.equal(typingPower(s),handPower(s));
  openOnlineMaterial(s);assert.equal(autoStudySubject(s),'design');assert.ok(typingPower(s)>handPower(s));
  const assisted=typingPower(s);s.autoEnabled=false;assert.equal(typingPower(s),assisted);
  tick(s,10);assert.ok(s.skills.design>0);near(s.studyGaps.design,s.skills.design*.25);
  assert.equal(s.skills.graphics,0);assert.equal(s.stats.manual,0);assert.equal(hasTextbook(s,'design'),false);
  assert.equal(typingPower(s,'study','syntax'),handPower(s),'knowing a subject does not replace its learning materials');
  s.skills.design=8;s.studyGaps.design=0;
  assert.equal(autoStudySubject(s),null);const before=snapshot(s.skills);tick(s,10);assert.equal(snapshot(s.skills),before);
  openOnlineMaterial(s,'graphics');assert.equal(autoStudySubject(s),'graphics');tick(s,10);assert.ok(s.skills.graphics>0);
});

test('free manual learning and finite reading can confirm the gaps left by automated learning',()=>{
  const s=createState(0);s.mode='study';openOnlineMaterial(s);
  input(s,{chars:10000,manual:false,automation:true});assert.ok(s.studyGaps.syntax>0);
  const gap=s.studyGaps.syntax,gain=studyGain(s,100),preview=studyPreview(s,100),manual=input(s,{chars:100});
  near(manual.verified,Math.min(gap,gain));near(manual.amount,preview);assert.ok(s.studyGaps.syntax<gap);
  const before=s.studyGaps.syntax,readingGain=studyGain(s,READING_UNITS),reading=answerReading(s,readingLesson(s).answer);
  assert.equal(reading.kind,'correct');near(reading.amount,readingGain+Math.min(before,readingGain));
  near(s.studyGaps.syntax,Math.max(0,before-readingGain));assert.equal(hasTextbook(s),false);
});

test('online access, unverified gaps, and a partially typed lesson survive a portable save and offline study',()=>{
  const s=createState(0);s.mode='study';s.inputStyle='typing';s.items.lab=1;openOnlineMaterial(s);
  input(s,{chars:1000,manual:false,automation:true});const text=currentPrompt(s);
  for(const char of text.slice(0,9))assert.ok(acceptCharacter(s,char,2).correct);
  const loaded=deserialize(serialize(s,0));assert.equal(loaded.balanceVersion,BALANCE_VERSION);
  assert.deepEqual(loaded.onlineMaterials,['syntax']);assert.equal(hasTextbook(loaded),false);assert.equal(studyMultiplier(loaded),1);
  assert.equal(currentPrompt(loaded),text);assert.equal(loaded.typing.offset,9);assert.equal(loaded.typing.bonusBase,18);
  near(loaded.studyGaps.syntax,s.studyGaps.syntax);
  const initial=skillKnowledge(loaded,'syntax'),result=applyOffline(loaded,30000);
  assert.ok(result.knowledge>0);near(result.knowledge,skillKnowledge(loaded,'syntax')-initial);
  assert.ok(loaded.studyGaps.syntax>s.studyGaps.syntax);assert.equal(loaded.stats.manual,0);
});

test('save normalization keeps only distinct known online subjects and old saves stay unregistered',()=>{
  const s=createState(0);s.onlineMaterials=['systems','syntax','syntax',null,{},3,'__proto__','unknown','design'];
  const loaded=deserialize(JSON.stringify(s));assert.deepEqual(loaded.onlineMaterials,['syntax','design','systems']);
  assert.equal(hasStudyMaterial(loaded,'graphics'),false);
  for(const malformed of [null,{},'syntax',123]){
    s.onlineMaterials=malformed;assert.deepEqual(deserialize(JSON.stringify(s)).onlineMaterials,[]);
  }
  const old=createState(0);old.balanceVersion=13;old.cash=4321;old.skills.syntax=34;old.items['book-syntax']=2;delete old.onlineMaterials;
  const restored=deserialize(JSON.stringify(old));assert.deepEqual(restored.onlineMaterials,[]);assert.equal(restored.cash,4321);
  assert.equal(skillKnowledge(restored,'syntax'),34);assert.equal(hasTextbook(restored),true);assert.equal(studyMultiplier(restored),3);
  assert.equal(hasStudyMaterial(restored,'design'),false,'the new route must not silently unlock unregistered subjects in old saves');
});

test('a new career preserves online access and preferences while leaving purchased textbooks behind',()=>{
  const s=createState(0);for(const {id} of SKILLS){openOnlineMaterial(s,id);s.items[`book-${id}`]=1;}
  s.runBest=2;s.runExperience={craft:5,design:2,audience:1};s.achievements=['first-book'];s.settings.commentLocale='en';s.stats.study=1234;
  const fresh=prestige(s,1000);assert.ok(fresh);assert.deepEqual(fresh.onlineMaterials,s.onlineMaterials);assert.deepEqual(fresh.items,{});
  for(const {id} of SKILLS){assert.equal(hasStudyMaterial(fresh,id),true);assert.equal(hasTextbook(fresh,id),false);}
  assert.deepEqual(fresh.achievements,s.achievements);assert.equal(fresh.settings.commentLocale,'en');assert.equal(fresh.stats.study,1234);
  assert.ok(fresh.experience.craft>0);assert.equal(openOnlineMaterial(fresh,'syntax'),false);assert.equal(studyMultiplier(fresh,'syntax'),1);
});
