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

**新作に取り込むには**、`.agents/skills/`内の二つのフォルダを、同じ並びのまま
新作repoの`.agents/skills/`へコピーします。各フォルダの`references/`、`agents/`、
`LICENSE`も含めます。既に同名のスキルがある場合は内容を比較して採用する版を選んでください。
Codexはこの配置からスキルを発見できます。他のAIでは、二つの`SKILL.md`の場所を渡し、
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

技術資料は複数のゲーム実装から抽出した判断と、その適用条件・検査方法です。
Afterlightは地形編集、移動、保存、表示・音声などの具体例を示します。
スキルの全パターンをこの一作で実証したという意味ではありません。
必要な開発ツールやアセット制作ツールは利用環境に用意してください。

## 最初に読む一枚

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
検査は550件の生成ケースに加え、通常のゲーム入力で物語を完了し、四島に着地して建築します。
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

## 公開範囲

Haskellコード、Cabal設定、検査用データ、ブラウザ出力のコード・ツール、実装スキルを公開しています。
作品の画像、フォント、音源、シェーダー、実行ファイル、個人のセーブ、企画書は含みません。
ブラウザ互換用の小さなscreen vertex shaderはビルドツールに含みます。
Haskellで記述した地形・モデル・音声の生成処理はコードの一部として含みます。

Windowsホストも `cabal build noema-garden -fnative` でビルド対象にできます。
ただし起動には非同梱の `assets/shaders/`、`assets/fonts/`、`assets/garden-audio/` が必要です。
このリポジトリ単体はゲームの配布パッケージではありません。

## License

[MIT](LICENSE)。外部依存への差分は[元のライセンスと変更内容](web/patches/README.md)を添えています。
