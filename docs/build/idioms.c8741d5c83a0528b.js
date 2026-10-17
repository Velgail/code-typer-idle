// Language-specific examples supplement the shared algorithm exercises.
// Code is original; no external repository is attributed or copied.
const note=(en,ja)=>({en,ja});
const item=(id,title,a,b,body,answer,explanation,headers=[])=>({id,title,comments:[note(...a),note(...b)],body,answer,explanation,headers});
const camel=id=>id.replace(/_([a-z])/g,(_,c)=>c.toUpperCase());
const nameFor=(lang,id)=>lang==='csharp'?camel(id)[0].toUpperCase()+camel(id).slice(1):['java','go'].includes(lang)?camel(id):id;
export const IDIOMS = {
 cpp: {
 syntax: [
 item('cpp_vector_sum','vectorと範囲for',['A vector owns a sequence of collected rewards.','vectorは拾った報酬の列を所有する。'],['A range loop visits each reward without indexing.','範囲forで添字を使わずに各報酬を読む。'],v=>`$0\nstd::vector<int> coins{${v+2}, 4, 7};\nint total = 0;\n$1\nfor (int coin : coins) {\n    total += coin;\n}\nreturn total;`,v=>v+13,v=>`${v+2} + 4 + 7 = ${v+13}。`,['vector']),
 item('cpp_map_lookup','mapの検索',['A map associates item names with quantities.','mapは品名と個数を対応付ける。'],['Find checks existence without inserting a missing key.','findは存在しないキーを追加せずに検索する。'],v=>`$0\nstd::map<std::string, int> stock{{"potion", ${v+3}}};\n$1\nauto found = stock.find("potion");\nreturn found == stock.end() ? 0 : found->second;`,v=>v+3,v=>`potionは登録済みなので、保存された${v+3}を返す。`,['map','string'])
 ],
 design: [
 item('cpp_struct_method','構造体へ振る舞いを持たせる',['A player keeps health and healing rules together.','プレイヤーの体力と回復ルールをまとめる。'],['The member function changes this player only.','メンバー関数はこのプレイヤーだけを変更する。'],v=>`$0\nstruct Player {\n    int health;\n    void heal(int amount) { health += amount; }\n};\nPlayer player{${v+10}};\n$1\nplayer.heal(5);\nreturn player.health;`,v=>v+15,v=>`初期体力${v+10}へ5を加えると${v+15}。`),
 item('cpp_lambda_policy','ラムダで報酬ルールを渡す',['A lambda captures the current reward multiplier.','ラムダは現在の報酬倍率を取り込む。'],['Capturing by value preserves a snapshot of the multiplier.','値キャプチャは取り込んだ時点の倍率を保つ。'],v=>`int multiplier = ${v+2};\n$0\nauto reward = [multiplier](int coins) {\n    return coins * multiplier;\n};\nmultiplier = 99;\n$1\nreturn reward(3);`,v=>(v+2)*3,v=>`値キャプチャした倍率は${v+2}のまま。3 × ${v+2} = ${(v+2)*3}。`)
 ],
 graphics: [
 item('cpp_pixel_array','配列に画素を並べる',['A fixed array stores a row of pixel intensities.','固定長配列に画素の明るさを1行分保存する。'],['The final subscript selects the third pixel.','最後の添字は3番目の画素を選ぶ。'],v=>`$0\nstd::array<int, 4> pixels{8, ${v+20}, 40, 60};\npixels[2] += pixels[1];\n$1\nreturn pixels[2];`,v=>v+60,v=>`添字2の40に添字1の${v+20}を加える。結果は${v+60}。`,['array']),
 item('cpp_sprite_sort','描画順をソートする',['Draw depths can be sorted before rendering sprites.','スプライトを描く前に奥行きを並べ替えられる。'],['The first sorted value is the smallest depth.','並べ替え後の先頭は最小の奥行きである。'],v=>`$0\nstd::vector<int> depths{${v+10}, 4, 30};\nstd::sort(depths.begin(), depths.end());\n$1\nreturn depths.front();`,()=>4,()=>`昇順に並べると先頭は4。`,['algorithm','vector'])
 ],
 systems: [
 item('cpp_unique_owner','unique_ptrで所有する',['A unique pointer gives this scope sole ownership.','unique_ptrでこのスコープだけが値を所有する。'],['Moving ownership leaves the original pointer empty.','所有権を移すと元のポインターは空になる。'],v=>`$0\nauto source = std::make_unique<int>(${v+7});\nauto target = std::move(source);\n$1\nreturn source ? -1 : *target;`,v=>v+7,v=>`sourceは空になり、targetの指す${v+7}を返す。`,['memory','utility']),
 item('cpp_raii_scope','スコープ終了で後始末する',['An RAII guard applies cleanup when its scope ends.','RAIIのガードはスコープ終了時に後始末を実行する。'],['The destructor runs before the final return.','最後のreturnより前にデストラクターが動く。'],v=>`int count = ${v};\n$0\nstruct Guard {\n    int& value;\n    ~Guard() { value += 5; }\n};\n{\n    Guard guard{count};\n}\n$1\nreturn count;`,v=>v+5,v=>`内側のスコープ終了時に5を加える。${v} + 5 = ${v+5}。`)
 ]},
 csharp: {
 syntax: [
 item('csharp_list_filter','Listを条件で集計する',['A generic list stores integer scores.','ジェネリックなListに整数の得点を保存する。'],['Only scores at least ten contribute to the total.','10以上の得点だけを合計へ加える。'],v=>`$0\nvar scores = new System.Collections.Generic.List<int> { 4, ${v+10}, 20 };\nint total = 0;\n$1\nforeach (int score in scores) {\n    if (score >= 10) total += score;\n}\nreturn total;`,v=>v+30,v=>`4を除き、${v+10}と20を合計すると${v+30}。`),
 item('csharp_nullable_value','null許容値の既定値',['A nullable integer may have no saved value.','null許容の整数には保存値がない場合がある。'],['Null coalescing chooses a fallback only for null.','null合体演算子は値がnullのときだけ既定値を選ぶ。'],v=>`$0\nint? saved = ${v%2?'null':v+5};\n$1\nreturn saved ?? ${v+20};`,v=>v%2?v+20:v+5,v=>v%2?`savedはnullなので既定値${v+20}を返す。`:`savedには${v+5}があるので、その値を返す。`)
 ],
 design: [
 item('csharp_delegate','デリゲートで通知する',['A delegate holds a callback for a score event.','デリゲートに得点通知のコールバックを保存する。'],['Calling the delegate updates the captured total.','デリゲートの呼び出しで取り込んだ合計を更新する。'],v=>`int total = ${v};\n$0\nSystem.Action<int> onScore = points => total += points;\n$1\nonScore(7);\nonScore(3);\nreturn total;`,v=>v+10,v=>`通知で7、次に3を加える。${v} + 7 + 3 = ${v+10}。`),
 item('csharp_interface_map','インターフェース越しに使う',['An interface describes the dictionary operations in use.','インターフェースで使用する辞書の操作を表す。'],['TryGetValue reports whether the requested key exists.','TryGetValueは指定キーが存在するかも返す。'],v=>`$0\nSystem.Collections.Generic.IDictionary<string, int> stock =\n    new System.Collections.Generic.Dictionary<string, int>();\nstock["key"] = ${v+8};\nint value;\n$1\nreturn stock.TryGetValue("key", out value) ? value : 0;`,v=>v+8,v=>`keyは登録済み。取り出した${v+8}を返す。`)
 ],
 graphics: [
 item('csharp_linq_pixels','LINQで明るさを集計する',['A projection doubles each pixel intensity.','射影で各画素の明るさを2倍にする。'],['Sum evaluates the projected sequence.','Sumで射影した列を評価して合計する。'],v=>`int[] pixels = { ${v+2}, 4, 6 };\n$0\nvar bright = System.Linq.Enumerable.Select(pixels, pixel => pixel * 2);\n$1\nreturn System.Linq.Enumerable.Sum(bright);`,v=>(v+12)*2,v=>`(${v+2} + 4 + 6) × 2 = ${(v+12)*2}。`),
 item('csharp_rect_tuple','矩形をタプルで返す',['A tuple keeps a rectangle width and height together.','タプルで矩形の幅と高さをまとめる。'],['Multiply both tuple components to obtain the area.','タプルの両要素を掛けて面積を求める。'],v=>`$0\nvar size = System.Tuple.Create(${v+3}, 4);\n$1\nreturn size.Item1 * size.Item2;`,v=>(v+3)*4,v=>`幅${v+3} × 高さ4 = ${(v+3)*4}。`)
 ],
 systems: [
 item('csharp_dictionary_cache','辞書でキャッシュを更新する',['A dictionary reuses the value stored for a cache key.','辞書でキャッシュキーに保存した値を再利用する。'],['Updating one key does not add another entry.','同じキーの更新では項目数は増えない。'],v=>`$0\nvar cache = new System.Collections.Generic.Dictionary<int, int>();\ncache[1] = ${v+5};\ncache[1] += 3;\n$1\nreturn cache.Count * 100 + cache[1];`,v=>v+108,v=>`項目数は1、保存値は${v+8}。100 + ${v+8} = ${v+108}。`),
 item('csharp_queue_order','Queueで先着順を守る',['A queue processes values in arrival order.','Queueで到着した順番に値を処理する。'],['Dequeue removes the oldest pending value.','Dequeueは待ち列で最も古い値を取り出す。'],v=>`$0\nvar queue = new System.Collections.Generic.Queue<int>();\nqueue.Enqueue(${v+3});\nqueue.Enqueue(9);\n$1\nint first = queue.Dequeue();\nreturn first * 10 + queue.Count;`,v=>(v+3)*10+1,v=>`先頭の${v+3}を取り出すと残りは1件。${v+3} × 10 + 1 = ${(v+3)*10+1}。`)
 ]},
 rust: {
 syntax: [
 item('rust_vector_iter','Vecとイテレーター',['A vector owns the collected coin values.','Vecは拾ったコインの値を所有する。'],['The iterator borrows values while computing their sum.','イテレーターは値を借用して合計を求める。'],v=>`$0\nlet coins = vec![${v+2}, 4, 7];\n$1\nreturn coins.iter().sum();`,v=>v+13,v=>`${v+2} + 4 + 7 = ${v+13}。`),
 item('rust_option','Optionで欠損を表す',['Option makes the absence of a value explicit.','Optionで値が存在しない場合を明示する。'],['The fallback is used only for None.','Noneの場合だけ代わりの値を使用する。'],v=>`$0\nlet saved: Option<i32> = ${v%2?'None':`Some(${v+5})`};\n$1\nreturn saved.unwrap_or(${v+20});`,v=>v%2?v+20:v+5,v=>v%2?`Noneなので${v+20}を返す。`:`Someに入っている${v+5}を返す。`)
 ],
 design: [
 item('rust_result','Resultで失敗を扱う',['Result keeps successful values separate from errors.','Resultで成功値とエラーを分ける。'],['Pattern matching handles both outcomes explicitly.','パターンマッチで両方の結果を明示的に処理する。'],v=>`$0\nlet loaded: Result<i32, &str> = ${v%2?'Err("missing")':`Ok(${v+8})`};\n$1\nreturn match loaded {\n    Ok(value) => value,\n    Err(_) => ${v+1},\n};`,v=>v%2?v+1:v+8,v=>v%2?`Errの復旧値${v+1}を返す。`:`Okの中の値${v+8}を返す。`),
 item('rust_enum_state','列挙型で状態を分ける',['An enum carries data only for the state that needs it.','enumで必要な状態だけにデータを持たせる。'],['Matching extracts the payload of the running state.','パターンマッチで実行中の状態のデータを取り出す。'],v=>`$0\nenum State { Idle, Running(i32) }\nlet idle_frame = ${v};\nlet state = ${v%2?'State::Idle':`State::Running(${v+3})`};\n$1\nreturn match state {\n    State::Idle => idle_frame,\n    State::Running(frame) => frame,\n};`,v=>v%2?v:v+3,v=>v%2?`Idleの既定コマ${v}を返す。`:`Runningのフレーム値${v+3}を取り出す。`)
 ],
 graphics: [
 item('rust_slice_pixels','スライスを借用して描く',['A mutable slice borrows a portion of the pixel buffer.','可変スライスで画素バッファの一部を借用する。'],['Only the selected pixel range is changed.','選択した画素の範囲だけを変更する。'],v=>`let mut pixels = [${v+2}, 4, 6, 8];\n$0\nfor pixel in &mut pixels[1..3] {\n    *pixel += 10;\n}\n$1\nreturn pixels.iter().sum();`,v=>v+40,v=>`添字1と2に10ずつ加える。${v+2} + 14 + 16 + 8 = ${v+40}。`),
 item('rust_iterator_filter','表示対象をイテレーターで絞る',['A filter keeps only visible positive coordinates.','filterで正の表示座標だけを残す。'],['Copied values can be summed without moving the array.','値をコピーすれば配列を移動せず合計できる。'],v=>`$0\nlet positions = [-3, ${v+2}, 7];\n$1\nreturn positions.iter().copied().filter(|x| *x > 0).sum();`,v=>v+9,v=>`-3を除き${v+2}と7を合計して${v+9}。`)
 ],
 systems: [
 item('rust_move_owner','所有権を移す',['Moving a vector transfers ownership to a new binding.','Vecをmoveすると新しい束縛へ所有権が移る。'],['The old binding cannot be used after the move.','移動後の古い束縛は使用できない。'],v=>`$0\nlet source = vec![${v+4}, 6];\nlet target = source;\n$1\nreturn target[0] + target[1];`,v=>v+10,v=>`sourceからtargetへ所有権を移す。${v+4} + 6 = ${v+10}。`),
 item('rust_box_value','Boxでヒープを所有する',['A Box owns a value allocated on the heap.','Boxはヒープ上へ確保した値を所有する。'],['Dereferencing reads and updates the owned value.','逆参照で所有している値を読み書きする。'],v=>`$0\nlet mut value = Box::new(${v+5});\n$1\n*value += 3;\nreturn *value;`,v=>v+8,v=>`Box内の${v+5}に3を加えて${v+8}。`)
 ]},
 go: {
 syntax: [
 item('go_slice_range','sliceをrangeで走査する',['A slice describes a sequence of collected rewards.','sliceで拾った報酬の列を表す。'],['Range supplies each value as well as its position.','rangeは位置と値の両方を返す。'],v=>`$0\ncoins := []int{${v+2}, 4, 7}\ntotal := 0\n$1\nfor _, coin := range coins {\n    total += coin\n}\nreturn total`,v=>v+13,v=>`${v+2} + 4 + 7 = ${v+13}。`),
 item('go_map_presence','mapの存在判定',['A map lookup can return both a value and its presence.','mapの検索で値と存在の有無を取得できる。'],['A missing key is different from a stored zero.','存在しないキーと、保存された0は異なる。'],v=>`$0\nstock := map[string]int{"potion": ${v+3}}\nvalue, ok := stock["potion"]\n$1\nif !ok {\n    return -1\n}\nreturn value`,v=>v+3,v=>`potionは存在するのでokはtrue。値${v+3}を返す。`)
 ],
 design: [
 item('go_closure','クロージャで状態を持つ',['A closure captures the running score total.','クロージャに得点の累計を取り込む。'],['Repeated calls share the captured variable.','繰り返しの呼び出しで同じ変数を共有する。'],v=>`total := ${v}\n$0\nadd := func(points int) {\n    total += points\n}\n$1\nadd(7)\nadd(3)\nreturn total`,v=>v+10,v=>`共有したtotalに7と3を加える。${v} + 7 + 3 = ${v+10}。`),
 item('go_type_assertion','interfaceの型を確かめる',['An interface value retains its concrete dynamic type.','interface値は具体的な動的型を保持する。'],['The checked assertion avoids a panic for another type.','成否付きの型アサーションで型違いのpanicを防ぐ。'],v=>`$0\nvar value interface{} = ${v%2?'"missing"':v+8}\nnumber, ok := value.(int)\n$1\nif !ok {\n    return ${v}\n}\nreturn number`,v=>v%2?v:v+8,v=>v%2?`動的型はstringなのでokはfalse、復旧値${v}を返す。`:`動的型はintなので${v+8}を取り出す。`)
 ],
 graphics: [
 item('go_pixel_slice','sliceを部分更新する',['Two slices can refer to the same pixel array.','二つのsliceは同じ画素配列を参照できる。'],['Changing the view changes its backing array.','部分sliceの変更は元の配列にも反映される。'],v=>`pixels := []int{${v+2}, 4, 6, 8}\n$0\nview := pixels[1:3]\nview[0] += 10\n$1\nreturn pixels[0] + pixels[1]`,v=>v+16,v=>`view[0]はpixels[1]。${v+2} + (4 + 10) = ${v+16}。`),
 item('go_rune_frame','rune単位で表示数を数える',['A rune represents a Unicode code point rather than a byte.','runeはバイトではなくUnicodeの符号位置を表す。'],['Range decodes the text before counting frames.','rangeで文字列をデコードしてから数える。'],v=>`$0\ntext := "A\\u754cB"\nframes := ${v}\n$1\nfor range text {\n    frames++\n}\nreturn frames`,v=>v+3,v=>`A・界・Bの3つを数える。${v} + 3 = ${v+3}。`)
 ],
 systems: [
 item('go_buffered_channel','channelで値を受け渡す',['A buffered channel can hold two pending messages.','バッファ付きchannelで2件のメッセージを保持する。'],['Receives preserve the order of sent messages.','受信は送信した順番を保つ。'],v=>`$0\nqueue := make(chan int, 2)\nqueue <- ${v+4}\nqueue <- 6\nclose(queue)\n$1\ntotal := 0\nfor value := range queue {\n    total += value\n}\nreturn total`,v=>v+10,v=>`送った${v+4}と6を受信して合計${v+10}。close後は読み切るとループが終わる。`),
 item('go_deferred_cleanup','deferで後処理する',['A deferred closure runs after the return value is assigned.','deferのクロージャは戻り値への代入後に動く。'],['A named result can be changed by deferred cleanup.','名前付き戻り値はdeferの後処理で変更できる。'],v=>`value := ${v+5}\n$0\nfinish := func() (result int) {\n    defer func() { result += 3 }()\n    $1\n    return value\n}\nreturn finish()`,v=>v+8,v=>`returnでresultに${v+5}を代入し、deferで3を加えて${v+8}。`)
 ]},
 python: {
 syntax: [
 item('python_list_comprehension','リスト内包表記',['A comprehension builds rewards from the source scores.','内包表記で元の得点から報酬を作る。'],['Filtering happens before each selected score is doubled.','選んだ得点を2倍にする前に条件で絞る。'],v=>`$0\nscores = [4, ${v+10}, 20]\n$1\nrewards = [score * 2 for score in scores if score >= 10]\nreturn sum(rewards)`,v=>(v+30)*2,v=>`4を除き、(${v+10} + 20) × 2 = ${(v+30)*2}。`),
 item('python_dict_default','辞書で既定値を選ぶ',['A dictionary maps item names to saved quantities.','辞書で品名と保存個数を対応付ける。'],['Get returns a fallback without inserting a missing key.','getはキーを追加せずに既定値を返す。'],v=>`$0\nstock = {"potion": ${v+3}}\n$1\nreturn stock.get("key", 5) + stock["potion"]`,v=>v+8,v=>`keyは未登録なので5。potionの${v+3}と足して${v+8}。`)
 ],
 design: [
 item('python_dataclass','dataclassで状態をまとめる',['A dataclass defines the stored player state.','dataclassで保存するプレイヤーの状態を定義する。'],['Each instance has its own health value.','インスタンスごとに専用の体力値を持つ。'],v=>`from dataclasses import dataclass\n$0\n@dataclass\nclass Player:\n    health: int\nplayer = Player(${v+10})\n$1\nplayer.health += 5\nreturn player.health`,v=>v+15,v=>`Playerの体力${v+10}に5を加えて${v+15}。`),
 item('python_closure','クロージャで方針を作る',['A closure carries a chosen reward multiplier.','クロージャに選んだ報酬倍率を持たせる。'],['The nested function reads the enclosing scope.','入れ子の関数は外側のスコープを読む。'],v=>`multiplier = ${v+2}\n$0\ndef reward(coins):\n    $1\n    return coins * multiplier\nreturn reward(3)`,v=>(v+2)*3,v=>`外側の倍率${v+2}を使う。3 × ${v+2} = ${(v+2)*3}。`)
 ],
 graphics: [
 item('python_zip_pixels','zipで二つの列を合成する',['Zip pairs corresponding pixels from two rows.','zipで2行の対応する画素を組にする。'],['The blend adds the paired intensities.','合成では組になった明るさを加える。'],v=>`left = [${v+2}, 4]\nright = [10, 20]\n$0\nblended = [a + b for a, b in zip(left, right)]\n$1\nreturn sum(blended)`,v=>v+36,v=>`(${v+2} + 10) + (4 + 20) = ${v+36}。`),
 item('python_tuple_unpack','座標のタプルを分解する',['A tuple keeps two coordinates in a single value.','タプルで二つの座標を一つの値にまとめる。'],['Unpacking assigns each coordinate to its own name.','アンパックで各座標をそれぞれの名前へ代入する。'],v=>`$0\nposition = (${v+3}, 4)\n$1\nx, y = position\nreturn x * 10 + y`,v=>(v+3)*10+4,v=>`xは${v+3}、yは4。${v+3} × 10 + 4 = ${(v+3)*10+4}。`)
 ],
 systems: [
 item('python_counter','Counterで出現数を数える',['Counter stores the frequency of each job identifier.','Counterで各ジョブ識別子の出現数を保存する。'],['Only the requested identifier contributes to this result.','指定した識別子の出現数だけを結果に使う。'],v=>`from collections import Counter\n$0\ncounts = Counter([1, 2, 1, ${v+3}])\n$1\nreturn counts[1] * 10 + counts[${v+3}]`,()=>21,()=>`1は2回、最後の識別子は1回。2 × 10 + 1 = 21。`),
 item('python_context_cleanup','contextmanagerで後始末する',['A context manager guarantees its final cleanup.','コンテキストマネージャーは最後の後始末を保証する。'],['The finally block runs when the with block exits.','withブロックを出るとfinallyが動く。'],v=>`from contextlib import contextmanager\ncount = [${v}]\n$0\n@contextmanager\ndef guard():\n    try:\n        yield\n    finally:\n        count[0] += 5\nwith guard():\n    count[0] += 2\n$1\nreturn count[0]`,v=>v+7,v=>`with内で2、終了時に5を加える。${v} + 2 + 5 = ${v+7}。`)
 ]},
 java: {
 syntax: [
 item('java_array_list','ArrayListを走査する',['An ArrayList stores boxed integer scores.','ArrayListにボックス化された整数の得点を保存する。'],['Enhanced for reads each stored score in order.','拡張forで保存した得点を順番に読む。'],v=>`$0\njava.util.List<Integer> scores = new java.util.ArrayList<>(java.util.Arrays.asList(${v+2}, 4, 7));\nint total = 0;\n$1\nfor (int score : scores) {\n    total += score;\n}\nreturn total;`,v=>v+13,v=>`${v+2} + 4 + 7 = ${v+13}。`),
 item('java_optional','Optionalで欠損を表す',['Optional represents a saved value that may be absent.','Optionalで存在しない場合もある保存値を表す。'],['OrElse supplies a fallback only when the value is absent.','orElseは値がない場合だけ既定値を与える。'],v=>`$0\njava.util.Optional<Integer> saved = java.util.Optional.${v%2?'empty()':`of(${v+5})`};\n$1\nreturn saved.orElse(${v+20});`,v=>v%2?v+20:v+5,v=>v%2?`空なので既定値${v+20}を返す。`:`保存された${v+5}を返す。`)
 ],
 design: [
 item('java_local_class','クラスへ振る舞いをまとめる',['A class keeps player state beside its behavior.','クラスでプレイヤーの状態と振る舞いをまとめる。'],['Healing changes the health of this instance.','回復はこのインスタンスの体力を変更する。'],v=>`$0\nclass Player {\n    int health;\n    Player(int value) { health = value; }\n    void heal(int amount) { health += amount; }\n}\nPlayer player = new Player(${v+10});\n$1\nplayer.heal(5);\nreturn player.health;`,v=>v+15,v=>`初期体力${v+10}に5を加えて${v+15}。`),
 item('java_function_policy','関数インターフェースを使う',['A functional interface describes a reward policy.','関数型インターフェースで報酬ルールを表す。'],['The lambda captures an effectively final multiplier.','ラムダは実質的にfinalな倍率をキャプチャする。'],v=>`int multiplier = ${v+2};\n$0\njava.util.function.IntUnaryOperator reward = coins -> coins * multiplier;\n$1\nreturn reward.applyAsInt(3);`,v=>(v+2)*3,v=>`倍率${v+2}で3を変換する。3 × ${v+2} = ${(v+2)*3}。`)
 ],
 graphics: [
 item('java_int_stream','IntStreamで画素を合成する',['An integer stream transforms each pixel intensity.','IntStreamで各画素の明るさを変換する。'],['The terminal sum evaluates the mapped stream.','終端操作sumで変換したストリームを評価する。'],v=>`int[] pixels = { ${v+2}, 4, 6 };\n$0\nint total = java.util.Arrays.stream(pixels).map(pixel -> pixel * 2).sum();\n$1\nreturn total;`,v=>(v+12)*2,v=>`(${v+2} + 4 + 6) × 2 = ${(v+12)*2}。`),
 item('java_copy_pixels','配列を独立にコピーする',['Copying an array creates a separate pixel buffer.','配列をコピーすると独立した画素バッファができる。'],['Changing the copy leaves the source unchanged.','コピーの変更は元の配列へ影響しない。'],v=>`$0\nint[] source = { ${v+3}, 4 };\nint[] copy = java.util.Arrays.copyOf(source, source.length);\ncopy[0] += 10;\n$1\nreturn source[0] + copy[0];`,v=>2*(v+3)+10,v=>`元は${v+3}のまま、コピーは${v+13}。合計は${2*(v+3)+10}。`)
 ],
 systems: [
 item('java_map_merge','Mapで集計を更新する',['Merge combines a new count with an existing entry.','mergeで新しい個数と既存の項目を結合する。'],['The combining function runs only for an existing key.','結合関数は既存のキーに対してだけ動く。'],v=>`$0\njava.util.Map<String, Integer> counts = new java.util.HashMap<>();\ncounts.put("job", ${v+5});\n$1\ncounts.merge("job", 3, Integer::sum);\nreturn counts.get("job");`,v=>v+8,v=>`jobは既存なので${v+5}と3を足して${v+8}。`),
 item('java_auto_close','tryでリソースを閉じる',['An AutoCloseable resource has a defined cleanup action.','AutoCloseableでリソースの後始末を定義する。'],['Try with resources closes the resource before returning.','try-with-resourcesがブロック終了時にリソースを閉じる。'],v=>`int[] count = { ${v} };\n$0\nclass Guard implements AutoCloseable {\n    public void close() { count[0] += 5; }\n}\ntry (Guard guard = new Guard()) {\n    count[0] += 2;\n}\n$1\nreturn count[0];`,v=>v+7,v=>`try内で2、closeで5を加える。${v} + 2 + 5 = ${v+7}。`)
 ]},
 lua: {
 syntax: [
 item('lua_sequence','ipairsで列を走査する',['A table stores a sequence of collected rewards.','テーブルに拾った報酬を列として保存する。'],['Ipairs visits consecutive integer keys starting at one.','ipairsは1から始まる連続した整数キーを巡回する。'],v=>`$0\nlocal coins = {${v+2}, 4, 7}\nlocal total = 0\n$1\nfor _, coin in ipairs(coins) do\n    total = total + coin\nend\nreturn total`,v=>v+13,v=>`${v+2} + 4 + 7 = ${v+13}。Luaの列は添字1から始まる。`),
 item('lua_table_default','テーブルで既定値を選ぶ',['A table maps item names to stored quantities.','テーブルで品名と保存個数を対応付ける。'],['A missing key returns nil so the fallback is selected.','未登録のキーはnilになるため既定値が選ばれる。'],v=>`$0\nlocal stock = {potion = ${v+3}}\n$1\nreturn (stock.key or 5) + stock.potion`,v=>v+8,v=>`keyはnilなので5、potionは${v+3}。合計${v+8}。`)
 ],
 design: [
 item('lua_metatable','メタテーブルで振る舞いを共有する',['A metatable shares methods between player instances.','メタテーブルでプレイヤーのインスタンス間にメソッドを共有する。'],['The colon call passes the player as self.','コロンで呼ぶとプレイヤーがselfとして渡される。'],v=>`$0\nlocal Player = {}\nPlayer.__index = Player\nfunction Player:heal(amount)\n    self.health = self.health + amount\nend\nlocal player = setmetatable({health = ${v+10}}, Player)\n$1\nplayer:heal(5)\nreturn player.health`,v=>v+15,v=>`selfはplayer。healthの${v+10}に5を加えて${v+15}。`),
 item('lua_closure','クロージャで状態を保つ',['A closure captures the running score total.','クロージャに得点の累計を取り込む。'],['Both calls update the same captured variable.','二つの呼び出しで同じ変数を更新する。'],v=>`local total = ${v}\n$0\nlocal function add(points)\n    total = total + points\nend\n$1\nadd(7)\nadd(3)\nreturn total`,v=>v+10,v=>`共有したtotalに7と3を加えて${v+10}。`)
 ],
 graphics: [
 item('lua_pixel_table','画素テーブルを共有する',['Assigning a table shares a reference to the same pixels.','テーブルの代入は同じ画素への参照を共有する。'],['Editing the view also changes the original table.','参照先の変更は元のテーブルにも反映される。'],v=>`local pixels = {${v+2}, 4, 6}\n$0\nlocal view = pixels\nview[2] = view[2] + 10\n$1\nreturn pixels[1] + pixels[2]`,v=>v+16,v=>`view[2]はpixels[2]と同じ要素。${v+2} + 14 = ${v+16}。`),
 item('lua_frame_string','パターンからコマ数を読む',['A string pattern extracts the animation frame count.','文字列パターンでアニメーションのコマ数を取り出す。'],['Tonumber converts the matched digits before arithmetic.','計算前にtonumberで一致した数字を数値へ変える。'],v=>`$0\nlocal label = "idle:${v+3}"\nlocal digits = string.match(label, "idle:(%d+)")\n$1\nreturn tonumber(digits) + 1`,v=>v+4,v=>`取り出す文字列は${v+3}。数値に直して1を加え${v+4}。`)
 ],
 systems: [
 item('lua_coroutine','coroutineから値を受け取る',['A coroutine can pause while producing a sequence.','coroutineは値の列を生成しながら一時停止できる。'],['Each resume continues after the previous yield.','resumeのたびに直前のyieldから続行する。'],v=>`$0\nlocal worker = coroutine.create(function()\n    coroutine.yield(${v+4})\n    return 6\nend)\n$1\nlocal ok1, first = coroutine.resume(worker)\nlocal ok2, second = coroutine.resume(worker)\nreturn ok1 and ok2 and (first + second) or 0`,v=>v+10,v=>`初回resumeは${v+4}、2回目は6を返す。成功時の合計${v+10}。`),
 item('lua_protected_call','pcallで失敗を受け止める',['A protected call returns success separately from its result.','pcallは成功の有無と結果を別々に返す。'],['A failed operation takes the explicit recovery branch.','処理が失敗した場合は明示した復旧の分岐へ進む。'],v=>`$0\nlocal ok, value = pcall(function()\n    ${v%2?'error("missing")':`return ${v+5}`}\nend)\n$1\nif not ok then\n    return ${v}\nend\nreturn value`,v=>v%2?v:v+5,v=>v%2?`errorで失敗するのでokはfalse、復旧値${v}を返す。`:`成功して値${v+5}を返す。`)
 ]}
};
export function idiomAt(language,subject,slot,variant) {
 const topic=IDIOMS[language]?.[subject]?.[slot];if(!topic)return null;
 const name=nameFor(language,topic.id), python=language==='python',lua=language==='lua';
 const header=python?`def ${name}():`:lua?`function ${name}()`:language==='rust'?`fn ${name}() -> i32 {`:language==='go'?`func ${name}() int {`:`static int ${name}() {`;
 const marker=python?'#':lua?'--':'//';
 const body=topic.body(variant).replace(/\$(0|1)/g,(_,i)=>`${marker} ${topic.comments[Number(i)].en}`).split('\n').map(line=>'    '+line).join('\n');
 const code=topic.headers.map(h=>`#include <${h}>\n`).join('')+header+'\n'+body+(python?'':lua?'\nend':'\n}');
 return {topicId:topic.id,title:topic.title,english:topic.title,code,comments:topic.comments.map(c=>({...c})),answer:topic.answer(variant),explanation:topic.explanation(variant)};
}
