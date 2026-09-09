module Main where

import Control.Exception (IOException, try)
import GHC.IO.Encoding (setLocaleEncoding, utf8)
import GHC.IO.Handle (hDuplicateTo)
import Garden.Runtime (runGarden)
import System.Directory (createDirectoryIfMissing, doesFileExist, setCurrentDirectory)
import System.Environment (getExecutablePath)
import System.FilePath (takeDirectory, (</>))
import System.IO (BufferMode (LineBuffering), IOMode (AppendMode), hSetBuffering, stderr, stdout, withFile)

main :: IO ()
main = do
  setLocaleEncoding utf8
  here <- doesFileExist "assets/shaders/voxel.fs"
  executable <- getExecutablePath
  let directory = takeDirectory executable
  beside <- doesFileExist (directory </> "assets/shaders/voxel.fs")
  if not here && beside then setCurrentDirectory directory else pure ()
  -- Explorer provides no console handle; preserve redirected diagnostic output
  -- when present and give ordinary GUI launches a local log instead.
  output <- try (hSetBuffering stdout LineBuffering >> putStrLn banner) :: IO (Either IOException ())
  case output of
    Right () -> pure ()
    Left _ -> do
      createDirectoryIfMissing True ".runtime/garden"
      withFile ".runtime/garden/run.log" AppendMode $ \logHandle -> do
        hDuplicateTo logHandle stdout
        hDuplicateTo logHandle stderr
      hSetBuffering stdout LineBuffering
      putStrLn banner
  runGarden
  where
    banner = "NOEMA / Garden of Afterlight - Windows edition"
