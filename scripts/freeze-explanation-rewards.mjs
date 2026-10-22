// Freeze only new, unedited, directly observed answers. No old evidence inputs.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {analyzeRawExplanations,rawSha} from './analyze-raw-explanations.mjs';
import {challengeCatalog} from '../src/challengecatalog.js';
import * as game from '../src/core.js';
import {loadRawCohorts,COHORTS_PATH} from './raw-explanation-cohorts.mjs';
import {curricularAnchor,calibrationFromRaw,serializeCalibration,rewardSource,CALIBRATION_PATH} from './challenge-calibration.mjs';
export {curricularAnchor} from './challenge-calibration.mjs';

const read=path=>JSON.parse(readFileSync(path,'utf8'));
const derived=value=>JSON.stringify(value,(_key,n)=>typeof n==='number'&&Number.isFinite(n)&&!Number.isInteger(n)?Number(n.toPrecision(12)):n,2)+'\n';
export const RAW_PATHS={registry:'research/raw-explanation-registry.json',protocol:'research/raw-explanation-protocol.json',grades:'research/raw-explanation-submissions.json',reviews:'research/raw-explanation-assessments.json',qualifications:'research/raw-explanation-observation-qualifications.json'};
const extensions={cpp:'cpp',csharp:'cs',rust:'rs',go:'go',python:'py',java:'java',sql:'sql',lua:'lua'};

export function buildRawFreeze(registry,grades,reviews,protocol,qualifications={excludedExplanationIntervals:[]},cohortOptions={}){
 assert.equal(registry.experimentId,protocol.experimentId);
 const analysis=analyzeRawExplanations({registry,grades,reviews,...curricularAnchor(),observationQualifications:qualifications.excludedExplanationIntervals,activeTaskByFamily:cohortOptions.activeTaskByFamily??{}});
 if(cohortOptions.cohorts)analysis.measurementCohorts=cohortOptions.cohorts;
 if(cohortOptions.configuration?.revisions)analysis.publicContractRevisions=cohortOptions.configuration.revisions;
 const catalog=challengeCatalog(),families=[...new Set(catalog.map(q=>q.familyId))].sort();
 assert.deepEqual(analysis.familyRewards.map(r=>r.familyId).sort(),families,'Every family needs a new accepted direct observation');
 const rows=analysis.familyRewards.map(reward=>({...reward,studyWorkUnits:reward.baseWorkUnits*game.QUIZ_STUDY_MULTIPLIER,
  implementationWorkUnits:reward.baseWorkUnits*game.QUIZ_IMPLEMENTATION_MULTIPLIER,
  implementations:catalog.filter(q=>q.familyId===reward.familyId).map(q=>({id:q.id,language:q.language,difficulty:q.difficulty}))
 })).sort((a,b)=>a.familyId.localeCompare(b.familyId));
 const calibration=calibrationFromRaw(analysis,grades),source=rewardSource(calibration);
 const report={schemaVersion:2,experimentId:registry.experimentId,reproduce:'node scripts/freeze-explanation-rewards.mjs',
  withdrawn:{status:'All previous observations, summaries, fits, predictions and calibrated rewards excluded',archive:'research/rejected-explanation-v1/rejection.json'},
  evidence:{...RAW_PATHS,...(cohortOptions.cohorts?{cohorts:COHORTS_PATH}:{})},policy:analysis.policy,coverage:{totalFamilies:rows.length,totalImplementations:catalog.length,directlyObservedFamilies:rows.length,predictedFamilies:0,individuallyTimedLanguageImplementations:rows.length},
  gameScale:analysis.gameScale,modelEvidence:analysis.summary,mapSourceSha256:rawSha(source),families:rows};
 return {analysis,report,source,calibration};
}

function markdown({analysis:a,report:r}){
 const rows=a.tasks.map(t=>{
  const links=t.trialIds.map(id=>a.trials.find(r=>r.id===id).phaseIncomplete?`[${id.slice(-8)}未受領](raw-explanation-answers/${id}.incomplete.json)`:`[${id.slice(-8)}](raw-explanation-answers/${id}.md)`).join(' ');
  return `| ${t.sourceId} | ${t.activeContract?'現行':'改訂前'} | ${t.language} | ${t.primaryAccepted}/${t.primaryTrials} | ${t.explanationTime.seconds===null?'未解決':t.explanationTime.seconds.toFixed(6)} | ${t.explanationTime.statistic} | ${t.originalAnswerCharacters.median??'—'} | ${t.originalAnswerCharactersWithoutWhitespace.median??'—'} | ${links} |`;
 }).join('\n');
 const models=a.summary.models.map(m=>`| ${m.model} / low | ${m.trials} | ${m.supersededPublicContractTrials} | ${m.observationFailures} | ${m.explanationAccepted} | ${m.codeAccepted} | ${m.accepted} |`).join('\n');
 return `# 原文を保存した新規測定\n\n前回の測定値・要約字数・回帰・予測・報酬値はすべて撤回した。[撤回履歴](rejected-explanation-v1/rejection.json)は新しい計算に読み込まない。以下は新規試行の原文と時計だけを使った結果である。\n\n[測定前の手順宣言](raw-explanation-protocol.json)、[問題・予定試行](raw-explanation-registry.json)、[全原文・時計・実装採点](raw-explanation-submissions.json)、[原文の独立査読](raw-explanation-assessments.json)、[全観測・派生値](raw-explanation-analysis.json)、[ゲーム報酬](challenge-explanation-rewards.json)を保存する。各答案全文は下表のリンクから読める。[全試行の個別数値と全文](raw-explanation-observations.md)では集計前の値を一行ずつ確認できる。\n\n## 測定対象\n\n時計は公開問題の出力直前から、解答者自身の完成した日本語解説の原文受領まで。ツールとモデルサービスの待ち時間も含む。後続の別実装・コンパイル・実行は含まない。モデル内部の思考時間や人間の解答時間とは扱わない。答案ごとに新しい会話で一問だけ解き、旧答案・参考解答・隠しテストは渡さない。読取権限による完全な技術的隔離を主張しない。\n\n原文の要約・書換え・重複除去・Unicode正規化はない。原文字数は空白・改行を含むUnicodeコードポイント数。空白除外字数はUnicode White_Spaceだけを除いた別の診断で、UTF-8バイト数も保存する。査読は原文への採否と正確な引用のみで、要約を作らない。字数は報酬に使わない。\n\n全${r.coverage.totalFamilies}題材を個別に観測し、未測定題の予測は${r.coverage.predictedFamilies}件。代表言語を測り、同題材の他言語へ共通報酬を適用する。全${r.coverage.totalImplementations}言語実装を個別に計時した意味ではない。単一観測に反復のばらつきは推定しない。当初の反復対象は測定前に固定した。出題の改訂・不合格を受けて追加した試行は[別コホートの宣言](raw-explanation-cohorts.json)に選択理由を残し、初回や失敗を置換しない。\n\n## 新規試行の採否\n\n| モデル | 試行 | 出題改訂前 | 観測・送信手順の失敗 | 原文解説受理 | 実装テスト受理 | 両方受理・整合 |\n| --- | ---: | ---: | ---: | ---: | ---: | ---: |\n${models}\n\n原文を受領した試行は${a.summary.receivedOriginals}件、原文未受領は${a.summary.missingOriginals}件、受領した空原文は${a.summary.receivedEmptyOriginals}件。未受領の字数・時計の終点を0で埋めない。観測・送信手順の失敗は問題の難しさによる誤答と区別する。出題改訂前の${a.summary.supersededPublicContractTrials}試行は別集計し、不明確な出題の影響をモデルの能力不足へ帰属させない。比較モデルの失敗へ独断の報酬倍率を付けない。査読不一致は独立の第三者が裁定し、元の判定も保持する。 計算量の表記は[独立監査](raw-complexity-policy-audit.json)で通常の漸近基準へ揃え、訂正前の裁定・訂正ファイルの生JSONとSHAを独立査読記録に併記する。[観測・復旧の履歴](raw-explanation-coordination.json)も元ledgerの全文とハッシュ付きで公開する。\n\n## 全題材・全原文・数値\n\n字数欄は受理済み主モデル原文の中央値。1試行だけの題材はその一観測。全試行の原文字数・空白除外数・UTF-8バイト数・時刻・除外理由は[全観測](raw-explanation-analysis.json)のtrialsと[元記録](raw-explanation-submissions.json)に、不合格も含めて記録する。\n\n| 公開課題ID | 出題 | 代表言語 | 主モデル受理/試行 | 実経過秒 | 集計区分 | 原文字数 | 空白除外字数 | 答案全文 |\n| --- | --- | --- | ---: | ---: | --- | ---: | ---: | --- |\n${rows}\n\n## 報酬と進行方針\n\n相対値は受理した主モデルの直接観測時間を、今回新たに測った実アプリ6件の中央値${a.gameScale.applicationAnchorSeconds.toFixed(6)}秒で割る。長さから時間を予測する式はない。\n\n共通基本報酬${a.gameScale.commonWorkAnchor}は、現在のcoreの新規セーブで無料学習K0→K12作業量${a.gameScale.policy.freeStudyWorkFromZeroToRequirement}と構文Quiz報酬上限${a.gameScale.policy.maximumUnassistedSyntaxQuizStudyWork}を再計算して決める別のゲーム進行方針である。相対値へこの尺度を掛けて整数に丸め、学習・実装・設備等の既存倍率を別に適用する。人間の所要分数へ換算した数字ではない。[進行・報酬の再確認](explanation-game-balance.json)もこの新表で実行する。 全449試行の初回実装評価とは別に、[最終ビルドでの再確認](raw-final-build-validation.json)ではSQL・実アプリ・対照課題・不合格実装・各言語代表・全追加試行と、すでに再実行済みの先頭69件を合わせた266件を検証し、判定差は0件だった。これは再検証の部分集合であり、新しい難易度計測ではない。\n\n保存データから同じ派生表を再計算できることと、モデルを再試験して同じ秒数になることは別である。サービス待ち時間、既知の問題、説明の書き方、代表言語の影響は残る。本質的難易度や人間の解答時間を確定したという主張はしない。\n`;
}

function originalObservationTable(analysis){
 const tasks=new Map(analysis.tasks.map(t=>[t.id,t]));
 const rows=analysis.trials.map(t=>{
  const task=tasks.get(t.taskId),counts=t.rawExplanationMetrics;
  const exact=t.phaseIncomplete?`[未受領の記録](raw-explanation-answers/${t.id}.incomplete.json)`:`[原文全文](${t.explanationFile})`;
  const status=t.phaseIncomplete?'未受領':t.observationFailure??(t.accepted?'解説・実装受理':!t.codeAccepted?'実装不合格':!t.explanationAccepted?'解説不合格':'解説と実装が不整合');
  return `| ${t.id} | ${task.sourceId} | ${t.model} / ${t.effort} | ${t.independentTrial} | ${status} | ${t.elapsedExplanationSeconds??'—'} | ${counts.unicodeCharacters??'—'} | ${counts.charactersExcludingUnicodeWhiteSpace??'—'} | ${counts.utf8Bytes??'—'} | ${t.usedForReward?'採用':t.exclusionReasons.join(' / ')} | ${exact} |`;
 }).join('\n');
 return `# 全試行の原文・個別測定値\n\n各行が一つの原文に対応する。字数・時間を中央値や別の文章の値に置き換えていない。Unicode字数は空白・改行を含む。受領した空原文の0と、原文未受領の欠測（—）を区別する。時間はモデル・ツール・通信を含む実経過秒で、人間の解答時間ではない。正確な時計の十進ナノ秒文字列、SHA-256、採点結果は[元記録](raw-explanation-submissions.json)に保存する。\n\n後から追加したコホートは[宣言と選択理由](raw-explanation-cohorts.json)で識別する。最初の試行や失敗を置換しない。\n\n| 試行ID | 公開課題ID | モデル | 同題・同モデル試行番号 | 結果 | 原文受領までの実経過秒 | 原文Unicode字数 | White_Space除外字数 | UTF-8バイト | 報酬への採否・理由 | 全文 |\n| --- | --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- | --- |\n${rows}\n`;
}

export function freezeRawFiles(){
 const cohortSet=loadRawCohorts(),{registry,protocol}=cohortSet,grades=read(RAW_PATHS.grades),reviews=read(RAW_PATHS.reviews);
 for(const row of grades.submissions){const expected=cohortSet.bindings.get(row.id);assert.ok(expected);assert.equal(row.registrySha256,expected.registrySha256);assert.equal(row.protocolSha256,expected.protocolSha256);assert.equal(row.experimentId,expected.experimentId);assert.ok(BigInt(row.startedUnixNs)>=BigInt(Date.parse(expected.declaredAt))*1000000n,'A trial cannot precede its locally frozen declaration');}
 const result=buildRawFreeze(registry,grades,reviews,protocol,read(RAW_PATHS.qualifications),cohortSet);
 mkdirSync('research/raw-explanation-answers',{recursive:true});
 for(const row of grades.submissions){
  if(row.phaseIncomplete)writeFileSync(`research/raw-explanation-answers/${row.id}.incomplete.json`,JSON.stringify({originalStartJson:row.recordedStartJson,failure:row.incompleteFailure},null,2)+'\n');
  else {writeFileSync(`research/raw-explanation-answers/${row.id}.md`,row.explanation);writeFileSync(`research/raw-explanation-answers/${row.id}.${extensions[row.language]}`,row.source);}
 }
 writeFileSync('research/raw-explanation-analysis.json',derived(result.analysis));
 writeFileSync('research/challenge-explanation-rewards.json',derived(result.report));
 writeFileSync('research/explanation-calibration.md',markdown(result));
 writeFileSync('research/raw-explanation-observations.md',originalObservationTable(result.analysis));
 writeFileSync(CALIBRATION_PATH,serializeCalibration(result.calibration));
 writeFileSync('src/challengerewards.js',result.source);
 console.log(JSON.stringify({coverage:result.report.coverage,observations:result.analysis.summary,mapSha256:result.report.mapSourceSha256}));
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))freezeRawFiles();
