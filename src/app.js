import { coursesLoaded, installCourses, courseTrack, courseUnit, courseLesson, currentCourseUnit, firstCourseUnit, rememberCourseCursor } from './courses.js';
import {
  DAY, JOB_SIZE, STORE_FEE_RATE, SKILLS, PROJECTS, SHOP, ACHIEVEMENTS, createState, projectAt, level, metaBonus,
  operatingCost, expenseLines, serverCost, setPublicationActive, workRate, handPower, knowledgeRatio, validity, debtLimit,
  abstraction, royaltyRate, unitRate, devRate, studyGain, hasTextbook, ideMultiplier, autoStudySubject, itemCost, netIncome,
  buy, input, tick, release, quality, prestigeGain, prestige, applyOffline,
  developmentReadiness, readingLesson, nextReading, answerReading, READING_UNITS,
  serialize, deserialize, checkAchievements, log
} from './core.js';
import { CURRICULUM_VERSION, lessonAt, questionFor, localeForComments } from './curriculum.js';
import { LANGUAGES, PROMPT_COUNT, TYPING_REWARD, typingCompletionMultiplier, currentPrompt, acceptCharacter } from './typing.js';
import { watchForUpdates } from './updates.js';
import { officeOrderAt, drawOfficeSource } from './office.js';

const $ = id => document.getElementById(id);
const esc = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const paths = {
  code: 'm7 5-7 7 7 7m10-14 7 7-7 7m-3-17-4 20',
  book: 'M4 3h13a3 3 0 0 1 3 3v15H6a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2m-2 14h17M8 7h8M8 11h5',
  wallet: 'M20 8V5H5a3 3 0 0 0 0 6h16v9H5a3 3 0 0 1-3-3V8m19 6h-5v3h5M5 5h15',
  clock: 'M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  keyboard: 'M3 5h18v14H3zM6 9h.1m3 0h.1m3 0h.1m3 0h.1m3 0h.1M6 12h.1m3 0h.1m3 0h.1m3 0h.1m3 0h.1M7 16h10',
  trend: 'M3 17l6-6 4 4 8-10M15 5h6v6',
  settings: 'm10 2-1 3-3 1-3-1-2 4 2 2v3l-2 2 2 4 3-1 3 1 1 3h4l1-3 3-1 3 1 2-4-2-2v-3l2-2-2-4-3 1-3-1-1-3zM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  map: 'm2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3zm6-3v17m8-14v17',
  award: 'M16 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0M8 12l-2 10 6-3 6 3-2-10M5 2h14v7a7 7 0 0 1-14 0z',
  layers: 'm12 2 10 5-10 5L2 7zm-10 10 10 5 10-5M2 17l10 5 10-5',
  info: 'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  compass: 'm16 8-3 5-5 3 3-5zM22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  briefcase: 'M3 7h18v14H3zM8 7V3h8v4M3 11l9 4 9-4m-9 2v4',
  terminal: 'M3 4h18v16H3zm4 5 3 3-3 3m6 0h4',
  bag: 'M5 7h14l2 14H3zm3 1V5a4 4 0 0 1 8 0v3',
  shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6zm-4 10 3 3 5-6',
  save: 'M3 3h15l3 3v15H3zm4 0v6h10V3M7 21v-8h10v8',
  monitor: 'M2 3h20v14H2zm5 19h10m-5-5v5',
  coffee: 'M3 8h13v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zm13 0h2a3 3 0 0 1 0 6h-2M6 2v3m4-3v3m4-3v3',
  spark: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z',
  users: 'M9 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8M2 22v-4a7 7 0 0 1 14 0v4M17 3a4 4 0 0 1 0 8m3 11v-5a5 5 0 0 0-3-4',
  flask: 'M9 2h6m-5 0v7L3 20v2h18v-2L14 9V2M7 14h10',
  server: 'M3 3h18v7H3zm0 11h18v7H3zM7 6.5h.1m0 11h.1M11 7h6m-6 11h6'
};
const icon = id => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[id] || paths.code}"/></svg>`;
document.querySelectorAll('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
export function format(n, digits = 1) {
  if (Math.abs(n) < 10000) return n.toLocaleString('en-US', { maximumFractionDigits: Math.abs(n) < 100 && digits ? digits : 0 });
  const units = ['', '万', '億', '兆', '京', '垓'];
  const index = Math.floor(Math.log10(Math.max(1, Math.abs(n))) / 4);
  if (index >= units.length) return n.toExponential(2).replace('e+', 'e');
  return (n / 1e4 ** index).toLocaleString('en-US', { maximumFractionDigits: 2 }) + units[index];
}
const yen = n => `${n < 0 ? '−' : ''}¥${format(Math.abs(n), Math.abs(n) < 100 ? 2 : 0)}`;
const pct = n => Math.max(0, Math.min(100, n * 100));
const duration = seconds => seconds < 60 ? `${Math.floor(seconds)}秒` : seconds < 3600 ? `${Math.floor(seconds / 60)}分${Math.floor(seconds % 60)}秒` : `${Math.floor(seconds / 3600)}時間${Math.floor(seconds % 3600 / 60)}分`;
const KEY = 'code-typer-idle:save:v1';
let state = createState();
let view = 'workspace', shopTab = 'books', paused = false, blocked = false, canSave = true;
let lastShopKey = '', lastEditorKey = '', lastLogKey = '', lastSkillsKey = '', lastSecondaryKey = '', lastCatalogKey = '';
let lastFrame = performance.now(), sinceSave = 0, dirty = true, offlineResult;
let lastManualTimes = [], tapNumber = 0, soundContext;
let courseLoading;
async function loadCourses() {
  if (!coursesLoaded()) {
    courseLoading ||= import('./course.js').then(module=>installCourses(module.COURSE)).catch(error=>{courseLoading=null;throw error;});
    await courseLoading;
  }
}
let lastCourseKey = '';
let lastReadingKey = '';
let lastOfficeOrder = '';
let composing = false, compositionContext = '', inputContext = '', draftBeforeInput = '';
let loadingNotice = '', futureSave = false;
try {
  const saved = localStorage.getItem(KEY);
  if (saved) {
    try { state = deserialize(saved); }
    catch (error) {
      if (error.cause === 'newer-balance') throw error;
      const backup = localStorage.getItem(`${KEY}:backup`);
      if (!backup) throw new Error('破損したセーブを検出しました。');
      state = deserialize(backup);
      loadingNotice = '前回のセーブを読み込めなかったため、バックアップから復旧しました。';
    }
    offlineResult = applyOffline(state);
  }
} catch (error) {
  canSave = false;
  futureSave = error.cause === 'newer-balance';
  loadingNotice = futureSave ? 'この画面より新しい版のセーブです。保存データを保護して自動保存を停止しました。ゲームを更新してください。' : 'セーブを読み込めません。既存データを保護するため自動保存を停止しました。設定からセーブの読み込み、または新規開始を選べます。';
}

if (state.typing.source === 'course' || state.typing.lastCompleted?.courseUnit) {
  try { await loadCourses(); } catch { loadingNotice = '言語別講座を読み込めません。ページを再読み込みしてください。'; }
}
// Hold the lock for the lifetime of this tab, so a second tab cannot overwrite it.
if (navigator.locks) {
  navigator.locks.request('code-typer-idle:active', { ifAvailable: true }, async lock => {
    if (!lock) {
      blocked = true;
      $('type-button').disabled = true;
      toast('別のタブで起動中です。そちらを閉じて、このページを再読み込みしてください。', 'error', 14000);
      $('save-status').textContent = '別タブで起動中 · このタブは停止しています';
      render();
      return;
    }
    await new Promise(resolve => window.addEventListener('pagehide', resolve, { once: true }));
  });
}

function toast(message, kind = '', ms = 4200) {
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = message;
  $('toasts').append(node);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  setTimeout(() => node.remove(), ms);
}
function save(announce = false) {
  if (blocked || !canSave) { if (announce) toast('保存を停止しています。設定を確認してください。', 'error'); return false; }
  try {
    const old = localStorage.getItem(KEY);
    const data = serialize(state);
    if (old) localStorage.setItem(`${KEY}:backup`, old);
    localStorage.setItem(KEY, data);
    $('save-status').textContent = `自動保存済み · ${new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}`;
    $('save-status').classList.remove('save-error');
    if (announce) toast('このブラウザに保存しました。');
    return true;
  } catch {
    $('save-status').textContent = '保存できません · 設定からセーブを書き出してください';
    $('save-status').classList.add('save-error');
    if (announce) toast('ブラウザに保存できません。設定から書き出して保管してください。', 'error');
    return false;
  }
}

function showModal(title, html) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = html;
  if (!$('modal').open) $('modal').showModal();
}
function help() {
  showModal('遊び方', `<details class="help-section" open><summary>最初の1本を公開する</summary><ol><li><b>日銭ワーク</b>で「クリックして働く」を押すか、原票の項目を入力します。納品バーが100作業量に達するたびに入金されます。</li><li>右の道具箱で<b>教材</b>を開き、「プログラミング基礎教本」を¥1,500で購入します。</li><li><b>写経・学習 → 文法を学ぶ</b>で理解度を12まで上げます。技術理解度の「現在値 / 必要値」を確認してください。</li><li><b>ゲーム開発</b>へ移り、3,000文字まで制作します。「ビルドして公開」が押せるようになったら公開します。最初の数当てゲームは無料公開で、次の案件と設備が解禁されます。</li></ol></details><details class="help-section"><summary>クリックとタイピング</summary><p>入力方式は作業パネル上部で選べます。入力欄をクリックしてもタイピングを開始できます。</p><p>日銭ワークは原票を見て、<b>伝票番号,日付,品名,数量,単価</b>の順に入力します。日付はYYYY-MM-DD。数量と単価は数字だけにし、円記号・桁区切りを除きます。品名の空白は残してください。</p><p>学習・開発では英語コメントを含むコードを入力します。完入力後、下にそのコードのコメントと日本語訳が残ります。設定で英語表示にも切り替えられます。改行はEnter、字下げはTabで字下げ（空白は最大4文字、講座のタブ文字にも対応）。Tabの報酬は1打鍵分です。Shift+TabまたはEscで入力欄から出られます。</p><p>間違えた文字はBackspaceやDeleteで直せます。正しい部分から進捗が入り、完入力で追加ボーナス。誤入力があるとボーナスが減ります。全角英数字は半角へ、伝票の英字は大文字へ揃います。コードの大文字・小文字は区別します。貼り付け・ドロップ・キー長押しでは進みません。</p></details><details class="help-section"><summary>学習・開発が進まないとき</summary><p>学習には分野ごとの教材が必要です。教材名と価格が出ている場合は「教材ショップを見る」から購入し、学ぶ分野を選んでください。</p><p>開発には企画ごとの理解度が必要です。要求の半分以下では進捗が出ず、半分を超えても要求に届かない分野があると<b>技術的負債</b>が増えます。負債が上限に達するとビルドが止まります。</p><p>「参考コードを読む」ではコードの実行結果を選んで答えます。初回正解は理解度に加算され、不正解は報酬なしで解説が出ます。回答した題材は再回答できません。読むだけ・開き直しでは報酬は出ません。教材は写経と共通です。</p><p>必要な全分野を要求値まで学んでから、<b>リファクタリングに切替</b>で負債を減らしてください。負債を十分減らしたら通常の開発へ戻します。公開には進捗の完了と、負債が上限の10%以下であることが必要です。</p><p>2本目以降は必要理解度を満たし、品質60以上で有料発売になります。学習不足やミスが多いと無料公開になる場合があります。</p></details><details class="help-section"><summary>売上と支払い</summary><p>発売した作品は初回売上と継続売上を生みます。ゲーム配信ストアへ販売・決済手数料として<b>売上の25%</b>を支払い、残りが所持金に入ります。</p><p>常時オンライン作品は、公開前に表示するサーバー稼働料をホスティング会社へ支払います。公開中の時間分だけ発生し、日の終わりに精算されます。<b>公開したゲーム → 公開停止</b>で、その後のサーバー代と売上が止まります。既に発生した料金は精算されます。再開すると両方が再開します。</p><p>現在の支払先・用途・金額は上部の<b>支払い内訳</b>で確認できます。支払後に赤字になった場合は、公開を停止して日銭ワークで資金を戻してください。赤字中は手動効率が半分になります。</p></details><details class="help-section"><summary>自動化と離席</summary><p>道具箱の<b>自動化</b>から設備を購入します。伝票OCRは日銭ワーク、研究ラボは教材がある不足分野、自作ライブラリなどは開発を進めます。作業タブを移っても稼働します。</p><p><b>自動開発 ON/OFF</b>で止まるのは開発だけです。理解不足の自動開発も負債になるため、新作公開後は停止します。必要理解度を確認してから再開してください。</p><p>離席中は最大8時間分の自動処理・売上・サーバー代が進みます。購入と作品公開は自分で行います。日付は実時間1時間で1日進みます。設定の「プレイ時間を一時停止」で、開いているタブの処理を止められます。</p></details><details class="help-section"><summary>保存・更新・端末の移動</summary><p>5秒ごとに自動保存します。下部の<b>今すぐ保存</b>でも保存できます。更新のお知らせが出たら<b>保存して更新</b>を押してください。</p><p>端末を移るときは、設定 → <b>セーブを書き出す</b>でファイルを保管し、移動先で<b>セーブを読み込む</b>を使います。読み込みは現在の進行を置き換えます。ブラウザのデータを消すと保存も失われるため、ファイルを保管してください。</p></details><details class="help-section"><summary>資産を引き継いで再出発</summary><p>ローグライク公開後、<b>開発ロードマップ → 資産を引き継いで再出発</b>を選べます。資金・教材・設備・今回の公開作品・読解の回答記録を手放し、コード資産による倍率を得ます。実績と累計記録は残ります。AAAの先にも企画が続きます。</p></details><div class="modal-actions"><button class="primary-button" data-action="close">閉じる</button></div>`);
}
function showCatalog() {
  showModal('公開したゲーム', state.catalog.slice().reverse().map(p => `<div class="catalog-entry"><b>${esc(p.name)}</b><p>${p.active === false ? '公開停止中' : p.royalty ? `売上 ${yen(p.royalty)} / 秒・受取 ${yen(p.royalty * (1 - STORE_FEE_RATE))} / 秒` : '無料公開'} · 品質 ${p.quality} / 100</p>${p.online ? `<p>ホスティング会社 · サーバー代 ${yen(serverCost(state, p))} / 日</p><button class="secondary-button" data-publication="${p.index}" data-active="${p.active === false}">${p.active === false ? `公開を再開（${yen((p.serverDaily || 0) * (level(state, 'kitchen') ? .75 : 1))}/日）` : '公開停止'}</button>` : ''}</div>`).join(''));
}
function settings() {
  showModal('設定とセーブデータ', `<div class="setting-row"><div><b>打鍵音</b><small>小さな電子音を鳴らします</small></div><input type="checkbox" id="sound-setting" aria-label="打鍵音" ${state.settings.sound ? 'checked' : ''}></div><div class="setting-row"><div><b>アニメーションを減らす</b><small>点滅と打鍵エフェクトを停止します</small></div><input type="checkbox" id="motion-setting" aria-label="アニメーションを減らす" ${state.settings.reducedMotion ? 'checked' : ''}></div><div class="setting-row"><div><b>コメントの表示言語</b><small>入力は英語。完入力後と読解の解答後に表示</small></div><select id="comment-locale-setting" aria-label="コメントの表示言語"><option value="ja" ${state.settings.commentLocale === 'ja' ? 'selected' : ''}>日本語</option><option value="en" ${state.settings.commentLocale === 'en' ? 'selected' : ''}>English</option></select></div><div class="setting-row"><div><b>プレイ時間を一時停止</b><small>このタブを開いている間、自動処理・売上・サーバー代の発生を止めます</small></div><button class="secondary-button" data-action="pause">${paused ? '再開する' : '一時停止'}</button></div><h3>データの持ち運び</h3><p>セーブはこのブラウザに保存されます。ブラウザのデータ削除や端末変更に備えて、ファイルにも保管できます。</p><div class="setting-actions"><button class="secondary-button" data-action="export">セーブを書き出す ↓</button><button class="secondary-button" data-action="import" ${blocked ? 'disabled' : ''}>セーブを読み込む ↑</button></div><p class="setting-warning">読み込みは現在の進行を置き換えます。先に書き出すことをおすすめします。</p>${!canSave ? '<div class="modal-callout">現在、自動保存を停止しています。セーブを読み込むか、下の新規開始で保存を再開できます。</div>' : ''}<h3>新しく始める</h3><button class="danger-button" data-action="reset" ${blocked ? 'disabled' : ''}>全データを削除して新規開始</button><p class="setting-warning">コード資産を含むすべての進行が対象です。資産を引き継ぐ再出発はロードマップから。</p>`);
}
function switchView(next) {
  view = next;
  ['workspace', 'roadmap', 'achievements'].forEach(v => $(`${v}-view`).classList.toggle('hidden', v !== view));
  document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const titles = { workspace: ['一文字から、どこまでも', '小さな受託から、ゲームを作る事業へ。'], roadmap: ['次に、何をつくろうか', '小さな習作から、仕様書に収まらない世界へ。'], achievements: ['積み重ねた、開発の記録', '完成したゲームも、遠回りした一文字も。'] }[view];
  $('page-title').innerHTML = `${titles[0]}<span class="title-dot">.</span>`;
  $('page-subtitle').textContent = titles[1];
  render();
}
function switchMode(next) {
  if (blocked) return;
  rememberCourseCursor(state);
  state.mode = next;
  dirty = true;
  render();
  focusTypingInput();
}
function focusTypingInput() {
  if (state.inputStyle === 'typing' && !(state.mode === 'study' && state.studyStyle === 'reading') && !blocked && !paused && view === 'workspace' && !$('modal').open && (state.mode !== 'study' || hasTextbook(state))) $('typing-input').focus({ preventScroll: true });
}
function beep(kind) {
  if (!state.settings.sound) return;
  try {
    soundContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (soundContext.state === 'suspended') soundContext.resume();
    const osc = soundContext.createOscillator(), gain = soundContext.createGain();
    osc.type = 'triangle'; osc.frequency.value = kind === 'error' || kind === 'crash' ? 150 : 450 + (tapNumber % 4) * 70;
    gain.gain.setValueAtTime(0.025, soundContext.currentTime); gain.gain.exponentialRampToValueAtTime(0.001, soundContext.currentTime + 0.04);
    osc.connect(gain); gain.connect(soundContext.destination); osc.start(); osc.stop(soundContext.currentTime + 0.05);
  } catch { /* Sound is optional if the browser cannot play it. */ }
}
function doInput(options = {}) {
  if (blocked || paused) return;
  const result = input(state, options);
  if (options.countManual !== false) { tapNumber++; lastManualTimes.push(performance.now()); }
  lastManualTimes = lastManualTimes.filter(t => t > performance.now() - 2000);
  beep(result.kind);
  let text = { work: result.amount ? `${yen(result.amount)} 納品` : `+${format(result.work)} 作業量`, study: `+${format(result.amount, 2)} K`, code: `+${format(result.amount)} chars`, debt: `+${format(result.amount)} chars / 負債発生`, refactor: `−${format(result.amount)} debt`, error: '理解度不足・有効進捗0', crash: 'Build failed', review: '先に必要な理解度を学習' }[result.kind] || '';
  const floating = $('input-float');
  floating.textContent = text;
  floating.style.color = ['error', 'crash', 'review', 'debt'].includes(result.kind) ? 'var(--red)' : 'var(--green)';
  if (!state.settings.reducedMotion) { floating.classList.remove('animate'); void floating.offsetWidth; floating.classList.add('animate'); }
  if (result.kind === 'error' && tapNumber % 12 === 1) log(state, '理解度不足: まずは要求理解度の50%を超えるまで学習しましょう。', 'error');
  dirty = true;
  unlock(); render();
  return result;
}
function unlock() {
  for (const a of checkAchievements(state)) toast(`実績解除：${a.name}`);
}

function renderSkills() {
  const p = projectAt(state.projectIndex);
  const key = JSON.stringify([state.skills, state.projectIndex]);
  if (key === lastSkillsKey) return;
  lastSkillsKey = key;
  $('skills').innerHTML = SKILLS.map(s => {
    const req = p.req[s.id] || 0, value = state.skills[s.id];
    return `<div class="skill"><div class="skill-top"><span class="skill-name"><span class="skill-number">${s.label}</span>${s.name}</span><span class="skill-value" style="color:${s.color}">${format(value)} <small>/ ${req ? format(req) : '—'}</small></span></div><div class="skill-track"><span style="background:${s.color};width:${req ? pct(value / req) : value ? 100 : 0}%"></span></div><div class="skill-foot"><span>${req ? value >= req ? '必要理解度を達成' : '現在の企画で必要' : 'この企画では要求なし'}</span><span>${req ? `${Math.floor(pct(value / req))}%` : ''}</span></div></div>`;
  }).join('');
}
function renderShop() {
  const key = `${shopTab}/${state.projectIndex}/${JSON.stringify(state.items)}`;
  if (key !== lastShopKey) {
    const focusedItem = document.activeElement?.dataset.buy;
    lastShopKey = key;
    $('shop-intro').textContent = { books: '知識への投資は、ずっと使える。', gear: '道具が変わると、一文字の力が変わる。', auto: '任せるためには、理解が必要。' }[shopTab];
    $('shop-items').innerHTML = SHOP.filter(i => i.tab === shopTab).map(i => {
      const locked = state.projectIndex < i.gate;
      return `<article class="shop-item ${locked ? 'locked' : ''}"><div class="shop-item-top"><span class="item-icon">${icon(i.glyph)}</span><div><h3>${i.name}</h3><span class="item-level">${locked ? `${i.gate}本公開で解禁` : `LEVEL ${String(level(state, i.id)).padStart(2, '0')}`}</span></div></div><p class="item-description">${i.desc}</p><button class="buy-button" data-buy="${i.id}" ${locked ? 'disabled' : ''}><strong>${yen(itemCost(state, i))}</strong><span>購入する ＋</span></button></article>`;
    }).join('');
    if (focusedItem) document.querySelector(`[data-buy="${focusedItem}"]`)?.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-buy]').forEach(b => {
    const i = SHOP.find(i => i.id === b.dataset.buy), owned = i.max && level(state, i.id) >= i.max;
    b.disabled = blocked || state.cash < itemCost(state, i) || state.projectIndex < i.gate || !!owned;
    b.classList.toggle('owned', !!owned);
    b.querySelector('strong').textContent = owned ? '導入済み' : yen(itemCost(state, i));
    b.querySelector('span').textContent = owned ? '✓' : state.projectIndex < i.gate ? '未解禁' : '購入する ＋';
  });
}
function renderEditor() {
  const prompt = currentPrompt(state), t = state.typing;
  const office = state.mode === 'work';
  const studyLocked = state.mode === 'study' && !hasTextbook(state);
  const courseEmpty = state.mode==='study' && state.typing.source==='course' && !courseUnit(state.typing.courseUnit);
  $('typing-input').setAttribute('aria-label', office ? '伝票データ入力' : 'コード入力');
  $('editor-content').setAttribute('aria-label', office ? 'CSV入力結果' : '出題コード');
  $('office-source').classList.toggle('hidden', !office);
  if (office) {
    const order = officeOrderAt(t.index, t.officeVersion);
    if (lastOfficeOrder !== order.input) { drawOfficeSource($('office-image'), order); lastOfficeOrder = order.input; }
  }
  const typing = state.inputStyle === 'typing';
  const offset = typing ? t.offset : Math.floor(state.stats.manual % prompt.length);
  const key = `${state.mode}/${state.subject}/${state.projectIndex}/${t.language}/${t.index}/${offset}/${t.errors}/${typing}/${studyLocked}/${t.courseUnit}/${courseEmpty}`;
  const context = `${t.context}/${t.language}/${t.index}/${t.source}/${t.courseUnit}`;
  if (!composing && inputContext !== context) {
    inputContext = context;
    $('typing-input').value = prompt.slice(0, t.offset);
    $('input-feedback').textContent = '';
  }
  const reading = state.mode === 'study' && state.studyStyle === 'reading';
  $('code-editor').classList.toggle('hidden', reading);
  $('typing-input').hidden = studyLocked || reading || courseEmpty;
  $('typing-input').disabled = blocked || paused || studyLocked || reading || courseEmpty;
  $('typing-input').placeholder = office ? '伝票番号,YYYY-MM-DD,品名,数量,単価' : '上のコードを入力';
  $('typing-label').textContent = office ? '伝票入力' : 'コード入力';
  $('typing-label').classList.toggle('hidden', studyLocked);
  $('editor-content').classList.toggle('hidden', office);
  $('typing-summary').classList.toggle('hidden', !typing || studyLocked);
  $('code-editor').classList.toggle('typing-active', typing);
  if (lastEditorKey !== key) {
    lastEditorKey = key;
    $('editor-content').dataset.prompt = studyLocked || courseEmpty ? '' : prompt;
    $('editor-content').innerHTML = courseEmpty ? '<p class="panel-note">演習一覧から入力する題材を選んでください。</p>' : studyLocked ? '<p class="panel-note">この分野の教材を購入すると、学習用コードが表示されます。</p>' : office ? `<pre class="typing-code"><span class="typed-code">${esc(typing ? prompt.slice(0, offset) : '')}</span><mark class="next-character">▌</mark></pre>` : `<pre class="typing-code"><span class="typed-code">${esc(prompt.slice(0, offset))}</span><mark class="next-character">${prompt[offset] === '\n' ? '↵\n' : esc(prompt[offset] || ' ')}</mark><span class="pending-code">${esc(prompt.slice(offset + 1))}</span></pre>`;
    const mark = $('editor-content').querySelector('mark');
    if (typing && mark) {
      const y = mark.offsetTop;
      if (y < $('editor-content').scrollTop || y > $('editor-content').scrollTop + 200) $('editor-content').scrollTop = Math.max(0, y - 100);
    }
  }
  const prefix = prompt.slice(0, offset).split('\n');
  $('editor-cursor').textContent = `Ln ${prefix.length}, Col ${prefix.at(-1).length + 1}`;
  const field = ['伝票番号', '日付', '品名', '数量', '単価'][prompt.slice(0, t.offset).split(',').length - 1];
  $('editor-status').textContent = studyLocked ? '教材待ち' : office ? `入力中：${field}` : 'CODE';
  $('typing-round').textContent = `${t.offset} / ${prompt.length}文字`;
  $('typing-accuracy').textContent = `正確率 ${((t.correct + t.errors) ? t.correct / (t.correct + t.errors) * 100 : 100).toFixed(1)}%`;
  $('typing-completed').textContent = `完入力 ${t.completed}問`;
}
function renderTask() {
  const p = projectAt(state.projectIndex), mode = state.mode, ratio = knowledgeRatio(state);
  const reading = mode === 'study' && state.studyStyle === 'reading';
  const typing = state.inputStyle === 'typing';
  const language = LANGUAGES.find(l => l.id === state.typing.language);
  const power = handPower(state) * (typing ? TYPING_REWARD.character : 1);
  const actionSlot = $(typing ? 'typing-actions' : 'quick-actions');
  if ($('manual-actions').parentElement !== actionSlot) actionSlot.append($('manual-actions'));
  $('job-progress').classList.toggle('hidden', mode !== 'work');
  $('job-progress-bar').value = state.job.progress;
  $('job-progress-label').textContent = `${format(state.job.progress, 2)} / ${JOB_SIZE} 作業量`;
  $('job-payment').textContent = `納品で ${yen(JOB_SIZE * (state.job.progress ? state.job.rate : workRate(state)))}`;
  document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('active', b.dataset.mode === mode); b.setAttribute('aria-selected', b.dataset.mode === mode); });
  document.querySelectorAll('[data-input-style]').forEach(b => { b.classList.toggle('active', b.dataset.inputStyle === state.inputStyle); b.setAttribute('aria-pressed', b.dataset.inputStyle === state.inputStyle); });
  $('language-select').value = language.id;
  document.querySelector('.input-style-picker').classList.toggle('hidden', reading);
  $('quick-actions').classList.toggle('hidden', reading);
  $('typing-actions').classList.toggle('hidden', reading);
  $('study-style-picker').classList.toggle('hidden', mode !== 'study');
  document.querySelectorAll('[data-study-style]').forEach(b => { b.classList.toggle('active', b.dataset.studyStyle === state.studyStyle); b.setAttribute('aria-pressed', b.dataset.studyStyle === state.studyStyle); });
  document.querySelector('.language-label').classList.toggle('hidden', mode === 'work');
  document.querySelector('[data-input-style=typing]').innerHTML = `${mode === 'work' ? '伝票タイピング' : 'コードタイピング'} <small>報酬UP</small>`;
  $('language-select').title = `${language.description} / 全${PROMPT_COUNT.toLocaleString()}問`;
  $('subject-picker').classList.toggle('hidden', mode !== 'study');
  $('project-progress').classList.toggle('hidden', mode !== 'dev');
  $('dev-actions').classList.toggle('hidden', mode !== 'dev');
  const lesson = SKILLS.find(s => s.id === state.subject);
  const studyLocked = mode === 'study' && !hasTextbook(state);
  const textbook = SHOP.find(item => item.id === `book-${state.subject}`);
  $('study-lock').classList.toggle('hidden', !studyLocked);
  $('study-lock-message').textContent = `学習には「${textbook.name}」（${yen(itemCost(state, textbook))}）が必要です。日銭ワークで資金を貯めて購入してください。`;
  const task = {
    work: ['OFFICE WORK', '伝票画像のデータ化', `紙の原票を読み取り、CSV形式へ整えます。${JOB_SIZE}作業量ごとにまとめて納品。`, '事務作業中', 'invoices', '働く', `+${format(power, 2)} 作業量`],
    study: ['STUDY & UNDERSTAND', `${lesson.name}を学ぶ`, lesson.lesson + (studyLocked ? ' まず、この分野の教材を購入してください。' : ' 購入した教材で学習します。'), studyLocked ? '教材が必要' : '教材で学習中', lesson.file, '学ぶ', studyLocked ? '学習不可' : `+${studyGain(state, power).toLocaleString('en-US', { maximumFractionDigits: 5 })} K`],
    dev: ['BUILD YOUR NEXT GAME', p.name, p.desc, state.crashed ? 'ビルド崩壊' : state.refactor ? '負債を修復中' : ratio >= 1 ? '理解度クリア' : '理解度不足', 'main', state.refactor ? '修復' : '開発', state.refactor ? ratio >= 1 ? `−${format(Math.min(state.debt, power * (1 + ratio) * 2))} debt` : '先に学習が必要' : state.crashed ? 'ビルド崩壊' : `+${format(Math.min(p.target - state.progress, 1e250, power * validity(state) * abstraction(state) * (ratio >= 1 ? ideMultiplier(state) : 1) * (1 - state.debt / debtLimit(state) * .8)))} chars`]
  }[mode];
  ['task-eyebrow', 'task-title', 'task-description'].forEach((id, i) => $(id).textContent = task[i]);
  $('task-status').innerHTML = `<i></i>${task[3]}`;
  $('task-status').className = `status-pill ${mode === 'dev' && state.crashed ? 'error' : mode === 'dev' && ratio < 1 || mode === 'study' && !level(state, `book-${state.subject}`) ? 'warning' : ''}`;
  $('editor-file').textContent = `${task[4]}.${mode === 'work' ? 'csv' : language.extension}`;
  $('editor-language').textContent = mode === 'work' ? 'CSV' : language.name;
  $('type-button').disabled = blocked || paused || studyLocked || mode==='study' && state.typing.source==='course' && !courseUnit(state.typing.courseUnit);
  $('type-label').textContent = studyLocked ? '教材を購入すると学習できます' : paused ? '一時停止中' : typing ? mode === 'work' ? '伝票入力を始める' : 'コード入力を始める' : `クリックして${task[5]}`;
  $('type-hint').textContent = studyLocked ? `${textbook.name} · ${yen(itemCost(state, textbook))}` : paused ? '設定から再開できます' : typing ? mode === 'work' ? '原票を確認し、CSVの項目順に入力' : '光っている文字から、コードどおりに入力' : `タイピングなら完入力で最大×${TYPING_REWARD.character + typingCompletionMultiplier(mode)}`;
  $('output-rate').innerHTML = `${esc(task[6])} <small>/ ${typing ? '正解文字' : 'クリック'}</small>`;
  $('output-label').textContent = mode === 'dev' ? `有効変換率 ${Math.round(validity(state) * 100)}%${ratio >= 1 ? ` / 抽象化 ×${format(abstraction(state), 2)}` : ''}` : typing ? `正解×${TYPING_REWARD.character} ＋ 完入力ボーナス` : 'このクリックで得られるもの';
  $('typing-instructions').textContent = mode === 'work' ? '伝票番号 → 日付 → 品名 → 数量 → 単価' : 'ハイライトされた文字から入力';
  $('subject-picker').querySelectorAll('[data-subject]').forEach(b => { b.classList.toggle('active', b.dataset.subject === state.subject); b.setAttribute('aria-pressed', b.dataset.subject === state.subject); });
  if (mode === 'dev') {
    $('release-cost').textContent = `${state.projectIndex ? '販売時：ゲーム配信ストアへ売上の25%。' : '無料公開。'}${p.online ? ` 公開中：ホスティング会社へ ${yen(p.serverDaily * (level(state, 'kitchen') ? .75 : 1))} / 日。公開停止で以後の料金と売上が止まります。` : ' サーバー契約なし。'}`;
    $('project-progress').innerHTML = `<div class="progress-meta"><span>${format(state.progress)} / ${format(p.target)} chars</span><b>${pct(state.progress / p.target).toFixed(2)}%</b></div><div class="big-track"><span style="width:${pct(state.progress / p.target)}%;background:${state.crashed ? 'var(--red)' : 'var(--green)'}"></span></div><div class="debt-row ${state.crashed ? 'danger' : ''}"><span>技術的負債 <b>${format(state.debt)} / ${format(debtLimit(state))}</b></span><span>公開には負債10%以下が必要</span></div>`;
    $('release-button').disabled = blocked || state.progress < p.target || state.crashed || state.debt > debtLimit(state) * .1;
    $('refactor-button').textContent = state.refactor ? '← 通常の開発に戻る' : 'リファクタリングに切替';
    $('refactor-button').classList.toggle('active', state.refactor);
  }
  renderEditor(); renderLearning(); renderReadiness(); renderCourse();
}
function commentNotes(lesson) {
  const locale = localeForComments(state.settings.commentLocale);
  return lesson.comments.map(comment => `<div class="comment-note"><p lang="en">${esc(comment.en)}</p>${locale === 'ja' ? `<p lang="ja">${esc(comment.ja)}</p>` : ''}</div>`).join('');
}
function renderLearning() {
  const reading = state.mode === 'study' && state.studyStyle === 'reading', locked = state.mode === 'study' && !hasTextbook(state);
  $('reading-panel').classList.toggle('hidden', !reading || locked);
  const last = state.typing.lastCompleted;
  $('completed-notes').classList.toggle('hidden', !last || state.mode === 'work' || reading);
  if (last) {
    const lesson = last.courseUnit ? courseLesson(state.typing.lastCourseComments || last.courseUnit) : lessonAt(last.language, last.subject, last.index);
    if (!lesson) return;
    const notes = `<h3>入力を終えたコード：${esc(LANGUAGES.find(l=>l.id===lesson.language)?.name || '')} / ${esc(lesson.title)}</h3>${commentNotes(lesson)}${last.courseUnit ? '<p class="panel-note">参考実装の入力区間を完了。実行結果は未収録です。</p>' : `<div class="execution-result"><h4>教材の実行結果</h4>${lesson.language==='sql'?'':`<p>呼び出し：<code>${esc(questionFor(lesson).prompt.replace(' の戻り値は？',''))}</code></p>`}<p>${lesson.language==='sql'?'問い合わせ結果':'戻り値'}：<output>${lesson.answer}</output></p><pre class="reading-trace">${esc(lesson.explanation)}</pre></div>`}`;
    if ($('completed-notes').innerHTML !== notes) $('completed-notes').innerHTML = notes;
  }
  const t = state.typing;
  const course = state.mode === 'study' && t.source === 'course' ? courseLesson(t.courseUnit) : null;
  const title = course ? course.title : !reading && state.mode !== 'work' && !locked && t.curriculumVersion === CURRICULUM_VERSION ? lessonAt(t.language, state.mode === 'study' ? state.subject : ['syntax','design','graphics','systems'][Math.min(3, Math.floor(state.projectIndex / 2))], t.index).title : '';
  $('lesson-title').classList.toggle('hidden', !title); $('lesson-title').textContent = title;
  if (!reading || locked) return;
  const lesson = readingLesson(state), question = questionFor(lesson);
  const answered = Object.hasOwn(state.reading.answers, lesson.baseId), choice = state.reading.answers[lesson.baseId];
  const key = JSON.stringify([lesson.id, answered, choice, state.settings.commentLocale, blocked, paused]);
  if (lastReadingKey === key) return;
  lastReadingKey = key;
  const answeredCount = Array.from({length:16}, (_,i)=>lessonAt(lesson.language,lesson.subject,i)).filter(l=>Object.hasOwn(state.reading.answers,l.baseId)).length;
  $('reading-panel').innerHTML = `<p class="panel-note">回答済み ${answeredCount} / 16本 · 各題の初回正解で理解ボーナス</p>${answeredCount === 16 ? '<div class="modal-callout">この言語・分野の読解を一巡しました。写経で学習を続けるか、ほかの言語や分野の参考コードを選べます。<button class="secondary-button" data-study-style="practice">写経で学習を続ける →</button></div>' : ''}<h3>${esc(lesson.title)}</h3><pre class="reference-code" tabindex="0" aria-label="参考コード">${esc(lesson.code)}</pre><h4 id="reading-question" tabindex="-1">${esc(question.prompt)}</h4><div class="reading-choices">${question.choices.map(value => `<button class="secondary-button ${answered && value === lesson.answer ? 'correct-choice' : answered && value === choice ? 'wrong-choice' : ''}" data-read-answer="${value}" ${answered || blocked || paused ? 'disabled' : ''}>${value}${answered && value === lesson.answer ? ' ✓' : ''}</button>`).join('')}</div>${answered ? `<div class="reading-explanation" role="status"><p><b>${choice === lesson.answer ? '正解。理解度を獲得済み。' : '不正解。今回の理解度加算はありません。'}</b> 答えは ${lesson.answer}。</p>${commentNotes(lesson)}<pre class="reading-trace">${esc(lesson.explanation)}</pre></div><button class="secondary-button" data-action="next-reading" ${blocked || paused ? 'disabled' : ''}>次の参考コード →</button>` : `<p class="panel-note">コードの処理を追って、結果を選んでください。初回正解で理解度が増えます。</p><button class="text-button" data-action="next-reading" ${blocked || paused ? 'disabled' : ''}>この題材を後で読む →</button>`}`;
}
function renderReadiness() {
  const {stage, requirements} = developmentReadiness(state), project = projectAt(state.projectIndex);
  const message = stage === 'repair' ? knowledgeRatio(state) < 1 ? '先に不足分野を学び、リファクタリングで負債を修復しよう。' : 'ゲーム開発でリファクタリングに切り替え、負債を修復しよう。' : stage === 'complete' ? '制作は完了。ゲーム開発からビルドして公開しよう。' : stage === 'ready' ? '必要な知識が揃った。ゲーム開発で制作を進めよう。' : stage === 'prototype' ? '試作はできる。学習不足のまま進めると負債が増える。' : '制作には、まず必要な分野の学習を進めよう。';
  const html = `<div class="readiness-heading"><b>${esc(project.name)}</b><span class="readiness-progress">制作 ${format(state.progress)} / ${format(project.target)}文字</span><span>${esc(message)}</span></div><div class="readiness-skills">${requirements.map(r => `<span>${SKILLS.find(k=>k.id===r.id).short} <b>${format(r.current, 2)} / ${format(r.required)}</b>${r.missing > 0 ? ` <button class="text-button" data-learn="${r.id}" ${blocked ? 'disabled' : ''}>あと${format(r.missing, 2)}学ぶ →</button>` : ' ✓'}</span>`).join('')}${(stage !== 'learn' || state.progress > 0) && state.mode !== 'dev' ? `<button class="secondary-button" data-action="go-dev" ${blocked ? 'disabled' : ''}>ゲーム開発へ →</button>` : ''}</div>`;
  if ($('development-readiness').innerHTML !== html) {
    const focused = document.activeElement?.dataset.learn;
    $('development-readiness').innerHTML = html;
    if (focused) $('development-readiness').querySelector(`[data-learn="${focused}"]`)?.focus({preventScroll:true});
  }
}
function renderCourse() {
  const active=state.mode==='study' && state.studyStyle==='course';
  $('course-panel').classList.toggle('hidden',!active);
  if(!active)return;
  const track=courseTrack(state.typing.language);
  if(!track){$('course-panel').textContent='講座を読み込めません。ページを再読み込みしてください。';return;}
  const unit=currentCourseUnit(state), lesson=unit?courseLesson(unit.id):null;
  const key=JSON.stringify([state.typing.language,state.subject,unit?.id,state.typing.courseCompleted.length,hasTextbook(state),blocked]);
  if(lastCourseKey===key)return;lastCourseKey=key;
  const total=Object.values(['cpp','csharp','rust','go','python','java','sql','lua'].map(id=>courseTrack(id))).reduce((n,t)=>n+t.exercises.length,0);
  const exercise=lesson?.exerciseInfo;
  $('course-panel').innerHTML=`<h3>言語別の講座</h3><p>${track.exercises.length}演習・${track.functionCount}関数／SQL区間 · 全言語 ${total.toLocaleString()}演習</p><label>演習 <select id="course-exercise" aria-label="講座の演習">${track.exercises.map((e,i)=>`<option value="${i}" ${unit?.exercise===i?'selected':''}>${e.kind==='concept'?'基礎・概念':'応用'} · ${esc(e.title)}${e.kind==='practice'?` / 難度${e.difficulty}`:''} (${e.units.filter(i=>state.typing.courseCompleted.includes(track.units[i].key)).length}/${e.units.length})</option>`).join('')}</select></label>${lesson && hasTextbook(state)?`<label>入力区間 <select id="course-unit" aria-label="講座の入力区間">${exercise.units.map(i=>{const u=track.units[i];return `<option value="${u.id}" ${u.id===unit.id?'selected':''}>${state.typing.courseCompleted.includes(u.key)?'✓ ':''}${esc(u.label)} (${u.part}/${u.parts})</option>`;}).join('')}</select></label><p class="panel-note">${esc(exercise.concepts.join(' / ') || exercise.description)}${exercise.prerequisites.length?`<br>前提：${esc(exercise.prerequisites.join(' / '))}`:''}</p><details><summary>課題と周辺コードを見る</summary><p>${esc(exercise.description)}</p><pre class="course-instructions">${esc(exercise.instructions)}</pre>${exercise.files.map(i=>`<h4>${esc(track.files[i].path)}</h4><pre class="reference-code" tabindex="0">${esc(track.files[i].code)}</pre>`).join('')}</details><p class="course-credit"><a href="${esc(lesson.fileInfo.url)}" target="_blank" rel="noopener">Exercism / ${esc(exercise.title)}</a> · ${esc(exercise.authors.join(', '))} · <a href="./licenses/exercism-MIT.txt" target="_blank" rel="noopener">MIT</a></p>`:hasTextbook(state)?'<p>この分野の入力区間はありません。演習一覧から題材を選んでください。</p>':'<p>この分野の教材を購入すると、課題と参考実装を開けます。</p>'}`;
}
function renderAssetsAndGoal() {
  const snippets = level(state, 'library');
  $('asset-count').textContent = format(state.assets + snippets, 0);
  const assets = [];
  if (state.assets) assets.push(`<div class="asset-row">${icon('layers')}<div>永続コード資産 ×${format(state.assets)}<small>入力と自動化に ×${metaBonus(state).toFixed(2)}</small></div></div>`);
  if (snippets) assets.push(`<div class="asset-row">${icon('code')}<div>汎用ライブラリ Lv.${snippets}<small>開発 ${format(unitRate(state, 'library'))} chars/s</small></div></div>`);
  $('code-assets').innerHTML = assets.length ? assets.join('') : `<div class="empty-state"><span class="empty-icon">${icon('layers')}</span><div><p>まだ、まっさら。</p><small>完成した経験を、次の力に。</small></div></div>`;
  const catalogKey = JSON.stringify(state.catalog);
  if (catalogKey !== lastCatalogKey) {
    lastCatalogKey = catalogKey;
    $('catalog-panel').classList.toggle('hidden', !state.catalog.length);
    $('catalog-count').textContent = state.catalog.length;
    $('catalog-list').innerHTML = state.catalog.slice(-3).reverse().map(p => `<div class="asset-row">${icon('code')}<div>${esc(p.name)}<small>${p.active === false ? '公開停止中' : p.royalty ? `${yen(p.royalty)} / 秒` : '無料公開'} · 品質 ${p.quality}</small></div></div>`).join('');
  }
  let goal;
  if (!level(state, 'book-syntax')) goal = ['最初の技術書', '¥1,500を貯めて、入門書を手に入れよう。', state.cash / 1500, `${yen(state.cash)} / ¥1,500`];
  else if (state.skills.syntax < 12 && !state.projectIndex) goal = ['コードを理解する', '写経・学習で、基礎文法の理解度を12まで上げよう。', state.skills.syntax / 12, `${format(state.skills.syntax)} / 12 K`];
  else if (!state.projectIndex) goal = ['はじめての完成品', '3,000文字の数当てゲームを作って、無料公開しよう。', state.progress / 3000, `${format(state.progress)} / 3,000 chars`];
  else {
    const p = projectAt(state.projectIndex);
    goal = [p.name, knowledgeRatio(state) >= 1 ? '必要な知識は揃った。最後の一文字まで、作りきろう。' : '次の企画に必要な理解度を、分野ごとに身につけよう。', knowledgeRatio(state) >= 1 ? state.progress / p.target : knowledgeRatio(state), knowledgeRatio(state) >= 1 ? `${format(state.progress)} / ${format(p.target)} chars` : '必要理解度の充足率'];
  }
  $('next-goal').textContent = goal[0]; $('goal-desc').textContent = goal[1];
  $('goal-bar').style.width = `${pct(goal[2])}%`; $('goal-status').textContent = goal[3]; $('goal-percent').textContent = `${Math.floor(pct(goal[2]))}%`;
}
function renderRoadmap() {
  const indexes = [...PROJECTS.map((_, i) => i), ...new Set([7, Math.max(8, state.projectIndex), Math.max(9, state.projectIndex + 1)])];
  $('roadmap-view').innerHTML = `<div class="roadmap-grid">${indexes.map(i => {
    const p = projectAt(i), done = i < state.projectIndex, current = i === state.projectIndex;
    return `<article class="roadmap-card ${done ? 'completed' : current ? 'current' : ''}"><span class="roadmap-state">${done ? '✓ 公開済み' : current ? '● 現在のプロジェクト' : 'これからの企画'}</span><div class="roadmap-number">${p.icon}</div><div class="eyebrow">${p.genre}</div><h2>${esc(p.name)}</h2><p>${p.desc}</p><div class="roadmap-spec"><span>${format(p.target)} 文字</span><span>${i === 0 ? '無料公開' : `売上最大 ${yen(p.royalty)} / 秒`}</span></div><p style="font-size:9px;margin-bottom:0">${Object.entries(p.req).map(([k, v]) => `${SKILLS.find(s => s.id === k).short} ${format(v)}`).join(' / ')}</p>${p.online ? `<p class="contract-note">公開中のサーバー代：${yen(p.serverDaily * (level(state, 'kitchen') ? .75 : 1))} / 日 → ホスティング会社</p>` : ''}</article>`;
  }).join('')}</div><section class="prestige-card"><div><div class="eyebrow">REFACTOR YOUR CAREER</div><h2>経験を資産に、もう一度。</h2><p>ローグライク公開後に再出発できます。資金、理解度、設備、公開作品を手放して、永続コード資産を獲得。資産は全打鍵、自動化、次の周回の売上を強化します。実績と累計記録は残ります。遠くまで進めるほど獲得量は4倍ずつ増えます。</p><p>現在の資産 ${format(state.assets)} / 倍率 ×${metaBonus(state).toFixed(2)} / 今回の獲得予定 <strong>+${format(prestigeGain(state))}</strong></p></div><button class="primary-button" data-action="prestige" ${!prestigeGain(state) || blocked ? 'disabled' : ''}>資産を引き継いで再出発 ↗</button></section>`;
}
function renderAchievements() {
  $('achievements-view').innerHTML = `<p class="view-intro">${state.achievements.length} / ${ACHIEVEMENTS.length} 個の実績を解除。実績は再出発後も引き継ぎます。</p><div class="achievement-grid">${ACHIEVEMENTS.map(a => { const done = state.achievements.includes(a.id); return `<article class="achievement-card ${done ? '' : 'locked'}"><span class="achievement-emblem">${icon(done ? 'award' : 'shield')}</span><div><h2>${a.name}</h2><p>${a.hint}</p><small>${done ? 'UNLOCKED ✓' : 'NOT YET'}</small></div></article>`; }).join('')}</div><div class="stats-grid"><div><span>総プレイ時間</span><b>${duration(state.stats.time)}</b></div><div><span>累計有効文字</span><b>${format(state.stats.valid)}</b></div><div><span>公開したゲーム</span><b>${format(state.stats.releases, 0)}</b></div><div><span>開発人生の周回数</span><b>${state.resets + 1}</b></div></div>`;
}
function render() {
  document.body.classList.toggle('reduce-motion', state.settings.reducedMotion);
  const ni = netIncome(state);
  $('cash').textContent = yen(state.cash);
  $('cash').style.color = state.cash < 0 ? 'var(--red)' : '';
  $('net-income').textContent = `自動収支 ${ni >= 0 ? '+' : '−'}${yen(Math.abs(ni))} / 秒`;
  $('finance-tag').textContent = ni > 0 ? '自動収支プラス' : ni < 0 ? '支払額が自動収入を超過' : '運転資金を貯めよう';
  $('finance-tag').style.color = ni >= 0 ? 'var(--green)' : '';
  const expenses = expenseLines(state), payments = expenses.reduce((sum, line) => sum + line.daily, 0);
  $('living').innerHTML = `${payments ? '−' : ''}${yen(payments)}<em> / 日</em>`;
  $('bill-next').textContent = operatingCost(state) || state.dailyAccrued ? `サーバー代精算まで ${duration(Math.ceil(DAY - state.dayElapsed))}` : royaltyRate(state) ? '販売手数料は売上時に精算' : '契約・支払いなし';
  $('expense-summary').textContent = payments ? `${yen(payments)} / 日` : state.dailyAccrued ? `本日精算予定 ${yen(state.dailyAccrued)}` : '支払いなし';
  const expenseHTML = expenses.length ? expenses.map(line => `<div class="expense-row"><div><b>${esc(line.name)}</b><small>支払先：${esc(line.payee)} · ${esc(line.terms)}</small></div><strong>${yen(line.daily)} / 日</strong></div>`).join('') : state.dailyAccrued ? '<p>新たに発生する料金はありません。公開中に利用した分は精算します。</p>' : '<p>現在の契約・支払いはありません。</p>';
  if ($('expense-lines').innerHTML !== expenseHTML) $('expense-lines').innerHTML = expenseHTML;
  $('expense-billing').textContent = state.dailyAccrued ? `ホスティング会社への本日発生済み料金：${yen(state.dailyAccrued)}。日の終わりに精算。` : '';
  $('day-ring').style.strokeDashoffset = String(100.53 * state.dayElapsed / DAY);
  $('total-chars').innerHTML = `${format(state.stats.chars, 0)}<em> chars</em>`;
  $('input-power').textContent = `${format(handPower(state), 2)}文字 / クリック`;
  $('royalty').innerHTML = `${yen(royaltyRate(state))}<em> / 秒</em>`;
  const selling = state.catalog.filter(p => p.active !== false && p.royalty > 0).length;
  $('published-count').textContent = selling ? `${selling}作品を販売中` : state.catalog.length ? '公開作品の継続売上なし' : 'まだ、最初の一歩。';
  $('release-count').textContent = `${state.stats.releases} RELEASES`;
  $('day').textContent = String(state.day).padStart(3, '0');
  const phases = ['ひとりの開発者', '最初の完成品', 'インディーへの道', 'スタジオ設立', 'AAAへの挑戦', '宇宙規模の開発'];
  $('phase-name').textContent = phases[Math.min(5, state.projectIndex)];
  $('profile-rank').textContent = `LEVEL ${String(state.projectIndex + 1).padStart(2, '0')} · ${state.projectIndex >= 5 ? 'BEYOND THE END' : 'KEEP BUILDING'}`;
  document.querySelector('.profile-top h2').textContent = ['駆け出しの開発者', '一本作った開発者', 'インディー開発者', 'スタジオの代表', 'AAAディレクター', '宇宙の実装担当'][Math.min(5, state.projectIndex)];
  $('profile-releases').textContent = state.stats.releases; $('meta-bonus').textContent = `×${metaBonus(state).toFixed(2)}`;
  $('bankrupt-banner').classList.toggle('hidden', state.cash >= 0);
  $('achievement-count').textContent = `${state.achievements.length}/${ACHIEVEMENTS.length}`;
  $('auto-work').innerHTML = `${format(unitRate(state, 'macro'), 2)} <small>chars/s</small>`;
  $('auto-dev').innerHTML = `${format(devRate(state))} <small>chars/s</small>`;
  const studySubject = autoStudySubject(state), labRate = unitRate(state, 'lab');
  $('auto-study').innerHTML = `${format(studySubject ? labRate : 0)} <small>chars/s · ${studySubject ? SKILLS.find(s => s.id === studySubject).short : labRate ? '教材待ち' : '未稼働'}</small>`;
  $('automation-toggle').setAttribute('aria-pressed', state.autoEnabled);
  $('auto-label').textContent = `自動開発 ${state.autoEnabled ? 'ON' : 'OFF'}`;
  const dangerous = devRate(state) && knowledgeRatio(state) < 1;
  $('automation-note').textContent = state.crashed ? 'ビルドが崩壊しています。学習し、リファクタリングで復旧を。' : dangerous ? 'レビュー能力が不足。自動開発が技術的負債を増やします。' : labRate && !studySubject ? '研究ラボは教材待ちです。不足分野の教材を購入してください。' : unitRate(state, 'macro') ? 'マクロはモードに関係なく稼働中。学習と開発に集中できます。' : '最初のマクロで、タイピングを自動化しよう。';
  $('automation-note').classList.toggle('danger', !!dangerous || state.crashed);
  lastManualTimes = lastManualTimes.filter(t => t > performance.now() - 2000);
  $('manual-rate').textContent = lastManualTimes.length ? `${(lastManualTimes.length / 2).toFixed(1)} taps/s` : '手動入力待機中';
  const logKey = JSON.stringify(state.log.slice(-4));
  if (logKey !== lastLogKey) { lastLogKey = logKey; $('event-log').innerHTML = state.log.slice(-4).reverse().map(l => `<div class="log-line ${l.kind}"><time>D${String(l.day).padStart(3, '0')}</time><span>${esc(l.text)}</span></div>`).join(''); }
  if (view === 'workspace') { renderSkills(); renderTask(); renderShop(); renderAssetsAndGoal(); }
  const secondaryKey = view === 'roadmap' ? JSON.stringify([view, state.projectIndex, state.assets, state.runBest, Math.floor(Math.log10(1 + state.stats.valid))]) : JSON.stringify([view, state.achievements, state.stats.releases, state.resets, Math.floor(state.stats.time), Math.floor(state.stats.valid)]);
  if (secondaryKey !== lastSecondaryKey) {
    lastSecondaryKey = secondaryKey;
    if (view === 'roadmap') renderRoadmap();
    if (view === 'achievements') renderAchievements();
  }
  dirty = false;
}

$('language-select').innerHTML = LANGUAGES.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
$('subject-picker').innerHTML = SKILLS.map(s => `<button class="subject-button" data-subject="${s.id}" aria-pressed="${state.subject === s.id}">${s.short}を学ぶ</button>`).join('');
document.addEventListener('click', async event => {
  const b = event.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.view) { dirty = true; switchView(b.dataset.view); }
  if (b.dataset.mode) switchMode(b.dataset.mode);
  if (b.dataset.inputStyle && !blocked) {
    state.inputStyle = b.dataset.inputStyle; lastEditorKey = ''; render();
    focusTypingInput();
  }
  if (b.dataset.studyStyle && !blocked) {
    const next=b.dataset.studyStyle;
    rememberCourseCursor(state);
    if(next==='course'){
      b.disabled=true;
      try{await loadCourses();}catch{toast('講座の読み込みに失敗しました。もう一度開いてください。','error');b.disabled=false;return;}
      b.disabled=false;
    }
    if(next!=='reading'){
      const source=next==='course'?'course':'standard';
      if(state.typing.source!==source){state.typing.source=source;state.typing.context='';}
    }
    state.studyStyle=next;dirty=true;render();focusTypingInput();
  }
  if (b.dataset.learn && !blocked) { state.subject = b.dataset.learn; state.studyStyle = 'practice'; state.typing.source='standard'; state.typing.context=''; switchMode('study'); }
  if (b.dataset.readAnswer !== undefined && !blocked && !paused) { const result = answerReading(state, Number(b.dataset.readAnswer)); if (result.kind === 'correct') toast(`読解に正解！ +${format(result.amount, 3)} K`); dirty = true; unlock(); render(); save(); }
  if (b.dataset.subject && !blocked) { rememberCourseCursor(state); state.subject = b.dataset.subject; dirty = true; render(); focusTypingInput(); }
  if (b.dataset.shop) {
    shopTab = b.dataset.shop;
    document.querySelectorAll('[data-shop]').forEach(el => { el.classList.toggle('active', el.dataset.shop === shopTab); el.setAttribute('aria-selected', el.dataset.shop === shopTab); });
    renderShop();
  }
  if (b.dataset.buy && !blocked && buy(state, b.dataset.buy)) { unlock(); dirty = true; render(); if (b.dataset.buy === `book-${state.subject}`) focusTypingInput(); }
  if (b.dataset.publication !== undefined && !blocked && setPublicationActive(state, Number(b.dataset.publication), b.dataset.active === 'true')) { dirty = true; render(); save(); showCatalog(); }
  if (b.dataset.action) handleAction(b.dataset.action);
});
$('type-button').addEventListener('click', () => {
  if (state.inputStyle === 'typing') focusTypingInput();
  else doInput();
});
function processTypingInput({ countErrors = true, rewardScale = 1 } = {}) {
  if (blocked || paused || $('modal').open || view !== 'workspace' || state.inputStyle !== 'typing') return;
  if (state.mode === 'study' && (!hasTextbook(state) || state.studyStyle === 'reading')) return;
  if(state.mode==='study' && state.typing.source==='course' && !courseUnit(state.typing.courseUnit)) return;
  const field = $('typing-input'), prompt = currentPrompt(state), t = state.typing;
  // Leave the native draft alone during composition. Normalize committed ASCII
  // without changing its length or the caret; invoice letter case is cosmetic.
  let value = field.value.replace(/[！-～]/g, (char,index) => prompt[index] === char ? char : String.fromCharCode(char.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, (char,index) => prompt[index] === char ? char : ' ');
  if (state.mode === 'work') value = value.replace(/[a-z]/g, char => char.toUpperCase());
  if (value !== field.value) {
    const { selectionStart, selectionEnd } = field;
    field.value = value; field.setSelectionRange(selectionStart, selectionEnd);
  }
  const feedback = $('input-feedback');
  feedback.textContent = ''; feedback.classList.remove('error');
  if (value.slice(0, t.offset) !== prompt.slice(0, t.offset)) {
    if (value.length >= t.offset) {
      feedback.textContent = '入力済みの文字を確認してください。';
      feedback.classList.add('error');
    }
    return;
  }
  let countedManual = false;
  for (const character of value.slice(t.offset)) {
    const power = handPower(state) * rewardScale;
    if (!countErrors && character !== prompt[state.typing.offset]) break;
    const result = acceptCharacter(state, character, power);
    if (!result.correct) {
      beep('error');
      $('code-editor').classList.add('typing-error');
      setTimeout(() => $('code-editor').classList.remove('typing-error'), 180);
      const item = ['伝票番号', '日付（YYYY-MM-DD）', '品名', '数量', '単価'][prompt.slice(0, t.offset).split(',').length - 1];
      feedback.textContent = state.mode === 'work' ? `${item}の入力を確認してください。` : 'ハイライトと異なる文字があります。';
      feedback.classList.add('error');
      renderEditor();
      break;
    }
    doInput({ chars: Math.min(1e250, power * TYPING_REWARD.character), countManual: rewardScale === 1 || !countedManual });
    countedManual = true;
    if (result.complete) {
      doInput({ chars: Math.min(1e250, result.bonus), countManual: false });
      toast(`完入力！ 正確率 ${(result.accuracy * 100).toFixed(1)}% · ボーナス獲得`, '', 1800);
      break;
    }
  }
}
$('typing-input').addEventListener('beforeinput', event => {
  draftBeforeInput = $('typing-input').value;
  if (/insertFrom(Paste|Drop)/.test(event.inputType) && event.cancelable) event.preventDefault();
});
$('typing-input').addEventListener('input', event => {
  if (composing || event.isComposing) return;
  if (/insertFrom(Paste|Drop)/.test(event.inputType)) { $('typing-input').value = draftBeforeInput; return; }
  processTypingInput({ countErrors: !event.inputType?.startsWith('delete') });
});
$('typing-input').addEventListener('compositionstart', () => {
  composing = true; compositionContext = inputContext;
});
$('typing-input').addEventListener('compositionend', () => {
  composing = false;
  currentPrompt(state);
  const t = state.typing;
  if (compositionContext !== `${t.context}/${t.language}/${t.index}/${t.source}/${t.courseUnit}`) { inputContext = ''; renderEditor(); return; }
  processTypingInput();
});
$('typing-input').addEventListener('focus', () => {
  if (state.inputStyle !== 'typing') { state.inputStyle = 'typing'; render(); }
});
$('typing-input').addEventListener('paste', event => { event.preventDefault(); $('input-feedback').textContent = '文字を入力してください。'; });
$('typing-input').addEventListener('drop', event => event.preventDefault());
$('typing-input').addEventListener('keydown', event => {
  if (event.key === 'Tab' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !composing && !event.isComposing && state.mode !== 'work') {
    event.preventDefault();
    if (!event.repeat) {
      const field = $('typing-input');
      const remaining=currentPrompt(state).slice(state.typing.offset);
      const indentation=remaining[0]==='\t'?'\t':' '.repeat(Math.min(4,remaining.match(/^ */)[0].length||4));
      field.setRangeText(indentation, field.selectionStart, field.selectionEnd, 'end');
      // A literal tab or a short indentation is still one physical keystroke.
      processTypingInput({ rewardScale: 1/indentation.length });
    }
    return;
  }
  if (event.repeat && event.key.length === 1) event.preventDefault();
  if (event.key === 'Escape' && !composing && !event.isComposing) { event.preventDefault(); $('typing-input').blur(); }
});
$('office-image').addEventListener('click', focusTypingInput);
$('help-button').addEventListener('click', help); $('guide-link').addEventListener('click', help);
$('settings-button').addEventListener('click', settings);
$('modal-close').addEventListener('click', () => $('modal').close());
$('modal').addEventListener('click', e => { if (e.target === $('modal')) { const r = $('modal').getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) $('modal').close(); } });
$('save-button').addEventListener('click', () => save(true));
$('automation-toggle').addEventListener('click', () => { if (!blocked) { state.autoEnabled = !state.autoEnabled; dirty = true; render(); } });
$('refactor-button').addEventListener('click', () => { if (!blocked) { state.refactor = !state.refactor; dirty = true; render(); } });
$('release-button').addEventListener('click', () => {
  if (blocked) return;
  const result = release(state);
  if (!result) return;
  unlock(); dirty = true; save(); render();
  showModal('RELEASED / おつかれさまでした。', `<div class="eyebrow">${result.royalty ? 'NOW ON SALE' : 'FREE TO PLAY'}</div><h3 style="font-size:22px;margin-top:6px">${esc(result.name)}</h3><p>最後の一文字まで、作りきりました。</p><div class="release-detail"><div><small>品質スコア</small><b>${result.quality}<span style="font-size:11px"> / 100</span></b></div><div><small>初回受取</small><b>${yen(result.payout)}</b></div><div><small>継続売上 / 手数料控除後</small><b>${yen(result.royalty * (1 - STORE_FEE_RATE))}<span style="font-size:11px"> / 秒</span></b></div></div><p>${result.royalty ? '発売した作品が、これからの事業と開発を支えます。' : 'この作品は無料公開。売上はゼロですが、完成経験による理解度と実績が残ります。次の仕事と設備も解禁されます。'}</p>${result.grossPayout ? `<p>ゲーム配信ストアへの販売手数料：${yen(result.salesFee)}（初回売上 ${yen(result.grossPayout)} の25%）。</p>` : ''}${result.online ? `<p>公開中はホスティング会社へ ${yen(serverCost(state, result))} / 日。公開したゲームから停止・再開できます。</p><button class="secondary-button" data-publication="${result.index}" data-active="false">公開停止</button>` : ''}<p>次の企画：<strong>${esc(projectAt(state.projectIndex).name)}</strong></p>${state.projectIndex === 5 ? '<div class="modal-callout">AAA、完成。けれどエンディングはありません。次は永続するオンライン宇宙を実装します。</div>' : ''}<div class="modal-actions"><button class="primary-button" data-action="close">次の一文字へ ↗</button></div>`);
});
document.addEventListener('change', e => {
  if (e.target.id === 'language-select' && !blocked) {
    rememberCourseCursor(state);
    state.typing.language = e.target.value;
    state.typing.context = ''; lastEditorKey = ''; render();
    focusTypingInput();
  }
  if (e.target.id === 'course-exercise' && !blocked) {
    rememberCourseCursor(state);
    const exercise=courseTrack(state.typing.language).exercises[Number(e.target.value)];
    const unit=courseTrack(state.typing.language).units[exercise.units[0]];
    if(unit){state.subject=unit.subject;state.typing.courseUnit=unit.id;state.typing.context='';render();}
  }
  if (e.target.id === 'course-unit' && !blocked && courseUnit(e.target.value)) {
    rememberCourseCursor(state);
    state.typing.courseUnit=e.target.value;state.typing.context='';render();focusTypingInput();
  }
  if (e.target.id === 'comment-locale-setting') { state.settings.commentLocale = e.target.value; render(); save(); }
  if (e.target.id === 'sound-setting') state.settings.sound = e.target.checked;
  if (e.target.id === 'motion-setting') { state.settings.reducedMotion = e.target.checked; render(); }
});
function handleAction(action) {
  if (action === 'go-dev') switchMode('dev');
  if (action === 'next-reading' && !blocked && !paused) { nextReading(state); render(); $('reading-question')?.focus({ preventScroll: true }); }
  if (action === 'textbooks') { document.querySelector('[data-shop=books]').click(); $('shop-items').scrollIntoView({ block: 'nearest' }); }
  if (action === 'close') $('modal').close();
  if (action === 'pause') { paused = !paused; settings(); render(); }
  if (action === 'export') {
    const data = serialize(state);
    const url = URL.createObjectURL(new Blob([data], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `code-typer-idle-day${state.day}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  if (action === 'import' && !blocked) { $('import-file').value = ''; $('import-file').click(); }
  if (action === 'reset' && !blocked) showModal('全データを削除しますか？', '<p>理解度、公開作品、設備、実績、永続コード資産をすべて削除して最初から始めます。元に戻せません。</p><div class="modal-actions"><button class="secondary-button" data-action="settings">戻る</button><button class="danger-button" data-action="confirm-reset">削除して新規開始</button></div>');
  if (action === 'settings') settings();
  if (action === 'catalog') showCatalog();
  if (action === 'confirm-reset' && !blocked) {
    state = createState(); canSave = true; paused = false;
    try { localStorage.removeItem(KEY); localStorage.removeItem(`${KEY}:backup`); } catch { /* save will surface unavailable storage */ }
    invalidate(); $('modal').close(); save(); switchView('workspace'); toast('新しい開発人生を始めました。');
  }
  if (action === 'prestige' && prestigeGain(state) && !blocked) showModal('資産を引き継いで再出発', `<p>今回の進行から<strong>コード資産 +${format(prestigeGain(state))}</strong>を獲得します。合計倍率は<strong>×${(1 + Math.sqrt(state.assets + prestigeGain(state)) * .5).toFixed(2)}</strong>に。</p><div class="modal-callout">資金、理解度、設備、公開作品はリセットされます。永続コード資産、実績、累計記録は引き継ぎます。</div><div class="modal-actions"><button class="secondary-button" data-action="close">まだ続ける</button><button class="primary-button" data-action="confirm-prestige">再出発する ↗</button></div>`);
  if (action === 'confirm-prestige' && !blocked) {
    const fresh = prestige(state);
    if (!fresh) return;
    state = fresh; invalidate(); unlock(); save(); $('modal').close(); switchView('workspace'); toast(`再出発しました。すべての入力と自動化が ×${metaBonus(state).toFixed(2)} に。`);
  }
}
function invalidate() { lastShopKey = ''; lastEditorKey = ''; lastLogKey = ''; lastSkillsKey = ''; lastSecondaryKey = ''; lastCatalogKey = ''; lastReadingKey = ''; lastCourseKey = ''; inputContext = ''; lastOfficeOrder = ''; composing = false; dirty = true; lastFrame = performance.now(); }
$('import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file || blocked) return;
  try {
    if (file.size > 500000) throw new Error('セーブファイルが大きすぎます。');
    const imported = deserialize(await file.text());
    if(imported.typing.source==='course' || imported.typing.lastCompleted?.courseUnit) await loadCourses();
    state = imported; applyOffline(state); canSave = true; paused = false;
    invalidate(); unlock(); save(); $('modal').close(); switchView('workspace'); toast('セーブデータを読み込みました。');
  } catch (error) { toast(`読み込めません：${error.message}`, 'error'); }
});
window.addEventListener('pagehide', () => save());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  // Interval timing below accounts for throttled/hidden tabs; no double offline grant.
});
setInterval(() => {
  const now = performance.now(), elapsed = (now - lastFrame) / 1000;
  lastFrame = now;
  if (!blocked && !paused) { tick(state, elapsed); dirty = true; unlock(); }
  sinceSave += elapsed;
  if (sinceSave >= 5) { sinceSave = 0; save(); }
  if (!document.hidden) render();
}, 250);
render();
watchForUpdates({ build: '__BUILD_ID__', prepare: () => futureSave && !canSave ? !blocked : save(), failed: () => toast('更新前の保存ができません。設定から書き出すか、別タブで起動していないか確認してください。', 'error') });
if (loadingNotice) toast(loadingNotice, 'error', 16000);
else if (offlineResult?.seconds >= 30) {
  showModal('おかえりなさい、開発者。', `<p>${duration(offlineResult.seconds)}のあいだも、開発環境は稼働していました。${offlineResult.capped ? '離席中の進行は8時間分までです。' : ''}</p><div class="release-detail"><div><small>資金の増減（手数料・サーバー代を精算）</small><b>${offlineResult.cash >= 0 ? '+' : ''}${yen(offlineResult.cash)}</b></div><div><small>有効コード</small><b>+${format(offlineResult.progress)}</b></div></div><p>学習理解度 +${format(offlineResult.knowledge, 2)} K。${state.crashed ? 'ビルドが崩壊しています。学習と修復を確認してください。' : '完成したプロジェクトは開発タブから公開できます。'}</p><div class="modal-actions"><button class="primary-button" data-action="close">続きを始める ↗</button></div>`);
}
