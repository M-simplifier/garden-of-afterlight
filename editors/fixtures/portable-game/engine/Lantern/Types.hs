module Lantern.Types where

import Data.Map.Strict (Map)
import qualified Data.Map.Strict as Map

data Input = Walk Int | Collect deriving (Eq, Show)
data World = World
  { position :: Int
  , delivered :: Int
  , lanterns :: Map Int Int
  } deriving (Eq, Show)

initial :: World
initial = World 0 0 (Map.fromList [(1, 3), (3, 5)])
