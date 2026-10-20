# Quiz・Challengeの採点と配布

Quizは指定された構文・技法を使う穴埋めです。空欄の完全なトークン列を検査し、コンパイル結果の表示とは区別します。言語固有の構文を学ぶためのスニペットで、必要な言語版や文脈は各課題の説明に含めます。

Challengeは自由に書いた実装を実処理系で実行し、入出力仕様を採点します。旧512題のIDを保持し、可変長配列・文字列・探索・動的計画法・状態管理・画像処理とSQL課題を追加しています。最初の数当てゲームには8言語×3部品の専用課題があります。全件数と型別の集計は [research/learning-catalog.json](research/learning-catalog.json) に記録します。

数値出力とJSON-linesの構造化出力を区別し、配列の全要素、文字列、NULL、行数、列数を確認します。SQLの構造化課題は結果表をJSONへまとめて返し、DML課題は固定の検証問い合わせで変更後のDBを比較します。期待する結果と同じであれば別解も認めます。

実行する言語だけをWorkerで遅延読込します。処理系はGitHub Pagesの通常の静的HTTP・リポジトリ下のパスで動き、外部CDN、採点サーバー、COOP/COEPヘッダーを要求しません。公開済みのハッシュ付きURLは更新後も保持します。

模範解答は対応する実ブラウザ処理系で検証します。構文穴埋めQuizの正誤判定、実装Challengeの実行、Exercism講座の写経はそれぞれ別の検証です。Exercism全演習をChallenge化した扱いにはしません。

## 処理系

| 言語 | 同梱処理系 | 範囲・制限 |
| --- | --- | --- |
| C++ | browsercc 0.1.1 / Clang 20.1.2 / WASI SDK 25 | C++20、例外無効。OS・任意の外部ライブラリは提供しない |
| C# | WasmSharp 0.10.2 / Roslyn 4.14 / .NET 10 preview 6 | trimされた標準ライブラリ。通常の.NET全体ではない |
| Rust | Rubri / rustc 1.78.0-dev + Miri | 型・借用検査と実行。Cargo・外部crate・Rust 2024・一般OS機能は対象外 |
| Go | Yaegi 0.16.1 / 独自WASMラッパー | 標準ライブラリの限定exports。`os`・`net/http`・cgo・追加moduleは対象外 |
| Python | Pyodide 314.0.7 / CPython 3.14.2 | 同梱の標準ライブラリ。追加パッケージの自動取得は前提にしない |
| Java | OpenJDK javac + TeaVM-javac / TeaVM 0.16 | Wasm GC必須。完全なJVM互換ではなく、一部例外動作が異なる |
| SQL | SQLite WASM 3.53.4 | SQLite方言、毎回メモリー内DB、OPFS不要 |
| Lua | Wasmoon 1.16.0 / Lua 5.4.5 | 呼び出し後にスタックを復元、毎提出で新しいstate |

通常の静的HTTPとWorkerで動作し、COOP/COEP・SharedArrayBufferを要求しません。ブラウザで「テストを実行」を押してから言語の処理系を読み込みます。実行環境ロードは5分、実行は30秒で打ち切ります。中止・編集・課題切替・画面切替時はWorkerを破棄し、古い結果の進行反映を防ぎます。各提出は別Workerなので、前の提出が残した状態を引き継ぎません。

全環境の互換性を保証するものではありません。検証したブラウザと配布ビルドは[実行証跡](research/quiz-validation.json)に記録します。大きい処理系の初回取得とメモリー使用量には端末差があります。

## ビルドと再検証

公開資産は`docs/runtime-assets/v1/`へチェックインします。通常のビルドは外部へアクセスせず、公開済み資産をそのまま使います。処理系はゲームビルドのハッシュとは独立したURLに固定し、ゲーム更新のたびに巨大なバイナリーを複製しません。既に公開したv1の内容を別版へ差し替えず、変更時は新しいURLにしてください。

`scripts/vendor-*.mjs`は資産の固定版・チェックサム・ライセンスを保持します。生成用`runtime-assets/`はgit対象外で、存在するとビルドが公開用ディレクトリーへコピーします。`--verify`で整合性を検査できます。Rust/GoとJavaは同梱ソースと記録したツールチェーンも参照してください。

```sh
npm run build
npm test
# 開発用PlaywrightとChromiumを用意して実行
npm run test:browser
npm run test:quiz
```

`test:quiz`は公開用のWorker・圧縮資産をリポジトリーのサブパスから読み、全模範解答を全ケースで実行します。各言語で、コンパイル可能な誤答と構文不正の拒否も確認します。詳細は`work/quiz-validation/`へ出力します。UIの取消・古い結果・保存・有限報酬は別のブラウザテストで確認します。

## ライセンスと対応ソース

ゲームと新規教材・ラッパーのBoost Software License 1.0は、同梱処理系を一括して再ライセンスするものではありません。[処理系の通知と原文](docs/runtime-assets/v1/licenses/)を保持します。各言語の`source.json`、`manifest.json`、`BUILD.md`にも版・由来・変更点を記録しています。

- PyodideはMPL-2.0、CPythonはPSF等です。対象ファイルは原文のまま配布し、固定revisionの対応ソースとビルド元を記録しています。
- WasmSharpはApache-2.0、Roslyn/.NETはMIT等です。ローカル資産参照と圧縮配布の変更を生成スクリプトで記録します。
- LLVMはApache-2.0 WITH LLVM-exception、WASI・libc等は各通知を保持します。
- Rust/MiriはMITまたはApache-2.0等、YaegiはApache-2.0、GoはBSD-3-Clause等です。ライセンスのないGoデモUIやその不透明な配布バイナリーは使用せず、独自のラッパーを公式ソースからビルドしました。
- TeaVMはApache-2.0等、組み込まれたOpenJDK部分はGPL-2.0 WITH Classpath-exceptionです。[対応ソースと再ビルド手順](docs/runtime-assets/v1/java/teavm-javac-208d4c97/BUILD.md)を同梱し、外部サイトへのリンクだけに依存しません。
- Wasmoon/LuaはMIT等、SQLite本体はpublic domainで、配布JS等のMIT/NCSA/Apache通知は別に保持します。
