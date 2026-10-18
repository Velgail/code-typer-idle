# 8言語のブラウザ実行・採点環境の調査

調査日: 2026-10-18 UTC。対象ゲーム: Code Typer Idle v2.1.0、教材基準コミット `44aeb43`。

## 結論

8言語すべてで、既存の処理系を使い、入力ソースの正常実行・構文エラー・誤答をブラウザ内で区別できた。GitHub Pagesに必要な構成は、静的な処理系ファイルとWorkerであり、採点用サーバーは不要。

ただし、**処理系が動くこと、組込教材に対応すること、Exercism講座をすべて採点できることは、それぞれ別の検証**である。既製配布物の標準ライブラリ削減やコード生成の不具合も実際に見つかった。現時点で全教材を無条件に採点できるという結論にはしない。

| 言語 | 有力候補と実行方式 | ブラウザでの結果 | 採用時の主な条件 |
|---|---|---|---|
| C++ | browsercc 0.1.1、Clang 20.1.2 + LLD + WASI SDK 25。ソースを実コンパイルしてWASM実行 | 組込 **1,024/1,024問**で正答一致。C++20、構文不正、誤答も確認 | コンパイラーの重複読込を防ぐキャッシュ。LLVM・sysrootのライセンス通知。低メモリー端末の検証 |
| C# | WasmSharp 0.10.2、Roslyn 4.14 + .NET 10 preview6。実コンパイルとIL実行 | 正常・構文不正・誤答を判別。対象16問を除いた **1,008問**は正答一致 | 配布物から削られた `Enumerable.Sum(IEnumerable<int>)` を保持する再publish。既製npmのままでは全1,024問不可 |
| Rust | Rubriのrustc 1.78.0-dev + Miri。構文・型・借用検査後にMIR実行 | 組込 **1,024/1,024問**で正答一致。型エラー・借用エラーE0502も検出 | 大きなsysrootを必要時に読込。最新Rust仕様・外部crate・一般OS APIは別対応 |
| Go | Yaegi v0.16.1をWASM化。Goソースを解釈実行 | 組込 **1,024/1,024問**で正答一致。構文・型エラー・標準ライブラリを確認 | ライセンスのないサンプルUIは流用せず、Yaegi本体から独自の薄い呼出し部分をビルド。modules/cgo等の範囲を明示 |
| Python | Pyodide 314.0.7、CPython 3.14.2 | 組込 **1,024/1,024問**で正答一致。標準モジュール、構文不正、誤答、例外を確認 | 初回読込とVM初期化。追加パッケージ・スレッド等は課題別に確認 |
| Java | teavm-javac、OpenJDK javac + TeaVM 0.16。ソース→bytecode→WasmGC | 正常・構文不正・誤答を確認。既定設定では生成不具合を再現、公開オプション `strictMode:false` で **1,024/1,024問**が正答一致 | WasmGC対応ブラウザ。厳密なJava例外挙動と生成不具合の解決は別途必要。OpenJDK成分のソース・通知提供 |
| SQL | 公式SQLite WASM 3.53.4-build2 | 組込 **1,024/1,024問**で正答一致。window・再帰CTE・JSON等も実行 | 課題ごとのメモリDB。講座用REGEXP・generate_series・CSV等は別に用意 |
| Lua | Wasmoon 1.16.0、Lua 5.4 | 組込 **1,024/1,024問**で正答一致。整数除算・bit演算・coroutine等も実行 | 戻り値・エラーを処理した後にLuaスタックを復元。放置した連続実行は状態を壊す |

この調査の成果は処理系の実行検証と採用条件である。ゲームの学習モードへの組込み、課題データ・UI・報酬への接続は含めていない。

## 検証条件

- Chromium 154系、通常のローカル静的HTTP配信、Dedicated Workerを使用。
- `crossOriginIsolated=false`。確認した採用候補はCOOP/COEP、SharedArrayBuffer、採点サーバーを使わずに動作した。
- 評価対象の入力ソースを実処理系へ渡した。「あらかじめネイティブでコンパイルした解答WASMを再生した」結果ではない。
- 正常と構文不正だけでなく、実行は成功する誤答を期待値照合で拒否することを確認。
- C++旧版、Rust、Go、Python、Lua、SQLでは無限ループをWorker終了で停止し、画面側のheartbeatが継続することも確認。
- 全件照合には `scripts/validate-curriculum.mjs` と同様の関数名一意化・呼出し用mainを使用。ユーザーが入力する関数本体は変更しない。
- 時間はこのデスクトップ環境・ローカル転送の値。Internet回線、GitHub Pages本番、スマートフォン、Firefox/WebKitの性能を実測したものではない。
- 普通のWorkerはUI停止回避に有効だが、通信・ストレージの完全な隔離や不正防止を保証するものではない。

## 配布量と読込

MBは十進単位。rawは確認した固有資産の合計、gzipは特記以外は手元で同じ資産を圧縮した参考値で、GitHub Pages本番の転送量を保証しない。

| 処理系 | raw | gzip参考値 | 注記 |
|---|---:|---:|---|
| C++ browsercc | 94.57 MB | 29.81 MB | 任意のPCHを除外。標準APIではClangを2個作り、同じ資産を再要求する |
| C# WasmSharp | 39.56 MB | — | rawは要求された固有資産。参考: npmパッケージ全体のtarballは14.88 MB、展開後41.65 MBで集計対象が異なる |
| Rust Rubri | 156.30 MB | 53.52 MB | Miri + 付属sysroot28ファイル。エディター・LSPは除外 |
| Go Yaegi | 39.83 MB | 8.40 MB | 全標準ライブラリの公開シンボルを含む既存実例。縮小ビルドの容量は未計測 |
| Python Pyodide | 13.53 MB | 6.40 MB | 本体・標準ライブラリ等、実行に用いた5資産 |
| Java teavm-javac | 7.28 MB | 4.36 MB | 今回のソースビルド。本体・JS runtime・compile/runtime classlib。任意のsource mapは除外 |
| SQL SQLite | 1.51 MB | 0.58 MB | JS entry + WASM |
| Lua Wasmoon | 0.42 MB | 0.15 MB | JS glue + Lua WASM |

全処理系を起動時に読み込まず、選んだ言語の教材実行時に必要な処理系だけを読む。処理系の版をゲームの毎回のビルドIDから独立させ、同じ大容量資産をゲーム更新ごとに複製しない構成が適する。

C++の初期メモリー宣言はClang約145 MB、LLD約141 MB、各最大2 GiB。標準APIはClangを2個作るため、容量の小さい端末で動作するとはまだ言えない。これはWASMの宣言値であり、ピークRSSを測った数字ではない。

## 実際に見つかった組込み上の問題

### C++

推奨候補は [browsercc](https://github.com/BertalanD/browsercc/tree/86168bacf0fe7c662e3e65a2e3006ceb159cd0dc)、npm 0.1.1。Clang 20.1.2、WASI SDK 25。C++20のranges、optional等と既存1,024問が動作した。

比較した [binji/wasm-clang](https://github.com/binji/wasm-clang/tree/648c4a89997a351eef75cdaec3ef5b89d4937dec) のClang 8.0.1でも1,024問が動いた。libc++を使う代表例ではラッパーのリンク対象に同梱compiler-rtを追加する必要があった。新しいUIを持つRunnoでも、調査したclangpp定義はClang 8系であり、新しいC++処理系だとは判断しない。

browserccは無改変のAPIで動くが、再採点で大きな資産を再要求する。製品ではbytes/compiled-moduleの明示的キャッシュとコンパイラーの再利用を入れる。WASIで扱えないスレッド・OS機能は課題要件として区別する。

### C#

[WasmSharp](https://github.com/JakeYallop/WasmSharp) の公開npm 0.10.2を固定して検証。実体は .NET `10.0.0-preview.6.25358.103`、Roslyn `4.14.0.0`、既定C#13である。最新ソースHEADとnpm配布物の版は同一と仮定しない。

全1,024問をまとめたビルドは、`csharp_linq_pixels` の16変種でCS7036となった。`System.Linq.Enumerable.Sum(IEnumerable<int>)` がtrim済み配布物から削られている。これら16問を除いた1,008問はコンパイル・実行・全正答照合に成功した。

公式の未削減DLLを手動で混ぜる実験は依存・初期化の不一致で失敗した。確実な次の検証対象は、必要な標準ライブラリAPIを保持してRoslyn呼出し部分を再publishする構成である。修復した構成の全1,024問通過は、まだ確認していない。

呼出しハーネスには `Main(string[] args)` が必要だった。既製ラッパーのComlink外部URLをローカル資産に変更し、DLL/WASM/dataのimportを自己ホストURLとして解決した。

### RustとGo

[Rubri](https://github.com/LyonSyonII/rubri/tree/00de75bcec3d8cf5156aef2382c738cbfe069986) は実際のrustcフロントエンドとMiriをWASMで動かす。Rust 1.78.0-devなのでedition2024や最新標準APIまで対応すると扱わない。誤答の判定にはpanicを使わず、値を出力しJavaScriptで比較する。既存ラッパーではassert失敗後に未対応unwindの長いエラーも出た。

[rubrc](https://github.com/oligamiq/rubrc) はrustc/LLVMをブラウザで動かす別候補だが、SharedArrayBufferとCOOP/COEPを要求し、pre-releaseである。Rubriの通常ヘッダーでの実機成功を、rubrcの成功に読み替えない。

[Yaegi](https://github.com/traefik/yaegi) の既存WASM例でGoの構文・型検査・標準ライブラリと1,024問が動いた。実例のWASMはGo1.25.5でビルド、Yaegi依存はv0.16.1。実例UIのリポジトリにはLICENSEがないため、そのまま配布する前提にはせず、Apache-2.0のYaegi本体から薄い独自ラッパーを作る。

[Go gcのWASM版](https://github.com/ccbrown/wasm-go-playground) でも1,024問を実行できたが、Go1.12.6で`fmt`等が未収録だった。新規採用ではYaegiを優先する。

### Python・Lua・SQL

[Pyodide](https://pyodide.org/en/stable/usage/downloading-and-deploying.html) はCPythonそのものを使え、dataclass、collections等も実行できた。追加パッケージは個別の読込・対応確認が必要。

[Wasmoon](https://github.com/ceifa/wasmoon) はLua5.4。戻り値やエラーをスタックに残したまま連続実行すると、数十問後に環境破損を再現した。評価の前後でスタック位置を復元すると、同期・非同期の両APIで1,024問が通った。「非同期APIだから使えない」という結論にはしない。

[公式SQLite WASM](https://github.com/sqlite/sqlite-wasm) は採点用DBをメモリに作ればOPFS不要。結果集合・更新後の状態をAPIで比較できる。SQLはSQLite方言であり、MySQL/PostgreSQL等の任意方言を採点できるとは扱わない。

### Java

[teavm-javac](https://github.com/konsoletyper/teavm-javac/tree/208d4c97a602ba0df055f16e6882059fb69d0122) はOpenJDK javacとTeaVMを同じWASMモジュールに収める既存実装。入力ソースをjavacでbytecodeへ変換し、TeaVMでWasmGCへ変換して実行する。

公開デモ配布先は調査環境のネットワークポリシーで取得できなかったため、公式ソースからビルドした。JDK25.0.4.1、Gradle9.1、TeaVM0.16、OpenJDK jdk25u `6c48f4ed707bf0b15f9b6098de30db8aae6fa40f`。コンパイラーロジックは変更していない。ローカルのビルド設定で、宣言済みMaven Centralを使用し、不足していたcheckstyle版の項目を追加した。

正常・構文不正・誤答の3ケースは通常の静的配信とWorkerで動いた。全1,024問を一つにまとめた場合は、javacの処理に成功した後、TeaVMのWASM生成中に`RuntimeError: divide by zero`を再現した。小さい単独関数でも、`parts=0; if(parts==0)return 0; return total/parts;` という正しいガード付き処理で同じ失敗を再現した。ユーザープログラムの実行時エラーや、大量の問題をまとめたことだけの問題と混同しない。

TeaVM0.16の `BoundCheckInsertion` で定数除算を評価する経路が原因とみられる。コンパイラーのコアを変更せず、公開APIの `generateWebAssembly({strictMode:false, ...})` だけを変更すると、同じ1,024問が全件一致した。元の失敗とオプションによる回避は別の証拠ファイルに保存した。

この回避では配列境界・null・除算等についてJavaの例外として扱う厳密さが変わる可能性がある。さらに `ArrayIndexOutOfBoundsException` をcatchする短い例は、既定設定でも回避設定でもJavaのcatchへ入らずWASM trapとなった。既定設定を選べば完全なJVMの意味論になる、という保証もない。例外捕捉や境界挙動を学ぶ課題へ無条件に適用しない。製品では生成不具合の修正・別版の採用、または対応課題を限定した明示的な運用を検証する。

record・switch式・List.streamを組み合わせた例は既定設定でも成功した。既存のJavaSE/JVMすべてと同等とは扱わない。

[CheerpJ](https://cheerpj.com/docs/licensing.html) には個人・FOSS等のCommunity CDN利用条件があるが、自己ホスト・再配布は商用ライセンス条件となる。[Doppio](https://github.com/plasma-umass/doppio) は旧Java8系の別候補で、今回の実機検証対象にはしていない。

## 教材全体を採点するために必要な作業

現在の教材は二種類ある。

| 種類 | 内容 | 現在の採点用データ |
|---|---|---|
| 組込コード演習 | 8言語 × 64基本題 × 16変種 = 8,192問 | 全問に数値正解あり。関数は引数なし・初期値はソース内固定 |
| Exercism講座 | 1,062演習、1,171模範実装ファイル、3,562入力区間 | 模範実装・starter・説明文あり。採点テストと多くの補助ファイルは未同梱 |

Exercismの3,562区間のうち1,787区間は複数分割されたグループに属し、区間単独で実行できる保証はない。演習のファイル構造を復元し、必要な補助型・設定・依存・fixtureと上流テストを取り込む必要がある。固定済み上流アーカイブには1,062演習分、計1,197テストファイルがある。

| 言語 | 講座の演習数 / 入力区間 | 特に必要な対応 |
|---|---|---|
| C++ | 100 / 318 | C++17、複数ヘッダー・実装、Boost date_time、regex、mutex等 |
| C# | 178 / 485 | net10.0、LINQ、record等、xUnit、NuGet依存 |
| Rust | 110 / 405 | edition2024、外部crate、thread/fs等 |
| Go | 166 / 656 | go.mod1.27、標準ライブラリ、補助型、goroutine等 |
| Python | 149 / 442 | fixture、標準モジュール、ファイル・threading、テスト枠組み |
| Java | 158 / 546 | record・switch式、補助型、RxJava/org.json、テスト枠組み |
| SQL | 81 / 417 | JSON29演習、REGEXP3、generate_series7、数学拡張、CSV・初期DB |
| Lua | 120 / 293 | Lua5.3以降、Busted相当の表明、ファイルfixture |

組込教材の正解一つだけで自由実装を採点すると、正解定数をreturnする解答も通る。実装課題には複数の入力と期待値を持つテストが必要。既存の16変種は、同じユーザー関数へ渡すテストケースAPIにはなっていない。

対応外の構文・標準API・依存は`未対応`として扱い、`不正解`や`コンパイル成功`へ丸めない。軽量な独自評価器を足す場合も、対応する構文・意味・APIを明記する。基礎的なソース実行には既存処理系を使えるので、まずそれと課題用の呼出し部分を整える方針が妥当である。未対応教材の問題は残り、補助APIや代替評価器が必要かは課題別に判断する。

## GitHub Pagesとライセンス

通常のPagesで任意のCOOP/COEPヘッダーを設定する前提にはしない。今回動作した候補は非共有メモリーである。pthread/SAB必須の別ビルドには、[coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker)等の追加対策と初回reload・更新の検証が必要になる。

[Pagesの公開サイト上限は1 GB、帯域は月100 GBのsoft limit](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)。[Gitの単体ファイルは100 MiB超を直接追加できず](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)、PagesではGit LFSを配布方法として使えない。容量・圧縮・版管理を採用時に設計する。

本リポジトリのBSLは**Boost Software License 1.0**。処理系をすべてBoostへ変更するのではなく、第三者のライセンス・著作権・NOTICEと必要な対応ソースを別に配布する。

| 対象 | 主な条件 |
|---|---|
| browserccとLLVM/sysroot | wrapperはMIT。LLVMはApache-2.0 WITH LLVM-exception等、sysrootとEmscriptenの通知を別に保持。旧ClangではMIT/UIUC等も確認 |
| WasmSharp / Roslyn / .NET | wrapperはApache-2.0、Roslyn/.NETはMIT、依存通知を保持 |
| Rust / Miri / Rubri | Rust/MiriはMITまたはApache-2.0、RubriはMIT。sysroot等の通知も必要 |
| Yaegi / Go | YaegiはApache-2.0、GoはBSD-3-Clause。LICENSEのない第三者サンプルを無条件に流用しない |
| Pyodide / CPython | Pyodideは**MPL-2.0**、CPythonはPSF等。MPL対象ファイルの通知と対応ソース入手手段を提供。独立したゲーム本体をMPLへ変更する条件ではない |
| teavm-javac / OpenJDK | wrapper・TeaVMのApache-2.0と、OpenJDK成分の**GPLv2 + Classpath Exception**を区別。コンパイラー成分のソース・ビルド情報・通知を提供し、全体をApache/Boostのみと表示しない |
| SQLite / Wasmoon / Lua | SQLite本体はpublic domain。JS glue・npm配布側の別通知を保持。Wasmoon/LuaはMIT等の通知を保持 |

これは将来の配布物全体を監査完了とするものではない。採用版の構成を固定し、実際に同梱する全ファイルの通知を揃える必要がある。教材側は既存のMIT出典固定と、追加テスト・fixtureのライセンス確認を維持する。

ライセンス条件の一次資料: [Boost](https://www.boost.org/LICENSE_1_0.txt)、[LLVM](https://llvm.org/docs/DeveloperPolicy.html)、[Pyodide MPL](https://github.com/pyodide/pyodide/blob/main/LICENSE)、[CPython](https://docs.python.org/3/license.html)、[OpenJDK GPLv2 + Classpath Exception](https://openjdk.org/legal/gplv2+ce.html)、[.NET](https://github.com/dotnet/runtime/blob/main/LICENSE.TXT)、[Go](https://go.dev/LICENSE)、[Lua](https://www.lua.org/license.html)、[SQLite](https://sqlite.org/copyright.html)。

## 推奨する次の実装単位

1. 全言語で共通の採点結果を返すWorker呼出し部分を用意する。成功、構文・型エラー、実行時エラー、誤答、時間超過、処理系エラー、未対応を区別する。
2. 既存教材で実証した各処理系を版固定し、必要なときだけロードする。大容量資産はゲームビルドと別の安定したURLとする。
3. C#の標準ライブラリ保持とJavaの生成不具合を解決・回避し、組込教材全件の回帰を通す。
4. 自由実装課題には複数ケースを追加する。写経の文字一致・打鍵報酬とは別の採点契機を持たせる。
5. Exercismは演習単位でプロジェクト・テスト・依存を取り込み、対応した演習から実行可能にする。全言語の全講座を一括で対応済みと表示しない。

固定版・ハッシュ・実行結果は `research/browser-runtimes/` の証拠と手順に記録する。ランタイムの大容量バイナリは本調査コミットには含めない。
