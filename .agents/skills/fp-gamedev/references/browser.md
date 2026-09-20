# ブラウザへ出力する

純粋なルール、入力の意味、固定tick、保存形式を共有し、hostを差し替える。
Afterlightの検証済み経路はGHC Wasm＋h-raylib＋Emscripten / WebGL 2。
ビルド環境はLinux / WSL、生成物は通常のHTTPで配信できる静的ファイル。
実装と固定バージョンは[Afterlightの対応表](afterlight.md)から`web/README.md`・
`web/build.sh`を読む。手でABI補正やリンカー指定を書き直すより、この入口を利用する。
h-raylib全API・全ブラウザの互換性を保証する経路ではない。

## 新作へ持ち出す

`web/`はAfterlightの動く例で、任意のゲームを自動認識する雛形ではない。
ABIパッチ、`wasm-link`、メモリ保護、FFI bridgeとその検査は一組で利用し、次を作品に合わせる。

| 接続する場所 | 変えるもの |
| --- | --- |
| Cabal・`build.sh`・`cabal.project.template` | package / executable名、依存、web用起動口 |
| `BrowserMain.hs` | 自作runtimeの起動・一フレーム・終了への接続 |
| `prepare-assets.py` | 必須ファイルとmanifest生成。庭のshader・フォント・音源一覧は持ち込まない |
| `host/src/` | 保存パスとstorage key、使う操作・写真・URL設定。不要な作品固有機能は外す |

2Dの新作にボクセルや3D描画を移す必要はない。まず自作の最小シーンを同じ経路で表示する。

## ゲーム側に残す契約

- `startup -> app`、`frame :: app -> IO ()`、`shouldClose`、`shutdown`へhostの寿命を分ける。
  ブラウザは`requestAnimationFrame`が一回につき一フレームを呼び、必ず戻る。
  自前の無限ループ、待機型FPS制御、不要なAsyncify・pthreadを重ねない。
  状態、Clock、FRP継続、GPU資源はフレーム間で保持する。
- 時間は実時計から観測して既存の固定tickへ渡す。非表示・フォーカス喪失中は進行を止め、
  再開時に経過時間の負債や押しっぱなしの操作を持ち越さない。
  リプレイ・自動tourで動くことと、DOMからの実入力で遊べることは別に確認する。
- 音声の開始、Pointer Lock、Fullscreenはブラウザのユーザー操作制約を守る。
  ゲームの「カーソルを捕捉したい」という要求と、クリックで許可される実操作を分ける。
  捕捉拒否は再試行できる状態にし、ゲームの例外まで握り潰さない。
- 仮想FSへの書込みは永続化ではない。保存成功を返す前に永続ストアへ反映し、
  容量不足・利用拒否を既存の保存失敗経路へ返す。旧記録を残す契約も移植する。
  ページを読み直し、実際に同じゲーム状態へ復元されるところまで確かめる。

## バインディングの境界

AfterlightはGHCとraylibの二つのWasmが、一つの線形メモリの別領域を使う。
これは専用リンカー設定とallocator境界を持つ実装例で、一般のWasm連結規則ではない。

| 境界 | 外すと壊れる条件 |
| --- | --- |
| レイアウト | static data・stack・heapが重ならない。リンク後のexport値で確認してから初期化 |
| 割当て | 二つのallocatorの所有領域を固定し、C側の成長を境界で止める。解放先も所有者で選ぶ |
| メモリ成長 | `memory.grow`後はJSのviewが古くなる。FFI前とframe復帰時にHEAP viewも更新し、ブラウザcallbackへ渡す |
| ABI | 32bitの`sizeof`・`offsetof`・alignmentを使用版のCヘッダーで測る。64bit値やdoubleも別途検査 |
| ポインタの寿命 | Cが後で参照する配列をFFI呼出終了時に解放しない。`withShader`が実例 |
| callback | 関数テーブルは線形メモリとは別。Haskellの`FunPtr`を別WasmのCへ渡せると仮定しない |

この経路ではh-raylib 5.6のwasm32パッチを使用する。ライブラリを更新するときは
パッチが適用できることに加えて、レイアウトと実描画・解放を確認する。
音声callbackなど未検証の関数ポインタ経路は、別途接続を実装するまで使わない。
ツールチェーンのTemplate Haskell対応も確認する。古いWasm GHCでは同じソースが通らない。

## アセットと描画

manifestで必要なファイルだけ取得し、HaskellのWASIとraylibのFSそれぞれへ同じパスで配置する。
Haskell側の存在検査だけ通ってraylibが読めない状態を避ける。大量の画像・音を
Haskellのソース定数へ埋め込む必要はない。フォント等のライセンスも成果物へ含める。

WebGL用shaderは使用するGLSL ES版、precision、uniformの初期値を揃える。
フラグメントshaderだけをES 300へ変換しても、raylibの既定vertex shaderがES 100なら
組み合わせられない。両方を指定する。コンパイル成功だけでなく、描画先・ポスト処理・
フォントを実画面で確かめる。shader失敗時に既定shaderへfallbackするAPIにも注意する。

canvasのCSS表示寸法と描画バッファの解像度を分ける。ブラウザ全体やDPRに無条件で
追従させず、実際の庭・エフェクト・描画負荷で寸法を選ぶ。
撮影結果はブラウザ内のファイルに加え、利用者が取得できるdownloadとして渡す。

**最小の実機確認**: 起動と実入力、フォーカス喪失と復帰、描画、終了。
音声・編集・保存とページ再読込み・撮影は、実装している機能だけ確認する。
処理時間・メモリ・ダウンロード量は実作品で計測し、
小さいcubeの結果や起動ログだけを本編の性能・操作の証明にしない。
