-- | A diagnostic player. It produces the same semantic input as the keyboard;
-- it cannot teleport, grant resources, edit terrain or advance the chapter.
module Garden.Tour (tourInput, tourStage, Pilot (..), expeditionInput, expeditionDone) where

import Data.List (sortOn)
import Data.Map.Strict qualified as M
import Garden.Islands (islandHarbours)
import Garden.Rules (lampNear)
import Garden.Types
import Garden.World (bodyClear, groundBelow, heightAt, initialWorld)

-- Diagnostic route memory is outside World. The pilot can only issue inputs.
data Pilot = Pilot !Int !Int deriving (Eq, Show)

expeditionDone :: Pilot -> Bool
expeditionDone (Pilot stop _) = stop >= length islandHarbours

expeditionInput :: Pilot -> World -> (Pilot, Input)
expeditionInput pilot@(Pilot stop phase) w
  | not (worldRestored w) = (pilot, tourInput w)
  | otherwise = case drop stop islandHarbours of
      [] -> (pilot, idleInput)
      (_, V3 hx hy hz) : _ ->
        let V3 x y z = playerFeet p
            horizontal = sqrt ((hx - x) ^ (2 :: Int) + (hz - z) ^ (2 :: Int))
            moveTo target@(V3 tx ty tz) =
              let V3 ax ay az = minus target (eye p)
                  planar = sqrt ((tx - x) ^ (2 :: Int) + (tz - z) ^ (2 :: Int))
               in idleInput
                    { lookYaw = atan2 ax az - playerYaw p,
                      lookPitch = atan2 ay (sqrt (ax * ax + az * az)) - playerPitch p,
                      moveForward = if planar > 0.3 then min 1 (planar / 4) else 0,
                      jumpHeld = y < ty - 0.15,
                      descendHeld = y > ty + 0.15,
                      sprintHeld = phase < 2
                    }
            landing = groundBelow (worldCells w) (V3 hx (hy + 3) hz)
            surface = foldr max (hy - 4) [fromIntegral (b + 1) | b <- [floor hy - 5 .. floor hy + 3], M.member (Cell (floor hx + 3) b (floor hz)) (worldCells w)]
            ground = V3 (hx + 3) (surface - 0.01) hz
            built =
              any
                (\c -> M.lookup c (worldCells w) == Just Luminous && M.notMember c (worldCells initialWorld))
                [Cell a b c | a <- [floor hx - 4 .. floor hx + 4], b <- [floor hy - 4 .. floor hy + 4], c <- [floor hz - 3 .. floor hz + 3]]
         in case phase of
              0
                | y > 123 -> (Pilot stop 1, idleInput)
                | otherwise -> (pilot, (moveTo (V3 x 125 z)) {jumpHeld = True})
              1
                | horizontal < 0.5 -> (Pilot stop 2, idleInput)
                | otherwise -> (pilot, moveTo (V3 hx 125 hz))
              2
                | y < landing + 0.1 && not (bodyClear (worldCells w) (plus (playerFeet p) (V3 0 (-0.08) 0))) -> (Pilot stop 3, idleInput)
                | otherwise -> (pilot, (moveTo (V3 hx landing hz)) {descendHeld = True, jumpHeld = False})
              _
                | built -> (Pilot (stop + 1) 0, idleInput)
                | otherwise -> (pilot, (moveTo ground) {moveForward = 0, jumpHeld = False, descendHeld = False, slotEdge = Just 2, placeHeld = True})
  where
    p = worldPlayer w

tourStage :: World -> String
tourStage w
  | worldRestored w = "returned"
  | worldChapter w == Lost = "lost"
  | worldFlight w = "ascent"
  | worldChapter w == Nightfall = "shelter"
  | all ((> 0) . kinBond) (worldKin w) = "invite-night"
  | otherwise = "gather-and-give"

tourInput :: World -> Input
tourInput w
  | worldRestored w = idleInput
  | worldLife w < 45 && charges inventory > 0 = idleInput {chargeEdge = True}
  | worldFlight w = (towards (V3 0 66 (if altitude < 43 then 48 else 54))) {jumpHeld = True, sprintHeld = True}
  | Just k <- first [k | k <- worldKin w, kinBond k == 0] = befriend k
  | not (worldChosenCycle w) = idleInput {callNightEdge = True}
  | worldChapter w /= Nightfall = idleInput
  | Just k <- first [k | k <- worldKin w, not (kinSheltered k)] = shelter k
  | otherwise = idleInput
  where
    p = worldPlayer w
    feet = playerFeet p
    inventory = worldInventory w
    V3 _ altitude _ = feet
    first [] = Nothing
    first (a : _) = Just a
    befriend k
      | M.findWithDefault 0 (kinGem k) (gems inventory) == 0 = gather (kinGem k)
      | distance feet (kinPosition k) > 3.1 = towards (kinPosition k)
      | not (lampNear w (kinPosition k)) = installLamp k
      | otherwise = (aim (plus (kinPosition k) (V3 0 1.8 0))) {interactEdge = True}
    shelter k
      | distance feet (kinPosition k) > 3.1 = towards (kinPosition k)
      | not (lampNear w (kinPosition k)) = installLamp k
      | otherwise = (aim (plus (kinPosition k) (V3 0 1.8 0))) {interactEdge = True}
    installLamp k = (aim ground) {slotEdge = Just 2, placeHeld = True}
      where
        V3 x _ z = kinPosition k
        ground = V3 (x + 1) (fromIntegral (heightAt (floor x + 1) (floor z)) + 0.5) z
    gather gem = case sources gem of
      [] -> idleInput
      c : _
        | distance (eye p) (center c) > 5.4 -> towards (center c)
        | otherwise -> (aim (center c)) {mineHeld = True}
    sources gem =
      sortOn
        (distance (eye p) . center)
        [c | x <- [cx - 3 .. cx + 3], z <- [cz - 3 .. cz + 3], y <- [0 .. 15], let c = Cell x y z, M.lookup c (worldCells w) == Just (Ore gem)]
      where
        (cx, cz) = case gem of Jade -> (-9, -9); Rose -> (20, 14); Azure -> (-20, 28); Honey -> (33, -3)
    towards target = (aim target) {moveForward = if horizontal > 1.1 then 1 else 0, sprintHeld = True}
      where
        V3 dx _ dz = minus target feet; horizontal = sqrt (dx * dx + dz * dz)
    aim target = idleInput {lookYaw = angle - playerYaw p, lookPitch = pitch - playerPitch p}
      where
        V3 x y z = minus target (eye p)
        angle = atan2 x z
        pitch = atan2 y (sqrt (x * x + z * z))
