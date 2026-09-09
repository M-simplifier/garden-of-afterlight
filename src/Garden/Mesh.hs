{-# LANGUAGE StrictData #-}

module Garden.Mesh (RGB (..), Vertex (..), Geometry, palette, terrainGeometry, ornamentGeometry, kinSculpture, enemySculpture, relicGeometry) where

import Data.Map.Strict qualified as M
import Garden.Types

data RGB = RGB !Float !Float !Float deriving (Eq, Show)

data Vertex = Vertex !V3 !V3 !RGB !Float deriving (Eq, Show)

type Geometry = [Vertex]

data Face = Face !Cell !V3 ![V3]

palette :: Material -> RGB
palette Pearl = RGB 0.91 0.88 0.74
palette Foundation = RGB 0.20 0.30 0.33
palette Gold = RGB 0.79 0.52 0.19
palette Moss = RGB 0.16 0.38 0.29
palette Leaves = RGB 0.25 0.61 0.47
palette Bark = RGB 0.30 0.41 0.35
palette Water = RGB 0.17 0.58 0.61
palette Luminous = RGB 0.90 0.96 0.65
palette (Ore Jade) = RGB 0.15 0.89 0.63
palette (Ore Rose) = RGB 0.88 0.36 0.51
palette (Ore Azure) = RGB 0.26 0.63 0.96
palette (Ore Honey) = RGB 0.98 0.69 0.24

emission :: Material -> Float
emission Luminous = 1
emission (Ore _) = 0.35
emission _ = 0

colorScale :: Float -> RGB -> RGB
colorScale s (RGB r g b) = RGB (r * s) (g * s) (b * s)

-- Exact exposed faces. The GPU receives only this derived representation.
cellGeometry :: M.Map Cell Material -> [(Cell, Material)] -> Geometry
cellGeometry cells entries = concatMap drawCell entries
  where
    drawCell (c@(Cell x y z), m) = concatMap (faceGeometry c m) faces
      where
        faceGeometry origin material (Face delta normal corners)
          | maybe False (/= Luminous) (M.lookup (cellAdd origin delta) cells) = []
          | otherwise = triangulate [Vertex (plus (V3 (fromIntegral x) (fromIntegral y) (fromIntegral z)) corner) normal (colorScale (variation * shade corner normal) (palette material)) (emission material) | corner <- corners]
        variation = 0.94 + fromIntegral (abs (x * 71 + y * 29 + z * 97) `mod` 13) * 0.009
        shade corner normal = ambientOcclusion cells c corner normal * sunlight
        -- A deterministic directional visibility field is baked only at mesh
        -- mutation boundaries. It never changes collision or semantic state.
        sunlight = if emission m > 0.1 then 1 else sunVisibility cells c

sunVisibility :: M.Map Cell Material -> Cell -> Float
sunVisibility cells c
  | any blocked [1 .. 40 :: Int] = 0.56
  | otherwise = 1
  where
    p = plus (center c) (V3 (-0.36) 0.53 (-0.23))
    blocked i =
      let q = cellOf (plus p (scale (fromIntegral i) (V3 (-0.67) 1 (-0.43))))
       in q /= c && maybe False (/= Water) (M.lookup q cells)

terrainGeometry :: M.Map Cell Material -> [(Cell, Material)] -> Geometry
terrainGeometry cells entries =
  cellGeometry cells [(c, m) | (c, m) <- entries, m /= Luminous]
    <> concat
      [ translateGeometry (V3 (fromIntegral x) (fromIntegral y) (fromIntegral z)) lampSculpture
      | (Cell x y z, Luminous) <- entries
      ]

-- A replaceable metre cell contains a small voxel lantern, with an open gold
-- calyx and a luminous seed. Its conservative build/collision unit stays one cell.
lampSculpture :: Geometry
lampSculpture = scaleGeometry 0.1 (cellGeometry cells (M.toList cells))
  where
    cells = M.fromList (base <> ribs <> heart <> crown)
    base = [(Cell x 0 z, Gold) | x <- [2 .. 7], z <- [2 .. 7], abs (x - 5) + abs (z - 5) < 5]
    ribs = [(Cell x y z, Gold) | y <- [1 .. 8], (x, z) <- [(2, 2), (2, 7), (7, 2), (7, 7)], y < 7 || x == z]
    heart = [(Cell x y z, Luminous) | x <- [3 .. 6], y <- [2 .. 7], z <- [3 .. 6], abs (x - 5) + abs (y - 5) + abs (z - 5) < 4]
    crown = [(Cell x 8 z, Pearl) | x <- [2 .. 7], z <- [2 .. 7], abs (x - 5) + abs (z - 5) == 3]

triangulate :: [a] -> [a]
triangulate [a, b, c, d] = [a, b, c, a, c, d]
triangulate _ = []

cellAdd :: Cell -> Cell -> Cell
cellAdd (Cell x y z) (Cell a b c) = Cell (x + a) (y + b) (z + c)

faces :: [Face]
faces =
  [ Face (Cell 1 0 0) (V3 1 0 0) [V3 1 0 0, V3 1 1 0, V3 1 1 1, V3 1 0 1],
    Face (Cell (-1) 0 0) (V3 (-1) 0 0) [V3 0 0 1, V3 0 1 1, V3 0 1 0, V3 0 0 0],
    Face (Cell 0 1 0) (V3 0 1 0) [V3 0 1 0, V3 0 1 1, V3 1 1 1, V3 1 1 0],
    Face (Cell 0 (-1) 0) (V3 0 (-1) 0) [V3 0 0 1, V3 0 0 0, V3 1 0 0, V3 1 0 1],
    Face (Cell 0 0 1) (V3 0 0 1) [V3 1 0 1, V3 1 1 1, V3 0 1 1, V3 0 0 1],
    Face (Cell 0 0 (-1)) (V3 0 0 (-1)) [V3 0 0 0, V3 0 1 0, V3 1 1 0, V3 1 0 0]
  ]

ambientOcclusion :: M.Map Cell Material -> Cell -> V3 -> V3 -> Float
ambientOcclusion cells origin (V3 cx cy cz) (V3 nx ny nz) = 0.46 + 0.18 * fromIntegral level
  where
    sign x = if x < 0.5 then -1 else 1
    n = Cell (round nx) (round ny) (round nz)
    (a, b)
      | nx /= 0 = (Cell 0 (sign cy) 0, Cell 0 0 (sign cz))
      | ny /= 0 = (Cell (sign cx) 0 0, Cell 0 0 (sign cz))
      | otherwise = (Cell (sign cx) 0 0, Cell 0 (sign cy) 0)
    at offset = M.member (cellAdd (cellAdd origin n) offset) cells
    sa = at a
    sb = at b
    sc = at (cellAdd a b)
    level :: Int
    level = if sa && sb then 0 else 3 - fromEnum sa - fromEnum sb - fromEnum sc

-- Fine sculptures are also made solely of occupied cubes, at 1/8 metre.
kinSculpture :: Gem -> Geometry
kinSculpture gem = cellGeometry cells (M.toList cells)
  where
    cells = M.fromList (body <> collar <> arms <> crown <> mantle <> eyeCells)
    body =
      [ (Cell x y z, Pearl)
      | x <- [-5 .. 5],
        z <- [-4 .. 4],
        y <- [1 .. 18],
        abs x + abs z <= max 2 (6 - abs (y - 10) `div` 3),
        not (y > 12 && abs x <= 1 && z < (-1))
      ]
    collar = [(Cell x y z, Gold) | x <- [-7 .. 7], z <- [-6 .. 6], y <- [12 .. 13], abs x + abs z >= 7, abs x + abs z <= 9]
    arms = [(Cell (d * (7 + i `div` 3)) (11 - i) z, Pearl) | d <- [-1, 1], i <- [0 .. 9], z <- [-1 .. 1]]
    crown =
      [ (Cell x y z, if y >= 24 then Luminous else Gold)
      | x <- [-6 .. 6],
        z <- [-2 .. 2],
        y <- [18 .. 27],
        abs x >= 3,
        y < 27 - abs (abs x - 4) * 2,
        abs z <= 1 || y `mod` 4 == 0
      ]
    eyeCells = [(Cell x y (-4), Ore gem) | x <- [-2 .. 2], y <- [14 .. 16], abs x + abs (y - 15) <= 2]
    mantle = case gem of
      Jade ->
        [ (Cell (d * x) y z, if y `mod` 4 == 0 then Gold else Pearl)
        | d <- [-1, 1],
          x <- [4 .. 10],
          y <- [2 .. 17],
          z <- [-3 .. 3],
          x == 5 + (17 - y) `div` 3,
          abs z < 1 + abs (y - 9) `div` 3
        ]
      Rose ->
        [ (Cell x y z, if abs x + abs z > 8 then Ore Rose else Gold)
        | x <- [-11 .. 11],
          y <- [16 .. 27],
          z <- [-7 .. 7],
          let r = abs x + abs z,
          r > 7 && r < 12,
          y == 26 - (r - 8) * 2 || y == 25 - (r - 8) * 2
        ]
      Azure ->
        [ (Cell x y z, if x `mod` 3 == 0 then Gold else Pearl)
        | x <- [-7 .. 7],
          y <- [18 .. 34],
          z <- [-1 .. 1],
          abs x > 2 && abs x < 8 - (y - 18) `div` 4 || y == 32 && abs x < 5
        ]
          <> [(Cell x y z, Ore Azure) | x <- [-3 .. 3], y <- [3 .. 7], z <- [-5 .. (-3)], abs x + abs (y - 5) < 4]
      Honey -> []

enemySculpture :: Threat -> Geometry
enemySculpture kind = cellGeometry cells (M.toList cells)
  where
    cells = M.fromList (body <> legs <> mantle <> core)
    body = [(Cell x y z, Foundation) | x <- [-6 .. 6], y <- [4 .. 18], z <- [-4 .. 4], abs x + abs (y - 12) + abs z < 10, not (abs x < 3 && y > 8 && y < 14 && z < 0)]
    legs = [(Cell (d * (4 + i `div` 2)) (6 - i) z, Gold) | d <- [-1, 1], i <- [0 .. 6], z <- [-1 .. 1]]
    core = [(Cell x y z, Ore Rose) | x <- [-2 .. 2], y <- [9 .. 13], z <- [-4 .. 0], abs x + abs (y - 11) + abs (z + 2) < 4]
    mantle = case kind of
      Wanderer -> [(Cell x y 0, Gold) | x <- [-8 .. 8], y <- [17 .. 21], abs x > 5, y < 25 - abs x]
      Custodian -> [(Cell x y z, if y `mod` 5 == 0 then Gold else Foundation) | x <- [-11 .. 11], y <- [5 .. 23], z <- [-5 .. 5], abs x > 6, abs x + abs (y - 15) < 17]
      Skitter -> [(Cell (d * (6 + i)) (8 - i `div` 2) (e * 5), Gold) | d <- [-1, 1], e <- [-1, 1], i <- [0 .. 10]]
      SkyMoth ->
        [ (Cell (d * x) y z, if (x + y) `mod` 5 == 0 then Ore Rose else Foundation)
        | d <- [-1, 1],
          x <- [5 .. 24],
          y <- [5 .. 27],
          z <- [-1 .. 1],
          y > 4 + x `div` 2,
          y < 29 - x `div` 3,
          not (x `mod` 6 == 0 && y < 17)
        ]

-- An articulated seed inside the monumental ring. Every facet is a cube;
-- transforms belong to presentation, while the flight destination is semantic.
relicGeometry :: Geometry
relicGeometry = cellGeometry cells (M.toList cells)
  where
    cells = M.fromList (rings <> filaments <> seed)
    rings =
      [ (Cell x y z, if r < 32 then Gold else Pearl)
      | x <- [-39 .. 39],
        y <- [-39 .. 39],
        z <- [-1 .. 1],
        let r = sqrt (fromIntegral (x * x + y * y) :: Float),
        r > 30 && r < 32 || r > 37 && r < 38,
        abs x > 4 || abs y < 35
      ]
    filaments =
      [ (Cell x y 0, Gold)
      | x <- [-34 .. 34],
        y <- [-34 .. 34],
        abs x + abs y == 34 || abs x + abs y == 35 || abs x == abs y && abs x > 14 && abs x < 24
      ]
    seed =
      [ (Cell x y z, if abs x + abs z < 3 then Luminous else if y `mod` 6 == 0 then Gold else Ore Honey)
      | x <- [-5 .. 5],
        z <- [-5 .. 5],
        y <- [-16 .. 16],
        abs x + abs z < 7 - abs y `div` 3
      ]

translateGeometry :: V3 -> Geometry -> Geometry
translateGeometry delta = map (\(Vertex p n c e) -> Vertex (plus p delta) n c e)

scaleGeometry :: Float -> Geometry -> Geometry
scaleGeometry s = map (\(Vertex p n c e) -> Vertex (scale s p) n c e)

-- Surface ornaments inherit the owning block: removing it removes its growth.
-- Fine voxels are visual detail on a metre-scale editable terrain cell.
ornamentGeometry :: M.Map Cell Material -> [(Cell, Material)] -> Geometry
ornamentGeometry cells = concatMap ornament
  where
    ornament (c@(Cell x y z), m)
      | M.member (Cell x (y + 1) z) cells = []
      | m == Moss && h `mod` 4 == 0 =
          concat
            [ let a = fromIntegral branch * 2.094 + fromIntegral (h `mod` 7)
                  r = fromIntegral step * 0.075
                  pos = V3 (0.5 + cos a * r) (1 + fromIntegral step * 0.065) (0.5 + sin a * r)
               in cube pos (V3 0.055 0.09 0.055) (RGB 0.38 0.61 0.35) 0
                    <> cube
                      (plus pos (V3 (-0.06) 0 0))
                      (V3 0.18 0.035 0.08)
                      (if h `mod` 17 == 0 && step > 3 then palette (Ore Rose) else RGB 0.33 0.53 0.30)
                      0
            | branch <- [0 .. 2 :: Int],
              step <- [1 .. 5 :: Int]
            ]
      | m == Water && h `mod` 7 == 0 =
          cube (V3 0.16 1.012 0.18) (V3 0.6 0.035 0.6) (RGB 0.23 0.50 0.37) 0
            <> cube (V3 0.39 1.04 0.40) (V3 0.16 0.15 0.16) (palette (Ore Rose)) 0.38
      | m == Pearl && y > 7 && h `mod` 4 == 0 =
          cube (V3 0.17 1.005 0.17) (V3 0.66 0.07 0.66) (palette Gold) 0
      | otherwise = []
      where
        h = abs (x * 71 + z * 137 + y * 19)
        base = V3 (fromIntegral x) (fromIntegral y) (fromIntegral z)
        shade = sunVisibility cells c
        cube offset (V3 sx sy sz) color glow =
          concat
            [ triangulate
                [ Vertex
                    (plus (plus base offset) (V3 (a * sx) (b * sy) (d * sz)))
                    normal
                    (colorScale shade color)
                    glow
                | V3 a b d <- corners
                ]
            | Face _ normal corners <- faces
            ]
