# 型から読み、実装へ降りる

Afterlightのコードを、まず型とデータ定義から読むための **Haskell Design** です。
気になる関数だけ実装を開き、型名から定義へ移動し、IOのある場所をフォルダから辿れます。
NeovimとVS Codeで同じ解析器を使います。個人のdotfilesは必要ありません。

## AIにセットアップしてもらう

このリポジトリを開いたAIへ、次のように依頼してください。

```text
.agents/skills/haskell-editor-setup/SKILL.md を読んで、
このマシンのNeovim（またはVS Code）でHaskell Designを使えるようにしてください。
GHC・HLS・プロジェクト設定まで整え、Afterlightの実際のコードで動作を確認してください。
既存の設定は保ったまま、型ビューと通常の編集を行き来できるようにしたいです。
```

Codexでは **`$haskell-editor-setup`** でも呼び出せます。
AIは環境を調べ、不足するツールを導入し、拡張をビルドして接続します。
最後に「インストールできたか」だけでなく、型表示・定義ジャンプ・補完・診断まで確認します。

## 別のゲームで使う

`fp-gamedev`で作ったゲームにも使えます。導入後はVS Codeでそのゲームのフォルダを開き、
`.hs`を選ぶと型ビューが表示されます。必要な関数だけ実装を開き、通常の編集へ戻れます。

新作へ持ち込むときは `.agents/skills/` の `fp-gamedev`、`haskell-excellence`、
`haskell-editor-setup` をフォルダごとコピーし、AIへ次のように依頼してください。

```text
haskell-editor-setupを読んで、このゲームをVS Codeで型から読めるようにしてください。
このプロジェクトのビルド設定に合わせてGHCとHLSを接続し、
フォルダを開いて型表示・定義ジャンプ・補完・診断が動くところまで確認してください。
```

拡張はエディタのプロファイルに一度導入し、依存やコンパイラ設定はゲームごとに合わせます。
**フォルダを開いただけでツールが自動インストールされるわけではありません。**
AIは公開ソースから拡張を用意できるので、Afterlight全体や個人のdotfilesを新作へコピーする必要はありません。
すでに導入済みなら拡張を再利用し、そのゲーム固有の接続だけ確認します。

ビュワーのGHC解析は9.6.xに対応しています。他のGHCで動く既存ゲームではその版を保ち、
宣言表示とHLSを使います。推論型・IO/Pure解析まで必要な場合は、コンパイラとの互換性をAIが確認します。
具体的な手順は導入スキルの[別プロジェクト用ガイド](../.agents/skills/haskell-editor-setup/references/other-projects.md)にあります。
Afterlight専用の下記コマンドを、そのまま新作に実行しないでください。

## 揃うもの

| 読むとき | 編集するとき |
| --- | --- |
| データ定義、型署名、推論された型を一覧にする | 同じソースへ戻って編集し、Undoを保って一覧へ戻る |
| 関数の本体を必要なところだけ開く | HLSによる型情報、補完、参照検索、診断、整形 |
| 型名から定義へ移動する | ソースと一覧を行き来しても移動履歴を保つ |
| ファイル・フォルダのIO/Pure表示を辿る | Git HEADとの宣言の差分を見る |

`Pure`は「GHCが取得した型・式にIOの使用が見つからなかった」という目印です。
純粋性の証明や外部ライブラリのunsafe監査ではありません。
CPP・Template Haskellなどを使うファイルでは、宣言表示とHLSの編集支援を使い、
この解析器のIO/Pure判定は未解析として扱います。

## 自分で導入する

詳しい手順は **[セットアップ](setup.md)**、操作は **[Haskell Design](haskell-design/README.md)** にあります。
ビュワーのGHC解析は9.6.xに対応し、Afterlightでは9.6.7を使います。
Node.js 22以降、Git、Cabalと、GHC 9.6.7に対応するHLSを用意してください。
Neovimは0.11以降、VS Codeは使用する公式Haskell拡張の要件を満たす版が必要です。

```sh
node editors/setup.mjs doctor
node editors/setup.mjs build
node editors/setup.mjs prepare
node editors/setup.mjs configure --apply
node editors/setup.mjs verify
```

Neovimには、普段の設定に触れずに試せる起動設定も付属します。

```sh
nvim -u editors/neovim/init.lua src/Garden/Rules.hs
```

VS Codeでは、ビルドしたVSIXと公式Haskell拡張をインストールし、
生成された `.runtime/haskell-editor/afterlight.code-workspace` を開きます。
初回はAfterlightのフォルダを信頼し、HLSの読み込みを待ってください。

## 含まれるもの

- `haskell-design/` — 両エディタの拡張、共通解析器、GHC側の実装、検証コード、ライセンス。
- `neovim/` — HLSと補完・操作を接続する設定。プラグイン管理ツールに依存しません。
- `setup.mjs` — 依存の準備、ホストに合った設定の生成、実コードでの解析確認。
- `../.agents/skills/haskell-editor-setup/` — AIが導入と検証を最後まで進めるためのスキル。

生成物、コンパイラの絶対パス、解析キャッシュはGitへ入れません。
別のマシンではその環境で設定を作り直します。ゲームを起動するためのアセットは不要です。

外部ライブラリ内部への定義ジャンプはHLSが位置を返せる場合に限られます。
Windowsではモジュール間リネームに変更漏れを確認したため、同梱設定で無効にしています。
ファイル内のリネームは利用できます。対応範囲と検証結果は[検証記録](verification.md)を参照してください。
