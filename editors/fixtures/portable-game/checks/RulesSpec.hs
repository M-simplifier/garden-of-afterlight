module Main where

import Control.Monad (unless)
import Lantern.Rules
import Lantern.Types

main :: IO ()
main = do
  let arrived = advance (Walk 1) initial
      collected = advance Collect arrived
  unless (delivered collected == 3) (fail "collect adds the lantern score")
  unless (advance Collect collected == collected) (fail "a lantern can be collected once")
