module Garden.Audio (AudioAssets, ensureAudio, generateAudio, loadAudioAssets, updateAudio, playCues, shutdownAudio) where

import Control.Monad (forM_, unless)
import Data.ByteString.Builder (toLazyByteString)
import Data.ByteString.Lazy qualified as BL
import Data.Map.Strict qualified as M
import Garden.Soundscape
import Garden.Types (Cue (..))
import Raylib.Core.Audio
import Raylib.Internal (WindowResources, managed)
import Raylib.Types.Core.Audio (Music, Sound)
import System.Directory (createDirectoryIfMissing, doesFileExist)

data AudioAssets = AudioAssets (Maybe Music) (Maybe Music) (M.Map Cue Sound)

root :: FilePath
root = "assets/garden-audio/"

cues :: [Cue]
cues = [Mine, Build, Jewel, Offering, Wound, Jump, Strike, Dusk, Wings, Return, Dash]

ensureAudio :: IO ()
ensureAudio = renderAudio True

generateAudio :: IO ()
generateAudio = renderAudio False

renderAudio :: Bool -> IO ()
renderAudio keepExisting = do
  createDirectoryIfMissing True root
  let write name duration signal = do
        exists <- doesFileExist (root <> name)
        unless (keepExisting && exists) (BL.writeFile (root <> name) (toLazyByteString (wave duration signal)))
  write "day.wav" 48 (ambience Sunlit)
  write "night.wav" 48 (ambience Veiled)
  forM_ cues $ \cue -> write (show cue <> ".wav") (cueLength cue) (cueSignal cue)

loadAudioAssets :: WindowResources -> IO AudioAssets
loadAudioAssets window = do
  initAudioDevice
  ready <- isAudioDeviceReady
  if not ready
    then putStrLn "Audio device unavailable; continuing silently." >> pure (AudioAssets Nothing Nothing M.empty)
    else do
      day <- managed window (loadMusicStream (root <> "day.wav"))
      night <- managed window (loadMusicStream (root <> "night.wav"))
      forM_ [day, night] $ \music -> setMusicVolume music 0 >> playMusicStream music
      sounds <- traverse (\cue -> do sound <- managed window (loadSound (root <> show cue <> ".wav")); setSoundVolume sound 0.75; pure sound) (M.fromList [(c, c) | c <- cues])
      pure (AudioAssets (Just day) (Just night) sounds)

updateAudio :: AudioAssets -> Float -> Bool -> IO ()
updateAudio (AudioAssets day night _) veil paused = do
  let level = if paused then 0.10 else 0.55
      update volume music = setMusicVolume music volume >> updateMusicStream music
  mapM_ (update (level * sqrt (max 0 (1 - veil)))) day
  mapM_ (update (level * sqrt (max 0 veil))) night

playCues :: AudioAssets -> [Cue] -> IO ()
playCues (AudioAssets _ _ sounds) events = mapM_ (mapM_ playSound . (`M.lookup` sounds)) selected
  where
    selected = if any (`elem` events) [Wings, Return] then filter (/= Offering) events else events

shutdownAudio :: WindowResources -> AudioAssets -> IO ()
shutdownAudio window (AudioAssets day night sounds) = do
  forM_ (M.elems sounds) (`unloadSound` window)
  forM_ [day, night] (mapM_ (`unloadMusicStream` window))
  closeAudioDevice (Just window)
