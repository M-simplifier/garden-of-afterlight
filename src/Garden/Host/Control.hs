-- | A host decision, independent of both raylib and the semantic world.
module Garden.Host.Control (ControlMode (..), controlMode, wantsPointer) where

data ControlMode = Interactive | ObserveOnly deriving (Eq, Show)

-- Bounded captures and tours are observers unless explicitly opted into input.
controlMode :: Maybe String -> Bool -> Either String ControlMode
controlMode Nothing bounded = Right (if bounded then ObserveOnly else Interactive)
controlMode (Just "observe") _ = Right ObserveOnly
controlMode (Just "interactive") _ = Right Interactive
controlMode (Just value) _ = Left ("GARDEN_INPUT: expected observe or interactive, got " <> value)

wantsPointer :: ControlMode -> Bool -> Bool -> Bool -> Bool
wantsPointer mode focused paused photo = mode == Interactive && focused && (not paused || photo)
