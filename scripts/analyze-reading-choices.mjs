import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {lessonAt,questionFor,TOPICS,VARIANT_COUNT} from '../src/curriculum.js';
import {isReadingChoice} from '../src/readingchoices.js';

const languages=['cpp','csharp','rust','go','python','java','sql','lua'];
const variants=[],questions=[],models=new Set(),choiceCounts={2:0,3:0,4:0};
const wrongKinds={number:0,NULL:0,'runtime-error':0,'compile-error':0};
for(const language of languages)for(const subject of Object.keys(TOPICS))for(let index=0;index<16*VARIANT_COUNT;index++) {
  const lesson=lessonAt(language,subject,index),question=questionFor(lesson);
  const category=language==='sql'?'sql':lesson.bindings.length?'shared':'idiom';
  models.add(category==='shared'?`shared/${lesson.topicId}`:`${category}/${language}/${lesson.topicId}`);
  assert.ok(question.choices.length>=2&&question.choices.length<=4,lesson.id);
  assert.equal(new Set(question.choices).size,question.choices.length,lesson.id);
  assert.equal(question.options.filter(option=>option.correct).length,1,lesson.id);
  for(const option of question.options) {
    assert.ok(isReadingChoice(option.value),lesson.id);
    if(!option.correct) {
      assert.notEqual(option.value,lesson.answer,lesson.id);
      assert.ok(option.reason&&option.misconception,lesson.id);
      wrongKinds[typeof option.value==='number'?'number':option.value===null?'NULL':option.value]++;
    }
  }
  choiceCounts[question.choices.length]++;
  variants.push(lesson.id);
  if(index<16)questions.push({id:lesson.id,language,subject,title:lesson.title,answer:lesson.answer,options:question.options});
}
const report={schemaVersion:1,reproduce:'npm run reading:audit -- --write',
  provenance:'The built-in reading examples and misconception models are original game material. These are not copied choices from an external exercise set.',
  policy:'Each wrong option models a stated misreading of the shown code. Correct-value collisions and duplicate predictions are removed; there is no numeric-offset padding. Display order is deterministic and shuffled. Diagnostic plausibility was reviewed separately from this mechanical audit.',
  totals:{models:models.size,baseQuestions:questions.length,variants:variants.length,choiceCounts,wrongKinds},questions};
if(process.argv.includes('--write')) {
  writeFileSync(new URL('../research/reading-choices.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report.totals));
} else console.log(JSON.stringify(report,null,2));
