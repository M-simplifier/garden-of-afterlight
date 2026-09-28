module Main where

import Lantern.Rules
import Lantern.Types

main :: IO ()
main = do
  putStrLn "Lantern Courier: l/r to walk, c to collect, q to quit."
  play initial

play :: World -> IO ()
play world = do
  print (position world, delivered world)
  command <- getLine
  case command of
    "l" -> play (advance (Walk (-1)) world)
    "r" -> play (advance (Walk 1) world)
    "c" -> play (advance Collect world)
    "q" -> pure ()
    _ -> play world
