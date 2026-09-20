---
name: fp-gamedev
description: Haskellの純粋関数型ゲーム実装。Cabal・raylib・必要に応じたYampaを使い、状態遷移、時間、入力、3D、アセット、保存、性能、ネイティブ／ブラウザ出力を扱う。新作の実装、既存ゲームの拡張・修正・技術レビューに使う。
license: MIT
---

# FP Gamedev

ゲームの仕様を、検査できる純粋なルールと実機で動くプログラムへ実装するための道具。
題材、作風、制作順序、相談の仕方は利用者に委ねる。既存プロジェクトの契約を優先する。

Haskellの設計・実装・レビューには、同梱の
[haskell-excellence](../haskell-excellence/SKILL.md)を併用する。
この本体を入口とし、下表から今回の変更に関係する資料だけを読む。

## 実装の核

```haskell
advance :: TickInput -> GameState -> (GameState, [Effect])
```

型名やモジュール構成はゲームに合わせる。この形で守るのは次の関係。

- **正本**: 結果を決める状態・入力・時刻・乱数種・処理順を明示する。
  ルールは純粋に評価し、音声・通知などの要求は閉じたデータで返す。
- **境界**: ウィンドウ、デバイス入力、描画、音声再生、ファイル、実時計、
  GPU資源は外側のIOが扱う。効率化のための局所的な`ST`は純粋なAPIと両立する。
- **時間と入力**: 描画フレームの観測、tickへ割り当てる操作、世界に対して解決した
  命令を区別する。別々の型が必要かは用途で判断する。描画FPSをゲーム法則にしない。
- **派生物**: 描画用データ、キャッシュ、補間、計測は正本から導く。
  キャッシュを捨ててもゲーム結果が変わらず、描画がルールを再実装しない境界を作る。
- **品質の根拠**: 守る性質を型・境界検証・法則テスト・実機確認の適切な場所に置く。
  検査を通すために仕様や検証を弱めず、仕様変更なら期待値と理由も更新する。

新作の既定構成はHaskell / Cabal / h-raylib。Yampaは時間的な合成が必要な箇所に使う。
依存バージョン、描画方式、tick周波数、数値精度は対象環境とゲームの要件で決める。
フレームワークやゲーム固有の型を丸ごと移植する必要はない。

## 必要な知識を選ぶ

| 今回扱うもの | 参照 |
| --- | --- |
| ツールチェーン、依存、OS、起動・配布 | [stack](references/stack.md) |
| ブラウザ出力、起動・入力・配信、Wasm・WebGL | [browser](references/browser.md) |
| 入力、固定刻み、FRP、保存・再構築 | [time-and-state](references/time-and-state.md) |
| カメラ、衝突、モデル、ボクセル、音・フォント | [space-and-resources](references/space-and-resources.md) |
| 動く足場、複数主体、連成系、リプレイ、物理 | [simulation](references/simulation.md) |
| 重さ、大量破壊、局所可変化、並列化 | [performance](references/performance.md) |
| 法則、生成テスト、実機、形式証明、共通化 | [verification](references/verification.md) |
| 動くコードで境界や技法を確かめたい | [Afterlightの実装対応表](references/afterlight.md) |

例を読むときは、必要な関数と呼び出し側・検査を一組で追う。
Afterlightの定数や全構成を新作の必須条件にしない。
未確認のライブラリAPIは利用中の版のソースまたは公式資料で確認する。
実行できなかった確認は、確認済みの範囲と分けて伝える。
