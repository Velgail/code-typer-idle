// Pure game rules. All time is in seconds; progress is measured in characters.
import { lessonAt, questionFor, TOPICS_PER_SUBJECT } from './curriculum.js';
import { quizAt, QUIZ_TOPICS_PER_SUBJECT } from './quizcatalog.js';
import { createTypingState, normalizeTypingState, TYPING_REWARD, TYPING_REFERENCE_RATE, typingCompletionMultiplier } from './typing.js';
import { DEVELOPMENT_POLICIES, emptyDebtSources, developmentPolicy, maintenanceEfficiency, incurredDebt, changeDefectRate, addDebt, repayDebt, debtBreakdown } from './maintenance.js';
import { createBuildState, buildStepFor, needsBuild, markBuildChanges, normalizeBuildState } from './builds.js';
import { createOCRLedger, normalizeOCRLedger, recordOCR, correctOCR, OCR_RESUBMISSION_FEE, OCR_ERROR_INTERVAL } from './officequality.js';
import { EXPERIENCE_TYPES, emptyExperience, experienceReward, experienceCap, experienceEffects, experienceRequirements, salesTerms, titleSalesRate, remainingSales, salesDuring, settleSales } from './career.js';
export { EXPERIENCE_TYPES, experienceEffects, titleSalesRate, remainingSales } from './career.js';
export { needsBuild } from './builds.js';
import { estimatePlan, amendPlan } from './planning.js';
import { PLANNING_CATALOG, PLANNING_EXAMPLES } from './planningcatalog.js';
import { createPlannerState, activePlanningProject, planningRuntime, projectFromPlanning, verifiedFoundations, learnPlanning, normalizePlannerState, ASSET_WORK_CHARACTERS } from './plannerstate.js';
export const VERSION = 1;
export const BALANCE_VERSION = 17;
export const MAX_SAVE_BYTES = 8 * 1024 * 1024;
export const AUTO_STUDY_UNVERIFIED = .25;
export const AUTO_DEVELOPMENT_DEFECTS = 2;
export const TYPING_AUTOMATION_SHARE = .5;
export const STORE_FEE_RATE = 0.25;
export const PRODUCTION_SERVICES=[
  {id:'graphics',name:'グラフィック制作',payee:'イラストレーター・3Dアーティスト',share:.6,bonus:6},
  {id:'audio',name:'音楽・効果音制作',payee:'作曲家・サウンド制作者',share:.4,bonus:4}
];
export const INITIAL_CASH = 100;
export const STUDY_XP = 0.0031;
export const SKILL_EXPONENT = 1.5;
export const SYNTAX_FOUNDATION_LIMIT = 12;
export const SYNTAX_FOUNDATION_COST = .75 * Math.sqrt(SYNTAX_FOUNDATION_LIMIT);
export const DAY = 3600;
export const JOB_SIZE = 100;
export const OCR_BASE_RATE = 10;
export const OFFICE_CONTRACT_WORK = 5000;
export const OFFLINE_LIMIT = 8 * 60 * 60;
const LIMIT = 1e250;
const bounded = n => Math.max(0, Math.min(LIMIT, Number.isFinite(n) ? n : LIMIT));
const add = (a, b) => bounded(a + b);
export const SKILLS = [
  { id: 'syntax', name: '基礎文法', short: '文法', color: '#a4e7b5', label: '01', file: 'fundamentals', lesson: '変数、条件分岐、そして最初の関数。' },
  { id: 'design', name: '設計・構造', short: '設計', color: '#b9a4ec', label: '02', file: 'architecture', lesson: '動いたコードを、直せるコードへ。' },
  { id: 'graphics', name: '描画・演出', short: '描画', color: '#edc591', label: '03', file: 'render', lesson: '画面の向こうに、遊べる世界を。' },
  { id: 'systems', name: '最適化・基盤', short: '基盤', color: '#8cbce1', label: '04', file: 'systems', lesson: '1フレームのために、できること。' }
];
export const PROJECTS = [
  { name: '小さな数当てゲーム', genre: 'CONSOLE / FIRST BUILD', target: 3000, req: { syntax: 12 }, payout: 0, royalty: 0, desc: '最初の一本。売上はゼロ。でも、完成させた経験は残る。', icon: '01' },
  { name: 'ネオン・ブロック崩し', genre: 'ARCADE / 2D', target: 9000, req: { syntax: 24, design: 8, graphics: 8 }, payout: 0, royalty: 0, desc: '遊べる習作を無料公開。跳ね返す手触りから、面白さの手掛かりを得る。', icon: '02' },
  { name: '雨のダンジョン', genre: 'ROGUELIKE / INDIE', target: 60000, req: { syntax: 60, design: 35, graphics: 30 }, payout: 5000, royalty: 15000 * Math.LN2 / DAY, desc: '習作で見つけた遊びを、小さな有料作品に育てる。', icon: '03' },
  { name: '軌道上の街', genre: 'SIMULATION / 3D', target: 2500000, req: { syntax: 550, design: 700, graphics: 600, systems: 300 }, payout: 375000, royalty: 1125000 * Math.LN2 / (4 * DAY), desc: '街も、住民も、フレームレートも、あなたの責任。', icon: '04' },
  { name: 'NO MAN’S DEADLINE', genre: 'OPEN WORLD / AAA', target: 6.2e8, req: { syntax: 3000, design: 5000, graphics: 4500, systems: 4000 }, payout: 45e6, royalty: 135e6 * Math.LN2 / (12 * DAY), desc: '1,550万行相当の世界を作る。エンドロールの後にも、仕事はある。', icon: '05' },
  { name: '永続するオンライン宇宙', genre: 'LIVE SERVICE / PLANET SCALE', online: true, serverDaily: 3e6, target: 1e10, req: { syntax: 20000, design: 35000, graphics: 26000, systems: 40000 }, payout: 1.5e9, royalty: 4.5e9 * Math.LN2 / (24 * DAY), desc: '全プレイヤーが同じ宇宙にいる。障害対応も同じ宇宙で起きる。', icon: '06' },
  { name: '現実コンパイラ', genre: 'SIMULATION / REALITY SCALE', online: true, serverDaily: 3e8, target: 1e13, req: { syntax: 2e5, design: 4e5, graphics: 3e5, systems: 5e5 }, payout: 1.5e12, royalty: 4.5e12 * Math.LN2 / (48 * DAY), desc: 'クラウド上で物理法則を書き起こす。動き続ける世界を、プレイヤーへ配信する。', icon: '07' }
];
export function projectAt(index) {
  if (index < PROJECTS.length) return PROJECTS[index];
  const n = index - PROJECTS.length + 1;
  const pow = (base, exp) => Math.min(LIMIT, Math.pow(base, Math.min(800, exp)));
  const scope = n - 1 + 0.06 * (n - 1) ** 2;
  const understanding = n + 0.04 * n ** 2;
  return { name: `多元宇宙エンジン / 第${n}世代`, genre: 'ENDLESS / ANOTHER SPECIFICATION', online: true, serverDaily: Math.min(LIMIT, 5e11 * pow(50, n - 1)), target: Math.min(LIMIT, 1e15 * pow(40, scope)), req: { syntax: Math.min(LIMIT, 1e6 * pow(3, understanding)), design: Math.min(LIMIT, 2e6 * pow(3, understanding)), graphics: Math.min(LIMIT, 1.5e6 * pow(3, understanding)), systems: Math.min(LIMIT, 3e6 * pow(3, understanding)) }, payout: Math.min(LIMIT, 1e16 * pow(50, n - 1)), royalty: Math.min(LIMIT, 1e13 * pow(50, n - 1)), desc: '配信中の宇宙を増やすたび、次の宇宙の要件定義が届く。', icon: String(index + 1).padStart(2, '0') };
}
export const SHOP = [
  ...SKILLS.map((s, i) => ({ id: `book-${s.id}`, tab: 'books', name: ['プログラミング基礎教本', '設計パターンの教科書', 'ゲーム描画のしくみ', '最適化と分散システム'][i], desc: `${s.name}の解説を整理した教本。学習量 +100% / Lv（加算）`, base: [1500, 6000, 8000, 30000][i], growth: 3, type: 'book', skill: s.id, glyph: 'book', gate: 0 })),
  { id: 'keyboard', tab: 'gear', name: 'メカニカルキーボード', desc: '手動入力の文字数 +25% / Lv（加算）', base: 1800, growth: 2.5, type: 'gear', glyph: 'keyboard', gate: 0 },
  { id: 'monitor', tab: 'gear', name: 'デュアルモニター', desc: 'すべての学習量 +25% / Lv（加算）', base: 3000, growth: 2.5, type: 'gear', glyph: 'monitor', gate: 0 },
  { id: 'ide', tab: 'gear', name: 'IDE・コード補完', desc: '手動開発 +35% / Lv（完全理解時・加算）', base: 10000, growth: 3, type: 'gear', glyph: 'code', gate: 1 },
  { id: 'kitchen', tab: 'gear', name: 'サーバー運用の最適化', desc: '公開中のオンライン作品のサーバー代を25%削減', base: 3000, growth: 1, max: 1, type: 'gear', glyph: 'server', gate: 5 },
  { id: 'macro', tab: 'auto', name: '伝票OCR・入力マクロ', desc: '買い切りで10作業量/秒。誤読率10%。誤納品は報酬取消と依頼元への再提出手数料20%。訂正で報酬を回収', base: 500, growth: 1, max: 1, type: 'auto', glyph: 'terminal', gate: 0 },
  { id: 'library', tab: 'auto', name: '自作ライブラリ', desc: '開発 +2文字/秒。各Lvで ×1.6', base: 1200, growth: 3, type: 'auto', glyph: 'layers', gate: 1 },
  { id: 'assistant', tab: 'auto', name: 'AIコーディング補助', desc: '開発 +8文字/秒。各Lvで ×1.7。要レビュー', base: 6000, growth: 3, type: 'auto', glyph: 'spark', gate: 1 },
  { id: 'engineer', tab: 'auto', name: '開発チーム', desc: '開発 +80文字/秒。各Lvで ×1.8', base: 40000, growth: 3, type: 'auto', glyph: 'users', gate: 2 },
  { id: 'lab', tab: 'auto', name: '研究ラボ', desc: '教材のある不足分野を学習 +8文字/秒。各Lvで ×1.8。25%は未確認で残り、手入力・読解で確かめる', base: 2000, growth: 3, type: 'auto', glyph: 'flask', gate: 1 },
  { id: 'cluster', tab: 'auto', name: '自律開発クラスタ', desc: '開発 +3,500文字/秒。各Lvで ×2', base: 800000, growth: 3, type: 'auto', glyph: 'server', gate: 3 }
];
export const ACHIEVEMENTS = [
  { id: 'first-input', name: '最初の一文字', hint: '1回入力する', test: s => s.stats.manual > 0 },
  { id: 'first-book', name: '積読では終わらせない', hint: '教材を買う', test: s => Object.keys(s.items).some(k => k.startsWith('book-') && s.items[k] > 0) },
  { id: 'first-release', name: 'Hello, Developer.', hint: 'ゲームを1本公開する', test: s => s.stats.releases >= 1 },
  { id: 'automation', name: '寝ていても、仕事', hint: 'マクロを導入する', test: s => level(s, 'macro') > 0 },
  { id: 'indie', name: 'はじめてのお客さん', hint: '有料作品を発売する', test: s => s.catalog.some(p=>p.payout>0) },
  { id: 'million', name: '100万行は通過点', hint: '累計4,000万文字（換算100万行）', test: s => s.stats.chars >= 4e7 },
  { id: 'aaa', name: 'エンドロールのその先', hint: 'AAAタイトルを公開する', test: s => s.runBest >= 5 || s.catalog.some(p=>p.index>=4) },
  { id: 'restart', name: '覚えている、この手触り', hint: '制作の経験を持って次の人生へ', test: s => s.resets > 0 },
  { id: 'universe', name: 'スコープは無限', hint: '多元宇宙エンジンを公開する', test: s => s.runBest >= 8 || s.catalog.some(p=>p.index>=7) }
];
export function createState(now = Date.now()) {
  return { version: VERSION, balanceVersion: BALANCE_VERSION, cash: INITIAL_CASH, skills: Object.fromEntries(SKILLS.map(s => [s.id, 0])), studyGaps: Object.fromEntries(SKILLS.map(s => [s.id, 0])), items: {}, onlineMaterials: [], mode: 'work', subject: 'syntax', inputStyle: 'click', typing: createTypingState(), studyStyle: 'practice', reading: { cursors: {}, answers: {} }, quiz: { cursors: {}, completed: [], drafts: {} }, office: { remaining: OFFICE_CONTRACT_WORK }, job: { progress: 0, rate: 1 }, workTask: 'entry', ocrJob: { progress: 0, rate: 1 }, ocr: createOCRLedger(), refactor: false, autoEnabled: true, projectIndex: 0, projectCarryover: false, progress: 0, debt: 0, debtSources: emptyDebtSources(), defects: 0, developmentPolicy: 'steady', reviewedAt: 0, build: createBuildState(), production: {}, planner:createPlannerState(), mistakes: 0, crashed: false, catalog: [], assets: 0, experience: emptyExperience(), runExperience: emptyExperience(), experiencedProjects: [], completedProjects: [], legacyPermit: -1, nextTitleId: 1, resets: 0, runReleased: 0, runBest: 0, achievements: [], stats: { chars: 0, manual: 0, valid: 0, releases: 0, earned: 0, study: 0, debtRemoved: 0, defectsFixed: 0, outsourcing: 0, jobs: 0, time: 0, storeFees: 0, serverFees: 0 }, day: 1, dayElapsed: 0, dailyAccrued: 0, savedAt: now, settings: { sound: false, reducedMotion: false, commentLocale: 'ja' }, log: [{ text: '自室のPCで制作を開始。学習用の教材を探そう。', kind: 'info', day: 1 }] };
}
export const currentProject=s=>{const project=activePlanningProject(s);return project?projectFromPlanning(project):projectAt(s.projectIndex);};
const cloneWork=value=>JSON.parse(JSON.stringify(value));
const WORK_FIELDS=['progress','debt','debtSources','defects','developmentPolicy','reviewedAt','build','production','mistakes','crashed','refactor','projectCarryover','autoEnabled','mode','subject'];
const captureProjectWork=s=>Object.fromEntries(WORK_FIELDS.map(key=>[key,cloneWork(s[key])]));
function restoreProjectWork(s,raw={}){
  s.progress=Math.max(0,Math.min(currentProject(s).target,Number.isFinite(raw.progress)?raw.progress:0));
  s.debt=Math.max(0,Math.min(LIMIT,Number.isFinite(raw.debt)?raw.debt:0));
  s.defects=Math.max(0,Math.min(defectLimit(s),Number.isFinite(raw.defects)?raw.defects:0));
  s.debtSources=Object.fromEntries(Object.keys(emptyDebtSources()).map(id=>[id,Math.max(0,Math.min(s.debt,Number.isFinite(raw.debtSources?.[id])?raw.debtSources[id]:0))]));
  const normalized=debtBreakdown(s);s.debtSources=emptyDebtSources();for(const source of normalized)s.debtSources[source.id]=source.amount;
  s.developmentPolicy=DEVELOPMENT_POLICIES.some(policy=>policy.id===raw.developmentPolicy)?raw.developmentPolicy:'steady';
  s.reviewedAt=Math.max(0,Math.min(s.stats.time,Number.isFinite(raw.reviewedAt)?raw.reviewedAt:s.stats.time));
  s.mistakes=Math.max(0,Math.min(LIMIT,Number.isFinite(raw.mistakes)?raw.mistakes:0));
  s.crashed=raw.crashed===true || s.defects>=defectLimit(s);s.refactor=raw.refactor===true;s.projectCarryover=raw.projectCarryover===true;s.autoEnabled=raw.autoEnabled===true;
  if(['work','study','dev'].includes(raw.mode))s.mode=raw.mode;if(SKILLS.some(skill=>skill.id===raw.subject))s.subject=raw.subject;
  s.production={};for(const service of PRODUCTION_SERVICES)if(Number.isFinite(raw.production?.[service.id]?.paid) && raw.production[service.id].paid>0)s.production[service.id]={paid:Math.min(LIMIT,raw.production[service.id].paid)};
  s.build=normalizeBuildState(raw.build,s,currentProject(s).target);
}
function resetTypingProject(s){s.typing.context='';s.typing.offset=0;s.typing.bonusBase=0;s.typing.roundErrors=0;s.typing.correction=null;}
export function estimateProjectDraft(s,plan){const snapshot=estimatePlan(plan);return {...snapshot,runtime:planningRuntime(s,snapshot)};}
export function planningKnowledge(s){return cloneWork(s.planner.knowledge);}
function planningRisk(s){
  const project=activePlanningProject(s);if(!project)return {integration:0,design:0,market:0};
  const hypotheses=project.snapshot.compatibility.known,known=hypotheses.filter(row=>s.planner.knowledge.synergies.includes(row.id || `${project.snapshot.plan.genreId}.${row.featureId || row.name || 'combination'}`)).length;
  const factor=1-.5*(hypotheses.length?known/hypotheses.length:0),risk=project.snapshot.compatibility.risk || {};
  return {integration:(risk.integration || 0)*factor,design:(risk.design || 0)*factor,market:(risk.market || 0)*factor};
}
export function customProduction(s){
  const project=activePlanningProject(s);
  const releaseBlockers=[];
  if(project){
    if(project.paid<project.snapshot.totals.upfrontCost)releaseBlockers.push('素材・配布・基盤契約に未払いがあります。');
    if(project.assetProgress<project.assetTarget)releaseBlockers.push('自作素材の制作が残っています。');
    if((project.snapshot.sales?.requiresBaseRelease || project.snapshot.plan.salesModelId==='dlc') && !customBaseTitle(s,project))releaseBlockers.push('DLCの本編となる有料作品を、先に公開する必要があります。');
  }
  return project?{assetProgress:project.assetProgress,assetTarget:project.assetTarget,paid:project.paid,requiredCash:project.snapshot.totals.upfrontCost,outstandingCash:Math.max(0,project.snapshot.totals.upfrontCost-project.paid),allocation:s.planner.allocation,releaseBlockers,baseTitleId:project.baseTitleId}:null;
}
export function setCustomAllocation(s,allocation){const project=activePlanningProject(s);if(!project || !['code','assets'].includes(allocation))return false;if(s.planner.allocation!==allocation)resetTypingProject(s);s.planner.allocation=allocation;project.allocation=allocation;return true;}
export function fundCustomProject(s){
  const project=activePlanningProject(s);if(!project)return false;
  const cost=Math.max(0,project.snapshot.totals.upfrontCost-project.paid);if(!(cost>0) || s.cash<cost)return false;
  s.cash-=cost;project.paid+=cost;s.stats.outsourcing=add(s.stats.outsourcing,cost);
  log(s,`素材・配布・開発契約の未払 ¥${cost.toLocaleString('en-US')}を精算しました。`,'success');return true;
}
export function pauseCustomProject(s,{preserveAutomatic=false}={}){
  const project=activePlanningProject(s);if(!project)return false;
  project.work=captureProjectWork(s);project.status='paused';s.planner.active=null;
  const tutorial=s.planner.tutorial;s.projectIndex=tutorial?.projectIndex ?? s.projectIndex;restoreProjectWork(s,tutorial?.work);s.planner.tutorial=null;
  if(!preserveAutomatic)s.planner.auto=false;
  resetTypingProject(s);log(s,`${project.name}を保留。作業と支払はそのまま残ります。`);return true;
}
export function resumeCustomProject(s,id){
  const project=s.planner.projects.find(project=>project.id===id && project.status==='paused');if(!project)return false;
  if(activePlanningProject(s))pauseCustomProject(s,{preserveAutomatic:true});
  s.planner.tutorial={projectIndex:s.projectIndex,work:captureProjectWork(s)};s.planner.active=project.id;project.status='active';s.planner.allocation=project.allocation || 'code';restoreProjectWork(s,project.work);resetTypingProject(s);
  log(s,`${project.name}の制作を再開しました。`,'success');return true;
}
export function startCustomProject(s,plan,{name,baseTitleId}={}){
  let snapshot;try{snapshot=estimatePlan(plan);}catch(error){return {ok:false,reason:error.message};}
  if(s.planner.projects.filter(project=>project.status!=='released').length>=24)return {ok:false,reason:'保留中の企画が24件あります。既存の企画を仕上げてください。'};
  const runtime=planningRuntime(s,snapshot);
  if(activePlanningProject(s))pauseCustomProject(s,{preserveAutomatic:true});
  s.planner.tutorial={projectIndex:s.projectIndex,work:captureProjectWork(s)};
  const record={id:`project-${s.planner.nextId++}`,name:typeof name==='string' && name.trim()?name.trim().slice(0,100):PLANNING_CATALOG.genres.find(genre=>genre.id===snapshot.plan.genreId)?.name || '新しいゲーム',snapshot,codeTarget:runtime.codeTarget,assetTarget:runtime.assetTarget,assetProgress:0,paid:0,defectBase:runtime.codeTarget,reuse:runtime.reuse,allocation:'code',status:'active',work:null};
  record.baseTitleId=typeof baseTitleId==='string'?baseTitleId:s.catalog.findLast(title=>title.unitPrice>0 && title.salesModelId!=='dlc')?.id || null;
  s.planner.projects=s.planner.projects.filter(project=>project.status!=='released').concat(s.planner.projects.filter(project=>project.status==='released').slice(-7),record);s.planner.active=record.id;s.planner.allocation='code';
  restoreProjectWork(s);s.debt=runtime.reuse.reduce((sum,entry)=>sum+entry.debt,0);s.debtSources.reuse=s.debt;s.projectCarryover=s.debt>0;if(s.debt)markBuildChanges(s,s.debt);
  s.mode='dev';resetTypingProject(s);fundCustomProject(s);
  log(s,`${record.name}の制作を開始。必要な知識や資金は、途中で揃えることもできます。`,'success');return {ok:true,id:record.id};
}
export function expandCustomProject(s,changes){
  const project=activePlanningProject(s);if(!project)return {ok:false,reason:'制作中の自由企画がありません。'};
  let amendment;try{amendment=amendPlan(project.snapshot,changes);}catch(error){return {ok:false,reason:error.message};}
  project.snapshot=amendment.snapshot;project.codeTarget+=amendment.delta.codeCharacters;project.assetTarget=amendment.snapshot.totals.assetWork;
  // The original defect budget remains fixed: appending empty scope cannot
  // turn an existing failing build into a passing build or improve quality.
  checkChangedCode(s,1,'assets');resetTypingProject(s);fundCustomProject(s);
  log(s,`企画を拡張。追加実装 ${amendment.delta.codeLines.toLocaleString('en-US')}行・素材作業 ${amendment.delta.assetWork.toLocaleString('en-US')}。`);return {ok:true,delta:amendment.delta};
}
export function produceCustomAssets(s,{effort=handPower(s),manual=true,automation=false}={}){
  const project=activePlanningProject(s);if(!project || s.planner.allocation!=='assets' || s.refactor || !(effort>0) || !Number.isFinite(effort))return {kind:'assets',amount:0};
  if(manual)effort=Math.min(effort,handPower(s));
  const before=project.assetProgress,planned=Math.min(Math.max(0,project.assetTarget-before),effort/(manual?30:ASSET_WORK_CHARACTERS)*(automation?.75:1));
  project.assetProgress=before+planned;
  if(project.assetTarget-project.assetProgress<=Math.max(1,project.assetTarget)*1e-10)project.assetProgress=project.assetTarget;
  const amount=project.assetProgress-before;
  if(manual && amount>0)s.stats.manual=add(s.stats.manual,1);
  if(amount){
    markBuildChanges(s,amount);
    // Art is integrated in batches. Code completion must not turn every
    // individual brush stroke into a separate compile and test invocation.
    const interval=Math.max(1,project.assetTarget/8);
    if(project.assetProgress>=project.assetTarget || Math.floor(before/interval)<Math.floor(project.assetProgress/interval))runBuild(s,'assets');
  }
  return {kind:'assets',amount};
}
const autoEstimateCache=new Map();
const autoEstimate=plan=>{const key=JSON.stringify(plan);if(!autoEstimateCache.has(key))autoEstimateCache.set(key,estimatePlan(plan));return autoEstimateCache.get(key);};
export function chooseAutoPlan(s){
  const known=s.planner.knowledge.releasedPlans.map((plan,index)=>({id:`known-${index}`,name:PLANNING_CATALOG.genres.find(genre=>genre.id===plan.genreId)?.name || '慣れた企画',plan}));
  const examples=[...known,...PLANNING_EXAMPLES].flatMap(example=>[example,...(s.planner.knowledge.genres.includes(example.plan.genreId) && (!example.plan.salesModelId || example.plan.salesModelId==='free')?[{...example,id:`${example.id}-paid`,plan:{...example.plan,salesModelId:'paid'}}]:[])]);
  const candidates=examples.flatMap(example=>{try{const snapshot=autoEstimate(example.plan),runtime=planningRuntime(s,snapshot);if(runtime.requiredCash+snapshot.totals.recurringCostPerDay*3>s.cash || runtime.missingRequirements.length)return [];if((snapshot.sales?.requiresBaseRelease || snapshot.plan.salesModelId==='dlc') && !s.catalog.some(title=>title.unitPrice>0 && title.totalCopies>0 && title.salesModelId!=='dlc' && !title.archived))return [];const tested=snapshot.features.filter(feature=>s.planner.knowledge.testedFeatures.includes(feature.id)).length;return [{plan:snapshot.plan,snapshot,name:example.name,reason:s.planner.knowledge.genres.includes(snapshot.plan.genreId)?'公開して確かめた企画を、今の体制で制作します。':'現在の知識と資金で完了できる企画です。',score:tested*1000+Math.min(snapshot.totals.codeLines,10000)+(snapshot.plan.salesModelId==='paid'?20000:0)}];}catch{return [];}});
  candidates.sort((a,b)=>b.score-a.score);
  if(candidates.length){const {score,...choice}=candidates[0];return choice;}
  const starter=PLANNING_EXAMPLES.flatMap(example=>{try{const snapshot=autoEstimate(example.plan);return snapshot.totals.upfrontCost===0 && snapshot.totals.recurringCostPerDay===0?[{plan:snapshot.plan,snapshot,name:example.name,reason:'無料教材で基礎から学び、小さな一本を完成させます。'}]:[];}catch{return [];}}).sort((a,b)=>a.snapshot.totals.codeCharacters-b.snapshot.totals.codeCharacters)[0];
  return starter || null;
}
export function startAutoPlan(s){const choice=chooseAutoPlan(s);if(!choice)return {ok:false,reason:'今の知識と資金で完了できる企画がありません。無料教材で不足分野を学べます。'};const result=startCustomProject(s,choice.plan,{name:choice.name});if(result.ok)s.autoEnabled=true;return result;}
export function setAutoPlanning(s,enabled){s.planner.auto=!!enabled;return true;}
function prepareAutomaticPlan(s){
  if(!s.planner.auto)return;
  if(!activePlanningProject(s))startAutoPlan(s);
  const project=activePlanningProject(s);if(!project)return;
  fundCustomProject(s);
  const missing=developmentReadiness(s).requirements.filter(requirement=>requirement.missing>0);
  for(const requirement of missing)if(!hasStudyMaterial(s,requirement.id))openOnlineMaterial(s,requirement.id);
  s.autoEnabled=true;
  if(missing.length){s.autoEnabled=false;s.mode='study';s.subject=missing.sort((a,b)=>a.current/a.required-b.current/b.required)[0].id;return;}
  s.mode='dev';
  const repair=s.crashed || s.defects>defectLimit(s)*.05;
  s.refactor=repair;setCustomAllocation(s,!repair && project.assetProgress<project.assetTarget?'assets':'code');
  if(!repair && s.progress>=project.codeTarget && project.assetProgress>=project.assetTarget && !customProduction(s).releaseBlockers.length)releaseCustomProject(s);
}
function customSalesForecast(s,project,q){
  const terms=project.snapshot.sales || {},modelId=terms.modelId || project.snapshot.plan.salesModelId || 'free',commercial=modelId!=='free';
  const validated=s.progress>=project.codeTarget && !needsBuild(s) && ['passed','warnings'].includes(s.build.last?.status);
  const supported=validated?Math.min(4,project.snapshot.compatibility.known.filter(row=>row.relation==='supports').length):0;
  const genreMarket=terms.genreMarket || {},basePrice=genreMarket.basePrice ?? 500;
  const reach=(genreMarket.reachableAudience ?? 40)+(validated?(terms.marketingReach || 0):0);
  const market=Math.max(0,Math.floor(reach*experienceEffects(s.experience).audience*(terms.audienceMultiplier ?? 1)*(terms.storeAudienceMultiplier ?? 1)*(validated?(terms.themeAudienceMultiplier ?? 1):1)*q/100*(1-.6*planningRisk(s).market)*(1+supported*.08*q/100)));
  const price=commercial?Math.max(.01,Math.round(basePrice*(terms.priceMultiplier ?? 1)*100)/100):0;
  let customerCount=commercial && q>=60?Math.max(0,Math.floor(market*(terms.conversionRate ?? 1)*(genreMarket.conversionScale ?? 1))):0;
  if(terms.requiresBaseRelease || modelId==='dlc')customerCount=Math.min(customerCount,Math.floor((customBaseTitle(s,project)?.customerCount ?? customBaseTitle(s,project)?.totalCopies ?? 0)*.3));
  const maxPeriods=Math.max(1,Math.floor(terms.recurringPeriods ?? 1)),lifetimeBudget=basePrice*(terms.lifetimeBudgetMultiplier ?? 1);
  const unitsPerCustomer=commercial?Math.max(0,Math.min(maxPeriods,Math.floor((lifetimeBudget+1e-9)/price))):0;
  const copies=customerCount*unitsPerCustomer;
  const gross=bounded(price*copies),launchGross=Math.min(gross,price*Math.floor(copies*(terms.launchFraction ?? .25)));
  const revenueUnitKind=({paid:'copy',dlc:'dlc-copy',subscription:'subscription-period','f2p-cosmetic':'cosmetic-purchase','ad-supported':'ad-view','pay-what-you-want':'support-payment'})[modelId] || 'free';
  return {commercial,price,copies,gross,launchGross,tailGross:gross-launchGross,halfLife:Math.max(1,(terms.salesHalfLifeDays ?? 1)*DAY),storeFeeRate:Math.max(0,Math.min(1,terms.storeFeeRate ?? STORE_FEE_RATE)),engineFeeRate:Math.max(0,Math.min(1,terms.engineFeeRate ?? 0)),modelId,revenueUnitKind,audienceCount:market,customerCount,revenueUnitCount:copies,maxPeriods,unitsPerCustomer,lifetimeBudget};
}
function customBaseTitle(s,project){return s.catalog.find(title=>title.id===project.baseTitleId && title.unitPrice>0 && title.totalCopies>0 && title.salesModelId!=='dlc' && !title.archived) || null;}
function releaseCustomProject(s){
  const project=activePlanningProject(s),p=currentProject(s);
  if(s.progress<p.target || customProduction(s).releaseBlockers.length)return null;
  runBuild(s,'release');if(s.crashed || s.defects>defectLimit(s)*.1 || knowledgeRatio(s)<1)return null;
  const q=quality(s),forecast=customSalesForecast(s,project,q),grossPayout=forecast.launchGross,salesFee=grossPayout*Math.min(1,forecast.storeFeeRate+forecast.engineFeeRate),payout=grossPayout-salesFee;
  const seen=s.planner.knowledge.genres.includes(project.snapshot.plan.genreId) && project.snapshot.features.every(feature=>s.planner.knowledge.testedFeatures.includes(feature.id));
  earn(s,payout);s.stats.storeFees=add(s.stats.storeFees,salesFee);learnPlanning(s,project);verifiedFoundations(s);
  const playableCharacters=project.snapshot.features.filter(feature=>['rules','content','system','interface'].includes(feature.category)).reduce((sum,feature)=>sum+feature.codeLines*40,0);
  const scope=Math.min(6,Math.max(0,Math.floor(Math.log10(Math.max(1,playableCharacters)/3000))+1)),earnedExperience=seen?emptyExperience():experienceReward(scope);
  for(const type of EXPERIENCE_TYPES){const cap=experienceCap(scope);earnedExperience[type.id]=Math.min(earnedExperience[type.id],cap?Math.max(0,cap[type.id]-(s.experience[type.id] || 0)-s.runExperience[type.id]):earnedExperience[type.id]);s.runExperience[type.id]=add(s.runExperience[type.id],earnedExperience[type.id]);}
  const reaction=forecast.commercial?'遊んだ人から反応が届いた。次の企画に生かせる手掛かりが残った。':'遊べる一本を公開。実装と遊びの組合せを確かめました。';
  const title={id:`release-${s.nextTitleId++}`,name:project.name,quality:q,royalty:0,payout,grossPayout,salesFee,index:Math.min(6,scope),custom:true,planning:{genreId:project.snapshot.plan.genreId,engineId:project.snapshot.plan.engineId,targets:cloneWork(project.snapshot.plan.targets),features:project.snapshot.features.map(feature=>feature.id),salesModelId:forecast.modelId},planSnapshot:cloneWork(project.snapshot.plan),online:p.online,serverDaily:p.serverDaily,active:true,technicalDebt:s.debt,defects:s.defects,reviewedAt:s.reviewedAt,builds:s.build.count,productionCosts:project.paid,services:[],unitPrice:forecast.price,totalCopies:forecast.copies,soldCopies:forecast.price?grossPayout/forecast.price:0,salesRemaining:forecast.tailGross,salesHalfLife:forecast.halfLife,salesEarned:grossPayout,reaction,experienceEarned:earnedExperience,storeFeeRate:forecast.storeFeeRate,engineFeeRate:forecast.engineFeeRate,salesModelId:forecast.modelId};
  title.baseTitleId=project.baseTitleId;title.operatingLines=project.snapshot.costs.filter(cost=>cost.kind==='recurring').map(cost=>({id:cost.id,name:cost.name,payee:cost.payee,amount:cost.amount}));title.feePayees=(project.snapshot.sales?.feePayees || []).map(payee=>typeof payee==='string'?payee:payee.payee || payee.name);if(forecast.engineFeeRate)title.feePayees.push('エンジン開発元');
  Object.assign(title,{revenueUnitKind:forecast.revenueUnitKind,audienceCount:forecast.audienceCount,customerCount:forecast.customerCount,revenueUnitCount:forecast.revenueUnitCount,maxPeriods:forecast.maxPeriods,unitsPerCustomer:forecast.unitsPerCustomer,lifetimeBudget:forecast.lifetimeBudget,soldRevenueUnits:title.soldCopies});
  title.royalty=titleSalesRate(title);s.catalog.push(title);archiveTitles(s);s.stats.releases++;s.runReleased++;s.runBest=Math.max(s.runBest,scope+1,2);
  project.work=captureProjectWork(s);project.status='released';s.planner.active=null;
  const tutorial=s.planner.tutorial;s.projectIndex=tutorial?.projectIndex ?? s.projectIndex;restoreProjectWork(s,tutorial?.work);s.planner.tutorial=null;resetTypingProject(s);
  log(s,`${title.name}を${forecast.commercial?'発売':'無料公開'}！ ${reaction}`,'success');return title;
}
export const level = (s, id) => s.items[id] || 0;
export const availableOfficeWork = s => Math.max(0,s.office?.remaining ?? OFFICE_CONTRACT_WORK);
export const shopUnlocked = (s,item) => Math.max(s.projectIndex,s.runBest)>=item.gate;
export const metaBonus = s => (1 + Math.sqrt(s.assets) * 0.5) * experienceEffects(s.experience).speed;
export function projectAccess(s,index=s.projectIndex){
  if(index===s.projectIndex && activePlanningProject(s))return {allowed:true,requirements:[],missing:[],grandfathered:false,reason:''};
  const wanted=experienceRequirements(index),requirements=[];
  for(const type of EXPERIENCE_TYPES){
    const required=wanted.experience[type.id],current=s.experience?.[type.id] || 0;
    if(required)requirements.push({id:type.id,name:type.name,current,required,met:current>=required,kind:'experience'});
  }
  for(const [id,required] of Object.entries(wanted.items)){
    const current=level(s,id),name=SHOP.find(item=>item.id===id)?.name || id;
    requirements.push({id,name,current,required,met:current>=required,kind:'item'});
  }
  const grandfathered=Number.isInteger(s.legacyPermit) && index<=s.legacyPermit;
  const missing=grandfathered?[]:requirements.filter(r=>!r.met);
  return {allowed:!missing.length,requirements,missing,grandfathered,reason:missing.map(r=>`${r.name} ${r.current}/${r.required}`).join('・')};
}
export const projectReadiness = s => ({...developmentReadiness(s),access:projectAccess(s)});
export function selectProject(s,index){
  if(activePlanningProject(s))return false;
  if(!Number.isSafeInteger(index) || index<0 || index>1e6 || index===s.projectIndex || !projectAccess(s,index).allowed)return false;
  const carryOnly=s.projectCarryover && !s.progress && !s.defects && Object.entries(s.debtSources).every(([id,n])=>id==='reuse' || !n);
  if(s.progress || s.debt && !carryOnly || s.defects || s.crashed || Object.keys(s.production).length || needsBuild(s) && !carryOnly)return false;
  s.projectIndex=index;s.refactor=false;s.build=createBuildState();markBuildChanges(s,s.debt);s.autoEnabled=false;
  log(s,`${projectAt(index).name} の新作制作を始めます。`,'success');
  return true;
}
export function salesForecast(s,index=s.projectIndex,q=quality(s)){
  if(index===s.projectIndex && activePlanningProject(s))return customSalesForecast(s,activePlanningProject(s),q);
  const terms=salesTerms(index),commercial=index>=2 && q>=60;
  const copies=commercial?Math.max(1,Math.floor(terms.copies*experienceEffects(s.experience).audience*q/100)):0;
  const gross=bounded(terms.price*copies),launchGross=bounded(terms.price*Math.floor(copies*.25));
  return {commercial,price:terms.price,copies,gross,launchGross,tailGross:gross-launchGross,halfLife:terms.halfLife};
}
export const serverCost = (s, title) => title.online && title.active !== false ? bounded((title.serverDaily || 0) * (level(s, 'kitchen') ? 0.75 : 1)) : 0;
export const operatingCost = s => bounded(s.catalog.reduce((total, title) => total + serverCost(s, title), 0));
export const dailyBillEstimate = s => s.dailyAccrued + operatingCost(s) * (DAY - s.dayElapsed) / DAY;
// Routine data entry keeps its contract price; game releases grow game sales.
export const workRate = () => 1;
export const handPower = s => bounded((1 + level(s, 'keyboard') * 0.25) * metaBonus(s) * (s.cash < 0 ? 0.5 : 1));
export const skillKnowledge = (s,id) => Math.max(0,s.skills[id]-(s.studyGaps?.[id] || 0));
export function knowledgeRatio(s) {
  const requirements=Object.entries(currentProject(s).req).filter(([,required])=>required>0);
  return requirements.length?Math.min(...requirements.map(([id, req]) => skillKnowledge(s,id) / req)):1;
}
export function validity(s) {
  const ratio = knowledgeRatio(s);
  return ratio < 0.5 ? 0 : ratio < 1 ? (ratio - 0.5) * 2 : 1;
}
// Uses the same boundaries as code conversion, including exactly 50% = zero.
export function developmentReadiness(s) {
  const requirements = Object.entries(currentProject(s).req).map(([id, required]) => ({ id, required, current: skillKnowledge(s,id), missing: Math.max(0, required - skillKnowledge(s,id)) }));
  const stage = !projectAccess(s).allowed ? 'experience' : s.crashed || s.defects > defectLimit(s) * .1 ? 'repair' : s.progress >= currentProject(s).target ? 'complete' : knowledgeRatio(s) >= 1 ? 'ready' : validity(s) > 0 ? 'prototype' : 'learn';
  return { stage, requirements };
}
export function learningGoal(s) {
  const requirements=Object.entries(currentProject(s).req).map(([id,required])=>({id,required,current:skillKnowledge(s,id)}));
  const missing=requirements.filter(r=>r.current<r.required).sort((a,b)=>a.current/a.required-b.current/b.required);
  // Finish the subject the player chose before suggesting another one.
  const next=(s.mode==='study' && missing.find(r=>r.id===s.subject)) || missing[0] || null;
  return {next,completed:requirements.length-missing.length,total:requirements.length,progress:requirements.reduce((sum,r)=>sum+Math.min(1,r.current/r.required),0)/requirements.length};
}
export const READING_UNITS = 120;
export function readingLesson(s) {
  const key = `${s.typing.language}/${s.subject}`;
  return lessonAt(s.typing.language, s.subject, s.reading.cursors[key] || 0);
}
export function nextReading(s) {
  const key = `${s.typing.language}/${s.subject}`;
  s.reading.cursors[key] = ((s.reading.cursors[key] || 0) + 1) % TOPICS_PER_SUBJECT;
}
export const QUIZ_UNITS = 1200;
export const QUIZ_DRAFT_LIMIT = 24000;
export function quizLesson(s) {
  return quizAt(s.typing.language, s.subject, s.quiz.cursors[`${s.typing.language}/${s.subject}`] || 0);
}
export function nextQuiz(s) {
  const key = `${s.typing.language}/${s.subject}`;
  s.quiz.cursors[key] = ((s.quiz.cursors[key] || 0) + 1) % QUIZ_TOPICS_PER_SUBJECT;
}
export function setQuizDraft(s, source) {
  if (typeof source !== 'string' || source.length > QUIZ_DRAFT_LIMIT) return false;
  const id = quizLesson(s).id;
  delete s.quiz.drafts[id];
  s.quiz.drafts[id] = source;
  // Keep unfinished work without letting an optional code editor fill the save.
  while (Object.keys(s.quiz.drafts).length > 12) delete s.quiz.drafts[Object.keys(s.quiz.drafts)[0]];
  return true;
}
export function completeQuiz(s, id) {
  const lesson = quizLesson(s);
  if (id !== lesson.id || !hasStudyMaterial(s)) return { kind: 'none', amount: 0 };
  if (s.quiz.completed.includes(id)) return { kind: 'answered', amount: 0 };
  s.quiz.completed.push(id);
  const reward = input(s, { mode: 'study', subject: s.subject, chars: QUIZ_UNITS, manual: false });
  return { kind: 'correct', amount: reward.amount };
}
export function answerReading(s, choice) {
  if (!hasStudyMaterial(s)) return { kind: 'textbook', amount: 0 };
  const lesson = readingLesson(s);
  if (Object.hasOwn(s.reading.answers, lesson.baseId)) return { kind: 'answered', amount: 0 };
  if (!Number.isSafeInteger(choice) || !questionFor(lesson).choices.includes(choice)) return { kind: 'none', amount: 0 };
  s.reading.answers[lesson.baseId] = choice;
  const correct = choice === lesson.answer;
  const reward = correct ? input(s, { mode: 'study', subject: s.subject, chars: READING_UNITS, manual: false }) : { amount: 0 };
  return { kind: correct ? 'correct' : 'incorrect', amount: reward.amount };
}
export const debtLimit = s => (activePlanningProject(s)?.defectBase || currentProject(s).target) * 0.25;
export const defectLimit = s => (activePlanningProject(s)?.defectBase || currentProject(s).target) * 0.25;
export function productionOptions(s){
  if(activePlanningProject(s))return [];
  if(s.projectIndex<2)return [];
  const terms=salesTerms(s.projectIndex),budget=bounded(terms.price*terms.copies*.05);
  const qualityBefore=quality(s);
  return PRODUCTION_SERVICES.map(service=>({...service,...(s.projectIndex===2?{name:service.id==='graphics'?'2D素材パック':'音楽・効果音素材ライセンス',payee:'素材ストア・制作者'}:{}),cost:bounded(budget*service.share),ordered:!!s.production[service.id],qualityBefore,qualityAfter:Math.min(100,qualityBefore+(s.production[service.id]?0:service.bonus))}));
}
export const productionCost=s=>bounded(Object.values(s.production).reduce((sum,order)=>sum+order.paid,0));
export function orderProduction(s,id){
  const quote=productionOptions(s).find(q=>q.id===id);
  if(!quote || quote.ordered || s.cash<quote.cost || quote.qualityAfter<=quote.qualityBefore)return false;
  s.cash-=quote.cost;s.production[id]={paid:quote.cost};
  s.stats.outsourcing=add(s.stats.outsourcing,quote.cost);
  checkChangedCode(s,1,'assets');
  log(s,`${quote.payee}へ${quote.name}を依頼。制作費 ¥${quote.cost.toLocaleString('en-US')}を支払い、納品素材を組み込みました。`,'success');
  return true;
}
export const buildStep=s=>buildStepFor(currentProject(s).target);
export function runBuild(s,trigger='manual'){
  if(!needsBuild(s))return null;
  const status=s.crashed?'compile-failed':s.defects>defectLimit(s)*.1?'test-failed':s.defects>0?'warnings':'passed';
  const previous=s.build.last?.status;
  const checks=trigger==='automatic'?Math.max(1,Math.floor(s.build.changed/buildStep(s))):1;
  const result={status,trigger,revision:s.build.revision,progress:s.progress,defects:s.defects,time:s.stats.time,checks};
  Object.assign(s.build,{checkedRevision:s.build.revision,changed:0,checkedProgress:s.progress,knownDefects:s.defects,count:Math.min(1e250,s.build.count+checks),last:result});
  s.build.history.push(result);if(s.build.history.length>6)s.build.history.shift();
  if(previous!==status){
    const message={ 'compile-failed':'途中ビルド失敗。必要理解度を満たし、不具合の修正が必要です。', 'test-failed':'ビルド成功。テストで公開前に修正が必要な問題を確認しました。', warnings:'ビルド成功。テストで小さな修正点を確認。機能追加を続けられます。', passed:'ビルド・テスト成功。次の変更へ進めます。' }[status];
    log(s,message,status==='compile-failed' || status==='test-failed'?'error':status==='passed'?'success':'info');
  }
    verifiedFoundations(s);
  return result;
}
function checkChangedCode(s,amount,trigger='automatic',force=false){
  markBuildChanges(s,amount);
  if(force || s.build.changed>=buildStep(s) || s.progress>=currentProject(s).target)runBuild(s,trigger);
}
export const developmentEfficiency = s => maintenanceEfficiency(s,debtLimit(s),DAY);
export const defectRepairRate=s=>2*(1+knowledgeRatio(s));
export const debtRepairRate=s=>.25+.25*Math.min(3,Math.max(1,knowledgeRatio(s)));
export function maintenanceGain(s,chars=handPower(s)){
  if(knowledgeRatio(s)<1)return {fixed:0,amount:0};
  const rate=defectRepairRate(s),fixed=Math.min(s.defects,bounded(chars*rate));
  return {fixed,amount:Math.min(s.debt,bounded(Math.max(0,chars-fixed/rate)*debtRepairRate(s)))};
}
export function developmentGain(s,chars=handPower(s),manual=true){
  if(s.crashed || s.refactor || !projectAccess(s).allowed)return 0;
  const ratio=knowledgeRatio(s);
  return Math.min(currentProject(s).target-s.progress,bounded(chars*validity(s)*abstraction(s)*(manual && ratio>=1?ideMultiplier(s):1)*developmentPolicy(s).speed*developmentEfficiency(s)));
}
export function setDevelopmentPolicy(s,id){
  if(!DEVELOPMENT_POLICIES.some(p=>p.id===id))return false;
  s.developmentPolicy=id;return true;
}
export function libraryDebtImport(s){
  return !level(s,'library')?Math.max(0,Math.min(LIMIT-s.debt,(s.catalog.at(-1)?.technicalDebt || 0)*.25)):0;
}
export const abstraction = s => Math.min(3, Math.max(1, 1 + (knowledgeRatio(s) - 1) * 0.3));
export const royaltyRate = s => bounded(s.catalog.reduce((sum, p) => sum + titleSalesRate(p), 0));
export const finiteSalesGross = (s,seconds) => bounded(s.catalog.reduce((sum,p)=>sum+salesDuring(p,seconds),0));
const titleFeeRate=title=>Math.min(1,title.custom?(title.storeFeeRate ?? STORE_FEE_RATE)+(title.engineFeeRate || 0):STORE_FEE_RATE);
const titleFeesDuring=(title,seconds)=>Array.isArray(title.salesBatches)?title.salesBatches.reduce((sum,batch)=>sum+(title.active===false || batch.active===false?0:Math.max(0,batch.remaining || 0)*-Math.expm1(-Math.LN2*seconds/Math.max(1,batch.halfLife || DAY))*(batch.feeRate ?? STORE_FEE_RATE)),0):salesDuring(title,seconds)*titleFeeRate(title);
export const netRoyaltyRate = s => bounded(s.catalog.reduce((sum,title)=>sum+(title.active===false?0:Array.isArray(title.salesBatches)?title.salesBatches.reduce((amount,batch)=>amount+(batch.active===false?0:Math.max(0,batch.remaining || 0)*Math.LN2/Math.max(1,batch.halfLife || DAY)*(1-(batch.feeRate ?? STORE_FEE_RATE))),0):titleSalesRate(title)*(1-titleFeeRate(title))),0));
export function expenseLines(s) {
  const lines = [];
  for(const title of s.catalog){
    const fee=titleFeesDuring(title,DAY);
    if(fee)lines.push({name:`${title.name} / 販売・決済・基盤契約手数料`,payee:title.feePayees?.join('・') || 'ゲーム配信ストア',daily:fee,terms:Array.isArray(title.salesBatches)?'配信先ごとの契約率・売上時に精算':`今後1日の販売見込の${Math.round(titleFeeRate(title)*100)}%・売上時に精算`});
    if(serverCost(s,title)){
      if(title.custom && title.operatingLines?.length)for(const cost of title.operatingLines)lines.push({name:`${title.name} / ${cost.name}`,payee:cost.payee,daily:cost.amount*(level(s,'kitchen')?.75:1),terms:'公開中のみ発生・日次精算'});
      else lines.push({ name: `${title.name} / サーバー稼働料`, payee: 'ホスティング会社', daily: serverCost(s, title), terms: '公開中のみ発生・日次精算' });
    }
  }
  return lines;
}
export function setPublicationActive(s, index, active) {
  const title = typeof index === 'string' ? s.catalog.find(p=>p.id===index) : s.catalog.find(p => p.index === index);
  if (!title) return false;
  title.active = !!active;
  log(s, `${title.name} の公開を${active ? '再開' : '停止'}しました。`, 'info');
  return true;
}
export function unitRate(s, id) {
  const l = level(s, id);
  if (!l) return 0;
  if (id === 'macro') return bounded(OCR_BASE_RATE * metaBonus(s));
  const config = { library: [2, 1.6], assistant: [8, 1.7], engineer: [80, 1.8], lab: [8, 1.8], cluster: [3500, 2] }[id];
  return bounded(config[0] * Math.pow(config[1], Math.min(800, l - 1)) * metaBonus(s));
}
export const devCapacity = s => bounded(['library', 'assistant', 'engineer', 'cluster'].reduce((sum, id) => sum + unitRate(s, id), 0));
export const devRate = s => s.autoEnabled ? devCapacity(s) : 0;
export const hasTextbook = (s, id = s.subject) => level(s, `book-${id}`) > 0;
export const hasStudyMaterial = (s, id = s.subject) => hasTextbook(s,id) || !!s.onlineMaterials?.includes(id);
export function openOnlineMaterial(s,id=s.subject){
  const skill=SKILLS.find(skill=>skill.id===id);
  if(!skill || s.onlineMaterials?.includes(id))return false;
  s.onlineMaterials ||= [];
  s.onlineMaterials.push(id);
  log(s,`${skill.name}のオンライン教材を開きました。`,'success');
  return true;
}
export const studyMultiplier = (s, id = s.subject) => hasStudyMaterial(s, id) ? bounded((1 + level(s, `book-${id}`)) * (1 + level(s, 'monitor') * 0.25)) : 0;
export const ideMultiplier = s => 1 + level(s, 'ide') * 0.35;
export function typingPower(s,mode=s.mode,subject=s.subject){
  const capacity=mode==='work'?unitRate(s,'macro'):mode==='study'?(hasStudyMaterial(s,subject)?unitRate(s,'lab'):0):devCapacity(s);
  const ide=mode==='dev' && !s.refactor && knowledgeRatio(s)>=1?ideMultiplier(s):1;
  const perSecond=TYPING_REFERENCE_RATE*(TYPING_REWARD.character+typingCompletionMultiplier(mode));
  return bounded(handPower(s)+capacity*TYPING_AUTOMATION_SHARE/perSecond/ide*(s.cash<0 ? .5 : 1));
}
export function studyGain(s, chars = handPower(s), subject = s.subject) {
  let before = s.skills[subject];
  let xp = bounded(chars * STUDY_XP * studyMultiplier(s, subject));
  if (!xp) return 0;
  let foundationGain = 0;
  if (subject === 'syntax' && before < SYNTAX_FOUNDATION_LIMIT) {
    // Keep the first project's foundation steady: the whole 0→12 interval
    // costs 75% of its previous XP. Saved knowledge keeps its existing value.
    const remaining = (SYNTAX_FOUNDATION_LIMIT - before) * SYNTAX_FOUNDATION_COST;
    if (xp <= remaining) return xp / SYNTAX_FOUNDATION_COST;
    foundationGain = SYNTAX_FOUNDATION_LIMIT - before;
    xp -= remaining;
    before = SYNTAX_FOUNDATION_LIMIT;
  }
  if (!before) return xp ** (1 / SKILL_EXPONENT);
  // Ratio form avoids overflowing K^1.5 and preserves small incremental gains.
  const ratio = xp / before / before ** (SKILL_EXPONENT - 1);
  return bounded(foundationGain + (Number.isFinite(ratio) ? before * Math.expm1(Math.log1p(ratio) / SKILL_EXPONENT) : xp ** (1 / SKILL_EXPONENT)));
}
export function studyPreview(s,chars=handPower(s),subject=s.subject){
  const gain=studyGain(s,chars,subject);
  return gain+Math.min(s.studyGaps?.[subject] || 0,gain);
}
export function autoStudySubject(s) {
  let subject = null, lowest = 1, missing = false;
  for (const [id, requirement] of Object.entries(currentProject(s).req)) {
    const ratio = skillKnowledge(s,id) / requirement;
    if (ratio < 1) missing = true;
    if (hasStudyMaterial(s, id) && ratio < lowest) { lowest = ratio; subject = id; }
  }
  if (missing) return subject;
  return hasStudyMaterial(s) ? s.subject : SKILLS.find(skill => hasStudyMaterial(s, skill.id))?.id || null;
}
export const itemCost = (s, item) => bounded(!level(s, item.id) && item.initial !== undefined ? item.initial : item.base * Math.pow(item.growth, Math.min(800, level(s, item.id))));
export const netIncome = s => (availableOfficeWork(s)>0?unitRate(s, 'macro') * workRate(s)*(1-(1+OCR_RESUBMISSION_FEE)/OCR_ERROR_INTERVAL):0) + netRoyaltyRate(s) - operatingCost(s) / DAY;
export function log(s, text, kind = 'info') {
  if (s.log.at(-1)?.text === text) return;
  s.log.push({ text, kind, day: s.day });
  if (s.log.length > 50) s.log.shift();
}
export function checkAchievements(s) {
  const unlocked = [];
  for (const a of ACHIEVEMENTS) if (!s.achievements.includes(a.id) && a.test(s)) { s.achievements.push(a.id); unlocked.push(a); }
  return unlocked;
}
export function buy(s, id) {
  const item = SHOP.find(i => i.id === id);
  if (!item || !shopUnlocked(s,item) || (item.max && level(s, id) >= item.max) || s.cash < itemCost(s, item)) return false;
  const imported=id==='library'?libraryDebtImport(s):0;
  s.cash -= itemCost(s, item);
  s.items[id] = level(s, id) + 1;
  if(imported>0){
    const previousReview=s.debt?s.reviewedAt:s.stats.time;
    addDebt(s,{reuse:imported},LIMIT);
    s.reviewedAt=Math.min(previousReview,s.catalog.at(-1)?.reviewedAt ?? s.stats.time);
    checkChangedCode(s,imported,'library');
    if(!s.progress && !s.defects && !s.crashed && Object.entries(s.debtSources).every(([source,n])=>source==='reuse' || !n))s.projectCarryover=true;
    log(s,'前作の補助コードをライブラリへ流用。未整理部分の25%も引き継ぎました。');
  }
  log(s, `${item.name} Lv.${level(s, id)} を導入しました。`, 'success');
  return true;
}
function earn(s, money) {
  s.cash = Math.min(LIMIT, s.cash + money);
  s.stats.earned = add(s.stats.earned, money);
}
export const ocrReserve = s => level(s,'macro')?JOB_SIZE*Math.max(workRate(s),s.ocrJob?.rate || workRate(s))*OCR_RESUBMISSION_FEE:0;
function settleOfficeWork(s,chars,automatic=false){
  const active=automatic?s.ocrJob:s.job,other=automatic?s.job:s.ocrJob,quotes=[];
  if(!active.progress)active.rate=workRate(s);
  let rest=chars;
  // When the contract ends, finish each existing order separately so legacy
  // accepted quotes survive a hand-off between manual entry and OCR.
  const pending=[active,...(!availableOfficeWork(s) && other.progress?[other]:[])];
  for(const job of pending){
    if(!job.progress)continue;
    const needed=JOB_SIZE-job.progress;
    if(rest+1e-7<needed){
      if(!availableOfficeWork(s) && job===active && other.progress && active.progress+other.progress+rest>=JOB_SIZE-1e-7){
        const rate=active.rate!==workRate(s)?active.rate:other.rate;
        rest=Math.max(0,rest-(JOB_SIZE-active.progress-other.progress));
        quotes.push({count:1,rate});active.progress=0;other.progress=0;active.rate=workRate(s);other.rate=workRate(s);
        continue;
      }
      job.progress+=rest;rest=0;break;
    }
    rest=Math.max(0,rest-needed);quotes.push({count:1,rate:job.rate});job.progress=0;job.rate=workRate(s);
  }
  const count=Math.floor(rest/JOB_SIZE);
  if(count)quotes.push({count,rate:workRate(s)});
  if(rest){active.progress+=rest%JOB_SIZE;if(!active.progress)active.rate=workRate(s);}
  if(!active.progress)active.rate=workRate(s);
  let money=0,deduction=0,errors=0,cancelled=0,fee=0,jobs=0;
  for(const quote of quotes){
    money=add(money,bounded(quote.count*JOB_SIZE*quote.rate));jobs+=quote.count;
    if(automatic){const audit=recordOCR(s.ocr,quote.count,quote.rate);deduction=add(deduction,audit.deduction);errors+=audit.errors;cancelled+=audit.cancelled;fee+=audit.fee;}
  }
  if(jobs){s.stats.jobs=add(s.stats.jobs,jobs);earn(s,money);}
  if(deduction){s.cash=Math.max(-LIMIT,s.cash-deduction);s.stats.earned=Math.max(0,s.stats.earned-deduction);}
  if(errors)log(s,`OCRの誤納品 ${errors}件。報酬 ${cancelled}円を取消し、依頼元へ再提出手数料 ${fee}円。訂正すると未受取報酬を回収できます。`,'error');
  return money;
}
function automateOffice(s,chars){
  chars=Math.min(chars,availableOfficeWork(s));if(!(chars>0))return;
  s.office.remaining=Math.max(0,availableOfficeWork(s)-chars);s.stats.chars=add(s.stats.chars,chars);
  settleOfficeWork(s,chars,true);
}
export function input(s, { mode = s.mode, chars = handPower(s), manual = true, countManual = true, subject = s.subject, automation = false } = {}) {
  if (!(chars > 0) || !Number.isFinite(chars)) return { kind: 'none', amount: 0 };
  if (mode === 'study' && !hasStudyMaterial(s, subject)) return { kind: 'textbook', amount: 0 };
  if(mode==='dev' && activePlanningProject(s) && s.planner.allocation==='assets' && !s.refactor)return automation?produceCustomAssets(s,{effort:Math.min(LIMIT,chars),manual:false,automation:true}):{kind:'assets',amount:0};
  if(mode==='work' && s.workTask!=='correction'){
    chars=Math.min(chars,availableOfficeWork(s));
    if(!(chars>0))return {kind:'contract-complete',amount:0,work:0};
    s.office.remaining=Math.max(0,availableOfficeWork(s)-chars);
  }
  chars = Math.min(LIMIT, chars);
  if (manual && countManual) s.stats.manual = add(s.stats.manual, 1);
  s.stats.chars = add(s.stats.chars, chars);
  if (mode === 'work') {
    if(s.workTask==='correction'){
      const result=correctOCR(s.ocr,chars);earn(s,result.recovered);
      return {kind:'correction',amount:result.recovered,completed:result.completed,work:result.workUsed};
    }
    const money=settleOfficeWork(s,chars);
    return { kind:'work',amount:money,work:chars };
  }
  if (mode === 'study') {
    const before = skillKnowledge(s,subject),gain=studyGain(s,chars,subject);
    s.skills[subject] = add(s.skills[subject],gain);
    s.studyGaps ||= Object.fromEntries(SKILLS.map(k=>[k.id,0]));
    const gap=s.studyGaps[subject] || 0,verified=automation?0:Math.min(gap,gain);
    s.studyGaps[subject]=Math.min(s.skills[subject],automation?add(gap,gain*AUTO_STUDY_UNVERIFIED):Math.max(0,gap-verified));
    s.stats.study = add(s.stats.study, chars);
    return { kind: 'study', amount: skillKnowledge(s,subject) - before, verified };
  }
  if(!projectAccess(s).allowed)return {kind:'experience',amount:0};
  s.projectCarryover=false;
  const ratio = knowledgeRatio(s);
  if (s.refactor) {
    if (ratio < 1) return { kind: 'review', amount: 0 };
    if(s.build.knownDefects<s.defects)runBuild(s,'review');
    const {fixed,amount:planned}=maintenanceGain(s,chars);
    s.defects=Math.max(0,s.defects-fixed);
    const amount=repayDebt(s,planned);
    s.stats.debtRemoved=add(s.stats.debtRemoved,amount);s.stats.defectsFixed=add(s.stats.defectsFixed,fixed);
    s.build.knownDefects=Math.min(s.defects,Math.max(0,s.build.knownDefects-fixed));
    if(!s.debt && !s.defects)s.reviewedAt=s.stats.time;
    if(s.crashed && s.defects<=defectLimit(s)*.2){s.crashed=false;log(s,'ビルド復旧。修正したコードで制作を続けられます。','success');}
    checkChangedCode(s,fixed+amount,'repair',fixed>0 && !s.defects || amount>0 && !s.debt);
    return {kind:'refactor',amount,fixed};
  }
  if (s.crashed) return { kind: 'crash', amount: 0 };
  if (s.progress >= currentProject(s).target) return { kind: 'code', amount: 0 };
  const rate = validity(s);
  if (!rate) { s.mistakes = add(s.mistakes, chars); return { kind: 'error', amount: 0 }; }
  if (rate < 1) {
    const bad = chars * (1 - rate);
    s.defects = Math.min(defectLimit(s), s.defects + bad);
    s.mistakes = add(s.mistakes, bad);
    if (s.defects >= defectLimit(s)) {
      s.crashed = true;
      log(s, 'ビルドが通りません。必要理解度を満たし、コードの不具合を修正してください。', 'error');
      checkChangedCode(s,bad,'automatic',true);
      return { kind: 'crash', amount: 0 };
    }
  }
  const accepted=developmentGain(s,chars,manual);
  if(!s.progress && !s.debt)s.reviewedAt=s.stats.time;
  const risk=planningRisk(s);
  const introducedDefects=accepted*changeDefectRate(s,debtLimit(s))*(automation?AUTO_DEVELOPMENT_DEFECTS:1)*(1+risk.integration);
  const sources=incurredDebt(s,accepted,currentProject(s).target);
  sources.coupling*=1+risk.integration+risk.design*.5;
  for(const id of Object.keys(sources))sources[id]*=experienceEffects(s.experience).architecture;
  if(automation)sources.generated=Object.values(sources).reduce((sum,n)=>sum+n,0);
  const debtAdded=addDebt(s,sources,LIMIT);
  s.defects=Math.min(defectLimit(s),s.defects+introducedDefects);
  s.progress = add(s.progress, accepted);
  s.stats.valid = add(s.stats.valid, accepted);
  if(s.defects>=defectLimit(s)){
    s.crashed=true;log(s,'仕様と実装の食い違いでビルドが通りません。レビュー・整理で修正してください。','error');
    checkChangedCode(s,accepted+chars*(1-rate),'automatic',true);
    return {kind:'crash',amount:accepted,debtAdded,introducedDefects};
  }
  checkChangedCode(s,accepted+chars*(1-rate));
  return {kind:rate<1?'defect':'code',amount:accepted,debtAdded,introducedDefects};
}
// At zero understanding generated code is all invalid; unreviewable automation
// also fills the defect budget, rather than silently deleting its mistakes.
function automateDevelopment(s, chars) {
  if(!projectAccess(s).allowed)return;
  if(activePlanningProject(s) && s.planner.allocation==='assets' && !s.refactor){produceCustomAssets(s,{effort:chars,manual:false,automation:true});return;}
  if (knowledgeRatio(s) <= 0.5 && !s.refactor && !s.crashed) {
    s.stats.chars = add(s.stats.chars, chars);
    s.mistakes = add(s.mistakes, chars);
    s.defects = Math.min(defectLimit(s), s.defects + chars);
    if (s.defects >= defectLimit(s)) { s.crashed = true; log(s, '自動生成コードの不具合を確認できず、ビルドが通らなくなりました。', 'error'); }
    checkChangedCode(s,chars,'automatic',s.crashed);
    return;
  }
  input(s, { mode: 'dev', chars, manual: false, automation: true });
}
export function tick(s, seconds, { chargeExpenses = true } = {}) {
  seconds = Math.max(0, Math.min(OFFLINE_LIMIT, seconds));
  // One-second chunks make daily costs, bankruptcy, and debt behave identically
  // for a foreground session and an offline session.
  while (seconds > 1e-6) {
    const dt = Math.min(1, seconds, DAY - s.dayElapsed);
    seconds -= dt;
    s.stats.time += dt;
    s.dayElapsed += dt;
    prepareAutomaticPlan(s);
    const gross = finiteSalesGross(s,dt), fee = chargeExpenses ? s.catalog.reduce((sum,title)=>sum+titleFeesDuring(title,dt),0) : 0;
    for(const title of s.catalog){settleSales(title,dt);if(title.custom)title.soldRevenueUnits=title.soldCopies;}
    earn(s, gross - fee);
    s.stats.storeFees = add(s.stats.storeFees, fee);
    if (unitRate(s, 'macro')) automateOffice(s,bounded(unitRate(s, 'macro') * dt));
    const studySubject = unitRate(s, 'lab') ? autoStudySubject(s) : null;
    if (studySubject) input(s, { mode: 'study', subject: studySubject, chars: bounded(unitRate(s, 'lab') * dt), manual: false, automation: true });
    if (devRate(s) && (s.progress < currentProject(s).target || activePlanningProject(s)?.assetProgress<activePlanningProject(s)?.assetTarget || s.refactor && (s.debt>0 || s.defects>0))) automateDevelopment(s, bounded(devRate(s) * dt));
    if (chargeExpenses) s.dailyAccrued = add(s.dailyAccrued, operatingCost(s) / DAY * dt);
    while (s.dayElapsed >= DAY) {
      s.dayElapsed -= DAY;
      s.day += 1;
      s.cash = Math.max(-LIMIT, s.cash - s.dailyAccrued);
      s.stats.serverFees = add(s.stats.serverFees, s.dailyAccrued);
      s.dailyAccrued = 0;
    }
  }
}
export function quality(s) {
  const assets=PRODUCTION_SERVICES.reduce((sum,p)=>sum+(s.production[p.id]?p.bonus:0),0);
  const designRisk=planningRisk(s).design;
  return Math.round(Math.max(20,Math.min(100,80+Math.min(20,(knowledgeRatio(s)-1)*10)-Math.min(40,s.defects/defectLimit(s)*40)+assets-designRisk*15)));
}
function archiveTitles(s){
  if(s.catalog.length<=100)return;
  const oldest=s.catalog.splice(0,2),batches=[];
  for(const title of oldest){
    const source=title.salesBatches?title.salesBatches.map(batch=>({...batch,active:title.active!==false && batch.active!==false})):[{remaining:remainingSales(title),halfLife:title.salesHalfLife,unitPrice:title.unitPrice,active:title.active!==false,feeRate:titleFeeRate(title)}];
    for(const batch of source){
      const same=batches.find(b=>b.halfLife===batch.halfLife && b.unitPrice===batch.unitPrice && b.active===batch.active && b.feeRate===batch.feeRate);
      if(same)same.remaining=add(same.remaining,batch.remaining);
      else batches.push({...batch});
    }
  }
  const serverDaily=bounded(oldest.reduce((sum,p)=>sum+(p.active===false?0:p.serverDaily || 0),0));
  const archive={id:`archive-${s.nextTitleId++}`,name:'過去の公開作品',index:-1,archived:true,quality:80,payout:0,grossPayout:0,salesFee:0,salesBatches:batches,salesRemaining:batches.reduce((sum,b)=>sum+b.remaining,0),salesHalfLife:DAY,unitPrice:0,totalCopies:oldest.reduce((sum,p)=>sum+(p.totalCopies || 0),0),soldCopies:oldest.reduce((sum,p)=>sum+(p.soldCopies || 0),0),salesEarned:oldest.reduce((sum,p)=>sum+(p.salesEarned || 0),0),serverDaily,online:serverDaily>0,active:true,productionCosts:bounded(oldest.reduce((sum,p)=>sum+(p.productionCosts || 0),0))};
  if(oldest.some(title=>title.custom)){
    archive.custom=true;archive.operatingLines=[];archive.feePayees=[...new Set(oldest.flatMap(title=>title.feePayees || ['ゲーム配信ストア']))];
    for(const title of oldest)if(title.active!==false){
      const costs=title.operatingLines?.length?title.operatingLines:title.serverDaily?[{id:'hosting',name:'サーバー稼働料',payee:'ホスティング会社',amount:title.serverDaily}]:[];
      for(const cost of costs){const previous=archive.operatingLines.find(row=>row.id===cost.id && row.payee===cost.payee);if(previous)previous.amount=add(previous.amount,cost.amount);else archive.operatingLines.push({...cost});}
    }
  }
  archive.royalty=titleSalesRate(archive);s.catalog.unshift(archive);
}
export function projectExperience(s,index=s.projectIndex){
  const reward=experienceReward(index),cap=experienceCap(index);
  const learned=index<2 && s.experiencedProjects.includes(index),claimed=s.completedProjects.includes(index) || learned;
  const potential=Object.fromEntries(EXPERIENCE_TYPES.map(type=>[type.id,learned?0:Math.min(reward[type.id],cap?Math.max(0,cap[type.id]-(s.experience[type.id] || 0)-(s.runExperience[type.id] || 0)):reward[type.id])]));
  return {gain:claimed?emptyExperience():potential,cap,claimed,exhausted:Object.values(potential).every(n=>!n)};
}
export function release(s) {
  if(activePlanningProject(s))return releaseCustomProject(s);
  const p=currentProject(s),index=s.projectIndex;
  if(s.progress<p.target || !projectAccess(s).allowed)return null;
  runBuild(s,'release');
  if(s.crashed || s.defects>defectLimit(s)*.1)return null;
  const q=quality(s),forecast=salesForecast(s,index,knowledgeRatio(s)>=1?q:0);
  const commercial=forecast.commercial,grossPayout=forecast.launchGross,salesFee=grossPayout*STORE_FEE_RATE,payout=grossPayout-salesFee;
  s.stats.storeFees=add(s.stats.storeFees,salesFee);earn(s,payout);
  const firstThisRun=!s.completedProjects.includes(index),earnedExperience=projectExperience(s,index).gain;
  for(const type of EXPERIENCE_TYPES)s.runExperience[type.id]=add(s.runExperience[type.id],earnedExperience[type.id]);
  if(!s.completedProjects.includes(index))s.completedProjects.push(index);
  if(!s.experiencedProjects.includes(index))s.experiencedProjects.push(index);
  const name=firstThisRun?p.name:`${p.name} / 新作 ${s.stats.releases+1}`;
  const reaction=index===0?'最後まで動く一本になった。次は、遊ぶ手触りを作ってみよう。':index===1?'跳ね返す瞬間が気持ちいい。その手触りを、次の企画でも試してみよう。':q>=85?'遊びの工夫が好評。気に入った人が、次の作品も待っている。':'小さな反応が届いた。楽しんでもらえた部分を、次の作品に生かせる。';
  const title={id:`release-${s.nextTitleId++}`,name,quality:q,royalty:0,payout,grossPayout,salesFee,index,online:!!p.online,serverDaily:p.serverDaily || 0,active:true,technicalDebt:s.debt,defects:s.defects,reviewedAt:s.reviewedAt,builds:s.build.count,productionCosts:productionCost(s),services:Object.keys(s.production),unitPrice:forecast.price,totalCopies:forecast.copies,soldCopies:forecast.price?grossPayout/forecast.price:0,salesRemaining:forecast.tailGross,salesHalfLife:forecast.halfLife,salesEarned:grossPayout,reaction,experienceEarned:earnedExperience};
  title.royalty=titleSalesRate(title);s.catalog.push(title);archiveTitles(s);
  s.runReleased+=1;s.runBest=Math.max(s.runBest,index+1);s.stats.releases+=1;
  // A new release can earn money again, but copying a known scope does not
  // replace studying with an unlimited stream of free knowledge rewards.
  if(firstThisRun)for(const [id,req] of Object.entries(p.req))s.skills[id]=add(s.skills[id],req*.05);
  log(s,`${name} を${commercial?'発売':'無料公開'}！ ${reaction}`,'success');
  const carriedDebt=level(s,'library')?s.debt*.25:0,reviewedAt=s.reviewedAt;
  const next=index+1;
  s.projectIndex=projectAccess(s,next).allowed?next:index;
  s.progress=0;s.debt=carriedDebt;s.debtSources=emptyDebtSources();s.debtSources.reuse=carriedDebt;
  s.defects=0;s.reviewedAt=carriedDebt?reviewedAt:s.stats.time;s.build=createBuildState();markBuildChanges(s,carriedDebt);
  s.production={};s.mistakes=0;s.crashed=false;s.refactor=false;s.projectCarryover=carriedDebt>0;
  if(carriedDebt)log(s,'次作でも使う共通ライブラリへ、未整理部分の25%を引き継ぎました。');
  if(devRate(s)){s.autoEnabled=false;log(s,'次作のレビュー待ち。自動開発を停止しました。');}
  return title;
}
export function prestigePreview(s){
  const experience={...s.runExperience},current={...s.experience},next=Object.fromEntries(EXPERIENCE_TYPES.map(type=>[type.id,add(current[type.id] || 0,experience[type.id] || 0)]));
  const gain=Object.values(experience).reduce((sum,n)=>sum+n,0);
  return {available:s.runBest>=2 && gain>0,gain,experience,current,next,effects:{current:experienceEffects(current),next:experienceEffects(next)}};
}
export function prestigeGain(s){const preview=prestigePreview(s);return preview.available?preview.gain:0;}
export function prestige(s,now=Date.now()){
  const preview=prestigePreview(s);if(!preview.available)return null;
  const fresh=createState(now);
  fresh.assets=s.assets;fresh.experience=preview.next;fresh.experiencedProjects=[...s.experiencedProjects];fresh.resets=s.resets+1;
  fresh.achievements=[...s.achievements];fresh.stats={...s.stats};fresh.settings={...s.settings};fresh.inputStyle=s.inputStyle;
  fresh.skills=Object.fromEntries(SKILLS.map(skill=>[skill.id,skillKnowledge(s,skill.id)]));
  fresh.onlineMaterials=[...s.onlineMaterials];fresh.reading=JSON.parse(JSON.stringify(s.reading));
  fresh.quiz=JSON.parse(JSON.stringify(s.quiz));fresh.studyStyle=s.studyStyle;
  fresh.planner.knowledge=JSON.parse(JSON.stringify(s.planner.knowledge));fresh.planner.auto=s.planner.auto;
  fresh.typing=normalizeTypingState(s.typing);
  // A new project must not consume an old partially entered exercise.
  fresh.typing.offset=0;fresh.typing.roundErrors=0;fresh.typing.bonusBase=0;fresh.typing.correction=null;fresh.typing.context='';
  for(let index=1;index<=Math.max(4,s.runBest);index++)if(projectAccess(fresh,index).allowed)fresh.projectIndex=index;
  fresh.subject=Object.keys(projectAt(fresh.projectIndex).req).find(id=>skillKnowledge(fresh,id)<projectAt(fresh.projectIndex).req[id]) || 'syntax';
  fresh.mode=knowledgeRatio(fresh)>=1?'dev':'study';
  log(fresh,`覚えた遊びと制作の経験を持ち、${fresh.resets+1}回目の開発人生へ。確かめた知識も覚えています。`,'success');
  return fresh;
}
export function applyOffline(s, now = Date.now()) {
  const elapsed = Math.max(0, (now - s.savedAt) / 1000);
  const seconds = Math.min(elapsed, OFFLINE_LIMIT);
  const before = { cash: s.cash, progress: s.progress, knowledge: skillKnowledge(s,s.subject) };
  if (seconds > 2) tick(s, seconds, { chargeExpenses: !s.skipOfflineExpenses });
  delete s.skipOfflineExpenses;
  s.savedAt = now;
  return { seconds, capped: elapsed > OFFLINE_LIMIT, cash: s.cash - before.cash, progress: s.progress - before.progress, knowledge: skillKnowledge(s,s.subject) - before.knowledge };
}
export function serialize(s, now = Date.now()) { s.savedAt = now; return JSON.stringify(s); }
export function deserialize(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_SAVE_BYTES || new TextEncoder().encode(raw).byteLength > MAX_SAVE_BYTES) throw new Error('セーブファイルのサイズが不正です。');
  const x = JSON.parse(raw);
  if (!x || x.version !== VERSION) throw new Error('対応していないセーブデータです。');
  if (x.balanceVersion > BALANCE_VERSION) throw new Error('新しいバージョンのセーブです。ゲームを更新してから読み込んでください。', { cause: 'newer-balance' });
  const s = createState();
  const num = (value, fallback = 0, min = 0, max = LIMIT) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : fallback;
  for (const key of ['cash', 'progress', 'debt', 'mistakes', 'assets', 'savedAt']) s[key] = num(x[key], s[key], key === 'cash' ? -LIMIT : 0);
  for (const key of ['resets', 'projectIndex', 'runReleased', 'runBest', 'day']) s[key] = Math.floor(num(x[key], s[key], 0, 1e6));
  for(const type of EXPERIENCE_TYPES){
    s.experience[type.id]=num(x.experience?.[type.id]);
    s.runExperience[type.id]=num(x.runExperience?.[type.id]);
  }
  const indices=value=>Array.isArray(value)?[...new Set(value.filter(index=>Number.isSafeInteger(index) && index>=0 && index<=1e6))].slice(0,1000):[];
  s.completedProjects=indices(x.completedProjects);s.experiencedProjects=indices(x.experiencedProjects);
  s.legacyPermit=x.balanceVersion>=15?Math.floor(num(x.legacyPermit,-1,-1,1e6)):Math.max(s.projectIndex,s.runBest-1);
  s.nextTitleId=Math.max(1,Math.floor(num(x.nextTitleId,1,1,1e12)));
  const enlargedAAA=!(x.balanceVersion>=12) && s.projectIndex===4;
  const scopeScale=!(x.balanceVersion>=11) && s.projectIndex===1 ? .5 : enlargedAAA?1.55:1;
  if(enlargedAAA)s.progress=bounded(s.progress*scopeScale);
  const originalDebt=s.debt;
  s.debt=bounded(s.debt*scopeScale);
  s.day = Math.max(1, s.day);
  const previousDay = x.balanceVersion >= 3 ? DAY : 60;
  s.dayElapsed = num(x.dayElapsed, 0, 0, previousDay - 1e-6) / previousDay * DAY;
  if (x.balanceVersion >= 6) s.dailyAccrued = num(x.dailyAccrued);
  else {
    if (x.balanceVersion >= 3) s.cash = Math.min(LIMIT, s.cash + Math.min(num(x.rentFund), num(x.rentAccrued)));
    // New contracts do not charge for time spent away before this update.
    Object.defineProperty(s, 'skipOfflineExpenses', { value: true, configurable: true });
  }
  s.office.remaining=x.balanceVersion>=15?num(x.office?.remaining,OFFICE_CONTRACT_WORK,0,OFFICE_CONTRACT_WORK):OFFICE_CONTRACT_WORK;
  s.planner=normalizePlannerState(x.planner);
  s.projectCarryover=x.projectCarryover===true;
  s.job.progress = num(x.job?.progress, 0, 0, JOB_SIZE - 1e-9);
  s.job.rate = num(x.job?.rate, workRate(s), 1, 30);
  s.ocrJob.progress=num(x.ocrJob?.progress,0,0,JOB_SIZE-1e-9);
  s.ocrJob.rate=num(x.ocrJob?.rate,workRate(s),1,30);
  if(!(x.balanceVersion>=15))s.office.remaining=Math.max(0,OFFICE_CONTRACT_WORK-s.job.progress-s.ocrJob.progress);
  s.ocr=normalizeOCRLedger(x.ocr);
  if(x.workTask==='correction')s.workTask='correction';
  for (const k of Object.keys(s.stats)) s.stats[k] = num(x.stats?.[k]);
  for (const k of Object.keys(s.skills)) {s.skills[k] = num(x.skills?.[k]);s.studyGaps[k]=num(x.studyGaps?.[k],0,0,s.skills[k]);}
  s.onlineMaterials=SKILLS.filter(skill=>Array.isArray(x.onlineMaterials) && x.onlineMaterials.includes(skill.id)).map(skill=>skill.id);
  for (const item of SHOP) s.items[item.id] = Math.floor(num(x.items?.[item.id], 0, 0, item.max || 800));
  const legacyMacroLevel = Math.floor(num(x.items?.macro, 0, 0, 800));
  s.items.macro = Math.min(1, legacyMacroLevel);
  // Expansions cost 1500 * 2.5^level before OCR became a single purchase.
  // Refund only removed expansions, once; keep existing contract quotes intact.
  const macroRefund = !(x.balanceVersion >= 13) && legacyMacroLevel > 1 ? bounded(2500 * (Math.pow(2.5, legacyMacroLevel - 1) - 1)) : 0;
  if (macroRefund) s.cash = Math.min(LIMIT, s.cash + macroRefund);
  if (['work', 'study', 'dev'].includes(x.mode)) s.mode = x.mode;
  if (SKILLS.some(k => k.id === x.subject)) s.subject = x.subject;
  if (['click', 'typing'].includes(x.inputStyle)) s.inputStyle = x.inputStyle;
  s.typing = normalizeTypingState(x.typing);
  if (['reading','course','quiz'].includes(x.studyStyle)) s.studyStyle = x.studyStyle;
  if (x.settings?.commentLocale === 'en') s.settings.commentLocale = 'en';
  // Rebuild known IDs instead of trusting arbitrary imported object keys.
  const quizIds = new Set();
  for (const language of ['cpp', 'csharp', 'rust', 'go', 'python', 'java', 'sql', 'lua']) for (const subject of SKILLS.map(k => k.id)) {
    const key = `${language}/${subject}`, cursor = x.reading?.cursors?.[key];
    const quizCursor = x.quiz?.cursors?.[key];
    if (Number.isSafeInteger(quizCursor) && quizCursor >= 0 && quizCursor < QUIZ_TOPICS_PER_SUBJECT) s.quiz.cursors[key] = quizCursor;
    if (Number.isSafeInteger(cursor) && cursor >= 0 && cursor < TOPICS_PER_SUBJECT) s.reading.cursors[key] = cursor;
    for (let index = 0; index < TOPICS_PER_SUBJECT; index++) {
      const id = lessonAt(language, subject, index).baseId, answer = x.reading?.answers?.[id];
      if (Number.isSafeInteger(answer)) s.reading.answers[id] = answer;
      const quizId = quizAt(language, subject, index).id; quizIds.add(quizId);
      if (Array.isArray(x.quiz?.completed) && x.quiz.completed.includes(quizId)) s.quiz.completed.push(quizId);
    }
  }
  for (const [id,source] of Object.entries(x.quiz?.drafts && typeof x.quiz.drafts==='object' ? x.quiz.drafts : {}).slice(-12)) {
    if (quizIds.has(id) && typeof source==='string' && source.length<=QUIZ_DRAFT_LIMIT) s.quiz.drafts[id]=source;
  }
  for (const k of ['refactor', 'autoEnabled', 'crashed']) if (typeof x[k] === 'boolean') s[k] = x[k];
  if(!(x.balanceVersion>=12) && s.refactor && s.typing.context.startsWith('dev/') && !s.typing.context.endsWith('/review'))s.typing.context+='/review';
  for (const k of ['sound','reducedMotion']) if (typeof x.settings?.[k] === 'boolean') s.settings[k] = x.settings[k];
  s.progress = Math.min(s.progress, currentProject(s).target);
  if(!(x.balanceVersion >= 8)){
    s.defects=Math.min(s.debt,defectLimit(s));s.debt=0;s.debtSources=emptyDebtSources();s.reviewedAt=s.stats.time;
  }else{
    s.defects=Math.min(num(x.defects)*scopeScale,defectLimit(s));
    setDevelopmentPolicy(s,x.developmentPolicy);
    s.reviewedAt=Math.min(s.stats.time,num(x.reviewedAt,s.stats.time));
    s.debtSources=Object.fromEntries(Object.keys(emptyDebtSources()).map(id=>[id,num(x.debtSources?.[id],0,0,originalDebt)*scopeScale]));
    const normalized=debtBreakdown(s);s.debtSources=emptyDebtSources();for(const c of normalized)s.debtSources[c.id]=c.amount;
  }
  s.crashed = s.crashed || s.defects >= defectLimit(s);
  let savedBuild=x.build;
  if(scopeScale!==1 && savedBuild && typeof savedBuild==='object'){
    // Keep validation history aligned when a release changes project scope.
    const progress=n=>Math.min(num(n)*(enlargedAAA?scopeScale:1),currentProject(s).target);
    const record=r=>r && typeof r==='object'?{...r,progress:progress(r.progress),defects:num(r.defects)*scopeScale}:r;
    savedBuild={...savedBuild,checkedProgress:Math.min(progress(savedBuild.checkedProgress),s.progress),knownDefects:num(savedBuild.knownDefects)*scopeScale,last:record(savedBuild.last),history:Array.isArray(savedBuild.history)?savedBuild.history.map(record):[]};
  }
  s.build=normalizeBuildState(savedBuild,s,currentProject(s).target);
  if(scopeScale!==1 && (s.progress || s.debt || s.defects || s.build.last))markBuildChanges(s,1);
  for(const service of PRODUCTION_SERVICES){
    const order=x.production?.[service.id];
    if(s.projectIndex>0 && order && typeof order==='object' && typeof order.paid==='number' && order.paid>0 && order.paid<=LIMIT && Number.isFinite(order.paid))s.production[service.id]={paid:order.paid};
  }
  s.achievements = ACHIEVEMENTS.filter(a => x.achievements?.includes?.(a.id)).map(a => a.id);
  const usedIds=new Set();
  s.catalog=Array.isArray(x.catalog)?x.catalog.slice(-100).filter(p=>typeof p?.name==='string').map(p=>{
    const index=p.archived?-1:num(p.index,0,0,1e6),project=p.archived?null:projectAt(index);
    const oldScale=!(x.balanceVersion>=13) && !p.archived?({1:20,2:4}[index] || 1):1;
    const oldRoyalty=bounded(num(p.royalty)*oldScale);
    let id=typeof p.id==='string' && /^(?:release|archive)-[0-9]{1,12}$/.test(p.id)?p.id:`release-${s.nextTitleId++}`;
    if(usedIds.has(id))id=`release-${s.nextTitleId++}`;
    usedIds.add(id);s.nextTitleId=Math.max(s.nextTitleId,Number(id.split('-')[1])+1);
    const legacy=!(x.balanceVersion>=15);
    const halfLife=legacy?DAY*8*Math.LN2:num(p.salesHalfLife,DAY,1);
    const tail=legacy?bounded(oldRoyalty*DAY*8):num(p.salesRemaining);
    const title={id,name:p.name.slice(0,100),quality:num(p.quality,80,0,100),payout:num(p.payout),grossPayout:num(p.grossPayout,num(p.payout)),salesFee:num(p.salesFee),index,archived:!!p.archived,online:p.custom?!!p.online:project?!!project.online:!!p.online,serverDaily:p.custom?num(p.serverDaily):project?project.serverDaily || 0:num(p.serverDaily),active:p.active!==false,builds:Math.floor(num(p.builds)),productionCosts:num(p.productionCosts),services:PRODUCTION_SERVICES.filter(service=>Array.isArray(p.services)&&p.services.includes(service.id)).map(service=>service.id),technicalDebt:num(p.technicalDebt),defects:num(p.defects),reviewedAt:Math.min(s.stats.time,num(p.reviewedAt,s.stats.time)),unitPrice:num(p.unitPrice),totalCopies:num(p.totalCopies),soldCopies:num(p.soldCopies),salesRemaining:tail,salesHalfLife:halfLife,salesEarned:num(p.salesEarned,num(p.grossPayout)),reaction:typeof p.reaction==='string'?p.reaction.slice(0,200):'公開した作品の経験を引き継いでいます。',experienceEarned:emptyExperience()};
    if(p.custom){title.custom=true;title.planning=p.planning && typeof p.planning==='object'?JSON.parse(JSON.stringify(p.planning)):{};title.planSnapshot=p.planSnapshot && typeof p.planSnapshot==='object'?JSON.parse(JSON.stringify(p.planSnapshot)):null;title.storeFeeRate=num(p.storeFeeRate,STORE_FEE_RATE,0,1);title.engineFeeRate=num(p.engineFeeRate,0,0,1);title.salesModelId=typeof p.salesModelId==='string'?p.salesModelId:'free';title.baseTitleId=typeof p.baseTitleId==='string'?p.baseTitleId:null;title.revenueUnitKind=['copy','dlc-copy','subscription-period','cosmetic-purchase','ad-view','support-payment','free'].includes(p.revenueUnitKind)?p.revenueUnitKind:'copy';for(const field of ['audienceCount','customerCount','revenueUnitCount','maxPeriods','unitsPerCustomer','lifetimeBudget'])title[field]=num(p[field]);title.soldRevenueUnits=title.soldCopies;title.operatingLines=Array.isArray(p.operatingLines)?p.operatingLines.slice(0,100).filter(cost=>cost && typeof cost.name==='string' && typeof cost.payee==='string').map(cost=>({id:typeof cost.id==='string'?cost.id:'operation',name:cost.name.slice(0,100),payee:cost.payee.slice(0,100),amount:num(cost.amount)})):[];title.feePayees=Array.isArray(p.feePayees)?p.feePayees.filter(payee=>typeof payee==='string').map(payee=>payee.slice(0,100)).slice(0,10):[];}
    if(!legacy && p.archived && Array.isArray(p.salesBatches))title.salesBatches=p.salesBatches.slice(0,100).map(b=>({remaining:num(b?.remaining),halfLife:num(b?.halfLife,DAY,1),unitPrice:num(b?.unitPrice),active:b?.active!==false,feeRate:num(b?.feeRate,STORE_FEE_RATE,0,1)}));
    for(const type of EXPERIENCE_TYPES)title.experienceEarned[type.id]=num(p.experienceEarned?.[type.id]);
    title.salesRemaining=remainingSales(title);title.royalty=titleSalesRate(title);
    return title;
  }):[];
  if(!(x.balanceVersion>=15)){
    const reached=new Set([...s.catalog.filter(p=>p.index>=0).map(p=>p.index),...Array.from({length:Math.min(1000,s.runBest)},(_,i)=>i)]);
    s.completedProjects=[...reached];s.experiencedProjects=[...reached];
    for(const index of reached){const earned=experienceReward(index);for(const type of EXPERIENCE_TYPES)s.runExperience[type.id]=add(s.runExperience[type.id],earned[type.id]);}
  }
  // Log messages are rebuilt instead of trusting imported HTML or metadata.
  s.log = [{ text: 'セーブデータを読み込みました。', kind: 'info', day: s.day }];
  if(!(x.balanceVersion>=15))log(s,'公開作と制作中の進行を引き継ぎました。これまでの作品の経験は、次の人生へ持ち越せます。');
  if (macroRefund) log(s, `OCRの購入済み増設分 ¥${macroRefund.toLocaleString('en-US')}を返金しました。`, 'success');
  if(!(x.balanceVersion>=8) && s.defects)log(s,'以前の負債は、不具合の修正作業として引き継ぎました。技術的負債は未整理の構造を別に記録します。');
  if (x.balanceVersion < 6) log(s, '旧事務所の積立を所持金に戻し、未精算の旧費用を取り消しました。');
  return s;
}
