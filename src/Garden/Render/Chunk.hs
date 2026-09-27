-- | Presentation partitioning. Editing/collision remain individual cells.
module Garden.Render.Chunk (chunkOf, chunkCells, chunkCenter, chunkRadius, visibleChunk) where

import Garden.Types (Cell(..), Chunk, V3(..), minus, dot)

chunkOf :: Cell -> Chunk
chunkOf (Cell x y z) = (x `div` 8, y `div` 8, z `div` 8)

chunkCells :: Chunk -> [Cell]
chunkCells (cx, cy, cz) = [Cell x y z | x <- axis cx, y <- axis cy, z <- axis cz]
  where axis n = [n*8 .. n*8+7]

chunkCenter :: Chunk -> V3
chunkCenter (x,y,z) = V3 (fromIntegral (x*8+4)) (fromIntegral (y*8+4)) (fromIntegral (z*8+4))

-- Includes the cube's circumsphere and surface ornaments above a voxel.
chunkRadius :: Float
chunkRadius = 8

visibleChunk :: V3 -> V3 -> V3 -> V3 -> Float -> Float -> Chunk -> Bool
visibleChunk eye forward right up lens aspect key =
  depth >= 0.1-chunkRadius && depth <= 520+chunkRadius
    && abs (dot delta right) <= depth*horizontal + chunkRadius*sqrt (1+horizontal*horizontal)
    && abs (dot delta up) <= depth*lens + chunkRadius*sqrt (1+lens*lens)
  where
    delta = minus (chunkCenter key) eye
    depth = dot delta forward
    horizontal = lens*aspect
