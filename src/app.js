import {
  DAY, JOB_SIZE, BUSINESSES, SKILLS, PROJECTS, SHOP, ACHIEVEMENTS, createState, projectAt, level, metaBonus,
  operatingCost, rentCost, businessStage, dailyBillEstimate, workRate, handPower, knowledgeRatio, validity, debtLimit,
  abstraction, royaltyRate, unitRate, devRate, studyGain, hasTextbook, ideMultiplier, autoStudySubject, itemCost, netIncome,
  buy, input, tick, release, quality, prestigeGain, prestige, applyOffline,
  serialize, deserialize, checkAchievements, log
} from './core.js';
import { LANGUAGES, PROMPT_COUNT, TYPING_REWARD, typingCompletionMultiplier, currentPrompt, acceptCharacter } from './typing.js';
import { PACING_REPORT } from './pacing.js';
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
  showModal('一文字から、ゲーム開発者へ。', `<p>同じ打鍵でも、どこに時間を使うかで結果が変わります。</p><div class="guide-steps"><div class="guide-step"><span>01</span><p><b>働いて、事業を支える</b>日銭ワークは100作業量ごとに納品して入金。初期は1件¥100です。実時間1時間でゲーム内1日。序盤は実家で制作し、事業費は電力・通信等の¥600/日だけ。有料発売で独立し、規模に応じた維持費と事務所代が発生します。事務所代は所持金から別途積み立て、30日ごとに精算。内訳と次の費用はメイン画面で確認できます。まずは¥1,500の入門書を。</p></div><div class="guide-step"><span>02</span><p><b>学んで、コードを理解する</b>写経・学習で分野別の理解度が上昇。各分野の教材を購入すると学習できます。教材のない分野は手動でも研究ラボでも学習できません。理解度が上がるほど、次の1ポイントには多くの学習が必要です。学習中の収入はゼロです。</p></div><div class="guide-step"><span>03</span><p><b>完成させて、次へ進む</b>ゲーム開発で有効文字を積み上げ、ビルドして公開。最初の作品は無料。2作目から、十分な品質と理解度があれば継続売上を得られます。</p></div></div><div class="modal-callout">理解度が要求の50%未満なら、開発進捗はゼロ。50〜100%では技術的負債が増えます。崩壊したビルドは必要理解度を満たしてからリファクタリングで復旧できます。自動開発の丸投げにも注意。</div><p><strong>操作</strong>　クリック、またはコードタイピング。日銭は原票画像を読み、指定のCSV形式で入力します。学習・開発は表示されたコードを入力します。正解文字は×1.5。誤入力なしの完入力で、原票入力は合計×2.25、コード入力は合計×2の報酬。作業の切替は画面のタブを使います。コード入力中のTabは空白4文字です。Shift+TabまたはEscで入力欄を離れられます。</p><p><strong>放置と保存</strong>　自動化は選択モードにかかわらず動きます。研究ラボは教材のある不足分野を優先します。離席中は最大8時間分を計算。公開と購入は手動です。5秒ごとに保存します。</p><p><strong>その先</strong>　AAAは途中の目標。宇宙規模の開発、コード資産を引き継ぐ再出発、さらに大きな次世代へ進めます。</p><div class="modal-actions"><button class="primary-button" data-action="close">開発を始めよう ↗</button></div>`);
}
function settings() {
  showModal('設定とセーブデータ', `<div class="setting-row"><div><b>打鍵音</b><small>小さな電子音を鳴らします</small></div><input type="checkbox" id="sound-setting" aria-label="打鍵音" ${state.settings.sound ? 'checked' : ''}></div><div class="setting-row"><div><b>アニメーションを減らす</b><small>点滅と打鍵エフェクトを停止します</small></div><input type="checkbox" id="motion-setting" aria-label="アニメーションを減らす" ${state.settings.reducedMotion ? 'checked' : ''}></div><div class="setting-row"><div><b>プレイ時間を一時停止</b><small>このタブを開いている間、事業維持費と自動処理を止めます</small></div><button class="secondary-button" data-action="pause">${paused ? '再開する' : '一時停止'}</button></div><h3>データの持ち運び</h3><p>セーブはこのブラウザに保存されます。ブラウザのデータ削除や端末変更に備えて、ファイルにも保管できます。</p><div class="setting-actions"><button class="secondary-button" data-action="export">セーブを書き出す ↓</button><button class="secondary-button" data-action="import" ${blocked ? 'disabled' : ''}>セーブを読み込む ↑</button></div><p class="setting-warning">読み込みは現在の進行を置き換えます。先に書き出すことをおすすめします。</p>${!canSave ? '<div class="modal-callout">現在、自動保存を停止しています。セーブを読み込むか、下の新規開始で保存を再開できます。</div>' : ''}<h3>新しく始める</h3><button class="danger-button" data-action="reset" ${blocked ? 'disabled' : ''}>全データを削除して新規開始</button><p class="setting-warning">コード資産を含むすべての進行が対象です。資産を引き継ぐ再出発はロードマップから。</p>`);
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
  state.mode = next;
  dirty = true;
  render();
  focusTypingInput();
}
function focusTypingInput() {
  if (state.inputStyle === 'typing' && !blocked && !paused && view === 'workspace' && !$('modal').open && (state.mode !== 'study' || hasTextbook(state))) $('typing-input').focus({ preventScroll: true });
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
  let text = { work: result.amount ? `${yen(result.amount)} 納品` : `+${format(result.work)} 作業量`, study: `+${format(result.amount, 2)} K`, code: `+${format(result.amount)} chars`, debt: `+${format(result.amount)} chars / 負債発生`, refactor: `−${format(result.amount)} debt`, error: 'Syntax Error', crash: 'Build failed', review: '先に必要な理解度を学習' }[result.kind] || '';
  const floating = $('input-float');
  floating.textContent = text;
  floating.style.color = ['error', 'crash', 'review', 'debt'].includes(result.kind) ? 'var(--red)' : 'var(--green)';
  if (!state.settings.reducedMotion) { floating.classList.remove('animate'); void floating.offsetWidth; floating.classList.add('animate'); }
  if (result.kind === 'error' && tapNumber % 12 === 1) log(state, 'Syntax Error: まずは要求理解度の50%以上を学習しましょう。', 'error');
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
  $('typing-input').setAttribute('aria-label', office ? '伝票データ入力' : 'コード入力');
  $('editor-content').setAttribute('aria-label', office ? 'CSV入力結果' : '出題コード');
  $('office-source').classList.toggle('hidden', !office);
  if (office) {
    const order = officeOrderAt(t.index, t.officeVersion);
    if (lastOfficeOrder !== order.input) { drawOfficeSource($('office-image'), order); lastOfficeOrder = order.input; }
  }
  const typing = state.inputStyle === 'typing';
  const offset = typing ? t.offset : Math.floor(state.stats.manual % prompt.length);
  const key = `${state.mode}/${state.subject}/${state.projectIndex}/${t.language}/${t.index}/${offset}/${t.errors}/${typing}/${studyLocked}`;
  const context = `${t.context}/${t.language}/${t.index}`;
  if (!composing && inputContext !== context) {
    inputContext = context;
    $('typing-input').value = prompt.slice(0, t.offset);
    $('input-feedback').textContent = '';
  }
  $('typing-input').hidden = studyLocked;
  $('typing-input').disabled = blocked || paused || studyLocked;
  $('typing-input').placeholder = office ? '伝票番号,YYYY-MM-DD,品名,数量,単価' : '上のコードを入力';
  $('typing-label').textContent = office ? '伝票入力' : 'コード入力';
  $('typing-label').classList.toggle('hidden', studyLocked);
  $('editor-content').classList.toggle('hidden', office);
  $('typing-summary').classList.toggle('hidden', !typing || studyLocked);
  $('code-editor').classList.toggle('typing-active', typing);
  if (lastEditorKey !== key) {
    lastEditorKey = key;
    $('editor-content').dataset.prompt = studyLocked ? '' : prompt;
    $('editor-content').innerHTML = studyLocked ? '<p class="panel-note">この分野の教材を購入すると、学習用コードが表示されます。</p>' : office ? `<pre class="typing-code"><span class="typed-code">${esc(typing ? prompt.slice(0, offset) : '')}</span><mark class="next-character">▌</mark></pre>` : `<pre class="typing-code"><span class="typed-code">${esc(prompt.slice(0, offset))}</span><mark class="next-character">${prompt[offset] === '\n' ? '↵\n' : esc(prompt[offset] || ' ')}</mark><span class="pending-code">${esc(prompt.slice(offset + 1))}</span></pre>`;
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
  $('type-button').disabled = blocked || paused || studyLocked;
  $('type-label').textContent = studyLocked ? '教材を購入すると学習できます' : paused ? '一時停止中' : typing ? mode === 'work' ? '伝票入力を始める' : 'コード入力を始める' : `クリックして${task[5]}`;
  $('type-hint').textContent = studyLocked ? `${textbook.name} · ${yen(itemCost(state, textbook))}` : paused ? '設定から再開できます' : typing ? mode === 'work' ? '原票を確認し、CSVの項目順に入力' : '光っている文字から、コードどおりに入力' : `タイピングなら完入力で最大×${TYPING_REWARD.character + typingCompletionMultiplier(mode)}`;
  $('output-rate').innerHTML = `${esc(task[6])} <small>/ ${typing ? '正解文字' : 'クリック'}</small>`;
  $('output-label').textContent = mode === 'dev' ? `有効変換率 ${Math.round(validity(state) * 100)}%${ratio >= 1 ? ` / 抽象化 ×${format(abstraction(state), 2)}` : ''}` : typing ? `正解×${TYPING_REWARD.character} ＋ 完入力ボーナス` : 'このクリックで得られるもの';
  $('typing-instructions').textContent = mode === 'work' ? '伝票番号 → 日付 → 品名 → 数量 → 単価' : 'ハイライトされた文字から入力';
  $('subject-picker').querySelectorAll('[data-subject]').forEach(b => { b.classList.toggle('active', b.dataset.subject === state.subject); b.setAttribute('aria-pressed', b.dataset.subject === state.subject); });
  if (mode === 'dev') {
    $('project-progress').innerHTML = `<div class="progress-meta"><span>${format(state.progress)} / ${format(p.target)} chars</span><b>${pct(state.progress / p.target).toFixed(2)}%</b></div><div class="big-track"><span style="width:${pct(state.progress / p.target)}%;background:${state.crashed ? 'var(--red)' : 'var(--green)'}"></span></div><div class="debt-row ${state.crashed ? 'danger' : ''}"><span>技術的負債 <b>${format(state.debt)} / ${format(debtLimit(state))}</b></span><span>公開には負債10%以下が必要</span></div>`;
    $('release-button').disabled = blocked || state.progress < p.target || state.crashed || state.debt > debtLimit(state) * .1;
    $('refactor-button').textContent = state.refactor ? '← 通常の開発に戻る' : 'リファクタリングに切替';
    $('refactor-button').classList.toggle('active', state.refactor);
  }
  renderEditor();
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
    $('catalog-list').innerHTML = state.catalog.slice(-3).reverse().map(p => `<div class="asset-row">${icon('code')}<div>${esc(p.name)}<small>${p.royalty ? `${yen(p.royalty)} / 秒` : '無料公開'} · 品質 ${p.quality}</small></div></div>`).join('');
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
  $('roadmap-view').innerHTML = `${renderPacing()}<p class="view-intro">表示上の1行は40文字換算。AAAの開発規模は1億文字。100万行を超えたあとも、次の企画は届きます。</p><div class="roadmap-grid">${indexes.map(i => {
    const p = projectAt(i), done = i < state.projectIndex, current = i === state.projectIndex;
    return `<article class="roadmap-card ${done ? 'completed' : current ? 'current' : ''}"><span class="roadmap-state">${done ? '✓ 公開済み' : current ? '● 現在のプロジェクト' : 'これからの企画'}</span><div class="roadmap-number">${p.icon}</div><div class="eyebrow">${p.genre}</div><h2>${esc(p.name)}</h2><p>${p.desc}</p><div class="roadmap-spec"><span>${format(p.target)} 文字</span><span>${i === 0 ? '無料公開' : `最大 ${yen(p.royalty)} / 秒`}</span></div><p style="font-size:9px;margin-bottom:0">${Object.entries(p.req).map(([k, v]) => `${SKILLS.find(s => s.id === k).short} ${format(v)}`).join(' / ')}</p></article>`;
  }).join('')}</div><section class="prestige-card"><div><div class="eyebrow">REFACTOR YOUR CAREER</div><h2>経験を資産に、もう一度。</h2><p>ローグライク公開後に再出発できます。資金、理解度、設備、公開作品を手放して、永続コード資産を獲得。資産は全打鍵、自動化、次の周回の売上を強化します。実績と累計記録は残ります。遠くまで進めるほど獲得量は4倍ずつ増えます。</p><p>現在の資産 ${format(state.assets)} / 倍率 ×${metaBonus(state).toFixed(2)} / 今回の獲得予定 <strong>+${format(prestigeGain(state))}</strong></p></div><button class="primary-button" data-action="prestige" ${!prestigeGain(state) || blocked ? 'disabled' : ''}>資産を引き継いで再出発 ↗</button></section>`;
}
function renderPacing() {
  const time = n => n < 3600 ? `${Math.ceil(n / 60)}分` : `${(n / 3600).toFixed(1)}時間`;
  return `<section class="panel pacing-panel"><div class="eyebrow">FIRST RUN / BALANCE v${PACING_REPORT.balanceVersion}</div><h2>初回AAAの目安は、放置込み3〜7日。</h2><p>新規セーブ・周回なしで、購入と学習を配分したシミュレーションです。入力速度と投資先で変わります。</p><div class="pacing-table-wrap"><table class="pacing-table"><thead><tr><th>到達点</th>${PACING_REPORT.scenarios.map(s => `<th>${esc(s.name)}</th>`).join('')}</tr></thead><tbody><tr><td>基礎教本</td>${PACING_REPORT.scenarios.map(s => `<td>${time(s.purchases['book-syntax'])}</td>`).join('')}</tr>${PROJECTS.slice(0, 5).map((p, index) => `<tr><td>${index === 4 ? 'AAA公開' : esc(p.name)}</td>${PACING_REPORT.scenarios.map(s => `<td>${s.milestones[index] ? time(s.milestones[index].seconds) : '計測範囲外'}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p>タイピング列は300打鍵/分（5打鍵/秒）で全問正解し、完入力ボーナスも得る条件です。離席ありは最初に1時間、以降は日中16時間に2時間ごと5分、夜は8時間離席。AAAまでの実操作は約${(PACING_REPORT.scenarios[2].milestones[4].activeSeconds / 3600).toFixed(1)}時間です。旧セーブは進行を維持するため、この目安の対象外です。</p></section>`;
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
  $('finance-tag').textContent = ni >= 0 ? '事業費を自動で確保' : '運転資金を確保しよう';
  $('finance-tag').style.color = ni >= 0 ? 'var(--green)' : '';
  $('living').innerHTML = `−${yen(operatingCost(state))}<em> / 日</em>`;
  $('bill-next').textContent = `日次精算まで ${duration(Math.ceil(DAY - state.dayElapsed))}`;
  const business = businessStage(state), nextBusiness = BUSINESSES[BUSINESSES.indexOf(business) + 1];
  $('business-stage').textContent = business.name;
  $('business-detail').textContent = `${business.detail}。当日の維持費見込 ${yen(dailyBillEstimate(state))}は日次精算。`;
  $('office-budget').textContent = rentCost(state) ? `事務所代 ${yen(rentCost(state))} / 30日・当期発生 ${yen(state.rentAccrued)}・積立済 ${yen(state.rentFund)}（所持金と別）。次回精算まで ${30 - state.billingDays}日。` : '事務所代なし。家族の支援を受けて、自室で制作中。';
  $('business-next').textContent = nextBusiness ? `次：${nextBusiness.trigger}で${nextBusiness.name}へ。維持費 ${yen(nextBusiness.daily * (level(state, 'kitchen') ? .75 : 1))}/日＋事務所代 ${yen(nextBusiness.rent)}/30日。` : '以後はこの事業規模の維持費を適用します。';
  $('day-ring').style.strokeDashoffset = String(100.53 * state.dayElapsed / DAY);
  $('total-chars').innerHTML = `${format(state.stats.chars, 0)}<em> chars</em>`;
  $('input-power').textContent = `${format(handPower(state), 2)}文字 / クリック · 約${format(state.stats.chars / 40, 0)}行`;
  $('royalty').innerHTML = `${yen(royaltyRate(state))}<em> / 秒</em>`;
  $('published-count').textContent = state.catalog.length ? `${state.catalog.length}作品からの継続売上` : 'まだ、最初の一歩。';
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
document.addEventListener('click', event => {
  const b = event.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.view) { dirty = true; switchView(b.dataset.view); }
  if (b.dataset.mode) switchMode(b.dataset.mode);
  if (b.dataset.inputStyle && !blocked) {
    state.inputStyle = b.dataset.inputStyle; lastEditorKey = ''; render();
    focusTypingInput();
  }
  if (b.dataset.subject && !blocked) { state.subject = b.dataset.subject; dirty = true; render(); focusTypingInput(); }
  if (b.dataset.shop) {
    shopTab = b.dataset.shop;
    document.querySelectorAll('[data-shop]').forEach(el => { el.classList.toggle('active', el.dataset.shop === shopTab); el.setAttribute('aria-selected', el.dataset.shop === shopTab); });
    renderShop();
  }
  if (b.dataset.buy && !blocked && buy(state, b.dataset.buy)) { unlock(); dirty = true; render(); if (b.dataset.buy === `book-${state.subject}`) focusTypingInput(); }
  if (b.dataset.action) handleAction(b.dataset.action);
});
$('type-button').addEventListener('click', () => {
  if (state.inputStyle === 'typing') focusTypingInput();
  else doInput();
});
function processTypingInput({ countErrors = true } = {}) {
  if (blocked || paused || $('modal').open || view !== 'workspace' || state.inputStyle !== 'typing') return;
  if (state.mode === 'study' && !hasTextbook(state)) return;
  const field = $('typing-input'), prompt = currentPrompt(state), t = state.typing;
  // Leave the native draft alone during composition. Normalize committed ASCII
  // without changing its length or the caret; invoice letter case is cosmetic.
  let value = field.value.replace(/[！-～]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0)).replace(/\u3000/g, ' ');
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
  for (const character of value.slice(t.offset)) {
    const power = handPower(state);
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
    doInput({ chars: Math.min(1e250, power * TYPING_REWARD.character) });
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
  if (compositionContext !== `${t.context}/${t.language}/${t.index}`) { inputContext = ''; renderEditor(); return; }
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
      field.setRangeText('    ', field.selectionStart, field.selectionEnd, 'end');
      processTypingInput();
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
  showModal('RELEASED / おつかれさまでした。', `<div class="eyebrow">${result.royalty ? 'NOW ON SALE' : 'FREE TO PLAY'}</div><h3 style="font-size:22px;margin-top:6px">${esc(result.name)}</h3><p>最後の一文字まで、作りきりました。</p><div class="release-detail"><div><small>品質スコア</small><b>${result.quality}<span style="font-size:11px"> / 100</span></b></div><div><small>初回売上</small><b>${yen(result.payout)}</b></div><div><small>継続売上</small><b>${yen(result.royalty)}<span style="font-size:11px"> / 秒</span></b></div></div><p>${result.royalty ? '発売した作品が、これからの事業と開発を支えます。' : 'この作品は無料公開。売上はゼロですが、完成経験による理解度と実績が残ります。次の仕事と設備も解禁されます。'}</p><p>次の企画：<strong>${esc(projectAt(state.projectIndex).name)}</strong></p>${state.projectIndex === 5 ? '<div class="modal-callout">AAA、完成。けれどエンディングはありません。次は永続するオンライン宇宙を実装します。</div>' : ''}<div class="modal-actions"><button class="primary-button" data-action="close">次の一文字へ ↗</button></div>`);
});
document.addEventListener('change', e => {
  if (e.target.id === 'language-select' && !blocked) {
    state.typing.language = e.target.value;
    state.typing.context = ''; lastEditorKey = ''; render();
    focusTypingInput();
  }
  if (e.target.id === 'sound-setting') state.settings.sound = e.target.checked;
  if (e.target.id === 'motion-setting') { state.settings.reducedMotion = e.target.checked; render(); }
});
function handleAction(action) {
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
  if (action === 'catalog') showModal('公開したゲーム', state.catalog.slice().reverse().map(p => `<div class="setting-row"><div><b>${esc(p.name)}</b><small>品質 ${p.quality} / 100</small></div><strong>${p.royalty ? `${yen(p.royalty)} / 秒` : '無料公開'}</strong></div>`).join(''));
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
function invalidate() { lastShopKey = ''; lastEditorKey = ''; lastLogKey = ''; lastSkillsKey = ''; lastSecondaryKey = ''; lastCatalogKey = ''; inputContext = ''; lastOfficeOrder = ''; composing = false; dirty = true; lastFrame = performance.now(); }
$('import-file').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file || blocked) return;
  try {
    if (file.size > 500000) throw new Error('セーブファイルが大きすぎます。');
    const imported = deserialize(await file.text());
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
  showModal('おかえりなさい、開発者。', `<p>${duration(offlineResult.seconds)}のあいだも、開発環境は稼働していました。${offlineResult.capped ? '離席中の進行は8時間分までです。' : ''}</p><div class="release-detail"><div><small>資金の増減（事業費・積立込み）</small><b>${offlineResult.cash >= 0 ? '+' : ''}${yen(offlineResult.cash)}</b></div><div><small>有効コード</small><b>+${format(offlineResult.progress)}</b></div></div><p>学習理解度 +${format(offlineResult.knowledge, 2)} K。${state.crashed ? 'ビルドが崩壊しています。学習と修復を確認してください。' : '完成したプロジェクトは開発タブから公開できます。'}</p><div class="modal-actions"><button class="primary-button" data-action="close">続きを始める ↗</button></div>`);
}
