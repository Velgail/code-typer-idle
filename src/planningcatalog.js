// A fictional, shared-SDK effort model. These are game balance values, not
// claims about the real minimum source size or market prices of a game.
// One standardized implementation line is 40 characters. Asset production is
// separate work; neither more code nor more assets automatically adds quality.
const K = (syntax = 0, design = 0, graphics = 0, systems = 0) => ({ syntax, design, graphics, systems });
const F = (id, name, category, baseLines, requirements, requires = [], extra = {}) => ({
  id, name, category, baseLines, requirements, requires, tags: [category], ...extra
});
const Q = (min = 1, max = 10000, value = 1) => ({ min, max, default: value });
const A = (id, name, unit, count, selfWorkPerUnit, licenseCost, commissionCost, creator) => ({
  id, name, unit, count, selfWorkPerUnit,
  // Work is measured in fictional asset-production hours, not source lines.
  workUnit: 'asset-hour',
  sourcing: {
    self: { unitCost: 0, payee: null },
    license: { unitCost: licenseCost, payee: '素材ライセンス販売者' },
    commission: { unitCost: commissionCost, payee: creator }
  }
});
const upfront = (id, name, amount, payee) => ({ id, name, amount, payee, kind: 'upfront', per: 'project' });
const operating = (id, name, amount, payee, perUnit = 0, includedUnits = 0) => ({
  id, name, amount, payee, kind: 'recurring', per: 'day',
  ...(perUnit ? { driver: 'concurrentPlayers', perUnit, includedUnits } : {})
});

const providerFeatures = [
  // Runtime includes input dispatch; tools include the build pipeline. Reusing
  // the same provider for both capabilities deliberately counts it only once.
  F('sdk-runtime', '共通SDK：実行・入力', 'foundation', 12, K(4, 2), [], { tags: ['runtime', 'input'] }),
  F('sdk-tools', '共通SDK：制作・ビルド接続', 'foundation', 13, K(4, 3), [], { tags: ['tools', 'build'] }),
  F('sdk-render2d', '共通SDK：2D描画接続', 'foundation', 80, K(12, 8, 12), ['capability:runtime'], { tags: ['render-2d'] }),
  F('sdk-render3d', '共通SDK：3D描画接続', 'foundation', 900, K(90, 70, 120, 40), ['capability:runtime'], { tags: ['render-3d'] }),
  F('sdk-physics2d', '共通SDK：2D衝突・物理接続', 'foundation', 80, K(16, 12, 15), ['capability:runtime'], { tags: ['physics-2d'] }),
  F('sdk-physics3d', '共通SDK：3D衝突・物理接続', 'foundation', 450, K(90, 80, 100, 50), ['capability:runtime'], { tags: ['physics-3d'] }),
  F('sdk-audio', '共通SDK：音声再生接続', 'foundation', 40, K(10, 6, 4, 4), ['capability:runtime'], { tags: ['audio'] }),
  F('engine-runtime', '既製エンジン：実行・入力設定', 'foundation', 8, K(4, 2), [], { tags: ['runtime', 'input'] }),
  F('engine-tools', '既製エンジン：制作・ビルド設定', 'foundation', 8, K(4, 3), [], { tags: ['tools', 'build'] }),
  F('engine-render2d', '既製エンジン：2D描画設定', 'foundation', 35, K(10, 6, 10), ['capability:runtime'], { tags: ['render-2d'] }),
  F('engine-render3d', '既製エンジン：3D描画設定', 'foundation', 350, K(60, 50, 90, 30), ['capability:runtime'], { tags: ['render-3d'] }),
  F('engine-physics2d', '既製エンジン：2D物理設定', 'foundation', 35, K(12, 10, 12), ['capability:runtime'], { tags: ['physics-2d'] }),
  F('engine-physics3d', '既製エンジン：3D物理設定', 'foundation', 180, K(70, 60, 80, 40), ['capability:runtime'], { tags: ['physics-3d'] }),
  F('engine-audio', '既製エンジン：音声設定', 'foundation', 20, K(8, 5, 4, 3), ['capability:runtime'], { tags: ['audio'] }),
  F('engine-contract', '既製エンジン開発契約', 'foundation', 0, K(), [], {
    costs: [upfront('engine-license', '架空エンジン開発契約', 24000, 'エンジン開発元')],
    notes: '架空世界の企画単位契約。Unity/Unreal Engine等の実際の契約を表さない。'
  }),
  F('custom-runtime', '自作：実行ループ・入力層', 'foundation', 1200, K(80, 100, 20, 100), [], { tags: ['runtime', 'input', 'custom-engine'] }),
  F('custom-tools', '自作：編集ツール・ビルド基盤', 'foundation', 3000, K(130, 200, 40, 160), ['capability:runtime'], { tags: ['tools', 'build', 'custom-engine'] }),
  F('custom-render2d', '自作：2D描画基盤', 'foundation', 2500, K(120, 140, 180, 80), ['capability:runtime'], { tags: ['render-2d', 'custom-engine'] }),
  F('custom-render3d', '自作：3D描画基盤', 'foundation', 30000, K(450, 600, 800, 400), ['capability:runtime'], { tags: ['render-3d', 'custom-engine'] }),
  F('custom-physics2d', '自作：2D衝突・物理基盤', 'foundation', 1800, K(100, 130, 120, 80), ['capability:runtime'], { tags: ['physics-2d', 'custom-engine'] }),
  F('custom-physics3d', '自作：3D衝突・物理基盤', 'foundation', 12000, K(350, 500, 500, 300), ['capability:runtime'], { tags: ['physics-3d', 'custom-engine'] }),
  F('custom-audio', '自作：音声処理基盤', 'foundation', 2000, K(100, 120, 100, 140), ['capability:runtime'], { tags: ['audio', 'custom-engine'] })
].map(feature => feature.id === 'engine-contract' ? feature : {
  ...feature, exclusiveGroup: `provider-${feature.id.replace(/^(sdk|engine|custom)-/, '')}`
});

const platformFeatures = [
  F('target-windows', 'Windows移植・配布・検証', 'platform', 30, K(8, 8, 0, 10), ['capability:build']),
  F('target-linux', 'Linux移植・配布・検証', 'platform', 30, K(8, 8, 0, 10), ['capability:build']),
  F('target-macos', 'macOS移植・署名・検証', 'platform', 45, K(10, 10, 0, 15), ['capability:build'], {
    costs: [upfront('macos-signing', '署名・配布契約（架空単価）', 10000, 'OS配布認証事業者')]
  }),
  F('target-browser', 'ブラウザ実行・保存・検証', 'platform', 20, K(8, 8, 0, 8), ['capability:build']),
  F('target-android', 'Android移植・画面・審査', 'platform', 120, K(20, 25, 10, 25), ['capability:build'], {
    costs: [upfront('android-distribution', 'モバイル配布登録（架空単価）', 3000, 'アプリ配布事業者')]
  }),
  F('target-ios', 'iOS移植・画面・審査', 'platform', 150, K(20, 25, 10, 30), ['capability:build'], {
    costs: [upfront('ios-distribution', 'モバイル配布契約（架空単価）', 12000, 'アプリ配布事業者')]
  }),
  F('target-console', '家庭用機移植・認証・審査', 'platform', 300, K(40, 50, 20, 60), ['capability:build'], {
    costs: [upfront('console-certification', '開発機・認証検証契約（架空単価）', 100000, 'ゲーム機プラットフォーム事業者')]
  })
];

const commonFeatures = [
  F('console-ui', '文字端末の入力・結果表示', 'interface', 10, K(6, 3), ['capability:input']),
  F('ui-layout', '画面・メニュー・状態表示', 'interface', 100, K(15, 15, 10), ['capability:input']),
  F('save-load', '保存・読込・形式検証', 'system', 120, K(20, 25, 0, 15), ['capability:runtime'], { tags: ['persistence'] }),
  F('settings-localization', '設定・翻訳差替・文字組み', 'interface', 160, K(22, 25, 15), ['ui-layout']),
  F('accessibility', '字幕・色・操作補助', 'interface', 180, K(25, 30, 20), ['ui-layout']),
  F('tutorial-hints', 'ルール説明・段階ヒント', 'interface', 120, K(15, 25, 8), ['ui-layout']),
  F('pixel-art', 'ドット絵2D表現', 'presentation', 60, K(12, 10, 18), ['capability:render2d'], {
    assets: [A('pixel-style-kit', 'ドット絵の基礎素材セット', 'セット', 1, 8, 2000, 20000, 'ピクセルアーティスト')], tags: ['pixel', 'render-2d']
  }),
  F('illustrated-art', 'イラスト2D表現', 'presentation', 100, K(12, 12, 20), ['capability:render2d'], {
    assets: [A('illustration-style-kit', 'イラストの基礎素材セット', 'セット', 1, 12, 3000, 30000, 'イラストレーター')], tags: ['illustration', 'render-2d']
  }),
  F('scene-3d', '3Dシーン・カメラ・照明', 'presentation', 1200, K(100, 130, 160, 50), ['capability:render3d'], {
    assets: [A('model-style-kit', '3Dモデル・マテリアル基礎セット', 'セット', 1, 30, 8000, 80000, '3Dアーティスト')], tags: ['render-3d']
  }),
  F('chiptune', 'チップ音源・シーケンサ接続', 'audio', 100, K(18, 15, 12, 12), ['capability:audio'], {
    assets: [A('chip-instruments', 'チップ音色・効果音セット', 'セット', 1, 6, 1000, 10000, 'チップ音楽制作者')], tags: ['chiptune']
  }),
  F('recorded-audio', '収録音源・ミキサー接続', 'audio', 120, K(18, 18, 15, 15), ['capability:audio'], {
    assets: [A('recorded-effects', '収録効果音セット', 'セット', 1, 10, 3000, 30000, '音響制作者')]
  }),
  F('gamepad-controls', 'ゲームパッド操作・表示対応', 'input', 80, K(12, 15, 5, 8), ['capability:input', 'ui-layout']),
  F('touch-controls', 'タッチ操作・画面配置', 'input', 140, K(18, 25, 15, 10), ['capability:input', 'ui-layout']),
  F('vr-io', 'VR姿勢・両手・空間UI', 'input', 5000, K(250, 350, 400, 300), ['scene-3d', 'capability:input'], {
    costs: [upfront('vr-test-rig', 'VR入力検証機材', 100000, '入力機器メーカー')], tags: ['vr', 'spatial-input']
  }),
  F('full-dive-io', 'フルダイブ感覚I/O接続', 'input', 120000, K(3000, 4500, 4000, 6000), ['scene-3d', 'capability:input'], {
    costs: [upfront('full-dive-sdk', '感覚I/O開発・検証契約', 10000000, 'フルダイブ基盤事業者')], tags: ['full-dive', 'neural-interface'],
    notes: 'この世界に存在する外部感覚I/O基盤を利用する。脳機器そのものの研究開発費は含まない。'
  })
];

const gameplayFeatures = [
  F('number-rules', '数理入力・正誤・終了判定', 'rules', 20, K(12, 3), ['capability:runtime']),
  F('board-rules', '盤面・合法手・達成条件', 'rules', 100, K(20, 20, 10), ['capability:runtime']),
  F('falling-blocks', '回転・落下・消去・速度推移', 'rules', 180, K(30, 25, 15), ['board-rules']),
  F('match-chains', '交換・連鎖・補充', 'rules', 220, K(35, 30, 15), ['board-rules']),
  F('ball-reflection', '反射・破壊・クリア判定', 'rules', 80, K(24, 8, 8), ['capability:physics2d']),
  F('platform-motion', '移動・跳躍・地形・ゴール', 'rules', 450, K(45, 40, 35), ['capability:physics2d']),
  F('topdown-motion', '見下ろし移動・敵状態', 'rules', 250, K(35, 30, 20), ['capability:runtime']),
  F('realtime-combat', '攻撃・防御・敵AI・勝敗', 'rules', 650, K(65, 60, 40, 20), ['topdown-motion'], { tags: ['combat'] }),
  F('projectiles-waves', '弾・命中・敵出現波', 'rules', 400, K(45, 40, 30), ['topdown-motion']),
  F('rhythm-judgement', '譜面・音楽時計・判定・採点', 'rules', 600, K(60, 70, 30, 40), ['capability:audio'], { tags: ['timing'] }),
  F('frame-combat', '行動フレーム・攻防・相手AI', 'rules', 1000, K(90, 110, 50, 40), ['realtime-combat'], { tags: ['frame-simulation'] }),
  F('vehicle-racing', '車両操作・コース・周回・記録', 'rules', 1100, K(100, 100, 90, 40), ['capability:runtime'], { tags: ['vehicle-simulation', 'lap-rules'] }),
  F('sports-rules', 'ボール・競技規則・得点・対戦AI', 'rules', 850, K(80, 100, 70, 30), ['capability:physics2d']),
  F('turn-combat', '行動順・コマンド・戦闘結果', 'rules', 500, K(55, 65, 25), ['capability:runtime'], { tags: ['combat'] }),
  F('progression', '成長・能力・報酬・装備', 'rules', 350, K(40, 55, 15), ['save-load']),
  F('inventory', '所持品・使用・装備状態', 'rules', 250, K(35, 45, 15), ['save-load']),
  F('procedural-dungeon', '迷路生成・接続・到達性検証', 'rules', 800, K(80, 100, 30, 20), ['board-rules'], { tags: ['procedural-generation'] }),
  F('fog-vision', '視界・探索記憶・未発見領域', 'rules', 200, K(35, 40, 25), ['board-rules']),
  F('dialogue-branches', '台詞・選択・フラグ・分岐', 'rules', 350, K(40, 55, 15), ['save-load']),
  F('evidence-deduction', '証拠収集・照合・推論条件', 'rules', 450, K(45, 65, 20), ['dialogue-branches', 'inventory']),
  F('interact-puzzles', '調査・道具・条件仕掛け・出口', 'rules', 400, K(45, 55, 25), ['inventory']),
  F('deck-effects', '山札・カード効果・資源・報酬', 'rules', 700, K(65, 90, 25), ['turn-combat', 'progression']),
  F('grid-tactics', 'マス移動・行動範囲・敵戦術', 'rules', 800, K(80, 100, 35), ['board-rules', 'turn-combat', 'pathfinding']),
  F('resource-economy', '資源・生産消費・収支', 'rules', 450, K(50, 75, 15), ['capability:runtime']),
  F('construction', '配置・占有・接続・建築状態', 'rules', 650, K(65, 85, 35), ['board-rules', 'inventory']),
  F('pathfinding', '経路探索・障害・移動予約', 'rules', 600, K(65, 85, 30, 30), ['capability:runtime'], { tags: ['navigation'] }),
  F('research-factions', '領土・研究・外交・勢力AI', 'rules', 1500, K(120, 180, 40, 40), ['resource-economy', 'turn-combat']),
  F('city-services', '人口・需要・公共サービス', 'rules', 5000, K(250, 400, 100, 160), ['construction', 'resource-economy', 'pathfinding']),
  F('production-market', '製造・在庫・価格・需要会計', 'rules', 1800, K(130, 200, 40, 50), ['resource-economy', 'inventory']),
  F('farming-cycle', '日周・生育・道具・収穫', 'rules', 700, K(65, 80, 35), ['inventory', 'save-load']),
  F('crafting-survival', '採取・レシピ・建築・生存', 'rules', 1000, K(90, 130, 50, 30), ['construction', 'inventory']),
  F('idle-offline', '強化・自動tick・離席精算', 'rules', 700, K(75, 110, 20, 60), ['resource-economy', 'save-load']),
  F('quests', '依頼・達成条件・報酬・進行', 'rules', 600, K(70, 100, 20, 20), ['dialogue-branches', 'progression']),
  F('world-content', '地域データ・配置・遷移接続', 'content', 200, K(35, 50, 25), ['save-load'], {
    quantity: Q(1, 10000, 1), linesPerUnit: 40,
    assets: [A('region-art', '地域の背景・地形・小物素材', '地域', 1, 24, 6000, 60000, '背景・環境アーティスト')],
    notes: '地域数は素材と配置作業を増やす。各地域で同じ移動・保存基盤を再実装しない。'
  }),
  F('story-content', '章データ・台詞・条件接続', 'content', 100, K(20, 35, 10), ['dialogue-branches'], {
    quantity: Q(1, 10000, 1), linesPerUnit: 8,
    assets: [A('story-chapter', '脚本（約1万語の章）', '章', 1, 40, 10000, 100000, 'シナリオライター')],
    notes: '物語本文はcodeLinesに数えない。追加章は接続・検証コードだけを増やす。'
  }),
  F('character-content', '登場キャラクター定義・接続', 'content', 100, K(20, 30, 20), ['capability:runtime'], {
    quantity: Q(1, 100000, 1), linesPerUnit: 12,
    assets: [A('character-art', 'キャラクター視覚素材一式', '人', 1, 20, 4000, 40000, 'キャラクターアーティスト')]
  }),
  F('audio-content', '楽曲データ・再生条件接続', 'content', 40, K(12, 15, 8), ['capability:audio'], {
    quantity: Q(1, 10000, 1), linesPerUnit: 4,
    assets: [A('music-track', '楽曲', '曲', 1, 8, 2000, 20000, '作曲家')]
  }),
  F('terrain-navigation', '立体地形・移動面・接続', 'rules', 2800, K(180, 240, 200, 100), ['pathfinding', 'capability:physics3d']),
  F('vehicle-traffic', '道路接続・交通量・車両経路', 'rules', 3500, K(220, 320, 120, 180), ['pathfinding', 'resource-economy']),
  F('leaderboard', '記録・ランキング・整合検証', 'system', 300, K(40, 50, 10, 45), ['save-load']),
  F('replays', '入力記録・再生・決定性検証', 'system', 700, K(75, 100, 20, 80), ['save-load']),
  F('modding', '拡張API・読込・隔離・互換検証', 'system', 1800, K(130, 220, 30, 180), ['save-load', 'capability:tools']),
  F('weather-daynight', '天候・昼夜・環境状態', 'rules', 800, K(70, 100, 100, 40), ['save-load'])
];

const onlineFeatures = [
  F('network-authority', 'サーバー権威・同期・再接続', 'online', 9000, K(400, 650, 150, 800), ['save-load'], {
    costs: [operating('game-servers', 'ゲームサーバー計算・通信', 100, 'サーバーホスティング事業者', 2, 20)], tags: ['network', 'authoritative-server']
  }),
  F('accounts', 'アカウント・認証・復旧', 'online', 3000, K(180, 250, 30, 400), ['network-authority'], {
    costs: [operating('account-hosting', '認証基盤・監査保管', 50, '認証ホスティング事業者', .1, 100)], tags: ['identity', 'security']
  }),
  F('persistent-world', '永続共有世界・取引・復旧', 'online', 7000, K(350, 650, 100, 700), ['network-authority', 'accounts', 'inventory'], {
    costs: [operating('world-database', '世界データベース・バックアップ', 80, 'データベース事業者', .3, 50)], tags: ['persistent-world']
  }),
  F('matchmaking', '部屋・参加・マッチング', 'online', 1600, K(140, 200, 20, 260), ['network-authority', 'accounts']),
  F('social-chat', 'チャット・フレンド・ギルド', 'online', 2200, K(180, 260, 40, 320), ['accounts'], {
    costs: [operating('chat-delivery', '会話配信・履歴保管', 20, '通信サービス事業者', .1, 50)]
  }),
  F('moderation', '通報・調査・不正対処ツール', 'online', 3000, K(200, 350, 30, 350), ['accounts'], {
    costs: [operating('moderation-service', '通報一次対応・監視', 100, '運営支援事業者', .5, 20)]
  }),
  F('live-operations', '配信・監視・障害復旧・運営', 'online', 4000, K(250, 400, 30, 600), ['network-authority', 'capability:tools'], {
    costs: [operating('operations-monitoring', '監視・配信・障害対応契約', 200, '運用監視事業者', .2, 100)]
  }),
  F('world-streaming', '領域分割・段階読込・境界処理', 'online', 6000, K(300, 500, 450, 500), ['world-content', 'scene-3d'], { tags: ['streaming'] }),
  F('sharding', '共有世界分散・引継・負荷分散', 'online', 12000, K(500, 900, 150, 1200), ['persistent-world', 'live-operations'], {
    costs: [operating('world-orchestration', '分散調停・予備系・領域間通信', 1000, 'クラウド基盤事業者', 2.5, 1000)], tags: ['distributed-world']
  }),
  F('spatial-audio', '空間音声・距離減衰・遮蔽', 'online', 2500, K(180, 220, 200, 250), ['capability:audio', 'scene-3d'], {
    costs: [operating('spatial-voice', '空間音声中継', 20, '音声通信事業者', .5, 20)]
  }),
  F('embodiment', '全身アバター・接触・身体整合', 'full-dive', 70000, K(1800, 3000, 3500, 2800), ['full-dive-io', 'capability:physics3d']),
  F('sensory-feedback', '触覚・感覚配信・不整合検証', 'full-dive', 120000, K(2500, 4000, 4500, 5000), ['full-dive-io', 'embodiment']),
  F('neural-safety', '感覚強度・緊急切断・安全監視', 'full-dive', 80000, K(3000, 5000, 1000, 6500), ['full-dive-io'], {
    costs: [upfront('sensory-validation', '感覚I/O適合・安全検証', 5000000, '感覚I/O検証機関'), { ...operating('sensory-gateway', '感覚I/Oゲートウェイ・監視', 10000, 'フルダイブ基盤事業者', 50, 0), driver: 'sensorySessions', defaultUnits: 1 }],
    notes: '架空世界のゲーム制作上の検証項目であり、現実の安全認証を表さない。'
  })
];

const G = (id, name, coreLoop, required, optional = []) => ({
  id, name, coreLoop, requiredFeatures: required.map(id => ({ id })), optionalFeatures: optional
});
const genres = [
  G('number-puzzle', '数理パズル', '入力してルールを確かめ、結果から次の入力を考える。', ['number-rules'], ['board-rules', 'tutorial-hints']),
  G('falling-blocks', '落ち物パズル', '落下中の駒を回転・配置し、消去と速度上昇に対応する。', ['falling-blocks'], ['replays', 'leaderboard']),
  G('sliding-puzzle', '配置パズル', '合法手で盤面を動かし、達成条件へ近づける。', ['board-rules'], ['tutorial-hints']),
  G('match-puzzle', 'マッチパズル', '駒を交換し、連鎖と盤面補充から次の手を選ぶ。', ['match-chains'], ['progression']),
  G('block-breaker', 'ブロック崩し', '反射角を調整し、危険を避けてブロックを破壊する。', ['ball-reflection'], ['progression', 'replays']),
  G('platformer', 'プラットフォーム', '地形と危険を読み、移動・跳躍でゴールを目指す。', ['platform-motion'], ['world-content']),
  G('topdown-action', '見下ろしアクション', '敵の状態と位置から移動・攻撃・防御を選ぶ。', ['realtime-combat'], ['progression', 'inventory']),
  G('shooter', 'シューティング', '弾と敵の波を読み、回避と射撃位置を決める。', ['projectiles-waves'], ['leaderboard']),
  G('rhythm', 'リズム', '譜面と音楽時計に合わせて入力し、判定を改善する。', ['rhythm-judgement', 'audio-content'], ['replays']),
  G('fighting', '格闘', '行動フレームと攻防を読み、相手への対処を選ぶ。', ['frame-combat'], ['network-authority', 'replays']),
  G('racing', 'レース', 'コースと車両挙動から操作を選び、順位とタイムを競う。', ['vehicle-racing'], ['network-authority', 'replays']),
  G('sports', '球技', '競技規則の中で選手とボールを動かし、得点を狙う。', ['sports-rules'], ['network-authority']),
  G('turn-rpg', 'ターンRPG', '能力・行動順・所持品から戦闘コマンドを選ぶ。', ['turn-combat', 'progression', 'inventory'], ['quests', 'story-content']),
  G('action-rpg', 'アクションRPG', 'リアルタイムの戦闘と成長・装備選択を繰り返す。', ['realtime-combat', 'progression', 'inventory'], ['quests', 'persistent-world']),
  G('exploration-roguelike', '探索ローグライク', '生成された未知の領域を探索し、行動と撤退を判断する。', ['turn-combat', 'procedural-dungeon', 'fog-vision', 'inventory'], ['progression']),
  G('visual-novel', 'ノベル', '台詞を読み、選択とフラグによる分岐を進める。', ['dialogue-branches', 'story-content'], ['character-content', 'audio-content']),
  G('deduction', '推理', '証拠を集めて照合し、推論で進行条件を解く。', ['evidence-deduction'], ['story-content']),
  G('escape', '脱出', '場所と道具を調べ、条件仕掛けを解いて出口へ進む。', ['interact-puzzles'], ['world-content']),
  G('deckbuilder', 'デッキ構築', 'カード効果と資源を使い、報酬で山札を作り直す。', ['deck-effects'], ['procedural-dungeon']),
  G('tactics', '戦術SRPG', 'マス移動と行動範囲から部隊の手番を選ぶ。', ['grid-tactics', 'progression'], ['story-content']),
  G('rts', 'RTS', '資源と建築を配分し、経路と部隊戦闘を指示する。', ['resource-economy', 'construction', 'pathfinding', 'realtime-combat'], ['network-authority']),
  G('tower-defense', 'タワーディフェンス', '侵入経路と敵の波に対し、配置と標的を調整する。', ['construction', 'pathfinding', 'projectiles-waves'], ['progression']),
  G('four-x', '4X', '領土・資源・研究・勢力関係から次の政策を決める。', ['research-factions', 'construction'], ['network-authority']),
  G('city-builder', '街づくり', '配置と接続を変え、人口・需要・公共サービスを調整する。', ['city-services'], ['vehicle-traffic', 'production-market']),
  G('management', '経営', '生産・在庫・価格を変え、需要と収支へ対応する。', ['production-market'], ['construction']),
  G('farming', '農業生活', '日周と生育に合わせて道具・作物・在庫を管理する。', ['farming-cycle'], ['dialogue-branches', 'construction']),
  G('survival-crafting', 'サバイバルクラフト', '資源を採取・加工し、建築と生存条件を満たす。', ['crafting-survival'], ['procedural-dungeon', 'weather-daynight']),
  G('incremental', 'インクリメンタル', '資源と強化先を選び、自動生産と離席結果を再投資する。', ['idle-offline'], ['production-market'])
];

const integrations = [
  { id: 'saved-inventory', name: '所持品と保存形式の整合', requires: ['inventory', 'save-load'], lines: 90, requirementsAdd: { design: 5, systems: 5 } },
  { id: 'generated-progression', name: '生成世界と成長・報酬の整合', requires: ['procedural-dungeon', 'progression'], lines: 250, requirementsAdd: { design: 15 } },
  { id: 'dialogue-quest-state', name: '会話分岐と依頼状態の整合', requires: ['dialogue-branches', 'quests'], lines: 200, requirementsAdd: { design: 15 } },
  { id: 'city-traffic', name: '人口需要と道路交通の統合', requires: ['city-services', 'vehicle-traffic'], lines: 1800, requirementsAdd: { design: 50, systems: 25 } },
  { id: 'city-market', name: '公共サービスと市場会計の統合', requires: ['city-services', 'production-market'], lines: 1000, requirementsAdd: { design: 35 } },
  { id: 'network-combat', name: '通信遅延と戦闘判定の整合', requires: ['network-authority', 'realtime-combat'], lines: 4500, requirementsAdd: { design: 70, systems: 100 } },
  { id: 'network-turns', name: '通信とターン状態の整合', requires: ['network-authority', 'turn-combat'], lines: 1500, requirementsAdd: { systems: 50 } },
  { id: 'persistent-inventory', name: '取引・所持品の二重処理防止', requires: ['persistent-world', 'inventory'], lines: 3000, requirementsAdd: { design: 50, systems: 100 } },
  { id: 'streamed-authority', name: '読込境界と権威サーバーの統合', requires: ['world-streaming', 'network-authority'], lines: 4500, requirementsAdd: { graphics: 50, systems: 100 } },
  { id: 'distributed-world', name: '世界分割と永続状態の移管', requires: ['world-streaming', 'sharding'], lines: 8000, requirementsAdd: { design: 100, systems: 200 } },
  { id: 'vr-locomotion', name: '立体移動とVR姿勢の統合検証', requires: ['terrain-navigation', 'vr-io'], lines: 2000, requirementsAdd: { graphics: 50, design: 50 } },
  { id: 'body-combat', name: '全身動作と戦闘の統合', requires: ['embodiment', 'realtime-combat'], lines: 45000, requirementsAdd: { design: 500, graphics: 300 } },
  { id: 'sensory-network', name: '感覚配信と遅延・再接続の統合', requires: ['sensory-feedback', 'network-authority'], lines: 100000, requirementsAdd: { systems: 1000, design: 500 } },
  { id: 'sensory-world', name: '感覚の世界境界・復旧検証', requires: ['sensory-feedback', 'sharding'], lines: 90000, requirementsAdd: { systems: 1000, design: 500 } },
  { id: 'safe-embodiment', name: '身体状態と緊急切断の整合', requires: ['embodiment', 'neural-safety'], lines: 70000, requirementsAdd: { systems: 1000, design: 500 } },
  { id: 'full-dive-spatial-voice', name: '感覚I/Oと空間音声の統合', requires: ['full-dive-io', 'spatial-audio'], lines: 10000, requirementsAdd: { graphics: 100, systems: 200 } },
  { id: 'touch-mobile-ui', name: 'タッチ操作と可変画面の整合', requires: ['touch-controls', 'target-android'], lines: 80, requirementsAdd: { design: 5 } },
  { id: 'touch-ios-ui', name: 'タッチ操作とiOS画面の整合', requires: ['touch-controls', 'target-ios'], lines: 80, requirementsAdd: { design: 5 } },
  { id: 'cross-desktop', name: 'Windows/Linuxの配布差・回帰検証', requires: ['target-windows', 'target-linux'], lines: 60, requirementsAdd: { systems: 5 } },
  { id: 'cross-windows-macos', name: 'Windows/macOSの配布差・回帰検証', requires: ['target-windows', 'target-macos'], lines: 60, requirementsAdd: { systems: 5 } },
  { id: 'cross-linux-macos', name: 'Linux/macOSの配布差・回帰検証', requires: ['target-linux', 'target-macos'], lines: 60, requirementsAdd: { systems: 5 } },
  { id: 'cross-mobile', name: 'Android/iOSの保存・操作差検証', requires: ['target-android', 'target-ios'], lines: 140, requirementsAdd: { design: 10, systems: 10 } },
  { id: 'cross-browser-native', name: 'ブラウザ/ネイティブの保存・実行差検証', requires: ['target-browser'], anyOf: ['target-windows', 'target-linux', 'target-macos', 'target-android', 'target-ios', 'target-console'], lines: 100, requirementsAdd: { systems: 10 } }
];

const providers = prefix => ({
  runtime: `${prefix}-runtime`, input: `${prefix}-runtime`,
  tools: `${prefix}-tools`, build: `${prefix}-tools`,
  render2d: `${prefix}-render2d`, render3d: `${prefix}-render3d`,
  physics2d: `${prefix}-physics2d`, physics3d: `${prefix}-physics3d`, audio: `${prefix}-audio`
});

export const PLANNING_CATALOG = {
  version: 1,
  lineCharacters: 40,
  defaultEngineId: 'toolkit',
  assumptions: [
    '行数・技術・価格は共通SDKを前提とする架空のゲームバランス値であり、現実の最低行数ではない。',
    '素材自作工数の単位はasset-hour。コード行数とは別に集計し、現行ゲームの作業時間へはまだ接続しない。',
    '費用は架空の円建て。継続費のdayはゲーム内の1日であり、実時間の日割りではない。',
    '画風・音楽様式・OSに時代淘汰や品質上限の補正を付けない。',
    '入門作品の現行75行・225行は別の固定チュートリアル値。この推計器から現行進行へ反映しない。',
    '同じ基盤依存は一度だけ、数量追加はデータ接続工数だけを積む。行数や機能数は品質・売上・プレイ時間を保証しない。'
  ],
  features: [...providerFeatures, ...platformFeatures, ...commonFeatures, ...gameplayFeatures, ...onlineFeatures],
  genres,
  engines: [
    { id: 'toolkit', name: '共通フレームワーク／ライブラリ', features: ['sdk-runtime', 'sdk-tools'], provides: providers('sdk'), notes: 'ライブラリ接続を自分で組み立てる。外部SDK内部のソースは数えない。' },
    { id: 'commercial', name: '既製商用エンジン', features: ['engine-runtime', 'engine-tools', 'engine-contract'], provides: providers('engine'), notes: '統合済み基盤を利用し、架空の開発契約料を払う。実在製品の料金表ではない。' },
    { id: 'custom', name: 'エンジンから自作', features: ['custom-runtime', 'custom-tools'], provides: providers('custom'), notes: '使用する描画・物理・音声基盤を一度ずつ実装する。自作自体の品質ボーナスはない。' }
  ],
  axes: {
    presentation: [
      { id: 'console', name: '文字端末', features: ['console-ui'] },
      { id: 'pixel-2d', name: 'ドット絵2D', features: ['pixel-art', 'ui-layout'] },
      { id: 'illustrated-2d', name: 'イラスト2D', features: ['illustrated-art', 'ui-layout'] },
      { id: '3d', name: '3D空間', features: ['scene-3d', 'ui-layout'] }
    ],
    audio: [
      { id: 'silent', name: '音声なし', features: [], forbids: ['capability:audio'] },
      { id: 'chiptune', name: 'チップ音源', features: ['chiptune'] },
      { id: 'recorded', name: '収録音源', features: ['recorded-audio'] }
    ],
    input: [
      { id: 'keyboard-mouse', name: 'キーボード／マウス', features: [] },
      { id: 'gamepad', name: 'ゲームパッド', features: ['gamepad-controls'] },
      { id: 'touch', name: 'タッチ', features: ['touch-controls'] },
      { id: 'vr', name: 'VR姿勢・ハンド入力', features: ['vr-io'] },
      { id: 'full-dive', name: 'フルダイブ感覚入力', features: ['full-dive-io', 'neural-safety'] }
    ],
    platform: [
      { id: 'windows', name: 'Windows', features: ['target-windows'] },
      { id: 'linux', name: 'Linux', features: ['target-linux'] },
      { id: 'macos', name: 'macOS', features: ['target-macos'] },
      { id: 'browser', name: 'ブラウザ', features: ['target-browser'] },
      { id: 'android', name: 'Android', features: ['target-android'] },
      { id: 'ios', name: 'iOS', features: ['target-ios'] },
      { id: 'console', name: '家庭用機', features: ['target-console'] }
    ]
  },
  integrations,
  affinities: [
    { id: 'puzzle-hints', genreId: 'number-puzzle', featureId: 'tutorial-hints', relation: 'supports', note: '正解を奪わない段階ヒントは、考え方を覚える遊びを支える。' },
    { id: 'falling-replays', genreId: 'falling-blocks', featureId: 'replays', relation: 'supports', note: '手順を振り返り、判断の改善を比較できる。' },
    { id: 'fighter-replays', genreId: 'fighting', featureId: 'replays', relation: 'supports', note: 'フレームと攻防の振り返りに使える。' },
    { id: 'rhythm-clock', genreId: 'rhythm', featureId: 'network-authority', relation: 'tension', note: '通信待ちで判定時計を止めない設計が必要。禁止ではなく検証課題。' },
    { id: 'novel-chapters', genreId: 'visual-novel', featureId: 'story-content', relation: 'supports', note: '分岐の目的と結末を脚本として実装する。章数だけで読後感は決まらない。' },
    { id: 'rogue-generation', genreId: 'exploration-roguelike', featureId: 'procedural-dungeon', relation: 'supports', note: '未知の地形を判断する反復を支える。生成量だけでは面白さを保証しない。' },
    { id: 'city-traffic', genreId: 'city-builder', featureId: 'vehicle-traffic', relation: 'supports', note: '道路接続と人口需要の選択結果を交通として見せられる。' },
    { id: 'rpg-persistence', genreId: 'action-rpg', featureId: 'persistent-world', relation: 'supports', note: '他者との継続的な成長・取引の場になる。運用と不正対処は別途必要。' },
    { id: 'deck-weather', genreId: 'deckbuilder', featureId: 'weather-daynight', relation: 'tension', note: 'カード判断に関係しない天候は、工数だけを増やす可能性がある。' },
    { id: 'idle-offline', genreId: 'incremental', featureId: 'idle-offline', relation: 'supports', note: '離席後の再投資をコアループにつなぐ。' }
  ]
};

const basePlan = { engineId: 'toolkit', presentationId: 'pixel-2d', audioId: 'chiptune', inputId: 'keyboard-mouse', targets: ['linux'] };
const mmoFeatures = [
  { id: 'quests' }, { id: 'terrain-navigation' }, { id: 'network-authority' },
  { id: 'persistent-world' }, { id: 'social-chat' }, { id: 'moderation' },
  { id: 'live-operations' }, { id: 'world-streaming' }, { id: 'sharding' },
  { id: 'world-content', quantity: 20 }, { id: 'character-content', quantity: 40 },
  { id: 'audio-content', quantity: 16 }
];
const puzzle = { ...basePlan, genreId: 'number-puzzle', audioId: 'silent', features: [{ id: 'board-rules' }, { id: 'tutorial-hints' }] };
export const PLANNING_EXAMPLES = [
  { id: 'small-puzzle', name: '小さな数理パズル／Linux', plan: puzzle },
  { id: 'pixel-roguelite', name: 'ドット絵ローグライト／Linux', plan: {
    ...basePlan, genreId: 'exploration-roguelike', features: [{ id: 'progression' }, { id: 'world-content', quantity: 3 }, { id: 'character-content', quantity: 8 }, { id: 'audio-content', quantity: 4 }]
  } },
  { id: 'visual-novel', name: '分岐ノベル／Linux', plan: {
    ...basePlan, genreId: 'visual-novel', presentationId: 'illustrated-2d', audioId: 'recorded',
    features: [{ id: 'story-content', quantity: 10 }, { id: 'character-content', quantity: 6 }, { id: 'audio-content', quantity: 8 }, { id: 'settings-localization' }]
  } },
  { id: 'city-3d', name: '3Dの街づくり／Windows', plan: {
    ...basePlan, genreId: 'city-builder', presentationId: '3d', audioId: 'recorded', targets: ['windows'],
    features: [{ id: 'vehicle-traffic' }, { id: 'production-market' }, { id: 'terrain-navigation' }, { id: 'world-streaming' }, { id: 'world-content', quantity: 6 }, { id: 'audio-content', quantity: 10 }]
  } },
  { id: 'mmorpg', name: '共有世界MMORPG／Windows・Linux', plan: {
    ...basePlan, genreId: 'action-rpg', presentationId: '3d', audioId: 'recorded', targets: ['windows', 'linux'],
    features: mmoFeatures, quantities: { concurrentPlayers: 1000 }
  } },
  { id: 'full-dive-vrmmo', name: 'フルダイブVRMMORPG／Windows・Linux', plan: {
    ...basePlan, genreId: 'action-rpg', presentationId: '3d', audioId: 'recorded', inputId: 'full-dive', targets: ['windows', 'linux'],
    features: [...mmoFeatures, { id: 'embodiment' }, { id: 'sensory-feedback' }, { id: 'spatial-audio' }], quantities: { concurrentPlayers: 1000, sensorySessions: 1000 }
  } },
  { id: 'small-puzzle-commercial', name: '同じパズル／既製商用エンジン', plan: { ...puzzle, engineId: 'commercial' } },
  { id: 'small-puzzle-custom', name: '同じパズル／エンジンから自作', plan: { ...puzzle, engineId: 'custom' } },
  { id: 'small-puzzle-windows-linux', name: '同じパズル／Windows・Linux', plan: { ...puzzle, targets: ['windows', 'linux'] } },
  { id: 'small-puzzle-multiplatform', name: '同じパズル／7実行先', plan: { ...puzzle, targets: ['windows', 'linux', 'macos', 'browser', 'android', 'ios', 'console'], features: [...puzzle.features, { id: 'touch-controls' }, { id: 'gamepad-controls' }] } }
];

// Kept as a spelling alias for consumers that call the examples presets.
export const PLANNING_PRESETS = PLANNING_EXAMPLES;
