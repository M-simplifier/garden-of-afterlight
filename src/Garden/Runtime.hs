{-# LANGUAGE PatternSynonyms #-}

module Garden.Runtime (runGarden) where

import Control.Exception (IOException, evaluate, finally, try)
import Control.Monad (foldM, replicateM_, unless, void, when)
import Data.IORef
import Data.List (sort)
import Data.Maybe (isJust)
import Data.Time (defaultTimeLocale, formatTime, getZonedTime)
import FRP.Yampa (ReactHandle, react, reactInit)
import Garden.Audio
import Garden.Checkpoint
import Garden.Clock
import Garden.Input
import Garden.Photo
import Garden.Render
import Garden.Render.Resources
import Garden.Rules
import Garden.Signal
import Garden.Tour qualified as Tour
import Garden.Types
import Garden.View
import Garden.World
import Raylib.Core
import Raylib.Core.Text (drawText)
import Raylib.Types
import Raylib.Util (drawing, withWindow)
import System.Directory
import System.Environment (lookupEnv)
import System.FilePath (takeDirectory)
import System.Mem (performMajorGC)
import Text.Printf (printf)
import Text.Read (readMaybe)

data Host = Host {hostPaused :: Bool, hostHidden :: Bool, hostDebug :: Bool, hostInvert :: Bool, hostSaved :: Maybe Bool, hostRecordUntil :: Double, hostPreviousEye :: V3, hostPhoto :: Maybe Photo, hostPhotoMessage :: Maybe String, hostPhotoUntil :: Double}

data Timing = Timing !Int !Float !Double !Double !Double !Double !Double !Double !Double

data LightSignal = LightSignal !(ReactHandle [Cue] Float) !(IORef Float)

-- Host resources and run options have one lifetime, separate from simulation.
data Session = Session Resources AudioAssets LightSignal (IORef [Timing]) (Maybe Int) (Maybe Int) FilePath (Maybe String) (IORef Tour.Pilot)

runGarden :: IO ()
runGarden = do
  createDirectoryIfMissing True ".runtime/garden/screenshots"
  ensureAudio
  source <- loadSaved
  scene <- lookupEnv "GARDEN_SCENE"
  frameLimit <- readEnv "GARDEN_FRAMES"
  shotFrame <- readEnv "GARDEN_SHOT"
  shotName <- maybe ".runtime/garden/screenshots/current.png" id <$> lookupEnv "GARDEN_IMAGE"
  tour <- lookupEnv "GARDEN_TOUR"
  width <- maybe 1600 (max 960) <$> readEnv "GARDEN_WIDTH"
  height <- maybe 900 (max 600) <$> readEnv "GARDEN_HEIGHT"
  pausedAtStart <- (== Just "1") <$> lookupEnv "GARDEN_PAUSED"
  hiddenAtStart <- (== Just "0") <$> lookupEnv "GARDEN_HUD"
  let world = chooseScene scene source
  setConfigFlags [Msaa4xHint, WindowResizable]
  withWindow width height "NOEMA - Garden of Afterlight" 120 $ \window -> do
    setExitKey KeyNull
    setWindowMinSize 960 600
    drawing $ clearBackground (Color 14 36 43 255) >> drawText "NOEMA / GARDEN OF AFTERLIGHT" 55 60 28 (Color 232 230 204 255) >> drawText "Growing the voxel garden..." 57 113 20 (Color 171 210 192 255)
    withResources window $ \resources -> do
      audio <- loadAudioAssets window
      syncChunks resources (project world)
      -- First-use shader/driver work belongs to loading, before input time starts.
      replicateM_ 6 $ do
        updateAudio audio (worldVeil world) False
        drawing $ renderScene resources (project world) 0 >> renderInterface resources (project world) False 120
      performMajorGC
      if pausedAtStart then enableCursor else disableCursor
      _ <- getMouseDelta
      start <- getTime
      timings <- newIORef []
      glow <- newIORef 0
      handle <- reactInit (pure []) (\_ _ value -> writeIORef glow value >> pure False) lightEnvelope
      let initialHost = Host pausedAtStart hiddenAtStart False False Nothing 0 (eye (worldPlayer world)) Nothing Nothing 0
      pilot <- newIORef (Tour.Pilot 0 0)
      let session = Session resources audio (LightSignal handle glow) timings frameLimit shotFrame shotName tour pilot
      loop session world emptyClock initialHost 0 start
        `finally` (enableCursor >> shutdownAudio window audio)
      rows <- reverse <$> readIORef timings
      unless (null rows) (writeTiming rows)

loop :: Session -> World -> Clock -> Host -> Int -> Double -> IO ()
loop session@(Session resources audio (LightSignal handle glow) timingRef limit shotFrame shotName tour pilotRef) w clock host frame previousTime = do
  now <- getTime
  close <- windowShouldClose
  pilotBefore <- readIORef pilotRef
  let completed = if tour == Just "islands" then Tour.expeditionDone pilotBefore else isJust tour && worldRestored w && null (worldBursts w)
  if close || completed || maybe False (frame >=) limit
    then do
      when (limit == Nothing && tour == Nothing) (void (saveCurrent w))
      when (isJust tour) $
        writeFile
          ".runtime/garden/tour-result.txt"
          ( unlines
              ["pilot=" <> show pilotBefore, "feet=" <> show (playerFeet (worldPlayer w)), "stage=" <> Tour.tourStage w, "semantic_ticks=" <> show (worldTick w), "revision=" <> show (worldRevision w), "life=" <> show (worldLife w), "kin=" <> show (worldKin w)]
          )
    else do
      pressed <- readPresses
      let esc = KeyEscape `elem` pressed
          f2 = KeyF2 `elem` pressed
          f3 = KeyF3 `elem` pressed
          f11 = KeyF11 `elem` pressed
          f5 = KeyF5 `elem` pressed
          enter = KeyEnter `elem` pressed
          invert = KeyI `elem` pressed
          restart = KeyR `elem` pressed
          photoToggle = KeyF6 `elem` pressed
          wasPhoto = isJust (hostPhoto host)
          photoExit = wasPhoto && (photoToggle || esc)
          photoEnter = not wasPhoto && photoToggle
          capture = KeyF12 `elem` pressed || wasPhoto && enter && not photoExit
      when f11 toggleBorderlessWindowed
      focused <- isWindowFocused
      let paused = if wasPhoto || photoEnter then hostPaused host else if not focused && tour == Nothing && limit == Nothing then True else if esc then not (hostPaused host) else hostPaused host
          startingPhoto = if photoExit then Nothing else if photoEnter then Just (beginPhoto (eye (worldPlayer w)) (forward (worldPlayer w))) else hostPhoto host
          frozen = paused || isJust startingPhoto || photoExit
      portrait <- case startingPhoto of
        Nothing -> pure Nothing
        Just p | photoEnter -> pure (Just p)
        Just p -> do
          controls <- pollPhotoInput pressed
          -- Focus activation and a short key press can share a frame. Keep
          -- queued button edges, while ignoring background camera motion.
          let activeControls = if focused then controls else controls {photoMove = V3 0 0 0, photoLook = (0, 0), photoZoom = 0, photoTilt = 0, photoLight = 0}
          pure (Just (if restart then beginPhoto (eye (worldPlayer w)) (forward (worldPlayer w)) else stepPhoto (realToFrac (now - previousTime)) activeControls p))
      let updatedHost =
            host
              { hostPaused = paused,
                hostHidden = hostHidden host /= f2,
                hostDebug = hostDebug host /= f3,
                hostInvert = if paused && invert && not wasPhoto then not (hostInvert host) else hostInvert host,
                hostPhoto = portrait,
                hostPhotoMessage = if photoEnter then Nothing else hostPhotoMessage host
              }
      when (paused /= hostPaused host || photoEnter || photoExit) $ do
        if paused && not (isJust portrait) then enableCursor else disableCursor
        _ <- getMouseDelta
        pure ()
      observed <- if frozen || esc then pure idleInput else pollInput (hostInvert updatedHost) (playerSlot (worldPlayer w)) pressed
      let input = observed
          dt = if frozen || esc then 0 else now - previousTime
          (inputs, nextClock) = if frozen || esc then ([], emptyClock) else schedule dt input clock
      (nextWorld, cues, priorEye) <- foldM tick (if restart && not wasPhoto && worldChapter w == Lost then restartWorld w else w, [], hostPreviousEye host) inputs
      nextPulse <- readIORef glow
      afterSim <- getTime
      let projected = project nextWorld
          a = interpolation nextClock
          gameView =
            if distance priorEye (sceneEye projected) > 3
              then projected
              else
                projected {sceneEye = plus (scale (1 - a) priorEye) (scale a (sceneEye projected))}
          view = case portrait of
            Nothing -> if capture then gameView {sceneTarget = NoTarget} else gameView
            Just p -> projected {sceneEye = photoEye p, sceneForward = photoForward p, sceneTarget = NoTarget, sceneBursts = filter (\b -> burstCue b /= Return && burstCue b /= Wound) (sceneBursts projected)}
      syncChunks resources view
      afterMesh <- getTime
      updateAudio audio (sceneVeil view) frozen
      playCues audio cues
      let shouldSave = f5 || tour == Nothing && limit == Nothing && unTick (worldTick nextWorld) `div` 1800 > unTick (worldTick w) `div` 1800
      saved <- if shouldSave then saveCurrent nextWorld else pure False
      let status = if shouldSave then Just saved else hostSaved updatedHost
          recordUntil = if shouldSave then now + 3 else hostRecordUntil updatedHost
      afterAudio <- getTime
      (afterWorld, afterUI) <- drawing $ do
        renderSceneWith portrait resources view (if isJust portrait then 0 else nextPulse)
        mapM_ renderPhotoFrame portrait
        tw <- getTime
        unless capture $ case portrait of
          Just p -> unless (hostHidden updatedHost) (renderPhotoChrome resources p (hostPhotoMessage updatedHost))
          Nothing -> do
            unless (hostHidden updatedHost) (renderInterface resources view (hostDebug updatedHost) (realToFrac (1 / max 0.0001 (now - previousTime))))
            when (not paused && now < recordUntil) (renderSaveFeedback resources status)
            when paused (renderMenu resources status (hostInvert updatedHost))
            when (now < hostPhotoUntil updatedHost) (mapM_ (renderPhotoToast resources) (hostPhotoMessage updatedHost))
        tu <- getTime
        pure (tw, tu)
      afterPresent <- getTime
      photoMessage <- if capture then Just <$> capturePhoto portrait else pure (hostPhotoMessage updatedHost)
      when (afterPresent - now > 0.03) $
        putStrLn (printf "slow frame=%d audio=%.2f world=%.2f ui=%.2f present=%.2f ms" frame ((afterAudio - afterMesh) * 1000) ((afterWorld - afterAudio) * 1000) ((afterUI - afterWorld) * 1000) ((afterPresent - afterUI) * 1000))
      when (Just frame == shotFrame) (takeScreenshot shotName)
      pilotAfter <- readIORef pilotRef
      when (tour == Just "islands" && pilotBefore /= pilotAfter) $ do
        takeScreenshot (".runtime/garden/screenshots/expedition-" <> show pilotAfter <> ".png")
        putStrLn ("Expedition " <> show pilotAfter <> " feet=" <> show (playerFeet (worldPlayer nextWorld)))
      when (isJust tour && milestone w /= milestone nextWorld) $ do
        takeScreenshot (".runtime/garden/screenshots/tour-" <> milestone nextWorld <> ".png")
        putStrLn ("Tour " <> show (worldTick nextWorld) <> " " <> milestone nextWorld)
      when ((isJust limit || isJust tour) && frame < 60000) $ modifyIORef' timingRef (Timing frame (sceneTime view) ((afterSim - now) * 1000) ((afterMesh - afterSim) * 1000) ((afterAudio - afterMesh) * 1000) ((afterWorld - afterAudio) * 1000) ((afterUI - afterWorld) * 1000) ((afterPresent - afterUI) * 1000) ((afterPresent - now) * 1000) :)
      let continue =
            loop
              session
              nextWorld
              nextClock
              (updatedHost {hostSaved = status, hostRecordUntil = recordUntil, hostPreviousEye = priorEye, hostPhotoMessage = photoMessage, hostPhotoUntil = if capture then now + 4 else hostPhotoUntil updatedHost})
              (frame + 1)
              now
      if paused && enter && not wasPhoto && not photoEnter
        then do
          success <- saveCurrent nextWorld
          unless success $
            loop
              session
              nextWorld
              nextClock
              (updatedHost {hostSaved = Just False, hostRecordUntil = now + 3, hostPreviousEye = priorEye})
              (frame + 1)
              now
        else continue
  where
    tick (world, cues, _) input = do
      pilot <- readIORef pilotRef
      let (nextPilot, resolved) = if tour == Just "islands" then Tour.expeditionInput pilot world else (pilot, if isJust tour then Tour.tourInput world else input)
      writeIORef pilotRef nextPilot
      let (next, out) = advance resolved world
      _ <- react handle (1 / 60, Just out)
      pure (next, cues <> out, eye (worldPlayer world))
    milestone world = Tour.tourStage world <> "-" <> show (bonded world) <> "-" <> show (sheltered world)

capturePhoto :: Maybe Photo -> IO String
capturePhoto portrait = do
  stamp <- formatTime defaultTimeLocale "%Y%m%d-%H%M%S" <$> getZonedTime
  result <-
    try
      ( do
          createDirectoryIfMissing True "Screenshots"
          path <- available ("Screenshots/Garden-" <> stamp) (0 :: Int)
          takeScreenshot path
          exists <- doesFileExist path
          size <- if exists then getFileSize path else pure 0
          unless (size > 8) (ioError (userError "PNG export failed"))
          writeFile (path <> ".txt") ("Garden of Afterlight / Photo settings\n" <> maybe "Gameplay camera" show portrait <> "\n")
          pure path
      ) ::
      IO (Either IOException FilePath)
  case result of
    Right path -> putStrLn ("Photo saved: " <> path) >> pure ("撮影しました  " <> path)
    Left problem -> putStrLn ("Photo failed: " <> show problem) >> pure "撮影できませんでした。保存先の空き容量と書き込み権限を確認してください。"
  where
    available stem n = do
      let path = stem <> (if n == 0 then "" else "-" <> show n) <> ".png"
      exists <- doesPathExist path
      if exists then available stem (n + 1) else pure path

saveCurrent :: World -> IO Bool
saveCurrent w = do
  path <- savePath
  let temp = path <> ".next"
  result <-
    try
      ( do
          createDirectoryIfMissing True (takeDirectory path)
          writeFile temp (encode w)
          exists <- doesFileExist path
          when exists (copyFile path (path <> ".previous"))
          renameFile temp path
      ) ::
      IO (Either IOException ())
  case result of
    Right () -> putStrLn "Garden checkpoint saved." >> pure True
    Left problem -> putStrLn ("Could not save; previous checkpoint retained: " <> show problem) >> pure False

savePath :: IO FilePath
savePath = maybe ".runtime/garden/save-v2.txt" id <$> lookupEnv "GARDEN_SAVE_PATH"

loadSaved :: IO World
loadSaved = do
  path <- savePath
  exists <- doesFileExist path
  if not exists
    then pure initialWorld
    else do
      raw <- readFile path
      -- Finish lazy IO before a rejected file is copied: Windows holds a read
      -- lock until EOF, and a parser may reject after only the first character.
      _ <- evaluate (length raw)
      case decode raw of
        Right world -> putStrLn ("Loaded checkpoint: " <> show (worldTick world) <> " feet=" <> show (playerFeet (worldPlayer world))) >> pure world
        Left problem -> do
          backup <- unusedBackup path (0 :: Int)
          copyFile path backup
          putStrLn ("Unreadable checkpoint preserved at " <> backup <> ": " <> show problem)
          pure initialWorld {worldNotice = RecordRecovered, worldNoticeUntil = Tick 600}
  where
    unusedBackup path n = do
      let backup = path <> ".rejected" <> (if n == 0 then "" else "." <> show n)
      exists <- doesFileExist backup
      if exists then unusedBackup path (n + 1) else pure backup

readEnv :: (Read a) => String -> IO (Maybe a)
readEnv name = do value <- lookupEnv name; pure (value >>= readMaybe)

chooseScene :: Maybe String -> World -> World
chooseScene Nothing w = w
chooseScene (Just label) _ = case label of
  "night" -> base {worldVeil = 0.94, worldChapter = Nightfall, worldTick = Tick 30000, worldJourney = NightInvited}
  "dusk" -> base {worldVeil = 0.56, worldChapter = LongDusk, worldTick = Tick 16000}
  "sky" -> viewFrom (V3 0 500 0) (V3 0 540 70) base
  "high" -> viewFrom (V3 (-37) 29 (-26)) (V3 0 13 38) base
  "kin" -> viewFrom (V3 (-16) 5 (-5)) (V3 (-12) 5 1) base
  "return" -> viewFrom (V3 (-8) 19 32) (V3 0 22 54) base {worldJourney = GardenRenewed, worldChapter = Homecoming}
  _ -> base
  where
    base = initialWorld

viewFrom :: V3 -> V3 -> World -> World
viewFrom feet target w = w {worldPlayer = p {playerFeet = feet, playerYaw = atan2 x z, playerPitch = atan2 y (sqrt (x * x + z * z)), playerMotion = Flying}, worldJourney = if worldRestored w then GardenRenewed else Lightborne}
  where
    p = worldPlayer w; V3 x y z = minus target (plus feet (V3 0 1.65 0))

writeTiming :: [Timing] -> IO ()
writeTiming rows = do
  writeFile ".runtime/garden/frame-times.csv" ("frame,semantic_seconds,simulation_ms,mesh_ms,audio_save_ms,render_ms,ui_ms,present_ms,frame_including_present_ms\n" <> concat [printf "%d,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f\n" f t s m a r u q p | Timing f t s m a r u q p <- rows])
  let times = sort [p | Timing _ _ _ _ _ _ _ _ p <- rows]
      percentile :: Double -> Double
      percentile ratio = case drop (floor (ratio * fromIntegral (length times - 1))) times of x : _ -> x; [] -> 0
  putStrLn (printf "garden frames=%d frame p50=%.3f p95=%.3f max=%.3f ms (includes paced present)" (length rows) (percentile 0.5) (percentile 0.95) (percentile 1))
