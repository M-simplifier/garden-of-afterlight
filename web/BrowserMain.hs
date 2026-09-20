{-# LANGUAGE TemplateHaskell #-}
{-# LANGUAGE ForeignFunctionInterface #-}

module BrowserMain where

import Garden.Runtime
import Foreign (Ptr, castPtrToStablePtr, deRefStablePtr)
import Foreign.C.Types (CInt (..))
import Raylib.Util (raylibApplication)

startup :: IO GardenApp
startup = beginGarden

mainLoop :: GardenApp -> IO GardenApp
mainLoop app = stepGarden app >> pure app

shouldClose :: GardenApp -> IO Bool
shouldClose = shouldCloseGarden

teardown :: GardenApp -> IO ()
teardown = shutdownGarden

withApp :: Ptr () -> (GardenApp -> IO a) -> IO a
withApp pointer action = deRefStablePtr (castPtrToStablePtr pointer) >>= action

loadingStage :: Ptr () -> IO CInt
loadingStage pointer = withApp pointer $ \app -> do
  (stage, _, _) <- startupProgress app
  pure (fromIntegral (fromEnum stage))

loadingDone :: Ptr () -> IO CInt
loadingDone pointer = withApp pointer $ \app -> do
  (_, done, _) <- startupProgress app
  pure (fromIntegral done)

loadingTotal :: Ptr () -> IO CInt
loadingTotal pointer = withApp pointer $ \app -> do
  (_, _, total) <- startupProgress app
  pure (fromIntegral total)

isReady :: Ptr () -> IO CInt
isReady pointer = withApp pointer $ \app -> fromIntegral . fromEnum <$> gardenReady app

preview :: Ptr () -> IO ()
preview pointer = withApp pointer previewGarden

setActive :: Ptr () -> CInt -> IO ()
setActive pointer active = withApp pointer (\app -> setGardenActive app (active /= 0))

setQuality :: Ptr () -> CInt -> IO ()
setQuality pointer percent = withApp pointer (\app -> setGardenQuality app quality)
  where
    quality = case percent of 75 -> BalancedQuality; 50 -> LightQuality; _ -> FullQuality

foreign export ccall "loadingStage" loadingStage :: Ptr () -> IO CInt
foreign export ccall "loadingDone" loadingDone :: Ptr () -> IO CInt
foreign export ccall "loadingTotal" loadingTotal :: Ptr () -> IO CInt
foreign export ccall "isReady" isReady :: Ptr () -> IO CInt
foreign export ccall "preview" preview :: Ptr () -> IO ()
foreign export ccall "setActive" setActive :: Ptr () -> CInt -> IO ()
foreign export ccall "setQuality" setQuality :: Ptr () -> CInt -> IO ()

raylibApplication 'startup 'mainLoop 'shouldClose 'teardown
