{-# LANGUAGE TemplateHaskell #-}

module BrowserMain where

import Garden.Runtime
import Raylib.Util (raylibApplication)

startup :: IO GardenApp
startup = startupGarden

mainLoop :: GardenApp -> IO GardenApp
mainLoop app = stepGarden app >> pure app

shouldClose :: GardenApp -> IO Bool
shouldClose = shouldCloseGarden

teardown :: GardenApp -> IO ()
teardown = shutdownGarden

raylibApplication 'startup 'mainLoop 'shouldClose 'teardown
