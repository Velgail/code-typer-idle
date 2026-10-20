// Original, dependency-free exercises. Each row teaches a distinct technique;
// difficulty groups contain eight exercises, rather than numeric variants.
const GO_IMPORTS = {fmt:'fmt',strings:'strings',strconv:'strconv',utf8:'unicode/utf8',math:'math',sort:'sort',errors:'errors',context:'context',sync:'sync',atomic:'sync/atomic',io:'io',os:'os',filepath:'path/filepath',json:'encoding/json',binary:'encoding/binary',time:'time',bufio:'bufio',bytes:'bytes'};
// Curated equivalent spellings keep the lesson's technique intact. Arbitrary
// implementations are evaluated by Challenges, not by this completion bank.
const GO_ALTERNATIVES = {
  'syntax/rune-literal':["'\\x41'", "'\\u0041'", "'\\U00000041'"],
  'syntax/half-open-slice':['1:len(history)'],
  'syntax/map-comma-ok':['stock[`potion`]'],
  'syntax/full-slice-capacity':[':1:1'],
  'design/nil-guard':['nil == player'],
  'design/strategy-function':['scores[j] < scores[i]'],
  'design/closure-factory':['offset + value'],
  'design/generic-map':['make([]B, len(input), len(input))'],
  'design/validation-boundary':['0 > n'],
  'design/bounded-retry':['3 > attempt'],
  'design/owned-slice':['make([]byte, len(data), len(data))'],
  'graphics/vector-addition':['by + ay'],
  'graphics/opacity-scale':['100','100.','1e2','100e0'],
  'graphics/row-major-index':['x + y * width'],
  'graphics/rgba-array':['[4]byte'],
  'graphics/degrees-to-radians':['math.Pi / 180.0'],
  'graphics/linear-interpolation':['a + t * (b - a)'],
  'graphics/aabb-overlap':['bLeft < aRight && aLeft < bRight','bRight > aLeft && aRight > bLeft'],
  'graphics/point-half-open':['left <= x && x < right','x < right && x >= left','left <= x && right > x'],
  'graphics/camera-culling':['left >= viewRight || right <= viewLeft'],
  'graphics/premultiplied-color':['alpha * red'],
  'graphics/fixed-step-accumulator':['step <= accumulator'],
  'graphics/normalized-direction':['0 < length'],
  'systems/bounded-read':['1 + limit']
};
function goCode(body, answer, note, declarations='') {
  const text=body+'\n'+answer+'\n'+declarations;
  const imports=Object.entries(GO_IMPORTS).filter(([name])=>new RegExp('\\b'+name+'\\.').test(text)).map(([,path])=>JSON.stringify(path));
  return `package main\n${imports.length?'\nimport (\n'+imports.map(path=>'    '+path).join('\n')+'\n)\n':''}\n${declarations?declarations+'\n\n':''}func main() {\n    // ${note}\n${body.split('\n').map(line=>'    '+line).join('\n')}\n}\n`;
}
function goRows(subject, groups) {
  return groups.flatMap((rows, level)=>rows.map(([slug,title,prompt,body,answer,incorrect,explanation,note,declarations='',alternatives])=>({
    id:`${subject}/${slug}`,subject,concept:slug,title,difficulty:level+1,minutes:[0.75,1.5,2.5,4][level],
    prompt:`${title}。${prompt}`,code:goCode(body,answer,note,declarations),answer,incorrect,explanation,
    ...((alternatives || GO_ALTERNATIVES[`${subject}/${slug}`])?{alternatives:alternatives || GO_ALTERNATIVES[`${subject}/${slug}`]}:{})
  })));
}
const linkPrerequisites=(rows,links)=>rows.map(row=>links[row.id]?{...row,prerequisites:links[row.id]}:row);

const GO_SYNTAX = [
 [
  ['short-declaration','ローカル変数を作る','短い変数宣言を使い、scoreを整数の0で初期化してください。','score ____ 0\nfmt.Println(score)',':=',['=','=='],':=は新しいローカル変数を宣言し、右辺から型を推論します。単なる代入には先に宣言が必要です。','Start a new player with zero points.'],
  ['explicit-conversion','整数を実数へ変換する','型変換を使い、整数同士の除算になる前にdistanceをfloat64へ変換してください。','distance, seconds := 7, 2\nspeed := ____(distance) / float64(seconds)\nfmt.Println(speed)','float64',['int','string'],'Goの整数除算は小数部分を捨てます。除算の前に片方を実数へ変換します。','Compute a fractional speed before dividing.'],
  ['logical-and','参加条件を両方確認する','論理積の演算子で、接続中かつ準備完了のときだけtrueにしてください。','connected, ready := true, false\ncanStart := connected ____ ready\nfmt.Println(canStart)','&&',['||','&'],'&&は両条件がtrueのときだけtrueになります。&はブール値の論理演算には使えません。','Require both connection and readiness.'],
  ['string-concat','表示名に接頭辞を付ける','文字列の連結演算子で、nameの前にPlayer:を付けてください。','name := "Ada"\nlabel := "Player:" ____ name\nfmt.Println(label)','+',['*','&'],'Goの文字列は+で連結できます。元の文字列自体を書き換える操作ではありません。','Prefix the player name for a status label.'],
  ['slice-index','最初の装備を読む','ゼロ始まりの添字で、最初の要素を取り出してください。','equipment := []string{"torch", "rope"}\nfirst := equipment[____]\nfmt.Println(first)','0',['1','len(equipment)'],'添字0が最初の要素です。lenは要素数なので、そのまま添字にすると範囲外になります。','Read the first item without removing it.'],
  ['collection-length','残っている選択肢を数える','組み込み関数でchoicesの要素数を取得してください。','choices := []string{"left", "right", "wait"}\ncount := ____(choices)\nfmt.Println(count)','len',['cap','count'],'lenは現在の要素数です。capは追加可能な基盤配列の容量を表し、意味が異なります。','Count the currently available choices.'],
  ['typed-zero','型を指定してゼロ初期化する','var宣言の型位置にintを指定し、得点をゼロ値から始めてください。','var score ____\nscore += 1\nfmt.Println(score)','int',['nil','0'],'varに型だけを指定すると、その型のゼロ値で初期化されます。intのゼロ値は0です。','Let an integer score use its zero value.'],
  ['rune-literal','一文字をruneとして持つ','文字列ではなくruneリテラルで、大文字Aをmarkerへ代入してください。','marker := ____\nfmt.Printf("%c\\n", marker)',"'A'",['"A"','byte("A")'],'単一引用符はUnicodeコードポイントのruneリテラルです。二重引用符は文字列になります。','Store one character rather than a string.']
 ],
 [
  ['append-result','スライスへ新しい要素を追加する','appendの戻り値を元の変数へ代入してください。','events := []string{"spawn"}\nevents = ____(events, "move")\nfmt.Println(events)','append',['copy','make'],'appendは新しいスライス記述子を返します。容量拡張で基盤配列が変わるため、戻り値を保存します。','Keep the possibly reallocated event slice.'],
  ['half-open-slice','先頭の履歴を除く','半開区間のスライス式で、最初の要素を除いた範囲を取り出してください。','history := []string{"old", "recent", "now"}\nrecent := history[____]\nfmt.Println(recent)','1:',[':1','1'],'1:は添字1から末尾までです。要素一つの取得と、部分スライスの作成を区別します。','Drop only the oldest entry from the view.'],
  ['map-comma-ok','未登録キーを区別する','map参照のcomma-ok形式で、値と存在フラグを受け取ってください。','stock := map[string]int{"potion": 0}\ncount, ok := ____\nfmt.Println(count, ok)','stock["potion"]',['len(stock)','stock["potion"], true'],'map参照を二つの変数で受けると、二つ目がキーの存在を示します。値0と未登録を区別できます。','Distinguish an empty stock from an unknown item.'],
  ['range-ignore-index','値だけを順に処理する','rangeで不要な添字をブランク識別子へ受けてください。','names := []string{"Ada", "Lin"}\nfor ____, name := range names {\n    fmt.Println(name)\n}','_',['name','nil'],'_は使わない値を捨てます。スライスのrangeでは一つ目が添字、二つ目が要素です。','Visit each player name without keeping indices.'],
  ['switch-default','未知の状態を扱う','どのcaseにも一致しない場合を受ける節を指定してください。','state := "unknown"\nswitch state {\ncase "ready":\n    fmt.Println("start")\n____:\n    fmt.Println("wait")\n}','default',['else','case'],'switchのフォールバックはdefaultです。ifに使うelseとは構文が異なります。','Use a safe fallback for unrecognized states.'],
  ['formatted-string','桁を揃えたIDを作る','文字列を返すfmtの関数で、IDを3桁のゼロ埋めにしてください。','id := 7\nlabel := ____("ID-%03d", id)\nfmt.Println(label)','fmt.Sprintf',['fmt.Printf','fmt.Println'],'Sprintfは整形した文字列を返します。Printfは出力先へ書き込み、文字列は返しません。','Build a padded identifier without printing early.'],
  ['split-whitespace','余分な空白を無視して単語を読む','連続空白を一つの区切りとして扱うstringsの関数を使ってください。','line := "move   north\tfast"\nwords := ____(line)\nfmt.Println(words)','strings.Fields',['strings.Split','strings.TrimSpace'],'Fieldsは空白文字の連続で分割します。Splitは区切り文字引数を取り、連続空白も別扱いになります。','Tokenize a command with irregular whitespace.'],
  ['parse-int-error','入力文字列を整数として読む','整数変換とエラーを返すstrconvの関数を指定してください。','text := "42"\nvalue, err := ____(text)\nfmt.Println(value, err)','strconv.Atoi',['strconv.Itoa','int'],'Atoiは文字列からintへの変換です。変換できない入力はerrで確認できます。','Parse a numeric input while retaining failures.']
 ],
 [
  ['variadic-expansion','スライスを可変長引数へ渡す','スライスを展開する構文で、sumへ全要素を渡してください。','numbers := []int{2, 3, 5}\nfmt.Println(sum(numbers____))','...',['[:]','*'],'可変長引数へスライスを渡すときは末尾に...を付けます。スライス自体を一個のintにはできません。','Expand the existing score list into arguments.','func sum(values ...int) int { total := 0; for _, value := range values { total += value }; return total }'],
  ['named-return','名前付き戻り値を返す','名前付き戻り値の現在値を返す文を指定してください。','fmt.Println(area(4, 3))','return',['break','continue'],'名前付き戻り値を持つ関数では、引数なしのreturnが現在の戻り値を返します。','Return the area stored in the named result.','func area(width, height int) (result int) { result = width * height; ____ }'],
  ['defer-call','終了時の処理を予約する','関数から戻る際に実行されるキーワードを指定してください。','____ fmt.Println("session ended")\nfmt.Println("session started")','defer',['go','return'],'deferの呼び出しは周囲の関数が戻る際に実行されます。goは別goroutineで実行する指示です。','Print the cleanup message after the main work.'],
  ['pointer-dereference','ポインターの参照先を更新する','間接参照の演算子で、ポインターの指す残機を減らしてください。','lives := 3\np := &lives\n____p -= 1\nfmt.Println(lives)','*',['&','<-'],'*pはポインターpの参照先です。&はアドレス取得なので、参照先の代入とは逆の操作です。','Change the original life counter through its pointer.'],
  ['generic-constraint','等値比較できる型だけを受け取る','型集合の制約で、==を使える型に限定してください。','fmt.Println(same("key", "key"))','comparable',['any','interface{}'],'comparableを制約にすると==と!=を使えます。anyではスライスなど比較できない型も含みます。','Allow equality only for comparable type arguments.','func same[T ____](a, b T) bool { return a == b }'],
  ['type-assertion','動的な値から型を確認して取り出す','comma-ok型アサーションで文字列を取り出してください。','var payload any = "ready"\ntext, ok := ____\nfmt.Println(text, ok)','payload.(string)',['string(payload)','payload[string]'],'.(string)はinterface値の動的な型を検査します。okを受ければ型が異なってもpanicになりません。','Inspect a dynamic payload without risking a panic.'],
  ['keyed-struct','フィールド名を指定して初期化する','構造体リテラルのキーでXだけを指定してください。','type Point struct { X, Y int }\np := Point{____: 5}\nfmt.Println(p)','X',['"X"','0'],'キー付きリテラルはフィールド名を使います。指定しないフィールドはゼロ値になります。','Initialize the horizontal coordinate explicitly.'],
  ['labeled-break','二重ループをまとめて抜ける','外側のラベルを付けたbreakで、見つけた時点で両方のループを終えてください。','found := false\nsearch:\nfor row := 0; row < 3; row++ {\n    for col := 0; col < 3; col++ {\n        if row == col { found = true; ____ }\n    }\n}\nfmt.Println(found)','break search',['break','continue search'],'ラベル付きbreakは指定した外側のforを終了します。通常のbreakは内側だけを抜けます。','Stop the entire search after the first match.']
 ],
 [
  ['slice-copy-isolation','複製した一覧を独立して変更する','新しいスライスへcopyし、元のscoresに変更が伝わらないようにしてください。','scores := []int{4, 7}\nbackup := make([]int, len(scores))\n____(backup, scores)\nbackup[0] = 0\nfmt.Println(scores, backup)','copy',['append','delete'],'copyは確保済みの宛先へ要素をコピーします。単なる代入では同じ基盤配列を共有します。','Create an independent backup before editing.'],
  ['unicode-count','UTF-8文字列の文字数を数える','バイト数ではなくUnicodeコードポイント数を返す関数を使ってください。','label := "猫A"\ncount := ____(label)\nfmt.Println(count)','utf8.RuneCountInString',['len','cap'],'Goの文字列のlenはバイト数です。RuneCountInStringはコードポイント数で、見た目の書記素数とはさらに異なります。','Count code points in a multilingual label.'],
  ['nan-check','無効な浮動小数点値を検出する','NaN専用の判定関数を使ってください。NaNを==で比較してはいけません。','value := math.NaN()\ninvalid := ____(value)\nfmt.Println(invalid)','math.IsNaN',['math.IsInf','math.IsInt'],'NaNは自分自身とも等しくありません。IsNaNで検出し、等値比較に依存しません。','Reject an invalid numeric result explicitly.'],
  ['bit-flag-test','複数フラグから一つを確認する','ビット積の演算子で、指定フラグが有効か調べてください。','const CanJump uint8 = 1 << 2\nflags := uint8(12)\ncanJump := flags ____ CanJump != 0\nfmt.Println(canJump)','&',['|','^'],'&で対象ビットだけを残し、0と比較します。|はビットを追加するため有無の検査にはなりません。','Inspect the jump permission without changing flags.'],
  ['compare-without-overflow','整数の大小を安全に比較する','差を計算せず、大小比較の演算子でaが小さいか判定してください。','a, b := int64(-9223372036854775807-1), int64(9223372036854775807)\nless := a ____ b\nfmt.Println(less)','<',['-','>'],'端の値同士を引き算するとオーバーフローすることがあります。大小の判定は直接比較します。','Compare extreme counters without subtracting them.'],
  ['read-only-channel','受信だけできる引数を宣言する','チャネル型の受信方向指定を付け、関数内で送信できないようにしてください。','ch := make(chan int, 1)\nch <- 7\nfmt.Println(receive(ch))','<-chan',['chan<-','chan'],'<-chanは受信専用です。chan<-は送信専用で、<-chを使うことはできません。','Expose only the receiving side of the channel.','func receive(ch ____ int) int { return <-ch }'],
  ['type-alias','既存の型の別名を付ける','型定義ではなく型エイリアスにし、OldIDとintを同じ型として扱ってください。','type OldID ____ int\nvar old OldID = 7\nvar id int = old\nfmt.Println(id)','=',[':=','=='],'type A = Bは型エイリアスです。=を省く型定義は別の型を作るため代入可能性が変わります。','Keep compatibility with the existing integer identifier.'],
  ['full-slice-capacity','部分スライスから元の末尾を書き換えさせない','3要素スライス式で長さと容量を1に制限してください。','storage := []int{1, 2, 3}\nhead := storage[____]\nhead = append(head, 9)\nfmt.Println(storage, head)','0:1:1',['0:1','1:1:3'],'容量も1へ制限するとappendで別の基盤配列が必要になります。長さだけを切ると元の末尾へ書き込み得ます。','Prevent appending through a view from overwriting its tail.']
 ]
];

const GO_DESIGN = [
 [
  ['function-result','計算結果を呼び出し元へ返す','関数の戻り値として残りHPを返す文を入れてください。','fmt.Println(afterHit(10, 3))','return health - damage',['health = damage','fmt.Println(health - damage)'],'戻り値を宣言した関数は値をreturnします。出力するだけでは呼び出し元へ計算結果を渡せません。','Return the remaining health to the caller.','func afterHit(health, damage int) int { ____ }'],
  ['struct-field','関連する状態を構造体へまとめる','HPフィールドの型を整数にしてください。','type Player struct { Name string; HP ____ }\np := Player{Name:"Ada", HP:10}\nfmt.Println(p.HP)','int',['string','bool'],'構造体は名前付きフィールドへ状態をまとめます。HPの加減算に使える整数型を選びます。','Keep the player health beside the player name.'],
  ['pointer-receiver','メソッドで元の状態を更新する','ポインターレシーバーにして、呼び出し元のカウンターを増やしてください。','c := Counter{}\nc.Increment()\nfmt.Println(c.Value)','*Counter',['Counter','&Counter'],'値レシーバーではコピーのValueだけが変わります。ポインターレシーバーは元の構造体を更新します。','Increment the original counter rather than a copy.','type Counter struct { Value int }\nfunc (c ____) Increment() { c.Value++ }'],
  ['constructor-pointer','初期状態を作る関数を用意する','構造体のアドレスを返し、初期HPを持つPlayerを作ってください。','fmt.Println(newPlayer().HP)','&Player{HP:10}',['Player{HP:10}','nil'],'*Playerを返すため構造体リテラルのアドレスを取ります。nilも型は合いますが使える初期状態になりません。','Create a usable player with initial health.','type Player struct { HP int }\nfunc newPlayer() *Player { return ____ }'],
  ['nil-guard','存在しない対象を先に扱う','nilを検査し、対象がないときは0を返してください。','fmt.Println(healthOf(nil))','player == nil',['player.HP == 0','player != nil'],'ポインターがnilか先に確認すれば、安全にフィールドへアクセスできます。nilの参照はpanicになります。','Handle a missing player before reading its fields.','type Player struct { HP int }\nfunc healthOf(player *Player) int { if ____ { return 0 }; return player.HP }'],
  ['enum-iota','状態へ連続した定数を割り当てる','constグループ内のiotaで、最初の状態を0にしてください。','const ( Idle = ____; Running; Finished )\nfmt.Println(Idle, Running, Finished)','iota',['0','1'],'iotaはconstグループの行ごとに増えます。式の省略は前行を繰り返すため、単なる0では全部同じ値です。','Give each state its own consecutive constant.'],
  ['embedded-struct','共通の座標を埋め込む','Positionを埋め込みフィールドにし、entity.Xを使えるようにしてください。','type Position struct { X, Y int }\ntype Entity struct { ____; Name string }\ne := Entity{Position:Position{X:3}}\nfmt.Println(e.X)','Position',['Position Position','*int'],'型名だけのフィールドは埋め込みです。名前付きのPosition Positionではe.Position.Xのようにアクセスします。','Promote shared position fields into an entity.'],
  ['small-interface','必要な動作だけを契約にする','Readerインターフェースへ、引数なしで文字列を返すReadメソッドを宣言してください。','var r Reader = Fixed{}\nfmt.Println(r.Read())','Read() string',['Read(string)','Read() int'],'インターフェースには必要なメソッドのシグネチャを宣言します。実装側と戻り値も一致する必要があります。','Accept any source that can provide one text value.','type Reader interface { ____ }\ntype Fixed struct{}\nfunc (Fixed) Read() string { return "ready" }']
 ],
 [
  ['interface-dispatch','具体型に依存せず動作を呼ぶ','Shapeの面積メソッドを呼び、具体的なRectの型へ変換しないでください。','var shape Shape = Rect{W:3,H:4}\nfmt.Println(shape.____())','Area',['Width','String'],'インターフェース経由で公開されたAreaを呼びます。利用側はRect固有のフィールド構造を知る必要がありません。','Ask the shape for area through its contract.','type Shape interface { Area() int }\ntype Rect struct { W,H int }\nfunc (r Rect) Area() int { return r.W*r.H }'],
  ['function-value','処理を値として受け取る','名前付き関数を呼び出さず、その関数値をtransformへ渡してください。','fmt.Println(transform(4, ____))','double',['double(4)','"double"'],'関数名だけなら関数値です。double(4)は計算後のintなのでfunc(int) intには渡せません。','Pass the transformation itself to another function.','func double(n int) int { return n*2 }\nfunc transform(n int, f func(int) int) int { return f(n) }'],
  ['clock-injection','時刻取得を外から渡す','現在時刻を直接読まず、渡されたnow関数を呼んでください。','fixed := func() int { return 100 }\nfmt.Println(expiresAt(fixed, 30))','now()',['time.Now().Unix()','now'],'時刻を関数として注入すれば、テストで固定時刻を使えます。nowそのものは関数値で、時刻のintではありません。','Make expiration deterministic by injecting the clock.','func expiresAt(now func() int, ttl int) int { return ____ + ttl }'],
  ['strategy-function','並べ方を比較関数で切り替える','降順になる比較を指定し、大きい得点を先にしてください。','scores := []int{3, 9, 5}\nsort.Slice(scores, func(i,j int) bool { return ____ })\nfmt.Println(scores)','scores[i] > scores[j]',['scores[i] < scores[j]','i > j'],'比較対象は添字ではなく要素の値です。降順では前に置きたい大きい値をtrueにします。','Choose descending order through the comparison strategy.'],
  ['wrap-error','原因を残して文脈を加える','fmt.Errorfの書式で元のエラーをラップしてください。','cause := errors.New("missing")\nerr := fmt.Errorf("load save: ____", cause)\nfmt.Println(errors.Is(err, cause))','%w',['%v','%s'],'%wは元のエラーを保持し、errors.Isなどで調べられるようにします。%vは表示するだけです。','Attach loading context without losing the cause.'],
  ['inspect-error-chain','ラップされた原因を判定する','errorsのチェーン対応関数で、元のエラーか確認してください。','target := errors.New("missing")\nerr := fmt.Errorf("load: %w", target)\nfmt.Println(____(err, target))','errors.Is',['errors.As','reflect.DeepEqual'],'errors.Isはラップされた原因をたどって一致を調べます。文字列比較にすると表示文の変更に弱くなります。','Recognize a cause through its wrapping layers.'],
  ['value-copy','変更用の構造体コピーを作る','値の代入でコピーし、元のPointを変更しないでください。','type Point struct { X,Y int }\noriginal := Point{X:2,Y:3}\ncopyPoint := ____\ncopyPoint.X = 9\nfmt.Println(original, copyPoint)','original',['&original','new(Point)'],'構造体の値代入はフィールドをコピーします。ポインターやスライスのフィールドを持つ場合は参照先まで複製しない点に注意します。','Edit a value copy without moving the original point.'],
  ['closure-factory','設定を保持する関数を返す','外側のoffsetを参照するクロージャーで、入力へ補正を加えてください。','add := makeOffset(5)\nfmt.Println(add(2))','value + offset',['value','offset'],'クロージャーは作成時の外側の変数を参照できます。同じ処理へ異なる設定を持たせられます。','Capture a reusable coordinate offset.','func makeOffset(offset int) func(int) int { return func(value int) int { return ____ } }']
 ],
 [
  ['generic-map','変換処理を共通化する','型パラメーターBのスライスを確保し、入力と同じ長さの結果を作ってください。','fmt.Println(mapValues([]int{2,3}, func(n int) string { return strconv.Itoa(n) }))','make([]B, len(input))',['make([]A, len(input))','[]B{}'],'変換後の型Bで元と同じ要素数を確保します。空スライスのまま添字へ代入するとpanicになります。','Allocate one output slot for every transformed input.','func mapValues[A,B any](input []A, f func(A) B) []B { out := ____; for i,v := range input { out[i] = f(v) }; return out }'],
  ['stable-order','同順位の元の順序を守る','安定ソートを使い、同点プレイヤーの並びを維持してください。','type Entry struct { Name string; Score int }\nentries := []Entry{{"Ada",5},{"Lin",5},{"Sam",9}}\n____(entries,func(i,j int) bool { return entries[i].Score > entries[j].Score })\nfmt.Println(entries)','sort.SliceStable',['sort.Slice','sort.Ints'],'安定ソートは比較上等しい要素の相対順を保ちます。Sliceではその保証がありません。','Keep arrival order when leaderboard scores tie.'],
  ['one-time-setup','初期化を一度だけ行う','sync.Onceのメソッドで、複数回呼んでも一度しか初期化しないでください。','var once sync.Once\ncount := 0\nsetup := func() { count++ }\nonce.____(setup)\nonce.Do(setup)\nfmt.Println(count)','Do',['Lock','Add'],'Once.Doは同じOnceに対して処理を一度だけ実行します。失敗時に再試行したい初期化とは使い分けます。','Run shared initialization at most once.'],
  ['decorator-wrapper','既存処理へ記録を付ける','ラッパーから元の関数を一度呼び、その戻り値を保ってください。','double := withLog(func(n int) int { return n*2 })\nfmt.Println(double(4))','next(n)',['withLog(next)(n)','n'],'ラッパーは追加処理後にnextへ委譲します。自分自身を再構築して呼ぶと再帰が終わりません。','Log a transformation while preserving its result.','func withLog(next func(int) int) func(int) int { return func(n int) int { fmt.Println("transform"); return ____ } }'],
  ['immutable-config','元の設定を残して変更する','値レシーバーの戻り値へ変更を適用し、元の設定は残してください。','original := Config{Volume:5}\nupdated := original.WithVolume(8)\nfmt.Println(original.Volume, updated.Volume)','c',['&c','Config{}'],'値レシーバーcを変更して返すと、元の値を変えず新しい設定を作れます。参照型フィールドがあれば別途複製が必要です。','Return an updated configuration value.','type Config struct { Volume int }\nfunc (c Config) WithVolume(v int) Config { c.Volume=v; return ____ }'],
  ['locked-snapshot','ロックの保護下で状態を読む','関数終了時にロック解除されるようdeferしてください。','s := State{value:7}\nfmt.Println(s.Snapshot())','defer s.mu.Unlock()',['s.mu.Unlock()','defer s.mu.Lock()'],'読んでいる間はロックを保持し、return時に解除します。先に解除すると並行アクセスを保護できません。','Keep the state locked until the snapshot is read.','type State struct { mu sync.Mutex; value int }\nfunc (s *State) Snapshot() int { s.mu.Lock(); ____; return s.value }'],
  ['unsubscribe-callback','購読解除を関数として返す','返したクロージャー内でmapからIDを削除してください。','listeners := map[int]string{1:"hud"}\nunsubscribe := watch(listeners,1)\nunsubscribe()\nfmt.Println(len(listeners))','delete(listeners, id)',['delete(listeners, 0)','listeners = nil'],'閉じ込めたIDをdeleteすると、その購読だけを解除できます。ローカル変数をnilにしても元のmapのエントリーは消えません。','Remove precisely the registered listener.','func watch(listeners map[int]string,id int) func() { return func(){ ____ } }'],
  ['validation-boundary','不正な入力を境界で拒否する','負数の容量をエラーにし、内部処理へ渡さないでください。','capacity, err := validateCapacity(-1)\nfmt.Println(capacity, err)','n < 0',['n > 0','n == 0'],'入力を受け取る境界で不正値を排除すると、後段の処理は正常な前提に集中できます。0を許す仕様も守ります。','Reject invalid capacity before allocating resources.','func validateCapacity(n int) (int,error) { if ____ { return 0,errors.New("negative capacity") }; return n,nil }']
 ],
 [
  ['propagate-context','キャンセルを下位処理へ伝える','受け取ったctxをそのまま次の関数へ渡してください。','ctx,cancel := context.WithCancel(context.Background())\ncancel()\nfmt.Println(load(ctx))','ctx',['context.Background()','context.TODO()'],'呼び出し元のcontextを渡すことで、キャンセルや締切を下位処理へ伝えます。新しいBackgroundではつながりが切れます。','Preserve cancellation across the loading boundary.','func fetch(ctx context.Context) error { return ctx.Err() }\nfunc load(ctx context.Context) error { return fetch(____) }'],
  ['bounded-retry','再試行回数に上限を付ける','最大3回だけ処理を呼ぶループ条件にしてください。','attempts := 0\nfor attempt := 0; ____; attempt++ {\n    attempts++\n}\nfmt.Println(attempts)','attempt < 3',['attempt <= 3','attempt >= 3'],'0始まりで3回実行する条件は<3です。<=3は4回になり、リトライ予算を超えます。','Respect the fixed retry budget.'],
  ['owned-slice','外部へ渡すデータの所有権を分ける','呼び出し元が編集しても内部バッファを変更しないよう、コピー用スライスを確保してください。','data := []byte("save")\nview := snapshot(data)\nview[0] = \'S\'\nfmt.Println(string(data))','make([]byte, len(data))',['data','data[:]'],'別の基盤配列へcopyすることで所有権を分けます。スライス記述子だけのコピーでは内部の配列を共有します。','Return a snapshot the caller may safely edit.','func snapshot(data []byte) []byte { out := ____; copy(out,data); return out }'],
  ['functional-option','任意の設定を関数で適用する','オプション関数へ対象サーバーを渡して設定を反映してください。','s := newServer(func(s *Server){s.Port=9000})\nfmt.Println(s.Port)','option(s)',['option(*s)','s = option(s)'],'func(*Server)の各オプションを呼び出して、同じ構成対象へ適用します。設定関数は値を返さない契約です。','Apply each option to the new server instance.','type Server struct { Port int }\nfunc newServer(options ...func(*Server)) *Server { s:=&Server{Port:8000}; for _,option:=range options { ____ }; return s }'],
  ['typed-error','エラーの具体的な情報を取り出す','errors.Asで対象変数のアドレスを渡し、ラップされた型付きエラーを取り出してください。','err := fmt.Errorf("load: %w", &NotFound{Key:"slot1"})\nvar missing *NotFound\nif errors.As(err, ____) { fmt.Println(missing.Key) }','&missing',['missing','&err'],'Asは一致したエラーを対象変数へ書き込みます。対象は目的の型を保持できる変数のアドレスです。','Read structured details from a wrapped error.','type NotFound struct { Key string }\nfunc (e *NotFound) Error() string { return "missing: "+e.Key }'],
  ['compile-time-contract','インターフェース実装をコンパイル時に確認する','*MemoryStoreがStoreを実装するという代入チェックにしてください。','fmt.Println("contract checked")','(*MemoryStore)(nil)',['MemoryStore{}','nil'],'型付きnilポインターをインターフェースへ代入すると、そのポインター型のメソッド集合をコンパイラーが確認できます。','Check the pointer receiver method set at compile time.','type Store interface { Save(string) error }\ntype MemoryStore struct{}\nfunc (*MemoryStore) Save(string) error { return nil }\nvar _ Store = ____'],
  ['join-errors','複数の失敗を一つにまとめる','errors.Joinで両方の原因を残してください。','readErr:=errors.New("read")\ncloseErr:=errors.New("close")\nerr:=____(readErr,closeErr)\nfmt.Println(errors.Is(err,readErr),errors.Is(err,closeErr))','errors.Join',['fmt.Errorf','errors.New'],'Joinは複数のエラーを保持し、IsやAsでも各原因を調べられます。一つのメッセージに潰す操作とは異なります。','Preserve both the primary failure and cleanup failure.'],
  ['compare-and-swap','未開始のときだけ状態を変更する','原子的な比較交換で、0から1へ一度だけ変更してください。','var state atomic.Int32\nstarted := state.____(0,1)\nagain := state.CompareAndSwap(0,1)\nfmt.Println(started,again)','CompareAndSwap',['Swap','Store'],'CompareAndSwapは現在値が期待値と一致したときだけ更新します。Load後のStoreでは間に別の更新が入り得ます。','Let exactly one caller claim the start transition.']
 ]
];

const GO_GRAPHICS = [
 [
  ['position-translation','横方向へ移動する','現在のxへ速度を加える複合代入演算子を入れてください。','x,velocity := 5,2\nx ____ velocity\nfmt.Println(x)','+=',['=','-='],'+=は現在位置に変位を加えます。=では位置を速度そのものに置き換えてしまいます。','Move the object relative to its current position.'],
  ['vector-addition','二次元の変位を合成する','縦成分もそれぞれ足し合わせてください。','ax,ay,bx,by := 2,3,4,-1\nx,y := ax+bx,____\nfmt.Println(x,y)','ay+by',['ay+bx','ax+by'],'ベクトルの加算は同じ軸の成分同士で行います。横と縦の成分を混ぜないことが基本です。','Combine independent movements on matching axes.'],
  ['clamp-channel','色成分の上限を守る','255を超えた色成分を255へ制限してください。','red:=300\nif red > 255 { red = ____ }\nfmt.Println(red)','255',['0','red'],'8bitの色成分は0〜255です。ここでは上限超過を検出済みなので、最大値へ丸めます。','Clamp an overbright red channel to its upper bound.'],
  ['opacity-scale','不透明度を割合へ変換する','float64の百分率を100で割り、0〜1の割合へ直してください。','percent:=float64(25)\nalpha:=percent / ____\nfmt.Println(alpha)','100.0',['255.0','1.0'],'百分率は100で割って正規化します。ここではpercentがfloat64なので、型なし定数100でもfloat64に変換されて実数除算になります。','Convert opacity percent into a normalized alpha.'],
  ['row-major-index','画像の座標を一次元添字へ直す','行優先の配列で、行の開始位置にxを足してください。','width,x,y:=8,3,2\nindex:=____\nfmt.Println(index)','y*width+x',['x*width+y','x+y'],'行優先では一行がwidth要素なので、y*widthが行頭です。最後にその行のxを加えます。','Locate a pixel in row-major storage.'],
  ['rectangle-width','左右の境界から幅を求める','右端から左端を引いてください。','left,right:=2.0,9.0\nwidth:=____\nfmt.Println(width)','right-left',['left-right','right+left'],'同じ座標系の右端と左端の差が幅です。境界の位置そのものを足す計算ではありません。','Measure the horizontal span between two edges.'],
  ['frame-cycle','アニメーションを循環させる','剰余演算子でフレーム番号を0〜frameCount-1へ戻してください。','tick,frameCount:=17,6\nframe:=tick ____ frameCount\nfmt.Println(frame)','%',['/','*'],'剰余により一定枚数ごとに0へ戻れます。ここではframeCountが正であることを前提としています。','Wrap an animation frame within its sprite count.'],
  ['rgba-array','RGBAの4成分を固定長で持つ','4要素の固定長配列の型を指定してください。','color:=____{255,128,0,255}\nfmt.Println(color)','[4]uint8',['[]uint8','[3]uint8'],'固定長配列は要素数も型の一部です。RGBAの4成分を過不足なく持つ意図を表せます。','Store exactly four byte-sized color channels.']
 ],
 [
  ['vector-length','ベクトルの長さを求める','math.Hypotで二つの成分から長さを求めてください。','dx,dy:=3.0,4.0\nlength:=____(dx,dy)\nfmt.Println(length)','math.Hypot',['math.Sqrt','math.Abs'],'Hypotは二成分の平方和の平方根です。Sqrtは一引数なので、そのまま同じ呼び方はできません。','Measure the movement magnitude from both components.'],
  ['degrees-to-radians','角度をラジアンへ変換する','度数へπ/180を掛けてください。','degrees:=90.0\nradians:=degrees * ____\nfmt.Println(radians)','math.Pi/180',['180/math.Pi','math.Pi'],'一周360度が2πラジアンなので、1度はπ/180です。多くの三角関数はラジアンを受け取ります。','Convert editor degrees for trigonometric functions.'],
  ['linear-interpolation','二つの位置の間を補間する','aからbへの差にtを掛ける一次補間式を使ってください。','a,b,t:=10.0,30.0,0.25\nx:=____\nfmt.Println(x)','a+(b-a)*t',['(a+b)*t','b+(b-a)*t'],'a+(b-a)*tはt=0でa、t=1でbになります。始点と終点が正しく対応する式を選びます。','Interpolate from the start position toward the end.'],
  ['aabb-overlap','二つの横区間が重なるか調べる','端で接するだけなら重なりなしとする条件にしてください。','aLeft,aRight,bLeft,bRight:=0,4,3,8\noverlap:=____\nfmt.Println(overlap)','aLeft < bRight && bLeft < aRight',['aLeft > bRight && bLeft > aRight','aLeft <= bRight || bLeft <= aRight'],'両側から相手の終端より前に始まるとき重なります。&&が必要で、半開区間なら比較は厳密な<です。','Detect overlap without counting edge-only contact.'],
  ['point-half-open','矩形内の点を判定する','右端を含まない半開区間でxの範囲を確認してください。','x,left,right:=10,0,10\ninside:=____\nfmt.Println(inside)','x >= left && x < right',['x >= left && x <= right','x > left || x < right'],'右端を除くと隣り合う矩形で境界点が二重所属しません。下限を含め、上限だけ除きます。','Assign a boundary point to only one neighboring tile.'],
  ['angle-wrap','負の角度を一周内へ戻す','剰余後も負なら360を加え、0以上にしてください。','angle:=-30.0\nwrapped:=math.Mod(angle,360)\nif wrapped<0 { wrapped += ____ }\nfmt.Println(wrapped)','360',['180','-360'],'Modは負の値を返すことがあります。一周分を加えると0以上360未満の範囲に戻せます。','Normalize a negative heading into one full turn.'],
  ['world-to-tile','負の座標でも正しいタイルを選ぶ','単純なint変換ではなく床関数で下方向へ丸めてください。','x,tileWidth:=-1.0,16.0\ncolumn:=int(____(x/tileWidth))\nfmt.Println(column)','math.Floor',['math.Ceil','math.Round'],'int変換は0へ切り捨てるため、負の座標で左隣のタイルを取り違えます。Floorなら常に下へ丸めます。','Map negative world coordinates to the tile on their left.'],
  ['draw-command-data','描画命令をデータとして記録する','スライスへ新しい描画コマンドを追加し、戻り値を保存してください。','type Command struct { Kind string; X,Y int }\ncommands:=[]Command{}\ncommands=____(commands,Command{Kind:"sprite",X:3,Y:4})\nfmt.Println(commands)','append',['copy','delete'],'描画を即実行せず命令列として記録すると、後段で並べ替えや検査ができます。appendの戻り値も保持します。','Queue a sprite command for a later rendering pass.']
 ],
 [
  ['smoothstep','速度が滑らかに変化する補間を作る','0〜1のtへsmoothstepの三次式を適用してください。','t:=0.25\neased:=____\nfmt.Println(eased)','t*t*(3-2*t)',['t*t*t','3*t-2*t*t'],'smoothstepは両端の傾きが0になります。値の範囲を0〜1へ制限する処理は、呼び出し側で別に行います。','Ease the transition with zero slope at both endpoints.'],
  ['rotate-vector','原点の周りに回転する','2D回転行列のy成分を計算してください。','x,y,angle:=1.0,0.0,math.Pi/2\nc,s:=math.Cos(angle),math.Sin(angle)\nrx:=x*c-y*s\nry:=____\nfmt.Println(rx,ry)','x*s+y*c',['x*c+y*s','x*s-y*c'],'標準の回転行列はx cos−y sin、x sin＋y cosです。軸ごとの係数と符号を守ります。','Rotate both vector components using one angle.'],
  ['uniform-fit','縦横比を保って画面へ収める','幅と高さの倍率の小さい方を選んでください。','viewW,viewH,imageW,imageH:=800.0,600.0,640.0,480.0\nscale:=____(viewW/imageW,viewH/imageH)\nfmt.Println(scale)','math.Min',['math.Max','math.Hypot'],'小さい倍率なら両方の辺が画面内に収まります。Maxは画面を埋めますが画像の一部がはみ出します。','Fit the whole image without distorting its aspect ratio.'],
  ['camera-culling','画面外のものを描画から除く','横区間が完全に画面外になる条件を||で結んでください。','left,right,viewLeft,viewRight:=900,930,0,800\nculled:=____\nfmt.Println(culled)','right <= viewLeft || left >= viewRight',['right <= viewLeft && left >= viewRight','left < viewRight && right > viewLeft'],'左右どちらかに完全に外れれば除外できます。両方同時に外れる必要はありません。','Skip drawing an object wholly outside the camera.'],
  ['premultiplied-color','透明度を色へ事前に掛ける','正規化したalphaを赤成分へ掛けてください。','red,alpha:=0.8,0.25\npremultiplied:=____\nfmt.Println(premultiplied)','red*alpha',['red/alpha','red+alpha'],'乗算済みアルファではRGBをα倍して保存します。ブレンド側の規約も乗算済み形式に合わせる必要があります。','Prepare a red channel for premultiplied-alpha blending.'],
  ['ping-pong-motion','往復するアニメーション位置を作る','周期2の位相から0→1→0の三角波を求めてください。','phase:=math.Mod(1.5,2)\nposition:=____\nfmt.Println(position)','1-math.Abs(phase-1)',['math.Abs(phase)','phase/2'],'位相1からの距離を1から引くと、前半で増加し後半で減少します。周期を通して値が連続になります。','Reverse the movement smoothly at each cycle endpoint.'],
  ['delta-time-cap','長い停止後の移動量を制限する','一フレームに使うdelta秒の上限を小さい方で制限してください。','elapsed,maxDelta:=2.0,0.05\ndelta:=____(elapsed,maxDelta)\nfmt.Println(delta)','math.Min',['math.Max','math.Abs'],'復帰時の巨大なdeltaを上限へ抑えると物体の飛び越えを減らせます。失った時間をどう扱うかは別に決めます。','Avoid a giant movement step after a long pause.'],
  ['fixed-step-accumulator','固定時間幅で更新する','余っている時間がstep以上ある間だけループしてください。','accumulator,step:=0.05,0.02\nupdates:=0\nfor ____ { accumulator-=step; updates++ }\nfmt.Println(updates,accumulator)','accumulator >= step',['accumulator > 0','accumulator <= step'],'更新できる一刻み分の時間があるときだけ消費します。残りが正という条件では負になるまで余分に更新します。','Consume complete simulation steps and retain the remainder.']
 ],
 [
  ['inverse-affine','座標変換の逆を求める','2×2行列の行列式を計算してください。非ゼロの前提で逆変換します。','a,b,c,d:=2.0,0.0,0.0,3.0\ndet:=____\nlocalX:=(d*6-b*9)/det\nlocalY:=(-c*6+a*9)/det\nfmt.Println(localX,localY)','a*d-b*c',['a*c-b*d','a*d+b*c'],'2×2の行列式はad−bcです。0なら逆行列は存在せず、実用時は0に近い値にも注意します。','Recover local coordinates by inverting the affine basis.'],
  ['letterbox-offset','余白を左右へ均等に置く','描画後に残る幅の半分を左オフセットにしてください。','viewportW,contentW,scale:=1000.0,640.0,1.25\noffsetX:=____\nfmt.Println(offsetX)','(viewportW-contentW*scale)/2',['viewportW-contentW*scale/2','(viewportW-contentW)/scale'],'実際に描画される幅を引いてから2で割ります。倍率を掛ける前の幅で余白を計算しないようにします。','Center scaled content inside a letterboxed viewport.'],
  ['shortest-angle','境界をまたぐ最短の回転を選ぶ','fromとtoは0以上360未満です。角度差を[-180,180)へ正規化する式を使ってください。','from,to:=350.0,10.0\ndifference:=____\nfmt.Println(difference)','math.Mod(to-from+540,360)-180',['to-from','math.Mod(to-from,360)'],'一周分を使って差を折り返すと、350度から10度を−340度でなく20度として扱えます。入力が範囲外の場合は先に正規化します。','Choose the short turn across the zero-degree boundary.'],
  ['quadratic-bezier','曲線上の位置を求める','二次ベジェ曲線の中央制御点の係数を入れてください。','a,b,c,t:=0.0,10.0,0.0,0.5\nu:=1-t\nx:=u*u*a + ____*b + t*t*c\nfmt.Println(x)','2*u*t',['u*t','2*t*t'],'二次ベジェの係数は(1−t)^2、2(1−t)t、t^2です。中央制御点を単なる線形補間と混同しません。','Blend all three control points on a quadratic curve.'],
  ['barycentric-value','三角形の頂点属性を補間する','3頂点の値へそれぞれの重心座標を掛けて足してください。','a,b,c:=10.0,20.0,40.0\nu,v,w:=0.2,0.3,0.5\nvalue:=____\nfmt.Println(value)','a*u+b*v+c*w',['(a+b+c)/3','a*v+b*w+c*u'],'重心座標は対応する頂点の重みです。一般の点で単純平均にすると位置による属性変化を再現できません。','Interpolate a vertex attribute with matching triangle weights.'],
  ['perspective-divide','同次座標を画面前の座標へ直す','wで割って透視除算を行ってください。wは正とします。','clipX,clipY,w:=4.0,2.0,2.0\nndcX,ndcY:=clipX/____,clipY/w\nfmt.Println(ndcX,ndcY)','w',['clipY','1'],'同次座標のxyzをwで割るのが透視除算です。wが0付近の場合やクリッピングは別途扱います。','Convert clip coordinates by their homogeneous divisor.'],
  ['srgb-linear-segment','暗いsRGB色を線形へ戻す','sRGBの低輝度区間で、符号化値を12.92で割ってください。','encoded:=0.02\nlinear:=encoded / ____\nfmt.Println(linear)','12.92',['2.2','255'],'sRGBの低輝度区間は線形で、12.92で割ります。全域を一律のガンマ2.2で扱う式とは異なります。','Decode the linear low-intensity segment of sRGB.'],
  ['normalized-direction','ゼロベクトルを安全に扱う','長さが正のときだけ正規化し、0除算を防いでください。','x,y:=0.0,0.0\nlength:=math.Hypot(x,y)\nif ____ { x/=length; y/=length }\nfmt.Println(x,y)','length > 0',['length >= 0','length == 0'],'ゼロベクトルには向きがありません。0除算でNaNを作るより、その状態を明示的に扱います。','Leave a zero movement vector unchanged during normalization.']
 ]
];

const GO_SYSTEMS = [
 [
  ['new-error','失敗を値として表す','errorsの関数でメッセージを持つerrorを作ってください。','err:=____("invalid save")\nfmt.Println(err)','errors.New',['fmt.Println','strings.NewReader'],'errors.Newはerror値を作ります。表示と失敗を返す契約を分けると、呼び出し元で扱い方を選べます。','Represent an invalid save as an error value.'],
  ['read-all','読み込み元の内容をまとめて読む','io.Readerから全バイトとエラーを受け取る関数を使ってください。','source:=strings.NewReader("save-data")\ndata,err:=____(source)\nfmt.Println(string(data),err)','io.ReadAll',['io.ReadFull','os.ReadFile'],'ReadAllはReaderを末尾まで読みます。サイズ制限のない外部入力では、別途上限を設ける必要があります。','Read the complete contents of a small trusted source.'],
  ['string-builder','文字列の断片を蓄積する','Builderの文字列用書き込みメソッドを呼んでください。','var builder strings.Builder\nbuilder.____("player=")\nbuilder.WriteString("Ada")\nfmt.Println(builder.String())','WriteString',['Write','String'],'WriteStringは文字列を受け取ります。Writeは[]byte、Stringは蓄積した結果を返すメソッドです。','Accumulate text fragments before producing the final string.'],
  ['byte-buffer','バイト列を書き込む','bytes.Bufferのバイト列用メソッドで書き込んでください。','var buffer bytes.Buffer\n_,err:=buffer.____([]byte{1,2,3})\nfmt.Println(buffer.Len(),err)','Write',['WriteString','Read'],'Writeは[]byteを追加します。Readはバッファから取り出す処理で、目的が反対です。','Append raw binary data to a buffer.'],
  ['json-encode','構造化した状態をJSONへ変換する','jsonのエンコード関数を使ってください。','state:=map[string]int{"level":2}\ndata,err:=____(state)\nfmt.Println(string(data),err)','json.Marshal',['json.Unmarshal','json.NewDecoder'],'MarshalはGoの値をJSONのバイト列へ変換します。Unmarshalはその逆で、格納先の引数も必要です。','Encode state before storing or sending it.'],
  ['file-extension','ファイル名の拡張子を読む','OSに合わせたパス処理の拡張子関数を使ってください。','name:="saves/slot.json"\next:=____(name)\nfmt.Println(ext)','filepath.Ext',['filepath.Base','filepath.Dir'],'Extはドットを含む拡張子を返します。Baseはファイル名全体、Dirは親ディレクトリです。','Inspect the file extension without splitting the path by hand.'],
  ['duration-unit','秒を時間幅として持つ','time.Durationへ秒の単位を掛けてください。','delay:=3 * ____\nfmt.Println(delay)','time.Second',['time.Now()','time.Duration(1)'],'Durationの内部単位はナノ秒です。time.Secondを使うと、単位を読み違えず3秒を表せます。','Express the timeout in seconds rather than raw nanoseconds.'],
  ['scan-lines','入力を一行ずつ処理する','Scannerで次の行を読み込む条件メソッドを呼んでください。','scanner:=bufio.NewScanner(strings.NewReader("one\\ntwo"))\nfor scanner.____() { fmt.Println(scanner.Text()) }\nfmt.Println(scanner.Err())','Scan',['Text','Err'],'Scanは次のトークンがある間trueです。ループ終了後にErrを確認して、EOFと読取失敗を区別します。','Advance the scanner before reading each line.']
 ],
 [
  ['defer-close','読み込み元を確実に閉じる','関数の終了時にCloseを呼ぶよう予約してください。','reader:=io.NopCloser(strings.NewReader("data"))\n____ reader.Close()\ndata,err:=io.ReadAll(reader)\nfmt.Println(string(data),err)','defer',['go','return'],'deferは途中のreturnでも実行されます。Closeのエラーが重要な書き込み処理では、その確認方法も設計します。','Close the resource when the surrounding function exits.'],
  ['scanner-error','行読み込みの失敗を見逃さない','Scanループの後にErrを取り出してください。','scanner:=bufio.NewScanner(strings.NewReader("ready"))\nfor scanner.Scan() { fmt.Println(scanner.Text()) }\nerr:=scanner.____()\nfmt.Println(err)','Err',['Text','Scan'],'Scanがfalseになる理由はEOFだけではありません。Errでサイズ超過や読み込み失敗を確認します。','Check why the line scanning loop stopped.'],
  ['stream-json','ReaderからJSONを復元する','Decoderへ格納先のアドレスを渡してください。','decoder:=json.NewDecoder(strings.NewReader(`{"level":2}`))\nvar state map[string]int\nerr:=decoder.Decode(____)\nfmt.Println(state,err)','&state',['state','map[string]int{}'],'Decodeは値を書き込むため格納先のポインターを受け取ります。値だけ渡しても復元先を変更できません。','Decode streamed JSON into the caller-owned value.'],
  ['binary-endianness','通信データの整数を読む','先頭バイトが上位になるビッグエンディアンの実装を使ってください。','packet:=[]byte{0,1,0,2}\nvalue:=binary.____.Uint32(packet)\nfmt.Println(value)','BigEndian',['LittleEndian','NativeEndian'],'通信形式でバイト順を固定すればCPUの違いに依存しません。相手の仕様と同じ順序を選ぶ必要があります。','Read the network-defined big-endian counter.'],
  ['temporary-file','一時ファイルの名前衝突を避ける','CreateTempの名前テンプレートでランダム部分を置く記号を入れてください。','file,err:=os.CreateTemp("","save-____.tmp")\nif err!=nil { panic(err) }\ndefer os.Remove(file.Name())\ndefer file.Close()\nfmt.Println(filepath.Ext(file.Name()))','*',['%d','{id}'],'CreateTempはパターン末尾の*をランダム文字列へ置き換えます。作成後のCloseとRemoveも忘れません。','Create a unique temporary save file and clean it up.'],
  ['copy-reader','読み込み元から書き込み先へ流す','io.Copyへ宛先を先、元を後に渡してください。','var target bytes.Buffer\nsource:=strings.NewReader("save")\nn,err:=io.Copy(____)\nfmt.Println(n,target.String(),err)','&target, source',['source, &target','target, source'],'Copyの順序はdst,srcです。Bufferへ書き込むためポインターを渡し、Readerから取り出します。','Stream data from the source into the destination buffer.'],
  ['join-path','環境に合ったパスを作る','文字列連結ではなくfilepathの結合関数を使ってください。','path:=____("saves","slot.json")\nfmt.Println(path)','filepath.Join',['filepath.Split','filepath.Abs'],'Joinは区切りや不要な部分を整えます。ただし未信頼のパスが保存先の外へ出ないかは別途検査が必要です。','Build the save path using the platform path rules.'],
  ['bounded-integer-parse','保存値のビット幅を指定して読む','ParseIntのbitSizeを32にし、32bit範囲外をエラーにしてください。','value,err:=strconv.ParseInt("2147483648",10,____)\nfmt.Println(value,err!=nil)','32',['0','64'],'bitSize32なら符号付き32bitの範囲を検査します。64ではこの入力が成功し、保存形式の契約を守れません。','Reject values outside the save format integer range.']
 ],
 [
  ['waitgroup-before-launch','並行処理の完了を待つ','goroutineを起動する前にWaitGroupへ1件追加してください。','var group sync.WaitGroup\n____\ngo func(){ defer group.Done(); fmt.Println("loaded") }()\ngroup.Wait()','group.Add(1)',['group.Done()','go group.Add(1)'],'Addを先に行わないと、Waitが作業0件だと判断して先に終了する競合が起こり得ます。','Register work before its goroutine can start or finish.'],
  ['mutex-critical-section','共有カウンターの更新を守る','Lockの後に終了時のUnlockを予約してください。','var mu sync.Mutex\ncount:=0\nfunc(){ mu.Lock(); ____; count++ }()\nfmt.Println(count)','defer mu.Unlock()',['mu.Unlock()','defer mu.Lock()'],'共有状態を更新し終えるまでロックを保持します。先にUnlockすると保護区間の外で書き換えることになります。','Hold the mutex throughout the counter update.'],
  ['cancel-context','処理の中止を明示する','取得したcancel関数を呼び、子contextを中止してください。','ctx,cancel:=context.WithCancel(context.Background())\n____\nfmt.Println(ctx.Err())','cancel()',['ctx.Done()','ctx.Err()'],'cancelが中止を発行します。Doneは中止通知用チャネルの取得、Errは中止理由の参照です。','Signal cancellation instead of only observing it.'],
  ['buffered-channel','受信前に一件送れるチャネルを作る','容量1のバッファを指定してください。','queue:=make(chan string,____)\nqueue<-"save"\nfmt.Println(<-queue)','1',['0','-1'],'同じgoroutineで受信前に送るには空き容量が必要です。容量0は受信側と同時に進む必要があります。','Queue one message before the receiver begins.'],
  ['nonblocking-select','受信できなければ待たずに戻る','selectのdefault節で、未到着時は待機しないでください。','events:=make(chan int)\nselect {\ncase event:=<-events: fmt.Println(event)\n____: fmt.Println("no event")\n}','default',['else','case true'],'selectのdefaultはどの通信もすぐ実行できないときに進みます。無限ループに置く場合は空回りにも注意します。','Check for an event without blocking the frame.'],
  ['stop-timer','不要になったタイマーを止める','終了時にStopを呼び、タイマーを放置しないでください。','timer:=time.NewTimer(time.Hour)\ndefer timer.____()\nfmt.Println("work completed early")','Stop',['Reset','Close'],'Timer.Stopは不要になったタイマーを停止します。Resetは新しい期間を取る再設定で、Closeはありません。','Stop the unused timeout when work finishes early.'],
  ['eof-sentinel','入力終了を他の失敗と区別する','errors.Isでio.EOFを判定してください。','err:=fmt.Errorf("read: %w",io.EOF)\nfinished:=errors.Is(err,____)\nfmt.Println(finished)','io.EOF',['nil','errors.New("EOF")'],'EOFは既定のセンチネル値です。同じ文字列の新しいエラーを作っても同一の原因にはなりません。','Recognize normal end-of-input through a wrapped sentinel.'],
  ['atomic-counter','カウンターを原子的に増やす','atomic.Int64の加算メソッドを使い、読取後の書込に分けないでください。','var completed atomic.Int64\nnext:=completed.____(1)\nfmt.Println(next)','Add',['Store','Load'],'Addは加算と更新を一つの原子的操作にします。Loadした値へStoreすると更新を失う競合が起こり得ます。','Count completed jobs with one atomic operation.']
 ],
 [
  ['context-timeout-cleanup','締切付き処理の資源を解放する','WithTimeoutのcancelを必ず呼ぶようdeferしてください。','ctx,cancel:=context.WithTimeout(context.Background(),time.Second)\n____\nfmt.Println(ctx.Err())','defer cancel()',['defer ctx.Done()','defer context.Background()'],'締切前に処理が終わった場合でもcancelでタイマーなどを解放します。Doneを読むだけでは中止できません。','Release the timeout resources even on an early return.'],
  ['cancellable-send','送信待ちからキャンセルで抜ける','selectでcontextの中止通知を待つcaseを入れてください。','ctx,cancel:=context.WithCancel(context.Background())\ncancel()\nqueue:=make(chan int)\nselect {\ncase queue<-1: fmt.Println("sent")\ncase <-____: fmt.Println("cancelled")\n}','ctx.Done()',['ctx.Err()','context.Background()'],'Doneは中止時に閉じるチャネルです。送信先が止まっていても中止通知で待機を終了できます。','Avoid leaking a sender when its consumer has stopped.'],
  ['semaphore-release','同時実行枠を確実に返す','取得したチャネル枠を、処理終了時の受信で解放してください。','slots:=make(chan struct{},1)\nslots<-struct{}{}\nfunc(){ defer func(){ ____ }(); fmt.Println("job") }()\nfmt.Println(len(slots))','<-slots',['close(slots)','slots<-struct{}{}'],'一件送信して枠を取得したら、一件受信して返します。チャネル自体を閉じると、他の作業の取得がpanicになります。','Return the semaphore token when the job exits.'],
  ['producer-closes','送信側が終了を知らせる','全要素を送り終えたgoroutineでチャネルを閉じてください。','items:=make(chan int)\ngo func(){ items<-1; items<-2; ____ }()\nfor item:=range items { fmt.Println(item) }','close(items)',['items=nil','items<-0'],'rangeはチャネルが閉じられるまで続きます。送信完了を知る側が閉じ、受信側から早まって閉じないようにします。','Tell the ranging consumer that no more items will arrive.'],
  ['bounded-read','外部入力の読取量を制限する','LimitReaderで上限より1バイト多く読み、超過を検出できるようにしてください。','source:=strings.NewReader("oversized")\nconst limit=4\ndata,err:=io.ReadAll(io.LimitReader(source,____))\nfmt.Println(len(data)>limit,err)','limit+1',['limit','-1'],'上限ぴったりで止めるだけでは、続きがあるか分かりません。上限+1まで読むと大きすぎる入力を検出できます。','Detect oversized input without reading the entire stream.'],
  ['worker-output-order','並行結果を入力順へ戻す','各結果の元の添字へ書き込むことで、完了順へ依存しないようにしてください。','results:=make([]int,3)\nvar group sync.WaitGroup\nfor index,value:=range []int{2,3,4} {\n    group.Add(1)\n    go func(i,v int){ defer group.Done(); results[____]=v*v }(index,value)\n}\ngroup.Wait()\nfmt.Println(results)','i',['0','v'],'互いに異なる要素へ元の添字で書き込むと入力順が保たれます。全goroutineが同じ要素を書くと競合します。','Keep deterministic output ordering despite parallel completion.'],
  ['flush-buffered-writer','バッファ内の書込を送り出す','処理後にFlushを呼び、基盤の宛先へ残りを送ってください。','var output bytes.Buffer\nwriter:=bufio.NewWriter(&output)\n_,err:=writer.WriteString("save")\nif err!=nil { panic(err) }\nerr=writer.____()\nfmt.Println(output.String(),err)','Flush',['Reset','Close'],'バッファに残ったデータはFlushしないと宛先へ届かない場合があります。Flushのエラーも確認します。','Flush buffered bytes before reporting a successful write.'],
  ['atomic-load-state','共有状態を原子的に読む','atomic.Valueから公開済みの設定を読み、型を確認してください。','var current atomic.Value\ncurrent.Store(Config{Volume:5})\nconfig:=current.____().(Config)\nfmt.Println(config.Volume)','Load',['Swap','Store'],'Loadは公開済みの値を原子的に取得します。格納する動的な型を統一し、内部の参照先も不変に扱う必要があります。','Read the published immutable configuration snapshot.','type Config struct { Volume int }']
 ]
];

const GO_PREREQUISITES = {
 'syntax/append-result':['syntax/slice-index','syntax/collection-length'],
 'syntax/half-open-slice':['syntax/slice-index','syntax/collection-length'],
 'syntax/range-ignore-index':['syntax/slice-index'],
 'syntax/formatted-string':['syntax/string-concat'],
 'syntax/parse-int-error':['syntax/explicit-conversion','systems/new-error'],
 'syntax/variadic-expansion':['syntax/append-result','design/function-result'],
 'syntax/named-return':['design/function-result'],
 'syntax/generic-constraint':['design/small-interface'],
 'syntax/type-assertion':['design/small-interface'],
 'syntax/keyed-struct':['design/struct-field'],
 'syntax/labeled-break':['syntax/range-ignore-index'],
 'syntax/slice-copy-isolation':['syntax/half-open-slice'],
 'syntax/unicode-count':['syntax/rune-literal','syntax/collection-length'],
 'syntax/compare-without-overflow':['syntax/explicit-conversion'],
 'syntax/read-only-channel':['systems/buffered-channel'],
 'syntax/full-slice-capacity':['syntax/append-result','syntax/half-open-slice'],
 'design/pointer-receiver':['syntax/pointer-dereference','design/struct-field'],
 'design/constructor-pointer':['design/struct-field','syntax/pointer-dereference'],
 'design/nil-guard':['syntax/pointer-dereference'],
 'design/embedded-struct':['design/struct-field'],
 'design/interface-dispatch':['design/small-interface','design/function-result'],
 'design/function-value':['design/function-result'],
 'design/clock-injection':['design/function-value'],
 'design/strategy-function':['design/function-value','syntax/slice-index'],
 'design/wrap-error':['systems/new-error','syntax/formatted-string'],
 'design/inspect-error-chain':['design/wrap-error'],
 'design/value-copy':['design/struct-field'],
 'design/closure-factory':['design/function-value'],
 'design/generic-map':['syntax/generic-constraint','design/function-value'],
 'design/stable-order':['design/strategy-function'],
 'design/one-time-setup':['design/function-value'],
 'design/decorator-wrapper':['design/closure-factory'],
 'design/immutable-config':['design/value-copy'],
 'design/locked-snapshot':['systems/mutex-critical-section','design/pointer-receiver'],
 'design/unsubscribe-callback':['design/closure-factory','syntax/map-comma-ok'],
 'design/validation-boundary':['systems/new-error','design/function-result'],
 'design/propagate-context':['systems/cancel-context'],
 'design/bounded-retry':['syntax/range-ignore-index'],
 'design/owned-slice':['syntax/slice-copy-isolation'],
 'design/functional-option':['design/function-value','design/pointer-receiver'],
 'design/typed-error':['design/wrap-error','syntax/pointer-dereference'],
 'design/compile-time-contract':['design/small-interface','design/pointer-receiver'],
 'design/join-errors':['design/inspect-error-chain'],
 'design/compare-and-swap':['systems/atomic-counter'],
 'graphics/vector-length':['graphics/vector-addition'],
 'graphics/linear-interpolation':['graphics/position-translation','syntax/explicit-conversion'],
 'graphics/aabb-overlap':['graphics/rectangle-width','syntax/logical-and'],
 'graphics/point-half-open':['graphics/rectangle-width','syntax/logical-and'],
 'graphics/world-to-tile':['graphics/row-major-index','syntax/explicit-conversion'],
 'graphics/draw-command-data':['syntax/append-result','syntax/keyed-struct'],
 'graphics/smoothstep':['graphics/linear-interpolation'],
 'graphics/rotate-vector':['graphics/vector-addition','graphics/degrees-to-radians'],
 'graphics/uniform-fit':['syntax/explicit-conversion','graphics/rectangle-width'],
 'graphics/camera-culling':['graphics/aabb-overlap'],
 'graphics/premultiplied-color':['graphics/opacity-scale','graphics/rgba-array'],
 'graphics/ping-pong-motion':['graphics/frame-cycle','graphics/linear-interpolation'],
 'graphics/delta-time-cap':['graphics/position-translation'],
 'graphics/fixed-step-accumulator':['graphics/delta-time-cap'],
 'graphics/inverse-affine':['graphics/rotate-vector'],
 'graphics/letterbox-offset':['graphics/uniform-fit'],
 'graphics/shortest-angle':['graphics/angle-wrap'],
 'graphics/quadratic-bezier':['graphics/linear-interpolation'],
 'graphics/barycentric-value':['graphics/linear-interpolation','graphics/vector-addition'],
 'graphics/perspective-divide':['syntax/explicit-conversion'],
 'graphics/srgb-linear-segment':['graphics/opacity-scale','graphics/clamp-channel'],
 'graphics/normalized-direction':['graphics/vector-length'],
 'systems/defer-close':['syntax/defer-call','systems/read-all'],
 'systems/scanner-error':['systems/scan-lines','systems/new-error'],
 'systems/stream-json':['systems/json-encode','syntax/pointer-dereference'],
 'systems/binary-endianness':['syntax/slice-index'],
 'systems/temporary-file':['systems/defer-close','systems/file-extension'],
 'systems/copy-reader':['systems/byte-buffer','systems/read-all'],
 'systems/join-path':['systems/file-extension'],
 'systems/bounded-integer-parse':['syntax/parse-int-error'],
 'systems/waitgroup-before-launch':['syntax/defer-call'],
 'systems/mutex-critical-section':['syntax/defer-call'],
 'systems/nonblocking-select':['systems/buffered-channel'],
 'systems/stop-timer':['systems/duration-unit','syntax/defer-call'],
 'systems/eof-sentinel':['design/wrap-error','design/inspect-error-chain'],
 'systems/context-timeout-cleanup':['systems/cancel-context','systems/duration-unit'],
 'systems/cancellable-send':['systems/cancel-context','systems/nonblocking-select'],
 'systems/semaphore-release':['systems/buffered-channel','syntax/defer-call'],
 'systems/producer-closes':['systems/buffered-channel','syntax/range-ignore-index'],
 'systems/bounded-read':['systems/read-all'],
 'systems/worker-output-order':['systems/waitgroup-before-launch','syntax/slice-index'],
 'systems/flush-buffered-writer':['systems/byte-buffer','systems/copy-reader'],
 'systems/atomic-load-state':['systems/atomic-counter','design/immutable-config']
};
export const GO_SKILL_QUIZZES = linkPrerequisites([...goRows('syntax',GO_SYNTAX),...goRows('design',GO_DESIGN),...goRows('graphics',GO_GRAPHICS),...goRows('systems',GO_SYSTEMS)],GO_PREREQUISITES);

const PYTHON_ALTERNATIVES = {
  'syntax/tuple-unpack':['(x, y)','[x, y]'],
  'syntax/f-string':['F'],
  'syntax/set-literal':['{"rare", "quest"}','{"quest", "rare",}'],
  'syntax/list-comprehension':['if 0 <= score'],
  'syntax/conditional-expression':['"play" if 0 < lives else "over"'],
  'syntax/sequence-pattern':['("move", distance)','"move", distance'],
  'syntax/chained-comparison':['high >= value >= low'],
  'syntax/raw-regex':['R'],
  'design/safe-default-list':['list()'],
  'design/dataclass-fields':['dataclass()'],
  'design/super-initialization':['super(Player, self)'],
  'design/factory-function':['lambda: dict(score=0)'],
  'design/class-pattern':['Message("save", value)','Message(payload=value, kind="save")'],
  'graphics/point-components':['x, y'],
  'graphics/channel-clamp':['min(255, max(0, red))','max(min(red, 255), 0)','min(max(red, 0), 255)'],
  'graphics/pixel-index':['x + y * width'],
  'graphics/color-unpacking':['(red, green, blue)','[red, green, blue]'],
  'graphics/lerp-position':['a + t * (b - a)'],
  'graphics/rectangle-hit-test':['top <= y < bottom and left <= x < right','right > x >= left and bottom > y >= top'],
  'graphics/sprite-row-slice':['start:width + start'],
  'graphics/premultiplied-alpha':['alpha * channel'],
  'graphics/fixed-step-loop':['step <= accumulator'],
  'graphics/barycentric-attribute':['weight * value'],
  'graphics/normalization-zero':['0 < length'],
  'systems/binary-layout':['"!I"'],
  'systems/digest-bytes':['payload.encode()','payload.encode("utf8")']
};
// Python's ordinary string delimiters are interchangeable in these authored
// answers: each literal has no escapes or embedded quotes. Generate their
// combinations in the data, rather than normalizing all languages' strings.
function pythonQuoteVariants(source) {
  const literals=[...source.matchAll(/"([^"\\\r\n]*)"/g)];
  let variants=[source];
  for(const match of literals){
    if(match[1].includes("'"))continue;
    // Replacing delimiters preserves offsets, including in mixed-quote answers.
    variants=variants.flatMap(value=>[value,value.slice(0,match.index)+"'"+match[1]+"'"+value.slice(match.index+match[0].length)]);
  }
  return variants;
}
function pythonRows(subject, groups) {
  return groups.flatMap((rows,level)=>rows.map(([slug,title,prompt,body,answer,incorrect,explanation,note,alternatives])=>{
    const accepted=[...new Set([answer,...(alternatives || PYTHON_ALTERNATIVES[`${subject}/${slug}`] || [])].flatMap(pythonQuoteVariants))].filter(value=>value!==answer);
    return {
      id:`${subject}/${slug}`,subject,concept:slug,title,difficulty:level+1,minutes:[0.75,1.5,2.5,4][level],
      prompt:`${title}。${prompt}`,code:`# ${note}\n${body}\n`,answer,incorrect,explanation,...(accepted.length?{alternatives:accepted}:{})
    };
  }));
}
const PYTHON_SYNTAX = [
 [
  ['assignment','最初の得点を保存する','代入演算子でscoreへ0を設定してください。','score ____ 0\nprint(score)','=',['==',':='],'=は変数への代入です。==は比較で、:=は式の中で代入する別の構文です。','Start a new game with an assigned score.'],
  ['tuple-unpack','座標を二つの変数へ分ける','タプルのアンパックでxとyを同時に受け取ってください。','position = (3, 7)\n____ = position\nprint(x, y)','x, y',['x','x[0], y[0]'],'左辺を同じ個数に分けると順番に代入できます。配列への添字アクセスを先に作る必要はありません。','Unpack the horizontal and vertical coordinates.'],
  ['f-string','表示用の文字列へ値を埋め込む','f文字列の接頭辞を使ってnameを展開してください。','name = "Ada"\nlabel = ____"Player: {name}"\nprint(label)','f',['r','b'],'f文字列は波括弧内の式を評価します。rはエスケープ抑制、bはバイト列で、値の展開ではありません。','Insert the player name into a status label.'],
  ['boolean-and','二つの参加条件を確認する','Pythonの論理積キーワードで、両方が真のときだけ開始してください。','connected, ready = True, False\ncan_start = connected ____ ready\nprint(can_start)','and',['or','&&'],'Pythonの論理積はandです。&&はPythonの演算子ではありません。値を返す短絡評価にも使われます。','Require both connection and readiness before starting.'],
  ['dictionary-lookup','名前に対応する値を読む','辞書のキーを使ってpotionの在庫を取り出してください。','stock = {"potion": 4, "rope": 2}\ncount = stock[____]\nprint(count)','"potion"',['0','"count"'],'辞書は位置ではなくキーで参照します。ここでは在庫が登録済みという前提で[]を使います。','Read the inventory value belonging to the potion key.'],
  ['set-literal','重複しないタグを持つ','集合リテラルで二つのタグを作ってください。','tags = ____\nprint("quest" in tags)','{"quest", "rare"}',['["quest", "rare"]','{"quest": "rare"}'],'波括弧で値を並べると集合になります。キーと値をコロンで結ぶ構文は辞書です。','Represent unique item tags as a set.'],
  ['negative-index','最後の履歴を読む','負の添字で末尾の要素を取り出してください。','history = ["spawn", "move", "save"]\nlatest = history[____]\nprint(latest)','-1',['0','len(history)'],'-1は末尾の要素です。lenの値そのものは有効な添字範囲の一つ外になります。','Read the latest event without removing it.'],
  ['none-identity','未設定の値を確認する','Noneとの同一性をisで確認してください。','selection = None\nmissing = selection ____ None\nprint(missing)','is',['==','in'],'Noneの検査はisを使う慣用です。==は値側の比較処理が定義されている場合にその処理を呼びます。','Check whether a selection has not been made.']
 ],
 [
  ['list-comprehension','有効な得点だけを集める','リスト内包表記のフィルターで負数を除いてください。','scores = [5, -1, 3]\nvalid = [score for score in scores ____]\nprint(valid)','if score >= 0',['if score < 0','else score >= 0'],'内包表記の末尾のifは要素の採否を決めます。式の条件分岐を行うif/elseとは位置が異なります。','Filter invalid scores while building a new list.'],
  ['dict-comprehension','IDから名前を引ける辞書を作る','辞書内包表記でIDをキー、名前を値にしてください。','players = [(1, "Ada"), (2, "Lin")]\nby_id = {____ for identifier, name in players}\nprint(by_id)','identifier: name',['name: identifier','identifier, name'],'辞書内包表記ではkey: valueを指定します。逆にすると名前からIDを引く別の索引になります。','Index player names by their stable identifiers.'],
  ['set-comprehension','大文字小文字の違いをまとめる','集合内包表記で小文字化した名前だけを集めてください。','names = ["Ada", "ADA", "Lin"]\nunique = {____ for name in names}\nprint(sorted(unique))','name.lower()',['name','name.upper()'],'集合が重複を取り除き、lowerが表記を小文字に揃えます。どの正規化を使うかは用途に合わせて決めます。','Normalize names before removing duplicates.'],
  ['star-arguments','一覧を位置引数へ展開する','*によるアンパックで三つの値を関数へ渡してください。','def total(a, b, c):\n    return a + b + c\nvalues = [2, 3, 5]\nprint(total(____values))','*',['**','&'],'*はイテラブルを位置引数へ展開します。**は辞書などをキーワード引数へ展開します。','Expand stored values into the three positional parameters.'],
  ['slice-step','履歴を逆順に表示する','スライスのstepに-1を指定し、全要素を逆順にしてください。','history = ["first", "second", "third"]\nprint(history[____])','::-1',['::1',':-1'],'[::-1]は後ろから順に全要素を選びます。[:-1]は末尾を除くだけで順序は変わりません。','Show all events in reverse chronological order.'],
  ['enumerate-start','表示番号を1から付ける','enumerateのstartキーワード引数を使ってください。','names = ["Ada", "Lin"]\nfor number, name in enumerate(names, ____):\n    print(number, name)','start=1',['stop=1','1, 1'],'startは列挙番号の初期値を指定します。元のリストの添字や内容を書き換えるものではありません。','Number visible menu entries starting at one.'],
  ['zip-pairs','対応する二つの一覧を組にする','zipで名前と得点を同じ位置ごとにまとめてください。','names, scores = ["Ada", "Lin"], [7, 9]\nprint(list(____(names, scores)))','zip',['enumerate','map'],'zipは同じ位置の要素を組にします。通常は短い方で終了するので長さが仕様上重要なら別途確認します。','Pair each score with its corresponding player.'],
  ['conditional-expression','状態に応じた表示を一式で選ぶ','条件式で、残機があるときplay、それ以外はoverを返してください。','lives = 0\nlabel = ____\nprint(label)','"play" if lives > 0 else "over"',['"over" if lives > 0 else "play"','lives > 0 and "play"'],'条件式は真の値 if 条件 else 偽の値です。andだけでは偽のときに所望の文字列を返しません。','Choose a complete status label for either condition.']
 ],
 [
  ['assignment-expression','計算した値を条件内で使い回す','代入式で長さをcountへ保存してください。','items = ["rope", "torch"]\nif (count ____ len(items)) > 0:\n    print(count)',':=',['=','=='],':=は式の値を変数へ保存し、その値自体も返します。通常の=はこの条件式内へ置けません。','Compute the collection length only once in the condition.'],
  ['sequence-pattern','形が合うコマンドだけを分解する','matchのシーケンスパターンでmoveと数値を受け取ってください。','command = ["move", 3]\nmatch command:\n    case ____:\n        print(distance)\n    case _:\n        print("unknown")','["move", distance]',['["jump", distance]','"move", 3'],'パターン内のdistanceは一致した値を捕捉します。命令名と要素数も同時に確認できます。','Match a move command and bind its distance.'],
  ['positional-only','引数名への依存を防ぐ','/を入れ、valueを位置専用の引数にしてください。','def clamp(value, ____, low=0):\n    return max(value, low)\nprint(clamp(-2))','/',['*','**kwargs'],'/より前は位置専用です。後から引数名を変更してもキーワード指定の利用側を壊しにくくできます。','Keep the input value positional while allowing named options.'],
  ['keyword-only','単位を明示して呼ばせる','*を入れ、secondsをキーワード専用の引数にしてください。','def schedule(task, ____, seconds):\n    return task, seconds\nprint(schedule("save", seconds=2))','*',['/','**options'],'単独の*以降の引数はキーワード専用です。呼び出し時に数値の意味を明示できます。','Require callers to name the scheduling delay.'],
  ['decode-bytes','UTF-8のバイト列を文字列へ戻す','bytesのdecodeメソッドを使ってください。','payload = b"ready"\ntext = payload.____("utf-8")\nprint(text)','decode',['encode','hex'],'decodeはバイト列から文字列へ戻します。文字列をバイト列へ変換するencodeとは方向が逆です。','Decode received bytes before treating them as text.'],
  ['type-annotation','戻り値の型を明示する','型注釈で、この関数が文字列を返すことを示してください。','def label(score: int) -> ____:\n    return f"Score: {score}"\nprint(label(7))','str',['int','None'],'->strは戻り値の型注釈です。標準の実行時には型変換や強制検査を行わず、型検査ツールなどが利用します。','Document the returned label for static type checking.'],
  ['mapping-unpack','既定値の一部を上書きする','辞書の**展開でdefaultsを先に展開してください。','defaults = {"volume": 5, "muted": False}\nconfig = {____defaults, "volume": 8}\nprint(config)','**',['*','&'],'辞書の展開後に同じキーを置くと後の値が使われます。元のdefaults自体は変更しません。','Override one option while preserving the other defaults.'],
  ['exception-binding','例外の詳細を取り出す','exceptのas節で例外オブジェクトをerrorへ受けてください。','try:\n    value = int("not-a-number")\nexcept ValueError ____ error:\n    print(type(error).__name__)','as',['is','with'],'asで捕捉した例外を変数へ束縛できます。型ごとに捕捉すると想定外の例外まで隠さずに済みます。','Capture the expected parse failure for a useful diagnostic.']
 ],
 [
  ['yield-from','別の生成器へ反復を委譲する','yield fromで入れ子の列を順番に流してください。','def flatten(groups):\n    for group in groups:\n        ____ group\nprint(list(flatten([[1, 2], [3]])))','yield from',['yield','return'],'yield fromは各要素を順に返します。yield groupではリスト自体を一つの要素として返します。','Delegate iteration to each nested group.'],
  ['nonlocal-state','クロージャーの外側の状態を更新する','nonlocalで外側のcountを更新対象として宣言してください。','def make_counter():\n    count = 0\n    def next_value():\n        ____ count\n        count += 1\n        return count\n    return next_value\ncounter = make_counter()\nprint(counter())','nonlocal',['global','local'],'nonlocalは最も近い外側の関数スコープの変数を指します。globalはモジュールの変数なので別の対象です。','Retain a private counter in its enclosing function.'],
  ['chained-comparison','上下限をまとめて確認する','連鎖比較で値が両端を含む範囲内か確認してください。','value, low, high = 5, 0, 10\ninside = ____\nprint(inside)','low <= value <= high',['low <= value >= high','low <= value or value <= high'],'連鎖比較は両方の比較を満たす場合に真です。orにすると範囲外でも片方の条件だけで真になりがちです。','Check both bounds with a single chained comparison.'],
  ['extended-unpacking','先頭と残りを分けて受け取る','拡張アンパックで残りの値をリストrestへ集めてください。','values = [1, 2, 3, 4]\nfirst, ____ = values\nprint(first, rest)','*rest',['rest','**rest'],'左辺の*は残りの要素をリストにまとめます。**はこの代入構文では使いません。','Separate the leading item from all remaining items.'],
  ['decimal-string','十進小数を意図した値で作る','Decimalへfloatではなく文字列を渡してください。','from decimal import Decimal\nprice = Decimal(____)\nprint(price * 3)','"0.1"',['0.1','1/10'],'二進浮動小数点の誤差を先に持ち込まず、十進の文字列からDecimalを作成します。','Construct an exact decimal amount from its textual form.'],
  ['raw-regex','正規表現のエスケープを保つ','raw文字列の接頭辞で、バックスラッシュを正規表現へそのまま渡してください。','import re\npattern = ____"\\d+"\nprint(re.fullmatch(pattern, "123") is not None)','r',['b','f'],'raw文字列はPython側のエスケープ解釈を抑えます。正規表現エンジンが\dを数字クラスとして解釈します。','Preserve regex escapes until the regex engine reads them.'],
  ['keyword-collection','可変個の名前付き引数を受ける','**で任意のキーワード引数を辞書optionsへ集めてください。','def configure(____options):\n    return sorted(options)\nprint(configure(volume=5, fullscreen=True))','**',['*','&'],'**optionsはキーワード引数の辞書です。*optionsは位置引数のタプルを受け取る別の形式です。','Collect optional named settings without fixing their count.'],
  ['literal-type','許される文字列値を型で示す','Literalで二つの状態値だけを型注釈へ列挙してください。','from typing import Literal\ndef set_mode(mode: ____["play", "pause"]) -> str:\n    return mode\nprint(set_mode("play"))','Literal',['Optional','list'],'Literalは具体的な値を型として表します。標準の実行時に拒否されるわけではなく、静的検査のための契約です。','Describe a small fixed vocabulary for the mode argument.']
 ]
];

const PYTHON_DESIGN = [
 [
  ['return-value','結果を再利用できる関数にする','表示だけで終えず、差し引いた残りHPをreturnしてください。','def after_hit(health, damage):\n    ____ health - damage\nprint(after_hit(10, 3))','return',['print','yield'],'returnした値は呼び出し側で保存や合成ができます。yieldにすると通常の値でなく生成器を返す関数へ変わります。','Return remaining health rather than printing inside the function.'],
  ['safe-default-list','呼び出しごとに独立した一覧を作る','可変な既定引数を避け、Noneのときだけ新しいリストを作ってください。','def add_item(item, items=None):\n    if items is None:\n        items = ____\n    items.append(item)\n    return items\nprint(add_item("torch"), add_item("rope"))','[]',['items','None'],'リストの既定値を関数定義で作ると呼び出し間で共有されます。Noneを目印に本体で新しく作ります。','Allocate independent default inventories for separate calls.'],
  ['instance-attribute','インスタンス固有の状態を持つ','selfの属性としてHPを初期化してください。','class Player:\n    def __init__(self, health):\n        ____ = health\nplayer = Player(10)\nprint(player.health)','self.health',['health','Player.health'],'self.healthは各インスタンスの属性です。クラス属性にすると、共有状態との区別が曖昧になります。','Store health on the individual player instance.'],
  ['dataclass-fields','データ用クラスの初期化を生成する','dataclassデコレーターを適用してください。','from dataclasses import dataclass\n@____\nclass Position:\n    x: int\n    y: int\nprint(Position(3, 4))','dataclass',['classmethod','staticmethod'],'dataclassは注釈付きフィールドから__init__や比較などを生成します。データを表す単純な型へ使えます。','Generate a constructor for the two coordinate fields.'],
  ['property-getter','計算した値を読み取り属性で公開する','propertyデコレーターで面積を属性として読めるようにしてください。','class Square:\n    def __init__(self, side):\n        self.side = side\n    @____\n    def area(self):\n        return self.side * self.side\nprint(Square(3).area)','property',['classmethod','staticmethod'],'propertyはメソッドの計算結果を属性の形で公開します。呼び出し側はarea()でなくareaで参照します。','Expose a derived area without storing redundant state.'],
  ['class-factory','代替コンストラクターを作る','classmethodを使い、clsから同じクラスのインスタンスを作ってください。','class Point:\n    def __init__(self, x, y):\n        self.x, self.y = x, y\n    @____\n    def origin(cls):\n        return cls(0, 0)\nprint(Point.origin().x)','classmethod',['staticmethod','property'],'classmethodにはクラスがclsとして渡されます。派生クラスから呼んだ場合もそのクラスを使って構築できます。','Build an origin point through a class-aware factory.'],
  ['static-helper','状態を使わない補助処理を置く','インスタンスもクラスも受け取らないstaticmethodにしてください。','class Scores:\n    @____\n    def valid(value):\n        return value >= 0\nprint(Scores().valid(3))','staticmethod',['classmethod','property'],'staticmethodはselfやclsを暗黙に受け取りません。インスタンスの状態を使う処理と区別できます。','Keep a stateless validation helper free of implicit arguments.'],
  ['early-guard','異常値を先に返す','負数なら早期returnし、通常計算へ進ませないでください。','def reward(score):\n    if score < 0:\n        ____ 0\n    return score * 2\nprint(reward(-1))','return',['yield','raise'],'早期returnで不正な値の分岐を終えると、残りの処理は正常値の流れにできます。','Exit the invalid-input branch before computing a reward.']
 ],
 [
  ['super-initialization','基底クラスの初期化を保つ','superで親の初期化を呼び、nameを設定してください。','class Entity:\n    def __init__(self, name):\n        self.name = name\nclass Player(Entity):\n    def __init__(self, name):\n        ____.__init__(name)\n        self.health = 10\nprint(Player("Ada").name)','super()',['self','Entity'],'super()はメソッド解決順に従って基底側へ委譲します。self.__init__では自分自身を再度呼んでしまいます。','Preserve the base entity initialization.'],
  ['composition','持っている部品へ処理を委譲する','継承を増やす代わりに、保持しているinventoryへ追加処理を委譲してください。','class Inventory:\n    def __init__(self):\n        self.items = []\n    def add(self, item):\n        self.items.append(item)\nclass Player:\n    def __init__(self):\n        self.inventory = Inventory()\n    def pick_up(self, item):\n        ____.add(item)\nplayer = Player()\nplayer.pick_up("torch")\nprint(player.inventory.items)','self.inventory',['self','Inventory'],'構成では役割を持つ別のオブジェクトを保持し、必要な処理を委譲します。Player自体を在庫の型にする必要はありません。','Delegate item storage to the owned inventory component.'],
  ['protocol-contract','継承なしで満たせる契約を示す','typing.Protocolを基底にして、readの構造的な契約を表してください。','from typing import Protocol\nclass Source(____):\n    def read(self) -> str: ...\nclass Memory:\n    def read(self):\n        return "ready"\ndef load(source: Source):\n    return source.read()\nprint(load(Memory()))','Protocol',['object','str'],'Protocolは必要な属性やメソッドの構造で適合を表します。通常のobject継承だけでは静的な構造的契約になりません。','Accept any source satisfying the reading protocol.'],
  ['callable-annotation','差し替える処理の型を示す','Callableの引数型一覧と戻り値型で、整数を整数へ変換する処理を表してください。','from typing import Callable\ndef apply(value: int, transform: ____[[int], int]) -> int:\n    return transform(value)\nprint(apply(3, lambda n: n * 2))','Callable',['list','tuple'],'Callable[[引数型],戻り値型]で関数の契約を表せます。関数を注入すると処理方針を差し替えられます。','Type the pluggable integer transformation.'],
  ['factory-function','必要になったときに新しい状態を作る','呼び出すたび新しい辞書を返すラムダを指定してください。','factory = ____\nfirst, second = factory(), factory()\nfirst["score"] = 9\nprint(second["score"])','lambda: {"score": 0}',['{"score": 0}','lambda: first'],'関数を呼ぶたびリテラルが評価され、別の辞書になります。既存の辞書を返すだけでは共有が残ります。','Create a fresh state mapping on every factory call.'],
  ['deep-copy','入れ子の編集を独立させる','deepcopyで内部のリストも複製してください。','from copy import deepcopy\noriginal = {"items": ["torch"]}\nbackup = ____(original)\nbackup["items"].append("rope")\nprint(original["items"])','deepcopy',['dict','list'],'辞書の浅いコピーでは中のリストを共有します。deepcopyは参照を再帰的に複製しますが、用途に応じた明示コピーも選べます。','Keep nested inventory edits out of the saved backup.'],
  ['frozen-data','更新しない値オブジェクトを作る','dataclassのfrozenオプションを有効にしてください。','from dataclasses import dataclass\n@dataclass(____)\nclass Point:\n    x: int\n    y: int\nprint(Point(1, 2))','frozen=True',['frozen=False','readonly=True'],'frozen=Trueは通常のフィールド再代入を禁止します。ただし内部にリストがあれば、そのリストまで不変にはなりません。','Make coordinate fields read-only after construction.'],
  ['enum-values','名前付きの選択肢を定義する','Enumを継承して状態を列挙してください。','from enum import Enum\nclass Mode(____):\n    PLAY = "play"\n    PAUSE = "pause"\nprint(Mode.PLAY.value)','Enum',['str','object'],'Enumは値の集合へ型と名前を与えます。単なるクラスの文字列属性より誤用や曖昧な値を減らせます。','Represent the mode vocabulary with named enum members.']
 ],
 [
  ['cached-property','計算結果をインスタンスへ保存する','cached_propertyで初回アクセス後に結果を再利用してください。','from functools import cached_property\nclass Atlas:\n    def __init__(self):\n        self.calls = 0\n    @____\n    def frames(self):\n        self.calls += 1\n        return ("idle", "walk")\natlas = Atlas()\nprint(atlas.frames, atlas.frames, atlas.calls)','cached_property',['property','staticmethod'],'cached_propertyは計算結果を属性へ保存します。元のデータが変わる場合はキャッシュの無効化方法も必要です。','Compute the immutable frame listing only on first access.'],
  ['wraps-metadata','デコレーターで関数名を保つ','functools.wrapsへ元の関数を渡し、メタデータを引き継いでください。','from functools import wraps\ndef traced(function):\n    @____(function)\n    def wrapper(*args, **kwargs):\n        return function(*args, **kwargs)\n    return wrapper\n@traced\ndef load():\n    return "ready"\nprint(load.__name__)','wraps',['staticmethod','property'],'wrapsは__name__やdocstringなどを元の関数から引き継ぎます。デコレーター後の診断やヘルプを読みやすくします。','Preserve the wrapped function identity for diagnostics.'],
  ['parameterized-decorator','設定を受けるデコレーターを作る','外側のtimesを使って処理の呼び出し回数を決めてください。','def repeat(times):\n    def decorate(function):\n        def wrapper():\n            return [function() for _ in range(____)]\n        return wrapper\n    return decorate\n@repeat(2)\ndef ping():\n    return "ping"\nprint(ping())','times',['1','function'],'設定用の外側関数がデコレーターを返し、その設定を内側のラッパーが参照します。','Capture the repetition policy in a configured decorator.'],
  ['single-dispatch','引数型に応じて処理を登録する','singledispatchのregisterへintを渡してください。','from functools import singledispatch\n@singledispatch\ndef label(value):\n    return "other"\n@label.register(____)\ndef _(value):\n    return f"integer:{value}"\nprint(label(3))','int',['str','float'],'singledispatchは最初の引数の型で実装を選びます。処理を一つの型判定の大きな分岐へ集めず追加できます。','Register an integer-specific presentation strategy.'],
  ['iterable-interface','全件保持せず順に提供する','yieldで各イベントを一つずつ返してください。','def events():\n    for name in ("spawn", "move", "save"):\n        ____ name\nprint(list(events()))','yield',['return','yield from'],'yieldはその値一つを返して中断します。returnでは最初で終了し、yield fromでは文字列の各文字を返してしまいます。','Expose an event stream as an iterable generator.'],
  ['default-factory','データクラスごとに空の一覧を作る','fieldのdefault_factoryへlist自体を渡してください。','from dataclasses import dataclass, field\n@dataclass\nclass Inventory:\n    items: list[str] = field(default_factory=____)\na, b = Inventory(), Inventory()\na.items.append("torch")\nprint(b.items)','list',['list()','[]'],'default_factoryは呼び出し可能な関数を受け取ります。listを渡すと、各インスタンスで新しいリストが作られます。','Give every inventory its own mutable list.'],
  ['replace-value','不変データから変更版を作る','dataclasses.replaceでvolumeだけが異なる新しい値を作ってください。','from dataclasses import dataclass, replace\n@dataclass(frozen=True)\nclass Config:\n    volume: int\nold = Config(5)\nnew = ____(old, volume=8)\nprint(old.volume, new.volume)','replace',['setattr','copy'],'replaceはデータクラスの指定フィールドだけ変更した新しいインスタンスを作ります。元の値は保たれます。','Create a modified immutable config without mutating the old one.'],
  ['injected-clock','時刻に依存する計算をテスト可能にする','直接時刻APIを呼ばず、渡されたnow関数を呼んでください。','def expiry(now, ttl):\n    return ____ + ttl\nprint(expiry(lambda: 100, 30))','now()',['now','time.time()'],'時刻の取得を注入すると固定値で検証できます。関数そのものではなく呼び出して得た値を使います。','Calculate expiration using the supplied clock source.']
 ],
 [
  ['generic-container','入れ物と中身の型を結び付ける','同じTypeVarをGenericの型引数へ指定してください。','from typing import Generic, TypeVar\nT = TypeVar("T")\nclass Box(Generic[____]):\n    def __init__(self, value: T):\n        self.value = value\nbox: Box[int] = Box(3)\nprint(box.value)','T',['int','object'],'TypeVarを使うとインスタンスごとに中身の型を保てます。ここでintへ固定すると汎用の型パラメーターになりません。','Preserve the contained value type through the generic box.'],
  ['abstract-contract','未実装の派生クラスを作らせない','abstractmethodを付けてloadを実装必須にしてください。','from abc import ABC, abstractmethod\nclass Store(ABC):\n    @____\n    def load(self):\n        raise NotImplementedError\nclass MemoryStore(Store):\n    def load(self):\n        return "ready"\nprint(MemoryStore().load())','abstractmethod',['staticmethod','property'],'abstractmethodは未実装メソッドを持つクラスのインスタンス化を防ぎます。NotImplementedErrorだけとは役割が違います。','Require concrete stores to implement the loading operation.'],
  ['exception-chaining','変換前の失敗原因を残す','raise fromで、表向きのエラーへ元の例外を連結してください。','def parse_save(text):\n    try:\n        return int(text)\n    except ValueError as cause:\n        raise RuntimeError("invalid save") ____ cause\ntry:\n    parse_save("bad")\nexcept RuntimeError as error:\n    print(type(error.__cause__).__name__)','from',['as','with'],'fromで明示的な原因を保持できます。利用側への文脈を加えながら、調査に必要な元の失敗も残します。','Expose a domain error while preserving its parse cause.'],
  ['named-tuple','軽量な不変レコードを定義する','NamedTupleを継承して名前付き要素を持たせてください。','from typing import NamedTuple\nclass Position(____):\n    x: int\n    y: int\nposition = Position(2, 3)\nprint(position.x, tuple(position))','NamedTuple',['list','dict'],'NamedTupleはタプルとしても使える名前付きレコードです。フィールドの再代入をしない値に向いています。','Combine named coordinate fields with immutable tuple behavior.'],
  ['keyword-only-dataclass','設定の取り違えを防ぐ','データクラスのkw_onlyを有効にしてください。','from dataclasses import dataclass\n@dataclass(____)\nclass Window:\n    width: int\n    height: int\nprint(Window(width=800, height=600))','kw_only=True',['kw_only=False','keyword=True'],'kw_only=Trueなら生成される初期化引数を名前付きで渡す必要があります。似た型の設定を逆に渡す事故を減らせます。','Require explicit names for easily confused window dimensions.'],
  ['class-pattern','レコードの形に応じて処理する','クラスパターンでMessageのkind属性がsaveのときだけ一致させてください。','from dataclasses import dataclass\n@dataclass\nclass Message:\n    kind: str\n    payload: str\nmessage = Message("save", "slot1")\nmatch message:\n    case ____:\n        print(value)\n    case _:\n        print("ignored")','Message(kind="save", payload=value)',['Message(kind="load", payload=value)','{"kind": "save", "payload": value}'],'クラスパターンは対象の型と属性を確認します。通常のデータクラスは辞書パターンでは一致しません。','Match a save message by its class and named attributes.'],
  ['context-manager-protocol','スコープ終了時に状態を戻す','__exit__で例外を握りつぶさないようFalseを返してください。','class Scope:\n    def __enter__(self):\n        print("enter")\n        return self\n    def __exit__(self, error_type, error, traceback):\n        print("exit")\n        return ____\nwith Scope():\n    print("work")','False',['True','self'],'__exit__が真を返すと例外を抑制します。後片付けだけを目的とする場合はFalseやNoneで例外を伝えます。','Clean up the scope without suppressing unexpected failures.'],
  ['overload-contract','入力ごとの戻り値型を示す','型検査用のoverloadデコレーターを適用してください。','from typing import overload\n@____\ndef identity(value: int) -> int: ...\n@overload\ndef identity(value: str) -> str: ...\ndef identity(value):\n    return value\nprint(identity("ready"))','overload',['property','staticmethod'],'overloadは複数の静的シグネチャを宣言します。実行時に処理する本体は最後の通常の関数定義です。','Describe related input and output types without runtime dispatch.']
 ]
];

const PYTHON_GRAPHICS = [
 [
  ['relative-movement','速度を現在位置へ加える','複合代入で既存のxへ移動量を加えてください。','x, velocity = 5, 2\nx ____ velocity\nprint(x)','+=',['=','-='],'+=は今の位置へ移動量を加えます。=では位置が速度の値に置き換わります。','Move relative to the current horizontal position.'],
  ['point-components','二つの軸を一つの座標にする','タプルでxとyを順にまとめてください。','x, y = 3, 4\nposition = ____\nprint(position)','(x, y)',['(y, x)','x + y'],'座標の各成分を組として保持すると軸の対応が明示できます。加算すると元の二成分を取り出せなくなります。','Keep both coordinate components in their intended order.'],
  ['channel-clamp','色成分を表示可能な範囲へ戻す','minとmaxを組み合わせ、赤成分を0〜255へ制限してください。','red = 300\nclamped = ____\nprint(clamped)','max(0, min(255, red))',['min(0, max(255, red))','red % 256'],'上限でmin、下限でmaxを使うと範囲内へ丸められます。剰余は折り返すため色が急変します。','Clamp a color channel instead of wrapping it around.'],
  ['alpha-fraction','透明度の百分率を割合へ直す','100で割り、0〜1の実数へ変換してください。','percent = 25\nalpha = percent ____ 100\nprint(alpha)','/',['//','%'],'/は実数除算です。//では整数的な床除算になるので、25%が0になってしまいます。','Retain fractional opacity when converting from percent.'],
  ['pixel-index','平坦な画像配列の位置を求める','行優先の添字にしてください。','width, x, y = 8, 3, 2\nindex = ____\nprint(index)','y * width + x',['x * width + y','x + y'],'一行width要素のため、y行分を飛ばしてからxを加えます。座標の軸順序を守ります。','Locate a pixel inside a row-major image buffer.'],
  ['rectangle-area','矩形の面積を求める','幅と高さの積を使ってください。','width, height = 3, 4\narea = width ____ height\nprint(area)','*',['+','**'],'面積は独立した二つの長さの積です。和は周囲の長さの計算に近く、面積とは単位も違います。','Measure the covered area from the two dimensions.'],
  ['frame-modulo','スプライトのフレームを循環させる','剰余で0〜count-1のフレームへ戻してください。','tick, count = 17, 6\nframe = tick ____ count\nprint(frame)','%',['//','*'],'正のcountに対する剰余は0以上count未満です。周回するフレーム番号を作れます。','Wrap the animation frame within the available sprites.'],
  ['color-unpacking','RGBの各成分を受け取る','三つの変数へアンパックしてください。','rgb = (255, 128, 0)\n____ = rgb\nprint(red, green, blue)','red, green, blue',['red, blue, green','red'],'成分の並びを守って受け取ると、緑と青の取り違えを防げます。規約上の順序もデータの一部です。','Read the red, green and blue channels in RGB order.']
 ],
 [
  ['distance-hypot','二点の距離を求める','二成分の長さを返すmath.hypotを使ってください。','import math\ndx, dy = 3, 4\ndistance = ____(dx, dy)\nprint(distance)','math.hypot',['math.sqrt','abs'],'hypotは二成分から平方和の平方根を求めます。sqrtは引数一つなので、同じ呼び方にはできません。','Compute the Euclidean distance from both coordinate deltas.'],
  ['angle-radians','度数を三角関数用の角度へ直す','度からラジアンへ変換する関数を使ってください。','import math\nangle = ____(90)\nprint(math.sin(angle))','math.radians',['math.degrees','float'],'radiansは度をラジアンへ変換します。sinなどの三角関数が受け取る単位に合わせます。','Convert editor-facing degrees before evaluating sine.'],
  ['lerp-position','始点と終点の間を補間する','t=0でa、t=1でbになる一次補間式を使ってください。','a, b, t = 10.0, 30.0, 0.25\nx = ____\nprint(x)','a + (b - a) * t',['(a + b) * t','b + (b - a) * t'],'始点aへ差分のt倍を加えます。両端を代入して確認すると式の取り違えを見つけやすくなります。','Interpolate from the start coordinate to the destination.'],
  ['rectangle-hit-test','右端を含まない矩形の当たり判定をする','連鎖比較とandで両軸の範囲を確認してください。','x, y = 3, 4\nleft, top, right, bottom = 0, 0, 10, 10\ninside = ____\nprint(inside)','left <= x < right and top <= y < bottom',['left <= x < right or top <= y < bottom','left < x <= right and top < y <= bottom'],'両軸が範囲内である必要があります。右端と下端を除く規約で隣接する領域の二重判定を減らせます。','Require both coordinates inside the half-open rectangle.'],
  ['negative-world-tile','負の座標もタイルへ変換する','床除算で、0より左にある座標を左隣のタイルへ割り当ててください。','x, tile_width = -1, 16\ncolumn = x ____ tile_width\nprint(column)','//',['/','%'],'Pythonの//は負の無限大へ丸めます。int(x/tile_width)は0へ丸めるため、負側で別のタイルになります。','Choose the tile to the left of zero for a negative position.'],
  ['draw-command-record','描画操作を後で処理できるよう記録する','kindを"sprite"、xを3、yを4とする辞書で、描画の種類と座標を保持してください。','commands = []\ncommands.append(____)\nprint(commands[0]["kind"])','{"kind": "sprite", "x": 3, "y": 4}',['("sprite", 3, 4)','{"sprite", 3, 4}'],'フィールド名を持つ命令データは後で検査や並べ替えができます。ここではkindキーで参照する契約です。','Record a named drawing command for a later pass.'],
  ['palette-map','色名をRGBへ変換する','辞書のgetで未知の色を既定色へ戻してください。','palette = {"red": (255, 0, 0)}\ncolor = palette.____("unknown", (0, 0, 0))\nprint(color)','get',['pop','setdefault'],'getは辞書を変えず、未登録なら指定の値を返します。popは削除、setdefaultは新しいキーの挿入を伴います。','Resolve a palette entry without modifying the palette.'],
  ['sprite-row-slice','画像から一行だけを取り出す','行頭から幅の分だけの半開区間を切り出してください。','pixels = list(range(12))\nwidth, row = 4, 1\nstart = row * width\nline = pixels[____]\nprint(line)','start:start + width',['start:width','row:row + width'],'終端は要素数でなく元配列での位置です。startへwidthを加え、一行の長さを確保します。','Extract exactly one scanline from the flattened pixel data.']
 ],
 [
  ['smoothstep-easing','両端で速度が0になる補間を作る','smoothstepの三次式を使ってください。','t = 0.25\neased = ____\nprint(eased)','t * t * (3 - 2 * t)',['t ** 3','3 * t - 2 * t * t'],'この式は0と1での傾きが0です。入力tを0〜1へ収める処理は、必要なら先に行います。','Ease a transition with stationary endpoint slopes.'],
  ['rotate-point','原点周りの回転を計算する','回転行列のy成分を入れてください。','import math\nx, y, angle = 1.0, 0.0, math.pi / 2\nc, s = math.cos(angle), math.sin(angle)\nrotated = (x * c - y * s, ____)\nprint(rotated)','x * s + y * c',['x * c + y * s','x * s - y * c'],'標準の2D回転行列では、y成分はx sinθ＋y cosθです。座標系の上下方向の規約にも注意します。','Rotate both point components with the same angle.'],
  ['aspect-fit','縦横比を保って画像全体を収める','幅と高さの比の小さい方を選んでください。','view_w, view_h = 800, 600\nimage_w, image_h = 640, 480\nscale = ____(view_w / image_w, view_h / image_h)\nprint(scale)','min',['max','sum'],'小さい倍率なら画像全体が画面内に収まります。maxでは画面を覆いますが一部がはみ出す場合があります。','Fit all of the source image while preserving its shape.'],
  ['premultiplied-alpha','透明度を色へ事前に掛ける','RGB各成分へalphaを掛ける内包表記にしてください。','rgb, alpha = (0.8, 0.4, 0.2), 0.25\npremultiplied = tuple(____ for channel in rgb)\nprint(premultiplied)','channel * alpha',['channel / alpha','channel + alpha'],'乗算済みアルファ形式では色を先にα倍します。描画側もその形式に対応したブレンドを使う必要があります。','Prepare every channel for premultiplied-alpha blending.'],
  ['ping-pong-phase','往復する位置を位相から求める','周期2の三角波で0→1→0を作ってください。','phase = 1.5 % 2\nposition = ____\nprint(position)','1 - abs(phase - 1)',['abs(phase)','phase / 2'],'位相1からの距離を1から引くと、前半で増加し後半で減少します。単なる剰余の折り返しと違い値がつながります。','Reverse the motion continuously at the end of each half-cycle.'],
  ['delta-clamp','長い停止後の移動を抑える','経過秒数と最大値の小さい方を使ってください。','elapsed, max_delta = 2.0, 0.05\ndelta = ____(elapsed, max_delta)\nprint(delta)','min',['max','abs'],'復帰時の大きすぎる時間幅を制限し、物体が一度に飛ぶのを抑えます。時刻補償の方針は別途必要です。','Bound one movement update after a long frame pause.'],
  ['depth-sort','奥から手前の順に描画する','depthは大きいほど奥とします。sortedのkeyで各命令のdepthを返し、降順に並べてください。','commands = [{"name": "front", "depth": 1}, {"name": "back", "depth": 9}]\nordered = sorted(commands, key=____, reverse=True)\nprint([command["name"] for command in ordered])','lambda command: command["depth"]',['lambda command: command["name"]','lambda command: 0'],'ここではdepthが大きいほど奥という規約です。keyを使うと表示名など無関係な項目に左右されません。','Sort drawing commands by their declared depth convention.'],
  ['fixed-step-loop','一定の時間幅で物理更新する','蓄積時間が一刻み分以上あるときだけ更新してください。','accumulator, step = 0.05, 0.02\nupdates = 0\nwhile ____:\n    accumulator -= step\n    updates += 1\nprint(updates, accumulator)','accumulator >= step',['accumulator > 0','accumulator <= step'],'一回の更新に必要な時間が揃ったときだけ消費します。残りが正という条件では余分に進めてしまいます。','Retain incomplete time while consuming full simulation steps.']
 ],
 [
  ['affine-determinant','逆変換に必要な行列式を求める','2×2行列の行列式ad−bcを計算してください。','a, b, c, d = 2.0, 0.0, 0.0, 3.0\ndeterminant = ____\nprint(determinant)','a * d - b * c',['a * c - b * d','a * d + b * c'],'行列式が0なら逆変換は作れません。ほぼ0のときも数値誤差が大きくなるため実装では許容差を設けます。','Check whether the affine basis can be inverted.'],
  ['letterbox-center','拡大後の画像を中央へ置く','拡大済み幅を引いた残りを2で割ってください。','viewport_w, content_w, scale = 1000, 640, 1.25\noffset_x = ____\nprint(offset_x)','(viewport_w - content_w * scale) / 2',['viewport_w - content_w * scale / 2','(viewport_w - content_w) / scale'],'まず実際の描画幅を求め、残りを左右へ均等に分けます。演算順序を括弧で明示します。','Center the scaled content within the unused viewport width.'],
  ['short-turn','0度をまたいで最短方向へ回す','角度差を[-180,180)へ正規化してください。','start, target = 350.0, 10.0\ndifference = ____\nprint(difference)','(target - start + 180) % 360 - 180',['target - start','(target - start) % 360'],'正規化した差なら350度から10度へ20度だけ回せます。Pythonの正の除数の剰余は非負です。','Choose the shorter signed turn across the degree boundary.'],
  ['bezier-control','二次ベジェの中央制御点を重み付けする','中央点bの係数を入れてください。','a, b, c, t = 0.0, 10.0, 0.0, 0.5\nu = 1 - t\nvalue = u * u * a + ____ * b + t * t * c\nprint(value)','2 * u * t',['u * t','2 * t * t'],'二次ベジェの重みはu²、2ut、t²です。重みの合計は1になり、中央制御点が曲線を引きます。','Apply the middle Bernstein weight to the control point.'],
  ['barycentric-attribute','三角形上で頂点値を補間する','対応する頂点と重みをzipで組にして積を足してください。','values = (10.0, 20.0, 40.0)\nweights = (0.2, 0.3, 0.5)\ninterpolated = sum(____ for value, weight in zip(values, weights))\nprint(interpolated)','value * weight',['value + weight','value / weight'],'重心座標を対応する頂点へ掛けます。重みの合計が1という前提で属性を位置に応じて補間できます。','Weight each vertex attribute by its matching barycentric coordinate.'],
  ['perspective-divide','同次座標を正規化する','xとyをwで割ってください。ここではwが正であるとします。','clip_x, clip_y, w = 4.0, 2.0, 2.0\nndc = (clip_x / ____, clip_y / w)\nprint(ndc)','w',['clip_y','1'],'同次座標をwで割ると透視除算になります。wが0近くのときや画面外の点は別のクリッピング処理が必要です。','Normalize clip coordinates by the homogeneous component.'],
  ['srgb-low-segment','暗いsRGB値を線形へ変換する','低輝度の線形区間では12.92で割ってください。','encoded = 0.02\nlinear = encoded / ____\nprint(linear)','12.92',['2.2','255'],'sRGBは全域が単純なべき乗ではありません。低輝度区間はこの線形式で変換します。','Decode the low-intensity linear segment of the sRGB transfer.'],
  ['normalization-zero','方向のないベクトルを守る','長さが正のときだけ割り算する条件にしてください。','import math\nx, y = 0.0, 0.0\nlength = math.hypot(x, y)\nif ____:\n    x, y = x / length, y / length\nprint(x, y)','length > 0',['length >= 0','length == 0'],'ゼロベクトルは正規化できません。長さ0を除外して0除算を防ぎ、向きがない状態をそのまま扱います。','Keep a zero vector safe while normalizing other directions.']
 ]
];

const PYTHON_SYSTEMS = [
 [
  ['text-buffer','文字列を読み込み元として扱う','io.StringIOでメモリー上のテキストストリームを作ってください。','from io import StringIO\nsource = ____("save-data")\nprint(source.read())','StringIO',['BytesIO','str'],'StringIOは文字列の入出力をストリームとして扱います。BytesIOはバイト列用なので入力の型も異なります。','Use an in-memory text source instead of a real file.'],
  ['json-serialize','状態をJSON文字列へ変換する','json.dumpsで辞書を文字列にしてください。','import json\nstate = {"level": 2}\npayload = json.____(state)\nprint(payload)','dumps',['loads','dump'],'dumpsは文字列を返します。dumpはファイルなど書き込み先も引数に取り、loadsは逆変換です。','Serialize structured state before storing or transmitting it.'],
  ['path-component','パスを部品から組み立てる','Pathの/演算子でファイル名を結合してください。','from pathlib import Path\nfolder = Path("saves")\npath = folder ____ "slot.json"\nprint(path.name)','/',['+','//'],'Pathは/でパス要素を結合します。文字列の区切りを手で足すより環境差を扱いやすくなります。','Join a save filename using path-aware composition.'],
  ['text-encoding','送信する文字列をバイト列へ変換する','文字列のencodeでUTF-8へ変換してください。','text = "ready"\npayload = text.____("utf-8")\nprint(type(payload).__name__)','encode',['decode','hex'],'encodeは文字列をバイト列へ変換します。ファイルや通信で使う文字コードを明示します。','Encode text explicitly at the binary I/O boundary.'],
  ['specific-exception','変換失敗だけを捕捉する','int変換で起こるValueErrorを指定してください。','try:\n    count = int("invalid")\nexcept ____:\n    count = 0\nprint(count)','ValueError',['KeyError','IndexError'],'期待している型の失敗だけを捕捉すれば、無関係なバグまで既定値に隠すことを避けられます。','Handle only the expected numeric parsing failure.'],
  ['logging-format','ログへ変数を渡す','loggingの書式へ整数用のプレースホルダーを入れてください。','import logging\nlogging.basicConfig(level=logging.INFO)\nlogging.info("loaded ____ records", 3)','%d',['{}','{records}'],'loggingはメッセージと引数を分ける%形式を使えます。無効なレベルでは整形を遅延できる利点もあります。','Pass structured log arguments for deferred formatting.'],
  ['csv-reader','引用符を含むCSVを正しく読む','csv.readerを使い、単純なカンマ分割を避けてください。','import csv\nfrom io import StringIO\nsource = StringIO(\'name,note\\nAda,"one,two"\\n\')\nrows = list(csv.____(source))\nprint(rows[1][1])','reader',['writer','DictWriter'],'CSVでは引用された値の中にカンマが入ります。形式を理解するreaderで一つのフィールドとして読みます。','Respect quoted commas when reading CSV fields.'],
  ['bytes-length','通信ペイロードのバイト数を数える','バイト列に対してlenを使ってください。','payload = "猫".encode("utf-8")\nbyte_count = ____(payload)\nprint(byte_count)','len',['str','sum'],'送信サイズの上限は文字数でなくエンコード後のバイト数で確認します。Unicode文字は複数バイトになる場合があります。','Measure encoded bytes for a payload size limit.']
 ],
 [
  ['with-cleanup','ストリームを自動で閉じる','withを使い、正常終了でも例外でもcloseされるようにしてください。','from io import StringIO\n____ StringIO("ready") as source:\n    print(source.read())\nprint(source.closed)','with',['for','try'],'withはコンテキストマネージャーの終了処理を呼びます。正常経路だけにcloseを書くより後片付け漏れを減らせます。','Close the text stream at the scope boundary.'],
  ['temporary-directory','一時ディレクトリを後片付けする','TemporaryDirectoryをwithで管理してください。','from tempfile import TemporaryDirectory\nfrom pathlib import Path\nwith ____() as folder:\n    path = Path(folder) / "slot.txt"\n    path.write_text("ready", encoding="utf-8")\n    print(path.read_text(encoding="utf-8"))','TemporaryDirectory',['Path','str'],'TemporaryDirectoryはスコープ終了時に配下を削除します。名前の衝突と後片付けを自前で扱う量を減らせます。','Keep temporary save files inside a self-cleaning directory.'],
  ['binary-layout','固定のバイト順で整数を復元する','structの書式でビッグエンディアンの符号なし32bit整数を指定してください。','import struct\npacket = b"\\x00\\x00\\x00\\x07"\nvalue, = struct.unpack(____, packet)\nprint(value)','">I"',['"<I"','">h"'],'>はビッグエンディアン、Iは32bitの符号なし整数です。通信相手のサイズとバイト順の両方へ合わせます。','Decode the network packet using its fixed endian layout.'],
  ['shell-tokenization','引用符付きコマンドを分解する','shlex.splitで引用された空白を一つの引数として残してください。','import shlex\ncommand = \'load "slot one"\'\nparts = ____(command)\nprint(parts)','shlex.split',['str.split','list'],'shlexはシェルに似た引用規則で分解します。OSのコマンドを実行する必要はなく、ただの文字列処理として使えます。','Keep a quoted save name together while parsing a command.'],
  ['digest-bytes','データのSHA-256を求める','payloadをUTF-8のバイト列へエンコードしてhashlib.sha256へ渡してください。','import hashlib\npayload = "save"\ndigest = hashlib.sha256(____).hexdigest()\nprint(len(digest))','payload.encode("utf-8")',['payload','str(payload)'],'ハッシュ関数はバイト列を受け取ります。保存データはUTF-8に統一します。別のエンコードでは同じ文字列でもハッシュ値が変わるため、結果を比較するにはエンコードの規約を固定します。','Hash the explicitly encoded save bytes.'],
  ['secure-token','推測されにくい識別子を作る','secrets.token_hexでランダムなトークンを作ってください。','import secrets\ntoken = secrets.____(16)\nprint(len(token))','token_hex',['randbelow','choice'],'token_hexは指定バイト数の乱数を16進文字列へ変えます。認証用途には通常のrandomよりsecretsを使います。','Generate a token suitable for an unguessable identifier.'],
  ['deque-queue','先頭から効率よく取り出す','dequeのpopleftで到着順に取り出してください。','from collections import deque\nqueue = deque(["first", "second"])\nprint(queue.____())','popleft',['pop','remove'],'popleftは先頭を取り出します。list.pop(0)のように残り全要素をずらす必要がなく、キューに向いています。','Process the oldest queued event first.'],
  ['counter-frequency','イベント別の件数を数える','Counterで各文字列の出現回数を集計してください。','from collections import Counter\nevents = ["save", "move", "save"]\ncounts = ____(events)\nprint(counts["save"])','Counter',['set','list'],'Counterは要素ごとの出現回数を数える辞書型です。集合では種類は残りますが回数は失われます。','Count repeated event names without manual bookkeeping.']
 ],
 [
  ['generator-read-chunks','大きな入力を小分けに読む','読み取れたchunkが空ならループを終えてください。','from io import StringIO\ndef chunks(source, size):\n    while True:\n        chunk = source.read(size)\n        if not chunk:\n            ____\n        yield chunk\nprint(list(chunks(StringIO("abcdef"), 2)))','break',['continue','pass'],'EOFで空になったらbreakしないと、空の結果を返し続ける無限ループになります。','Stop chunked streaming when the source is exhausted.'],
  ['thread-lock','共有状態の更新をロックする','Lockをwithで取得し、例外時にも解放してください。','from threading import Lock\nlock = Lock()\nstate = {"count": 0}\n____ lock:\n    state["count"] += 1\nprint(state["count"])','with',['for','while'],'Lockはコンテキストマネージャーとして使えます。複数の操作からなる共有状態の更新を同じ保護区間に置きます。','Hold and release the lock around the whole state update.'],
  ['thread-queue','スレッド間のデータを受け渡す','Queueのgetで格納したメッセージを取り出してください。','from queue import Queue\nmessages = Queue()\nmessages.put("save")\nmessage = messages.____()\nmessages.task_done()\nprint(message)','get',['pop','join'],'Queueはスレッド間の受け渡しを同期します。joinは取り出しではなく、全タスクの完了を待つメソッドです。','Receive a synchronized work item before marking it done.'],
  ['executor-map','独立した処理を並行化する','ThreadPoolExecutorのmapで入力順の結果を受け取ってください。','from concurrent.futures import ThreadPoolExecutor\ndef square(value):\n    return value * value\nwith ThreadPoolExecutor(max_workers=2) as pool:\n    results = list(pool.____(square, [2, 3, 4]))\nprint(results)','map',['submit','shutdown'],'executor.mapは複数の入力へ処理を適用し、結果を入力順に返します。submitは一回の呼び出しへFutureを返します。','Run independent jobs while retaining input order in the result.'],
  ['await-coroutine','非同期処理の結果を待つ','awaitでコルーチンを実行し、結果を受け取ってください。','import asyncio\nasync def load():\n    await asyncio.sleep(0)\n    return "ready"\nasync def main():\n    result = ____ load()\n    print(result)\nasyncio.run(main())','await',['yield','return'],'async関数を呼ぶだけではコルーチンオブジェクトです。awaitすると完了を待ち、その戻り値を受け取れます。','Wait for the asynchronous load before using its result.'],
  ['async-gather','複数の非同期結果をまとめる','asyncio.gatherで二つのコルーチンの結果を集めてください。','import asyncio\nasync def load(name):\n    await asyncio.sleep(0)\n    return name\nasync def main():\n    results = await asyncio.____(load("a"), load("b"))\n    print(results)\nasyncio.run(main())','gather',['sleep','create_task'],'gatherは複数のawait可能な処理を進め、引数順の結果を返します。失敗時の他タスクの扱いはTaskGroupとも違います。','Collect multiple asynchronous results in a defined order.'],
  ['contextmanager-finally','一時的な状態を必ず戻す','contextmanagerのfinallyで、元の設定を復元してください。','from contextlib import contextmanager\n@contextmanager\ndef temporary_mode(state, mode):\n    old = state["mode"]\n    state["mode"] = mode\n    try:\n        yield\n    finally:\n        ____\nstate = {"mode": "play"}\nwith temporary_mode(state, "pause"):\n    print(state["mode"])\nprint(state["mode"])','state["mode"] = old',['state["mode"] = mode','old = state["mode"]'],'yieldの後に例外が戻ってきてもfinallyは実行されます。復元対象は保存しておいた元の値です。','Restore the previous mode whenever the temporary scope ends.'],
  ['exit-stack','動的な数の資源をまとめて管理する','ExitStackのenter_contextでwith相当の管理下へ追加してください。','from contextlib import ExitStack\nfrom io import StringIO\nwith ExitStack() as stack:\n    sources = [stack.____(StringIO(text)) for text in ["a", "b"]]\n    print([source.read() for source in sources])\nprint(all(source.closed for source in sources))','enter_context',['callback','push'],'enter_contextは__enter__を呼び、その__exit__を後片付けとして登録します。callbackは通常の終了コールバック用です。','Manage a runtime-sized collection of opened resources.']
 ],
 [
  ['task-group','子タスクの寿命をスコープへ揃える','asyncio.TaskGroupで全子タスクを管理してください。','import asyncio\nasync def load(name):\n    await asyncio.sleep(0)\n    return name\nasync def main():\n    async with asyncio.____() as group:\n        a = group.create_task(load("a"))\n        b = group.create_task(load("b"))\n    print(a.result(), b.result())\nasyncio.run(main())','TaskGroup',['Queue','Lock'],'TaskGroupは終了前に子タスクを待ち、失敗時は残りを中止する構造化された管理を行います。Python3.11以降の機能です。','Keep all child tasks within a structured lifetime.'],
  ['async-timeout','非同期処理へ締切を設定する','asyncio.timeoutで待機区間に時間制限を付けてください。','import asyncio\nasync def main():\n    async with asyncio.____(1):\n        await asyncio.sleep(0)\n    print("finished")\nasyncio.run(main())','timeout',['sleep','gather'],'timeoutは非同期コンテキストマネージャーです。内部処理が時間内に終わらなければキャンセルし、外へTimeoutErrorを伝えます。','Apply a deadline to one asynchronous scope.'],
  ['async-cancel-cleanup','中止された処理も後片付けする','finallyで資源解放の記録を必ず残してください。','import asyncio\nasync def worker(cleanup):\n    try:\n        await asyncio.sleep(10)\n    ____:\n        cleanup.append("closed")\nasync def main():\n    cleanup = []\n    task = asyncio.create_task(worker(cleanup))\n    await asyncio.sleep(0)\n    task.cancel()\n    try:\n        await task\n    except asyncio.CancelledError:\n        pass\n    print(cleanup)\nasyncio.run(main())','finally',['except ValueError','else'],'キャンセルでもfinallyを通るため後片付けを集約できます。CancelledErrorを無闇に握りつぶすと上位の制御を壊します。','Run cleanup even when the worker is cancelled.'],
  ['async-semaphore','同時実行の上限を設ける','async withでセマフォを取得し、終了時に返してください。','import asyncio\nasync def work(limit, value):\n    ____ limit:\n        await asyncio.sleep(0)\n        return value * value\nasync def main():\n    limit = asyncio.Semaphore(2)\n    print(await asyncio.gather(*(work(limit, value) for value in range(4))))\nasyncio.run(main())','async with',['with','async for'],'非同期セマフォの取得は待機可能な操作です。async withなら例外やキャンセル時も枠を返せます。','Bound concurrent jobs while safely returning their slots.'],
  ['async-generator','結果を非同期に一つずつ読む','async forで非同期生成器を反復してください。','import asyncio\nasync def events():\n    for name in ("spawn", "save"):\n        await asyncio.sleep(0)\n        yield name\nasync def main():\n    ____ name in events():\n        print(name)\nasyncio.run(main())','async for',['for','await for'],'非同期イテレーターは次の値の取得で待機できるためasync forを使います。通常のforでは契約が違います。','Consume asynchronously produced events without blocking.'],
  ['resource-closing','with未対応のclose可能な資源を管理する','contextlib.closingで終了時にcloseを呼んでください。','from contextlib import closing\nclass Resource:\n    def __init__(self):\n        self.closed = False\n    def close(self):\n        self.closed = True\nresource = Resource()\nwith ____(resource):\n    print(resource.closed)\nprint(resource.closed)','closing',['suppress','nullcontext'],'closingは__enter__/__exit__を持たないがcloseを持つ資源へ使えます。nullcontextは終了時にcloseしません。','Adapt a close-only resource to a managed scope.'],
  ['sqlite-parameters','値をSQL文へ安全に渡す','プレースホルダーへ一要素タプルで値を渡してください。','import sqlite3\nwith sqlite3.connect(":memory:") as connection:\n    connection.execute("CREATE TABLE scores (name TEXT)")\n    name = "Ada\'s save"\n    connection.execute("INSERT INTO scores VALUES (?)", ____)\n    print(connection.execute("SELECT name FROM scores").fetchone()[0])','(name,)',['name','(name)'],'バインド値はシーケンスとして渡します。(name)は文字列のままですが、末尾のカンマで一要素タプルになります。','Bind the value instead of interpolating it into SQL text.'],
  ['incremental-hash','分割入力のハッシュを逐次計算する','同じハッシュオブジェクトのupdateへ各チャンクを渡してください。','import hashlib\ndigest = hashlib.sha256()\nfor chunk in [b"save", b"-data"]:\n    digest.____(chunk)\nprint(digest.hexdigest() == hashlib.sha256(b"save-data").hexdigest())','update',['digest','hexdigest'],'updateはそれまでの状態へ新しいバイト列を加えます。全データを連結して持たずに同じ結果を得られます。','Hash a stream incrementally without keeping every chunk.']
 ]
];

const PYTHON_PREREQUISITES = {
 'syntax/list-comprehension':['syntax/negative-index','syntax/boolean-and'],
 'syntax/dict-comprehension':['syntax/dictionary-lookup','syntax/tuple-unpack'],
 'syntax/set-comprehension':['syntax/set-literal','syntax/list-comprehension'],
 'syntax/star-arguments':['syntax/tuple-unpack','design/return-value'],
 'syntax/slice-step':['syntax/negative-index'],
 'syntax/enumerate-start':['syntax/tuple-unpack'],
 'syntax/zip-pairs':['syntax/tuple-unpack'],
 'syntax/conditional-expression':['syntax/boolean-and'],
 'syntax/assignment-expression':['syntax/assignment'],
 'syntax/sequence-pattern':['syntax/tuple-unpack'],
 'syntax/positional-only':['design/return-value'],
 'syntax/keyword-only':['syntax/enumerate-start','design/return-value'],
 'syntax/decode-bytes':['systems/text-encoding'],
 'syntax/type-annotation':['design/return-value'],
 'syntax/mapping-unpack':['syntax/dictionary-lookup'],
 'syntax/exception-binding':['systems/specific-exception'],
 'syntax/yield-from':['design/iterable-interface'],
 'syntax/nonlocal-state':['design/factory-function'],
 'syntax/chained-comparison':['syntax/boolean-and'],
 'syntax/extended-unpacking':['syntax/tuple-unpack'],
 'syntax/decimal-string':['syntax/assignment'],
 'syntax/raw-regex':['syntax/f-string'],
 'syntax/keyword-collection':['syntax/mapping-unpack','syntax/keyword-only'],
 'syntax/literal-type':['syntax/type-annotation'],
 'design/safe-default-list':['syntax/none-identity','design/return-value'],
 'design/dataclass-fields':['design/instance-attribute','syntax/type-annotation'],
 'design/property-getter':['design/instance-attribute'],
 'design/class-factory':['design/instance-attribute'],
 'design/static-helper':['design/return-value'],
 'design/early-guard':['design/return-value'],
 'design/super-initialization':['design/instance-attribute'],
 'design/composition':['design/instance-attribute'],
 'design/protocol-contract':['syntax/type-annotation','design/composition'],
 'design/callable-annotation':['syntax/type-annotation'],
 'design/factory-function':['design/return-value'],
 'design/deep-copy':['design/safe-default-list','syntax/dictionary-lookup'],
 'design/frozen-data':['design/dataclass-fields'],
 'design/enum-values':['design/instance-attribute'],
 'design/cached-property':['design/property-getter'],
 'design/wraps-metadata':['design/factory-function','syntax/keyword-collection'],
 'design/parameterized-decorator':['design/wraps-metadata'],
 'design/single-dispatch':['design/wraps-metadata','syntax/type-annotation'],
 'design/iterable-interface':['design/return-value'],
 'design/default-factory':['design/dataclass-fields','design/safe-default-list'],
 'design/replace-value':['design/frozen-data'],
 'design/injected-clock':['design/factory-function','design/callable-annotation'],
 'design/generic-container':['syntax/type-annotation','design/instance-attribute'],
 'design/abstract-contract':['design/super-initialization'],
 'design/exception-chaining':['syntax/exception-binding'],
 'design/named-tuple':['syntax/tuple-unpack','syntax/type-annotation'],
 'design/keyword-only-dataclass':['design/dataclass-fields','syntax/keyword-only'],
 'design/class-pattern':['syntax/sequence-pattern','design/dataclass-fields'],
 'design/context-manager-protocol':['design/instance-attribute','systems/with-cleanup'],
 'design/overload-contract':['syntax/type-annotation','design/wraps-metadata'],
 'graphics/distance-hypot':['graphics/point-components'],
 'graphics/lerp-position':['graphics/relative-movement'],
 'graphics/rectangle-hit-test':['graphics/point-components','syntax/chained-comparison'],
 'graphics/negative-world-tile':['graphics/pixel-index'],
 'graphics/draw-command-record':['syntax/dictionary-lookup'],
 'graphics/palette-map':['syntax/dictionary-lookup'],
 'graphics/sprite-row-slice':['graphics/pixel-index','syntax/slice-step'],
 'graphics/smoothstep-easing':['graphics/lerp-position'],
 'graphics/rotate-point':['graphics/point-components','graphics/angle-radians'],
 'graphics/aspect-fit':['graphics/rectangle-area'],
 'graphics/premultiplied-alpha':['graphics/alpha-fraction','syntax/list-comprehension'],
 'graphics/ping-pong-phase':['graphics/frame-modulo','graphics/lerp-position'],
 'graphics/delta-clamp':['graphics/relative-movement'],
 'graphics/depth-sort':['graphics/draw-command-record','design/factory-function'],
 'graphics/fixed-step-loop':['graphics/delta-clamp'],
 'graphics/affine-determinant':['graphics/rotate-point'],
 'graphics/letterbox-center':['graphics/aspect-fit'],
 'graphics/short-turn':['graphics/angle-radians','graphics/frame-modulo'],
 'graphics/bezier-control':['graphics/lerp-position'],
 'graphics/barycentric-attribute':['graphics/lerp-position','syntax/zip-pairs'],
 'graphics/perspective-divide':['graphics/point-components','graphics/alpha-fraction'],
 'graphics/srgb-low-segment':['graphics/channel-clamp','graphics/alpha-fraction'],
 'graphics/normalization-zero':['graphics/distance-hypot'],
 'systems/with-cleanup':['systems/text-buffer'],
 'systems/temporary-directory':['systems/with-cleanup','systems/path-component'],
 'systems/binary-layout':['syntax/tuple-unpack','systems/bytes-length'],
 'systems/shell-tokenization':['syntax/f-string'],
 'systems/digest-bytes':['systems/text-encoding'],
 'systems/secure-token':['systems/bytes-length'],
 'systems/deque-queue':['syntax/negative-index'],
 'systems/counter-frequency':['syntax/dictionary-lookup'],
 'systems/generator-read-chunks':['systems/text-buffer','design/iterable-interface'],
 'systems/thread-lock':['systems/with-cleanup'],
 'systems/thread-queue':['systems/deque-queue','systems/thread-lock'],
 'systems/executor-map':['systems/with-cleanup','syntax/list-comprehension'],
 'systems/await-coroutine':['design/return-value'],
 'systems/async-gather':['systems/await-coroutine'],
 'systems/contextmanager-finally':['systems/with-cleanup','design/iterable-interface'],
 'systems/exit-stack':['systems/with-cleanup','syntax/list-comprehension'],
 'systems/task-group':['systems/async-gather','systems/with-cleanup'],
 'systems/async-timeout':['systems/await-coroutine','systems/with-cleanup'],
 'systems/async-cancel-cleanup':['systems/await-coroutine','systems/contextmanager-finally'],
 'systems/async-semaphore':['systems/async-gather','systems/with-cleanup'],
 'systems/async-generator':['systems/await-coroutine','design/iterable-interface'],
 'systems/resource-closing':['systems/with-cleanup','design/instance-attribute'],
 'systems/sqlite-parameters':['syntax/tuple-unpack','systems/with-cleanup'],
 'systems/incremental-hash':['systems/digest-bytes','systems/generator-read-chunks']
};
export const PYTHON_SKILL_QUIZZES = linkPrerequisites([...pythonRows('syntax',PYTHON_SYNTAX),...pythonRows('design',PYTHON_DESIGN),...pythonRows('graphics',PYTHON_GRAPHICS),...pythonRows('systems',PYTHON_SYSTEMS)],PYTHON_PREREQUISITES);
