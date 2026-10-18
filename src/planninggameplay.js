// Original fictional game-design data. These values describe production work
// in Code Typer Idle; they are not real-world minimum LOC or market research.
// Affinities are hypotheses to investigate. They never award quality, revenue,
// or playtime merely for selecting the matching labels.
const K = (syntax = 0, design = 0, graphics = 0, systems = 0) => ({ syntax, design, graphics, systems });
const asset = (id, name, unit, work, purchase, commission, payee) => ({
  id, name, unit, count: 1, selfWorkPerUnit: work, workUnit: 'asset-hour',
  sourcing: {
    self: { unitCost: 0, payee: null },
    license: { unitCost: purchase, payee: '素材ライセンス販売者' },
    commission: { unitCost: commission, payee }
  }
});
const content = (id, name, unit, max, baseLines, linesPerUnit, requirements, requires, assets, description) => ({
  id, name, category: 'content', baseLines, linesPerUnit, requirements, requires,
  quantity: { min: 1, max, default: 1 }, unit, tags: ['content', 'typed-quantity'],
  assets, notes: description
});
const mechanic = (id, name, baseLines, requirements, requires, tags, notes) => ({
  id, name, category: 'rules', baseLines, requirements, requires,
  tags: ['hybrid-mechanic', ...tags], notes
});

const features = [
  // A stage is an authored challenge and its placement data. A region in the
  // base catalog is traversable world geography. Neither duplicates the engine.
  content('stage-content', 'ステージの配置・出現・クリア条件', 'ステージ', 10000, 140, 16, K(22, 35, 18), ['save-load'], [
    asset('stage-layout', 'ステージ設計・配置データ', 'ステージ', 6, 1000, 12000, 'レベルデザイナー'),
    asset('stage-visuals', 'ステージ固有の背景・小物', 'ステージ', 8, 1500, 18000, '背景・環境アーティスト')
  ], '共通の移動や衝突は再実装しない。追加ステージは配置・条件の接続と素材制作を増やす。地域数や遊べる時間とは別の量。'),
  content('enemy-content', '敵種類の状態・攻撃パターン設定', '種類', 10000, 130, 14, K(25, 40, 15), ['capability:runtime'], [
    asset('enemy-patterns', '敵行動パターン・調整データ', '種類', 4, 800, 10000, 'ゲームデザイナー'),
    asset('enemy-visuals', '敵の視覚素材一式', '種類', 8, 1600, 18000, 'キャラクターアーティスト')
  ], '種別の設定と既存行動への接続を数える。新しいAIアルゴリズムや戦闘ルールは対応機能として別に加える。'),
  content('item-content', 'アイテム種類の効果・入手条件設定', '種類', 100000, 90, 5, K(22, 35, 8), ['inventory'], [
    asset('item-designs', 'アイテム効果・説明・調整データ', '種類', 1, 200, 2000, 'ゲームデザイナー'),
    asset('item-icons', 'アイテムアイコン', '種類', .5, 100, 1200, 'UIアーティスト')
  ], '既存効果の値違いと接続を想定。新しい効果処理を実装する場合は別機能が必要。種類を増やすだけでは収集の面白さを保証しない。'),
  content('quest-content', 'クエストの条件・分岐・報酬接続', '件', 100000, 100, 9, K(25, 45, 8), ['quests'], [
    asset('quest-scripts', 'クエスト脚本・条件・報酬設計', '件', 3, 600, 7000, 'クエストデザイナー')
  ], '依頼システムは一度だけ実装する。追加依頼には脚本・条件組合せ・報酬調整の作業が残る。'),
  content('unit-content', 'ユニット種類の能力・編成設定', '種類', 10000, 130, 12, K(28, 45, 12), ['progression'], [
    asset('unit-designs', 'ユニット能力・役割・相互関係設計', '種類', 3, 600, 7000, 'ゲームデザイナー'),
    asset('unit-visuals', 'ユニット視覚素材一式', '種類', 10, 2000, 22000, 'キャラクターアーティスト')
  ], '部隊編成や役割の差を定義する量。人数の多い見た目や登場人物の会話量とは別。'),
  content('card-content', 'カード種類の効果・対象・取得設定', '種類', 100000, 100, 7, K(25, 42, 8), ['deck-effects'], [
    asset('card-designs', 'カード効果・説明・組合せ調整', '種類', 1.5, 300, 3500, 'カードゲームデザイナー'),
    asset('card-art', 'カードイラスト・枠内素材', '種類', 2, 500, 6000, 'イラストレーター')
  ], 'カード効果基盤は再利用する。効果種類が増えると相互作用の検証が必要であり、種類数の加点はない。'),
  content('recipe-content', '生産レシピの材料・工程・結果設定', '件', 100000, 90, 6, K(22, 38, 8), ['inventory', 'resource-economy'], [
    asset('recipe-designs', 'レシピの原価・工程・報酬調整', '件', 1, 200, 2400, '経済・生産デザイナー')
  ], '生産経路の定義を増やす。生産自動化や配送そのものは別機能。'),
  content('vehicle-content', '車種の操作・性能・外観設定', '車種', 10000, 160, 18, K(30, 45, 25), ['vehicle-racing'], [
    asset('vehicle-tuning', '車種の操作感・性能調整', '車種', 5, 1000, 12000, '車両ゲームデザイナー'),
    asset('vehicle-visuals', '車両の視覚・音素材', '車種', 16, 3000, 36000, '車両アーティスト')
  ], '走行・周回ルールは共通。外観だけを変えた車が操作の選択肢を増やすとは限らない。'),
  content('puzzle-content', '手作り問題の初期状態・解答条件', '問', 100000, 100, 5, K(20, 35, 8), ['capability:runtime'], [
    asset('puzzle-designs', '問題作成・解答検証・難度配置', '問', 1.5, 250, 3000, 'パズルデザイナー')
  ], '数理・盤面・推理などの既存判定へ問題を接続する。問題本文や手作り配置はソース行数に換算しない。'),
  content('skill-content', 'スキルの効果・成長・解放条件設定', '種類', 100000, 100, 8, K(25, 42, 10), ['progression'], [
    asset('skill-designs', 'スキル効果・説明・成長調整', '種類', 2, 400, 4800, 'バトルデザイナー'),
    asset('skill-icons', 'スキルアイコン・演出素材', '種類', 1, 250, 3000, 'UI・エフェクトアーティスト')
  ], '既存の効果処理に接続するスキル数。新しい戦闘ルールを増やす工数の代用にはならない。'),
  content('animation-content', '動作クリップ・状態遷移への接続', 'クリップ', 100000, 140, 6, K(22, 32, 35), ['capability:runtime'], [
    asset('animation-clips', '動作アニメーション', 'クリップ', 3, 600, 7200, 'アニメーター')
  ], '2D・3Dどちらの動作にも使える。新しい描画方式や物理連動は別に実装する。'),
  content('voice-content', '台詞音声・字幕・再生条件接続', '台詞', 1000000, 120, 1, K(20, 30, 12), ['dialogue-branches', 'capability:audio'], [
    asset('voice-lines', '台詞の収録・編集・使用許諾', '台詞', .1, 50, 300, '声優・音声収録制作者')
  ], '自分で収録すれば支払はないが収録・編集作業は必要。購入・外注は同じ品質を保証しない。'),

  mechanic('real-time-deck', 'リアルタイム行動にカード効果を接続', 850, K(65, 105, 30, 25), ['deck-effects', 'realtime-combat'], ['cards', 'real-time'], 'カード選択中の時間、効果の持続、入力競合を定義する。既存のターン戦闘だけでは代用しない。'),
  mechanic('adaptive-music', '状況に反応する音楽の遷移・同期', 480, K(45, 65, 30, 35), ['capability:audio'], ['audio', 'reactive-music'], '危険・探索・会話などの状態から音楽を遷移させる。録音音源でもチップ音源でもよい。'),
  mechanic('investigation-board', '証拠関係図・仮説・反証の整理', 380, K(35, 65, 20), ['evidence-deduction', 'ui-layout'], ['deduction', 'knowledge'], '証拠を集めるだけでなく関係を整理し、何が未確認かを提示する。正解の自動開示ではない。'),
  mechanic('world-events', '世界イベントの条件・波及・復帰', 750, K(60, 100, 35, 45), ['save-load', 'world-content'], ['world-state', 'events'], '住民・施設・資源へ作用するイベントと復帰条件を定義する。単なる天候演出とは区別する。'),
  mechanic('social-relationships', '住民関係・記憶・関係変化', 650, K(55, 100, 15, 20), ['dialogue-branches', 'character-content'], ['relationships', 'persistent-state'], '会話選択や行動を住民が記憶する。好感度を足すだけではなく変化する条件と反応が必要。'),
  mechanic('stealth-awareness', '視認・音・警戒・捜索状態', 950, K(75, 110, 45, 35), ['pathfinding', 'capability:runtime'], ['stealth', 'perception'], '知覚と警戒状態を通して回避・追跡の駆け引きを作る。描画方式には固定しない。'),
  mechanic('resource-logistics', '搬送経路・容量・滞留・優先制御', 1300, K(100, 160, 30, 65), ['resource-economy', 'pathfinding'], ['logistics', 'economy'], '在庫の数字だけでなく物流の詰まりを表現する。地域・製造・公共サービスとの接続は別途検証する。'),
  mechanic('destructible-terrain', '地形変更・接続更新・復元', 1600, K(120, 170, 130, 75), ['construction', 'pathfinding', 'save-load'], ['mutable-world', 'navigation'], '壊した地形が移動や建築へ及ぼす影響を扱う。3D前提にせず、2Dの掘削や盤面変更にも使う。'),
  mechanic('dynamic-narrative', '出来事と関係から物語分岐を選ぶ', 1400, K(100, 180, 20, 60), ['story-content', 'world-events', 'dialogue-branches'], ['narrative', 'world-state'], '既定の物語断片を条件で組み立てる。文章や面白い展開が無償で生成される仕組みではない。'),
  mechanic('crafting-automation', '生産設備・作業列・自動投入', 1000, K(80, 130, 35, 55), ['production-market', 'recipe-content'], ['automation', 'production'], 'レシピを自動生産へ接続し、停止条件と資源不足を扱う。離席精算はidle-offlineを別途加える。'),
  mechanic('procedural-quests', '依頼テンプレート・生成条件・検証', 1200, K(95, 170, 10, 55), ['quest-content', 'world-content'], ['procedural-generation', 'quests'], '依頼の場所・対象・到達性を検証する。生成数を増やしても固有の物語量や品質には換算しない。'),
  mechanic('challenge-modifiers', '周回条件・難度変化・報酬整合', 400, K(40, 75, 10, 20), ['save-load'], ['replayability', 'modifiers'], '敵配置・資源・制限などの変更を条件として組み合わせる。同じ遊びを繰り返す動機は別途確かめる。')
];

const themes = [
  ['abstract', '抽象・幾何学', ['abstract', 'nonfictional'], '色・形・数・配置そのものを題材にする。物語の量よりルールの読み取りが中心になる。'],
  ['high-fantasy', '王道ファンタジー', ['fantasy', 'adventure'], '魔法や異種族のいる世界。冒険、暮らし、経営など、そこで何をするかは別に選ぶ。'],
  ['dark-fantasy', 'ダークファンタジー', ['fantasy', 'dark'], '呪い、代償、衰退した世界を扱う。暗い画面や高難度そのものを意味しない。'],
  ['science-fiction', '宇宙・未来SF', ['science-fiction', 'future'], '宇宙船、遠い未来、未知の文明などを舞台にする。3Dや広大な宇宙の実装は必須ではない。'],
  ['cyberpunk', 'サイバーパンク', ['science-fiction', 'urban'], '情報技術、身体改造、都市の権力を題材にする。会話中心でも都市経営でも成立し得る。'],
  ['post-apocalyptic', '崩壊後の世界', ['survival', 'ruins'], '残された資源や共同体から暮らしを立て直す。戦闘を付けるかは企画次第。'],
  ['contemporary-city', '現代都市', ['contemporary', 'urban'], '交通、仕事、人間関係のある都市。街を歩く作品にも都市を運営する作品にも使える。'],
  ['everyday-life', '日常生活', ['contemporary', 'relationships'], '家族、仕事、買物、趣味など身近な出来事。小さな変化を遊びにする。'],
  ['school-life', '学園', ['relationships', 'school'], '授業、部活動、行事や人間関係を扱う。登場人物数と物語の規模は別に決める。'],
  ['cozy-rural', '田舎暮らし', ['cozy', 'nature'], '畑、季節、住民との暮らし。農業の有無や競争の強さは機能選択で決める。'],
  ['historical', '歴史・史実風', ['history', 'society'], '過去の社会や出来事を題材にする。時代設定はゲーム内の制作年代を進める意味ではない。'],
  ['alternate-history', '架空史・もしもの歴史', ['history', 'speculative'], '史実から分岐した社会や勢力を作る。何が変わったかをルールや物語へ反映する。'],
  ['myth-folklore', '神話・民話', ['myth', 'fantasy'], '伝承の人物、土地、禁忌を題材にする。既存作品の文章や絵の利用許諾とは別。'],
  ['detective-noir', '探偵・ノワール', ['mystery', 'urban'], '証言や利害の食い違いを追う。暴力の量や写実的な映像を条件にしない。'],
  ['psychological-horror', '心理ホラー', ['horror', 'psychological'], '不確かさや認識のずれで緊張を作る。大音量の驚かせ演出だけを指さない。'],
  ['supernatural-horror', '怪異・ホラー', ['horror', 'supernatural'], '説明しきれない存在や土地の怪異を扱う。戦う、逃げる、調べる方法を別に選ぶ。'],
  ['comedy-satire', 'コメディ・風刺', ['comedy', 'satire'], '期待の裏切りや社会の矛盾を題材にする。冗談を重ねれば面白くなるという補正はない。'],
  ['romance', '恋愛・人間関係', ['relationships', 'romance'], '距離感、選択、関係の変化を題材にする。人数や分岐数だけで感情の説得力は増えない。'],
  ['sports-competition', 'スポーツ・競技', ['sports', 'competition'], '競技の習熟や対戦を題材にする。チーム、個人、マネジメントなどは仕組みで選ぶ。'],
  ['music-performance', '音楽・舞台', ['music', 'performance'], '演奏、表現、舞台を題材にする。音楽を聴かせる方式とプレイヤーの操作は別に設計する。'],
  ['military-conflict', '戦争・軍事', ['conflict', 'strategy'], '戦闘、補給、組織や民間生活への影響を扱う。規模の大きさを迫力や品質に換算しない。'],
  ['space-colony', '宇宙開拓・コロニー', ['science-fiction', 'colony'], '限られた設備と資源で居住地を維持する。宇宙戦闘の追加は任意。'],
  ['underwater', '海洋・海中', ['nature', 'exploration'], '海路、海中環境、資源や生き物を題材にする。水を描くだけと移動・圧力のルールは別。'],
  ['wildlife', '自然・動物', ['nature', 'ecology'], '動物の行動、生態、観察や保全を扱う。人間の登場や言語による物語は必須ではない。'],
  ['culinary', '料理・飲食店', ['food', 'craft'], '材料、手順、提供、客との関係を題材にする。調理を操作するか店を経営するかは別に決める。'],
  ['industrial', '工業・工場', ['industry', 'production'], '製造工程、搬送、設備、資源の循環を扱う。設備の種類数だけでは生産の判断は増えない。'],
  ['western', '西部劇', ['frontier', 'conflict'], '開拓地、移動、無法と秩序を題材にする。銃撃戦以外の旅や商いを中心にもできる。'],
  ['dream-surreal', '夢・シュール', ['surreal', 'speculative'], '夢や現実にない因果を題材にする。操作と結果を理解できる手掛かりは別に必要。']
].map(([id, name, tags, description]) => ({ id, name, tags, description, features: [] }));

// Reach counts people who may encounter the release, not copies sold. The
// sales model still applies its conversion rate, observed quality, distribution
// reach, and finite audience. These small launch markets are fictional balance
// values for an unknown solo developer in a fixed era, not genre sales facts.
const market = (basePrice, reachableAudience, conversionScale, audienceTags) => ({
  basePrice, reachableAudience, conversionScale, audienceTags
});
const genreMarkets = {
  'number-puzzle': market(200, 90, .9, ['logic', 'puzzle']),
  'falling-blocks': market(300, 130, .85, ['puzzle', 'arcade', 'competition']),
  'sliding-puzzle': market(250, 100, .9, ['logic', 'puzzle']),
  'match-puzzle': market(250, 150, .8, ['puzzle', 'casual']),
  'block-breaker': market(200, 80, .8, ['arcade', 'action']),
  'platformer': market(500, 170, .85, ['action', 'exploration']),
  'topdown-action': market(700, 180, .9, ['action', 'combat']),
  'shooter': market(500, 170, .85, ['action', 'arcade', 'competition']),
  'rhythm': market(700, 160, .9, ['music', 'arcade', 'competition']),
  'fighting': market(800, 160, .75, ['combat', 'competition']),
  'racing': market(700, 150, .8, ['vehicles', 'competition']),
  'sports': market(600, 150, .8, ['sports', 'competition']),
  'turn-rpg': market(1000, 240, .9, ['roleplay', 'story', 'exploration']),
  'action-rpg': market(1200, 260, .85, ['roleplay', 'action', 'exploration']),
  'exploration-roguelike': market(800, 210, .95, ['exploration', 'strategy', 'replayability']),
  'visual-novel': market(800, 180, 1, ['story', 'relationships']),
  'deduction': market(900, 180, .95, ['logic', 'mystery', 'story']),
  'escape': market(500, 140, .95, ['logic', 'mystery', 'exploration']),
  'deckbuilder': market(1000, 240, .95, ['cards', 'strategy', 'replayability']),
  'tactics': market(1100, 220, .9, ['strategy', 'roleplay', 'combat']),
  'rts': market(1000, 200, .8, ['strategy', 'competition', 'resource']),
  'tower-defense': market(600, 190, .9, ['strategy', 'resource', 'combat']),
  'four-x': market(1200, 260, .85, ['strategy', 'society', 'resource']),
  'city-builder': market(1000, 240, .9, ['simulation', 'society', 'resource']),
  'management': market(900, 210, .9, ['simulation', 'resource', 'production']),
  'farming': market(900, 240, 1, ['cozy', 'craft', 'relationships']),
  'survival-crafting': market(1000, 240, .85, ['survival', 'craft', 'exploration']),
  'incremental': market(400, 180, .8, ['resource', 'automation', 'casual'])
};

// A theme can help explain who a game addresses. Focus is an editorial
// hypothesis to validate with a prototype or release, not an automatic audience
// award. No theme has a universal quality, price, or era multiplier.
const themeAudiences = {
  'abstract': { audienceTags: ['logic', 'puzzle'], genreAudienceFocus: ['number-puzzle', 'falling-blocks', 'sliding-puzzle', 'match-puzzle', 'incremental'] },
  'high-fantasy': { audienceTags: ['roleplay', 'exploration', 'story'], genreAudienceFocus: ['turn-rpg', 'action-rpg', 'tactics', 'deckbuilder'] },
  'dark-fantasy': { audienceTags: ['combat', 'exploration', 'roleplay'], genreAudienceFocus: ['action-rpg', 'exploration-roguelike', 'deckbuilder', 'survival-crafting'] },
  'science-fiction': { audienceTags: ['exploration', 'strategy', 'vehicles'], genreAudienceFocus: ['shooter', 'four-x', 'rts', 'racing'] },
  'cyberpunk': { audienceTags: ['mystery', 'story', 'action'], genreAudienceFocus: ['deduction', 'topdown-action', 'visual-novel', 'action-rpg'] },
  'post-apocalyptic': { audienceTags: ['survival', 'craft', 'resource'], genreAudienceFocus: ['survival-crafting', 'management', 'exploration-roguelike'] },
  'contemporary-city': { audienceTags: ['society', 'simulation', 'mystery'], genreAudienceFocus: ['city-builder', 'management', 'deduction', 'racing'] },
  'everyday-life': { audienceTags: ['relationships', 'cozy', 'story'], genreAudienceFocus: ['visual-novel', 'farming', 'management'] },
  'school-life': { audienceTags: ['relationships', 'story', 'sports'], genreAudienceFocus: ['visual-novel', 'sports', 'rhythm'] },
  'cozy-rural': { audienceTags: ['cozy', 'craft', 'relationships'], genreAudienceFocus: ['farming', 'management', 'visual-novel'] },
  'historical': { audienceTags: ['society', 'strategy', 'story'], genreAudienceFocus: ['four-x', 'rts', 'tactics', 'city-builder'] },
  'alternate-history': { audienceTags: ['society', 'strategy', 'story'], genreAudienceFocus: ['four-x', 'tactics', 'visual-novel', 'deduction'] },
  'myth-folklore': { audienceTags: ['roleplay', 'story', 'mystery'], genreAudienceFocus: ['turn-rpg', 'visual-novel', 'deduction', 'platformer'] },
  'detective-noir': { audienceTags: ['mystery', 'logic', 'story'], genreAudienceFocus: ['deduction', 'escape', 'visual-novel'] },
  'psychological-horror': { audienceTags: ['mystery', 'story', 'survival'], genreAudienceFocus: ['escape', 'deduction', 'visual-novel'] },
  'supernatural-horror': { audienceTags: ['mystery', 'survival', 'exploration'], genreAudienceFocus: ['escape', 'survival-crafting', 'exploration-roguelike'] },
  'comedy-satire': { audienceTags: ['story', 'casual', 'society'], genreAudienceFocus: ['visual-novel', 'management', 'incremental', 'platformer'] },
  'romance': { audienceTags: ['relationships', 'story', 'cozy'], genreAudienceFocus: ['visual-novel', 'farming', 'turn-rpg'] },
  'sports-competition': { audienceTags: ['sports', 'competition', 'vehicles'], genreAudienceFocus: ['sports', 'racing', 'fighting'] },
  'music-performance': { audienceTags: ['music', 'competition', 'story'], genreAudienceFocus: ['rhythm', 'visual-novel'] },
  'military-conflict': { audienceTags: ['combat', 'strategy', 'resource'], genreAudienceFocus: ['tactics', 'rts', 'four-x', 'shooter'] },
  'space-colony': { audienceTags: ['resource', 'simulation', 'survival'], genreAudienceFocus: ['city-builder', 'management', 'survival-crafting', 'incremental'] },
  'underwater': { audienceTags: ['exploration', 'survival', 'vehicles'], genreAudienceFocus: ['survival-crafting', 'platformer', 'escape', 'racing'] },
  'wildlife': { audienceTags: ['cozy', 'exploration', 'simulation'], genreAudienceFocus: ['farming', 'management', 'platformer'] },
  'culinary': { audienceTags: ['craft', 'production', 'casual'], genreAudienceFocus: ['management', 'farming', 'match-puzzle'] },
  'industrial': { audienceTags: ['production', 'automation', 'resource'], genreAudienceFocus: ['management', 'incremental', 'city-builder'] },
  'western': { audienceTags: ['action', 'story', 'exploration'], genreAudienceFocus: ['shooter', 'topdown-action', 'action-rpg', 'visual-novel'] },
  'dream-surreal': { audienceTags: ['puzzle', 'mystery', 'exploration'], genreAudienceFocus: ['sliding-puzzle', 'escape', 'platformer', 'deduction'] }
};
const audienceThemes = themes.map(theme => ({ ...theme, ...themeAudiences[theme.id] }));

const marketingFeature = (id, name, baseLines, requirements, requires, marketReach, amount, payee, assets, notes) => ({
  id, name, category: 'marketing', baseLines, requirements, requires,
  tags: ['marketing', 'finite-reach'], marketReach, marketReachCap: marketReach,
  reachAudienceTags: [], reachScope: 'selected-genre-and-themes',
  costs: [{ id: `${id}-service`, name: `${name}の配布・参加費`, amount, payee, kind: 'upfront', per: 'project' }],
  assets, notes
});
features.push(
  marketingFeature('development-log', '制作記録・画面紹介の配信', 70, K(10, 18, 8), ['capability:tools'], 80, 300, '制作告知配信サービス', [
    asset('development-log-material', '紹介文・画像・短い紹介映像', '記事一式', .4, 300, 2400, '広報ライター・映像制作者')
  ], '完成までの狙いを伝える。1企画で届く候補者は最大80人、購入者ではない。長文や投稿数の水増しで無限に集客しない。'),
  marketingFeature('playable-demo', '体験版の切出・配布・反応集計', 180, K(25, 35, 10, 8), ['save-load', 'tutorial-hints'], 180, 1500, '体験版配布・集計サービス', [
    asset('demo-presentation', '体験版の導入・説明・配布ページ', '一式', .8, 500, 5000, '体験版編集・広報制作者')
  ], '主要な遊びを試せる範囲へ切り出す。最大180人の訪問・試遊候補へ届くが、試遊した人を全員購入者とは数えない。'),
  marketingFeature('small-exhibition', '小規模展示会の出展準備', 90, K(15, 25, 10, 8), ['tutorial-hints', 'capability:tools'], 320, 8000, 'インディー作品展示会主催者', [
    asset('exhibition-material', '展示用パネル・操作案内・紹介映像', '出展一式', 1, 800, 8000, '展示・映像制作者')
  ], '1企画1出展の有限枠。最大320人の候補へ届くが、客層と内容に合わなければ購入には繋がらない。出展費と宣材作業は別に支払う。'),
  marketingFeature('community-playtest', '小さな試遊募集・意見の整理', 60, K(12, 20, 5), ['tutorial-hints'], 40, 100, '試遊募集掲示サービス', [
    asset('playtest-brief', '試遊案内・観察項目・反応の整理', '募集一式', .4, 200, 2400, 'ユーザー調査支援者')
  ], '最大40人の試遊候補を集める。意見は修正の根拠になり得るが、募集だけで品質や知見を獲得したことにはしない。')
);

const integration = (id, name, requires, lines, requirementsAdd) => ({ id, name, requires, lines, requirementsAdd });
const integrations = [
  integration('hybrid-deck-projectiles', 'カード対象と弾・出現波の効果整合', ['real-time-deck', 'projectiles-waves'], 380, { design: 18, systems: 8 }),
  integration('hybrid-farm-relations', '季節の作業と住民の記憶の整合', ['farming-cycle', 'social-relationships'], 260, { design: 18 }),
  integration('hybrid-farm-market', '収穫物と市場の需給・価格整合', ['farming-cycle', 'production-market'], 320, { design: 20 }),
  integration('hybrid-farm-weather', '天候と生育・収穫条件の整合', ['farming-cycle', 'weather-daynight'], 180, { design: 12 }),
  integration('hybrid-stealth-combat', '警戒状態と戦闘開始・終了の整合', ['stealth-awareness', 'realtime-combat'], 440, { design: 22 }),
  integration('hybrid-stealth-evidence', '発覚・証拠入手・推論状態の整合', ['stealth-awareness', 'evidence-deduction'], 320, { design: 20 }),
  integration('hybrid-logistics-city', '物流容量と都市需要の整合', ['resource-logistics', 'city-services'], 650, { design: 30, systems: 12 }),
  integration('hybrid-logistics-production', '搬送の滞留と製造会計の整合', ['resource-logistics', 'production-market'], 420, { design: 25 }),
  integration('hybrid-destructible-generated', '生成地形と地形変更後の到達性検証', ['destructible-terrain', 'procedural-dungeon'], 680, { design: 30, systems: 15 }),
  integration('hybrid-destructible-network', '地形変更の同期・再接続復元', ['destructible-terrain', 'network-authority'], 2100, { design: 50, systems: 65 }),
  integration('hybrid-narrative-relations', '生成された出来事と人物の記憶の整合', ['dynamic-narrative', 'social-relationships'], 500, { design: 35 }),
  integration('hybrid-music-rhythm', '音楽遷移と譜面判定時計の整合', ['adaptive-music', 'rhythm-judgement'], 650, { design: 25, systems: 20 }),
  integration('hybrid-music-events', '世界イベントと音楽遷移の整合', ['adaptive-music', 'world-events'], 150, { design: 10 }),
  integration('hybrid-generated-quests', '生成依頼と迷宮の到達・完了検証', ['procedural-quests', 'procedural-dungeon'], 540, { design: 30, systems: 10 }),
  integration('hybrid-offline-production', '設備作業列と離席精算の整合', ['crafting-automation', 'idle-offline'], 480, { design: 25, systems: 20 }),
  integration('hybrid-card-content-realtime', 'カード種別とリアルタイム効果の回帰検証', ['card-content', 'real-time-deck'], 180, { design: 15 }),
  integration('hybrid-enemies-replays', '敵パターンと入力リプレイの決定性検証', ['enemy-content', 'replays'], 160, { systems: 12 }),
  integration('hybrid-voice-branches', '台詞音声と分岐・既読・スキップの整合', ['voice-content', 'story-content'], 120, { design: 8 }),
  integration('hybrid-challenge-content', '難度変更と手作りステージの解法検証', ['challenge-modifiers', 'stage-content'], 150, { design: 12 }),
  integration('hybrid-tactics-units', 'ユニット役割と行動範囲・敵戦術の整合', ['unit-content', 'grid-tactics'], 220, { design: 18 }),
  integration('hybrid-recipes-quests', '制作物の依頼判定と納品・消費整合', ['recipe-content', 'quest-content'], 180, { design: 12 })
];

// Risk fields express review burden on a 0..1 scale, not a failure probability.
// Supports means there is a reason to test a combination, not a success bonus.
const affinity = (id, genreId, featureId, relation, note, risk = {}) => ({ id, genreId, featureId, relation, note, risk });
const themeAffinity = (id, themeId, featureId, relation, note, risk = {}) => ({ id, themeId, featureId, relation, note, risk });
const affinities = [
  affinity('number-authored-problems', 'number-puzzle', 'puzzle-content', 'supports', '解法が段階的に変わる問題配置は、数理ルールの発見を試せる。問題数の多さは理解の深さを保証しない。', { design: .25 }),
  affinity('falling-modifiers', 'falling-blocks', 'challenge-modifiers', 'supports', '盤面や手数の条件を変え、慣れた配置判断を別の角度から使えるか試せる。', { design: .3 }),
  affinity('sliding-generation', 'sliding-puzzle', 'procedural-dungeon', 'tension', '迷宮を生成する機能は、配置パズルの可解性をそのまま保証しない。手作り問題との役割分担が必要。', { design: .6, integration: .4 }),
  affinity('match-progression', 'match-puzzle', 'progression', 'tension', '成長が盤面の読みを支えるか、能力値で解法を飛ばしてしまうかを確かめる。', { design: .4 }),
  affinity('breaker-authored-stages', 'block-breaker', 'stage-content', 'supports', '反射角や危険の配置を順に学べる構成を試せる。似た配置の水増しでは判断は増えない。', { design: .2 }),
  affinity('platformer-modifiers', 'platformer', 'challenge-modifiers', 'supports', '制限や配置変更で跳躍の習熟を別の目標へつなげられるか試せる。', { design: .3 }),
  affinity('platformer-branching-story', 'platformer', 'dialogue-branches', 'tension', '会話が移動の流れを止める場合がある。物語を読む時間と跳躍する時間の接続が課題。', { design: .45 }),
  affinity('topdown-stealth', 'topdown-action', 'stealth-awareness', 'supports', '戦う以外に警戒を読んで避ける選択を設けられる。両方の選択が使われる状況が必要。', { design: .45, integration: .35 }),
  affinity('shooter-realtime-deck', 'shooter', 'real-time-deck', 'supports', '回避しながら使うカードの判断を足せるか試せる。選択画面が射撃操作を妨げる問題もある。', { design: .55, integration: .45 }),
  affinity('rhythm-adaptive-music', 'rhythm', 'adaptive-music', 'tension', '音楽を変化させるなら譜面と時計の一致が必要。変化したこと自体は演奏の気持ちよさにならない。', { design: .5, integration: .6 }),
  affinity('fighting-large-roster', 'fighting', 'unit-content', 'tension', '対戦キャラクターを増やすほど組合せ検証が増える。名簿の長さを競技の深さとして扱わない。', { design: .7 }),
  affinity('racing-vehicle-variety', 'racing', 'vehicle-content', 'supports', '挙動とコースへの向き不向きがあれば、車種選択を走行判断につなげられる。', { design: .4 }),
  affinity('sports-progress', 'sports', 'progression', 'tension', '選手成長が長期目標になる一方、操作の上達より能力値が支配しないか確かめる。', { design: .45 }),
  affinity('turn-rpg-social', 'turn-rpg', 'social-relationships', 'supports', '仲間との関係変化を物語や編成の判断へつなげられるか試せる。', { design: .35 }),
  affinity('action-rpg-farming', 'action-rpg', 'farming-cycle', 'tension', '冒険と農作業の時間・報酬が競合する。片方を必須の雑務にしない接続が課題。', { design: .5, integration: .3 }),
  affinity('rogue-generated-quests', 'exploration-roguelike', 'procedural-quests', 'supports', '未知の場所へ進む理由を変えられるか試せる。目的地へ到達できることの検証が必要。', { design: .5, integration: .45 }),
  affinity('novel-voices', 'visual-novel', 'voice-content', 'supports', '演技で人物の意図を伝えられるか試せる。台詞数を増やすだけでは感情は伝わらない。', { design: .2 }),
  affinity('deduction-board', 'deduction', 'investigation-board', 'supports', '証拠と仮説を整理する道具になる。答えを先回りして示さない提示が必要。', { design: .35 }),
  affinity('escape-stealth', 'escape', 'stealth-awareness', 'tension', '観察と推理の時間に追跡の圧力が加わる。考える余地が失われないか確かめる。', { design: .55 }),
  affinity('deckbuilder-card-variety', 'deckbuilder', 'card-content', 'supports', 'カード間の役割と組合せが変われば山札を作る判断が増える。種類数そのものの効果ではない。', { design: .5 }),
  affinity('tactics-destructible', 'tactics', 'destructible-terrain', 'supports', '地形変更で移動・射線・陣形の判断を変えられる。到達性や敵AIの追従が課題。', { design: .5, integration: .55 }),
  affinity('rts-logistics', 'rts', 'resource-logistics', 'supports', '資源の数字だけでなく輸送経路を攻防の選択へつなげられるか試せる。', { design: .5, integration: .4 }),
  affinity('defense-cards', 'tower-defense', 'real-time-deck', 'tension', 'カードと塔の資源消費が重なる。配置とカードのどちらにも判断が残るか確かめる。', { design: .6, integration: .5 }),
  affinity('fourx-events', 'four-x', 'world-events', 'supports', '長期政策に対して外部変化への対応を足せる。無作為な損失だけにならない予兆が必要。', { design: .45 }),
  affinity('city-logistics', 'city-builder', 'resource-logistics', 'supports', '配置と接続が人口需要へ与える結果を物流として見せられる。', { design: .4, integration: .35 }),
  affinity('management-relations', 'management', 'social-relationships', 'tension', '人物との関係を経営判断へ接続する根拠が必要。別画面の好感度稼ぎに分断しない。', { design: .45 }),
  affinity('farming-relations', 'farming', 'social-relationships', 'supports', '作業や季節の出来事を住民が覚えれば、暮らしの反復に変化を付けられる。', { design: .35 }),
  affinity('survival-automation', 'survival-crafting', 'crafting-automation', 'supports', '序盤の採取・制作を設備へ任せ、次の探索や設計へ役割を移せるか試せる。', { design: .4, integration: .35 }),
  affinity('incremental-logistics', 'incremental', 'resource-logistics', 'tension', '離席中に詰まりが起きると放置の期待と衝突する。予測と復帰の仕組みが課題。', { design: .5, integration: .45 }),
  themeAffinity('abstract-puzzles', 'abstract', 'puzzle-content', 'supports', '余計な物語説明を置かず、形や数の変化を手掛かりとして見せられる。', { design: .2 }),
  themeAffinity('fantasy-progression', 'high-fantasy', 'progression', 'supports', '能力や道具の変化を世界内の成長として説明できる。成長の段階が世界観と一致するか確かめる。', { design: .25 }),
  themeAffinity('darkfantasy-cost', 'dark-fantasy', 'challenge-modifiers', 'supports', '代償や制限を世界の出来事と結び付けられる。ただし罰の多さを雰囲気と取り違えない。', { design: .4 }),
  themeAffinity('scifi-logistics', 'science-fiction', 'resource-logistics', 'supports', '距離・輸送・補給を未来世界の制約として扱える。数字だけの設定説明にしない。', { design: .3 }),
  themeAffinity('cyberpunk-stealth', 'cyberpunk', 'stealth-awareness', 'supports', '監視と権限の違いを侵入・回避の選択へ結び付けられる。', { design: .35 }),
  themeAffinity('apocalypse-production', 'post-apocalyptic', 'crafting-automation', 'tension', '設備を整える目標は作れるが、無尽蔵の生産で資源不足の題材を消さないか確かめる。', { design: .4 }),
  themeAffinity('moderncity-services', 'contemporary-city', 'city-services', 'supports', '人口や公共サービスの変化を身近な現象で伝えられる。実際の都市の再現度は別の問題。', { design: .3 }),
  themeAffinity('daily-relations', 'everyday-life', 'social-relationships', 'supports', '小さな行動を覚える人物の反応が、日常の変化を伝える手掛かりになる。', { design: .3 }),
  themeAffinity('school-relations', 'school-life', 'social-relationships', 'supports', '行事や選択を人物が記憶すれば、日程を繰り返す意味を作れる。', { design: .35 }),
  themeAffinity('rural-seasons', 'cozy-rural', 'weather-daynight', 'supports', '季節や天候を日々の作業と会話の変化へ接続できる。見た目の変更だけなら別の役割。', { design: .25 }),
  themeAffinity('historical-factions', 'historical', 'research-factions', 'supports', '技術や勢力の違いを政策選択へ接続できる。史実の名前を付けるだけで説得力は生まれない。', { design: .4 }),
  themeAffinity('alternate-events', 'alternate-history', 'world-events', 'supports', '分岐の起点とその後の影響を出来事で示せる。変化しない背景説明にしない。', { design: .4 }),
  themeAffinity('myth-quests', 'myth-folklore', 'quest-content', 'supports', '伝承の禁忌や交換条件を依頼の選択へ結び付けられる。', { design: .3 }),
  themeAffinity('noir-evidence', 'detective-noir', 'evidence-deduction', 'supports', '証言の矛盾や隠された利害を、プレイヤーが調べる証拠として扱える。', { design: .4 }),
  themeAffinity('psychhorror-adaptive-audio', 'psychological-horror', 'adaptive-music', 'supports', '状態に応じた音の変化で不確かさを伝えられる。音が答えを知らせ過ぎないか確かめる。', { design: .4 }),
  themeAffinity('supernatural-combat', 'supernatural-horror', 'progression', 'tension', '成長による安心感が、怪異への不安を弱める場合がある。恐怖を残す理由が必要。', { design: .5 }),
  themeAffinity('comedy-dynamic-story', 'comedy-satire', 'dynamic-narrative', 'tension', '条件で文章を繋げても笑いの間や文脈は保証できない。組合せごとの読後感を確かめる。', { design: .65 }),
  themeAffinity('romance-relations', 'romance', 'social-relationships', 'supports', '人物が行動を覚え、関係の変化を反応で示せる。数値を上げるだけの作業にしない。', { design: .4 }),
  themeAffinity('sports-replays', 'sports-competition', 'replays', 'supports', '自分と相手の判断を振り返る用途になる。記録だけでは改善点は伝わらない。', { design: .25 }),
  themeAffinity('music-adaptive', 'music-performance', 'adaptive-music', 'supports', 'プレイヤーの行動を演奏の変化へ繋げられるか試せる。判定ゲームにする必要はない。', { design: .4, integration: .3 }),
  themeAffinity('military-logistics', 'military-conflict', 'resource-logistics', 'supports', '補給と移動が戦闘以外の判断になる。操作する規模との釣合いを確かめる。', { design: .4 }),
  themeAffinity('colony-economy', 'space-colony', 'resource-economy', 'supports', '限られた設備や資源を維持の判断として示せる。失敗の原因を読める情報が必要。', { design: .35 }),
  themeAffinity('ocean-destructible', 'underwater', 'destructible-terrain', 'tension', '地形を壊すなら水中移動や環境変化と意味を繋ぐ必要がある。掘れる量だけでは探索にならない。', { design: .45, integration: .4 }),
  themeAffinity('wildlife-stealth', 'wildlife', 'stealth-awareness', 'supports', '動物に気付かれない観察や追跡の仕組みとして使える。敵を倒すルールである必要はない。', { design: .35 }),
  themeAffinity('culinary-recipes', 'culinary', 'recipe-content', 'supports', '材料と工程の違いを調理や提供の選択へ繋げられる。レシピの名簿だけにしない。', { design: .3 }),
  themeAffinity('industrial-automation', 'industrial', 'crafting-automation', 'supports', '設備を設計して手作業を移す変化を題材へ繋げられる。止まった理由の可視化が課題。', { design: .35 }),
  themeAffinity('western-relations', 'western', 'social-relationships', 'supports', '開拓地の秩序や取引への選択を、人が覚える出来事として扱える。', { design: .35 }),
  themeAffinity('surreal-puzzles', 'dream-surreal', 'puzzle-content', 'tension', '夢の因果でも、解答へ至る手掛かりは必要。説明不能を難しさの代用にしない。', { design: .5 })
];

const constraints = [
  { id: 'shooter-deck-time-model', when: { genreId: ['shooter', 'topdown-action', 'action-rpg', 'tower-defense'], featuresAny: ['deck-effects'], missingAllFeatures: ['real-time-deck'] }, severity: 'warning', message: 'リアルタイムの遊びにカード効果を足しています。real-time-deckで時間・入力・対象の整合を実装するか、独立したターン制モードとして設計してください。' },
  { id: 'horror-growth-tension', when: { themeIdsAny: ['psychological-horror', 'supernatural-horror'], featuresAny: ['progression', 'crafting-automation'] }, severity: 'warning', message: '成長や自動化で危険を克服できる構成です。恐怖を残すのか、克服を目標にするのかをテストで確かめてください。' },
  { id: 'stage-without-play-rule', when: { featuresAny: ['stage-content'], missingAllFeatures: ['number-rules', 'board-rules', 'platform-motion', 'topdown-motion', 'ball-reflection', 'vehicle-racing', 'sports-rules', 'interact-puzzles', 'rhythm-judgement', 'dialogue-branches'] }, severity: 'warning', message: 'ステージ配置はありますが、遊ぶための入力・進行ルールが見当たりません。地形や素材の量だけでは遊べる状態になりません。' },
  { id: 'enemy-without-conflict', when: { featuresAny: ['enemy-content'], missingAllFeatures: ['turn-combat', 'realtime-combat', 'projectiles-waves', 'platform-motion', 'ball-reflection', 'stealth-awareness'] }, severity: 'warning', message: '敵種類はありますが、敵に対処するルールが未選択です。戦闘、回避、追跡などの役割を定義してください。' },
  { id: 'industrial-logistics-hypothesis', when: { themeIdsAny: ['industrial'], featuresAny: ['crafting-automation'], missingAllFeatures: ['resource-logistics'] }, severity: 'warning', message: '自動生産はありますが、搬送経路は扱いません。集約在庫を使う企画として成立するか確認してください。物流機能は必須ではありません。' },
  { id: 'relationship-memory-events', when: { featuresAll: ['social-relationships', 'dynamic-narrative'], missingAllFeatures: ['quest-content'] }, severity: 'warning', message: '住民の記憶と動的な物語を組み合わせています。依頼を使わない場合も、変化した関係が何に影響したかをプレイヤーへ示す必要があります。' }
];

export const PLANNING_GAMEPLAY = { features, integrations, themes: audienceThemes, affinities, constraints, genreMarkets };
