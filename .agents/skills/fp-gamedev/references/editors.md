# 新しいゲームをエディタで開けるようにする

Haskell Designは、Afterlight以外のHaskellコードでも型と実装を切り替えて読める。
ただし、スキルをコピーしただけでは拡張やGHCの依存パッケージはインストールされない。
新作の開発環境を用意するとき、または利用者がエディタ対応を求めたときは、
ゲームの実装に加えて、そのプロジェクトを開くところまで接続する。

同梱の **[haskell-editor-setup](../../haskell-editor-setup/SKILL.md)** を使う。
別repoへ持っていく場合は `fp-gamedev`、`haskell-excellence`、`haskell-editor-setup` の
3フォルダを、references・scriptsを含めて `.agents/skills/` へコピーする。
導入スキルが見当たらなければ、[公開リポジトリ](https://github.com/M-simplifier/garden-of-afterlight/tree/main/.agents/skills)
から取得する。個人のdotfilesは不要。

利用者からの依頼例:

```text
fp-gamedevで作ったこのゲームを、VS Codeで型から読めるようにしたいです。
haskell-editor-setupを使い、このプロジェクトのGHC・HLS・Cabal設定に合わせて
セットアップしてください。フォルダを開いて、型ビュー・定義ジャンプ・補完・診断が
実際のゲームコードで動くところまで確認してください。
```

新作では、型ビュワーのフル機能も必要ならGHC 9.6.xが現行の対応範囲。
既存プロジェクトのGHCを勝手に変更しない。他の版では宣言表示とHLSの編集支援を使い、
ビュワーのGHC解析が未対応であることを伝える。

Afterlightの `setup.mjs prepare/configure` はAfterlight専用。
新作には、導入スキル内の別プロジェクト用手順と設定生成スクリプトを使う。
パッケージ名、library/executable/testの分け方、ソース配置、native/Wasmのフラグは
作ったゲームのものを使う。生成された絶対パスやパッケージIDを配布用設定としてコピーしない。

VS Codeでは拡張導入後にプロジェクトの `.vscode/settings.json` を接続すれば、
通常の「フォルダを開く」で利用できる。AIは既存設定を保って必要な項目を統合し、
実際のルールとIO側、検査用コードで動作を確かめる。ゲームを作った人の環境だけで
動く設定を残さず、次の利用者が同じスキルで自分の環境に接続できるようにする。
