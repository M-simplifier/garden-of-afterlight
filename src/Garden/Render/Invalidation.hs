-- | Geometry dependencies belong to the renderer, not to the garden's rules.
module Garden.Render.Invalidation (dirtyFor, changedSince) where

import Data.Map.Strict qualified as M
import Data.Set qualified as S
import Garden.Types
import Garden.Render.Chunk

-- | A renderer can skip frames without losing an edit, even if a cell is
-- edited again. No consumer clears or acknowledges the world's history.
changedSince :: Int -> M.Map Cell Int -> S.Set Chunk
changedSince revision = S.unions . map dirtyFor . M.keys . M.filter (> revision)

-- Geometry reads only the edited cell and the 26 face/AO neighbours. Dynamic
-- shadow maps are refreshed by the renderer and never expand mesh invalidation.
dirtyFor :: Cell -> S.Set Chunk
dirtyFor (Cell x y z) = S.fromList
  [chunkOf (Cell (x+a) (y+b) (z+d)) | a <- [-1..1], b <- [-1..1], d <- [-1..1]]
