# ブラウザで遊び始めるまでの設計判断

ページを開くと準備が自動で進み、最後のクリックでマウスを捕捉して遊び始める。
AfterlightのHaskell/raylib実装を保ったまま、そのために採る方針と判断理由をまとめる。
ビルド手順は[README](README.md)、WASM・FS・FFIの契約は[host/README](host/README.md)を参照。
以下は一次資料に基づく設計判断と現実装の対応であり、最終出力での体験検証は末尾で別に記録する。
資料の確認日: 2026-09-20。

1. **ロード: ダウンロード完了と、操作できる準備完了を分ける。**

   **採用する:** 軽いHTMLの起動画面を先に表示し、クリックを待たず取得・コンパイル・ワールド生成・GPU準備を進める。
   取得はmanifestの展開後バイト数、チャンク生成は実際の完了数を進捗にする。総量不明の段階は不定進捗にする。
   Afterlightではチャンク作成と最初の描画を小さな処理単位に分け、全て終わってからPlayを表示する。
   各単位の間は`scheduler.yield()`でブラウザへ戻る。未対応時は`setTimeout`へ戻すが、
   [入れ子タイマーの最低4ms](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#nested_timeouts)が多数の単位に累積するため、対応ブラウザではyieldを優先する。

   **条件付き:** 大きな任意アセットは後から読む。ただし、取得完了前にHaskellが同期的に読むパスには適用しない。
   Workerへの移動は、処理分割後にも残る停止時間を測ってから判断する。
   **採用しない:** 実処理と無関係な百分率、初期化前のReady表示、同期WASM呼出をPromiseで囲むだけの非同期化。

   根拠: [Godotの進捗通知](https://docs.godotengine.org/en/stable/tutorials/platform/web/customizing_html5_shell.html)は総量不明も扱う。
   [MDNの処理分割](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield)は、ブラウザへ実行権を返して表示・入力を進める。
   [PlayCanvasの公開事例](https://developer.playcanvas.com/user-manual/optimization/load-time/)では、Virtual Voodooがタイトル画面中に本編を準備する。

2. **入力: Playの新しいクリックで、マウス捕捉と音声を開始する。**

   **採用する:** 自動準備後の新しいクリックで、直ちにPointer Lockを要求し、音声を開始・再開する。
   捕捉成功を確認して操作を始める。全画面も同時に要求する場合はPointer Lockを先に呼ぶ。
   Escapeによる捕捉解除は再捕捉の契機にせず、Pauseとして扱う。再開操作で改めて捕捉する。
   ゲームが望む捕捉状態と、ブラウザが実際に許可した状態を別々に持つ。

   **条件付き:** iframeの許可設定や実行環境固有の拒否は、要求時の状態と例外名を見て診断する。
   **採用しない:** `event.isTrusted`を保存して権限が続いていると判断すること、毎フレームの再要求、拒否を無視したプレイ開始。

   [HTMLのtransient activation](https://html.spec.whatwg.org/multipage/interaction.html#tracking-user-activation)は長い同期処理中も延長されない。
   拒否は要求直前のactivation、クリックからの時間、focus・visibility、例外の`name`を記録する。
   `WrongDocumentError`と`root document ... not valid`の組は[Chromiumの`kWrongDocument`](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/page/pointer_lock_controller.cc)であり、gesture不足の`NotAllowedError`、権限拒否の`SecurityError`と区別する。
   調査したChromium mainのWindows実装では[要求時・許可後のnative viewのfocus確認や、要求中の非表示化](https://raw.githubusercontent.com/chromium/chromium/main/content/browser/renderer_host/render_widget_host_impl.cc)でこの結果が返る。
   [focusの模擬は`document.hasFocus()`をtrueにできる](https://raw.githubusercontent.com/chromium/chromium/main/content/public/test/scoped_page_focus_override.h)ため、その値だけで実ウィンドウの状態や自動操作環境の問題を断定しない。
   通常タブを実際に前面へ出したユーザーのクリックで、`pointerlockchange`とcanvasの捕捉を記録することを、通常プレイの確認境界とする。
   [Pointer Lockの条件と呼出順](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock)、[音声開始の条件](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices)も参照。

3. **表示: 大きく見せることと、高い解像度で描くことを分ける。**

   **採用する:** viewport全体をゲーム領域にし、読み込み表示や操作ボタンを重ねる。
   canvasの表示と描画バッファをviewportの縦横比に合わせる。描画は最大1280×720相当のピクセル数に収め、DPRに比例して増やさない。
   大きなviewportでは縦横を同じ率で縮小し、小さなviewportは拡大しない。端数は偶数画素へ丸める。
   Afterlightで使用するEmscripten出力はcanvasの矩形全体からマウス座標を換算するため、`object-fit`だけで要素内部に余白を作らない。
   描画サイズの所有者もhostへ揃える。固定版GLFWは全画面中のresizeでcanvasを`screen`寸法へ上書きするため、
   `host/refresh-memory.js`でその暗黙操作を分離する。CSS・canvas・raylib/FBOの寸法が食い違うと、庭が画面の一隅にだけ描かれる。

   **条件付き:** 描画解像度やDPR上限は、実際の場面のフレーム時間と見え方を比べて選ぶ。
   **採用しない:** 表示サイズの不足を、無制限のDPR描画や描画バッファ拡大で解決すること。
   [Unityの表示・描画解像度の分離](https://docs.unity.com/en-us/engine/6000.0/manual/platform-specific/webgl/develop/canvas-size)と
   [PlayCanvasのDPRと負荷](https://developer.playcanvas.com/user-manual/optimization/runtime-devicepixelratio/)を根拠とする。

4. **配信: 取得・コンパイルを並行化し、再訪時には再取得を減らす。**

   **採用する:** WASMの`compileStreaming`とアセット取得を早く始め、必要なimportsが揃ってからinstantiateする。
   WASMはfetchの元の`Response`をコンパイラへ渡し、`clone()`側で取得進捗を測る。
   [ChromiumはレスポンスのURLとキャッシュメタデータを使う](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/bindings/core/v8/v8_wasm_response_extensions.cc)ため、進捗表示用の`new Response(stream)`で置き換えない。
   `.wasm`は`application/wasm`、圧縮済みファイルは実体に合う`Content-Encoding`で配信する。
   内容が変わるとURLも変わるファイルだけを長期キャッシュし、HTML・manifestは再検証する。異なるビルドのWASM・JSを混ぜない。

   **条件付き:** 使用文字を列挙できるフォントはサブセット化する。AfterlightではASCII・`glyphs.txt`・`uiCorpus`の文字を含める。
   同梱する374文字の出力は202,212 bytes。元の16,467,736 bytesと全輪郭・advanceが一致し、raylibの48px描画でも同じピクセル・offsetになることを確認した。
   自由入力や翻訳を加えるゲームでは、その文字集合に合わせて作り直す。
   大きなキャッシュの保持やオフライン動作が必要になった場合に、Cache API等を追加する。
   **採用しない:** 最初からService Workerを必須にすること、キャッシュでワールド生成時間まで短くなると見なすこと。

   根拠: [WASM streaming](https://developer.mozilla.org/en-US/docs/WebAssembly/Reference/JavaScript_interface/instantiateStreaming_static)、
   [Unityの圧縮・MIME設定](https://docs.unity3d.com/6000.0/Documentation/Manual/webgl-deploying.html)、
   [HTTPキャッシュと内容別URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)、
   [fontToolsのOTFサブセット](https://fonttools.readthedocs.io/en/stable/subset/)。

5. **中断・保存・失敗: 続けられる状態と、止めるべき状態を区別する。**

   **採用する:** focus・visibility・捕捉解除を実際のホスト入力として扱い、Pauseは重複通知でも一度の状態変更にする。
   復帰時は押下状態と時計を整え、非表示中の経過時間を大量のゲームtickへ変換しない。
   保存成功は永続化成功後に示す。容量不足・拒否時は失敗をHaskellへ返し、以前の保存を保持する。
   読み込み・WASM・WebGL障害は停止した段階を示し、セーブを消さずに再読込できるようにする。
   Pointer Lock・音声の拒否は、その操作をやり直せる状態として扱う。

   **条件付き:** 自動保存のタイミングはゲームの仕様で決める。終了直前のイベントを唯一の保存契機にはしない。
   **採用しない:** 捕捉拒否をプログラム障害として終了すること、プログラム障害や保存失敗を握り潰して成功を表示すること。
   根拠: [非表示時のrAF制限](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)、
   [beforeunloadの限界](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event)、
   [ブラウザ保存の容量と例外](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)。

## 検証結果

2026-09-20のローカルHTTP、実際の庭（280,361 cells／4,461 chunks）で計測。
ネットワーク帯域制限はかけていない。各値はこの端末の観測値で、他の端末や回線の保証値ではない。

| 項目 | 結果と範囲 |
| --- | --- |
| 配信量 | 旧出力44.2 MB → 最終出力28.7 MB、gzip配信18.0 MB。旧無圧縮比約59%減。音声データは同一 |
| 初回／再訪 | 未使用originでのin-app browser初回表示0.10秒、準備完了14.23秒。同じタブ再読込は表示0.23秒、準備11.83秒。HTTPキャッシュの初回／再訪であり、GPUやOSのキャッシュは消去していない |
| 準備の内訳 | 再訪時、Wasm取得・初期化0.20秒、window/audio取得0.13秒、world0.21秒、共通資源0.57秒、chunk呼出合計10.25秒、preview0.07秒。描画CPU側の準備が引き続き主因 |
| Chrome比較 | 旧同期起動31.33秒、新版の準備25.95秒を観測。キャッシュ状態・実行中の負荷を完全統制したbenchmarkではなく、改善率の保証には使わない |
| ロード中の反応 | スクリプト開始前からHTMLを表示。実際の取得量とchunk件数が更新され、最初の全景まで描画成功。準備中最大呼出は再訪0.57秒、初回0.76秒。全段階を短フレーム化できたわけではない |
| 表示 | 1280×720の実画面、2504×1287 viewport／1338×688 buffer、800×600へのリサイズを確認。最終版はin-app browserでFullscreenの出入りも成功し、2576×1408 viewport／1298×708 bufferから1280×720へ戻り、全景を再描画。モバイル操作・HUD最小寸法の保証はしない |
| 捕捉・音声・全画面 | 新しい実クリックを即時要求し、activation=trueを確認。それでも自動操作中はWrongDocumentError、in-app browserの全画面中はUnknownErrorで捕捉拒否。準備状態の維持・例外名保持・再試行を確認。ChromeのAudioContextはrunningへ移行。ChromeではFullscreenの拒否表示も確認。成功した実捕捉と音の聴感は未確認 |
| 中断・入力・保存 | hostの37テストで捕捉成功後の開始、重複Pause、再開クリック、DOMキー隔離、全画面時の寸法通知、保存成功／容量不足時の旧記録保持を検査。HTMLボタンのEnter操作と、初期script取得失敗時の再読み込み表示も実画面で確認 |
| native回帰 | 全executable build、550生成ケース、物語・四島のjourney成功。新しいModel構築で4フレームの描画・PNG・正常終了を確認し、GPU／音声資源を解放 |

旧ブラウザhostで確認済みの実移動・採掘・保存復元・撮影は[README](README.md#validation-scope)に区別して記す。
今回の捕捉待ちを含む一連の手動プレイは、その古い確認結果だけで再認定しない。

起動を軽くするため、`prepareModel`はraylibと同じ初期値をHaskellの`Model`で組み、
`LoadModelFromMesh`経由の全頂点の書込み・読戻しを一往復省いた。型とGPU資源の所有者は維持する。
装飾候補でないcellへの隣接探索も省き、旧版と全6,900,084頂点の位置・法線・色・発光値・順序の一致を確認した。
フォントは374文字の全輪郭・metricsと、raylibのサイズ48での描画ピクセルが一致した。
HTTPとアセットの6検査は、gzip内容一致・ETag・304・拒否・再生成時の更新を実サーバーで確認する。

得られた判断は、**通信削減、計算削減、待ち時間の可視化、入力権限を別々の境界として測る**こと。
キャッシュや圧縮だけではchunk生成は消えず、読み込みが成功しても実操作の確認は残る。
