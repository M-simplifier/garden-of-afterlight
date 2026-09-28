# 検証の範囲

公開用のソースをビルドし、個人のdotfilesを読み込まない新しいAfterlightチェックアウトで検証します。
アセットは置かず、GHC/Cabalの依存キャッシュはそのホストのものを再利用します。
「OSに何もない状態から全ツールをダウンロードした検証」ではありません。

## Windowsで確認したもの

Node.js 24.13.0、GHC 9.6.7、Cabal 3.12.1.0、HLS 2.14.0.0、Neovim 0.12.4を使用。
チェックアウトのパスには空白を含めています。普段のNeovim設定・VS Codeプロファイルは使いません。

| 検査 | 内容 |
| --- | --- |
| パッケージ | lockfileから依存を導入し、VSIXとNeovimアーカイブを生成。TypeScript型チェック |
| 共通解析器 | 40項目中39成功、Windowsで作成権限のないファイルsymlinkの検査1件をskip |
| Neovim拡張 | 表示、実装の開閉、ソースとUndo、フォルダIO/Pure、差分、非同期のフォーカス、移動、未保存・破棄・自動解析の5スイート |
| AfterlightのGHC解析 | `Change.hs`と`Rules.hs`はPure、`Audio.hs`と`GardenCheck.hs`はIO。すべてGHCの確認結果付き |
| Afterlight＋Neovim＋HLS | 25項目。型、定義、移動履歴、補完、参照、整形、ファイル内rename、未保存の型エラーと回復、CPPを含むRender、別コンポーネントのGardenCheck |
| VS Codeの配布VSIX | 実際の拡張ホストで型ビュー、ソース切替、未保存・Undo、複数ペイン、フォルダ集計、推論、差分を確認 |
| Afterlight＋VS Code＋HLS | 18項目。実コードの型、定義、参照、補完、整形、GHCのIO/Pure、RenderとGardenCheck、未保存の型エラーと回復、型ビューとの往復、Undo |
| VS Codeの自動解析 | 配布VSIXで起動時の索引、推論、除外範囲、依存の変更、未保存バッファの扱いを確認 |

Neovimのディレクトリ移動による故障注入は、Windowsが監視中のディレクトリをロックするためskipしています。
走査失敗後に古いPureを残さない動作は、VS Codeでファイルシステムエラーを注入して検査しています。
mini.filesは任意です。通常の検証は同梱のツリーを使い、mini.filesの実物を使う検査は明示的にそのパスを渡した場合だけ実行します。

この配布時に、Windowsの未保存バッファのパス区切りを正規化し、GHC解析器の日本語診断をUTF-8にしました。
表示を試すだけでは見つからない、編集・診断の境界での修正です。

## 再現する

`editors/haskell-design/` から:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run check
npm test
npm run test:neovim
npm run package
npm run package:neovim
npm run test:vscode
```

VS Codeの実行ファイルがmacOSの標準位置にない場合は、`VSCODE_EXECUTABLE`へ実行ファイルのパスを指定します。
Windowsは `Code.exe` で、`code.cmd`ではありません。
`HASKELL_DESIGN_TEST_VSIX=artifacts/haskell-design.vsix` を指定すると、配布物を展開して検査します。
`HASKELL_DESIGN_TEST_AUTO=1` はサンプルの自動索引・変更追跡の検査です。
テスト用の信頼済みワークスペースは一時プロファイル内に限り、普段の信頼設定には触れません。

実際のAfterlightでHLSまで確認するには、セットアップ済みの**検証用チェックアウト**を使います。

- Neovim: repoルートで `nvim --headless -u editors/neovim/init.lua -i NONE -l editors/verify-neovim.lua`。
- VS Code: 専用の `--extensions-dir` に `haskell.haskell` を導入する。
  そのフォルダを `VSCODE_TEST_EXTENSIONS`、チェックアウトを `HASKELL_DESIGN_TEST_PROJECT`、
  配布VSIXを `HASKELL_DESIGN_TEST_VSIX` に指定して `npm run test:vscode`。

例（PowerShell、`editors/haskell-design/`から）:

```powershell
code --extensions-dir .test-output/vscode-extensions --install-extension haskell.haskell
$env:VSCODE_EXECUTABLE = 'C:/path/to/Microsoft VS Code/Code.exe'
$env:VSCODE_TEST_EXTENSIONS = (Resolve-Path .test-output/vscode-extensions).Path
$env:HASKELL_DESIGN_TEST_PROJECT = 'C:/path/to/verification-checkout'
$env:HASKELL_DESIGN_TEST_VSIX = 'artifacts/haskell-design.vsix'
npm run test:vscode
```

結果はNeovimが `.runtime/haskell-editor/neovim-verification.json`、
VS Codeが `editors/haskell-design/.test-output/` 内の `vscode-result.json`、
`vscode-auto-result.json`、`vscode-afterlight-result.json` に検査別に残します。
HLSの初回起動はCabal構成を読むため数分かかる場合があります。結果ファイルの成功を確認してください。
ゲームのソースには検証の編集を保存しません。

## 別のゲームへの持ち出しを再現する

Windows / GHC 9.6.7 / Cabal 3.12.1.0 / HLS 2.14.0.0 / VS Code 1.127.0で確認しました。
コピーしたスキルによる設定・コンパイラ検査 **14件**、配布VSIXを使ったVS Code／HLS検査 **28件**が成功しています。
これは実際のエディタを使った自動検査で、人間による操作感の評価や他OSの確認ではありません。

`editors/fixtures/portable-game/` は、Afterlightとは別名・別配置の小さな端末ゲームです。
`lantern-courier`というパッケージに、`engine/`のlibrary、`desktop/`のexecutable、
`checks/`のtestがあります。libraryは`containers`を使い、hostとtestはそのlibraryへ依存します。
ゲームの描画や性能ではなく、別プロジェクトのエディタ接続を検査するための実装です。

repoルートで、拡張をビルド済みの状態から実行します。

```sh
node editors/test-project-setup.mjs
```

この検査はOSの一時フォルダに独立したGit repoを作り、3つのスキルをコピーします。
そのコピーに含まれる設定生成スクリプトを使い、実際のCabalビルドとゲームのルール検査、
型解析、設定の競合時に何も上書きしないこと、JSONCの既存設定を残すことを確認します。
ビルド済みlibraryのソースへ型エラーを入れる検査では、host側の解析も失敗することを確かめ、
古いコンパイル済みlibraryで成功してしまう状態を検出します。終了前にソースを復元します。

GHCなどを明示する場合は `HASKELL_DESIGN_TEST_GHC`、`HASKELL_DESIGN_TEST_CABAL`、
`HASKELL_DESIGN_TEST_HLS` を設定します。結果と作成したフォルダの場所は
`.runtime/editor-portability/setup-result.json` に残ります。

続いて、そのフォルダをVS Codeで開く検査を実行します。専用の拡張フォルダに
公式Haskell拡張を導入したうえで、`editors/haskell-design/` から:

```powershell
$env:VSCODE_EXECUTABLE = 'C:/path/to/Microsoft VS Code/Code.exe'
$env:VSCODE_TEST_EXTENSIONS = 'C:/path/to/isolated-vscode-extensions'
$env:HASKELL_DESIGN_TEST_PROJECT = (Get-Content ../../.runtime/editor-portability/setup-result.json -Raw | ConvertFrom-Json).project
$env:HASKELL_DESIGN_TEST_PORTABLE = '1'
$env:HASKELL_DESIGN_TEST_VSIX = 'artifacts/haskell-design.vsix'
npm run test:vscode
```

`.code-workspace`ではなくフォルダ自体を開き、配布VSIX・公式Haskell拡張・実際のHLSを使用します。
結果は `.test-output/vscode-portable-result.json` です。型ビューが既定で開くこと、推論型、
Pure/IO、全3コンポーネントの型情報、定義・参照・補完・整形、未保存の型エラー、
ビュー切り替え後のUndoと診断の消去を検査します。

## 主張しないこと

- macOS/Linux/WSLでこのAfterlightセットアップ全体が成功するという実機確認。
- Neovideの描画や人間による入力感の確認。Neovimは実バッファとLSPをheadlessで検査しています。
- Pure表示による純粋性の証明、CPP・Template Haskellの意味解析、外部ライブラリ全体の監査。
- 外部ライブラリ内部への全ての定義ジャンプ。
- Windowsのモジュール間rename。HLSの一部バージョンで呼び出し側の編集が欠けたため無効です。

ゲーム本体・ブラウザ版のビルドと、ここでのエディタ環境の検証は別のものです。
