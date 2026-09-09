-- | The far skyline is terrain too. Flight reveals inhabitable, editable
-- islands, rather than scenery that the player would pass straight through.
module Garden.Islands (archipelago, islandHarbours) where

import Data.Map.Strict (Map)
import Data.Map.Strict qualified as M
import Garden.Types

islandHarbours :: [(String, V3)]
islandHarbours =
  [ ("海鳴りの棚", V3 (-123.5) 16 76.5),
    ("青い書架", V3 128.5 34 130.5),
    ("空白の苗床", V3 (-54.5) 49 209.5),
    ("遠い約束", V3 95.5 65 242.5)
  ]

archipelago :: Map Cell Material
archipelago =
  M.unions
    [ isle index origin
    | (index, origin) <-
        zip
          [0 ..]
          [Cell (-124) 10 76, Cell 128 28 130, Cell (-55) 43 209, Cell 95 59 250]
    ]
  where
    isle seed (Cell ox oy oz) =
      M.fromList
        [(Cell (ox + x) (oy + y) (oz + z), m) | (Cell x y z, m) <- strata seed <> architecture seed <> groves seed]
    strata seed =
      [ (Cell x y z, material x y z top)
      | x <- [-30 .. 30],
        z <- [-21 .. 21],
        let r = (fromIntegral (x * x) / 900 + fromIntegral (z * z) / 441 :: Float),
        r < 0.95 + 0.07 * sin (fromIntegral (z * 2 + x + seed * 5)),
        let top = 5 + floor (sin (fromIntegral x * 0.10) * cos (fromIntegral z * 0.13) :: Float),
        y <- [(-25) .. top],
        y > (-5) - floor ((1 - r) * 18) || abs (x + seed * 3) `mod` 13 < 2 && abs z < 5
      ]
    material x y z top
      | y == top && x * x + z * z < 40 = Pearl
      | y == top = Moss
      | y >= top - 2 = Pearl
      | y `mod` 9 == 0 = Gold
      | otherwise = Foundation
    architecture seed = case seed of
      0 ->
        [ (Cell x y z, if y `mod` 8 == 0 then Gold else Pearl)
        | side <- [-1, 1],
          y <- [6 .. 29],
          z <- [-4 .. 4],
          let bend = floor (6 * sin (fromIntegral (y - 6) / 23 * pi / 2) :: Float),
          x <- [side * (14 - bend) .. side * (14 - bend) + 1]
        ]
          <> [(Cell x 5 z, Water) | x <- [-8 .. 8], z <- [-10 .. 10], x * x + z * z < 90]
      1 ->
        [ (Cell x y z, if y `mod` 6 == 0 then Gold else Pearl)
        | x <- [-17 .. 17],
          z <- [5, 6, 14, 15],
          y <- [6 .. 38],
          abs x `mod` 8 < 2 || y `mod` 8 < 2
        ]
          <> [(Cell x y z, Ore Azure) | x <- [-7 .. 7], z <- [-10 .. (-4)], y <- [6 .. 19 - abs x], abs x + abs (z + 7) < 7]
      2 ->
        [ (Cell x y z, if r < 17 then Gold else Pearl)
        | x <- [-23 .. 23],
          y <- [6 .. 51],
          z <- [8, 9],
          let r = sqrt (fromIntegral (x * x + (y - 29) * (y - 29)) :: Float),
          r > 16 && r < 18 || r > 22 && r < 23
        ]
          <> [(Cell x 6 z, Luminous) | x <- [-8 .. 8], z <- [-5 .. 5], x * x + z * z < 52, (x + z) `mod` 5 == 0]
      _ ->
        [ (Cell x y z, if y `mod` 7 == 0 then Gold else Pearl)
        | x <- [-18 .. 18],
          z <- [4 .. 7],
          y <- [6 .. 42],
          let r = sqrt (fromIntegral (x * x + (y - 24) * (y - 24)) :: Float),
          r > 16 && r < 19,
          x < 8 || y < 27
        ]
          <> [(Cell x y z, Ore Honey) | x <- [-4 .. 4], z <- [-6 .. 0], y <- [6 .. 15], abs x + abs (z + 3) < 6 - (y - 6) `div` 3]
    groves seed =
      [ (Cell (cx + x) y (cz + z), if y == 9 then Luminous else Leaves)
      | (cx, cz) <- [(-22, -8), (20, -4), (-16, 14)],
        x <- [-4 .. 4],
        z <- [-4 .. 4],
        y <- [8 .. 12],
        abs x + abs z < 6 - abs (y - 10)
      ]
        <> [(Cell cx y cz, Gold) | (cx, cz) <- [(-22, -8), (20, -4), (-16, 14)], y <- [5 .. 8]]
        <> [(Cell x 6 z, Ore (if seed `mod` 2 == 0 then Rose else Jade)) | x <- [10 .. 15], z <- [-13 .. (-8)], (x + z) `mod` 4 == 0]
