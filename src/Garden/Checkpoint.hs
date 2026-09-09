module Garden.Checkpoint (encode, decode, CheckpointError (..)) where

import Data.Bits (xor)
import Data.List (foldl')
import Data.Map.Strict qualified as M
import Data.Word (Word64)
import Garden.Change qualified as Change
import Garden.Checkpoint.Legacy (decodeV3)
import Garden.Types
import Garden.World (initialWorld, landscape)
import Text.Read (readMaybe)

data Checkpoint = Checkpoint Int Word64 [(Cell, Maybe Material)] Snapshot deriving (Read, Show)

-- Only persistent meaning crosses this boundary. Runtime revisions and
-- particle lifetimes cannot silently become part of a save-file contract.
data Snapshot = Snapshot
  { savedPlayer :: Player,
    savedKin :: [Kin],
    savedAdversaries :: [Adversary],
    savedInventory :: Inventory,
    savedTick :: Tick,
    savedChapter :: Chapter,
    savedLife :: Float,
    savedVeil :: Float,
    savedCooldown :: Int,
    savedNotice :: Notice,
    savedNoticeUntil :: Tick,
    savedJourney :: Journey
  }
  deriving (Read, Show)

remember :: World -> Snapshot
remember w =
  Snapshot
    { savedPlayer = worldPlayer w,
      savedKin = worldKin w,
      savedAdversaries = worldAdversaries w,
      savedInventory = worldInventory w,
      savedTick = worldTick w,
      savedChapter = worldChapter w,
      savedLife = worldLife w,
      savedVeil = worldVeil w,
      savedCooldown = worldCooldown w,
      savedNotice = worldNotice w,
      savedNoticeUntil = worldNoticeUntil w,
      savedJourney = worldJourney w
    }

restore :: Snapshot -> World
restore s =
  initialWorld
    { worldPlayer = savedPlayer s,
      worldKin = savedKin s,
      worldAdversaries = savedAdversaries s,
      worldInventory = savedInventory s,
      worldTick = savedTick s,
      worldChapter = savedChapter s,
      worldLife = savedLife s,
      worldVeil = savedVeil s,
      worldCooldown = savedCooldown s,
      worldNotice = savedNotice s,
      worldNoticeUntil = savedNoticeUntil s,
      worldJourney = savedJourney s
    }

data CheckpointError = UnknownFormat | DifferentLandscape | InvalidState deriving (Eq, Show)

encode :: World -> String
encode w = show (Checkpoint 4 landscapeFingerprint edits (remember w))
  where
    edits = Change.entries (Change.between landscape (worldCells w))

decode :: String -> Either CheckpointError World
decode raw = case readMaybe raw of
  Just (Checkpoint 4 fingerprint edits snapshot) -> recover fingerprint edits (restore snapshot)
  Just _ -> Left InvalidState
  Nothing -> case decodeV3 raw of
    Just (fingerprint, edits, world) -> recover fingerprint edits world
    Nothing -> Left UnknownFormat
  where
    recover fingerprint edits w
      | fingerprint /= landscapeFingerprint = Left DifferentLandscape
      | valid w && length edits < 200000 && all (validCell . fst) edits =
          Right w {worldCells = Change.apply (Change.fromEntries edits) landscape, worldRevision = 1, worldEdits = M.empty, worldBursts = []}
      | otherwise = Left InvalidState
    finite x = not (isNaN x || isInfinite x)
    position (V3 x y z) = all (\a -> finite a && a > (-2048) && a < 2048) [x, y, z]
    valid w =
      let p = worldPlayer w; inv = worldInventory w
       in all finite [playerYaw p, playerPitch p, worldLife w, worldVeil w]
            && all position [playerFeet p, playerVelocity p, playerDashDirection p]
            && all (>= 0) (charges inv : M.elems (gems inv) <> M.elems (blocks inv))
            && worldLife w >= 0
            && worldLife w <= 100
            && worldVeil w >= 0
            && worldVeil w <= 1
            && map kinId (worldKin w) == [0, 1, 2]
            && all (\k -> position (kinPosition k) && kinBond k >= 0) (worldKin w)
            && length (worldAdversaries w) <= 32
            && all validEnemy (worldAdversaries w)
            && unTick (worldTick w) >= 0
            && worldRevision w >= 0
            && playerSlot p >= 0
            && playerSlot p < length hotbar
            && playerDashTicks p >= 0
            && playerDashTicks p <= 10
            && playerDashCooldown p >= 0
            && (case playerMotion p of Airborne v -> finite v; Flying -> worldFlight w; Grounded -> True)
            && (not (worldRestored w) || worldChapter w == Homecoming)
    validEnemy a = position (adversaryPosition a) && adversaryHealth a > 0 && adversaryWindup a >= 0 && adversaryCooldown a >= 0
    validCell (Cell x y z) = all (\n -> n > (-2048) && n < 2048) [x, y, z]

-- A delta checkpoint names its exact authored baseline. A changed landscape
-- cannot silently reinterpret a player's edits against a different world.
landscapeFingerprint :: Word64
landscapeFingerprint = M.foldlWithKey' hashCell 14695981039346656037 landscape
  where
    hashCell h (Cell x y z) material = foldl' (\a n -> (a `xor` fromIntegral n) * 1099511628211) h [x, y, z, tag material]
    tag material = case material of
      Pearl -> 1
      Foundation -> 2
      Gold -> 3
      Moss -> 4
      Leaves -> 5
      Bark -> 6
      Water -> 7
      Luminous -> 8
      Ore g -> 9 + fromEnum g
