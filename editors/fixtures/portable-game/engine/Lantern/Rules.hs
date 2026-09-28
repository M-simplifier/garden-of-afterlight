module Lantern.Rules where

import qualified Data.Map.Strict as Map
import Lantern.Types

advance :: Input -> World -> World
advance (Walk offset) world = world { position = position world + offset }
advance Collect world = world
  { delivered = delivered world + Map.findWithDefault 0 (position world) (lanterns world)
  , lanterns = Map.delete (position world) (lanterns world)
  }

-- Intentionally unsigned: the viewer should show the inferred type.
scoreAfter input world = delivered (advance input world)
