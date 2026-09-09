{-# LANGUAGE StrictData #-}

module Garden.World (initialWorld, restartWorld, landscape, heightAt, solid, occupied, bodyCells, bodyClear, groundBelow, chunkOf, editCell) where

import Data.Map.Strict (Map)
import Data.Map.Strict qualified as M
import Garden.Change qualified as Change
import Garden.Islands (archipelago)
import Garden.Types

initialWorld :: World
initialWorld =
  World
    { worldCells = landscape,
      worldRevision = 0,
      worldEdits = M.empty,
      worldPlayer = player,
      worldKin = kin,
      worldAdversaries = enemies,
      worldInventory = inventory,
      worldTick = Tick 0,
      worldChapter = FirstLight,
      worldLife = 100,
      worldVeil = 0,
      worldCooldown = 0,
      worldNotice = Welcome,
      worldNoticeUntil = Tick 600,
      worldBursts = [],
      worldJourney = Awakening
    }
  where
    player = Player (V3 0.5 5 (-39.5)) 0 0.21 Grounded 0 (V3 0 0 0) 6 0 0 0 (V3 0 0 1)
    kin = [Kin 0 (standing (-12) 1) Jade 0 False, Kin 1 (standing 24 22) Rose 0 False, Kin 2 (standing (-23) 39) Azure 0 False]
    enemies = [Adversary 0 (standing 31 2) 4 0 120 Wanderer, Adversary 1 (standing (-34) 26) 7 0 120 Custodian, Adversary 2 (standing 17 58) 3 0 120 Skitter]
    inventory = Inventory M.empty (M.fromList [(Pearl, 36), (Gold, 12), (Luminous, 8), (Moss, 16), (Leaves, 12), (Water, 8)]) 1

-- An authored continuous route sits inside a terraced, fully editable voxel island.
landscape :: Map Cell Material
landscape = M.unions [gemsLayer, temple, bridges, trees, pools, terrain, archipelago]
  where
    terrain =
      M.fromList
        [ (Cell x y z, terrainMaterial x y z h)
        | x <- [-57 .. 57],
          z <- [-48 .. 83],
          let h = heightAt x z,
          island x z,
          y <- [-10 .. h],
          y >= bottomAt x z
        ]
    gemsLayer =
      M.fromList $
        concat
          [ crystal Jade (-9) (-9) 4,
            crystal Rose 20 14 5,
            crystal Azure (-20) 28 5,
            crystal Honey 33 (-3) 4,
            crystal Jade (-25) (-18) 3,
            crystal Rose 38 40 3,
            crystal Azure (-38) 49 4,
            crystal Honey 5 62 4
          ]
    trees = M.unions [voxelTree x z h | (x, z, h) <- [(-28, -24, 11), (23, -21, 13), (-34, 10, 14), (36, 31, 12), (-30, 50, 10), (10, 70, 13), (-8, 68, 9), (43, 9, 9), (-40, -3, 8)]]
    bridges = M.fromList [(Cell x 3 z, if abs x == 1 && z `mod` 9 == 0 then Gold else Pearl) | x <- [-1 .. 1], z <- [-38 .. 34]]
    pools =
      M.fromList
        [ (Cell x (heightAt x z) z, Water)
        | x <- [-43 .. 43],
          z <- [-30 .. 64],
          any
            (\(cx, cz, rx, rz) -> (fromIntegral (x - cx) / rx :: Float) ^ (2 :: Int) + (fromIntegral (z - cz) / rz) ^ (2 :: Int) < 1)
            [(-11, -24, 6, 4), (12, 4, 6, 8), (-16, 17, 5, 5), (29, 47, 7, 6)],
          abs x > 4
        ]

island :: Int -> Int -> Bool
island x z = (fromIntegral x / 55 :: Float) ^ (2 :: Int) + (fromIntegral (z - 15) / 65) ^ (2 :: Int) < 1 + 0.08 * sin (fromIntegral z * 0.23)

bottomAt :: Int -> Int -> Int
bottomAt x z = -9 + floor (4 * abs (sin (fromIntegral x * 0.12) * cos (fromIntegral z * 0.09)) :: Float)

heightAt :: Int -> Int -> Int
heightAt x z
  | abs x <= 5 && z < 36 = 3
  | abs x <= 9 && z < 36 = max natural (8 - abs x)
  | z >= 35 && z <= 68 && abs x < 19 = 5
  | otherwise = natural
  where
    natural = 2 + floor (1.6 * sin (fromIntegral x * 0.13) + 1.3 * cos (fromIntegral z * 0.11) :: Float)

terrainMaterial :: Int -> Int -> Int -> Int -> Material
terrainMaterial x y z h
  | y == h = if abs x < 2 then Pearl else if hash x z `mod` 19 < 18 then Moss else Pearl
  | y == h - 1 = Pearl
  | y < (-4) = Foundation
  | hash (x + y) z `mod` 61 == 0 = Gold
  | otherwise = Pearl

hash :: Int -> Int -> Int
hash x z = abs (x * 734287 + z * 912271 + 12345)

standing :: Int -> Int -> V3
standing x z = V3 (fromIntegral x + 0.5) (fromIntegral (heightAt x z) + 1) (fromIntegral z + 0.5)

crystal :: Gem -> Int -> Int -> Int -> [(Cell, Material)]
crystal gem x z h =
  [ (Cell (x + dx) y (z + dz), Ore gem)
  | dx <- [-2 .. 2],
    dz <- [-2 .. 2],
    abs dx + abs dz < 4,
    y <- [heightAt (x + dx) (z + dz) + 1 .. heightAt x z + h - abs dx - abs dz]
  ]

temple :: Map Cell Material
temple = M.fromList $ floorCells <> stairs <> pillars <> arches <> altar <> crown <> tracery <> buttresses
  where
    floorCells = [(Cell x 5 z, if abs x == 17 || z `elem` [36, 66] || (x + z) `mod` 13 == 0 then Gold else Pearl) | x <- [-17 .. 17], z <- [36 .. 66]]
    stairs = [(Cell x y z, if z `mod` 3 == 0 then Gold else Pearl) | x <- [-8 .. 8], z <- [30 .. 36], y <- [3 .. min 5 (3 + (z - 30) `div` 2)]]
    pillars = [(Cell (x + dx) y (z + dz), if y `elem` [6, 7, 23, 24] || dx == 0 && dz == 0 then Gold else Pearl) | x <- [-14, 14], z <- [39, 51, 63], dx <- [-1 .. 1], dz <- [-1 .. 1], y <- [6 .. 25]]
    arches = [(Cell x y z, if y == top then Gold else Pearl) | z <- [39, 51, 63], x <- [-14 .. 14], let top = 26 + floor (6 * sqrt (max 0 (1 - (fromIntegral x / 15 :: Float) ^ (2 :: Int)))), y <- [top - 2 .. top]]
    altar = [(Cell x y z, if y >= 8 then Luminous else Gold) | x <- [-3 .. 3], z <- [56 .. 60], y <- [6 .. 9], abs x + (abs (z - 58)) < 5]
    crown =
      [ (Cell x y z, if r < 25 || y `mod` 13 == 0 then Gold else Pearl)
      | x <- [-30 .. 30],
        y <- [33 .. 91],
        z <- [53 .. 56],
        let r = sqrt ((fromIntegral x :: Float) ^ (2 :: Int) + (fromIntegral (y - 62)) ^ (2 :: Int)),
        (r > 24 && r < 27 || r > 29 && r < 30 && abs x > 8),
        not (x > 17 && y > 69 && y < 77)
      ]
    tracery =
      [ (Cell x y z, if y `mod` 7 == 0 then Luminous else Gold)
      | x <- [-13 .. 13],
        y <- [9 .. 27],
        z <- [39, 63],
        abs x > 7,
        (abs x + y) `mod` 7 == 0 || (abs x - y) `mod` 7 == 0
      ]
        <> [(Cell x y z, Gold) | x <- [-21, 21], y <- [6 .. 35], z <- [43, 59], y < 35 - abs (z - 51) `div` 2]
    buttresses =
      [ (Cell x y z, if y `mod` 5 == 0 then Gold else Pearl)
      | side <- [-1, 1],
        z <- [43, 59],
        y <- [7 .. 31],
        let bend = round (7 * sin (fromIntegral (y - 7) / 24 * pi / 2) :: Float),
        x <- [side * (22 - bend) .. side * (22 - bend) + 1]
      ]

voxelTree :: Int -> Int -> Int -> Map Cell Material
voxelTree x z h = M.fromList (trunk <> branches <> canopy <> roots)
  where
    base = heightAt x z
    trunk = [(Cell (x + dx) y (z + dz), Bark) | dx <- [-1 .. 1], dz <- [-1 .. 1], abs dx + abs dz <= 1, y <- [base + 1 .. base + h]]
    branches = [(Cell (x + d * i) (base + h - 3 + i `div` 2) (z + e * i), Gold) | (d, e) <- [(1, 0), (-1, 0), (0, 1), (0, -1)], i <- [1 .. 5]]
    canopy =
      [ (Cell (x + dx) (base + h + dy) (z + dz), if dy < (-1) && hash (x + dx) (z + dz) `mod` 13 == 0 then Luminous else Leaves)
      | dx <- [-8 .. 8],
        dz <- [-7 .. 7],
        dy <- [-5 .. 4],
        let radius = sqrt (fromIntegral (dx * dx) + fromIntegral (dz * dz) * 1.2 :: Float),
        let tier = fromIntegral dy + 0.26 * radius,
        radius < 8 && (tier > 0 && tier < 2.7 || radius > 5 && dy < 1 && hash (x + dx) (z + dz) `mod` 5 == 0),
        hash (x + dx * 3 + dy) (z + dz) `mod` 11 /= 0
      ]
    roots = [(Cell (x + d * i) (base + 1) (z + e * i), Bark) | (d, e) <- [(1, 0), (-1, 0), (0, 1), (0, -1)], i <- [1 .. 3]]

solid :: Material -> Bool
solid Water = False
solid _ = True

occupied :: Map Cell Material -> Cell -> Bool
occupied cells c = maybe False solid (M.lookup c cells)

bodyCells :: V3 -> [Cell]
bodyCells (V3 x y z) = [Cell a b c | a <- [floor (x - 0.29) .. floor (x + 0.29)], b <- [floor (y + 0.015) .. floor (y + 1.76)], c <- [floor (z - 0.29) .. floor (z + 0.29)]]

bodyClear :: Map Cell Material -> V3 -> Bool
bodyClear cells p = all (not . occupied cells) (bodyCells p)

groundBelow :: Map Cell Material -> V3 -> Float
groundBelow cells (V3 x y z) = go (min 90 (floor y))
  where
    go a
      | a < (-64) = -66
      | occupied cells (Cell (floor x) a (floor z)) = fromIntegral (a + 1)
      | otherwise = go (a - 1)

chunkOf :: Cell -> Chunk
chunkOf (Cell x y z) = (x `div` 4, y `div` 8, z `div` 4)

-- A new journey restores the garden without rewinding its edit sequence.
-- Observers may still be looking at any earlier revision.
restartWorld :: World -> World
restartWorld previous =
  initialWorld
    { worldRevision = revision,
      worldEdits = M.union restored (worldEdits previous)
    }
  where
    revision = worldRevision previous + 1
    restored = M.fromList [(cell, revision) | (cell, _) <- Change.entries (Change.between (worldCells previous) landscape)]

editCell :: Cell -> Maybe Material -> World -> World
editCell cell material world =
  world
    { worldCells = Change.apply change (worldCells world),
      worldRevision = revision,
      worldEdits = M.insert cell revision (worldEdits world)
    }
  where
    change = maybe (Change.remove cell) (Change.place cell) material
    revision = worldRevision world + 1
