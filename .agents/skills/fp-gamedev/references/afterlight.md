# Afterlightの実装対応表

下のリンクは公開されたHaskell版のcommit `f9081aead5db101f0c602a57de6b855be67f13ba`へ固定している。
スキルだけを別repoへ移しても参照できる。同じcheckoutがあれば該当ファイルを直接読む。
必要な行の周囲と利用箇所・検査を追い、repo全体を一度に読み込まない。

| 判断したいこと | コードと注目箇所 |
| --- | --- |
| 変更を値にして合成する | [Change.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Change.hs): `Change`, `apply`, `between` |
| ゲームの一歩を純粋に進める | [Rules.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Rules.hs): `advance`と`movement`・`action`の合成 |
| 操作・進行・音の意味を型にする | [Types.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Types.hs): `Input`, `Journey`, `Cue`, `World` |
| 時間と短い入力を保持する | [Clock.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Clock.hs): `schedule`, `merge`, `clearEdges` |
| FRPの役割を局所化する | [Signal.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Signal.hs): `lightEnvelope` |
| 永続化する意味と地形差分を選ぶ | [Checkpoint.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Checkpoint.hs): `Snapshot`, `remember`, `restore`, `encode`, `decode` |
| 未観測の編集・削除・restartを追跡する | [World.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/World.hs): `editCell`, `restartWorld`と[Invalidation.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Render/Invalidation.hs) |
| 純粋なモデル生成と表示用データ | [Mesh.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Mesh.hs)と[View.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/View.hs) |
| native資源の取得・借用・交換・解放 | [Resources.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Render/Resources.hs): `prepareModel`, `releaseModel`, `syncChunks` |
| 音をデータから作り再生する | [Soundscape.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Soundscape.hs)と[Audio.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Audio.hs) |
| 保存・メニューのIO境界と独立した純粋な撮影カメラ | [Runtime.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Runtime.hs)、[Photo.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Photo.hs) |
| GUI起動とアセットパス | [GardenMain.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/tools/GardenMain.hs) |
| 法則と本番入力による検査 | [GardenCheck.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/tools/GardenCheck.hs)と[Tour.hs](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/src/Garden/Tour.hs) |
| headless検査とnative buildの分離 | [garden-of-afterlight.cabal](https://github.com/M-simplifier/garden-of-afterlight/blob/f9081aead5db101f0c602a57de6b855be67f13ba/garden-of-afterlight.cabal) |

## 例の範囲

- `Change`の結合・単位・適用・差分の法則が、地形編集と保存で使われている。
  抽象化を読む小さい入口になる。セル型と素材型は作品固有。
- 公開版はアセットなしで`cabal run noema-garden-check`を実行できる構成。
  shader・font・音源等は含まず、ゲーム起動用の完成パッケージではない。
- ゲーム進行全体は純粋遷移。Yampaは光の余韻に使用する。
  多主体の競合、rollback通信、汎用剛体エンジンの実装例ではない。
- `Types`はconstructorを公開し、codecにも作品固有の制約がある。
  スキルの全品質基準を完全に満たす雛形や、形式証明済みの実装とは扱わない。
  新作では必要な境界を改善し、この例の限界まで固定しない。
- native資源の取得・交換は成功経路の具体例であり、部分失敗や非同期例外への
  安全性を完成させた雛形ではない。特に複数chunkの交換中に失敗した場合も、
  登録された所有資源と実体が一致するよう設計し、解放漏れ・二重解放を検査する。
