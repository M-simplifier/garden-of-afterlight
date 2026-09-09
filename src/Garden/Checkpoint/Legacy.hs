-- | Frozen Checkpoint 3 reader. New saves never depend on this representation.
module Garden.Checkpoint.Legacy (decodeV3) where

import Data.Map.Strict (Map)
import Data.Map.Strict qualified as M
import Data.Set (Set)
import Data.Word (Word64)
import Garden.Types hiding (World (..))
import Garden.Types qualified as Current
import Text.Read (readMaybe)

data LegacyCheckpoint = Checkpoint Int Word64 [(Cell, Maybe Material)] LegacyWorld deriving (Read)

data LegacyWorld = World
  { worldCells :: Map Cell Material,
    worldRevision :: Int,
    worldDirty :: Set Chunk,
    worldPlayer :: Player,
    worldKin :: [Kin],
    worldAdversaries :: [Adversary],
    worldInventory :: Inventory,
    worldTick :: Tick,
    worldChapter :: Chapter,
    worldLife :: Float,
    worldVeil :: Float,
    worldCooldown :: Int,
    worldNotice :: Notice,
    worldNoticeUntil :: Tick,
    worldBursts :: [Burst],
    worldJourney :: Journey
  }
  deriving (Read)

decodeV3 :: String -> Maybe (Word64, [(Cell, Maybe Material)], Current.World)
decodeV3 raw = do
  Checkpoint 3 fingerprint edits old <- readMaybe raw
  pure
    ( fingerprint,
      edits,
      Current.World
        { Current.worldCells = worldCells old,
          Current.worldRevision = worldRevision old,
          Current.worldEdits = M.empty,
          Current.worldPlayer = worldPlayer old,
          Current.worldKin = worldKin old,
          Current.worldAdversaries = worldAdversaries old,
          Current.worldInventory = worldInventory old,
          Current.worldTick = worldTick old,
          Current.worldChapter = worldChapter old,
          Current.worldLife = worldLife old,
          Current.worldVeil = worldVeil old,
          Current.worldCooldown = worldCooldown old,
          Current.worldNotice = worldNotice old,
          Current.worldNoticeUntil = worldNoticeUntil old,
          Current.worldBursts = worldBursts old,
          Current.worldJourney = worldJourney old
        }
    )
