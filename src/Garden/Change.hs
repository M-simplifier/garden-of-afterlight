-- | A garden remembers what we place, and what we take away.
-- Changes describe that intention before any world or renderer interprets it.
module Garden.Change
  ( Change,
    place,
    remove,
    apply,
    between,
    entries,
    fromEntries,
  )
where

import Data.Map.Strict (Map)
import Data.Map.Strict qualified as M
import Garden.Types (Cell, Material)

-- | Absence from the map means "leave it alone".
-- A present Nothing means "take it away".
newtype Change = Change (Map Cell (Maybe Material)) deriving (Eq, Show)

-- | Read composition in time order: earlier <> later.
-- The last intention at a cell wins, including removal.
instance Semigroup Change where
  Change earlier <> Change later = Change (M.union later earlier)

instance Monoid Change where
  mempty = Change M.empty

place :: Cell -> Material -> Change
place cell material = Change (M.singleton cell (Just material))

remove :: Cell -> Change
remove cell = Change (M.singleton cell Nothing)

-- | Interpretation respects composition:
--
-- @apply (a <> b) garden == apply b (apply a garden)@
--
-- @apply mempty garden == garden@
apply :: Change -> Map Cell Material -> Map Cell Material
apply (Change change) garden = M.foldlWithKey' write garden change
  where
    write cells cell = maybe (M.delete cell cells) (\material -> M.insert cell material cells)

-- | The smallest change taking one garden to another.
-- Unchanged cells carry no intention.
--
-- @apply (between before after) before == after@
between :: Map Cell Material -> Map Cell Material -> Change
between before after = Change (M.union placed removed)
  where
    placed = Just <$> M.filterWithKey (\cell material -> M.lookup cell before /= Just material) after
    removed = Nothing <$ M.difference before after

-- | A stable spatial order for storage; composition has already resolved time.
entries :: Change -> [(Cell, Maybe Material)]
entries (Change change) = M.toAscList change

-- | Later entries win, just as later changes do.
fromEntries :: [(Cell, Maybe Material)] -> Change
fromEntries = Change . M.fromList
