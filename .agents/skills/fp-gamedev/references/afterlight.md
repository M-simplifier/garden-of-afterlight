# Afterlightの実装対応表

下のリンクは公開されたHaskell版のcommit `b4c31a4937c8d4b2796512cd8c03972a11ce0e15`へ固定している。
スキルだけを別repoへ移しても参照できる。同じcheckoutがあれば該当ファイルを直接読む。
必要な行の周囲と利用箇所・検査を追い、repo全体を一度に読み込まない。

| 判断したいこと | コードと注目箇所 |
| --- | --- |
| 変更を値にして合成する | [Change.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Change.hs): `Change`, `apply`, `between` |
| ゲームの一歩を純粋に進める | [Rules.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Rules.hs): `advance`と`movement`・`action`の合成 |
| 操作・進行・音の意味を型にする | [Types.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Types.hs): `Input`, `Journey`, `Cue`, `World` |
| 時間と短い入力を保持する | [Clock.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Clock.hs): `schedule`, `merge`, `clearEdges` |
| FRPの役割を局所化する | [Signal.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Signal.hs): `lightEnvelope` |
| 永続化する意味と地形差分を選ぶ | [Checkpoint.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Checkpoint.hs): `Snapshot`, `remember`, `restore`, `encode`, `decode` |
| 未観測の編集・削除・restartを追跡する | [World.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/World.hs): `editCell`, `restartWorld`と[Invalidation.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Render/Invalidation.hs) |
| 純粋なモデル生成と表示用データ | [Mesh.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Mesh.hs)と[View.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/View.hs) |
| native資源の取得・借用・交換・解放 | [Resources.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Render/Resources.hs): `prepareModel`, `releaseModel`, `syncChunks`, 描画完了まで借用を保つ`withShader` |
| 画質とUI・操作の基準を分ける | [Render.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Render.hs): `renderSceneWith`の入力textureと出力画面、`withUIScale`。品質は描画資源に属し、純粋なworldやsaveへ混ぜない |
| 音をデータから作り再生する | [Soundscape.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Soundscape.hs)と[Audio.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Audio.hs) |
| 保存・メニューのIO境界と独立した純粋な撮影カメラ | [Runtime.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Runtime.hs)、[Photo.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Photo.hs) |
| GUI起動とアセットパス | [GardenMain.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/tools/GardenMain.hs) |
| 法則と本番入力による検査 | [GardenCheck.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/tools/GardenCheck.hs)と[Tour.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/src/Garden/Tour.hs) |
| headless検査とnative buildの分離 | [garden-of-afterlight.cabal](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/garden-of-afterlight.cabal) |
| ブラウザ出力を再現する | [web/README.md](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/web/README.md)と[build.sh](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/web/build.sh): 固定版・ABI補正・ビルド・検証範囲 |
| 同じruntimeを段階的に準備し一フレームずつ呼ぶ | [BrowserMain.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/web/BrowserMain.hs)から`Runtime`の`beginGarden`, `stepGarden`, `previewGarden`, `setGardenActive`, `shutdownGarden`へ接続 |
| ブラウザ側のメモリ・入力・保存・撮影 | [host/README.md](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/web/host/README.md)から`src/{bridge,input,files,photos}.js`と対応する`test/`へ |
| shader変換とアセットmanifest | [prepare-assets.py](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/web/prepare-assets.py): 選択した素材だけを配信用に準備 |
| Webの起動・中断・配信の判断根拠 | [EXPERIENCE.md](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/web/EXPERIENCE.md): 一次資料、採否、実作品の計測と確認範囲 |
| 進捗を測り、Wasmのキャッシュを保つ | [loading.js](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/web/host/src/loading.js): 元Responseでstreaming、展開後バイト数の計測 |
| 圧縮とキャッシュを実際に配信する | [serve.py](https://github.com/M-simplifier/garden-of-afterlight/blob/b4c31a4937c8d4b2796512cd8c03972a11ce0e15/web/serve.py): MIME、encoding、表現別ETag、固定名の再検証 |

## 例の範囲

- `Change`の結合・単位・適用・差分の法則が、地形編集と保存で使われている。
  抽象化を読む小さい入口になる。セル型と素材型は作品固有。
- 公開版はアセットなしで`cabal run noema-garden-check`を実行できる構成。
  作品のshader・font・音源等は別途必要。ブラウザ互換用のscreen vertex shaderのみ同梱。
  ゲーム起動用の完成パッケージではない。
- ゲーム進行全体は純粋遷移。Yampaは光の余韻に使用する。
  多主体の競合、rollback通信、汎用剛体エンジンの実装例ではない。
- `Types`はconstructorを公開し、codecにも作品固有の制約がある。
  スキルの全品質基準を完全に満たす雛形や、形式証明済みの実装とは扱わない。
  新作では必要な境界を改善し、この例の限界まで固定しない。
- 資源取得の途中失敗を巻き戻し、複数chunkは準備後に登録を交換してから旧資源を解放する。
  ただし全取得段階への障害注入や全非同期例外の検証を済ませたものではない。
  新しい資源を加えたときも、登録された所有資源と実体の一致を確認する。
