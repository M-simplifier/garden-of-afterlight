# Afterlightの実装対応表

下のリンクは公開されたHaskell版のcommit `3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c`へ固定している。
スキルだけを別repoへ移しても参照できる。同じcheckoutがあれば該当ファイルを直接読む。
必要な行の周囲と利用箇所・検査を追い、repo全体を一度に読み込まない。

| 判断したいこと | コードと注目箇所 |
| --- | --- |
| 変更を値にして合成する | [Change.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Change.hs): `Change`, `apply`, `between` |
| ゲームの一歩を純粋に進める | [Rules.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Rules.hs): `advance`と`movement`・`action`の合成 |
| 操作・進行・音の意味を型にする | [Types.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Types.hs): `Input`, `Journey`, `Cue`, `World` |
| 時間と短い入力を保持する | [Clock.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Clock.hs): `schedule`, `merge`, `clearEdges` |
| FRPの役割を局所化する | [Signal.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Signal.hs): `lightEnvelope` |
| 永続化する意味と地形差分を選ぶ | [Checkpoint.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Checkpoint.hs): `Snapshot`, `remember`, `restore`, `encode`, `decode` |
| 未観測の編集・削除・restartを追跡する | [World.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/World.hs): `editCell`, `restartWorld`と[Invalidation.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Render/Invalidation.hs) |
| 純粋なモデル生成と表示用データ | [Mesh.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Mesh.hs)と[View.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/View.hs) |
| native資源の取得・借用・交換・解放 | [Resources.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Render/Resources.hs): `prepareModel`, `releaseModel`, `syncChunks`, 描画完了まで借用を保つ`withShader` |
| 音をデータから作り再生する | [Soundscape.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Soundscape.hs)と[Audio.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Audio.hs) |
| 保存・メニューのIO境界と独立した純粋な撮影カメラ | [Runtime.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Runtime.hs)、[Photo.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Photo.hs) |
| GUI起動とアセットパス | [GardenMain.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/tools/GardenMain.hs) |
| 法則と本番入力による検査 | [GardenCheck.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/tools/GardenCheck.hs)と[Tour.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/src/Garden/Tour.hs) |
| headless検査とnative buildの分離 | [garden-of-afterlight.cabal](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/garden-of-afterlight.cabal) |
| ブラウザ出力を再現する | [web/README.md](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/web/README.md)と[build.sh](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/web/build.sh): 固定版・ABI補正・ビルド・検証範囲 |
| 同じruntimeを一フレームずつ呼ぶ | [BrowserMain.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/web/BrowserMain.hs)から`Runtime`の`startupGarden`, `stepGarden`, `shouldCloseGarden`, `shutdownGarden`へ接続 |
| ブラウザ側のメモリ・入力・保存・撮影 | [host/README.md](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/web/host/README.md)から`src/{bridge,input,files,photos}.js`と対応する`test/`へ |
| shader変換とアセットmanifest | [prepare-assets.py](https://github.com/M-simplifier/garden-of-afterlight/blob/3fa0b416d4087d72c0a4aa9e9f012340c3c84e7c/web/prepare-assets.py): 選択した素材だけを配信用に準備 |

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
