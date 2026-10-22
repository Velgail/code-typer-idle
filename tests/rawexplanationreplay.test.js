import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rawSha} from '../scripts/analyze-raw-explanations.mjs';
import {copyExactEvidence,restorePublishedRawEvidence} from '../scripts/replay-raw-explanation-submissions.mjs';

test('published replay restores exact raw bytes without a new observer or overwriting evidence',t=>{
 const root=mkdtempSync(join(tmpdir(),'cti-raw-replay-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const explanation='  原文\n🧮 tan(1°)\n',source='bool f(){return false;}\n';
 const observed={id:'trial_test',explanationPath:'work/trials/trial_test.explanation.md',sourcePath:'work/trials/trial_test.answer.cpp',explanationSha256:rawSha(explanation),sourceSha256:rawSha(source)};
 const recordedSubmissionJson=JSON.stringify(observed,null,2)+'\n';
 const row={id:observed.id,registrySha256:'registry',protocolSha256:'protocol',explanation,source,explanationSha256:rawSha(explanation),sourceSha256:rawSha(source),recordedSubmissionJson,submissionSha256:rawSha(recordedSubmissionJson)};
 const cohortSet={bindings:new Map([[row.id,{registrySha256:'registry',protocolSha256:'protocol'}]]),trialDirectories:new Map([[row.id,'work/trials']]),registry:{trials:[{id:row.id}]}};
 assert.deepEqual(restorePublishedRawEvidence({root,cohortSet,snapshot:{submissions:[row]}}),{restoredEvidence:true,newObservations:false,trials:1});
 assert.equal(readFileSync(join(root,observed.explanationPath),'utf8'),explanation);
 assert.equal(readFileSync(join(root,'work/trials/trial_test.submission.json'),'utf8'),recordedSubmissionJson);
 assert.doesNotThrow(()=>restorePublishedRawEvidence({root,cohortSet,snapshot:{submissions:[row]}}));
 writeFileSync(join(root,observed.explanationPath),'changed');
 assert.throws(()=>copyExactEvidence(join(root,observed.explanationPath),explanation),/Local immutable evidence differs/);
 const escaping={...observed,explanationPath:'outside.md'},raw=JSON.stringify(escaping);
 assert.throws(()=>restorePublishedRawEvidence({root,cohortSet,snapshot:{submissions:[{...row,recordedSubmissionJson:raw,submissionSha256:rawSha(raw)}]}}),/escapes/);
 assert.throws(()=>restorePublishedRawEvidence({root,cohortSet,snapshot:{submissions:[{...row,explanation:'summarized'}]}}));
});
