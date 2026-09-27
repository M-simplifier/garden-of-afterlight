{-# LANGUAGE CPP #-}
{-# LANGUAGE PatternSynonyms #-}
-- | Interpret an immutable render plan. Geometry is supplied as draw callbacks;
-- this module has no access to the world, inputs, saves or simulation clock.
module Garden.Render.Radiance (Radiance, acquireRadiance, releaseRadiance, renderRadiance, shadowVisible) where

import Control.Exception (IOException, bracketOnError, finally, mask_, onException, try)
import Control.Monad (forM_)
import Data.IORef
import Raylib.Core
import Raylib.Core.Shapes (drawRectangle)
import Raylib.Internal (WindowResources)
import Raylib.Types
import Raylib.Util (mode3D, textureMode)
import Raylib.Util.Math (matrixMultiply, matrixInvert)
import Raylib.Util.RLGL
import Garden.Render.GPU
import Garden.Render.Settings

data Targets = Targets !RenderPlan !RenderTexture !RenderTexture !(Maybe (RenderTexture, RenderTexture)) !(Maybe RenderTexture) !(Maybe (RenderTexture, RenderTexture))
data Radiance = Radiance !WindowResources !Shader !Shader !Shader !Shader !Bool !(IORef (Maybe Targets))

acquireRadiance :: WindowResources -> IO Radiance
acquireRadiance window = mask_ $ do
#if defined(wasm32_HOST_ARCH)
  let vertex = Just "assets/shaders/screen.vs"
#else
  let vertex = Nothing
#endif
  let shader file = loadCheckedShader window vertex ("assets/shaders/" <> file <> ".fs")
      own action = bracketOnError action (`unloadShader` window)
  own (shader "sky") $ \sky -> own (shader "post") $ \post ->
    own (shader "effects") $ \effects -> own (shader "bloom") $ \glow -> do
      -- Test the actual attachment, not a version string. Unsupported half
      -- float devices retain the same linear pipeline in an explicit LDR mode.
      probe <- try (colorTarget True True (4, 4)) :: IO (Either IOException RenderTexture)
      hdr <- case probe of
        Right target -> releaseTarget target >> pure True
        Left _ -> putStrLn "garden renderer: RGBA16F unavailable; linear RGBA8 fallback" >> pure False
      targets <- newIORef Nothing
      pure (Radiance window sky post effects glow hdr targets)

releaseRadiance :: Radiance -> IO ()
releaseRadiance (Radiance window sky post effects glow _ ref) = do
  current <- atomicModifyIORef' ref (\old -> (Nothing, old))
  releaseAll (mapM_ releaseTargets current : map (`unloadShader` window) [glow, effects, post, sky])

releaseTargets :: Targets -> IO ()
releaseTargets (Targets _ scene sky shadow effect glow) = releaseAll (map releaseTarget owned)
  where owned = [scene, sky] <> maybe [] (\(a,b) -> [a,b]) shadow <> maybe [] (:[]) effect <> maybe [] (\(a,b) -> [a,b]) glow

ensureTargets :: Radiance -> RenderPlan -> IO Targets
ensureTargets (Radiance _ _ _ _ _ hdr ref) plan = mask_ $ do
  old <- readIORef ref
  case old of
    Just target@(Targets previous _ _ _ _ _) | previous == plan -> pure target
    _ -> do
      cleanup <- newIORef []
      let own action = do value <- action; modifyIORef' cleanup (releaseTarget value :); pure value
          make = do
            scene <- own (colorTarget hdr True (sceneSize plan))
            sky <- own (colorTarget hdr False (skySize plan))
            shadow <- traverse (\(near,far) -> (,) <$> own (depthTarget near) <*> own (depthTarget far)) (shadowSize plan)
            effect <- traverse (own . colorTarget False False) (effectsSize plan)
            glow <- traverse (\size -> (,) <$> own (colorTarget hdr False size) <*> own (colorTarget hdr False size)) (bloomSize plan)
            pure (Targets plan scene sky shadow effect glow)
      fresh <- make `onException` (readIORef cleanup >>= releaseAll)
      writeIORef ref (Just fresh)
      mapM_ releaseTargets old
      putStrLn ("garden render plan: " <> show plan <> " hdr=" <> show hdr)
      pure fresh

-- The near/far camera, sky, AO and fog all use the same projection and sun.
-- Texture slots stay below WebGL 2's guaranteed fragment-stage minimum (16).
renderRadiance :: Radiance -> RenderSettings -> Shader -> Camera3D -> Float -> Float -> Vector3 -> Float
  -> (Camera3D -> IO ()) -> IO () -> IO ()
renderRadiance radiance@(Radiance window sky post effects glow hdr _) settings world camera time veil grading vignette drawShadow drawScene = do
  width <- getScreenWidth
  height <- getScreenHeight
  let plan = renderPlan (width, height) settings
  Targets _ scene skyTarget shadow effect bloomTargets <- ensureTargets radiance plan
  let u shader name value = setShaderValue shader name value window
      mat shader name value = getShaderLocation shader name window >>= \loc -> setShaderValueMatrix shader loc value
      night = smooth 0.35 0.94 veil
      sunset = sin (night * pi)
      sun = unit (mix night (Vector3 (-0.55 - sunset*0.25) (0.78 - sunset*0.47) (0.32 + sunset*0.1)) (Vector3 0.38 0.70 (-0.56)))
      energy = mix night (mix sunset (Vector3 3.4 3.10 2.45) (Vector3 3.5 1.62 0.63)) (Vector3 0.25 0.38 0.68)
      ambient = mix night (Vector3 0.26 0.38 0.48) (Vector3 0.03 0.05 0.09)
      eye = camera3D'position camera
      forward = unit (minus (camera3D'target camera) eye)
      right = unit (cross forward (camera3D'up camera))
      up = cross right forward
      lens = tan (camera3D'fovy camera*pi/360)
      focus = plus eye (scale 32 forward)
      common shader = do
        u shader "sunDirection" (ShaderUniformVec3 sun)
        u shader "sunRadiance" (ShaderUniformVec3 energy)
        u shader "skyRadiance" (ShaderUniformVec3 ambient)
        u shader "eyePosition" (ShaderUniformVec3 eye)
        u shader "night" (ShaderUniformFloat night)
        u shader "time" (ShaderUniformFloat time)
      vec2 (w,h) = ShaderUniformVec2 (Vector2 (fromIntegral w) (fromIntegral h))
  mapM_ common [world, sky, effects]
  u world "hasShadows" (ShaderUniformInt (maybe 0 (const 1) shadow))
  u effects "hasShadows" (ShaderUniformInt (maybe 0 (const 1) shadow))
  -- Unbind every sampled attachment before any framebuffer can write it.
  forM_ [8..12] $ \slot -> rlActiveTextureSlot slot >> rlDisableTexture
  rlActiveTextureSlot 0
  u world "shadowPass" (ShaderUniformInt 1)
  rlSetClipPlanes 0.1 700
  forM_ shadow $ \(near,far) -> do
    let nearCamera = lightCamera sun focus 112 (texture'width (renderTexture'depth near))
        farCamera = lightCamera sun focus 360 (texture'width (renderTexture'depth far))
        shadowPass target cam = textureMode target $ do
          clearBackground (Color 255 255 255 255)
          mode3D cam $ do
            view <- rlGetMatrixModelview
            projection <- rlGetMatrixProjection
            drawShadow cam
            pure (matrixMultiply view projection)
    nearVP <- shadowPass near nearCamera
    farVP <- shadowPass far farCamera
    forM_ [world,effects] $ \shader -> do
      mat shader "lightVP" nearVP
      mat shader "farVP" farVP
      u shader "shadowMap" (ShaderUniformInt 8)
      u shader "shadowFar" (ShaderUniformInt 9)
    bindTexture 8 (renderTexture'depth near)
    bindTexture 9 (renderTexture'depth far)
  u world "shadowPass" (ShaderUniformInt 0)
  rlSetClipPlanes 0.1 520
  u sky "resolution" (vec2 (skySize plan))
  u sky "viewAspect" (ShaderUniformFloat (fromIntegral (fst (sceneSize plan)) / fromIntegral (snd (sceneSize plan))))
  u sky "lens" (ShaderUniformFloat lens)
  u sky "forwardView" (ShaderUniformVec3 forward)
  u sky "rightView" (ShaderUniformVec3 right)
  u sky "upView" (ShaderUniformVec3 up)
  u sky "cloudSteps" (ShaderUniformInt (cloudSteps plan))
  textureMode skyTarget $ withShader sky (uncurry (drawRectangle 0 0) (skySize plan) white)
  vp <- textureMode scene $ do
    clearBackground (Color 0 0 0 255)
    blit skyTarget (sceneSize plan)
    mode3D camera $ do
      view <- rlGetMatrixModelview
      projection <- rlGetMatrixProjection
      drawScene
      pure (matrixMultiply view projection)
  -- Alpha carries AO, so blending here would square the result or retain the
  -- preceding frame. A clear and replacement write make this pass idempotent.
  forM_ effect $ \target -> do
    let size = maybe (sceneSize plan) id (effectsSize plan)
    mat effects "invViewProjection" (matrixInvert vp)
    u effects "resolution" (vec2 size)
    u effects "sceneSize" (vec2 (sceneSize plan))
    u effects "lensAspect" (ShaderUniformVec2 (Vector2 lens (fromIntegral (fst (sceneSize plan)) / fromIntegral (snd (sceneSize plan)))))
    u effects "clipPlanes" (ShaderUniformVec2 (Vector2 0.1 520))
    u effects "sampleCount" (ShaderUniformInt (occlusionSamples plan))
    u effects "sceneDepth" (ShaderUniformInt 10)
    bindTexture 10 (renderTexture'depth scene)
    (rlDisableColorBlend >> textureMode target (clearBackground white >> withShader effects (uncurry (drawRectangle 0 0) size white))) `finally` rlEnableColorBlend
  forM_ bloomTargets $ \(a,b) -> do
    let size@(w,h) = maybe (1,1) id (bloomSize plan)
        blur source target direction extract = do
          u glow "direction" (ShaderUniformVec2 direction)
          u glow "extract" (ShaderUniformInt extract)
          u glow "hdr" (ShaderUniformInt (fromEnum hdr))
          textureMode target (withShader glow (blit source size))
    blur scene a (Vector2 (1/fromIntegral w) 0) 1
    blur a b (Vector2 0 (1/fromIntegral h)) 0
  u post "resolution" (vec2 (sceneSize plan))
  u post "grading" (ShaderUniformVec3 grading)
  u post "vignette" (ShaderUniformFloat vignette)
  u post "hasEffects" (ShaderUniformInt (maybe 0 (const 1) effect))
  u post "hasBloom" (ShaderUniformInt (maybe 0 (const 1) bloomTargets))
  u post "sceneDepth" (ShaderUniformInt 10)
  u post "effectsMap" (ShaderUniformInt 11)
  u post "bloomMap" (ShaderUniformInt 12)
  mapM_ (bindTexture 11 . renderTexture'texture) effect
  mapM_ (bindTexture 12 . renderTexture'texture . snd) bloomTargets
  withShader post (blit scene (width, height))
  rlActiveTextureSlot 0
  where white = Color 255 255 255 255

-- Snap in the light's image plane. World-axis rounding produces shimmering
-- whenever the light is oblique; depth does not need quantization.
lightCamera :: Vector3 -> Vector3 -> Float -> Int -> Camera3D
lightCamera sun focus extent resolution = Camera3D (plus snapped (scale 300 sun)) snapped up extent CameraOrthographic
  where
    right = unit (cross (scale (-1) sun) (Vector3 0 1 0))
    up = cross right (scale (-1) sun)
    pitch = extent / fromIntegral resolution
    snap value = fromIntegral (round (value/pitch) :: Int)*pitch-value
    snapped = plus focus (plus (scale (snap (dot focus right)) right) (scale (snap (dot focus up)) up))

-- Conservative chunk-sphere/frustum test includes off-screen shadow casters.
shadowVisible :: Float -> Camera3D -> Vector3 -> Bool
shadowVisible radius camera point = abs (dot delta right) <= extent && abs (dot delta up) <= extent && depth >= 0.1-radius && depth <= 700+radius
  where
    forward = unit (minus (camera3D'target camera) (camera3D'position camera))
    right = unit (cross forward (camera3D'up camera))
    up = cross right forward
    delta = minus point (camera3D'position camera)
    extent = camera3D'fovy camera/2 + radius
    depth = dot delta forward

plus, minus, cross :: Vector3 -> Vector3 -> Vector3
plus (Vector3 a b c) (Vector3 x y z) = Vector3 (a+x) (b+y) (c+z)
minus a b = plus a (scale (-1) b)
cross (Vector3 a b c) (Vector3 x y z) = Vector3 (b*z-c*y) (c*x-a*z) (a*y-b*x)
dot :: Vector3 -> Vector3 -> Float
dot (Vector3 a b c) (Vector3 x y z) = a*x+b*y+c*z
scale :: Float -> Vector3 -> Vector3
scale s (Vector3 x y z) = Vector3 (s*x) (s*y) (s*z)
unit :: Vector3 -> Vector3
unit v = scale (1 / max 0.00001 (sqrt (dot v v))) v
mix :: Float -> Vector3 -> Vector3 -> Vector3
mix t a b = plus (scale (1-t) a) (scale t b)
smooth :: Float -> Float -> Float -> Float
smooth a b x = let t = max 0 (min 1 ((x-a)/(b-a))) in t*t*(3-2*t)
