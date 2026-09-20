# 実装環境と配布

## 迷ったときの構成

| 役割 | 既定 | 変える条件 |
| --- | --- | --- |
| 言語・ビルド | Haskell / Cabal | 利用者の指定、既存repoの構成 |
| ウィンドウ・描画・入力・音声 | h-raylib | 既存backend、対象機種の要件 |
| ゲームの進行 | 純粋遷移＋明示したtick | 別の時間モデルが仕様に必要 |
| 時間的な合成 | 必要な箇所にYampa | 単純な式・遷移だけなら追加しない |
| 検査 | headlessな純粋核＋実機確認 | 各変更に必要な保証で選ぶ |

対象OS、GHC/Cabal、native依存、利用可能なアセット制作手段を先に確認する。
新作では純粋核をlibrary、hostをexecutable、検査をtestまたは検査用executableに分けると、
画像やGPUなしでもルールを検査できる。既存repoをこの形に並べ替える必要はない。

Afterlight公開版の既知の基準はGHC 9.6.7 / GHC2021。
native側の依存範囲はh-raylib 5.5以上5.7未満、Yampa 0.15系で記述されている。
これは新規環境すべてで動くという保証ではない。実際の解決版とOSでビルドし、
再現が必要なら解決結果を固定する。詳細は[実例のCabal設定](afterlight.md)。
不要な依存やプロジェクト固有のビルドフラグをコピーしない。

## アセットの置き方を選ぶ

| 条件 | 選択 | 守る境界 |
| --- | --- | --- |
| 開発中に差し替えるモデル・音・画像 | ローカルファイル＋明示したmanifest | ゲーム側は意味上のID、hostがパスへ解決 |
| 小さく固定されたshader・設定、単体exeが要件 | 埋込みbytesを検討 | デコード・GPU uploadはIO、更新には再ビルド |
| 形状・地形・効果音を規則から作れる | 純粋な生成関数 | 種・パラメータからデータを作り、hostが実体化 |

通常は差し替え可能な外部ファイルを使う。Cabal配布なら必要なファイルを`data-files`へ
列挙し、Cabalのdata directoryから解決する。ZIP配布なら同じmanifestでexe横へ配置し、
exeを基準に解決する。開発CWD、マシン固有の絶対パス、購入パック全体への依存を持ち込まない。

`data-files`は実行ファイルへのバイナリ埋込みではない。
埋込みには、例えば`file-embed`でbytesを生成し、利用する形式・bindingに対応する
メモリ読込みを確認する。大型アセットの実行ファイル膨張、常駐量、外部texture参照も考慮する。
形式がファイルパスを必要とする場合は外部配置を選ぶか、展開と掃除をhostの責務にする。

根拠: [Cabalのdata-files](https://cabal.readthedocs.io/en/stable/cabal-package-description-file.html#accessing-data-files-from-package-code)、
[file-embed](https://hackage.haskell.org/package/file-embed)。API詳細は使用版で確認する。

## 対象OSで確認する

描画・音声・カーソル・フォーカス・終了の確認は実際の対象OSで行う。
別OSやheadlessで通った検査はその代用にならない。
起動・自動終了・入力trace・画像保存の小さなhost用フックは反復検査に使えるが、
フックからゲーム結果を直接書き換えない。

Windowsの配布は、exe、manifestのアセット、必要な非システムDLLを一つの配置へ揃える。
DLLは実際のimportから調べ、ツールはPATHまたは明示引数で探す。
展開先を変え、開発ツールを除いたPATH、別CWD、空白・日本語のパスで起動する。
GUI subsystemはstdoutがない起動も確認する。ログ付き診断起動だけでは検出できない。

ZIPを展開したものが実際に読み込み・描画・終了するところまで確認して、
その対象環境と残る前提を配布物に添える。
