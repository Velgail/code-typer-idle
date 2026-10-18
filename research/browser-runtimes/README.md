# ブラウザ実行環境の調査記録

全体の結論と採用条件は [RUNTIME_RESEARCH.md](../../RUNTIME_RESEARCH.md)。このディレクトリは調査の証拠で、ゲームから読み込まれる実行環境ではありません。第三者の処理系バイナリは収録していません。

## 証拠ファイル

| ファイル | 内容 |
|---|---|
| `catalog.json` | 8言語の候補・確認結果・未解決条件の一覧 |
| `evidence/cpp-clang20.json` | browsercc 0.1.1の版・SHA・正常/構文不正/誤答/1,024問照合・資産量 |
| `evidence/cpp-clang8.json` | 比較用Clang8、1,024問・実行失敗・Worker打切り |
| `evidence/csharp-cases.json` | 正常・Roslyn構文エラー・誤答の実コンパイルと実行 |
| `evidence/csharp-1024-failure.json` | 1,024問を無変更でまとめた場合のLINQ不足による失敗 |
| `evidence/csharp-1008.json` | 不足APIを使う16問を除いた1,008問の全正答照合 |
| `evidence/csharp-version.json` | 実体の.NET/Roslyn/既定言語版 |
| `evidence/rust-go-cases.json` | Goの構文・型エラー・標準ライブラリ、Rustの型・借用検査等 |
| `evidence/rust-go-curriculum.json` | Yaegi・gc・Miriで各1,024問を実行した出力と比較 |
| `evidence/rust-go-timeouts.json` / `go-version.json` | 実体の版と無限ループ時のWorker終了 |
| `evidence/python-lua-sql.json` | 3処理系の固定版・資産SHA・cold/warm・各1,024問・診断・タイムアウト・ライセンス根拠 |
| `evidence/lua-uncleared-stack-failure.json` | Luaスタックを復元せず反復した場合の状態破損 |
| `evidence/lua-cleared-stack.json` | スタック復元を加えた非同期APIでも1,024問通過することの確認 |
| `evidence/java-default.json` | javac成功後、既定設定のWASM生成が失敗する記録 |
| `evidence/java-default-supplement.json` | 単独のガード付きゼロ除算でも失敗、record/switch/Stream等の成功 |
| `evidence/java-relaxed.json` | 公開API `strictMode:false` による1,024問全件一致 |
| `evidence/java-exceptions-default.json` / `java-exceptions-relaxed.json` | 両設定で配列境界例外のJava catchに入らない制約 |
| `evidence/java-build-adjustments.json` | 公開ソースをローカルでビルドした際の設定差分 |
| `evidence/curriculum-audit.json` | 組込/Exercismの規模と必要な構文・依存の監査 |

`passed: true` は**検証ケースが期待どおり分類された**ことを表します。例えば`wrong-result`では誤答を正解扱いせずに識別できることが成功条件です。Javaの意味論検証の失敗は、ハーネスの故障と誤認しないでください。

Luaのスタック未復元による失敗記録は、反復する例外を抜粋しています。元の失敗件数・代表例・元記録のSHAを残し、全件の反復ログは省いています。`manifest.json`は収録したJSONのサイズとSHAを記録します。

## 再確認の条件

教材の入力は基準コミット`44aeb43`の `lessonAt(language, subject, index)` から作成しています。7命令型言語の既存 `scripts/validate-curriculum.mjs` と同じ関数名一意化・main呼出し、SQLはクエリそのものを実行し、`lesson.answer` と比較しました。Goの呼出し用mainには組込`println`を使い、教材関数本体は変更していません。

C#は16問を除外した再試行と、元の全1,024問失敗を別に保存しています。Javaは同じソースに対する設定別の結果を保存しています。Javaの生成バグを回避したことは、完全なJVM互換を保証しません。

実行はChromium154系、localhostの静的HTTPとWorker、COOP/COEPなし。時間はローカル計測です。転送量について、実際の要求bytes・固有ファイルの容量・手元gzipを区別してください。別の圧縮レベル、ページのHTTPキャッシュ、環境負荷によって数値は変わります。

候補の上流URL・固定版・コンパイラーフラグ・SHAは証拠JSONと報告書に記録しています。実験で使った大容量配布物は`work/runtime-research/`で取得し、ゲーム本体や公開`docs/`には追加していません。製品用の配布・キャッシュ・採点ハーネスは今後実装する対象です。
