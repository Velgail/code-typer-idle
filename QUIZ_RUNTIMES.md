# Quizの実行環境と配布

Quizは8言語×64題、計512課題・11,794テストケースです。各分野16題です。教材の定数を引数へ移し、同じ提出関数を複数入力で呼び出します。SQLは毎ケース新しいテーブルへ入れ替え、同じ問い合わせを実行します。全課題に複数の期待値があるため、定数を返す解答では全件合格しません。

コード文字列の一致やJavaScriptによる疑似実行では採点しません。言語ごとの実処理系で提出コードを評価し、全ケースの出力を比較します。整数は完全一致、非整数は相対誤差1e-9以内とします。構文・型・実行エラー、余分な出力、出力上限超過、時間切れはいずれも不合格です。テストを通る別実装も合格します。有限の公開テストなので、任意の入力での正しさを証明するものではありません。

## 教材の調整

写経教材とは別に、同じ学習目的を持つ実装課題を作りました。入力や処理開始時の状態を引数にし、必要な境界条件を追加しています。初期状態の集計値を引数に含む課題では、指定された初期値から計算を続けます。引数の用途と処理規則を画面に表示します。

- C#の画素変換は`Select`を使い、同梱配布で削除されている`Sum(IEnumerable<int>)`の代わりにループで集計します。変換・集計という目的を保ちます。
- Javaの配列コピー等は有効な添字で参照・独立性を確認します。対応しない配列境界例外の捕捉は採点対象にしません。コンパイラーの既知の生成不具合を避ける公開設定`strictMode:false`を使います。
- SQLのCTE・検索・集計・順位等はfixtureを変え、結果を1個の数値へまとめます。`sample(id, amount, group_id, enabled)`と`quiz_config(counter_limit)`の初期データは各ケースに表示します。

現行512課題に除外はありません。新規追加時も模範解答の実行確認を必須とし、不成立のものは同目的で修正するか、理由を記録して公開対象から外します。Exercism講座1,062演習の実装採点を完了したという意味ではありません。既存の写経・読解・講座は独立して残します。

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
