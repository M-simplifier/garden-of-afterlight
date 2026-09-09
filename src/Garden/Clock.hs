module Garden.Clock (Clock, emptyClock, schedule, interpolation) where

import Garden.Types

data Clock = Clock !Double !Input deriving (Eq, Show)

emptyClock :: Clock
emptyClock = Clock 0 idleInput

interpolation :: Clock -> Float
interpolation (Clock debt _) = realToFrac (min 1 (max 0 (debt * 60)))

-- No elapsed time is discarded. A stall is drained in batches of at most 8;
-- press edges survive frames without a tick and occur once in the next batch.
schedule :: Double -> Input -> Clock -> ([Input], Clock)
schedule dt observation (Clock debt pending) =
  let accumulated = debt + max 0 dt
      combined = merge pending observation
      count = min 8 (floor (accumulated * 60))
   in if count == 0
        then ([], Clock accumulated combined)
        else
          let divided = combined {lookYaw = lookYaw combined / fromIntegral count, lookPitch = lookPitch combined / fromIntegral count}
              frames = divided : replicate (count - 1) (clearEdges divided)
              remaining = clearEdges combined {lookYaw = 0, lookPitch = 0}
           in (frames, Clock (accumulated - fromIntegral count / 60) remaining)

merge :: Input -> Input -> Input
merge old new =
  new
    { lookYaw = lookYaw old + lookYaw new,
      lookPitch = lookPitch old + lookPitch new,
      jumpEdge = jumpEdge old || jumpEdge new,
      interactEdge = interactEdge old || interactEdge new,
      chargeEdge = chargeEdge old || chargeEdge new,
      craftEdge = craftEdge old || craftEdge new,
      callNightEdge = callNightEdge old || callNightEdge new,
      dodgeEdge = dodgeEdge old || dodgeEdge new,
      slotEdge = case slotEdge new of Nothing -> slotEdge old; Just n -> Just n
    }

clearEdges :: Input -> Input
clearEdges i = i {jumpEdge = False, interactEdge = False, chargeEdge = False, craftEdge = False, callNightEdge = False, slotEdge = Nothing, dodgeEdge = False}
