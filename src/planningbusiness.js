// Original, fictional planning coefficients. These numbers describe work in
// Code Typer Idle, not the contracts or fees of real stores or payment firms.
const K = (syntax = 0, design = 0, graphics = 0, systems = 0) => ({ syntax, design, graphics, systems });
const feature = (id, name, baseLines, requirements, requires = [], extra = {}) => ({
  id, name, category: 'business', baseLines, requirements, requires, tags: ['business'], ...extra
});
const cost = (id, name, amount, payee, extra = {}) => ({
  id, name, amount, payee, kind: 'upfront', per: 'project', ...extra
});
const daily = (id, name, amount, payee, perUnit = 0, includedUnits = 0) => cost(id, name, amount, payee, {
  kind: 'recurring', per: 'day', ...(perUnit ? { driver: 'concurrentPlayers', perUnit, includedUnits, defaultUnits: 20 } : {})
});
const rule = (id, when, message, severity = 'error') => ({ id, when, message, severity });
const axis = (id, name, features, extra = {}) => ({ id, name, features, ...extra });

const features = [
  feature('local-player-routing', '複数人の入力・参加・途中離脱', 220, K(35, 45, 10, 20), ['capability:input', 'ui-layout'], {
    tags: ['local-multiplayer', 'input'],
    notes: '2〜4人の入力先と参加枠を分離する。画面分割そのものは別機能。'
  }),
  feature('cooperative-rules', '協力目標・味方判定・共同結果', 280, K(40, 60, 10, 15), ['capability:runtime'], { tags: ['co-op', 'multiplayer-rules'] }),
  feature('versus-rules', '対戦陣営・勝敗・再戦状態', 260, K(40, 55, 10, 15), ['capability:runtime'], { tags: ['versus', 'multiplayer-rules'] }),
  feature('shared-camera', '共有画面（基本構成に含む）', 0, K(), [], { tags: ['camera', 'shared-screen'], notes: 'ひとり用の画面表示は既存の実行・表示基盤に含む。複数人の追従と視認は統合作業として追加する。' }),
  feature('split-screen', '分割ビュー・個別HUD・描画負荷の検証', 700, K(70, 110, 100, 35), ['local-player-routing', 'ui-layout'], {
    tags: ['camera', 'split-screen'],
    notes: '共通ロジックは複製しない。ビューとHUDの分離、2〜4画面の負荷検証を積む。'
  }),
  feature('per-player-camera', '各端末の視点・観測範囲・HUD', 160, K(30, 45, 35, 15), ['ui-layout'], { tags: ['camera', 'online-view'] }),
  feature('service-http', '認証・販売サービスへの通信・再試行', 500, K(45, 65, 5, 80), ['save-load'], {
    tags: ['http-service'], notes: '短いサービス通信。ゲーム世界を常時動かすサーバーではない。'
  }),
  feature('network-transport', '通信メッセージ・順序・接続・再接続', 2000, K(120, 180, 10, 240), ['save-load'], { tags: ['network', 'transport'] }),
  feature('peer-connectivity', 'P2P接続・NAT越え・任意中継', 2300, K(150, 220, 10, 300), ['network-transport'], {
    tags: ['p2p', 'network-topology'],
    costs: [daily('peer-rendezvous', '接続仲介・中継の利用枠', 12, 'P2P接続仲介事業者', .08, 4)],
    notes: 'ゲーム状態は各参加者で動かす。料金は接続仲介・中継であり、専用ゲームサーバー料金ではない。'
  }),
  feature('listen-host', '参加者ホスト・参加承認・ホスト離脱', 2600, K(160, 240, 10, 320), ['network-transport', 'peer-connectivity'], {
    tags: ['listen-server', 'network-topology'],
    notes: 'プレイヤーの1台が権威を持つ。ホストが去った部屋の終了処理を含む。無停止の引継ぎは別機能。'
  }),
  feature('host-migration', 'ホスト移管・再選出・状態引継ぎ', 2800, K(180, 300, 10, 420), ['listen-host'], { tags: ['listen-server', 'migration'] }),
  feature('state-replication', '状態差分・補間・予測・照合', 3200, K(180, 280, 30, 360), ['network-transport'], { tags: ['state-sync', 'synchronization'] }),
  feature('deterministic-simulation', '固定刻み・乱数・状態順序の決定性', 2100, K(160, 250, 20, 240), ['capability:runtime', 'save-load'], {
    tags: ['deterministic', 'synchronization'],
    notes: '入力だけで同じ状態を再現できる実行層。エンジン標準物理の決定性を無条件には仮定しない。'
  }),
  feature('lockstep-sync', '入力待合せ・進行確認・切断時の処置', 1800, K(140, 220, 10, 240), ['network-transport', 'deterministic-simulation'], {
    tags: ['lockstep', 'synchronization'], notes: '全員の入力を待つ方式。回線が遅い参加者に進行を合わせる。'
  }),
  feature('rollback-sync', '予測入力・状態保存・巻戻し再実行', 4600, K(250, 400, 25, 400), ['network-transport', 'deterministic-simulation', 'replays'], {
    tags: ['rollback', 'synchronization'], notes: '決定論的再生と過去状態の保持が必要。状態配信を追加しただけでは代替できない。'
  }),
  feature('server-verification', '入力検証・移動異常・取引監査', 2600, K(160, 260, 10, 360), ['network-authority'], { tags: ['anti-cheat', 'authoritative-server'] }),
  feature('crossplay-session', '異機種の参加・版互換・通信照合', 1700, K(120, 200, 25, 240), ['network-transport'], { tags: ['crossplay'] }),
  feature('free-distribution', '無償公開（基本構成に含む）', 0, K(), [], { tags: ['distribution', 'free-release'] }),
  feature('purchase-entitlements', '購入権・領収検証・復元・返金状態', 650, K(55, 85, 5, 90), ['service-http'], { tags: ['commerce', 'entitlements'] }),
  feature('dlc-entitlements', '追加内容の権利・本編互換・有無の検証', 700, K(65, 100, 10, 90), ['purchase-entitlements', 'save-load'], { tags: ['commerce', 'dlc'] }),
  feature('subscription-access', '期限・継続停止・猶予・利用権検証', 1100, K(70, 120, 10, 150), ['purchase-entitlements', 'accounts'], {
    tags: ['commerce', 'subscription'],
    costs: [daily('subscription-billing', '期間契約・解約通知・請求台帳', 18, '決済サービス事業者')]
  }),
  feature('cosmetic-shop', '外見商品の台帳・購入・表示・復元', 1500, K(90, 150, 30, 150), ['purchase-entitlements', 'accounts', 'inventory'], { tags: ['commerce', 'cosmetic'], notes: '外見商品は戦闘能力を増やさない。素材制作と商品の魅力は別途必要。' }),
  feature('ad-consent', '広告枠・同意・年齢対応・停止設定', 800, K(60, 100, 15, 110), ['service-http', 'settings-localization'], { tags: ['commerce', 'advertising'] }),
  feature('demo-release', '体験版の制限・本編移行・保存互換', 350, K(35, 55, 10, 30), ['save-load', 'capability:build'], { tags: ['distribution', 'demo'] }),
  feature('direct-distribution', '自分の配布ページ（基本構成に含む）', 0, K(), [], {
    tags: ['distribution', 'direct-store'], notes: '静的な配布は無料ホスティングを利用できる。容量・有料決済は別の契約。'
  }),
  feature('pc-store-distribution', 'PCストア登録・版管理・審査対応', 180, K(20, 30, 5, 25), ['capability:build'], {
    costs: [cost('pc-store-listing', 'PCストア作品登録', 10000, 'PCゲーム販売事業者')], tags: ['distribution', 'pc-store']
  }),
  feature('mobile-store-distribution', 'モバイルストア商品・審査・更新', 280, K(25, 40, 10, 35), ['capability:build'], { tags: ['distribution', 'mobile-store'], notes: '端末別の登録費・配布契約は対応先の費用に計上し、ここでは二重請求しない。' }),
  feature('console-store-distribution', '家庭用機ストア商品・審査・パッチ提出', 450, K(40, 65, 20, 60), ['capability:build'], { tags: ['distribution', 'console-store'], notes: '開発機・本体認証は対応先の費用に計上する。' }),
  feature('web-portal-distribution', 'ブラウザポータル公開・埋込・保存互換', 130, K(18, 25, 5, 20), ['capability:build'], { tags: ['distribution', 'web-portal'] }),
  feature('public-source-distribution', 'ソース公開・再現ビルド・依存ライセンス整理', 180, K(20, 30, 0, 25), ['capability:tools'], { tags: ['distribution', 'source-release'], notes: '自分に公開権がある部分だけを配布する。購入素材の再配布権は個別に確認する。' })
];

const playMode = [
  axis('solo', 'ひとり用', [], { quantityDefaults: { concurrentPlayers: 1, localPlayers: 1 } }),
  axis('local-coop', '同じ端末で協力', ['local-player-routing', 'cooperative-rules'], { quantityDefaults: { localPlayers: 2, concurrentPlayers: 1 }, quantityLimits: { localPlayers: { min: 2, max: 4 } } }),
  axis('local-versus', '同じ端末で対戦', ['local-player-routing', 'versus-rules'], { quantityDefaults: { localPlayers: 2, concurrentPlayers: 1 }, quantityLimits: { localPlayers: { min: 2, max: 4 } } }),
  axis('online-coop', '通信で協力', ['cooperative-rules'], { quantityDefaults: { concurrentPlayers: 4 }, quantityLimits: { concurrentPlayers: { min: 2, max: 1000000 } } }),
  axis('online-versus', '通信で対戦', ['versus-rules'], { quantityDefaults: { concurrentPlayers: 2 }, quantityLimits: { concurrentPlayers: { min: 2, max: 1000000 } } }),
  axis('shared-world', '永続する共有世界', ['cooperative-rules', 'persistent-world', 'live-operations'], { quantityDefaults: { concurrentPlayers: 100 }, quantityLimits: { concurrentPlayers: { min: 2, max: 1000000 } } })
];
const network = [
  axis('none', 'ゲーム状態の通信なし', [], { notes: '販売・更新・認証だけのHTTP通信は利用できる。ゲーム状態は通信しない。' }),
  axis('p2p', 'P2P：参加者同士で接続', ['peer-connectivity'], { quantityDefaults: { concurrentPlayers: 4 }, quantityLimits: { concurrentPlayers: { min: 2, max: 8 } }, notes: '専用ゲームサーバー不要。対等な端末間で状態を処理する。' }),
  axis('listen-server', '参加者の端末をホストにする', ['listen-host'], { quantityDefaults: { concurrentPlayers: 4 }, quantityLimits: { concurrentPlayers: { min: 2, max: 32 } }, notes: 'ホストの端末・回線に依存する。ホスト移管は追加機能。' }),
  axis('dedicated', '専用ゲームサーバー', ['network-authority'], { quantityDefaults: { concurrentPlayers: 20 }, quantityLimits: { concurrentPlayers: { min: 2, max: 1000000 } }, notes: '運営者が常時稼働の状態を保持し、その計算・通信費を払う。' })
];
const sync = [
  axis('none', '状態同期なし', []),
  axis('state-sync', '状態配信・補間', ['state-replication']),
  axis('lockstep', '入力待合せ', ['lockstep-sync'], { quantityLimits: { concurrentPlayers: { min: 2, max: 64 } } }),
  axis('rollback', '入力予測・ロールバック', ['rollback-sync'], { quantityLimits: { concurrentPlayers: { min: 2, max: 8 } } })
];
const camera = [
  axis('shared-screen', '全員が同じ画面を見る', ['shared-camera']),
  axis('split-screen', '同じ端末で画面を分割', ['split-screen']),
  axis('per-player', '各端末が独立した視点を持つ', ['per-player-camera'])
];

// A release has a finite reachable audience and a finite lifetime spending
// budget. Subscriptions and cosmetics never mint a permanent royalty rate.
// Core may combine these factors with observed quality and player knowledge;
// raw line count is intentionally absent from this model.
const economics = (priceMultiplier, audienceMultiplier, conversionRate, extra = {}) => ({
  priceMultiplier, audienceMultiplier, conversionRate,
  launchFraction: .25, salesHalfLifeDays: 5,
  lifetimeBudgetMultiplier: 1, recurringPeriods: 1,
  ...extra
});
const salesModel = [
  axis('free', '無料公開', ['free-distribution'], {
    economics: economics(0, 1.4, 0),
    notes: '販売収入は0。遊んでもらい反応・企画の知見を得る。'
  }),
  axis('paid', '買い切り', ['purchase-entitlements'], {
    economics: economics(1, 1, .1),
    notes: '価格×購入者数を発売時と減衰する後売りへ分ける。購入者数は有限。'
  }),
  axis('dlc', '本編に追加コンテンツを販売', ['dlc-entitlements'], {
    economics: economics(.35, .6, .18, { lifetimeBudgetMultiplier: .65 }),
    requiresBaseRelease: true,
    notes: '同一周回に自作の有料本編が必要。既存購入者の一部が買うため、新作と同じ市場を使わない。'
  }),
  axis('subscription', '期間契約', ['subscription-access'], {
    economics: economics(.3, .8, .06, { lifetimeBudgetMultiplier: 1.6, recurringPeriods: 6, salesHalfLifeDays: 12 }),
    notes: '有限の契約者が最大6期間分を支払う見積り。継続費は別に支払う。新規・継続率が落ちれば売上も止まる。'
  }),
  axis('f2p-cosmetic', '基本無料・外見商品の販売', ['free-distribution', 'cosmetic-shop'], {
    economics: economics(.65, 2.2, .025, { lifetimeBudgetMultiplier: 1.2, recurringPeriods: 4, salesHalfLifeDays: 9 }),
    notes: '有限の遊び手のうち少数が、外見商品へ有限の予算を使う。無料だから無限の課金者が来るわけではない。'
  }),
  axis('ad-supported', '無料・広告収入', ['free-distribution', 'ad-consent'], {
    economics: economics(.035, 1.8, .35, { lifetimeBudgetMultiplier: .7, recurringPeriods: 3, salesHalfLifeDays: 7 }),
    notes: '有限の遊び手と閲覧回数から収入を見積もる。広告枠そのものが遊びを面白くはしない。'
  }),
  axis('pay-what-you-want', '無料配布・任意の支援', ['free-distribution', 'purchase-entitlements'], {
    economics: economics(.5, 1.5, .025, { lifetimeBudgetMultiplier: .7 }),
    notes: '支援する人は有限。無償利用者全員を購入者として数えない。'
  })
];
const store = [
  axis('direct', '自分の配布ページ', ['direct-distribution'], {
    permittedTargets: ['windows', 'linux', 'macos', 'browser', 'android'], commissionRate: .05,
    feePayee: '決済サービス事業者', audienceMultiplier: .65,
    notes: '無料配布は手数料0。売れた分だけ決済手数料を払う。集客をストアに任せられない。'
  }),
  axis('pc-store', 'PCゲームストア', ['pc-store-distribution'], {
    permittedTargets: ['windows', 'linux', 'macos'], commissionRate: .3,
    feePayee: 'PCゲーム販売事業者', audienceMultiplier: 1,
    notes: '架空の共通手数料。実在ストアの契約条件ではない。'
  }),
  axis('mobile-store', 'モバイルアプリストア', ['mobile-store-distribution'], {
    permittedTargets: ['android', 'ios'], commissionRate: .3,
    feePayee: 'アプリ配布事業者', audienceMultiplier: .95
  }),
  axis('console-store', '家庭用機ストア', ['console-store-distribution'], {
    permittedTargets: ['console'], commissionRate: .3,
    feePayee: 'ゲーム機プラットフォーム事業者', audienceMultiplier: 1
  }),
  axis('web-portal', 'ブラウザゲームポータル', ['web-portal-distribution'], {
    permittedTargets: ['browser'], commissionRate: .2,
    feePayee: 'ブラウザゲーム配信事業者', audienceMultiplier: .8
  }),
  axis('source-release', 'ソースコードも公開', ['public-source-distribution'], {
    permittedTargets: ['windows', 'linux', 'macos', 'browser', 'android'], commissionRate: 0,
    feePayee: null, audienceMultiplier: .45,
    supportsPurchases: false,
    notes: 'この配布先だけでは有料決済を扱わない。他の販売先と併用できる。購入素材の公開権は別扱い。'
  })
];

const constraints = [
  rule('online-needs-transport', { playModeId: ['online-coop', 'online-versus', 'shared-world'], networkId: ['none'] }, '通信プレイにはP2P・参加者ホスト・専用サーバーのいずれかが必要です。'),
  rule('online-needs-synchronization', { playModeId: ['online-coop', 'online-versus', 'shared-world'], syncId: ['none'] }, '通信プレイには状態同期方式が必要です。'),
  rule('offline-no-player-transport', { playModeId: ['solo', 'local-coop', 'local-versus'], networkId: ['p2p', 'listen-server', 'dedicated'] }, 'このプレイ形式はゲーム状態を通信しません。通信で遊ぶ形式へ変えるか、通信基盤を「なし」にしてください。'),
  rule('offline-no-player-sync', { playModeId: ['solo', 'local-coop', 'local-versus'], syncId: ['state-sync', 'lockstep', 'rollback'] }, 'ひとり用・同じ端末でのプレイにはネットワーク同期を付けません。'),
  rule('shared-world-needs-dedicated', { playModeId: ['shared-world'], networkId: ['none', 'p2p', 'listen-server'] }, '参加者が離れても続く共有世界は、専用サーバーで運営します。'),
  rule('shared-world-state-sync', { playModeId: ['shared-world'], syncId: ['none', 'lockstep', 'rollback'] }, 'この共有世界モデルは状態配信に対応します。少人数の入力待合せ・巻戻し方式とは分けて見積もります。'),
  rule('split-needs-local-multiplayer', { playModeId: ['solo', 'online-coop', 'online-versus', 'shared-world'], cameraId: ['split-screen'] }, '画面分割は同じ端末で複数人が遊ぶ形式に選べます。'),
  rule('local-needs-common-display', { playModeId: ['solo', 'local-coop', 'local-versus'], cameraId: ['per-player'] }, '端末ごとの独立視点は通信プレイ向けです。同じ端末では共有画面か画面分割を選びます。'),
  rule('p2p-no-dedicated-state', { networkId: ['p2p', 'listen-server', 'none'], featuresAny: ['persistent-world', 'server-verification', 'sharding'] }, '永続世界・サーバー監査・世界分散には専用サーバーが必要です。'),
  rule('none-no-network-features', { networkId: ['none'], featuresAny: ['peer-connectivity', 'listen-host', 'network-authority', 'network-transport', 'matchmaking', 'crossplay-session'] }, '通信なしの企画にゲーム接続機能が含まれています。通信方式とプレイ形式を選び直してください。'),
  rule('p2p-dedicated-cannot-mix', { networkId: ['p2p', 'listen-server'], featuresAny: ['network-authority'] }, 'P2P・参加者ホストと専用ゲームサーバーの実装を重ねないでください。'),
  rule('dedicated-no-peer-host', { networkId: ['dedicated'], featuresAny: ['listen-host', 'host-migration'] }, '専用サーバーの企画に、参加者ホストの移管は必要ありません。'),
  rule('rollback-needs-deterministic-replay', { syncId: ['rollback'], missingAllFeatures: ['deterministic-simulation'] }, 'ロールバックには決定論的な実行層が必要です。'),
  rule('rollback-needs-history', { syncId: ['rollback'], missingAllFeatures: ['replays'] }, 'ロールバックには入力記録と再実行が必要です。'),
  rule('lockstep-realtime-risk', { syncId: ['lockstep'], featuresAny: ['rhythm-judgement', 'frame-combat', 'realtime-combat'] }, '入力待合せでは遅い回線が全員の進行を止めます。反応速度が重要な遊びは遅延の検証が必要です。', 'warning'),
  rule('rollback-physics-risk', { syncId: ['rollback'], featuresAny: ['scene-3d', 'vehicle-racing'] }, '物理演算・浮動小数点差・重い状態を巻き戻せるか、決定性と再実行時間を検証してください。', 'warning'),
  rule('p2p-competitive-trust', { networkId: ['p2p', 'listen-server'], playModeId: ['online-versus'] }, '参加者の端末を信頼する方式です。不正対策とホスト優位を別途検証してください。', 'warning'),
  rule('console-distribution-needed', { targetsAny: ['console'], missingAllFeatures: ['console-store-distribution'] }, '家庭用機の公開には家庭用機ストアを選びます。'),
  rule('ios-distribution-needed', { targetsAny: ['ios'], missingAllFeatures: ['mobile-store-distribution'] }, 'この世界のiOS配布にはモバイルストアを選びます。'),
  rule('pc-store-needs-pc', { storeIdsAny: ['pc-store'], missingAllFeatures: ['target-windows', 'target-linux', 'target-macos'] }, 'PCゲームストアを使うには、デスクトップ向けの対応先が必要です。'),
  rule('mobile-store-needs-mobile', { storeIdsAny: ['mobile-store'], missingAllFeatures: ['target-android', 'target-ios'] }, 'モバイルストアを使うには、AndroidかiOS向けの対応先が必要です。'),
  rule('console-store-needs-console', { storeIdsAny: ['console-store'], missingAllFeatures: ['target-console'] }, '家庭用機ストアを使うには、家庭用機向けの対応先が必要です。'),
  rule('web-portal-needs-browser', { storeIdsAny: ['web-portal'], missingAllFeatures: ['target-browser'] }, 'ブラウザポータルを使うには、ブラウザ向けの対応先が必要です。'),
  rule('paid-needs-checkout', { salesModelId: ['paid', 'dlc', 'subscription', 'f2p-cosmetic', 'pay-what-you-want'], missingAllFeatures: ['direct-distribution', 'pc-store-distribution', 'mobile-store-distribution', 'console-store-distribution', 'web-portal-distribution'] }, 'この販売方式には決済を扱う配布先が必要です。ソース公開だけでは購入を処理しません。'),
  rule('public-source-commission-rights', { storeIdsAny: ['source-release'] }, 'ソース公開時も購入・委託素材の権利は別です。公開許諾を得た素材だけを同梱します。', 'warning')
];

const examplePlan = {
  engineId: 'toolkit', presentationId: 'pixel-2d', audioId: 'chiptune', inputId: 'keyboard-mouse',
  playModeId: 'solo', networkId: 'none', syncId: 'none', cameraId: 'shared-screen',
  salesModelId: 'free', storeIds: ['direct'], features: []
};
const examples = [
  {
    id: 'p2p-rollback-fighter', name: 'ふたりで読み合うロールバック格闘',
    description: '2人対戦。P2Pと入力巻戻しを使い、4人の選手と3つの舞台で技を競う。',
    plan: { ...examplePlan, genreId: 'fighting', engineId: 'godot', inputId: 'gamepad', targets: ['windows', 'linux'],
      playModeId: 'online-versus', networkId: 'p2p', syncId: 'rollback', cameraId: 'per-player',
      salesModelId: 'paid', storeIds: ['pc-store'], quantities: { concurrentPlayers: 2 },
      features: [{ id: 'character-content', quantity: 4 }, { id: 'stage-content', quantity: 3 }, { id: 'audio-content', quantity: 2 }]
    }
  },
  {
    id: 'local-split-racer', name: '集まって遊ぶ4画面レース',
    description: '同じ端末で4人対戦。画面を分割し、6車種と3コースから選んで走る。',
    plan: { ...examplePlan, genreId: 'racing', engineId: 'unity', presentationId: '3d', audioId: 'recorded', inputId: 'gamepad', targets: ['console'],
      playModeId: 'local-versus', cameraId: 'split-screen', salesModelId: 'paid', storeIds: ['console-store'],
      quantities: { localPlayers: 4 }, themeIds: ['sports-competition'],
      features: [{ id: 'vehicle-content', quantity: 6 }, { id: 'stage-content', quantity: 3 }, { id: 'replays' }, { id: 'unity-physics3d' }]
    }
  },
  {
    id: 'hosted-coop-survival', name: '友達の世界で暮らす協力サバイバル',
    description: '4人のうち1人がホスト。採取・建築・生産を進め、ホスト離脱時は世界を引き継ぐ。',
    plan: { ...examplePlan, genreId: 'survival-crafting', engineId: 'custom', presentationId: '3d', audioId: 'recorded', targets: ['windows', 'linux'],
      playModeId: 'online-coop', networkId: 'listen-server', syncId: 'state-sync', cameraId: 'per-player',
      salesModelId: 'paid', storeIds: ['pc-store'], quantities: { concurrentPlayers: 4 }, themeIds: ['post-apocalyptic'],
      features: [{ id: 'host-migration' }, { id: 'terrain-navigation' }, { id: 'world-content', quantity: 3 }, { id: 'enemy-content', quantity: 8 }, { id: 'recipe-content', quantity: 12 }]
    }
  },
  {
    id: 'subscription-shared-world', name: '期間契約で運営する冒険者の街',
    description: '100人が暮らす共有世界。10地域の探索と依頼を作り、世界保存・監視・契約管理を運営する。',
    plan: { ...examplePlan, genreId: 'action-rpg', engineId: 'unreal', presentationId: '3d', audioId: 'recorded', targets: ['windows'],
      playModeId: 'shared-world', networkId: 'dedicated', syncId: 'state-sync', cameraId: 'per-player',
      salesModelId: 'subscription', storeIds: ['pc-store'], quantities: { concurrentPlayers: 100 }, themeIds: ['high-fantasy'],
      features: [{ id: 'social-chat' }, { id: 'moderation' }, { id: 'world-content', quantity: 10 }, { id: 'character-content', quantity: 20 }, { id: 'quest-content', quantity: 25 }, { id: 'audio-content', quantity: 6 }]
    }
  },
  {
    id: 'mobile-cosmetic-farming', name: '着替えを楽しむ無料の農園生活',
    description: '農作物と住民の関係を楽しむひとり用。無料で遊べ、衣装を購入・復元できる。',
    plan: { ...examplePlan, genreId: 'farming', engineId: 'unity', presentationId: 'illustrated-2d', audioId: 'recorded', inputId: 'touch', targets: ['android', 'ios'],
      salesModelId: 'f2p-cosmetic', storeIds: ['mobile-store'], themeIds: ['cozy-rural'],
      features: [{ id: 'social-relationships' }, { id: 'weather-daynight' }, { id: 'character-content', quantity: 8 }, { id: 'item-content', quantity: 20 }, { id: 'world-content', quantity: 2 }]
    }
  },
  {
    id: 'mystery-dlc-chapters', name: '公開した推理作へ続編3章を追加',
    description: '購入済み本編に追加する3章。新しい4人の証言と30本の台詞音声をつなぐ。',
    plan: { ...examplePlan, genreId: 'deduction', engineId: 'godot', presentationId: 'illustrated-2d', audioId: 'recorded', targets: ['windows', 'macos'],
      salesModelId: 'dlc', storeIds: ['pc-store'], themeIds: ['detective-noir'],
      features: [{ id: 'story-content', quantity: 3 }, { id: 'character-content', quantity: 4 }, { id: 'voice-content', quantity: 30 }]
    }
  },
  {
    id: 'unity-mobile-match', name: '指で連鎖をつなぐ買い切りパズル',
    description: '30面の手作り配置をタッチで解く。買い切りで広告や通信対戦は付けない。',
    plan: { ...examplePlan, genreId: 'match-puzzle', engineId: 'unity', presentationId: 'illustrated-2d', audioId: 'silent', inputId: 'touch', targets: ['android', 'ios'],
      salesModelId: 'paid', storeIds: ['mobile-store'], themeIds: ['abstract'],
      features: [{ id: 'stage-content', quantity: 30 }, { id: 'tutorial-hints' }, { id: 'save-load' }]
    }
  },
  {
    id: 'godot-short-rpg', name: '3つの町を巡る短編ドット絵RPG',
    description: '4人の仲間と10件の依頼。3つの町を巡る小さな買い切り冒険を作る。',
    plan: { ...examplePlan, genreId: 'turn-rpg', engineId: 'godot', inputId: 'gamepad', targets: ['windows', 'linux', 'macos'],
      salesModelId: 'paid', storeIds: ['pc-store'], themeIds: ['high-fantasy'],
      features: [{ id: 'world-content', quantity: 3 }, { id: 'quest-content', quantity: 10 }, { id: 'enemy-content', quantity: 8 }, { id: 'character-content', quantity: 4 }, { id: 'audio-content', quantity: 4 }]
    }
  },
  {
    id: 'unreal-stealth-escape', name: '物音を頼りに逃げる3D怪異探索',
    description: '3つの場所を調べ、怪異の警戒と捜索を避けながら出口を探す。',
    plan: { ...examplePlan, genreId: 'escape', engineId: 'unreal', presentationId: '3d', audioId: 'recorded', targets: ['windows'],
      salesModelId: 'paid', storeIds: ['pc-store'], themeIds: ['supernatural-horror'],
      features: [{ id: 'stealth-awareness' }, { id: 'stage-content', quantity: 3 }, { id: 'enemy-content', quantity: 2 }]
    }
  },
  {
    id: 'custom-open-platformer', name: '自作基盤で公開する小さなアクション',
    description: '好みの跳躍と衝突判定から自作。6面を無料公開し、基盤とコードも共有する。',
    plan: { ...examplePlan, genreId: 'platformer', engineId: 'custom', targets: ['linux', 'browser'],
      storeIds: ['direct', 'source-release'], themeIds: ['dream-surreal'],
      features: [{ id: 'stage-content', quantity: 6 }, { id: 'character-content', quantity: 2 }, { id: 'enemy-content', quantity: 3 }, { id: 'audio-content', quantity: 2 }]
    }
  },
  {
    id: 'ad-supported-web-puzzle', name: 'ブラウザで遊ぶ広告付き配置パズル',
    description: '30問の盤面パズルを無料公開。広告の同意と停止設定を用意する。',
    plan: { ...examplePlan, genreId: 'sliding-puzzle', engineId: 'godot', presentationId: 'illustrated-2d', audioId: 'silent', inputId: 'touch', targets: ['browser'],
      salesModelId: 'ad-supported', storeIds: ['web-portal'], themeIds: ['abstract'],
      features: [{ id: 'puzzle-content', quantity: 30 }, { id: 'tutorial-hints' }]
    }
  },
  {
    id: 'supported-open-novel', name: '読んだ人の支援を受ける短編ノベル',
    description: '2章・3人の物語を無料で読める形にし、任意の支援とソース公開を併用する。',
    plan: { ...examplePlan, genreId: 'visual-novel', engineId: 'godot', presentationId: 'illustrated-2d', audioId: 'recorded', targets: ['windows', 'linux'],
      salesModelId: 'pay-what-you-want', storeIds: ['direct', 'source-release'], themeIds: ['everyday-life'],
      features: [{ id: 'story-content', quantity: 2 }, { id: 'character-content', quantity: 3 }, { id: 'audio-content', quantity: 2 }]
    }
  }
];

export const PLANNING_BUSINESS = {
  axes: { playMode, network, sync, camera, salesModel, store },
  defaultSelections: { playModeId: 'solo', networkId: 'none', syncId: 'none', cameraId: 'shared-screen', salesModelId: 'free', storeIds: ['direct'] },
  features,
  // Existing features predate transport choices. Replace their dependencies
  // when combining the catalog; accounts are not dedicated game servers.
  featureOverrides: {
    'network-authority': { requires: ['network-transport', 'save-load'] },
    accounts: { requires: ['service-http', 'save-load'] },
    matchmaking: { requires: ['network-transport', 'accounts'] }
  },
  integrations: [
    { id: 'local-camera-routing', name: '複数入力と共有画面の追従・外周検証', requires: ['local-player-routing', 'shared-camera'], lines: 140, requirementsAdd: { design: 10, graphics: 5 } },
    { id: 'split-view-3d', name: '分割3Dビューの負荷・描画境界', requires: ['split-screen', 'scene-3d'], lines: 1100, requirementsAdd: { graphics: 45, systems: 20 } },
    { id: 'local-shared-inventory', name: '共同所持品・個別操作の競合検証', requires: ['local-player-routing', 'inventory'], lines: 200, requirementsAdd: { design: 12 } },
    { id: 'rollback-frame-combat', name: '格闘の巻戻しとヒット確定の照合', requires: ['rollback-sync', 'frame-combat'], lines: 1500, requirementsAdd: { design: 35, systems: 45 } },
    { id: 'rollback-physics-3d', name: '3D物理状態の保存・決定性検証', requires: ['rollback-sync', 'capability:physics3d'], lines: 4500, requirementsAdd: { graphics: 40, systems: 100 } },
    { id: 'lockstep-strategy', name: '戦略AI・資源会計の同一状態照合', requires: ['lockstep-sync', 'resource-economy'], lines: 850, requirementsAdd: { design: 20, systems: 30 } },
    { id: 'peer-realtime-combat', name: '参加者間の遅延・命中・再接続の照合', requires: ['peer-connectivity', 'realtime-combat'], lines: 2100, requirementsAdd: { design: 45, systems: 65 } },
    { id: 'listen-host-persistence', name: 'ホスト切断時の保存・報酬確定', requires: ['listen-host', 'inventory'], lines: 900, requirementsAdd: { design: 25, systems: 35 } },
    { id: 'network-cross-target', name: '異機種通信の版違い・浮動小数点差の検証', requires: ['network-transport'], minTargets: 2, lines: 900, requirementsAdd: { systems: 40 } },
    { id: 'subscription-persistent-world', name: '契約失効・復帰と共有世界の所有物', requires: ['subscription-access', 'persistent-world'], lines: 1800, requirementsAdd: { design: 40, systems: 45 } },
    { id: 'cosmetic-avatar', name: '購入外見と身体・接触状態の分離', requires: ['cosmetic-shop', 'embodiment'], lines: 5000, requirementsAdd: { graphics: 100, systems: 80 } },
    { id: 'dlc-story-save', name: '追加章の未購入・既読・保存互換', requires: ['dlc-entitlements', 'story-content'], lines: 450, requirementsAdd: { design: 20, systems: 15 } }
  ],
  constraints,
  examples,
  quantityDefinitions: {
    localPlayers: { name: '同じ端末の人数', unit: '人', min: 1, max: 4, default: 2 },
    concurrentPlayers: { name: '同時接続人数', unit: '人', min: 1, max: 1000000, default: 20 },
    sensorySessions: { name: '感覚I/O同時接続数', unit: '接続', min: 1, max: 1000000, default: 1 }
  },
  economicsPolicy: {
    audienceIsFinite: true,
    revenueIsFinite: true,
    repeatPurchasesAcrossStores: false,
    maximumLifetimeBudgetMultiplier: 2,
    defaultStoreCommissionRate: .3,
    storeSelection: 'audience-weighted-average',
    notes: '複数ストアへ出しても同じ購入者を重複計上しない。販売先の手数料は集客係数で加重平均し、売れた金額からだけ引く。維持費を払えば無限に売れるという式にはしない。'
  }
};
