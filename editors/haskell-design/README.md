# Haskell Design

Haskellファイルを開くと、まずデータ定義・型・関数の入出力を表示するVS Code拡張とNeovimプラグインです。同じローカル解析器を使うので、両エディタで同じ設計ビューとIO判定が得られます。

Afterlightを初めて開く場合は、[エディタ環境のセットアップ](https://github.com/M-simplifier/garden-of-afterlight/blob/main/editors/README.md)から始めてください。
別のゲームで使う場合は、[新しいプロジェクトへの接続](https://github.com/M-simplifier/garden-of-afterlight/blob/main/editors/README.md#別のゲームで使う)を参照してください。
ビュワー本体は共通で、セットアップスキルがそのゲームのCabal構成とエディタを接続します。

## できること

- `data`、`newtype`、型の別名、GADT、型クラス、インスタンス、型族、説明コメントを表示。関数・メソッドの本体は必要なときだけ開閉できます。非公開の定義も対象です。
- 型名から定義へ移動し、元のソースや、名前を参照するテスト・性質の候補を開けます。依存パッケージへの移動はHLSが位置を返せる場合に限られます。
- ファイルと親フォルダに `IO` / `Pure` を表示します。フォルダからIOを含む場所をたどれます。通常のVS Codeエクスプローラーは文字数制限に合わせて `Pure` を `P` と表示します。解析中は `…`、解析できない場合は `—` です。
- GHCで保存済みコードを確認し、型署名のない関数の推論型を表示できます。
- Git HEADと現在のバッファから宣言を抽出し、エディタ標準の差分表示で比較できます。未保存の変更も比較対象です。
- ソースの変更を反映し、変更前の型とIOの解析結果を失効させます。

## VS Code

VS Code 1.96以降。`artifacts/haskell-design.vsix` を **Extensions: Install from VSIX…** で選択します。HLSは必須ではありません。既存のHaskell言語拡張・ハイライト設定と併用できます。

1. Haskellプロジェクトのフォルダと `.hs` ファイルを開く。設計ビューが最初から表示される。
2. 「ソースを編集」または宣言の行番号で、同じエディタ領域をソースへ切り替える。
3. エディタ右上の設計アイコン、または **Haskell Design: Open Design View** で戻る。未保存の編集とUndo履歴も残る。未保存中は元のタブも保持し、保存後の切り替えで1タブに戻る。
4. 型とIOの確認は自動で進む。確認後は通常のエクスプローラーにもIO / P（Pure）が付き、親フォルダからたどれる。
5. 「設計の差分」でGit HEADと現在の宣言を比較する。

通常のエクスプローラーにはファイルとフォルダの印、「Haskell Design」ツリーには状態名と件数が付きます。フォルダを展開してファイルを選ぶと設計を開きます。

既に開いていたソースは **Open Design View** で切り替えます。ソースを既定に戻す場合は、タブの **Reopen Editor With… → Configure default editor… → Text Editor** を選べます。

GHCの実行とGitアクセスにはVS Codeのワークスペース信頼が必要です。GHCによる自動確認は既定で有効です。初回や変更直後はバックグラウンドで確認し、再オープン時は入力を照合して保存済みの結果を再利用します。無効にする場合は `haskellDesign.autoVerify: false` と指定します。

## Neovim

Neovim 0.11以降、Node.js 20以降。配布アーカイブにはビルド済みの共通解析器を同梱しています。プラグインのルートを `runtimepath` に追加します。

```lua
-- 展開先の絶対パスに置き換える
vim.opt.runtimepath:prepend('/path/to/haskell-design')
require('haskell-design').setup()
```

lazy.nvimでローカルのソースを使う場合:

```lua
{
  dir = '/path/to/haskell-design',
  event = 'VeryLazy', -- Haskellファイルを開く前から索引を作る
  -- 初回の導入・更新時に npm ci --ignore-scripts と npm run build を実行しておく。
  config = function()
    require('haskell-design').setup()
  end,
}
```

| コマンド | 操作 |
| --- | --- |
| `:HaskellDesign` | 同じウィンドウを設計ビューへ切り替える |
| `:HaskellDesignSource` | 元の編集バッファへ戻る |
| `:HaskellDesignVerify` | GHCで型とIOを確認 |
| `:HaskellDesignDiff` | Git HEADとの設計差分を別タブで表示 |
| `:HaskellDesignFiles` | フォルダとファイルの状態・件数をツリー表示 |
| `:HaskellDesignEvidence` | 判定の根拠をquickfixへ表示 |
| `:HaskellDesignTests` | 選択した宣言に関連するテスト候補 |
| `:HaskellDesignRefresh` | 表示と確認結果を更新 |

`.hs` を開くと、同じウィンドウに設計が表示されます。設計ビューでは `<CR>` または `s` でソースの編集へ、`f` でフォルダへ、`za` で実装を開閉、`gd` で型の定義へ、`K` で型情報、`grr` で参照、`grt` で型定義、`grn` / `gra` でソースへ移ってリネーム・修正候補を表示し、`t` でテスト候補、`v` でGHC確認、`d` で差分、`e` でIOの根拠、`q` でソースへ戻ります。ソースの未保存変更とUndo履歴を保持します。フォルダでは `<CR>` / `za` で展開・ファイル選択、`q` で戻ります。元のバッファの先頭行にも印を表示します。ステータスライン用に `require('haskell-design').status()` も使えます。

ソースを既定にしたい場合は `setup({ design_first = false })` と指定します。ネイティブの差分ウィンドウは設計へ自動切り替えしません。

ファイラーから現在の場所を開く設定では、仮想バッファ名の代わりに `source_path()` を使います。設計と設計差分なら元ソース、フォルダ表示なら選択した実際のパスを返します。たとえばmini.filesとの連携は次のように設定できます。

```lua
vim.keymap.set('n', '<leader>e', function()
  local target = require('haskell-design').source_path()
  require('mini.files').open(target ~= '' and target or vim.uv.cwd(), true)
end, { desc = 'Open file explorer' })
```

自動確認するプロジェクトは個人設定の `trusted_roots = { "/path/to/project" }` に登録します。他のプロジェクトを無条件に信頼する設定にはしません。信頼前も宣言表示は使えます。手動の `v` でもそのセッションの信頼を確認できます。

## 自動解析の対象と応答

Cabalの `hs-source-dirs` にある通常の `.hs`（テスト・ベンチマークを含む）を対象にします。生成物・隠しディレクトリ・依存ライブラリ・fixturesは探索から除外します。ビルドに含まれないコンパイル失敗例や文書中のサンプル、`unsupportedReason` がある構成にも印を付けません。対象外の `.hs` を開いた場合は通常のソース表示です。Cabalがない単純な構成では、生成物を除いた `.hs` が対象です。Stack/Hpackの独自配置は `audit.include` で対象を明示してください。

特殊な配置では共用設定に `"audit": { "include": ["src", "app", "test"], "exclude": ["test/negative"] }` を追加できます。指定はプロジェクト相対のディレクトリです。Cabalからの対象探索と、GHCのパッケージ・拡張設定は別の役割です。

通常のmini.filesにはファイル名を変更しない装飾として `IO` / `Pure` を直接表示します。VS Codeの標準Explorerはバッジが2文字までなので、Pureは `P`（ツールチップにPure）になります。自動確認の途中は `…`、型情報を取得できない場合は理由付きの `—` です。

型検査結果と設計をローカルに保存し、ソース・設定・コンパイラ・パッケージDBの一致を確かめて再利用します。GHCは同じ構成のファイルをまとめて読み、変更したファイルとその依存先だけを再確認します。未保存の内容はディスクの確認結果と混ぜません。初回には型検査の時間が必要ですが、エディタの操作は止めません。

## GHCの設定と判定の意味

この版のGHC連携は **GHC 9.6.x** に対応します。初回の確認時に、同梱の小さな解析器をインストール済みGHCでビルドし、エディタのキャッシュへ保存します。別バージョン・未インストールの場合も設計ビューと差分は使え、状態は `—`（未解析）になります。

| 印 | 意味 |
| --- | --- |
| `Pure` / VS Code標準の `P` | GHCが与えた型・式にIOの使用が見つからなかった |
| `IO` | IOを含む型・制約・式が見つかった |
| `…` | 初回または変更後の解析中 |
| `—` | 型エラー、GHC不在、未保存などで型情報を取得できていない |

この表示は、実装を読まずに型とデータ定義を眺め、IOの置かれた場所をたどるための目印です。`Pure` は純粋性の証明ではなく「このファイルでIOの使用が見つからない」という意味です。ライブラリ全体のunsafe監査は行いません。

判定の基準はGHCが推論・解決した型です。`readName = getLine` は型を書かなくてもIO、`type App = IO` を使う関数もIOになります。文字列に `IO` がないことだけでPureにはしません。GHCの結果があるときはそれを優先するので、独自のデータ型を `IO` と名付けただけではIOになりません。結果を待つ間は、構文から明らかなIOだけを先に表示します。コメント・文字列・未使用インポートはIOの根拠にしません。

型の別名、ワークスペース内のnewtype・データのフィールド、解決できる型族、非公開関数・ローカル定義・インスタンスの式も対象です。型の展開は深さ48までで、再帰するデータ型の展開は打ち切り、IOが見つかればその型の探索を終えます。`Foldable f => f a`、`Monad m => m a`、未具体化の型族だけを理由に未解析にはしません。具体的にIOを与えた使用箇所はIOになります。`Safe` / `Trustworthy` / `Unsafe` という宣言自体は印を変えません。

外部ライブラリのデータの内部表現や関数本体は調べません。公開された型・型引数・クラスのメソッドや制約を通じたIOは対象です。純粋な型のAPIが内部でunsafeを使うことは呼び出し元の印には反映しません。一方、そのファイルでの `unsafePerformIO` などはIOを含む型として検出します。`unsafeCoerce` 自体はIOではありません。

フォルダは対象の子孫ファイルを集計します。IOが一つでもあれば親まで `IO`、すべてPureなら `Pure` です。未解析が残るフォルダは `—`、解析中なら `…` になります。走査上限に達した場合も未解析を残します。除外された場所には印を付けず、解析もしません。

GHCは `-fno-code` で型情報を取得します。コンパイラの実行許可、追加入力の追跡、キャッシュの整合性は引き続き必要です。CPP・独自プリプロセッサ・コンパイラプラグインと、それらに依存するソースは、この版では再利用できる型情報を取得しません。Template Haskell・QuasiQuotes・ANNの評価、アプリケーションの実行は行いません。設計ビューは利用でき、解析できない理由を表示します。

編集後は確認結果を捨て、再確認するまで `Pure` に戻しません。変更は監視し、保存後に必要な範囲を自動で再確認します。カーソル移動・アイドル・ファイラーの描画ごとに全ソースを解析する処理は行いません。OSの監視ハンドルが不足した場合はファイルのメタデータ比較へ切り替えます。

GHCはPATH上の `ghc` を使用します。ワークスペース直下と `src` / `app` / `test` / `tests` を探索し、追加オプションを指定できます。

```json
{
  "haskellDesign.ghcPath": "/path/to/ghc-9.6.7",
  "haskellDesign.ghcOptions": ["-isrc", "-package=containers"]
}
```

```lua
require('haskell-design').setup({
  ghc_path = '/path/to/ghc-9.6.7',
  ghc_options = { '-isrc', '-package=containers' },
})
```

Cabal/Stackのビルド構成を自動では再現しません。必要なパッケージ環境・拡張・includeパスを設定してください。プロジェクトのソース依存は同じワークスペース内へ収めてください。コンパイラの実行はサンドボックスではなく、設定された実行ファイルやコンパイラプラグインも信頼の対象です。ソースを外部へ送信しません。

両エディタで共用する設定は、開くプロジェクトのルートに `.haskell-design.json` を置きます。相対パスはそのルート基準です。`components` がある場合は最も深いパスの設定を使い、対象外のファイルを別の構成で確認しません。

```json
{
  "version": 1,
  "ghcPath": "/path/to/ghc-9.6.7",
  "ghcOptions": ["-XGHC2021", "-XOverloadedStrings", "-package-db", "/path/to/package.db"],
  "components": [
    { "path": "core", "ghcOptions": ["-icore/src", "-package", "aeson"] },
    { "path": "server", "ghcOptions": ["-icore/src", "-iserver/src", "-package", "aeson"] },
    { "path": "ui", "unsupportedReason": "このUIは別のWASMコンパイラで確認します。" }
  ]
}
```

コンパイラのパスはプロジェクト設定を優先し、エディタ側の追加オプションは最後に適用します。この設定を使ったGHC実行にも通常の信頼確認が必要です。設定とCabalファイルの変更時は古い確認結果を捨てます。設定ファイルのシンボリックリンクは変更を追跡できないため、GHC確認には実ファイルが必要です。ビルド構成や依存バージョンを変更したら解析設定も合わせて更新してください。`dist-wasm` / `dist-wasm-*` は生成物として一覧から除外します。

## 設計の差分で分かること

比較対象は、両時点のソースに書かれた宣言・型署名・コメント・インポートです。関数本体のみの変更は「宣言の差分なし・実装に変更あり」と表示します。型署名のない関数については過去の型を推論し直していないため、型の変化を未確認と明示します。レビューの重要な境界には型署名を書いておくと、差分が役立ちます。

パターンシノニムの式は実装として隠し、未対応の構文を黙って消さずにソースへの案内を残します。`.hs` が対象です。Literate Haskellなどの他形式はこの版の対象外です。

## 手元で試す

`examples/` をワークスペースとして開きます。

- `Domain/Order.hs`: 純粋な状態遷移。`isDraft` の型はGHCで推論されます。
- `Application/Checkout.hs`: 別名 `App` の中にIOを含む処理。
- `OrderSpec.hs`: 注文を再確定できないという性質の例。

Neovimではプロジェクトルートを明示すると、このリポジトリ全体とは切り離して例を試せます。

```lua
require('haskell-design').setup({ root = '/path/to/haskell-design/examples' })
```

## 開発・配布

配布物のビルドにはNode.js 22以降が必要です。ビルド済みNeovim解析器の実行はNode.js 20以降に対応します。

```sh
npm ci
npm run check
npm test
npm run test:neovim
npm run test:vscode
npm run package
node scripts/package-neovim.mjs
```

VS Codeの結合テストはmacOSの標準インストール先を使います。他の環境は `VSCODE_EXECUTABLE` を指定します。普段のプロファイルを変更せず、一時プロファイルとサンプルのコピーで実行します。GHCのテストには9.6.xが必要です。主要な検証結果と制限は [検証記録](docs/verification.md) を参照してください。

構文解析はTree-sitter、意味の確認はGHC、ソース・差分・ファイル操作はエディタの責任として分けています。VS CodeはWebview内のソースをHTMLとして解釈せず、NeovimはJSONを標準入力で渡します。シェルへファイル名やソースを連結しません。
