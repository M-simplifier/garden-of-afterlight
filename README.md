# 余光の庭 · Garden of Afterlight

天界のようなボクセルの庭を舞台にしたゲームの、Haskellソースコードです。
世界の変化を純粋関数で定め、描画・入力・音声を外側で扱います。

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

## 公開範囲

最新版のHaskellコード、Cabal設定、検査用データを公開しています。
画像、フォント、音源、シェーダー、実行ファイル、個人のセーブ、企画書は含みません。
Haskellで記述した地形・モデル・音声の生成処理はコードの一部として含みます。

Windowsホストも `cabal build noema-garden -fnative` でビルド対象にできます。
ただし起動には非同梱の `assets/shaders/`、`assets/fonts/`、`assets/garden-audio/` が必要です。
このリポジトリ単体はゲームの配布パッケージではありません。

## License

[MIT](LICENSE)
