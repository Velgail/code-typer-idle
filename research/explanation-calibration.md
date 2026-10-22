# Challenge報酬の計測と監査

全321題材を代表言語で新規測定し、受理した公開解説の受領までの実経過時間を報酬の相対値に使う。モデル・ツール・通信の待ち時間を含み、人間の解答時間や本質的な難易度を確定した値ではない。原文や実装の字数、旧版の要約・回帰・予測は報酬に使わない。

## ソース管理する入力

[challenge-calibration.json](challenge-calibration.json) は、採用した試行IDと正確なナノ秒文字列、実アプリ6件、ゲーム内作業量の基準を保持する。単発と反復の中央値を区別し、中央値の計算と整数報酬への丸めは有理数のまま行う。題材ごとの報酬は旧表から変更していない。同じ題材の言語別実装は共通の報酬を使う。

```sh
npm run rewards:check
npm test
```

通常のビルド・テストは監査原本をダウンロードしない。小さな検証データで算定・採点・展開処理を検査し、321題材の入力から配布用の報酬表を再現する。[ゲーム内の適用検証](explanation-game-balance.json)もこの入力と実際のcore APIを使う。

## 原本の保管

[監査用Release](https://github.com/Velgail/code-typer-idle/releases/tag/audit-calibration-v2-20261022)に、元コミット `d7b75a1e1d8ce118bf949cd44ea14e3929b3422d` のresearch全991ファイルを保管する。原文・出題宣言・時計・実装・採点・独立査読・裁定と訂正履歴・撤回済み資料を含む。449試行のうち448件を受領し、空原文7件と原文未受領1件を区別した記録もそのまま残す。

[audit-evidence.json](audit-evidence.json) は配布先、圧縮ファイルのSHA-256、サイズ、件数、全ファイル用manifestのSHA-256を固定する。全ファイルの一覧と個別ハッシュはReleaseの `research-files.json` に置く。GitHub側のRelease設定とは別に、取得した内容が固定ハッシュと一致しなければ検証を失敗させる。原本を訂正する場合は既存の資産を差し替えず、別版として公開する。

圧縮を展開すると、`research/raw-explanation-observations.md` が全試行の一覧、`research/raw-explanation-answers/` が答案全文、`research/raw-explanation-submissions.json` が原文・時計・実装採点、`research/raw-explanation-assessments.json` が独立査読と裁定履歴になる。旧資料は撤回済みとして保持し、現行の報酬計算には読み込まない。

## 全原本から再検証する

```sh
npm run audit:verify
```

明示的に取得した原本と全ファイルmanifestをSHA-256で照合し、隔離した一時ディレクトリへ展開する。出題・試行宣言、実アプリの契約、解説原文の採否と時計を検査し、全報酬を再生成してチェックアウト中の小さな入力表・配布用JSと一致することを確認する。ゲームの研究ファイルやセーブを上書きしない。取得物のキャッシュは `work/audit-cache/` に置く。

ローカルの配布ファイルを使う場合は `--archive FILE --files-manifest FILE` を指定できる。Node.js 22以上とC++17コンパイラーが必要。

## 実装を再コンパイル・再採点する

```sh
npm run audit:replay
npm run audit:replay -- --id trial_1bd2bf66e6fe246774a4
```

`audit:verify` の確認に加え、保存済みの解答実装を処理系で採点し、保存されている合否・分類・各ケースの結果と照合する。`--id` は対象を限定し、省略時は全449試行を対象にする。ブラウザ採点にはPlaywrightとChromium、配布用docsのビルドが必要。これは実装の検証であり、新しい解答時間の計測ではない。

監査入力、算定処理、採点器などを変更したPRでは、通常テストとは別の監査CIが原本からの検証を実行する。実装の全再採点は手動実行の監査ワークフローから選べる。
