# セットアップ

型を読むビュワー、GHCによる解析、HLSによる編集支援を一緒に接続します。
ゲームの画像・音源は不要です。プロジェクトのビルド依存は必要です。
以下はリポジトリのルートで実行します。

この手順の対象はAfterlightです。新作・別repoには
[別プロジェクト用の導入手順](../.agents/skills/haskell-editor-setup/references/other-projects.md)を使ってください。
ビュワーは共通ですが、パッケージ名・ソース配置・GHCの接続はゲームごとに設定します。

## 1. 環境を揃える

| ツール | この構成で使う版・役割 |
| --- | --- |
| Node.js | 22以降。拡張のビルドとNeovimの監視・通信に使う。単体CLIには不要 |
| Git | 設計の差分に使う |
| GHC | **9.6.7**。共通解析器のビルドにも使う。型推論のGHC API対応範囲は9.6.x |
| Cabal | cabal-version 3.8対応の版。Windows検証は3.12.1.0 |
| Haskell Language Server | **GHC 9.6.7向けの実行ファイルを含む版**。Windows検証は2.14.0.0 |
| Neovim | 0.11以降。追加のプラグイン管理ツールは不要 |
| VS Code | 公式 `haskell.haskell` 拡張の要件を満たす版。ビュワー単体は1.96以降 |

Haskellツールチェーンは[GHCupの公式手順](https://www.haskell.org/ghcup/install/)から導入できます。
既存のGHCを削除したり、ほかのプロジェクトの既定版を切り替えたりする必要はありません。
GHCup導入済みの場合の例です。

```sh
ghcup install ghc 9.6.7
ghcup install hls 2.14.0.0
ghcup whereis ghc 9.6.7
ghcup whereis hls 2.14.0.0
```

`whereis`で得たパスを、以後の `prepare` と `configure` に
`--ghc "そのパス" --hls "そのパス"` として渡せます。Cabalも `--cabal` で選べます。
GHCはPATHの既定版が9.6.7なら省略できます。HLSのwrapper自体に表示されるGHC版と、
プロジェクト用のHLS実行ファイルのGHC版は別なので、最終確認は実際のプロジェクトで行います。

```sh
node editors/setup.mjs doctor
cabal update
```

初回はGHC・Cabalのダウンロードと依存ビルドに時間がかかります。
WindowsではGHCupのCコンパイラ環境も必要です。macOS/Linuxではraylibのビルドに必要な
OSライブラリを揃えてください。Afterlightのネイティブホストと、このセットアップの実機検証はWindowsで行っています。
他OSでのビュワー利用とAfterlightのビルド可否は分けて確認してください。

## 2. 拡張をビルドする

```sh
node editors/setup.mjs build --ghc "GHC 9.6.7の絶対パス"
```

PATHのGHCが9.6.7なら `--ghc` は省略できます。
固定した依存から、`editors/haskell-design/artifacts/` に現在のOS・CPU用のVSIXとNeovim用アーカイブを作ります。
ネイティブ解析器のソースをGHCとCコンパイラでビルドするため、tarとstripも必要です。
WindowsのGHCup版では同梱のLLVM stripを使います。別のOSへコピーする場合は、そのOSでビルドしてください。
エディタの起動時にnpmやコンパイラを自動インストールする仕組みではありません。
手動で同じ操作をする場合は `editors/haskell-design/` で次を実行します。

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run package
npm run package:neovim
```

## 3. Afterlightの型検査環境を作る

```sh
node editors/setup.mjs prepare
node editors/setup.mjs configure --apply
node editors/setup.mjs verify
```

`prepare`はネイティブ構成と検査用コンポーネントの依存をCabalで解決し、必要なものをビルドします。
ゲームは起動しません。専用のビルド計画を `.runtime/haskell-editor/build/` に置きます。
`configure`はその計画から実際のpackage IDとパッケージDBを取り出して、次を生成します。

| ファイル | 接続するもの |
| --- | --- |
| `.haskell-design.json` | ビュワー → GHC、コンポーネントごとの依存 |
| `hie.yaml` | HLS → 共有の`src`と各`tools`に対応するCabalコンポーネント |
| `cabal.project.local` | このチェックアウトで使うGHC、`native`有効・`web`無効 |
| `.runtime/haskell-editor/settings.json` | Neovim用のローカル起動情報 |
| `.runtime/haskell-editor/afterlight.code-workspace` | VS Code用のワークスペースとHLS設定 |

**既存の設定が違う場合は上書きしません。** `.runtime/haskell-editor/generated/` に生成案が残ります。
既存ファイルを退避して必要な設定を統合した後、
`node editors/setup.mjs configure --apply --keep-existing` でエディタの起動情報を作成します。
`--keep-existing`は内容の正しさを保証しません。必ず `verify` とHLSの確認まで行ってください。

`web/BrowserMain.hs`はWasm専用コンパイラで扱うため、このネイティブHLS構成では対象外です。
同梱ツールのHaskellサンプルもAfterlightの解析対象へ混ぜません。
Cabalの依存やGHCを変更したら `prepare` からやり直します。

## 4. エディタを接続する

### Neovim

普段の設定を変えずに、同梱した設定で起動できます。

```sh
nvim -u editors/neovim/init.lua src/Garden/Rules.hs
```

初回の解析を待つと型一覧が開きます。`World`へカーソルを合わせて `gd` で定義へ、`Ctrl-o`で戻ります。
`K`は型情報、`s`は元ソース、`za`は実装の開閉、`f`はフォルダです。
ソースでは `Ctrl-Space`で補完、`Space f`で整形、`Space v`で型一覧、`[d` / `]d`で診断へ移動できます。
`grr`は参照、`grt`は型定義、`gra`は修正候補、`grn`はリネームです。

既存のNeovim設定へ取り込む場合は、次を一度だけ追加します。

```lua
local afterlight = '/absolute/path/to/garden-of-afterlight'
vim.opt.runtimepath:prepend(afterlight .. '/editors/neovim')
require('afterlight_editor').setup({ root = afterlight })
```

既存設定ですでにHLSを起動する場合は `hls = false` を渡し、既存のHLSへコンパイラのPATH、
ルート、操作を接続してください。二つのHLSを同じソースへ接続しないでください。
この設定は指定したAfterlightだけを自動解析の信頼対象にします。

### VS Code

```sh
code --install-extension haskell.haskell
code --install-extension editors/haskell-design/artifacts/haskell-design.vsix --force
code .runtime/haskell-editor/afterlight.code-workspace
```

既存の個人設定を上書きせず、ワークスペースにHLSの接続先を設定します。
HLSは一つのコンポーネントずつ、開いたファイルと依存を読みます。ビュワーによる全体のIO/Pure解析は別に進みます。
Afterlightのフォルダを信頼し、`src/Garden/Rules.hs`を開いてください。
宣言の型名から定義へ進み、「ソースを編集」で通常のHaskell編集へ切り替えます。
ソースではF12で定義へ、ホバーで型情報、Ctrl-Spaceで補完を利用できます。
「Haskell Design: Open Design View」で型一覧へ戻れます。

## 5. 実際に使えることを確認する

`verify`は実コードの型取得とIO/Pure表示を確認します。HLSの接続は別に確認します。

- `Rules.hs`の`advance`で型が見える。`World`の定義へ移動し、元へ戻れる。
- `Audio.hs`のIO表示と根拠、`Change.hs`のPure表示を確認する。
- ソースで補完・参照検索・整形が働く。
- 未保存の一時的な型エラーに診断が出て、取り消すと消える。検証の編集は保存しない。
- 編集→型一覧→ソースと往復しても未保存の内容とUndoが残る。
- `Render.hs`はCPPを含むがHLSの型情報が得られる。ビュワーのPure判定と混同しない。
- `GardenCheck.hs`も別のCabalコンポーネントとして読める。

Neovimでは次の自動検査も使えます。実ソースの変更はメモリ内だけで、保存しません。

```sh
nvim --headless -u editors/neovim/init.lua -i NONE -l editors/verify-neovim.lua
```

結果は `.runtime/haskell-editor/neovim-verification.json` に残ります。
VS Codeの拡張ホスト検査と確認済みの範囲は[検証記録](verification.md)を参照してください。

## つまずいたとき

| 症状 | 確認する場所 |
| --- | --- |
| 宣言は見えるが`—`のまま | GHC 9.6.7、ワークスペース信頼、`.haskell-design.json`、未保存の設定 |
| `Ambiguous target` | `hie.yaml`で`src`が一つのコンポーネントに割り当てられているか |
| パッケージが見つからない | `prepare`の成功、GHCとCabal DBの一致、生成案のpackage ID |
| HLSが起動しない | プロジェクトのGHC版に対応するHLS、エディタから見えるPATH |
| 外部パッケージの定義へ飛べない | HLSが型だけを返す場合がある。プロジェクト内の定義移動と分けて確認 |
| Windowsで公開名をリネームできない | 不完全なモジュール間編集を避けるための設定。無理に解除しない |

HLSの[導入](https://haskell-language-server.readthedocs.io/en/stable/installation.html)と
[プロジェクト設定](https://haskell-language-server.readthedocs.io/en/stable/configuration.html#configuring-your-project-build)、
VS Codeの[Haskell拡張](https://github.com/haskell/vscode-haskell)も参照できます。
