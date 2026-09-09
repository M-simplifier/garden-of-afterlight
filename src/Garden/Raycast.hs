module Garden.Raycast (Hit (..), raycast, aimedEnemy) where

import Data.Map.Strict qualified as M
import Garden.Types

data Hit = Hit {hitCell :: Cell, hitPrevious :: Cell, hitRange :: Float, hitMaterial :: Material} deriving (Eq, Show)

-- Exact grid traversal: each face is visited once, including negative axes.
raycast :: World -> Float -> Maybe Hit
raycast w limit = walk (cellOf origin) (cellOf origin) 0 tx ty tz
  where
    p = worldPlayer w
    origin@(V3 ox oy oz) = eye p
    V3 dx dy dz = forward p
    Cell ix iy iz = cellOf origin
    step v = if v >= 0 then 1 else -1
    delta v = if abs v < 0.000001 then 1.0e20 else abs (1 / v)
    first o i d = if abs d < 0.000001 then 1.0e20 else (fromIntegral (if d > 0 then i + 1 else i) - o) / d
    tx = first ox ix dx
    ty = first oy iy dy
    tz = first oz iz dz
    walk c@(Cell x y z) previous t ax ay az
      | t > limit = Nothing
      | Just m <- M.lookup c (worldCells w) = Just (Hit c previous t m)
      | ax <= ay && ax <= az = walk (Cell (x + step dx) y z) c ax (ax + delta dx) ay az
      | ay <= az = walk (Cell x (y + step dy) z) c ay ax (ay + delta dy) az
      | otherwise = walk (Cell x y (z + step dz)) c az ax ay (az + delta dz)

aimedEnemy :: World -> Maybe Adversary
aimedEnemy w = pick Nothing (worldAdversaries w)
  where
    p = worldPlayer w
    origin = eye p
    dir = forward p
    blockRange = maybe 6 hitRange (raycast w 6)
    pick best [] = best
    pick best (a : rest)
      | along > 0 && along < min 5.6 blockRange && perpendicular < 0.9 =
          pick (case best of Nothing -> Just a; Just b -> if distance origin (adversaryPosition a) < distance origin (adversaryPosition b) then Just a else best) rest
      | otherwise = pick best rest
      where
        v = minus (plus (adversaryPosition a) (V3 0 1 0)) origin; along = dot v dir; perpendicular = magnitude (minus v (scale along dir))
