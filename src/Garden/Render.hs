{-# LANGUAGE PatternSynonyms #-}
{-# LANGUAGE CPP #-}

module Garden.Render (renderScene, renderSceneWith, renderPhotoChrome, renderPhotoFrame, renderPhotoToast, renderInterface, renderMenu, renderSaveFeedback) where

import Control.Monad (forM_, when)
import Data.IORef (readIORef)
import Data.List (sortOn)
import Data.Map.Strict qualified as M
import Garden.Mesh (palette)
import Garden.Photo
import Garden.Render.Resources
import Garden.Types
import Garden.View
import Raylib.Core
import Raylib.Core.Models (drawCubeV, drawCubeWiresV)
import Raylib.Core.Shapes
import Raylib.Core.Text (drawText)
import Raylib.Core.Textures (drawTexturePro)
import Raylib.Types
import Raylib.Util (blendMode, mode2D, mode3D, textureMode)
import Text.Printf (printf)

cameraFor :: SceneView -> Camera3D
cameraFor view = Camera3D (toRay (sceneEye view)) (toRay (plus (sceneEye view) (sceneForward view))) (Vector3 0 1 0) 68 CameraPerspective

renderScene :: Resources -> SceneView -> Float -> IO ()
renderScene = renderSceneWith Nothing

renderSceneWith :: Maybe Photo -> Resources -> SceneView -> Float -> IO ()
renderSceneWith portrait resources view pulse = do
  width <- getScreenWidth
  height <- getScreenHeight
  target <- renderTarget resources width height
  let sceneWidth = texture'width (renderTexture'texture target)
      sceneHeight = texture'height (renderTexture'texture target)
      ws = resourceShader resources
      ss = resourceSky resources
      ps = resourcePost resources
      f = sceneForward view
      fov = maybe 68 photoFov portrait
      lens = tan (fov * pi / 360)
      (right, upCorrect) = photoBasis (maybe 0 photoRoll portrait) f
      camera = Camera3D (toRay (sceneEye view)) (toRay (plus (sceneEye view) f)) (toRay upCorrect) fov CameraPerspective
  uniform resources ws "eyePosition" (ShaderUniformVec3 (toRay (sceneEye view)))
  uniform resources ws "veil" (ShaderUniformFloat (sceneVeil view))
  uniform resources ws "time" (ShaderUniformFloat (sceneTime view))
  lamps <- readIORef (resourceLights resources)
  let points = take 8 (sortOn (distance (sceneEye view)) lamps)
  uniform resources ws "lightCount" (ShaderUniformInt (length points))
  when (not (null points)) $
    setShaderValueV ws "lightPositions" (ShaderUniformVec3V (map toRay points)) (resourceWindow resources)
  uniform resources ss "resolution" (ShaderUniformVec2 (Vector2 (fromIntegral sceneWidth) (fromIntegral sceneHeight)))
  uniform resources ss "forwardView" (ShaderUniformVec3 (toRay f))
  uniform resources ss "rightView" (ShaderUniformVec3 (toRay right))
  uniform resources ss "upView" (ShaderUniformVec3 (toRay upCorrect))
  uniform resources ss "lens" (ShaderUniformFloat lens)
  uniform resources ss "time" (ShaderUniformFloat (sceneTime view))
  uniform resources ss "veil" (ShaderUniformFloat (sceneVeil view))
  textureMode target $ do
    clearBackground (Color 110 160 166 255)
    withShader ss (drawRectangle 0 0 sceneWidth sceneHeight white)
    mode3D camera $ do
      (_, chunks) <- readIORef (resourceChunks resources)
      let visible (cx, cy, cz) =
            let delta = minus (V3 (fromIntegral (cx * 4 + 2)) (fromIntegral (cy * 8 + 4)) (fromIntegral (cz * 4 + 2))) (sceneEye view)
                depth = dot delta f
                side = abs (dot delta right)
                vertical = abs (dot delta upCorrect)
             in depth > (-6) && depth < 420 && side < max 0 depth * lens * fromIntegral sceneWidth / fromIntegral sceneHeight + 8 && vertical < max 0 depth * lens + 8
      forM_ (M.toList chunks) $ \(key, models) ->
        when (visible key) $
          forM_ models (\m -> drawPrepared m (V3 0 0 0) 0 1 white)
      forM_ (resourceRelic resources) (\m -> drawRelic m (sceneTime view))
      drawKin resources view
      drawEnemies resources view
      drawAtmosphere view
      drawBursts view
      case sceneTarget view of
        TerrainTarget c _ (Ore g) _ -> drawCubeWiresV (toRay (center c)) (Vector3 1.014 1.014 1.014) (toColor (palette (Ore g)) 0.82)
        TerrainTarget c _ _ _ -> drawCubeWiresV (toRay (center c)) (Vector3 1.012 1.012 1.012) (Color 232 224 167 150)
        _ -> pure ()
  uniform resources ps "resolution" (ShaderUniformVec2 (Vector2 (fromIntegral sceneWidth) (fromIntegral sceneHeight)))
  let grading = case portrait of
        Nothing -> Vector3 0 0 1
        Just p -> Vector3 (photoExposure p) (fromIntegral (fromEnum (photoGrade p))) (if photoBloom p then 1 else 0)
  uniform resources ps "grading" (ShaderUniformVec3 grading)
  uniform resources ps "vignette" (ShaderUniformFloat (if maybe True photoVignette portrait then 0.12 else 0))
  withShader ps $
    drawTexturePro
      (renderTexture'texture target)
      (Rectangle 0 0 (fromIntegral sceneWidth) (negate (fromIntegral sceneHeight)))
      (Rectangle 0 0 (fromIntegral width) (fromIntegral height))
      (Vector2 0 0)
      0
      white
  when (pulse > 0.04) $ drawRectangleGradientV 0 0 width height (Color 113 233 192 (round (pulse * 13))) (Color 243 223 148 0)
  forM_ [b | b <- sceneBursts view, burstCue b == Return] $ \b -> do
    let age = sceneTime view - fromIntegral (unTick (burstBorn b)) / 60
        opacity = max 0 (1 - age / 1.3)
    when (opacity > 0) $ drawRectangle 0 0 width height (Color 248 246 224 (round (255 * opacity * opacity)))
  forM_ [b | b <- sceneBursts view, burstCue b == Wound] $ \b -> do
    let age = sceneTime view - fromIntegral (unTick (burstBorn b)) / 60
        opacity = max 0 (1 - age / 0.42)
    when (opacity > 0) $
      drawRectangleGradientV
        0
        0
        width
        height
        (Color 190 34 65 (round (opacity * 110)))
        (Color 190 34 65 0)

drawKin :: Resources -> SceneView -> IO ()
drawKin resources view = forM_ (sceneKin view) $ \(KinView pos gem bond safe) -> do
  let t = sceneTime view
      float = 0.12 * sin (t * 1.15 + fromIntegral (fromEnum gem))
      toward = minus (sceneEye view) pos
      V3 dx _ dz = toward
      yaw = atan2 (-dx) (-dz) * 180 / pi
  forM_ (M.findWithDefault [] gem (resourceKin resources)) $ \m -> drawPrepared m (plus pos (V3 0 (0.14 + float) 0)) yaw 0.13 white
  blendMode BlendAdditive $ forM_ [0 .. 11 :: Int] $ \i -> do
    let a = fromIntegral i * pi / 6 + t * 0.32
        radius = if safe then 1.4 else 0.85
        p = plus pos (V3 (cos a * radius) (1.4 + float + sin (a * 2) * 0.16) (sin a * radius))
        s = if bond > 0 then 0.065 else 0.035
    drawCubeV (toRay p) (Vector3 s s s) (toColor (palette (Ore gem)) (if safe then 0.8 else 0.45))

drawEnemies :: Resources -> SceneView -> IO ()
drawEnemies resources view = forM_ (sceneEnemies view) $ \(EnemyView pos _ windup kind) -> do
  let V3 dx _ dz = minus (sceneEye view) pos
      yaw = atan2 (-dx) (-dz) * 180 / pi
      shake = if windup > 0 then sin (sceneTime view * 40) * 0.08 else 0
  forM_ (M.findWithDefault [] kind (resourceEnemy resources)) $ \m -> drawPrepared m (plus pos (V3 shake 0 0)) yaw 0.14 white
  when (windup > 0) $ blendMode BlendAdditive $ forM_ [0 .. 23 :: Int] $ \i -> do
    let a = fromIntegral i * pi / 12
        radius = case kind of Wanderer -> 2.9; Custodian -> 3.9; Skitter -> 2.4; SkyMoth -> 3.1
        alpha = 0.4 + 0.3 * sin (sceneTime view * 24)
    drawCubeV (toRay (plus pos (V3 (cos a * radius) 0.1 (sin a * radius)))) (Vector3 0.22 0.045 0.22) (Color 255 71 86 (round (alpha * 255)))

drawAtmosphere :: SceneView -> IO ()
drawAtmosphere view = blendMode BlendAdditive $ do
  -- A field of slowly rising pollen ties near space to the massive architecture.
  forM_ [0 .. 145 :: Int] $ \i -> do
    let t = sceneTime view
        fi = fromIntegral i
        x = fromIntegral ((i * 71) `mod` 103) - 51 + sin (t * 0.18 + fi) * 0.7
        z = fromIntegral ((i * 43) `mod` 122) - 40 + cos (t * 0.12 + fi) * 0.6
        y = 3 + fromIntegral (i `mod` 15) * 0.85 + sin (t * 0.25 + fi) * 0.6
        s = 0.025 + fromIntegral (i `mod` 3) * 0.019
        alpha = round (35 + 80 * (0.5 + 0.5 * sin (t + fi)))
    when (distance (sceneEye view) (V3 x y z) < 65) $
      drawCubeV (Vector3 x y z) (Vector3 s (s * 1.4) s) (Color 173 241 212 alpha)
  -- The return beacon is assembled from discrete, ascending gold fragments.
  forM_ [0 .. 54 :: Int] $ \i -> do
    let fi = fromIntegral i
        t = sceneTime view
        a = fi * 2.399 + t * 0.06
        y = 48 + fi * 0.45 + sin (t * 0.2 + fi) * 0.2
        r = 1.8 + fi * 0.04
    drawCubeV (Vector3 (cos a * r) y (54 + sin a * r)) (Vector3 0.12 0.46 0.12) (Color 255 219 141 (if sceneFlight view then 225 else 80))

drawBursts :: SceneView -> IO ()
drawBursts view = forM_ (sceneBursts view) $ \burst -> do
  let age = sceneTime view - fromIntegral (unTick (burstBorn burst)) / 60
      hue = case burstCue burst of Wound -> Color 255 83 103 210; Jewel -> Color 119 251 209 240; _ -> Color 255 223 147 230
  when (age >= 0 && age < 1.15) $ forM_ [0 .. 16 :: Int] $ \i -> do
    let fi = fromIntegral i
        a = fi * 2.399
        p = plus (burstOrigin burst) (V3 (cos a * age * 2.4) (age * (1.0 + fromIntegral (i `mod` 4)) - 2.4 * age * age) (sin a * age * 2.4))
        size = max 0.01 (0.12 * (1 - age / 1.15))
    drawCubeV (toRay p) (Vector3 size size size) hue

renderInterface :: Resources -> SceneView -> Bool -> Float -> IO ()
renderInterface resources view debug fps = withUIScale $ \width height zoom -> do
  let wf = fromIntegral width
      hf = fromIntegral height
      ink = Color 239 241 219 255
      soft = Color 179 207 196 255
      gold = Color 234 204 139 255
      label = textAt resources
  drawRectangleGradientV 0 0 width 130 (Color 7 20 25 178) (Color 7 20 25 0)
  label (regionName view) 32 20 32 ink
  drawLine 33 64 134 64 gold
  label (sceneObjective view) 32 77 22 ink
  let lifeW = 180; lifeX = width - lifeW - 34
  label "生命" (fromIntegral lifeX) 27 15 soft
  drawRectangle lifeX 55 lifeW 4 (Color 22 46 49 220)
  drawRectangle lifeX 55 (round (fromIntegral lifeW * sceneLife view / 100)) 4 (if sceneLife view < 30 then Color 237 125 115 255 else Color 165 220 182 255)
  label ("光 " <> show (sceneCharges view) <> "   Q 使う") (fromIntegral lifeX) 70 15 soft
  -- Small ordinal markers remain readable even when gem colors coincide.
  forM_ (zip [0 :: Int ..] (sceneGems view)) $ \(i, (g, count)) -> do
    let x = wf - 213 + fromIntegral (i * 47)
    drawRectangle (round x) 108 8 8 (toColor (palette (Ore g)) 1)
    label (show count) (x + 13) 102 15 ink
  let cx = width `div` 2
      cy = height `div` 2
      targetColor = case sceneTarget view of EnemyTarget -> Color 255 130 139 240; _ -> Color 245 239 208 200
  drawLine (cx - 7) cy (cx - 3) cy targetColor
  drawLine (cx + 3) cy (cx + 7) cy targetColor
  drawLine cx (cy - 7) cx (cy - 3) targetColor
  drawLine cx (cy + 3) cx (cy + 7) targetColor
  when (sceneDashRecovery view > 0) $ do
    drawRectangle (cx - 24) (cy + 27) 48 2 (Color 22 46 49 150)
    drawRectangle (cx - 24) (cy + 27) (round (48 * (1 - sceneDashRecovery view))) 2 gold
  drawRectangleGradientV 0 (height - 172) width 172 (Color 4 18 24 0) (Color 4 18 24 185)
  let hint = sceneHint view
  hintWidth <- textWidth resources hint 22
  let hintX = max 25 ((wf - hintWidth) / 2)
  label hint hintX (hf - 143) 22 ink
  let slotWidth = 66; start = cx - 198
  forM_ (zip [0 ..] (sceneSlots view)) $ \(i, (m, count)) -> do
    let x = start + i * slotWidth; selected = i == sceneSelection view `mod` 6
    drawRectangle x (height - 100) 60 60 (if selected then Color 81 104 91 220 else Color 12 33 38 188)
    when selected $ drawRectangle x (height - 103) 60 3 gold
    drawRectangle (x + 23) (height - 86) 14 14 (toColor (palette m) 1)
    label (show (i + 1)) (fromIntegral (x + 5)) (hf - 96) 15 soft
    label (show count) (fromIntegral (x + 35)) (hf - 64) 17 ink
  label (materialName (slotMaterial (sceneSelection view))) (wf / 2 - 30) (hf - 30) 15 soft
  label "C  灯花を編む" 32 (hf - 74) 19 soft
  label "白石 2 ＋ 宝石 1" 32 (hf - 45) 16 soft
  label ("TAB  素材棚 " <> show (sceneSelection view `div` 6 + 1) <> " / 2") (wf / 2 + 216) (hf - 64) 16 soft
  label "ESC  一時停止" (wf - 172) (hf - 38) 14 soft
  when (not (null (sceneNotice view))) $ do
    measured <- textWidth resources (sceneNotice view) 20
    let noticeWidth = measured + 48
        noticeX = max 24 ((wf - noticeWidth) / 2)
    drawRectangle (round noticeX) (round (hf * 0.72 - 12)) (round noticeWidth) 47 (Color 6 27 32 210)
    label (sceneNotice view) (noticeX + 24) (hf * 0.72) 20 gold
  forM_ (sceneKin view) $ \(KinView pos g bond safe) -> do
    let d = distance (sceneEye view) pos
    when (d < 20 && dot (minus pos (sceneEye view)) (sceneForward view) > 0) $ do
      Vector2 rawX rawY <- getWorldToScreen (toRay (plus pos (V3 0 4.4 0))) (cameraFor view)
      let sx = rawX / zoom; sy = rawY / zoom
      when (sx > 50 && sx < wf - 150 && sy > 120 && sy < hf - 180) $ do
        label (if safe then "光の記憶" else kinName g <> "  ·  " <> gemName g) (sx - 85) sy 16 ink
        label (if bond >= 2 then "結ばれている" else if bond == 1 then "もうひとつの贈り物を" else "宝石を待っている") (sx - 55) (sy + 24) 15 soft
  forM_ (sceneEnemies view) $ \(EnemyView pos health windup kind) -> do
    let delta = minus (plus pos (V3 0 1.7 0)) (sceneEye view)
        d = magnitude delta
        maximumHealth = case kind of Wanderer -> 4; Custodian -> 7; Skitter -> 3; SkyMoth -> 3 :: Float
    when (d < 13 && dot (unit delta) (sceneForward view) > 0.96) $ do
      Vector2 rawX rawY <- getWorldToScreen (toRay (plus pos (V3 0 3.5 0))) (cameraFor view)
      let x = round (rawX / zoom) - 28; y = round (rawY / zoom)
      when (y > 120 && y < height - 175) $ do
        drawRectangle x y 56 3 (Color 32 20 38 210)
        drawRectangle x y (round (56 * fromIntegral health / maximumHealth)) 3 (if windup > 0 then Color 255 92 116 255 else Color 224 164 169 220)
  when debug $ do
    drawRectangle 24 135 330 52 (Color 0 0 0 170)
    drawText (printf "%.1f FPS  /  %.1f ms" fps (1000 / max 1 fps)) 33 143 16 ink
    drawText (printf "%.0f voxels / revision %d" (fromIntegral (M.size (sceneCells view)) :: Float) (sceneRevision view)) 33 163 15 ink

renderMenu :: Resources -> Maybe Bool -> Bool -> IO ()
renderMenu resources saved invertY = withUIScale $ \w h _ -> do
  let x = fromIntegral w / 2 - 440; y = fromIntegral h / 2 - 205
  drawRectangle 0 0 w h (Color 3 14 23 211)
  textAt resources "余光の庭" x y 38 (Color 239 235 207 255)
#if defined(wasm32_HOST_ARCH)
  textAt resources "クリック  旅を続ける" x (y + 75) 23 (Color 207 229 216 255)
#else
  textAt resources "ESC  旅を続ける" x (y + 75) 23 (Color 207 229 216 255)
#endif
  textAt resources "F5   記録する" x (y + 118) 23 (Color 207 229 216 255)
  textAt resources "ENTER  記録して終了" x (y + 161) 23 (Color 207 229 216 255)
  textAt resources ("I  視点の上下反転：" <> if invertY then "ON" else "OFF") x (y + 212) 18 (Color 175 200 192 255)
  textAt resources "F11  全画面   ·   F2  撮影表示" x (y + 246) 17 (Color 175 200 192 255)
  textAt resources "F6  フォトモード   ·   F12  撮影" x (y + 271) 17 (Color 175 200 192 255)
  forM_ saved $ \ok -> textAt resources (if ok then "保存しました" else "保存できませんでした。F5 で再試行") x (y + 296) 18 (Color 238 211 148 255)
  let guide = textAt resources; gx = x + 465; soft = Color 175 200 192 255
  guide "旅の手引き" gx (y + 8) 25 (Color 239 235 207 255)
  forM_
    ( zip
        [0 :: Int ..]
        [ "WASD  移動   マウス  視点",
          "SPACE  跳ぶ   SHIFT  走る",
          "E  回避   左クリック  採掘・攻撃",
          "右クリック  置く   1–6 / ホイール  切替",
          "TAB  素材棚を切り替える",
          "F  宝石を贈る・灯りの下へ迎える",
          "Q  生命の光を使う   C  灯花を編む",
          "飛翔後  SPACE 上昇 / CTRL 下降",
          "30秒ごとに自動保存"
        ]
    )
    $ \(i, line) ->
      guide line gx (y + 70 + fromIntegral i * 34) 19 soft

withUIScale :: (Int -> Int -> Float -> IO ()) -> IO ()
withUIScale action = do
  width <- getScreenWidth
  height <- getScreenHeight
  let zoom = max 0.85 (fromIntegral height / 900)
  mode2D
    (Camera2D (Vector2 0 0) (Vector2 0 0) 0 zoom)
    (action (round (fromIntegral width / zoom)) (round (fromIntegral height / zoom)) zoom)

renderSaveFeedback :: Resources -> Maybe Bool -> IO ()
renderSaveFeedback resources status = withUIScale $ \w h _ -> forM_ status $ \ok ->
  textAt
    resources
    (if ok then "記録しました" else "記録できませんでした。F5 で再試行")
    (fromIntegral w - 430)
    (fromIntegral h - 112)
    18
    (if ok then Color 211 223 183 255 else Color 245 150 139 255)

renderPhotoFrame :: Photo -> IO ()
renderPhotoFrame p = when (photoCinema p) $ do
  w <- getScreenWidth
  h <- getScreenHeight
  let bar = max 0 (round ((fromIntegral h - fromIntegral w / 2.39) / 2 :: Float))
  drawRectangle 0 0 w bar (Color 0 0 0 255)
  drawRectangle 0 (h - bar) w bar (Color 0 0 0 255)

renderPhotoChrome :: Resources -> Photo -> Maybe String -> IO ()
renderPhotoChrome resources p message = withUIScale $ \w h _ -> do
  when (photoGrid p) $ do
    let inset = if photoCinema p then max 0 (round ((fromIntegral h - fromIntegral w / 2.39) / 2 :: Float)) else 0
        ink = Color 238 234 208 65
    forM_ [1, 2] $ \n -> do
      drawLine (w * n `div` 3) inset (w * n `div` 3) (h - inset) ink
      drawLine 0 (inset + (h - 2 * inset) * n `div` 3) w (inset + (h - 2 * inset) * n `div` 3) ink
  drawRectangle 24 24 260 66 (Color 6 21 28 215)
  textAt resources "余光を写す" 40 31 26 (Color 243 231 191 255)
  textAt resources "時を止めた庭 / PHOTO MODE" 41 65 13 (Color 174 205 193 255)
  let label = printf "画角 %.0f°   傾き %+.0f°   露出 %+.1f EV" (photoFov p) (photoRoll p * 180 / pi) (photoExposure p)
      x = fromIntegral w - 440
      flag yes = if yes then "入" else "切"
  drawRectangle (w - 456) 24 432 89 (Color 6 21 28 215)
  textAt resources label x 36 17 (Color 237 229 200 255)
  textAt resources (gradeName (photoGrade p) <> "   発光 " <> flag (photoBloom p) <> "   周辺減光 " <> flag (photoVignette p)) x 65 17 (Color 174 205 193 255)
  drawRectangle 24 (h - 132) (w - 48) 108 (Color 6 21 28 225)
  textAt resources "ENTER / F12  撮影     F6 / ESC  戻る     F2  案内を隠す" 41 (fromIntegral h - 121) 19 (Color 243 231 191 255)
  textAt resources "WASD / SPACE / CTRL  移動   SHIFT  高速   ALT  微速   マウス  視点   ホイール  画角" 41 (fromIntegral h - 86) 16 (Color 185 211 200 255)
  textAt resources "Q / E  傾き   ↑ / ↓  露出   TAB  色味   B  発光   V  周辺減光   G  ガイド   C  映画枠   R  リセット" 41 (fromIntegral h - 57) 16 (Color 185 211 200 255)
  forM_ message $ \line -> do
    drawRectangle 24 (h - 182) (w - 48) 38 (Color 6 21 28 230)
    textAt resources line 40 (fromIntegral h - 175) 16 (Color 243 231 191 255)

renderPhotoToast :: Resources -> String -> IO ()
renderPhotoToast resources line = withUIScale $ \w h _ -> do
  drawRectangle 24 (h - 190) (w - 48) 42 (Color 6 21 28 230)
  textAt resources line 40 (fromIntegral h - 180) 16 (Color 243 231 191 255)

white :: Color
white = Color 255 255 255 255
