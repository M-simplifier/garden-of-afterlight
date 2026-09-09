module Garden.Signal (lightEnvelope) where

import FRP.Yampa
import Garden.Types

-- A gift creates a decaying visible light envelope. This network owns no
-- game rules and can be reconstructed at load from zero without replaying cues.
lightEnvelope :: SF [Cue] Float
lightEnvelope = sscan step 0
  where
    step previous cues = if any (`elem` [Offering, Wings, Return]) cues then 1 else max 0 (previous - 1 / 95)
