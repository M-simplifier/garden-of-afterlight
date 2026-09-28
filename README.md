# 余光の庭 · Garden of Afterlight

天界のようなボクセルの庭を舞台にしたゲームのHaskell実装と、
別のゲームにも持ち出せるAI向けの実装スキルです。
世界の変化を純粋関数で定め、描画・入力・音声を外側で扱います。

## 自分のゲームに使う

ゲームの仕様をAIへ伝え、同梱の **`fp-gamedev`** を使って実装を依頼できます。
Haskellの品質基準は **`haskell-excellence`** にまとめ、`fp-gamedev`から参照します。
ゲームの題材・作風・制作の進め方は利用者が決められます。

| スキル | 扱うもの |
| --- | --- |
| [haskell-excellence](.agents/skills/haskell-excellence/SKILL.md) | 型と不変条件、純粋性、エラー、抽象化、資源管理、意味のある検査 |
| [fp-gamedev](.agents/skills/fp-gamedev/SKILL.md) | 技術スタック、時間と入力、3D空間、アセット、保存、相互作用、性能、検証 |
| [haskell-editor-setup](.agents/skills/haskell-editor-setup/SKILL.md) | そのゲームをVS Code／Neovimで読むための型ビュワー、GHC・HLS、導入と動作確認 |

**新作に取り込むには**、`.agents/skills/`内の上記三つのフォルダを、同じ並びのまま
新作repoの`.agents/skills/`へコピーします。各フォルダの`references/`、`scripts/`、`agents/`、
`LICENSE`も含めます。既に同名のスキルがある場合は内容を比較して採用する版を選んでください。
Codexはこの配置からスキルを発見できます。他のAIでは、必要な`SKILL.md`の場所を渡し、
参照先を必要に応じて読むよう依頼してください。
配置の詳細は[公式説明](https://learn.chatgpt.com/docs/build-skills#where-codex-loads-local-skills)を参照できます。

```text
$fp-gamedev を使って、以下の仕様のゲームを実装してください。
［作りたいゲーム、対象環境、今回作る機能］
```

短いスキル本体が判断の入口になり、詳細は機能に応じて読みます。
[実装対応表](.agents/skills/fp-gamedev/references/afterlight.md)からAfterlightのコードと検査へ辿れます。
参照は公開commitに固定してあり、スキルだけを新作へ移しても使えます。
ライブラリとしてAfterlight全体へ依存する必要はありません。

作ったゲームも **[VS Codeで型から読めます](editors/README.md#別のゲームで使う)**。
`haskell-editor-setup`は新作のCabal構成に合わせて接続し、フォルダを開いた状態で
型表示・移動・補完・診断まで確認するためのスキルです。

技術資料は複数のゲーム実装から抽出した判断と、その適用条件・検査方法です。
Afterlightは地形編集、移動、保存、表示・音声などの具体例を示します。
スキルの全パターンをこの一作で実証したという意味ではありません。
必要な開発ツールやアセット制作ツールは利用環境に用意してください。

## 最初に読む一枚

設計の全体像は、**[Haskellでつくる余光の庭](https://m-simplifier.github.io/garden-of-afterlight/guide/)** で読めます。
構成図から実際の型へたどれる、Afterlightの技術解説です。

**[型からコードを読む](editors/README.md)** — Neovim・VS Code向けのHaskell Designを同梱しています。
型とデータ定義を一覧にし、必要な実装だけ開き、IOのある場所を辿れます。
**[`haskell-editor-setup`](.agents/skills/haskell-editor-setup/SKILL.md)** をAIへ渡すと、
コンパイラ・HLS・エディタ設定の導入から、実コードでの動作確認まで進められます。

**[AIも型とデータ定義から読む](editors/haskell-design/docs/reader.md)** — `map` / `outline` / `show` で
全体を把握し、必要な関数の実装だけを取得できます。通常の読取にはNodeだけを使います。
`fp-gamedev`にもこの読み方を組み込んでいます。

**[Garden.Change](src/Garden/Change.hs)** — 「置く」「取り去る」を重ね、庭に反映し、二つの庭の差を取り出す62行。

```haskell
apply (a <> b) garden == apply b (apply a garden)
apply (between before after) before == after
```

変更の合成と適用の関係は、地形編集とチェックポイントの保存・復元を実際に支えています。

## 読み進める

| ファイル | 読めること |
| --- | --- |
| [Types](src/Garden/Types.hs) | セル、素材、住人、進行、世界を表す型 |
| [Rules](src/Garden/Rules.hs) | `advance :: Input -> World -> (World, [Cue])` による1/60秒の変化 |
| [Clock](src/Garden/Clock.hs) | 経過時間と短い入力を失わない固定刻み |
| [Checkpoint](src/Garden/Checkpoint.hs) | 保存対象を明記したSnapshotと地形差分 |
| [Render.Invalidation](src/Garden/Render/Invalidation.hs) | 世界の編集履歴から描画キャッシュの更新範囲を導く |
| [Render.Settings](src/Garden/Render/Settings.hs) | 画質と個別設定から描画計画・確保するバッファ・処理量を純粋に決める |
| [Render.Chunk](src/Garden/Render/Chunk.hs) | 描画用の地形分割と、広角を含む保守的な可視判定 |
| [Render.Radiance](src/Garden/Render/Radiance.hs) | 描画計画をGPUで実行する。ゲーム状態の更新や入力を扱わない |
| [Host.Control](src/Garden/Host/Control.hs) | 入力を使うプレイと、入力を扱わない検証を区別する |
| [Photo](src/Garden/Photo.hs) | ゲーム状態から独立した撮影カメラ |
| [Mesh](src/Garden/Mesh.hs) | セルから表示用のボクセル形状を組み立てる純粋関数 |
| [GardenCheck](tools/GardenCheck.hs) | 法則、保存互換性、衝突、物語と四島への移動を検査 |

地形の正本は `Map Cell Material`。GPUメッシュはその派生物です。
Yampaは光の余韻に使い、ゲーム全体の進行は純粋な状態遷移として記述しています。
公開された型だけで全不変条件を保証する設計や、形式証明済みの実装ではありません。

## アセットなしで検査する

GHC 9.6.7とCabalで確認しています。リポジトリのルートで実行してください。

```sh
cabal update
cabal run noema-garden-check
```

既定では描画・音声ライブラリを必要とするWindowsホストをビルドしません。
検査は800件の生成ケースに加え、通常のゲーム入力で物語を完了し、四島に着地して建築します。
これはOSのキー入力や人間によるプレイテストとは別の検査です。
`tools/fixtures/garden-v3.txt` は旧エンコーダーで生成した互換性検査用の二編集の庭で、個人のプレイ記録ではありません。

## ブラウザへ出力する

同じHaskellのゲームルールとraylib描画を、GHC Wasm＋WebGL 2で動かせます。
Linux / WSLでの[ビルド手順](web/README.md)と、[再利用する際の判断](.agents/skills/fp-gamedev/references/browser.md)を同梱しています。
ツールチェーン、bindingの32bit補正、アセット準備は`web/build.sh`へまとめました。
出力は静的ファイル一式で、専用のゲームサーバーは不要です。

ブラウザ用hostはフレーム実行、クリックによるマウス捕捉、ブラウザ内保存、写真の
ダウンロードを受け持ちます。ゲームのルール・保存形式・固定tickをJavaScriptで書き直しません。
起動には以下の非同梱アセットが必要です。

## 描画と負荷の切り替え

HDRの光、二段階の動的な影、立体的な雲、接地陰影、縮小バッファでのブルームを使います。
Windows版は **F4**、ブラウザ版は画質メニューで「高画質・標準・軽量」を切り替えます。
ブラウザの「描画の調整」では、解像度・影・雲・接地陰影・光のにじみを個別に上書きできます。
文字やメニューは描画解像度を下げても元の解像度を保ちます。

[描画設計と検証結果](docs/rendering.md)に、各設定の処理量、ネイティブ環境変数、性能測定の条件をまとめています。
シェーダーはこのrepo内のコードを使い、ブラウザビルド時にも外部アセットの古いシェーダーで置き換えません。

## マウスを捕捉せずに確認する

`GARDEN_INPUT=observe` で非表示・入力なしのネイティブ起動になります。
フレーム数を指定する検証、スクリーンショット、巡回テストも既定でこのモードです。
このモードは最初の庭から始まり、既存セーブの読み書きと音の再生を行いません。

```powershell
cabal build noema-garden noema-render-check -fnative
$exe = cabal list-bin noema-garden -fnative
./tools/Observe-Garden.ps1 -Executable $exe -Quality high -Frames 360
cabal run noema-render-check -fnative
```

`Observe-Garden.ps1`は子プロセスだけに設定を渡し、画面と計測を`.runtime/observe-*`へ残します。
`noema-render-check`は昼夜、各画質、個別効果、縦長画面、広角・望遠・傾き、繰り返し切り替えを
実際の描画経路で実行し、`.runtime/render-check/`へ保存します。
ブラウザでは「クリックして庭へ」を押す前のプレビューで、マウス捕捉なしに画質を確認できます。

## 公開範囲

Haskellコード、GLSLシェーダー、Cabal設定、検査用データ、ブラウザ出力のコード・ツール、実装スキルを公開しています。
エディタ拡張のソースと、その導入・検証を行うセットアップスキルも含みます。
作品の画像、フォント、音源、実行ファイル、個人のセーブ、企画書は含みません。
ただし、技術解説に使うゲーム画面とリンク紹介画像は `web/guide/assets/` に同梱しています。
ブラウザ互換用の小さなscreen vertex shaderはビルドツールに含みます。
Haskellで記述した地形・モデル・音声の生成処理はコードの一部として含みます。

Windowsホストも `cabal build noema-garden -fnative` でビルド対象にできます。
ただし起動には非同梱の `assets/fonts/`、`assets/garden-audio/` が必要です。
このリポジトリ単体はゲームの配布パッケージではありません。

## License

[MIT](LICENSE)。外部依存への差分は[元のライセンスと変更内容](web/patches/README.md)を添えています。
