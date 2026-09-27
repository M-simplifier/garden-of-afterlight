{-# LANGUAGE PatternSynonyms #-}
-- Real renderer/allocator exercise without input polling, pointer capture,
-- audio, saves or a visible/focused window. Runtime art remains external.
module Main (main) where

import Control.Exception (bracket)
import Control.Monad (forM, forM_, replicateM_)
import Data.IORef (writeIORef)
import GHC.IO.Encoding (setLocaleEncoding, utf8)
import Garden.Photo
import Garden.Render
import Garden.Render.Resources
import Garden.Render.Settings
import Garden.View
import Garden.World
import Raylib.Core
import Raylib.Types
import Raylib.Util (drawing)
import System.Mem (performMajorGC)
import System.Directory (createDirectoryIfMissing)
import Text.Printf (printf)

main :: IO ()
main = do
  setLocaleEncoding utf8
  createDirectoryIfMissing True ".runtime/render-check"
  setConfigFlags [WindowHidden, WindowUnfocused, WindowAlwaysRun, WindowResizable]
  bracket (initWindow 1280 720 "Afterlight renderer check (observer)") (closeWindow . Just) $ \window -> do
    setTargetFPS 0
    withResources window $ \resources -> do
      let view = (project initialWorld) {sceneTarget = NoTarget}
          photo = (beginPhoto (sceneEye view) (sceneForward view)) {photoGrid = False}
      syncChunks resources view
      let cases =
            [ ("day-" <> show q, (1280,720), preset q, view, Nothing) | q <- [FullQuality, BalancedQuality, LightQuality] ] <>
            [ ("night", (1280,720), preset FullQuality, view {sceneVeil = 0.94}, Nothing),
              ("dusk", (1280,720), preset BalancedQuality, view {sceneVeil = 0.60}, Nothing),
              ("wide-odd", (1367,769), preset FullQuality, view, Just photo {photoFov = 100, photoRoll = 0.45}),
              ("portrait-tele", (701,1001), preset BalancedQuality, view, Just photo {photoFov = 20}),
              ("no-shadows", (1280,720), (preset FullQuality) {shadows = NoShadows}, view, Nothing),
              ("no-ao", (1280,720), (preset FullQuality) {occlusion = NoOcclusion}, view, Nothing),
              ("no-clouds", (1280,720), (preset FullQuality) {clouds = ClearSky}, view, Nothing),
              ("no-bloom", (1280,720), (preset FullQuality) {bloom = False}, view, Nothing),
              ("restored-high", (1280,720), preset FullQuality, view, Nothing)
            ]
      rows <- forM cases $ \(name, (w,h), settings, scene, portrait) -> do
        setWindowSize w h
        writeIORef (resourceQuality resources) settings
        let draw = drawing (renderSceneWith portrait resources scene 0)
        replicateM_ 12 draw
        performMajorGC
        timings <- forM [1..60 :: Int] $ \n -> do
          start <- getTime
          draw
          end <- getTime
          pure (printf "%s,%d,%.4f\n" name n ((end-start)*1000))
        takeScreenshot (".runtime/render-check/" <> name <> ".png")
        putStrLn ("render-check passed: " <> name)
        pure (concat timings)
      -- Churn allocations repeatedly; disabled effects must release their
      -- targets and high quality must remain usable after resize/re-enable.
      forM_ (take 18 (cycle [LightQuality, FullQuality, BalancedQuality])) $ \quality -> do
        writeIORef (resourceQuality resources) (preset quality)
        drawing (renderScene resources view 0)
      writeFile ".runtime/render-check/frame-times.csv" ("case,frame,cpu_and_present_ms\n" <> concat rows)
      putStrLn "Render check complete; no pointer or input APIs were used."
