# 0.6.0

- Native Haskell declaration projection shared by the standalone CLI, VS Code and Neovim. The pinned Tree-sitter grammar now uses its native C runtime through a small FFI boundary.
- Native `haskell-design map|outline|show`; syntax reading needs neither Node nor GHC at runtime. `read.cjs` remains a compatibility launcher.
- Real Cabal syntax parsing, root-package scope, bounded whole-declaration pages and explicit trusted GHC inference. Source and cursor contracts remain in force.
- OS/CPU-specific packages bundle the executable and dependency notices. Source builds now need GHC/Cabal and a C toolchain; Neovim still uses Node for its editor adapter.
- Build, setup skill, portability guidance and measured Windows comparisons updated for the shared native core. See `docs/native.md`.
- Offline definition navigation follows the editor's project scope and refuses ambiguous names, so a game type cannot jump into an unrelated bundled example.

# 0.5.0

- LLM用の `map` / `outline` / `show` を追加。エディタと同じ解析器から全体の型・データ定義と、選んだ実装を取得できます。
- 出力予算、宣言単位のページ分割、ソース変更の検知、同名候補、抽出漏れの警告を追加。
- 署名のない型は、信頼した対象ファイルでGHCの推論を追加可能。
- 演算子の名前の抽出と、Windowsの改行を持つCabalファイルのソース探索を修正。

# 0.4.2

- Afterlightに独立したソース配布を同梱。公開レポだけで両エディタをセットアップできます。
- NeovimのHLS連携、ホバー、参照、定義ジャンプのフォールバックと履歴を追加。
- 両エディタ用の導入スキル、プロジェクト設定生成、独立したNeovim起動設定を追加。

# 0.4.1

- portable-dotfilesに汎用ツールとして同梱。個人・業務どちらの設定からも導入可能。
- テストの端末固定パスを廃止。解析・表示の仕様は0.4.0と同じ。
- Windowsのパス表記を揃え、Neovimとmini.filesのIO/Pure表示を照合。ビルド時は依存に合わせてNode.js 22以降を要求。
- Neovimの信頼済みルートをシンボリックリンク経由で開いた場合も、同じルートとして照合。

# Changes

## 0.4.0

IO/Pure now describe IO found in GHC-resolved types, rather than a purity proof. Inferred types, aliases, fields and local typed expressions still reveal IO. Foldable/polymorphic effects, open families and Safe/Trustworthy policy no longer produce unknown badges. Library implementations remain outside the classification. Direct unsafe IO joins IO; unsafe coercions are not a separate effect. GHC results take precedence over name spelling and unused imports no longer create IO hints.

Both editors use IO/Pure, … while indexing and — when type information is unavailable. Recursive type search short-circuits on IO. Existing dependency caching, source exclusions and automatic design-first opening remain; old index entries are invalidated for the new semantics. VS Code no longer discards a concurrent manual analysis solely because the background index redraws the UI.


## 0.3.0

- プロジェクト起動時に通常ソースを自動で確認し、標準Explorer/mini.filesへファイル・フォルダのIO/Pureを表示。
- Cabalのソース範囲を選び、生成物・依存物・負例・未対応構成の装飾と投影を省く。
- 検証済みの索引を保存し、依存関係に応じて更新。GHCの一括処理とNeovimの常駐解析器で重複処理を減らす。
- 初回の解析中表示、未保存編集による失効、OS監視制限時の復旧を追加。

## 0.2.1

Both editors read shared `.haskell-design.json` compiler settings, including component-specific source paths and explicit unsupported-component explanations. Compiler and Cabal settings invalidate verification. Safe modules can use a Trustworthy dependency without conflicting global flags; the boundary itself stays unknown. Pure library abstractions such as JSON builders no longer inherit IO from their private representation. GHC's safety inference is checked; Template Haskell, quasiquotes and annotations remain excluded from evaluation. WASM build outputs are excluded from the tree. Neovim exposes `source_path()` for file explorer integrations, including mini.files.

## 0.2.0

Haskell files now open in the design view by default in both editors. Switch to source in the same editor area, retaining unsaved changes and undo. Folder trees aggregate IO, Pure, unknown and unsafe counts; native VS Code folders also receive badges. Pure is explicit (P in native VS Code badges). Dirty VS Code alternate tabs remain open to preserve edits.

## 0.1.0

Initial local release for VS Code and Neovim: declaration views, implementation expansion, source/type navigation, related tests, IO evidence, GHC 9.6 verification and inference, and Git declaration diffs.
