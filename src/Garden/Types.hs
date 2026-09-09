{-# LANGUAGE StrictData #-}

module Garden.Types where

import Data.Map.Strict (Map)
import Data.Map.Strict qualified as M

data V3 = V3 !Float !Float !Float deriving (Eq, Ord, Read, Show)

data Cell = Cell !Int !Int !Int deriving (Eq, Ord, Read, Show)

type Chunk = (Int, Int, Int)

newtype Tick = Tick {unTick :: Int} deriving (Eq, Ord, Read, Show)

data Gem = Jade | Rose | Azure | Honey deriving (Eq, Ord, Enum, Bounded, Read, Show)

data Material = Pearl | Foundation | Gold | Moss | Leaves | Bark | Water | Luminous | Ore Gem
  deriving (Eq, Ord, Read, Show)

data Chapter = FirstLight | LongDusk | Nightfall | Homecoming | Lost deriving (Eq, Ord, Read, Show)

data Motion = Grounded | Airborne Float | Flying deriving (Eq, Read, Show)

data Threat = Wanderer | Custodian | Skitter | SkyMoth
  deriving (Eq, Ord, Enum, Bounded, Read, Show)

-- Progress is a single state, so flight and return cannot contradict one another.
data Journey = Awakening | NightInvited | Lightborne | GardenRenewed
  deriving (Eq, Ord, Read, Show)

data Player = Player
  { playerFeet :: V3,
    playerYaw :: Float,
    playerPitch :: Float,
    playerMotion :: Motion,
    playerSlot :: Int,
    playerVelocity :: V3,
    playerCoyote :: Int,
    playerJumpBuffer :: Int,
    playerDashTicks :: Int,
    playerDashCooldown :: Int,
    playerDashDirection :: V3
  }
  deriving (Eq, Read, Show)

data Kin = Kin
  { kinId :: Int,
    kinPosition :: V3,
    kinGem :: Gem,
    kinBond :: Int,
    kinSheltered :: Bool
  }
  deriving (Eq, Read, Show)

data Adversary = Adversary
  { adversaryId :: Int,
    adversaryPosition :: V3,
    adversaryHealth :: Int,
    adversaryWindup :: Int,
    adversaryCooldown :: Int,
    adversaryKind :: Threat
  }
  deriving (Eq, Read, Show)

data Inventory = Inventory {gems :: Map Gem Int, blocks :: Map Material Int, charges :: Int}
  deriving (Eq, Read, Show)

data Cue = Mine | Jewel | Build | Offering | Wound | Jump | Strike | Dusk | Wings | Return | Dash
  deriving (Eq, Ord, Read, Show)

data Burst = Burst {burstOrigin :: V3, burstCue :: Cue, burstBorn :: Tick}
  deriving (Eq, Read, Show)

data Notice
  = Welcome
  | Found Gem
  | NeedGem Gem
  | GiftAccepted Gem
  | LightUsed
  | KinSaved
  | FlightGranted
  | SkyChanging
  | Returned
  | CannotBuild
  | Crafted
  | NeedCraft
  | NeedMaterial Material
  | Slain
  | RecordRecovered
  | NoNotice
  deriving (Eq, Read, Show)

data World = World
  { worldCells :: Map Cell Material,
    worldRevision :: Int,
    worldEdits :: Map Cell Int,
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
  deriving (Eq, Read, Show)

-- Render-frame observation is accumulated before it becomes one fixed tick.
data Input = Input
  { moveSide :: Float,
    moveForward :: Float,
    lookYaw :: Float,
    lookPitch :: Float,
    jumpEdge :: Bool,
    jumpHeld :: Bool,
    descendHeld :: Bool,
    sprintHeld :: Bool,
    mineHeld :: Bool,
    placeHeld :: Bool,
    interactEdge :: Bool,
    chargeEdge :: Bool,
    craftEdge :: Bool,
    callNightEdge :: Bool,
    slotEdge :: Maybe Int,
    dodgeEdge :: Bool
  }
  deriving (Eq, Read, Show)

idleInput :: Input
idleInput = Input 0 0 0 0 False False False False False False False False False False Nothing False

worldFlight :: World -> Bool
worldFlight w = worldJourney w >= Lightborne

worldRestored :: World -> Bool
worldRestored w = worldJourney w == GardenRenewed

worldChosenCycle :: World -> Bool
worldChosenCycle w = worldJourney w /= Awakening

fixedDt :: Float
fixedDt = 1 / 60

hotbar :: [Material]
hotbar = [Pearl, Gold, Luminous, Moss, Leaves, Water, Foundation, Bark, Ore Jade, Ore Rose, Ore Azure, Ore Honey]

materialCount :: Inventory -> Material -> Int
materialCount inventory (Ore gem) = M.findWithDefault 0 gem (gems inventory)
materialCount inventory material = M.findWithDefault 0 material (blocks inventory)

slotMaterial :: Int -> Material
slotMaterial n = case drop n hotbar of m : _ -> m; [] -> Pearl

plus :: V3 -> V3 -> V3
plus (V3 x y z) (V3 a b c) = V3 (x + a) (y + b) (z + c)

scale :: Float -> V3 -> V3
scale s (V3 x y z) = V3 (s * x) (s * y) (s * z)

minus :: V3 -> V3 -> V3
minus a b = plus a (scale (-1) b)

dot :: V3 -> V3 -> Float
dot (V3 x y z) (V3 a b c) = x * a + y * b + z * c

magnitude :: V3 -> Float
magnitude v = sqrt (dot v v)

unit :: V3 -> V3
unit v = let n = magnitude v in if n < 0.00001 then V3 0 0 0 else scale (1 / n) v

distance :: V3 -> V3 -> Float
distance a b = magnitude (minus a b)

clamp :: (Ord a) => a -> a -> a -> a
clamp lo hi = max lo . min hi

center :: Cell -> V3
center (Cell x y z) = V3 (fromIntegral x + 0.5) (fromIntegral y + 0.5) (fromIntegral z + 0.5)

cellOf :: V3 -> Cell
cellOf (V3 x y z) = Cell (floor x) (floor y) (floor z)

eye :: Player -> V3
eye p = plus (playerFeet p) (V3 0 1.65 0)

forward :: Player -> V3
forward p = V3 (sin (playerYaw p) * cos (playerPitch p)) (sin (playerPitch p)) (cos (playerYaw p) * cos (playerPitch p))

-- With +Z forward and +Y up, screen-right is -X (independent control test).
planarBasis :: Float -> (V3, V3)
planarBasis yaw = (V3 (sin yaw) 0 (cos yaw), V3 (-cos yaw) 0 (sin yaw))

tickAge :: Tick -> Tick -> Int
tickAge (Tick now) (Tick born) = max 0 (now - born)
