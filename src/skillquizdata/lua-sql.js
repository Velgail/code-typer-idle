// Original, bounded syntax exercises. Difficulty is grouped in blocks of eight.
// These are syntax/technique questions; free implementations live in Challenges.
// Accept the usual spellings of the same construct, without accepting arbitrary
// code that happens to produce the example output.
const acceptedSpellings = {
  lua: {
    'syntax/parenthesized-return': ['((lookup()))'],
    'syntax/hexadecimal-float': ['0X1.8p2', '0x1.8P2', '0X1.8P2', '0x1.8p+2'],
    'design/constructor-fresh-table': ['{["health"] = 100}', "{['health'] = 100}", '{health = 100,}', '{health = 100;}'],
    'design/return-error-pair': ["nil, 'not found'"]
  },
  sql: {
    'syntax/left-join': ['LEFT OUTER JOIN'],
    'design/junction-table': ['INNER JOIN', 'CROSS JOIN'],
    'design/generated-column': ['AS'],
    'systems/transaction-commit': ['COMMIT TRANSACTION', 'END', 'END TRANSACTION'],
    'systems/transaction-rollback': ['ROLLBACK TRANSACTION'],
    'systems/savepoint-release': ['RELEASE SAVEPOINT'],
    'systems/foreign-keys-on': ['1', 'TRUE', 'YES'],
    'systems/immediate-write-transaction': ['IMMEDIATE TRANSACTION'],
    'systems/rollback-to-savepoint': ['ROLLBACK TO SAVEPOINT', 'ROLLBACK TRANSACTION TO', 'ROLLBACK TRANSACTION TO SAVEPOINT'],
    'systems/rename-column': ['RENAME'],
    'systems/attach-database': ['ATTACH']
  }
};
function questions(language, subject, rows) {
  if (rows.length !== 32) throw new Error(`${language}/${subject}: expected 32 authored questions`);
  return rows.map(([slug, title, prompt, code, answer, incorrect, explanation, extra = {}], index) => ({
    id: `${subject}/${slug}`, subject, concept: slug, title,
    difficulty: 1 + Math.floor(index / 8), minutes: [0.5, 1, 2, 3.5][Math.floor(index / 8)],
    prompt, code, answer, incorrect, explanation,
    ...(acceptedSpellings[language]?.[`${subject}/${slug}`] ? {alternatives: acceptedSpellings[language][`${subject}/${slug}`]} : {}),
    ...extra
  }));
}
const luaSyntax = questions('lua', 'syntax', [
  ['local-binding','ローカル変数','local宣言を使い、このブロックだけの体力変数を作る。',`-- Keep health private to this block.
____ health = 100
print(health)`, 'local', ['global','let'], 'Luaのlocal宣言は名前の有効範囲を現在のブロックへ限定する。'],
  ['nil-value','まだ値がない','未設定の装備スロットを表すnilリテラルを入れる。',`-- No weapon is equipped yet.
local weapon = ____
print(weapon == nil)`, 'nil', ['null','false'], 'nilは値の不在を表す。falseは存在する真偽値であり、未設定とは区別される。'],
  ['boolean-value','表示フラグを立てる','真偽値trueを使い、HUDの表示フラグを有効にする。',`-- Enable the heads-up display.
local show_hud = ____
print(type(show_hud))`, 'true', ['True','1'], 'Luaの真偽値リテラルは小文字のtrueとfalse。1は数値で、真偽値ではない。'],
  ['string-concatenation','文字列をつなぐ','文字列連結演算子で、画面に出すプレイヤー名を組み立てる。',`-- Add a label before the player name.
local name = "Ada"
local label = "Player: " ____ name
print(label)`, '..', ['+','&'], 'Luaの文字列連結は..を使う。+は加算演算子。'],
  ['length-operator','配列の長さ','穴のないシーケンスに長さ演算子を使い、所持アイテム数を求める。',`-- Count a contiguous sequence of items.
local items = {"key", "map", "potion"}
local count = ____items
print(count)`, '#', ['len','*'], '#は文字列またはテーブルの長さを求める。途中にnilがあるテーブルではシーケンスの個数として扱えない。'],
  ['remainder','周期の余り','剰余演算子で、更新回数を4フレームの周期へ収める。',`-- Wrap the animation tick into four frames.
local tick = 11
local frame = tick ____ 4
print(frame)`, '%', ['//','/'], '%は剰余を求める。//は切り下げ除算、/は通常の除算。'],
  ['not-equal','状態の違い','Luaの不等号を使い、現在と目標の状態が異なるか調べる。',`-- Update only when the state changes.
local current, target = "idle", "run"
print(current ____ target)`, '~=', ['!=','<>'], 'Luaの「等しくない」は~=。他言語の!=やSQLの<>とは表記が違う。'],
  ['if-then','条件分岐を開く','if文のthenを補い、コインが足りる場合だけ購入を許可する。',`-- Allow a purchase only with enough coins.
local coins, price = 20, 15
if coins >= price ____
    print("buy")
end`, 'then', ['do',':'], 'Luaのif条件の後にはthenを書き、endで分岐を閉じる。'],
  ['elseif-branch','段階を分ける','elseif節で、満タンでも空でもない体力の状態を判定する。',`-- Choose one health label.
local health = 40
if health == 0 then
    print("empty")
____ health < 100 then
    print("wounded")
else
    print("full")
end`, 'elseif', ['else if','elif'], '同じif文を続ける節はelseifという1語。else ifは別のifを入れ子にするため、endの数も変わる。'],
  ['while-do','条件付きの反復','while文のdoを補い、残り時間がある間だけ更新する。',`-- Consume all remaining timer ticks.
local remaining = 3
while remaining > 0 ____
    remaining = remaining - 1
end
print(remaining)`, 'do', ['then',':'], 'while条件の後はdo。反復本体はendまで続く。'],
  ['repeat-until','一度は実行する','repeat-until構文の終了条件側を補い、少なくとも1回試行する。',`-- Stop after the first successful attempt.
local attempts = 0
repeat
    attempts = attempts + 1
____ attempts >= 1
print(attempts)`, 'until', ['while','end'], 'repeatはuntilの条件が真になるまで反復する。whileと条件の向きが逆。'],
  ['numeric-for-step','逆向きのfor','数値forの増分を-1にし、3から1まで逆順に処理する。',`-- Visit countdown values in descending order.
for count = 3, 1, ____ do
    print(count)
end`, '-1', ['1','0'], '数値forの第3式は増分。降順には負数を使い、0は指定できない。'],
  ['sequence-iteration','連続配列を読む','ipairsで1から続く配列の添字と値を順に読む。',`-- Preserve sequence order for menu entries.
local menu = {"Start", "Options", "Quit"}
for index, label in ____(menu) do
    print(index, label)
end`, 'ipairs', ['pairs','next'], 'ipairsは1から最初のnilまで順に進む。pairsの列挙順は保証されない。'],
  ['map-iteration','辞書を読む','pairsで文字列キーの設定表を列挙する。順序は要求しない。',`-- Inspect settings by their string keys.
local settings = {music = true, fullscreen = false}
for key, value in ____(settings) do
    print(key, value)
end`, 'pairs', ['ipairs','table.sort'], 'pairsは辞書形式のキーを列挙できる。ipairsは数値添字のシーケンス用。'],
  ['function-return','関数から値を返す','returnを使い、計算したダメージを呼び出し元へ返す。',`-- Return the computed damage to the caller.
local function damage(hit, armor)
    ____ math.max(0, hit - armor)
end
print(damage(12, 4))`, 'return', ['yield','break'], 'returnは関数の結果を返す。breakはループから抜けるための文。'],
  ['floor-division','整数の区画番号','切り下げ除算で座標を8ピクセル単位の区画番号へ変換する。',`-- Convert a positive pixel coordinate to a tile column.
local pixel = 19
local column = pixel ____ 8
print(column)`, '//', ['/','%'], '//は商を負の無限大方向へ丸める。負数では0方向への切り捨てと異なる。'],
  ['named-table-field','名前付きフィールド','テーブル構築子の=を補い、healthという名前のフィールドを作る。',`-- Store health under a named field.
local player = {health ____ 100}
print(player.health)`, '=', [':','=='], 'テーブル構築子の名前付きフィールドはname = valueと書く。'],
  ['dynamic-table-key','実行時のキー','キー式を角括弧で囲み、変数keyの値をフィールド名として使う。',`-- Use the requested key rather than a field named key.
local key = "potion"
local stock = {____ = 3}
print(stock.potion)`, '[key]', ['key','"key"'], '[key]は変数の値をキーにする。key = 3では文字列"key"という固定キーになる。'],
  ['table-append','シーケンス末尾に追加','table.insertを使い、穴のないイベント列の末尾へ追加する。',`-- Append the next event to the queue.
local events = {"spawn"}
table.____(events, "move")
print(events[2])`, 'insert', ['append','concat'], 'table.insert(table, value)はシーケンスの末尾へ要素を追加する。'],
  ['multiple-assignment','値を交換する','多重代入の右辺を補い、補助変数なしでleftとrightを交換する。',`-- Exchange the two values in one assignment.
local left, right = "L", "R"
left, right = ____
print(left, right)`, 'right, left', ['left, right','right, right'], '右辺は代入が始まる前に評価されるので、left, right = right, leftで交換できる。'],
  ['variadic-arguments','可変長引数','...を使い、渡された全引数をテーブルへ取り込む。',`-- Collect all supplied menu labels.
local function labels(...)
    return {____}
end
print(labels("A", "B")[2])`, '...', ['args','*args'], 'Luaの可変長引数は...で参照する。nilも含めた個数を保持する用途ではtable.packが必要。'],
  ['parenthesized-return','戻り値を1個にする','関数呼び出しを括弧で囲み、複数戻り値の先頭だけをreturnする。',`-- Keep only the first result of the lookup.
local function lookup() return "key", 3 end
local function first() return ____ end
local name, count = first()
print(name, count)`, '(lookup())', ['lookup()','{lookup()}'], '括弧で囲んだ関数呼び出しは結果が1個に調整される。テーブルに包む操作とは異なる。'],
  ['method-call-colon','selfを渡して呼ぶ','コロン構文で、actor自身をselfとしてmoveを呼ぶ。',`-- Pass the actor as the method receiver.
local actor = {x = 0}
function actor:move(dx) self.x = self.x + dx end
actor____move(5)
print(actor.x)`, ':', ['.','::'], 'actor:move(5)はactor.move(actor, 5)に相当する。ドット呼び出しではselfが自動で渡らない。'],
  ['logical-not','真偽を反転する','not演算子で、pausedが偽のときに動作フラグを真にする。',`-- Run the simulation while it is not paused.
local paused = false
local running = ____ paused
print(running)`, 'not', ['!','~'], 'notは論理否定。Luaではnilとfalseだけが偽として扱われる。'],
  ['long-string-delimiter','改行を含む文字列','対応する長い文字列の開始区切りを入れ、引用符と改行をそのまま保持する。',`-- Preserve quotes and line breaks in the help text.
local help = ____
Press "Start".
Use [ and ] freely.
]=]
print(help)`, '[=[', ['[[','"'], '[=[と]=]は対応する長い文字列の区切り。等号の数を合わせる。'],
  ['constant-local','再代入を禁止する','Lua 5.4の<const>属性を使い、設定名への再代入を禁止する。',`-- Prevent reassignment of the maximum score.
local maximum ____ = 999
print(maximum)`, '<const>', ['const','<readonly>'], '<const>はローカル変数の属性。参照先テーブルの内容まで不変にはしない。'],
  ['lexical-block','局所スコープを作る','do-endブロックを作り、一時変数を外へ漏らさない。',`-- Keep the temporary offset inside this block.
____
    local offset = 8
    print(offset)
end`, 'do', ['then','begin'], '単独のdo ... endは新しいブロックスコープを作る。'],
  ['goto-label','ラベルへ移動する','gotoの移動先ラベルをLuaの二重コロンで定義する。',`-- Skip the optional debug output.
goto finished
print("debug")
____
print("done")`, '::finished::', ['finished:','label finished'], 'ラベルは::name::。gotoでローカル変数の有効範囲内へ飛び込むことはできない。'],
  ['hexadecimal-float','16進浮動小数点','16進浮動小数点リテラルを使い、1.5×2²を表す。',`-- Express an exact binary-scaled constant.
local scale = ____
print(scale == 6)`, '0x1.8p2', ['0x1.8e2','0x18'], '16進浮動小数点の指数はpで示し、2の累乗を表す。0x1.8は1.5。'],
  ['bitwise-shift','フラグ位置を作る','左シフト演算子で、添字3のビットだけが立つマスクを作る。',`-- Select one flag bit by its index.
local index = 3
local mask = 1 ____ index
print(mask)`, '<<', ['>>','^'], '<<は左シフト。Luaの^は累乗であり、排他的論理和ではない。'],
  ['exponentiation','累乗を求める','Luaの累乗演算子で、2の5乗を求める。',`-- Compute a power without a loop.
local result = 2 ____ 5
print(result)`, '^', ['**','~'], 'Luaでは^が累乗、~がビット単位の排他的論理和。'],
  ['false-preserving-default','falseを上書きしない','値がnilの場合だけ既定値へ置き換え、明示的なfalseを保持する。',`-- Preserve an explicitly disabled option.
local option = false
if option ____ nil then option = true end
print(option)`, '==', ['~=','or'], 'option or trueではfalseまでtrueへ変わる。nilとの比較なら不在だけを判定できる。']
]);
const luaDesign = questions('lua', 'design', [
  ['named-parameters','引数の役割を明示する','設定テーブルのspeedフィールドを読み、引数の順序に依存しない初期化にする。',`-- Read movement speed from a named option.
local function create(options)
    return {speed = options.____}
end
print(create({speed = 4}).speed)`, 'speed', ['options','velocity'], '名前付きの設定テーブルは、引数の役割を呼び出し箇所に残せる。'],
  ['early-return','失敗条件を先に返す','returnを使い、不足資金の場合に購入処理を中断する。',`-- Leave the balance unchanged after a failed purchase.
local function buy(coins, price)
    if coins < price then ____ coins end
    return coins - price
end
print(buy(3, 10))`, 'return', ['break','continue'], '失敗条件で先にreturnすると、成功時の処理を深く入れ子にせずに書ける。'],
  ['private-state','状態を閉じ込める','localで残高をクロージャ内部に閉じ込め、外部の同名変数と分離する。',`-- Hide the balance behind the returned function.
local function wallet()
    ____ balance = 0
    return function(delta)
        balance = balance + delta
        return balance
    end
end
print(wallet()(5))`, 'local', ['public','global'], '外側のlocal変数は内側の関数に保持される。名前をグローバルへ置く必要はない。'],
  ['module-export','モジュールを返す','モジュール末尾で公開テーブルを返し、呼び出し側がAPIを受け取れるようにする。',`-- Export only the public module table.
local M = {}
function M.double(value) return value * 2 end
____ M`, 'return', ['export','yield'], 'Luaのモジュールは通常、チャンク末尾でAPIテーブルをreturnする。'],
  ['constructor-fresh-table','別々の状態を作る','healthを100で初期化した新しいテーブルを返し、複数プレイヤーの状態を共有させない。',`-- Allocate independent state for each player.
local function create_player()
    return ____
end
local a, b = create_player(), create_player()
a.health = 1
print(b.health)`, '{health = 100}', ['_G','nil'], 'テーブル構築子は評価のたびに新しいテーブルを作る。同じテーブルを返すと状態が共有される。'],
  ['copy-field','必要なデータだけ渡す','公開用のスコアだけを新しいテーブルへ写し、内部のtokenを公開しない。',`-- Expose the score without leaking the private token.
local internal = {score = 20, token = "secret"}
local public = {score = internal.____}
print(public.token)`, 'score', ['token','public'], '公開データ用のテーブルを別に組み立てると、意図しないフィールドの公開を防げる。'],
  ['dependency-function','処理を引数で受ける','引数として受けたnotify関数を呼び、通知の実装を固定しない。',`-- Let the caller decide how rewards are announced.
local function award(notify)
    ____("reward")
end
award(print)`, 'notify', ['print','require'], '関数を引数で受ければ、表示・ログ・テスト用の記録処理へ差し替えられる。'],
  ['dispatch-table','処理を表で選ぶ','関数を格納したテーブルから要求名の処理を取り出して呼ぶ。',`-- Dispatch an action by its name.
local handlers = {jump = function() return "up" end}
local action = "jump"
print(handlers[____]())`, 'action', ['"action"','handlers'], '文字列をキーにした関数テーブルは、処理と名前の対応を一か所に集められる。'],
  ['closure-counter','呼び出し間の状態','外側のcountを更新し、同じクロージャの呼び出し回数を保持する。',`-- Remember the count between calls.
local function make_counter()
    local count = 0
    return function()
        count = ____
        return count
    end
end
local next_count = make_counter()
print(next_count(), next_count())`, 'count + 1', ['1','count'], '毎回同じ外側の変数を更新することで、関数の呼び出しをまたいで状態を保持する。'],
  ['higher-order-filter','条件を受け取る','受け取ったpredicateで値を判定し、選別条件を呼び出し側へ分離する。',`-- Separate the selection rule from the traversal.
local function keep(values, predicate)
    local result = {}
    for _, value in ipairs(values) do
        if ____(value) then result[#result + 1] = value end
    end
    return result
end
print(#keep({1, 2, 3}, function(n) return n > 1 end))`, 'predicate', ['values','result'], '走査処理は共通にし、条件だけを関数として差し替えられる。'],
  ['metatable-index','共通のメソッドを探す','__indexメタメソッドを使い、インスタンスにないメソッドをPlayerから探す。',`-- Share methods without copying them to every instance.
local Player = {name = "anonymous"}
Player.____ = Player
local actor = setmetatable({}, Player)
print(actor.name)`, '__index', ['__newindex','__call'], '__indexは通常のフィールド検索で値が見つからなかったときに参照される。'],
  ['metatable-newindex','新しい書き込みを監視する','__newindexを使い、未登録フィールドへの代入を拒否する。',`-- Reject writes to undeclared fields.
local object = setmetatable({}, {
    ____ = function() error("read only") end
})
local ok = pcall(function() object.score = 10 end)
print(ok)`, '__newindex', ['__index','__tostring'], '__newindexは存在しないキーへの通常代入で呼ばれる。既存フィールドまで自動で保護する機能ではない。'],
  ['metatable-call','呼び出せるオブジェクト','__callを定義し、倍率テーブルを関数のように呼べるようにする。',`-- Apply the multiplier through the call syntax.
local multiplier = setmetatable({factor = 3}, {
    ____ = function(self, value) return self.factor * value end
})
print(multiplier(4))`, '__call', ['__add','__len'], '__callは値を関数呼び出しの形で使ったときの動作を定義する。'],
  ['metatable-string','読みやすいログ','__tostringでログ用の文字列表現を定義する。',`-- Give the actor a useful log representation.
local actor = setmetatable({name = "Ada"}, {
    ____ = function(self) return "Actor:" .. self.name end
})
print(tostring(actor))`, '__tostring', ['__concat','__name'], '__tostringはtostringやprintで用いる表示を定義する。__nameだけではこの文字列にならない。'],
  ['metatable-add','値オブジェクトの加算','__addを定義し、2つの座標値を加算できるようにする。',`-- Add two coordinate values.
local meta = {____ = function(a, b) return a.x + b.x end}
local a, b = setmetatable({x = 2}, meta), {x = 5}
print(a + b)`, '__add', ['__mul','__index'], '__addは+の動作を定義する。演算子に応じたメタメソッドを選ぶ。'],
  ['protected-call','失敗を結果へ変える','pcallで失敗する処理を呼び、例外を成功フラグとエラー値として受け取る。',`-- Catch an optional operation without stopping the caller.
local ok, message = ____(function() error("missing asset") end)
print(ok, type(message))`, 'pcall', ['assert','error'], 'pcallは成功時にtrueと結果、失敗時にfalseとエラー値を返す。'],
  ['error-handler','失敗に文脈を付ける','xpcallを使い、エラーハンドラーで処理名を付けてから失敗を受け取る。',`-- Attach operation context before reporting the failure.
local ok, message = ____(
    function() error("bad state") end,
    function(err) return "load: " .. tostring(err) end
)
print(ok, message:match("load:") ~= nil)`, 'xpcall', ['pcall','assert'], 'xpcallの第2引数はエラーハンドラー。pcallの第2引数は呼び出す関数への引数になる。'],
  ['precondition-assert','入力条件を守る','assertで正の容量という事前条件を検査してからオブジェクトを作る。',`-- Reject an invalid capacity before allocating state.
local function buffer(capacity)
    ____(capacity > 0, "capacity must be positive")
    return {capacity = capacity}
end
print(buffer(8).capacity)`, 'assert', ['pcall','type'], 'assertは条件が偽またはnilならエラーにする。条件を調べるだけのtypeでは拒否できない。'],
  ['return-error-pair','予想できる失敗を返す','未登録キーの場合はnilと理由の文字列not foundを返し、通常の失敗を戻り値で伝える。',`-- Represent a missing entry without raising an exception.
local function lookup(stock, key)
    if stock[key] == nil then return ____ end
    return stock[key]
end
local value, reason = lookup({}, "key")
print(value, reason)`, 'nil, "not found"', ['false','0, nil'], 'nil, reasonという組は、呼び出し側が値の不在と理由を分けて扱える。'],
  ['coroutine-create','中断できる処理を作る','coroutine.createで、まだ実行されていないコルーチンを作る。',`-- Prepare a task without running it yet.
local task = coroutine.____(function() return "done" end)
print(coroutine.status(task))`, 'create', ['resume','yield'], 'createはthreadを作る。実行の開始や再開はresumeで行う。'],
  ['coroutine-resume','処理を再開する','resumeでコルーチンを実行し、成功フラグと戻り値を受け取る。',`-- Start the prepared task and inspect its result.
local task = coroutine.create(function() return 7 end)
local ok, result = coroutine.____(task)
print(ok, result)`, 'resume', ['yield','status'], 'resumeは実行結果の前に成功フラグを返す。コルーチン内のエラーもfalseとともに返る。'],
  ['coroutine-yield','途中経過を返す','yieldで処理を一時中断し、最初の進捗を呼び出し側へ返す。',`-- Pause after the first progress update.
local task = coroutine.create(function()
    coroutine.____("loading")
    return "ready"
end)
local ok, progress = coroutine.resume(task)
print(ok, progress)`, 'yield', ['resume','close'], 'yieldは現在のコルーチンを中断する。再度resumeされると続きから動く。'],
  ['coroutine-wrapper','生成器として呼ぶ','coroutine.wrapで、resumeの成功フラグを扱わず呼べる生成器を作る。',`-- Expose a coroutine as a simple iterator function.
local next_value = coroutine.____(function()
    coroutine.yield("first")
    return "last"
end)
print(next_value(), next_value())`, 'wrap', ['create','running'], 'wrapは関数を返し、呼ぶたびにコルーチンを再開する。内部エラーは呼び出し側へ伝わる。'],
  ['module-dependency','依存モジュールを読む','requireを使い、package.preloadに登録した計算モジュールを読む。',`-- Resolve the registered module through Lua's loader.
package.preload["reward_math"] = function()
    return {double = function(n) return n * 2 end}
end
local rewards = ____("reward_math")
print(rewards.double(3))`, 'require', ['dofile','loadfile'], 'requireはpackage.loadedを確認し、必要なときだけローダーを使う。ファイルを毎回実行するdofileとは異なる。'],
  ['raw-access','メタメソッドを迂回する','rawgetで、__indexの既定値ではなく実際に保存されたフィールドを調べる。',`-- Check storage without triggering the fallback.
local settings = setmetatable({}, {__index = function() return 10 end})
print(____(settings, "volume"))`, 'rawget', ['getmetatable','tonumber'], 'rawgetは__indexを呼ばずにテーブルの値を取得する。'],
  ['raw-write','監視中の格納を行う','rawsetを使い、__newindex内から再帰せずに値を保存する。',`-- Store a monitored write without calling __newindex again.
local object = setmetatable({}, {
    __newindex = function(self, key, value)
        ____(self, key, value)
    end
})
object.score = 5
print(object.score)`, 'rawset', ['setmetatable','table.insert'], '__newindex内で通常のself[key] = valueを行うと再帰する。rawsetなら格納だけを行える。'],
  ['isolated-environment','参照できる名前を限定する','loadの環境引数へ明示したテーブルを渡し、チャンクの名前解決を制限する。',`-- Give the chunk only its explicit input environment.
local environment = {score = 7}
local chunk = assert(load("return score * 2", "rule", "t", ____))
print(chunk())`, 'environment', ['_G','nil'], 'loadの第4引数は環境テーブル。これは名前の制限であり、資源上限などを備えた完全な隔離ではない。'],
  ['closure-factory-isolation','生成器を独立させる','各呼び出しの引数startをlocal状態として保持し、2個のカウンターを独立させる。',`-- Capture a separate starting value for every counter.
local function counter(start)
    local value = ____
    return function() value = value + 1; return value end
end
local a, b = counter(0), counter(10)
print(a(), b())`, 'start', ['0','_G.value'], 'ファクトリーの引数とlocal変数は呼び出しごとに独立し、それぞれのクロージャに保持される。'],
  ['iterator-protocol','独自イテレーターを作る','汎用forの次の制御変数として、更新後のindexを返す。',`-- Return the next control value before the payload.
local function next_item(values, index)
    index = index + 1
    if values[index] ~= nil then return ____, values[index] end
end
for index, value in next_item, {"A", "B"}, 0 do print(index, value) end`, 'index', ['0','nil'], '汎用forはイテレーターの先頭の戻り値を次回の制御変数にする。nilを返すと終了する。'],
  ['packed-nil-results','nilを含む結果を保つ','table.packでnilを含む引数の個数をnフィールドに記録する。',`-- Keep the number of results even when one is nil.
local values = table.____("A", nil, "C")
print(values.n)`, 'pack', ['unpack','concat'], 'table.packはnに引数の個数を保存する。{...}の長さ演算子だけではnilを含む個数を確定できない。'],
  ['close-resource','スコープ終了時の後始末','<close>属性を指定し、ブロック終了時に__closeを呼んで後始末する。',`-- Release the guard when its scope ends.
local released = false
do
    local guard ____ = setmetatable({}, {
        __close = function() released = true end
    })
end
print(released)`, '<close>', ['<const>','<gc>'], 'Lua 5.4の<close>はスコープを抜ける際に__closeを呼ぶ。ガベージコレクションの時期には依存しない。'],
  ['coroutine-cleanup','中断した処理を閉じる','coroutine.closeを使い、中断中のコルーチンの<close>変数を片付ける。',`-- Close a suspended task and its pending guard.
local task = coroutine.create(function()
    local guard <close> = setmetatable({}, {__close = function() end})
    coroutine.yield()
end)
coroutine.resume(task)
print(coroutine.____(task))`, 'close', ['yield','create'], 'Lua 5.4のcoroutine.closeは停止中または終了済みのコルーチンを閉じ、未処理の後始末も実行する。']
]);
const luaGraphics = questions('lua', 'graphics', [
  ['position-components','座標を読む','座標テーブルのxフィールドを読み、横方向の表示位置を得る。',`-- Read the horizontal coordinate for rendering.
local position = {x = 12, y = 8}
print(position.____)`, 'x', ['y','position'], '名前付きフィールドなら、座標の意味を呼び出し側に残せる。'],
  ['screen-offset','画面の原点をずらす','加算でワールド座標へ画面オフセットを適用する。',`-- Translate a world coordinate into screen space.
local world_x, offset_x = 10, 4
local screen_x = world_x ____ offset_x
print(screen_x)`, '+', ['*','/'], '平行移動は座標へオフセットを足す。拡大率を掛ける操作とは別。'],
  ['integer-pixel','ピクセルへ切り下げる','math.floorで正の描画座標を左隣の整数ピクセルへそろえる。',`-- Snap the coordinate to the pixel on its left.
local x = 12.8
print(math.____(x))`, 'floor', ['ceil','abs'], 'floorは値以下の最大の整数を返す。ceilでは右隣へ切り上がる。'],
  ['alpha-clamp','不透明度の上限','math.minで不透明度が1を超えないようにする。入力は0以上とする。',`-- Keep a nonnegative opacity at or below one.
local opacity = 1.4
opacity = math.____(opacity, 1)
print(opacity)`, 'min', ['max','abs'], 'min(opacity, 1)は上限を設ける。下限も必要なら別にmaxを組み合わせる。'],
  ['coordinate-format','座標を表示する','string.formatの%dを使い、整数座標をHUDの文字列へ整形する。',`-- Display both integer coordinates in the HUD.
local x, y = 4, 9
print(string.format("x=%d y=____", x, y))`, '%d', ['%s%s','%q'], '%dは整数の10進表示。引数の数と書式指定の数を合わせる。'],
  ['color-channels','色チャンネルを読む','色テーブルのgを読み、緑チャンネルだけを取り出す。',`-- Read the green channel of the material color.
local color = {r = 0.8, g = 0.4, b = 0.2}
print(color.____)`, 'g', ['r','a'], 'RGBの各チャンネルを名前で分けると、取り違えを見つけやすい。'],
  ['visible-condition','表示対象を選ぶ','if文の条件へvisibleを指定し、非表示要素を描画対象から外す。',`-- Draw the label only when it is visible.
local label = {visible = true, text = "Ready"}
if label.____ then print(label.text) end`, 'visible', ['text','hidden'], '表示可否の真偽値を条件にする。文字列textは空文字でも真として扱われる。'],
  ['frame-modulo','コマを循環させる','剰余で0始まりのフレーム番号をコマ数の範囲へ戻す。',`-- Loop through the available animation frames.
local tick, frame_count = 10, 4
print(tick ____ frame_count)`, '%', ['//','^'], '周期内の位置は剰余で求められる。Luaの配列添字へ使うなら通常は1を足す。'],
  ['linear-interpolation','位置を補間する','線形補間の差分end_x-start_xを使い、始点から終点へ進める。',`-- Interpolate from the start toward the end.
local start_x, end_x, t = 10, 30, 0.25
local x = start_x + (____) * t
print(x)`, 'end_x - start_x', ['start_x - end_x','end_x + start_x'], '始点へ「終点との差×進行率」を足す。t=0で始点、t=1で終点になる。'],
  ['delta-time-motion','経過時間で動かす','速度へdeltaを掛け、フレーム数ではなく経過秒数で移動量を決める。',`-- Move at a speed measured in units per second.
local x, speed, delta = 0, 120, 0.016
x = x + speed ____ delta
print(x)`, '*', ['+','/'], '速度の単位が距離/秒なら、経過秒数を掛けて移動距離へ変換する。'],
  ['degree-to-radian','角度を変換する','math.radで度数法の角度を、三角関数が受け取るラジアンへ変える。',`-- Convert an editor angle before using trigonometry.
local degrees = 90
print(math.sin(math.____(degrees)))`, 'rad', ['deg','floor'], 'Luaのsinやcosはラジアンを受け取る。math.degは逆方向の変換。'],
  ['two-argument-atan','方向角を得る','math.atanへy,xの順で渡し、象限を保持した方向角を求める。',`-- Preserve the vector's quadrant when finding its angle.
local x, y = -1, 1
print(math.atan(____))`, 'y, x', ['x, y','y / x'], 'Luaのmath.atan(y, x)は2成分を受け取り、単にy/xを渡す場合より象限を正しく扱える。'],
  ['draw-order-sort','奥行き順に並べる','table.sortの比較関数で、depthの小さい要素を先へ並べる。',`-- Sort render entries by increasing depth.
local entries = {{depth = 8}, {depth = 2}}
table.sort(entries, function(a, b) return a.depth ____ b.depth end)
print(entries[1].depth)`, '<', ['>','<='], '比較関数は厳密な順序を返す。<=では同じ値同士でも真になり、sortの条件を満たさない。'],
  ['atlas-column','アトラスの列','0始まりのタイルIDの剰余で、横に並ぶアトラスの列を求める。',`-- Find the atlas column for a zero-based tile id.
local tile_id, columns = 13, 8
print(tile_id ____ columns)`, '%', ['//','/'], '列は列数で割った余り。行はtile_id // columnsで求める。'],
  ['atlas-row','アトラスの行','切り下げ除算で、タイルIDが属するアトラスの行を求める。',`-- Skip complete atlas rows before locating the tile.
local tile_id, columns = 13, 8
print(tile_id ____ columns)`, '//', ['%','/'], '行番号には完了した列数ぶんのまとまりを数える。通常の除算の小数部は行番号にはならない。'],
  ['text-join','描画用テキストをまとめる','table.concatで、複数のラベルを改行区切りの文字列へまとめる。',`-- Build one text block from several HUD lines.
local lines = {"Health: 10", "Coins: 4"}
print(table.____(lines, "\\n"))`, 'concat', ['insert','sort'], 'table.concatはシーケンスの要素を区切り文字で連結する。'],
  ['hex-color','色を16進表記にする','%02Xを使い、色チャンネルを大文字の16進数2桁へ整形する。',`-- Pad one color channel to two hexadecimal digits.
local channel = 15
print(string.format("____", channel))`, '%02X', ['%02d','%f'], '%Xは大文字16進数、幅2と0埋めにより15を0Fと表示する。'],
  ['packed-rgb','RGBを整数へ詰める','ビットORで、位置の異なる赤・緑・青の値を1つの整数へまとめる。',`-- Combine non-overlapping RGB channel bits.
local red, green, blue = 255, 128, 0
local rgb = (red << 16) ____ (green << 8) | blue
print(rgb)`, '|', ['&','~'], '重ならないビット列の組み合わせにはORを使う。ANDでは共通ビットだけが残る。'],
  ['unpack-channel','色チャンネルを取り出す','0xFFのマスクとANDを使い、下位8bitの青だけを取り出す。',`-- Isolate the blue byte of a packed color.
local rgb = 0x3366CC
print(rgb ____ 0xFF)`, '&', ['|','~'], 'ANDはマスクで指定した位置だけを残す。ORでは指定位置を立ててしまう。'],
  ['easing-curve','補間の出足を変える','進行率を二乗し、開始時にゆっくり進むイージングを作る。',`-- Ease in by squaring the normalized progress.
local t = 0.25
local eased = t ____ 2
print(eased)`, '^', ['~','*'], '0〜1の値を二乗すると直線補間より小さくなり、開始時の変化が緩やかになる。'],
  ['point-in-rectangle','矩形内を判定する','論理ANDで横と縦の条件を両方要求し、点が矩形の内部か調べる。',`-- Require both coordinate ranges for a hit test.
local x, y = 3, 7
local inside = (x >= 0 and x < 10) ____ (y >= 0 and y < 10)
print(inside)`, 'and', ['or','&'], '矩形の内側には横・縦の両条件が必要。orでは片方だけ合っていても通る。'],
  ['camera-relative','カメラからの位置','ワールド座標からカメラ座標を引き、カメラを原点とする表示位置にする。',`-- Render positions relative to the camera origin.
local world_x, camera_x = 120, 100
print(world_x ____ camera_x)`, '-', ['+','*'], 'カメラと同じ位置の物体が0になるように、カメラ座標を引く。'],
  ['sprite-flip','スプライトを反転する','幅-1-xを使い、0始まりのピクセル位置を左右反転する。',`-- Reflect a zero-based pixel around the sprite center.
local x, width = 2, 8
print(____)`, 'width - 1 - x', ['width - x','x - width'], '0からwidth-1までの添字なので、反転先もwidth-1-xになる。'],
  ['sequence-frame-index','配列添字へ変える','0始まりの循環フレームへ1を足し、Luaの1始まり配列からコマを読む。',`-- Convert a cyclic frame number into a Lua sequence index.
local frames = {"idle0", "idle1", "idle2"}
local tick = 4
print(frames[(tick % #frames) ____ 1])`, '+', ['-','*'], 'シーケンスは通常1から始まる。剰余は0も返すので、そのまま添字にしない。'],
  ['utf8-text-length','UTF-8の文字数','utf8.lenで、UTF-8テキストのコードポイント数を数える。',`-- Count code points instead of encoded bytes.
local label = "Aあ"
print(utf8.____(label))`, 'len', ['codes','offset'], 'utf8.lenはコードポイント数を返す。結合文字を含む表示上の文字数とは一致しない場合がある。'],
  ['utf8-codepoint-iteration','文字の位置を調べる','utf8.codesで、文字列のバイト位置とコードポイントを列挙する。',`-- Inspect each code point together with its byte position.
for byte_index, codepoint in utf8.____("Aあ") do
    print(byte_index, codepoint)
end`, 'codes', ['len','char'], 'utf8.codesは汎用for用のイテレーターを返す。添字は文字番号ではなくバイト位置。'],
  ['render-command-closure','描画指示を保持する','クロージャで引数textを保持し、後から呼べる描画指示を返す。',`-- Capture the label for a deferred render command.
local function label_command(text)
    return function() return ____ end
end
local render = label_command("Ready")
print(render())`, 'text', ['"text"','nil'], '引数をクロージャへ保持すれば、描画を予約した時点のデータを後から使える。'],
  ['matrix-stack-pop','変換状態を戻す','table.removeでスタック末尾の変換を取り出し、子要素の処理後に親の状態へ戻る。',`-- Pop the latest transform after rendering a child.
local stack = {{x = 0}, {x = 10}}
local transform = table.____(stack)
print(transform.x, #stack)`, 'remove', ['insert','concat'], 'table.remove(stack)は末尾を取り除いて返す。スタックではpushとpopを対応させる。'],
  ['stable-sort-tiebreak','同じ奥行きの順序','奥行きが等しい場合はidを比較し、描画順の決め方を一意にする。',`-- Break equal-depth ties with a persistent id.
local function before(a, b)
    if a.depth == b.depth then return a.id ____ b.id end
    return a.depth < b.depth
end
local entries = {{id = 2, depth = 1}, {id = 1, depth = 1}}
table.sort(entries, before)
print(entries[1].id)`, '<', ['<=','=='], 'Luaのsort自体に安定性を期待せず、同値時の並びを別のキーで定義する。'],
  ['spatial-cell-key','空間区画のキー','string.formatで区画のx,yを区切り文字付きでまとめ、曖昧さのないキーを作る。',`-- Keep the two cell coordinates distinguishable in the key.
local cell_x, cell_y = 1, 23
print(string.format("____", cell_x, cell_y))`, '%d:%d', ['%d%d','%d'], '区切りがないと(1,23)と(12,3)を区別できない。2成分を両方含める。'],
  ['screen-wrap-negative','負の位置も循環させる','正の幅に対するLuaの剰余で、負の座標も0以上へ折り返す。',`-- Wrap a negative position into a positive screen width.
local x, width = -3, 10
print(x ____ width)`, '%', ['//','/'], 'Luaの剰余は除数の符号に沿うため、正のwidthなら結果は0以上width未満になる。'],
  ['animation-state-coroutine','アニメーションを段階実行','コルーチンのyieldで、1コマを返すたびに次の再開まで待つ。',`-- Emit exactly one frame per resume.
local next_frame = coroutine.wrap(function()
    for _, frame in ipairs({"walk0", "walk1"}) do
        coroutine.____(frame)
    end
end)
print(next_frame(), next_frame())`, 'yield', ['resume','status'], 'yieldで停止することで、呼び出し側が1コマずつ進行を制御できる。']
]);
const luaSystems = questions('lua', 'systems', [
  ['type-inspection','入力の型を調べる','type関数で、外部入力が数値かを調べる。',`-- Validate the incoming value before arithmetic.
local value = 12
print(____(value) == "number")`, 'type', ['typeof','tostring'], 'Luaの型名の取得はtype。数値の型名は"number"。'],
  ['numeric-conversion','数値へ変換する','tonumberで、設定ファイルから読んだ10進文字列を数値へ変える。',`-- Parse a numeric configuration value.
local text = "120"
print(____(text) + 1)`, 'tonumber', ['tostring','type'], 'tonumberは解釈できない入力にnilを返すため、実際の入力処理では失敗も確認する。'],
  ['explicit-integer','整数として受け取る','math.tointegerで、整数へ正確に変換できる値だけを受け取る。',`-- Accept only a value that has an exact integer representation.
local value = 4.0
print(math.____(value))`, 'tointeger', ['floor','ceil'], 'math.tointegerは小数を丸めず、整数に変換できない場合はnilを返す。'],
  ['queue-head','先頭の要素を取り出す','table.removeの位置へ1を指定し、小さなFIFOキューの先頭を取り出す。',`-- Remove the oldest job from this small queue.
local jobs = {"old", "new"}
print(table.remove(jobs, ____))`, '1', ['#jobs','0'], 'シーケンスの先頭は1。大規模なキューでは毎回の前詰めを避ける設計が必要。'],
  ['buffer-concatenation','出力をまとめる','table.concatで文字列片をまとめ、ループ中の連結の繰り返しを避ける。',`-- Assemble the buffered message once.
local parts = {"load", ":", "ready"}
print(table.____(parts))`, 'concat', ['unpack','insert'], '一度だけ連結することで、途中の文字列を繰り返し作る処理を減らせる。'],
  ['environment-variable','環境設定を読む','os.getenvで環境変数を読み、未設定なら既定値を使う。',`-- Read an optional runtime mode from the environment.
local mode = os.____("CTI_MODE") or "local"
print(type(mode))`, 'getenv', ['execute','setlocale'], 'os.getenvは未設定の場合nilを返す。ブラウザでは利用できる環境変数はホストが与えた範囲に限られる。'],
  ['parse-failure','不正な設定を検出する','nilとの比較でtonumberの失敗を検出する。数値0は成功として扱う。',`-- Reject invalid text while accepting zero.
local parsed = tonumber("not a number")
if parsed == ____ then print("invalid") end`, 'nil', ['false','0'], 'tonumberの失敗値はnil。0という正当な設定値と混同しない。'],
  ['integer-boundary','下限で止める','math.maxで残り時間の下限を0へ固定する。',`-- Prevent a timer from becoming negative.
local remaining = -2
print(math.____(0, remaining))`, 'max', ['min','floor'], 'max(0, remaining)は負の値を0へ抑える。上限を決めるminとは役割が逆。'],
  ['bit-mask-test','フラグを検査する','ビットANDで指定フラグだけを取り出し、有効かを調べる。',`-- Test whether the requested flag bit is enabled.
local flags, mask = 0x05, 0x04
print((flags ____ mask) ~= 0)`, '&', ['|','~'], 'ANDの結果が0でなければ、マスク内の少なくとも1bitが立っている。'],
  ['bit-mask-enable','フラグを有効にする','ビットORで指定のフラグを立て、ほかのフラグを保持する。',`-- Enable one flag without clearing the others.
local flags, mask = 0x01, 0x04
flags = flags ____ mask
print(flags)`, '|', ['&','~'], 'ORは指定bitを必ず1にする。XORではすでに立っていたbitを消してしまう。'],
  ['bit-mask-disable','フラグを解除する','マスクをビット反転しANDを取って、指定フラグだけを消す。',`-- Clear only the requested flag bits.
local flags, mask = 0x07, 0x02
flags = flags & (____mask)
print(flags)`, '~', ['not','-'], 'Luaでは単項~がビット反転。notは真偽値への論理否定。'],
  ['bit-mask-toggle','フラグを反転する','ビットXORで、指定したフラグだけをオン・オフ反転する。',`-- Toggle the requested bits while preserving all others.
local flags, mask = 0x05, 0x04
flags = flags ____ mask
print(flags)`, '~', ['^','|'], 'LuaのビットXORは~。^は累乗なので取り違えない。'],
  ['binary-pack','固定形式で保存する','string.packで符号なし16bit整数をリトルエンディアンの2byteへ変換する。',`-- Encode the message id in a two-byte little-endian field.
local packet = string.____("<I2", 513)
print(#packet)`, 'pack', ['unpack','format'], 'string.packの<I2はリトルエンディアンの符号なし2byte整数を表す。'],
  ['binary-unpack','固定形式を読み戻す','string.unpackで、バイナリの先頭から符号なし16bit整数を読む。',`-- Decode the two-byte message id.
local packet = string.pack("<I2", 513)
local id = string.____("<I2", packet)
print(id)`, 'unpack', ['pack','byte'], 'string.unpackは復元値と次の読み取り位置を返す。多重代入なら位置も受け取れる。'],
  ['explicit-base','16進設定を読む','tonumberの基数引数を16にして、16進文字列FFを数値へ変える。',`-- Parse a hexadecimal configuration field.
local text = "FF"
print(tonumber(text, ____))`, '16', ['10','2'], 'tonumber(text, base)は指定基数の整数として文字列を読む。'],
  ['input-pattern','数値だけを許可する','Luaパターンの^と$で全体を制限し、ASCIIの10進数字だけの入力を受け付ける。',`-- Require every character to be an ASCII decimal digit.
local text = "120"
print(text:match("____") ~= nil)`, '^[0-9]+$', ['[0-9]+','^[0-9]*'], '先頭と末尾を固定し、+で1文字以上を要求する。部分一致では不正な前後の文字を許してしまう。'],
  ['cache-expiration','期限切れを判定する','厳密な不等号で、期限と同時刻にはキャッシュを失効させる。',`-- Accept cached data only before its expiry tick.
local now, expires = 20, 20
local fresh = now ____ expires
print(fresh)`, '<', ['<=','>'], '有効期間をnow < expiresと定義すると、境界の同時刻を期限切れとして扱える。'],
  ['retry-cap','待ち時間の暴走を防ぐ','math.minで指数的に増える再試行待ちを上限へ抑える。',`-- Cap exponential retry delays.
local previous, maximum = 20, 30
local delay = math.____(previous * 2, maximum)
print(delay)`, 'min', ['max','ceil'], '再試行のたびに増やしても、上限を設ければ極端な待ち時間にならない。'],
  ['head-index-queue','前詰めしないキュー','読み取り済みスロットをnilへ戻し、先頭添字を進めるキューの参照を解放する。',`-- Release the consumed slot without shifting later jobs.
local queue, head = {"A", "B"}, 1
local job = queue[head]
queue[head] = ____
head = head + 1
print(job, queue[head])`, 'nil', ['false','0'], '参照をnilへ戻すと、その値をキューが保持し続けなくなる。この形式では#を件数管理に使わない。'],
  ['ring-buffer-wrap','リングの次位置','剰余と1を使い、1始まりのリングバッファ位置を循環させる。',`-- Advance a one-based cursor around a fixed buffer.
local cursor, capacity = 4, 4
cursor = (cursor ____ capacity) + 1
print(cursor)`, '%', ['//','/'], '現在位置%容量+1で、容量の次を1へ戻せる。'],
  ['weak-value-cache','キャッシュが寿命を延ばさない','__modeへvを指定し、値を弱参照にするキャッシュを作る。',`-- Allow cached values to be collected when nothing else owns them.
local cache = setmetatable({}, {__mode = "____"})
cache.actor = {}
print(getmetatable(cache).__mode)`, 'v', ['k','strong'], '__mode="v"は値を弱参照にする。kはキー。回収の時期を固定する仕組みではない。'],
  ['weak-key-metadata','所有物に紐付く付帯情報','__modeへkを指定し、キーのオブジェクトを生存させない付帯情報表にする。',`-- Keep metadata without owning the object used as its key.
local metadata = setmetatable({}, {__mode = "____"})
local actor = {}
metadata[actor] = "tracked"
print(getmetatable(metadata).__mode)`, 'k', ['v','none'], '弱いキーは、付帯情報表への登録だけを理由にオブジェクトの寿命を延ばさない。'],
  ['gc-memory-observation','使用メモリを観測する','collectgarbageのcountで、Luaが使うメモリ量をKiB単位で調べる。',`-- Observe Lua-managed memory without forcing a collection.
local kib = collectgarbage("____")
print(type(kib))`, 'count', ['collect','stop'], 'countはメモリ使用量を返す。collectは回収を実行し、stopは自動回収を止める。'],
  ['error-traceback','失敗の経路を残す','debug.tracebackをxpcallのハンドラーに渡し、失敗時の呼び出し経路を得る。',`-- Capture a traceback before protected execution unwinds.
local ok, trace = xpcall(function() error("load failed") end, debug.____)
print(ok, type(trace))`, 'traceback', ['getinfo','sethook'], 'xpcallのエラーハンドラーでtracebackを作ると、巻き戻される前の呼び出し経路を記録できる。'],
  ['instruction-hook','命令数ごとに監視する','debug.sethookのcount引数を使い、命令100回ごとに監視関数を呼ぶ。',`-- Install a count hook without call or line events.
local checks = 0
debug.sethook(function() checks = checks + 1 end, "", ____)
local total = 0
for i = 1, 500 do total = total + i end
debug.sethook()
print(checks > 0)`, '100', ['0','-1'], 'countが正数ならその命令数ごとにフックを呼ぶ。0では命令数の監視が無効になる。'],
  ['coroutine-failure-state','失敗後の状態を確認する','coroutine.statusで、実行に失敗したコルーチンがdeadになったことを確認する。',`-- Inspect the task after its protected resume fails.
local task = coroutine.create(function() error("job failed") end)
local ok = coroutine.resume(task)
print(ok, coroutine.____(task))`, 'status', ['running','isyieldable'], 'エラーで終了したコルーチンのstatusはdead。再開できる状態ではない。'],
  ['to-close-error-path','エラーでも後始末する','__closeメタメソッドへ終了時のエラーも渡されるよう、対応する名前を補う。',`-- Release the guard on both normal and error exits.
local cleaned = false
local ok = pcall(function()
    local guard <close> = setmetatable({}, {
        ____ = function(self, err) cleaned = true end
    })
    error("abort")
end)
print(ok, cleaned)`, '__close', ['__gc','__index'], '__closeはスコープ終了時の後始末に使う。第2引数はエラー終了ならそのエラーで、通常終了ならnil。'],
  ['module-reload-cache','モジュールの読込済み状態','package.loadedの対象エントリーだけをnilにして、次回requireでローダーを再実行させる。',`-- Invalidate only the selected module's require cache.
package.preload["settings"] = function() return {volume = 5} end
require("settings")
package.____["settings"] = nil
print(require("settings").volume)`, 'loaded', ['preload','searchers'], 'requireの結果キャッシュはpackage.loaded。preloadはローダーの登録先であり、消すと供給元まで失う。'],
  ['packed-result-forwarding','nilを含む戻り値を転送する','table.unpackの終端へ保存したnを渡し、末尾のnilも失わずに返す。',`-- Forward the exact number of packed results.
local results = table.pack("A", nil)
local function forward() return table.unpack(results, 1, ____) end
print(select("#", forward()))`, 'results.n', ['#results','1'], 'シーケンスの境界に頼らず、packが保存した個数をunpackへ明示する。'],
  ['plain-string-search','パターンとして読まない','string.findのplain引数をtrueにし、ドットを任意文字でなく文字そのものとして探す。',`-- Search for the literal dot in a file extension.
local path = "save.dat"
print(string.find(path, ".", 1, ____))`, 'true', ['false','nil'], 'plain=trueではLuaパターンを無効にする。外部入力を検索語にするときにも役立つ。'],
  ['bounded-load-mode','バイナリ入力を拒否する','loadのmodeへtを指定し、ソーステキストだけを読み込む。',`-- Reject binary chunks when loading a text rule.
local chunk = assert(load("return 7", "rule", "____", {}))
print(chunk())`, 't', ['b','bt'], 'tはテキストだけ、bはバイナリだけ、btは両方を許す。これは実行時間や権限の制限とは別。'],
  ['close-file-guard','一時ファイルを確実に閉じる','<close>でファイルハンドルを管理し、ブロックを抜けるときに閉じる。',`-- Close the temporary file when leaving this scope.
do
    local file ____ = assert(io.tmpfile())
    assert(file:write("checkpoint"))
end`, '<close>', ['<const>','<file>'], 'Lua 5.4の標準ファイルハンドルは__closeに対応し、<close>で閉じ忘れを防げる。']
]);
const SCORE_DATA = `CREATE TABLE scores(player TEXT, score INTEGER, stage INTEGER, team TEXT, played_at INTEGER);
INSERT INTO scores VALUES ('Ada',80,1,'red',10),('Bob',80,1,'blue',20),('Cy',60,2,'red',30),('Dee',NULL,2,'blue',40);`;
const ITEM_DATA = `CREATE TABLE items(id INTEGER PRIMARY KEY, name TEXT, price INTEGER, stock INTEGER, category TEXT);
INSERT INTO items VALUES (1,'potion',20,3,'heal'),(2,'map',50,0,'tool'),(3,'key',10,5,'tool');`;
const PLAYER_DATA = `CREATE TABLE teams(id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE players(id INTEGER PRIMARY KEY, name TEXT, team_id INTEGER, coins INTEGER);
INSERT INTO teams VALUES (1,'red'),(2,'blue'),(3,'green');
INSERT INTO players VALUES (1,'Ada',1,30),(2,'Bob',1,10),(3,'Cy',NULL,0);`;
const FRAME_DATA = `CREATE TABLE frames(tick INTEGER, x REAL, opacity REAL, label TEXT);
INSERT INTO frames VALUES (0,0,0.0,'idle'),(10,5,0.5,'walk'),(20,15,1.0,'run'),(30,18,0.4,'stop');`;
const TREE_DATA = `CREATE TABLE nodes(id INTEGER PRIMARY KEY, parent_id INTEGER, name TEXT);
INSERT INTO nodes VALUES (1,NULL,'world'),(2,1,'town'),(3,2,'shop'),(4,1,'forest');`;
const sqlSyntax = questions('sql', 'syntax', [
  ['select-expression','式を検索結果にする','SELECTを使い、テーブルなしで計算結果を1行返す。',`-- Evaluate a scalar expression.
____ 2 + 3 AS total;`, 'SELECT', ['UPDATE','FROM'], 'SELECTは式の値を結果として返せる。FROMが必須というわけではない。'],
  ['from-source','データの取得元','FROMで品目テーブルを指定し、名前の一覧を読む。',`-- Read names from the item table.
${ITEM_DATA}
SELECT name ____ items;`, 'FROM', ['INTO','SET'], 'FROMは検索対象のテーブルや部分問い合わせを指定する。'],
  ['where-filter','行を絞り込む','WHEREを使い、在庫が残っている品目だけを選ぶ。',`-- Select only items that are still in stock.
${ITEM_DATA}
SELECT name FROM items ____ stock > 0;`, 'WHERE', ['HAVING','ORDER BY'], 'WHEREは集約前の行を条件で絞る。'],
  ['column-alias','結果列に名前を付ける','ASで計算結果にtotal_costという列名を付ける。',`-- Give the computed column a clear output name.
${ITEM_DATA}
SELECT price * stock ____ total_cost FROM items;`, 'AS', ['IS','TO'], 'ASは列やテーブルの別名を明示する。'],
  ['distinct-values','重複した分類をまとめる','DISTINCTを使い、同じcategoryを1回だけ結果に出す。',`-- List each category once.
${ITEM_DATA}
SELECT ____ category FROM items;`, 'DISTINCT', ['ALL','UNIQUE'], 'SELECT DISTINCTは選択した列の組について重複を除く。'],
  ['descending-order','高得点から並べる','DESCを指定し、スコアを降順に並べる。',`-- Place larger scores before smaller scores.
${SCORE_DATA}
SELECT player, score FROM scores ORDER BY score ____;`, 'DESC', ['ASC','REVERSE'], 'ORDER BYの降順はDESC。指定しなければ通常ASCになる。'],
  ['limit-results','件数を制限する','LIMITで上位2行だけを返す。並び順はすでに指定されている。',`-- Keep only the first two ordered rows.
${ITEM_DATA}
SELECT name FROM items ORDER BY price DESC ____ 2;`, 'LIMIT', ['TOP','HAVING'], 'SQLiteでは結果行数の制限にLIMITを使う。'],
  ['null-literal','未設定値を返す','SQLのNULLリテラルを使い、未設定の値を表す。',`-- Represent an absent value rather than a string.
SELECT ____ AS missing_value;`, 'NULL', ['"NULL"','0'], 'NULLは値の不在を表す。文字列\'NULL\'や数値0とは別。'],
  ['and-condition','条件を両方満たす','ANDで価格と在庫の条件を両方満たす品目を選ぶ。',`-- Require both a low price and positive stock.
${ITEM_DATA}
SELECT name FROM items WHERE price <= 20 ____ stock > 0;`, 'AND', ['OR','XOR'], 'ANDは両条件が真の場合に真になる。NULLを含む場合は3値論理に注意する。'],
  ['or-condition','どちらかに該当する','ORで回復品または在庫切れの品目を選ぶ。',`-- Include healing items or sold-out items.
${ITEM_DATA}
SELECT name FROM items WHERE category = 'heal' ____ stock = 0;`, 'OR', ['AND','NOT'], 'ORは少なくとも片方が真なら行を選ぶ。'],
  ['membership-list','候補集合で選ぶ','INで指定した2種類の名前に該当する行を選ぶ。',`-- Match names in an explicit candidate list.
${ITEM_DATA}
SELECT name FROM items WHERE name ____ ('map','key');`, 'IN', ['BETWEEN','LIKE'], 'INは括弧内の候補集合への所属を調べる。'],
  ['inclusive-range','両端を含む範囲','BETWEENを使い、価格20以上50以下を選ぶ。',`-- Include both endpoints of the price range.
${ITEM_DATA}
SELECT name FROM items WHERE price ____ 20 AND 50;`, 'BETWEEN', ['IN','RANGE'], 'BETWEEN a AND bは両端を含む範囲条件。'],
  ['like-prefix','接頭辞で検索する','LIKEを使い、pで始まる名前を検索する。',`-- Match a name prefix with a SQL wildcard.
${ITEM_DATA}
SELECT name FROM items WHERE name ____ 'p%';`, 'LIKE', ['=','IN'], 'LIKEの%は0文字以上に一致する。通常の=では%も普通の文字として比較される。'],
  ['glob-case-sensitive','大文字小文字を区別する','SQLiteのGLOBを使い、ASCIIの小文字pから始まる名前だけを検索する。',`-- Use a case-sensitive shell-style pattern.
${ITEM_DATA}
SELECT name FROM items WHERE name ____ 'p*';`, 'GLOB', ['LIKE','='], 'GLOBは大文字小文字を区別し、*や?をワイルドカードとして使う。LIKEとは記号が異なる。'],
  ['is-null','未入力を調べる','IS NULLで、スコアが記録されていない行を選ぶ。',`-- Find rows with no recorded score.
${SCORE_DATA}
SELECT player FROM scores WHERE score ____ NULL;`, 'IS', ['=','=='], 'NULLとの判定にはIS NULLを使う。= NULLは真にならない。'],
  ['coalesce-default','表示上の既定値','coalesceで、NULLのスコアだけを0として表示する。',`-- Substitute zero only for a missing score.
${SCORE_DATA}
SELECT player, ____(score,0) AS display_score FROM scores;`, 'coalesce', ['nullif','sum'], 'coalesceは最初のNULLでない引数を返す。保存された0はそのまま残る。'],
  ['count-rows','行数を数える','COUNT(*)を使い、NULLの列がある行も含めて全行数を数える。',`-- Count every row, including one with a missing score.
${SCORE_DATA}
SELECT ____ AS entries FROM scores;`, 'COUNT(*)', ['COUNT(score)','SUM(score)'], 'COUNT(*)は行数、COUNT(score)はscoreがNULLでない行数を数える。'],
  ['sum-values','値を合計する','SUMで各品目の在庫数を合計する。',`-- Add the stock quantities across all items.
${ITEM_DATA}
SELECT ____(stock) AS total_stock FROM items;`, 'SUM', ['COUNT','MAX'], 'SUMは値の合計。COUNTはNULLでない値の件数。'],
  ['average-values','平均を求める','AVGを使い、記録済みスコアだけの平均を求める。',`-- Average the non-null score values.
${SCORE_DATA}
SELECT ____(score) AS average_score FROM scores;`, 'AVG', ['SUM','COUNT'], 'AVGはNULLを除いて平均する。NULLを0と扱う平均とは分母が異なる。'],
  ['minimum-value','最安値を選ぶ','MINで価格の最小値を求める。',`-- Find the cheapest listed price.
${ITEM_DATA}
SELECT ____(price) AS cheapest FROM items;`, 'MIN', ['MAX','AVG'], 'MINは最小の値を返す。品目名も必要なら、その行を選ぶ問い合わせを別に設計する。'],
  ['group-by-key','分類ごとに集計する','GROUP BYを使い、categoryごとの在庫合計を求める。',`-- Aggregate stock separately for each category.
${ITEM_DATA}
SELECT category, SUM(stock) FROM items ____ category;`, 'GROUP BY', ['ORDER BY','PARTITION BY'], 'GROUP BYは行をグループへまとめる。ORDER BYは並び順だけを変える。'],
  ['having-group-filter','集約後に絞る','HAVINGを使い、2件以上の品目がある分類だけを選ぶ。',`-- Filter categories after counting their rows.
${ITEM_DATA}
SELECT category, COUNT(*) FROM items GROUP BY category ____ COUNT(*) >= 2;`, 'HAVING', ['WHERE','LIMIT'], '集約した値に対する条件はHAVING。WHEREは集約前の個々の行を対象にする。'],
  ['case-expression','条件を値へ変える','CASE式のWHENを補い、在庫0をsold outという文字列に変える。',`-- Derive a display label from the stock condition.
${ITEM_DATA}
SELECT name, CASE ____ stock = 0 THEN 'sold out' ELSE 'available' END FROM items;`, 'WHEN', ['IF','WHERE'], 'CASE WHEN 条件 THEN 値 ELSE 値 ENDは、式として条件に応じた値を返す。'],
  ['nullif-divisor','ゼロ除算を避ける','nullifで在庫0をNULLに変え、除算の分母として使う。',`-- Produce a missing ratio when the stock is zero.
${ITEM_DATA}
SELECT name, price * 1.0 / ____(stock,0) FROM items;`, 'nullif', ['coalesce','max'], 'nullif(a,b)は等しければNULLを返す。0を別の数で置き換えて比率を捏造する操作ではない。'],
  ['inner-join','対応する行を結ぶ','JOINのONで、プレイヤーと所属チームのIDを対応付ける。',`-- Join each player to the matching team.
${PLAYER_DATA}
SELECT p.name, t.name FROM players AS p JOIN teams AS t ____ p.team_id = t.id;`, 'ON', ['WHERE BY','SET'], 'ONは結合条件。外部結合ではWHEREとの配置の違いが結果を変える。'],
  ['left-join','未所属も残す','LEFT JOINで、対応チームがないプレイヤーも結果に残す。',`-- Preserve players even when no team matches.
${PLAYER_DATA}
SELECT p.name, t.name FROM players AS p ____ teams AS t ON p.team_id=t.id;`, 'LEFT JOIN', ['INNER JOIN','CROSS JOIN'], 'LEFT JOINは左側の行を保ち、対応先がなければ右側の列をNULLにする。'],
  ['union-all','重複を残して結合する','UNION ALLで2つの結果をつなぎ、同じ値を消さない。',`-- Keep repeated values while appending result sets.
SELECT 'coin' AS item ____ SELECT 'coin';`, 'UNION ALL', ['UNION','INTERSECT'], 'UNION ALLは重複排除を行わない。UNIONは結果全体から同じ行を除く。'],
  ['intersection','共通の値だけ残す','INTERSECTを使い、2つの結果に共通するプレイヤー名を得る。',`-- Keep only names present in both result sets.
${SCORE_DATA}
SELECT player FROM scores WHERE score >= 80
____
SELECT player FROM scores WHERE team='red';`, 'INTERSECT', ['UNION ALL','EXCEPT'], 'INTERSECTは両方に含まれる行を返す。列数と比較できる型をそろえる。'],
  ['set-difference','片方にだけある値','EXCEPTで、全プレイヤー名からredチームの名前を除く。',`-- Remove the right-hand set from the left-hand set.
${SCORE_DATA}
SELECT player FROM scores
____
SELECT player FROM scores WHERE team='red';`, 'EXCEPT', ['INTERSECT','UNION'], 'EXCEPTは左の結果に含まれ、右には含まれない行を返す。'],
  ['common-table-expression','中間結果に名前を付ける','WITHで共通テーブル式を定義し、高得点行の中間結果を読む。',`-- Name the filtered intermediate result.
${SCORE_DATA}
____ high_scores AS (SELECT * FROM scores WHERE score >= 80)
SELECT player FROM high_scores;`, 'WITH', ['LET','VIEW'], 'WITHはそのSQL文の中だけで参照できるCTEを定義する。'],
  ['row-number-window','行に連番を付ける','OVERでウィンドウを指定し、得点順にrow_numberの連番を付ける。',`-- Number rows without collapsing them into groups.
${SCORE_DATA}
SELECT player, row_number() ____ (ORDER BY score DESC, player) AS position FROM scores;`, 'OVER', ['GROUP BY','WITHIN'], 'ウィンドウ関数の計算範囲はOVERで指定する。GROUP BYと違い行をまとめない。'],
  ['exists-subquery','関連行の存在','EXISTSで、所属プレイヤーが1人以上いるチームだけを選ぶ。',`-- Test for related rows without multiplying team rows.
${PLAYER_DATA}
SELECT t.name FROM teams AS t WHERE ____
(SELECT 1 FROM players AS p WHERE p.team_id=t.id);`, 'EXISTS', ['ALL','COUNT'], 'EXISTSは部分問い合わせが1行でも返すかを判定する。SELECTする定数自体は判定に使われない。']
]);
const sqlDesign = questions('sql', 'design', [
  ['primary-key','行の識別子を決める','PRIMARY KEYを使い、SQLiteの整数IDを一意な行識別子にする。',`-- Give each save slot a unique integer identity.
CREATE TABLE saves(id INTEGER ____, title TEXT);`, 'PRIMARY KEY', ['FOREIGN KEY','DEFAULT KEY'], 'INTEGER PRIMARY KEYはSQLiteのrowidの別名になり、行の識別に使える。'],
  ['not-null-contract','欠けてはいけない値','NOT NULLで、必須のプレイヤー名が欠けることを禁止する。',`-- Require a name for every player.
CREATE TABLE players(name TEXT ____);`, 'NOT NULL', ['IS NULL','DEFAULT NULL'], 'NOT NULLはNULLの保存を禁止する。空文字まで禁止するには別のCHECKなどが必要。'],
  ['unique-name','重複を禁止する','UNIQUE制約で、同じセーブ名を二重登録しない。',`-- Prevent duplicate non-null save names.
CREATE TABLE saves(id INTEGER PRIMARY KEY, name TEXT NOT NULL ____);`, 'UNIQUE', ['DISTINCT','INDEX'], 'UNIQUEは保存時に一意性を検査する。SELECT DISTINCTで表示だけまとめるのとは違う。'],
  ['column-default','省略時の初期値','DEFAULTで、新規プレイヤーのコインを0として初期化する。',`-- Supply zero when an insert omits the coin column.
CREATE TABLE players(id INTEGER PRIMARY KEY, coins INTEGER ____ 0);`, 'DEFAULT', ['SET','AS'], 'DEFAULTはINSERTでその列が省略された場合の値。明示したNULLを置き換えるものではない。'],
  ['check-invariant','保存時の不変条件','CHECKで、在庫が負数にならない条件を定義する。',`-- Reject negative stock at the storage boundary.
CREATE TABLE stock(item TEXT PRIMARY KEY, quantity INTEGER NOT NULL ____ (quantity >= 0));`, 'CHECK', ['WHERE','HAVING'], 'CHECKは行の挿入・更新時に条件を検査する。NULLを禁止したい列にはNOT NULLも必要。'],
  ['foreign-key-reference','参照先を定義する','REFERENCESで、スコアのplayer_idが参照するプレイヤーIDを宣言する。',`-- Associate score rows with an existing player identity.
PRAGMA foreign_keys=ON;
CREATE TABLE players(id INTEGER PRIMARY KEY);
CREATE TABLE scores(player_id INTEGER ____ players(id), score INTEGER);`, 'REFERENCES', ['JOINS','LINKS'], 'REFERENCESは外部キーの参照先。SQLiteで違反を拒否するにはforeign_keysも有効にする。'],
  ['increment-update','読み直さず加算する','SET句でcoins自身へ加算し、既存の残高を保って報酬を加える。',`-- Increment the stored balance in the database statement.
CREATE TABLE players(id INTEGER PRIMARY KEY, coins INTEGER);
INSERT INTO players VALUES (1,10);
UPDATE players ____ coins = coins + 5 WHERE id=1;`, 'SET', ['VALUES','ADD'], 'UPDATE SETで既存列を参照して更新すれば、クライアント側で読んで書き戻す回数を減らせる。'],
  ['explicit-insert-columns','列の順序に依存しない','INSERTの列リストを指定し、テーブル定義の並びを呼び出し側へ持ち込まない。',`-- Name inserted columns instead of relying on table order.
CREATE TABLE players(id INTEGER PRIMARY KEY, name TEXT, coins INTEGER DEFAULT 0);
INSERT INTO players ____ VALUES ('Ada');`, '(name)', ['(coins)','(id,name)'], '対象列を明示すると、列追加などに対する意図しない順序依存を減らせる。'],
  ['left-join-missing','関連がない親を探す','LEFT JOIN後の右側IDをIS NULLで判定し、誰も所属しないチームを選ぶ。',`-- Detect teams with no matching player row.
${PLAYER_DATA}
SELECT t.name FROM teams AS t LEFT JOIN players AS p ON p.team_id=t.id
WHERE p.id ____ NULL;`, 'IS', ['=','IS NOT'], '対応行がない外部結合の右側列はNULLになる。右側の非NULL主キーを調べると判定が明確。'],
  ['join-using','同名の結合キー','USINGで同じ名前のteam_id列を結び、結合キーを結果で1列にまとめる。',`-- Join the two inputs through their shared column name.
CREATE TABLE memberships(player TEXT, team_id INTEGER);
CREATE TABLE team_labels(team_id INTEGER, label TEXT);
SELECT team_id, label FROM memberships JOIN team_labels ____ (team_id);`, 'USING', ['ON','BY'], 'USING(column)は同名キーの等価結合を記述し、そのキーを1列として参照できる。'],
  ['multi-column-join','複合キーで結ぶ','ANDでplayer_idとslotの両方を要求し、別スロットの設定を混ぜない。',`-- Match both parts of the settings identity.
CREATE TABLE saves(player_id INTEGER, slot INTEGER);
CREATE TABLE settings(player_id INTEGER, slot INTEGER, volume INTEGER);
SELECT volume FROM saves AS s JOIN settings AS c
ON s.player_id=c.player_id ____ s.slot=c.slot;`, 'AND', ['OR','UNION'], '複数列で識別する関係では、結合条件も各列を対応付ける必要がある。'],
  ['correlated-exists','存在だけを調べる','相関部分問い合わせで外側のチームIDを参照し、プレイヤーが存在するチームを選ぶ。',`-- Correlate the existence test with the current team.
${PLAYER_DATA}
SELECT t.name FROM teams AS t WHERE EXISTS
(SELECT 1 FROM players AS p WHERE p.team_id=____);`, 't.id', ['p.id','p.team_id'], '外側の行のIDを使うことで、チームごとに関連する行があるか判定できる。'],
  ['null-safe-antijoin','NULLに壊されない除外','NOT EXISTSで所属者のいないチームを選び、NOT INのNULL問題を避ける。',`-- Exclude related rows even when other players have null team ids.
${PLAYER_DATA}
SELECT t.name FROM teams AS t WHERE ____
(SELECT 1 FROM players AS p WHERE p.team_id=t.id);`, 'NOT EXISTS', ['NOT IN','EXISTS'], 'NOT EXISTSは部分問い合わせの行の有無を判定する。NOT INの候補にNULLが混じる場合の影響を受けない。'],
  ['scalar-subquery','全体の値と比べる','単一の集約結果を返す部分問い合わせで、平均より高い価格の品目を選ぶ。',`-- Compare each price against one scalar average.
${ITEM_DATA}
SELECT name FROM items WHERE price > (SELECT ____(price) FROM items);`, 'AVG', ['COUNT','MAX'], '集約結果を1値として使う部分問い合わせは、行ごとの値と全体の指標を比較するために使える。'],
  ['derived-table','集約結果を表として使う','FROM内の部分問い合わせへASで別名を付け、集計済みの列を読む。',`-- Treat an aggregate result as a queryable input.
${ITEM_DATA}
SELECT category FROM (SELECT category, SUM(stock) AS total FROM items GROUP BY category) ____ totals
WHERE total > 0;`, 'AS', ['INTO','WITH'], '部分問い合わせをFROMへ置くと、中間結果の列を外側の問い合わせで参照できる。'],
  ['view-interface','読み取り用の表現を公開する','CREATE VIEWで在庫がある品目だけの読み取り口を定義する。',`-- Expose a named read model for available items.
${ITEM_DATA}
CREATE ____ available_items AS SELECT id,name FROM items WHERE stock>0;
SELECT name FROM available_items;`, 'VIEW', ['TABLE','INDEX'], 'VIEWは問い合わせに名前を付ける。通常のビュー自体が結果を複製保存するわけではない。'],
  ['compound-uniqueness','組として重複を禁止する','UNIQUE(player_id,item_id)で、所持品の同じ組を二重登録しない。',`-- Make the player and item pair unique.
CREATE TABLE inventory(player_id INTEGER NOT NULL, item_id INTEGER NOT NULL,
quantity INTEGER NOT NULL, ____ (player_id,item_id));`, 'UNIQUE', ['DISTINCT','CHECK'], '片方の列を単独でUNIQUEにすると、複数の所持品や複数の所有者を表現できなくなる。'],
  ['cross-column-check','列同士の整合性','CHECKで最小・最大の順序を検査し、逆転した範囲を保存しない。',`-- Preserve the relationship between both range endpoints.
CREATE TABLE ranges(low INTEGER NOT NULL, high INTEGER NOT NULL,
CHECK (low ____ high));`, '<=', ['>=','!='], '行全体の条件をCHECKへ置けば、どちらの列を更新した場合も不変条件を検査できる。'],
  ['composite-foreign-key','複合の参照を守る','複合外部キーでplayer_idとslotの組を、親の同じ2列へ参照させる。',`-- Reference one complete composite save identity.
PRAGMA foreign_keys=ON;
CREATE TABLE saves(player_id INTEGER, slot INTEGER, PRIMARY KEY(player_id,slot));
CREATE TABLE notes(player_id INTEGER, slot INTEGER, text TEXT,
FOREIGN KEY(player_id,slot) ____ saves(player_id,slot));`, 'REFERENCES', ['USING','PRIMARY KEY'], '複合外部キーは列の個数と対応順を合わせ、参照先に主キーまたは一意制約を用意する。'],
  ['junction-table','多対多の関係を集める','JOINで中間表membershipsを通り、プレイヤーの所属チーム名を読む。',`-- Traverse the membership relation instead of storing a list in a cell.
CREATE TABLE players(id INTEGER PRIMARY KEY,name TEXT);
CREATE TABLE teams(id INTEGER PRIMARY KEY,name TEXT);
CREATE TABLE memberships(player_id INTEGER,team_id INTEGER,PRIMARY KEY(player_id,team_id));
SELECT p.name,t.name FROM players p JOIN memberships m ON m.player_id=p.id
____ teams t ON t.id=m.team_id;`, 'JOIN', ['UNION','GROUP BY'], '多対多の組を別の表へ置くと、各参照に制約を付けたり、結合で一覧を求めたりできる。SQLiteではCROSS JOINにもON条件を書けるため、この問い合わせでは同じ所属を取り出せる。'],
  ['distinct-related-count','結合後の人数を数える','COUNT(DISTINCT ...)で、複数スコアがあるプレイヤーを重複して数えない。',`-- Count unique players after joining one-to-many rows.
CREATE TABLE players(id INTEGER PRIMARY KEY);
CREATE TABLE scores(player_id INTEGER,score INTEGER);
SELECT COUNT(____ p.id) FROM players p JOIN scores s ON s.player_id=p.id;`, 'DISTINCT', ['ALL','UNIQUE'], '結合によって親が複数行になった場合、親の件数を数えるには重複を除く必要がある。'],
  ['preaggregate-child','集計の重複を防ぐ','先に子表をplayer_idでGROUP BYし、親との結合前に1人1行へまとめる。',`-- Reduce child rows before joining them to player data.
CREATE TABLE players(id INTEGER PRIMARY KEY,name TEXT);
CREATE TABLE rewards(player_id INTEGER,coins INTEGER);
WITH totals AS (SELECT player_id,SUM(coins) AS coins FROM rewards ____ player_id)
SELECT p.name,coalesce(t.coins,0) FROM players p LEFT JOIN totals t ON t.player_id=p.id;`, 'GROUP BY', ['ORDER BY','PARTITION BY'], '必要な粒度まで先に集約すると、別の1対多関係と結んだときの掛け算状の行増加を避けやすい。'],
  ['latest-record-per-player','各人の最新記録','PARTITION BYでプレイヤーごとに区切り、row_numberで最新記録を1行選ぶ。',`-- Rank timestamps separately for each player.
${SCORE_DATA}
WITH ordered AS (SELECT *,row_number() OVER (____ player ORDER BY played_at DESC) AS n FROM scores)
SELECT player,score FROM ordered WHERE n=1;`, 'PARTITION BY', ['GROUP BY','ORDER BY'], 'ウィンドウのPARTITION BYは計算範囲を分ける。集約のGROUP BYのように行を消さない。'],
  ['rank-ties','同点を含む累積割合','cume_distを使い、現在の値以下に含まれる行の割合を求める。同点は同じ累積割合にする。',`-- Count tied values together in the cumulative distribution.
${SCORE_DATA}
SELECT player,____() OVER (ORDER BY score) AS cumulative_fraction FROM scores;`, 'cume_dist', ['row_number','percent_rank'], 'cume_distは現在の値以下に含まれる行数を区分全体の行数で割る。同点は同じ値になり、percent_rankの計算式とは異なる。'],
  ['recursive-tree','階層をたどる','WITH RECURSIVEで親子関係をたどり、ルートから全ノードを列挙する。',`-- Extend the result from each parent to its children.
${TREE_DATA}
WITH ____ tree(id,name) AS (
SELECT id,name FROM nodes WHERE parent_id IS NULL
UNION ALL SELECT n.id,n.name FROM nodes n JOIN tree t ON n.parent_id=t.id)
SELECT name FROM tree;`, 'RECURSIVE', ['ITERATIVE','MATERIALIZED'], '再帰CTEは初期行と、その結果を使う再帰部分からなる。循環があるデータには停止条件も必要。'],
  ['recursive-path','階層の経路を組み立てる','文字列連結||で、再帰CTEの親の経路へ子の名前を足す。',`-- Build each path while walking the hierarchy.
${TREE_DATA}
WITH RECURSIVE tree(id,path) AS (
SELECT id,name FROM nodes WHERE parent_id IS NULL
UNION ALL SELECT n.id,t.path ____ '/' || n.name FROM nodes n JOIN tree t ON n.parent_id=t.id)
SELECT path FROM tree;`, '||', ['+','OR'], 'SQLiteの文字列連結は||。+は数値演算として扱われる。'],
  ['generated-column','派生値を一か所で定義する','生成列として合計価格の式を定義し、元の列から計算する。',`-- Derive the total instead of asking every writer to maintain it.
CREATE TABLE lines(quantity INTEGER,price INTEGER,
total INTEGER ____ (quantity * price) VIRTUAL);
INSERT INTO lines(quantity,price) VALUES (2,30);
SELECT total FROM lines;`, 'GENERATED ALWAYS AS', ['DEFAULT','CHECK'], '生成列は元の列の式から値を求める。SQLiteではGENERATED ALWAYSを省いてASと書くこともできる。書き込み側が合計を別に更新する必要を減らせる。'],
  ['json-array-normalization','配列要素を行にする','json_eachでJSON配列を行へ展開し、各要素を問い合わせる。',`-- Turn array elements into relational rows for this import.
SELECT value FROM ____('[' || '"key","map"' || ']');`, 'json_each', ['json_extract','json_array'], 'json_eachは表値関数。永続的な関係の格納には、外部キーを持つ通常の子表も検討する。'],
  ['relational-division','すべての条件を満たす','二重のNOT EXISTSで、必須品目を1つも欠かさず持つプレイヤーを選ぶ。',`-- Reject a player when any required item is missing.
CREATE TABLE players(id INTEGER PRIMARY KEY);
CREATE TABLE required(item TEXT PRIMARY KEY);
CREATE TABLE inventory(player_id INTEGER,item TEXT);
SELECT p.id FROM players p WHERE NOT EXISTS (
SELECT 1 FROM required r WHERE ____ (
SELECT 1 FROM inventory i WHERE i.player_id=p.id AND i.item=r.item));`, 'NOT EXISTS', ['EXISTS','NOT IN'], '「欠けている必須要素が存在しない」と表現すると、全条件を満たす関係を検査できる。'],
  ['orphan-cleanup','参照されない行を消す','NOT EXISTSを使い、どのセーブからも参照されていない素材だけを削除する。',`-- Delete only assets which have no referencing save.
CREATE TABLE assets(id INTEGER PRIMARY KEY);
CREATE TABLE save_assets(save_id INTEGER,asset_id INTEGER);
DELETE FROM assets WHERE ____ (SELECT 1 FROM save_assets s WHERE s.asset_id=assets.id);`, 'NOT EXISTS', ['EXISTS','ALL'], '削除対象との相関を明示し、参照がある素材を残す。外部キー制約は別途整備する。'],
  ['null-aggregate-empty-group','関連0件を0と数える','LEFT JOINした子の主キーをCOUNTへ渡し、関連のない親を0件と数える。',`-- Do not count the null placeholder row of an outer join.
${PLAYER_DATA}
SELECT t.name,COUNT(____) FROM teams t LEFT JOIN players p ON p.team_id=t.id GROUP BY t.id;`, 'p.id', ['*','t.id'], 'COUNT(*)は外部結合のNULL補完行も数える。非NULLの子主キーを数えると0件を表現できる。'],
  ['filter-one-aggregate','集計ごとの条件','FILTER句で回復品だけの在庫を合計し、別の集計とは条件を分ける。',`-- Apply a condition to one aggregate without filtering all rows.
${ITEM_DATA}
SELECT SUM(stock) ____ (WHERE category='heal') AS healing_stock,COUNT(*) AS all_items FROM items;`, 'FILTER', ['HAVING','CASE'], 'FILTER (WHERE ...)は対象の集約だけへ条件を適用する。問い合わせ全体のWHEREとは異なる。']
]);
const sqlGraphics = questions('sql', 'graphics', [
  ['integer-label','整数ラベルを作る','printfの%dで在庫を10進整数としてラベルへ埋め込む。',`-- Format an integer for the inventory label.
${ITEM_DATA}
SELECT printf('Stock: ____',stock) FROM items;`, '%d', ['%f','%x'], '%dは10進整数。表示用の整形は保存する数量の型とは分けて考える。'],
  ['fixed-decimal','小数の桁をそろえる','printfの%.1fで表示用の座標を小数1桁にそろえる。',`-- Format one decimal place without changing stored coordinates.
${FRAME_DATA}
SELECT printf('____',x) FROM frames;`, '%.1f', ['%d','%.0f'], 'printfで表示だけを整形すれば、元の数値の精度を失わずに済む。'],
  ['text-concat','ラベルと名前をつなぐ','SQLiteの||で文字列をつなぎ、品目名の前へ表示ラベルを付ける。',`-- Prefix item names with their display label.
${ITEM_DATA}
SELECT 'Item: ' ____ name FROM items;`, '||', ['+','AND'], 'SQLiteでは||が文字列連結。+で連結しようとすると数値変換が行われる。'],
  ['missing-score-label','未記録を文字で示す','coalesceでスコアのNULLをunrankedという表示へ置き換える。',`-- Distinguish missing scores from a recorded zero.
${SCORE_DATA}
SELECT player,____(CAST(score AS TEXT),'unranked') FROM scores;`, 'coalesce', ['nullif','count'], '数値を文字列へ変換してからNULLだけを置換し、0点という記録と区別する。'],
  ['short-name','表示用の略称','substrで名前の先頭2文字を取り出す。SQLiteの位置は1始まり。',`-- Take the first two characters for a compact label.
${ITEM_DATA}
SELECT ____(name,1,2) FROM items;`, 'substr', ['replace','length'], 'substr(text,start,length)で部分文字列を取る。文字列の位置は1から始まる。'],
  ['character-count','ラベルの長さ','lengthを使い、UTF-8文字列を文字単位で数える。',`-- Count text characters rather than blob bytes.
SELECT ____('Aあ') AS characters;`, 'length', ['hex','unicode'], 'TEXTに対するlengthは文字数。書記素クラスタ単位の表示幅を計算する関数ではない。'],
  ['replace-display-separator','区切りを整える','replaceで内部IDのアンダースコアを表示用の空白へ置き換える。',`-- Replace the internal separator for display.
SELECT ____('forest_gate','_',' ') AS label;`, 'replace', ['substr','trim'], 'replaceは一致した部分文字列を置換する。trimは両端から文字を除く処理。'],
  ['padded-counter','カウンターを0埋めする','printfの%03dで、整数の表示幅を3桁として0埋めする。',`-- Display a fixed-width stage counter.
SELECT printf('____',7) AS stage_label;`, '%03d', ['%3d','%.3f'], '%03dは整数を最低3桁で0埋めする。%3dでは空白で埋める。'],
  ['packed-rgb-value','RGBを整数にまとめる','ビットORで、位置をずらした色チャンネルを組み合わせる。',`-- Pack three non-overlapping color bytes.
SELECT (51 << 16) ____ (102 << 8) | 204 AS rgb;`, '|', ['&','||'], 'ビットORの|と、文字列連結の||は別の演算子。'],
  ['blue-byte-mask','青チャンネルだけ読む','ビットANDで下位8bitを取り出す。',`-- Isolate the blue component of a packed RGB value.
SELECT 0x3366CC ____ 255 AS blue;`, '&', ['|','>>'], '255は下位8bitが1のマスク。ANDでその位置だけを残す。'],
  ['clamp-opacity','不透明度を範囲へ収める','2引数のminで上限1を設け、すでにあるmaxによる下限0と組み合わせる。',`-- Clamp opacity to the inclusive zero-to-one range.
SELECT ____(1.0,max(0.0,1.4)) AS opacity;`, 'min', ['max','abs'], 'SQLiteのmin(a,b)はスカラー関数として使える。min(column)という集約とは引数の数が違う。'],
  ['floating-progress','割合の小数を保つ','1.0を掛けて実数演算にし、整数除算で進捗が0になることを防ぐ。',`-- Keep the fractional part of the progress ratio.
SELECT 3 * ____ / 8 AS progress;`, '1.0', ['1','0'], 'SQLiteでは両辺が整数の除算は整数になる。実数を式に含めると小数部分を保持できる。'],
  ['conditional-color','状態ごとの色','CASEのELSEを補い、閾値以下の体力にはwarning色を選ぶ。',`-- Choose a warning color for low health.
SELECT CASE WHEN 15 > 30 THEN 'green' ____ 'red' END AS color;`, 'ELSE', ['OTHERWISE','OR'], 'CASEのいずれのWHENにも当てはまらない値はELSEで指定する。'],
  ['histogram-bucket','表示用の階級に分ける','整数除算で10点刻みの階級番号を作り、GROUP BYで度数を数える。',`-- Group scores into ten-point histogram buckets.
${SCORE_DATA}
SELECT score ____ 10 AS bucket,COUNT(*) FROM scores WHERE score IS NOT NULL GROUP BY bucket;`, '/', ['%','*'], 'この式は整数同士なのでSQLiteの整数除算になる。剰余では階級内の端数になってしまう。'],
  ['literal-like-wildcard','記号を検索語にする','ESCAPE句を使い、_を任意の1文字ではなくリテラルとして探す。',`-- Treat the underscore as a literal character.
SELECT 'rate_bonus' LIKE 'rate!_%' ____ '!';`, 'ESCAPE', ['GLOB','AS'], 'LIKEのワイルドカードの直前にエスケープ文字を置き、その文字をESCAPE句で指定する。'],
  ['deterministic-menu-order','同じ値の順も決める','ORDER BYの第2キーにnameを置き、同価格品のメニュー順も一定にする。',`-- Break equal-price ties with the item name.
${ITEM_DATA}
SELECT name,price FROM items ORDER BY price,____;`, 'name', ['price','stock DESC'], '同値時の並びを必要なキーで明示する。1列のORDER BYだけでは同値の順は決まらない。'],
  ['competition-rank','競技順位を表示する','rankで同点を同順位にし、後続順位には同点人数ぶんの空きを作る。',`-- Show competition ranks for tied scores.
${SCORE_DATA}
SELECT player,____() OVER (ORDER BY score DESC) AS place FROM scores;`, 'rank', ['row_number','dense_rank'], 'rankは1,1,3型の競技順位。どの同点規則を採用するかはUIの仕様として決める。'],
  ['dense-rank','順位の番号を詰める','dense_rankで同点を同順位にし、次の異なる得点を連続する順位にする。',`-- Keep ranking numbers consecutive across score groups.
${SCORE_DATA}
SELECT player,____() OVER (ORDER BY score DESC) AS place FROM scores;`, 'dense_rank', ['rank','row_number'], 'dense_rankは1,1,2型。順位の数は異なる得点グループの数に対応する。'],
  ['partitioned-ranking','チーム別のランキング','PARTITION BYでチームごとに連番を振り直す。',`-- Restart the leaderboard numbering inside each team.
${SCORE_DATA}
SELECT player,row_number() OVER (____ team ORDER BY score DESC,player) FROM scores;`, 'PARTITION BY', ['GROUP BY','HAVING'], 'ウィンドウの区分ごとに計算を独立させる。表示行自体はそのまま残る。'],
  ['preceding-frame-average','直近の移動平均','ROWS BETWEEN 1 PRECEDING AND CURRENT ROWで、現在と直前1行の位置を平均する。',`-- Average the current sample and its previous row.
${FRAME_DATA}
SELECT tick,AVG(x) OVER (ORDER BY tick ROWS BETWEEN 1 ____ AND CURRENT ROW) FROM frames;`, 'PRECEDING', ['FOLLOWING','AFTER'], 'PRECEDINGは前の行。ROWSの枠は時間差ではなく、並べた行の数で指定される。'],
  ['cumulative-total','累積値を描画する','UNBOUNDED PRECEDINGからCURRENT ROWまでを指定し、時刻順の累計を得る。',`-- Accumulate all values from the start through this row.
${FRAME_DATA}
SELECT tick,SUM(x) OVER (ORDER BY tick ROWS BETWEEN ____ PRECEDING AND CURRENT ROW) FROM frames;`, 'UNBOUNDED', ['1','CURRENT'], 'UNBOUNDED PRECEDINGは区分の先頭までを枠へ含める。'],
  ['previous-sample','直前の座標を参照する','lagで直前行の座標を読み、現在との差を計算する。',`-- Compare the current sample with the previous sample.
${FRAME_DATA}
SELECT tick,x - ____(x) OVER (ORDER BY tick) AS delta_x FROM frames;`, 'lag', ['lead','first_value'], 'lagは指定順の前の行を参照する。先頭では既定でNULLになる。'],
  ['next-sample','次の時刻を参照する','leadで次のサンプル時刻を読み、次の変化までの間隔を得る。',`-- Measure the interval until the next stored frame.
${FRAME_DATA}
SELECT tick,____(tick) OVER (ORDER BY tick)-tick AS duration FROM frames;`, 'lead', ['lag','last_value'], 'leadは後ろの行を参照する。末尾の次の行がなければ既定でNULL。'],
  ['quartile-groups','分布を4群にする','ntileで表示行を得点順に4群へ分け、分布の区分を付ける。',`-- Divide the ordered rows into four balanced groups.
${SCORE_DATA}
SELECT player,____(4) OVER (ORDER BY score,player) AS quartile FROM scores;`, 'ntile', ['rank','percent_rank'], 'ntile(n)は行数がなるべく近いn個のグループを作る。値の幅を等分する機能ではない。'],
  ['ordered-text-list','順番付きの一覧文字列','サブクエリで名前順に並べてからgroup_concatし、表示用の一覧を作る。',`-- Join names after defining their display order.
${ITEM_DATA}
SELECT ____(name,', ') FROM (SELECT name FROM items ORDER BY name);`, 'group_concat', ['json_array','count'], 'group_concatは複数行の文字列をまとめる。順序に意味がある場合は、その順序も定義する。'],
  ['json-render-data','描画データをJSONへ','json_group_arrayで、各行のJSON配列を1つの表示データ配列へまとめる。',`-- Aggregate ordered render rows into one JSON array.
${FRAME_DATA}
SELECT ____(json_array(tick,x,label)) FROM (SELECT * FROM frames ORDER BY tick);`, 'json_group_array', ['json_array_length','json_extract'], 'json_arrayは1行の要素を組み、json_group_arrayは複数行を集約する。'],
  ['hex-rgb-label','HTML風の色表記','printfの%02Xを3回指定し、RGBを#RRGGBB形式へ整形する。',`-- Format each color byte in uppercase hexadecimal.
SELECT printf('#____',51,102,204) AS color;`, '%02X%02X%02X', ['%d%d%d','%02X'], 'チャンネルごとに2桁で0埋めするので、各成分の境界を保持できる。'],
  ['exclude-current-sample','自分を除いた平均','EXCLUDE CURRENT ROWを指定し、近傍の平均から現在のサンプルを除く。',`-- Compare a sample against its neighbors, excluding itself.
${FRAME_DATA}
SELECT tick,AVG(x) OVER (ORDER BY tick ROWS BETWEEN 1 PRECEDING AND 1 FOLLOWING ____ CURRENT ROW) FROM frames;`, 'EXCLUDE', ['EXCEPT','WITHOUT'], 'ウィンドウ枠のEXCLUDE CURRENT ROWは、自分の行だけを集計対象から外す。'],
  ['time-range-window','時間幅で平滑化する','RANGEを使い、直前10tick以内という値の幅で集計する。',`-- Smooth samples by time distance rather than row count.
${FRAME_DATA}
SELECT tick,AVG(x) OVER (ORDER BY tick ____ BETWEEN 10 PRECEDING AND CURRENT ROW) FROM frames;`, 'RANGE', ['ROWS','GROUP BY'], 'RANGEはORDER BYの値に基づく枠。ROWSなら間隔の空いたサンプルも単なる行数として数える。'],
  ['generated-frame-grid','欠けたコマの時刻を作る','再帰CTEのUNION ALLで次の時刻を生成し、固定間隔の表示グリッドを作る。',`-- Generate the expected timeline before joining observations.
WITH RECURSIVE ticks(tick) AS (
SELECT 0 ____ SELECT tick+10 FROM ticks WHERE tick<30)
SELECT tick FROM ticks;`, 'UNION ALL', ['JOIN','INTERSECT'], '再帰部分の生成値を初期行へ追加する。停止条件がなければ終わらない。'],
  ['first-in-entire-partition','全体の最終値を読む','LAST_VALUEの枠をUNBOUNDED FOLLOWINGまで広げ、各行で区分全体の最終座標を得る。',`-- Extend the window through the final frame.
${FRAME_DATA}
SELECT tick,last_value(x) OVER (ORDER BY tick ROWS BETWEEN UNBOUNDED PRECEDING AND ____ FOLLOWING) FROM frames;`, 'UNBOUNDED', ['CURRENT','0'], '既定の枠では現在行付近までが対象になることがある。最後の値が必要なら枠の終端を明示する。'],
  ['consecutive-status-islands','連続する状態をまとめる','状態の変化をlagで検出する際、IS NOTを使ってNULLも比較可能にする。',`-- Detect transitions with a null-safe comparison.
CREATE TABLE states(tick INTEGER,label TEXT);
INSERT INTO states VALUES (0,'idle'),(1,'idle'),(2,'run');
SELECT tick,label ____ lag(label) OVER (ORDER BY tick) AS starts_segment FROM states;`, 'IS NOT', ['!=','IS'], 'IS NOTはNULLを含む比較でも真偽を返す。通常の!=では先頭のNULL比較がNULLになる。']
]);
const sqlSystems = questions('sql', 'systems', [
  ['transaction-commit','変更をまとめて確定する','トランザクションの変更を確定する文を入力する。',`-- Commit both balance updates as one unit.
CREATE TABLE balances(id INTEGER PRIMARY KEY,coins INTEGER);
INSERT INTO balances VALUES (1,10),(2,0);
BEGIN;
UPDATE balances SET coins=coins-3 WHERE id=1;
UPDATE balances SET coins=coins+3 WHERE id=2;
____;`, 'COMMIT', ['ROLLBACK','SAVEPOINT'], 'BEGINからの変更をCOMMITで確定する。SQLiteのENDも同じ意味で、どちらも末尾のTRANSACTIONは省略できる。途中の更新だけを外へ見せる設計を避けられる。'],
  ['transaction-rollback','変更を取り消す','ROLLBACKで、まだ確定していない更新を取り消す。',`-- Discard the tentative balance change.
CREATE TABLE balances(coins INTEGER);
INSERT INTO balances VALUES (10);
BEGIN;
UPDATE balances SET coins=0;
____;`, 'ROLLBACK', ['COMMIT','END'], 'ROLLBACKは現在のトランザクションの未確定変更を取り消す。ENDはSQLiteではCOMMIT相当。'],
  ['savepoint-create','途中の復帰地点','SAVEPOINTで、トランザクション内に名前付きの復帰地点を作る。',`-- Mark a local recovery point inside the transaction.
BEGIN;
____ optional_reward;
RELEASE optional_reward;
COMMIT;`, 'SAVEPOINT', ['BEGIN','CHECKPOINT'], 'SAVEPOINTは入れ子の作業単位に使える。BEGINを入れ子にすることはできない。'],
  ['savepoint-release','復帰地点を閉じる','RELEASEで保存点を解除し、外側のトランザクションを継続する。',`-- Merge the local scope into its surrounding transaction.
BEGIN;
SAVEPOINT optional_reward;
____ optional_reward;
COMMIT;`, 'RELEASE', ['COMMIT','DROP'], 'RELEASEは指定した保存点を閉じる。外側のBEGINがあれば、そのトランザクション自体は続く。'],
  ['create-index','検索用の索引','CREATE INDEXで、player_idによる検索を助ける索引を定義する。',`-- Add an index for lookups by player identity.
CREATE TABLE saves(id INTEGER PRIMARY KEY,player_id INTEGER);
CREATE ____ saves_player ON saves(player_id);`, 'INDEX', ['VIEW','TRIGGER'], '索引は検索を助ける一方、保存領域と更新時の維持コストを使う。'],
  ['drop-index','不要な索引を外す','DROP INDEXで、使わなくなった索引だけを削除する。',`-- Remove the index while preserving its table and rows.
CREATE TABLE saves(player_id INTEGER);
CREATE INDEX old_lookup ON saves(player_id);
DROP ____ old_lookup;`, 'INDEX', ['TABLE','COLUMN'], 'DROP INDEXは索引を削除する。テーブル本体や保存行は削除しない。'],
  ['foreign-keys-on','参照制約を有効にする','SQLiteのforeign_keysを有効にし、この接続で外部キーを検査する。',`-- Enforce foreign keys for this database connection.
PRAGMA foreign_keys = ____;`, 'ON', ['OFF','NULL'], '有効化にはON、1、TRUE、YESを使える。SQLiteでは接続ごとの設定を確認する。トランザクション中の切り替えは有効にならない。'],
  ['integrity-check','DBの整合性を調べる','PRAGMA integrity_checkで、DBファイル内部の整合性を診断する。',`-- Check the database structure for corruption.
PRAGMA ____;`, 'integrity_check', ['foreign_keys','user_version'], 'integrity_checkは内部構造や索引などを検査する。外部キー違反の調査にはforeign_key_checkを使う。'],
  ['unique-index','索引で一意性を守る','UNIQUE INDEXを使い、重複しない外部IDを保証する。',`-- Prevent duplicate external account identifiers.
CREATE TABLE accounts(id INTEGER PRIMARY KEY,external_id TEXT NOT NULL);
CREATE ____ INDEX accounts_external ON accounts(external_id);`, 'UNIQUE', ['DISTINCT','PRIMARY'], 'UNIQUE索引は検索だけでなく一意性も検査する。NULLを認めるかは列制約でも決める。'],
  ['partial-index','必要な行だけ索引化する','WHERE句で未処理ジョブだけを部分索引へ含める。',`-- Index only jobs which still need processing.
CREATE TABLE jobs(id INTEGER PRIMARY KEY,done INTEGER,priority INTEGER);
CREATE INDEX pending_jobs ON jobs(priority) ____ done=0;`, 'WHERE', ['HAVING','FILTER'], '部分索引は条件を満たす行だけを格納する。問い合わせ側の条件と対応するかも確認する。'],
  ['expression-index','検索式を索引化する','lower(name)の式に索引を作り、同じ式を使う名前検索へ備える。',`-- Index the normalized expression used by the lookup.
CREATE TABLE players(name TEXT);
CREATE INDEX players_folded ON players(____);
SELECT name FROM players WHERE lower(name)='ada';`, 'lower(name)', ['name','upper(name)'], '式索引は問い合わせで使う式と対応させる。別の正規化式の索引が自動で代用されるとは限らない。'],
  ['explain-query-plan','計画を確認する','EXPLAIN QUERY PLANで、SQLを実行して結果を変更せず検索計画を読む。',`-- Inspect how SQLite intends to find matching rows.
${ITEM_DATA}
____ SELECT name FROM items WHERE id=2;`, 'EXPLAIN QUERY PLAN', ['ANALYZE','DESCRIBE'], '計画を見て検索・走査や索引利用を調べる。実際の所要時間の計測とは別。'],
  ['analyze-statistics','統計を更新する','ANALYZEで、問い合わせ計画の選択に使う統計を収集する。',`-- Collect planner statistics for this table and its indexes.
${ITEM_DATA}
CREATE INDEX items_category ON items(category);
____ items;`, 'ANALYZE', ['EXPLAIN','VACUUM'], 'ANALYZEはデータ分布の統計を保存する。VACUUMは主にファイルの再構築。'],
  ['upsert-conflict','重複時だけ更新する','ON CONFLICTでIDの重複を指定し、既存行のスコアを更新する。',`-- Update the existing identity instead of inserting a duplicate.
CREATE TABLE scores(id INTEGER PRIMARY KEY,score INTEGER);
INSERT INTO scores VALUES (1,10);
INSERT INTO scores VALUES (1,20) ____ (id) DO UPDATE SET score=excluded.score;`, 'ON CONFLICT', ['ON DUPLICATE','WHERE'], 'SQLiteのUPSERTでは、衝突する一意制約をON CONFLICTで指定する。'],
  ['insert-ignore','重複する登録を飛ばす','INSERT OR IGNOREを使い、すでにある主キーの行を追加せずに残す。',`-- Leave an already registered identifier unchanged.
CREATE TABLE seen(id INTEGER PRIMARY KEY);
INSERT INTO seen VALUES (1);
INSERT OR ____ INTO seen VALUES (1);`, 'IGNORE', ['REPLACE','UPDATE'], 'IGNOREは制約違反になる行を飛ばす。REPLACEは既存行の削除を伴う場合があり、同じ意味ではない。'],
  ['returning-updated-row','更新結果を受け取る','RETURNINGで更新直後の列を返し、別のSELECTを挟まず結果を確認する。',`-- Return the row values produced by the update.
CREATE TABLE players(id INTEGER PRIMARY KEY,coins INTEGER);
INSERT INTO players VALUES (1,10);
UPDATE players SET coins=coins+5 WHERE id=1 ____ id,coins;`, 'RETURNING', ['SELECT','OUTPUT'], 'SQLiteのRETURNINGは変更した行の値を返す。別SQLの再検索と競合する隙間を減らせる。'],
  ['immediate-write-transaction','書き込みを先に確保する','BEGIN IMMEDIATEで書き込みトランザクションを開始する。',`-- Attempt to acquire the write transaction before doing work.
BEGIN ____;
CREATE TABLE checkpoints(id INTEGER);
COMMIT;`, 'IMMEDIATE', ['DEFERRED','READ ONLY'], 'IMMEDIATEは開始時に書き込みトランザクションを確保しようとする。競合時の待機・失敗への対処も必要。'],
  ['rollback-to-savepoint','一部分だけ戻す','ROLLBACK TOで保存点以降だけを取り消し、外側の変更を残す。',`-- Undo the optional part without discarding the outer transaction.
CREATE TABLE rewards(coins INTEGER);
BEGIN;
INSERT INTO rewards VALUES (1);
SAVEPOINT bonus;
INSERT INTO rewards VALUES (100);
____ bonus;
RELEASE bonus;
COMMIT;`, 'ROLLBACK TO', ['ROLLBACK','RELEASE'], 'ROLLBACK TOは保存点を残したまま、それ以降の変更を取り消す。必要に応じてRELEASEで閉じる。'],
  ['cascade-delete','従属する行を消す','ON DELETE CASCADEで、親セーブの削除時に従属するスロット行も削除する。',`-- Remove dependent slots when their owning save is deleted.
PRAGMA foreign_keys=ON;
CREATE TABLE saves(id INTEGER PRIMARY KEY);
CREATE TABLE slots(save_id INTEGER REFERENCES saves(id) ON DELETE ____);`, 'CASCADE', ['RESTRICT','SET NULL'], 'CASCADEは参照する子行も削除する。子を保持するなら別の参照方針を選ぶ。'],
  ['strict-table','格納型を制限する','STRICTを指定し、SQLiteの通常表より厳格な格納型の検査を使う。',`-- Require values compatible with the declared storage types.
CREATE TABLE settings(name TEXT PRIMARY KEY,value INTEGER) ____;`, 'STRICT', ['TYPED','WITHOUT NULL'], 'STRICT表では使用できる型名と型変換が制限される。列名の見た目だけで型を保証しない。'],
  ['without-rowid','複合主キーで格納する','WITHOUT ROWIDで、複合主キーを中心とした表にする。',`-- Use the composite key as the table's storage identity.
CREATE TABLE chunks(world_id INTEGER,x INTEGER,y INTEGER,
PRIMARY KEY(world_id,x,y)) ____;`, 'WITHOUT ROWID', ['WITHOUT INDEX','NO ROWID'], 'WITHOUT ROWID表には主キーが必要。通常表のrowidとは異なる格納方式になる。'],
  ['rename-column','列名を移行する','ALTER TABLEで、既存列の名前を変更する節を入力する。',`-- Rename the stored field without rebuilding it by hand.
CREATE TABLE saves(id INTEGER PRIMARY KEY,old_title TEXT);
ALTER TABLE saves ____ old_title TO title;`, 'RENAME COLUMN', ['UPDATE COLUMN','AS'], '対応するSQLiteではRENAME COLUMNを使える。COLUMNは省略できる。依存する問い合わせやビューへの影響も確認する。'],
  ['attach-database','別DBを同じ接続で読む','ATTACHで一時的な別DBを接続し、cacheスキーマとして参照する。',`-- Attach an independent in-memory database under a schema name.
____ ':memory:' AS cache;
CREATE TABLE cache.entries(key TEXT PRIMARY KEY,value TEXT);`, 'ATTACH DATABASE', ['OPEN DATABASE','CREATE DATABASE'], 'ATTACHしたDBはschema.tableで参照する。同じ接続から扱えるが、主DBの表になるわけではない。'],
  ['schema-version','移行番号を記録する','user_versionへアプリ側のスキーマ移行番号を保存する。',`-- Record the application-managed schema migration version.
PRAGMA ____ = 2;`, 'user_version', ['schema_version','data_version'], 'user_versionはアプリが自由に管理する番号。SQLite内部のschema_versionを移行番号として書き換えない。'],
  ['deferred-foreign-key','確定時まで参照を待つ','DEFERRABLE INITIALLY DEFERREDで、同じトランザクション内の後から親を追加できるようにする。',`-- Validate the reference when the transaction commits.
PRAGMA foreign_keys=ON;
CREATE TABLE parents(id INTEGER PRIMARY KEY);
CREATE TABLE children(parent_id INTEGER REFERENCES parents(id) ____);
BEGIN;
INSERT INTO children VALUES (1);
INSERT INTO parents VALUES (1);
COMMIT;`, 'DEFERRABLE INITIALLY DEFERRED', ['NOT DEFERRABLE','INITIALLY IMMEDIATE'], '遅延外部キーはCOMMIT時に整合性を要求する。未解決の参照を確定できるわけではない。'],
  ['busy-timeout','競合の待ち時間','busy_timeoutを設定し、ロック競合時に待つ上限をミリ秒で指定する。',`-- Configure a bounded wait for a busy database.
PRAGMA ____ = 1500;`, 'busy_timeout', ['cache_size','page_size'], '待機時間を設けても競合が必ず解消するわけではない。失敗時の再試行や通知も設計する。'],
  ['foreign-key-audit','参照違反を調べる','foreign_key_checkで、保存済みデータの外部キー違反を列挙する。',`-- Audit references independently of the current enforcement setting.
CREATE TABLE parents(id INTEGER PRIMARY KEY);
CREATE TABLE children(parent_id INTEGER REFERENCES parents(id));
PRAGMA ____;`, 'foreign_key_check', ['integrity_check','foreign_keys'], 'foreign_key_checkは違反した子表・行・参照先などを返す。内部構造の整合性検査とは目的が異なる。'],
  ['covering-index','必要な列を索引へ含める','索引へplayer_idとscoreを含め、同じ検索に必要な列を索引だけで読める候補にする。',`-- Include both the lookup key and selected value in the index.
CREATE TABLE scores(player_id INTEGER,score INTEGER,notes TEXT);
CREATE INDEX scores_lookup ON scores(____);
EXPLAIN QUERY PLAN SELECT score FROM scores WHERE player_id=1;`, 'player_id,score', ['notes','score'], '検索キーと返す列が索引に含まれると、被覆索引として利用できる場合がある。計画も確認する。'],
  ['conditional-upsert','古い更新を拒否する','DO UPDATE側のWHEREで新しいrevisionだけを適用する。',`-- Prevent an older snapshot from overwriting a newer one.
CREATE TABLE snapshots(id INTEGER PRIMARY KEY,revision INTEGER,payload TEXT);
INSERT INTO snapshots VALUES (1,3,'new');
INSERT INTO snapshots VALUES (1,2,'old') ON CONFLICT(id) DO UPDATE
SET revision=excluded.revision,payload=excluded.payload ____ excluded.revision>snapshots.revision;`, 'WHERE', ['HAVING','ON'], 'UPSERTのDO UPDATEにもWHEREを置ける。対象の衝突を選ぶ条件と、更新の実施条件を分けられる。'],
  ['update-from-source','対応表から一括更新する','UPDATE FROMで報酬表を結び、プレイヤーごとの加算値を反映する。',`-- Apply one reward row to each matching player.
CREATE TABLE players(id INTEGER PRIMARY KEY,coins INTEGER);
CREATE TABLE rewards(player_id INTEGER PRIMARY KEY,amount INTEGER);
UPDATE players SET coins=coins+rewards.amount ____ rewards WHERE rewards.player_id=players.id;`, 'FROM', ['JOIN BY','USING'], 'UPDATE FROMでは更新先と供給元の対応を明示する。供給元が複数行になる曖昧な更新を避ける。'],
  ['bounded-batch-delete','小分けに削除する','IDの部分問い合わせへLIMITを置き、削除を古い順の2行へ限定する。',`-- Delete a deterministic batch without relying on optional DELETE LIMIT support.
CREATE TABLE logs(id INTEGER PRIMARY KEY,created_at INTEGER);
DELETE FROM logs WHERE id IN
(SELECT id FROM logs ORDER BY created_at,id ____ 2);`, 'LIMIT', ['TOP','FETCH'], 'SQLiteのDELETE LIMITはビルドオプションに依存するため、IDを選ぶ部分問い合わせで件数を制限する方法がある。'],
  ['optimize-planner','運用時の統計整備','PRAGMA optimizeを使い、SQLiteが必要と判断した統計整備を実行させる。',`-- Ask SQLite to perform useful planner-statistics maintenance.
${ITEM_DATA}
PRAGMA ____;`, 'optimize', ['shrink_memory','wal_checkpoint'], 'optimizeは問い合わせ計画の統計整備などを必要に応じて行う。メモリ解放やWALチェックポイントとは別。']
]);

// Later techniques point to concrete earlier concepts, with no circular links.
const LUA_PREREQUISITES = {
  'syntax/elseif-branch':['syntax/if-then'],
  'syntax/while-do':['syntax/if-then'],
  'syntax/repeat-until':['syntax/while-do'],
  'syntax/numeric-for-step':['syntax/local-binding'],
  'syntax/sequence-iteration':['syntax/numeric-for-step'],
  'syntax/map-iteration':['syntax/sequence-iteration'],
  'syntax/floor-division':['syntax/remainder'],
  'syntax/dynamic-table-key':['syntax/named-table-field'],
  'syntax/table-append':['syntax/length-operator'],
  'syntax/multiple-assignment':['syntax/local-binding'],
  'syntax/variadic-arguments':['syntax/function-return'],
  'syntax/parenthesized-return':['syntax/function-return','syntax/multiple-assignment'],
  'syntax/method-call-colon':['syntax/function-return','design/constructor-fresh-table'],
  'syntax/logical-not':['syntax/boolean-value'],
  'syntax/constant-local':['syntax/local-binding'],
  'syntax/goto-label':['syntax/lexical-block'],
  'syntax/false-preserving-default':['syntax/nil-value','syntax/boolean-value'],
  'design/closure-counter':['design/private-state','syntax/function-return'],
  'design/higher-order-filter':['design/dependency-function','syntax/sequence-iteration'],
  'design/metatable-index':['design/constructor-fresh-table','syntax/function-return'],
  'design/metatable-newindex':['design/metatable-index'],
  'design/metatable-call':['design/metatable-index'],
  'design/metatable-string':['design/metatable-index'],
  'design/metatable-add':['design/metatable-index'],
  'design/protected-call':['syntax/function-return'],
  'design/error-handler':['design/protected-call'],
  'design/precondition-assert':['design/early-return'],
  'design/return-error-pair':['syntax/multiple-assignment','design/early-return'],
  'design/coroutine-create':['syntax/function-return'],
  'design/coroutine-resume':['design/coroutine-create'],
  'design/coroutine-yield':['design/coroutine-resume'],
  'design/coroutine-wrapper':['design/coroutine-yield'],
  'design/module-dependency':['design/module-export'],
  'design/raw-access':['design/metatable-index'],
  'design/raw-write':['design/metatable-newindex'],
  'design/isolated-environment':['design/module-dependency'],
  'design/closure-factory-isolation':['design/closure-counter'],
  'design/iterator-protocol':['syntax/sequence-iteration','syntax/multiple-assignment'],
  'design/packed-nil-results':['syntax/variadic-arguments','syntax/nil-value'],
  'design/close-resource':['design/metatable-index','syntax/lexical-block'],
  'design/coroutine-cleanup':['design/close-resource','design/coroutine-yield'],
  'graphics/linear-interpolation':['graphics/screen-offset'],
  'graphics/delta-time-motion':['graphics/screen-offset'],
  'graphics/draw-order-sort':['design/dependency-function'],
  'graphics/atlas-column':['graphics/frame-modulo'],
  'graphics/atlas-row':['syntax/floor-division'],
  'graphics/text-join':['syntax/string-concatenation'],
  'graphics/hex-color':['graphics/coordinate-format'],
  'graphics/packed-rgb':['syntax/bitwise-shift'],
  'graphics/unpack-channel':['graphics/packed-rgb'],
  'graphics/easing-curve':['graphics/linear-interpolation'],
  'graphics/point-in-rectangle':['syntax/if-then'],
  'graphics/sprite-flip':['graphics/position-components'],
  'graphics/sequence-frame-index':['graphics/frame-modulo','syntax/sequence-iteration'],
  'graphics/utf8-codepoint-iteration':['graphics/utf8-text-length'],
  'graphics/render-command-closure':['design/private-state'],
  'graphics/matrix-stack-pop':['syntax/table-append'],
  'graphics/stable-sort-tiebreak':['graphics/draw-order-sort'],
  'graphics/spatial-cell-key':['graphics/coordinate-format','syntax/string-concatenation'],
  'graphics/screen-wrap-negative':['graphics/frame-modulo'],
  'graphics/animation-state-coroutine':['design/coroutine-wrapper','graphics/frame-modulo'],
  'systems/bit-mask-enable':['systems/bit-mask-test'],
  'systems/bit-mask-disable':['systems/bit-mask-test'],
  'systems/bit-mask-toggle':['systems/bit-mask-test'],
  'systems/binary-unpack':['systems/binary-pack'],
  'systems/explicit-base':['systems/numeric-conversion'],
  'systems/input-pattern':['syntax/string-concatenation'],
  'systems/cache-expiration':['syntax/if-then'],
  'systems/retry-cap':['systems/integer-boundary'],
  'systems/head-index-queue':['systems/queue-head','syntax/nil-value'],
  'systems/ring-buffer-wrap':['syntax/remainder'],
  'systems/weak-value-cache':['design/metatable-index'],
  'systems/weak-key-metadata':['systems/weak-value-cache'],
  'systems/gc-memory-observation':['systems/type-inspection'],
  'systems/error-traceback':['design/error-handler'],
  'systems/instruction-hook':['design/dependency-function'],
  'systems/coroutine-failure-state':['design/coroutine-resume','design/protected-call'],
  'systems/to-close-error-path':['design/close-resource','design/protected-call'],
  'systems/module-reload-cache':['design/module-dependency'],
  'systems/packed-result-forwarding':['design/packed-nil-results'],
  'systems/plain-string-search':['systems/input-pattern'],
  'systems/bounded-load-mode':['design/isolated-environment'],
  'systems/close-file-guard':['design/close-resource']
};
const SQL_PREREQUISITES = {
  'syntax/and-condition':['syntax/where-filter'],
  'syntax/or-condition':['syntax/where-filter'],
  'syntax/membership-list':['syntax/where-filter'],
  'syntax/inclusive-range':['syntax/and-condition'],
  'syntax/like-prefix':['syntax/where-filter'],
  'syntax/glob-case-sensitive':['syntax/like-prefix'],
  'syntax/is-null':['syntax/null-literal'],
  'syntax/coalesce-default':['syntax/is-null'],
  'syntax/count-rows':['syntax/from-source','syntax/null-literal'],
  'syntax/sum-values':['syntax/count-rows'],
  'syntax/average-values':['syntax/sum-values'],
  'syntax/minimum-value':['syntax/sum-values'],
  'syntax/group-by-key':['syntax/sum-values'],
  'syntax/having-group-filter':['syntax/group-by-key'],
  'syntax/case-expression':['syntax/where-filter'],
  'syntax/nullif-divisor':['syntax/null-literal','syntax/coalesce-default'],
  'syntax/inner-join':['syntax/from-source','syntax/column-alias'],
  'syntax/left-join':['syntax/inner-join','syntax/is-null'],
  'syntax/union-all':['syntax/select-expression'],
  'syntax/intersection':['syntax/union-all'],
  'syntax/set-difference':['syntax/union-all'],
  'syntax/common-table-expression':['syntax/column-alias'],
  'syntax/row-number-window':['syntax/descending-order'],
  'syntax/exists-subquery':['syntax/where-filter'],
  'design/left-join-missing':['syntax/is-null','syntax/from-source'],
  'design/join-using':['syntax/from-source'],
  'design/multi-column-join':['syntax/and-condition','design/primary-key'],
  'design/correlated-exists':['syntax/where-filter'],
  'design/null-safe-antijoin':['design/correlated-exists','syntax/is-null'],
  'design/scalar-subquery':['syntax/average-values'],
  'design/derived-table':['syntax/column-alias'],
  'design/view-interface':['syntax/from-source'],
  'design/compound-uniqueness':['design/unique-name'],
  'design/cross-column-check':['design/check-invariant'],
  'design/composite-foreign-key':['design/foreign-key-reference','design/compound-uniqueness'],
  'design/junction-table':['design/foreign-key-reference','design/compound-uniqueness'],
  'design/distinct-related-count':['syntax/count-rows','syntax/distinct-values'],
  'design/preaggregate-child':['syntax/group-by-key','design/derived-table'],
  'design/latest-record-per-player':['syntax/descending-order','syntax/common-table-expression'],
  'design/rank-ties':['syntax/descending-order'],
  'design/recursive-tree':['syntax/common-table-expression','design/foreign-key-reference'],
  'design/recursive-path':['design/recursive-tree'],
  'design/generated-column':['design/column-default','design/check-invariant'],
  'design/json-array-normalization':['syntax/from-source'],
  'design/relational-division':['design/null-safe-antijoin'],
  'design/orphan-cleanup':['design/foreign-key-reference','design/null-safe-antijoin'],
  'design/null-aggregate-empty-group':['syntax/count-rows','design/left-join-missing'],
  'design/filter-one-aggregate':['syntax/group-by-key','syntax/where-filter'],
  'graphics/packed-rgb-value':['graphics/hex-rgb-label'],
  'graphics/blue-byte-mask':['graphics/packed-rgb-value'],
  'graphics/clamp-opacity':['syntax/minimum-value'],
  'graphics/floating-progress':['syntax/select-expression'],
  'graphics/conditional-color':['syntax/case-expression'],
  'graphics/histogram-bucket':['syntax/group-by-key'],
  'graphics/literal-like-wildcard':['syntax/like-prefix'],
  'graphics/deterministic-menu-order':['syntax/descending-order'],
  'graphics/competition-rank':['syntax/descending-order'],
  'graphics/dense-rank':['graphics/competition-rank'],
  'graphics/partitioned-ranking':['graphics/competition-rank'],
  'graphics/preceding-frame-average':['graphics/competition-rank','syntax/average-values'],
  'graphics/cumulative-total':['graphics/preceding-frame-average','syntax/sum-values'],
  'graphics/previous-sample':['graphics/competition-rank'],
  'graphics/next-sample':['graphics/previous-sample'],
  'graphics/quartile-groups':['graphics/competition-rank'],
  'graphics/ordered-text-list':['graphics/text-concat','syntax/descending-order'],
  'graphics/json-render-data':['graphics/ordered-text-list'],
  'graphics/hex-rgb-label':['graphics/integer-label'],
  'graphics/exclude-current-sample':['graphics/preceding-frame-average'],
  'graphics/time-range-window':['graphics/preceding-frame-average'],
  'graphics/generated-frame-grid':['design/recursive-tree'],
  'graphics/first-in-entire-partition':['graphics/preceding-frame-average'],
  'graphics/consecutive-status-islands':['graphics/previous-sample','syntax/is-null'],
  'systems/unique-index':['systems/create-index','design/unique-name'],
  'systems/partial-index':['systems/create-index','syntax/where-filter'],
  'systems/expression-index':['systems/create-index'],
  'systems/explain-query-plan':['systems/create-index'],
  'systems/analyze-statistics':['systems/explain-query-plan'],
  'systems/upsert-conflict':['design/primary-key','design/increment-update'],
  'systems/insert-ignore':['design/primary-key'],
  'systems/returning-updated-row':['design/increment-update'],
  'systems/immediate-write-transaction':['systems/transaction-commit'],
  'systems/rollback-to-savepoint':['systems/savepoint-create','systems/transaction-rollback'],
  'systems/cascade-delete':['design/foreign-key-reference','systems/foreign-keys-on'],
  'systems/strict-table':['design/not-null-contract'],
  'systems/without-rowid':['design/compound-uniqueness','design/primary-key'],
  'systems/rename-column':['design/explicit-insert-columns'],
  'systems/attach-database':['syntax/from-source'],
  'systems/schema-version':['systems/transaction-commit'],
  'systems/deferred-foreign-key':['design/foreign-key-reference','systems/transaction-commit'],
  'systems/busy-timeout':['systems/immediate-write-transaction'],
  'systems/foreign-key-audit':['systems/foreign-keys-on','systems/integrity-check'],
  'systems/covering-index':['systems/create-index','systems/explain-query-plan'],
  'systems/conditional-upsert':['systems/upsert-conflict'],
  'systems/update-from-source':['design/increment-update','syntax/inner-join'],
  'systems/bounded-batch-delete':['syntax/limit-results','syntax/descending-order'],
  'systems/optimize-planner':['systems/analyze-statistics']
};
function prerequisites(blocks, explicit, defaults) {
  for (const block of blocks) for (const q of block) {
    if (explicit[q.id]) q.prerequisites = explicit[q.id];
    else if (q.difficulty > 1) q.prerequisites = [defaults[q.subject]];
  }
}
prerequisites([luaSyntax,luaDesign,luaGraphics,luaSystems],LUA_PREREQUISITES,{
  syntax:'syntax/local-binding',design:'syntax/function-return',graphics:'graphics/position-components',systems:'systems/type-inspection'
});
prerequisites([sqlSyntax,sqlDesign,sqlGraphics,sqlSystems],SQL_PREREQUISITES,{
  syntax:'syntax/select-expression',design:'syntax/from-source',graphics:'graphics/integer-label',systems:'systems/create-index'
});

export const LUA_SKILL_QUIZZES = Object.freeze([...luaSyntax, ...luaDesign, ...luaGraphics, ...luaSystems]);
export const SQL_SKILL_QUIZZES = Object.freeze([...sqlSyntax, ...sqlDesign, ...sqlGraphics, ...sqlSystems]);
