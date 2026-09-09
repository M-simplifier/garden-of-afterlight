-- | Geometry dependencies belong to the renderer, not to the garden's rules.
module Garden.Render.Invalidation (dirtyFor, changedSince) where

import Data.Map.Strict qualified as M
import Data.Set qualified as S
import Garden.Types
import Garden.World (chunkOf)

-- | A renderer can skip frames without losing an edit, even if a cell is
-- edited again. No consumer clears or acknowledges the world's history.
changedSince :: Int -> M.Map Cell Int -> S.Set Chunk
changedSince revision = S.unions . map dirtyFor . M.keys . M.filter (> revision)

-- Face/AO neighbours plus the exact inverse of the baked sun-ray samples.
-- A ground edit cannot invalidate an entire vertical column of architecture.
dirtyFor :: Cell -> S.Set Chunk
dirtyFor (Cell x y z) = S.fromList (map chunkOf (neighbours <> shadow))
  where
    neighbours = [Cell (x + a) (y + b) (z + d) | a <- [-1 .. 1], b <- [-1 .. 1], d <- [-1 .. 1]]
    shadow =
      [ let V3 dx dy dz = plus (V3 0.14 1.03 0.27) (scale (fromIntegral i) (V3 (-0.67) 1 (-0.43)))
         in Cell (x - floor dx) (y - floor dy) (z - floor dz)
      | i <- [1 .. 40 :: Int]
      ]
