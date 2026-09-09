module Main (main) where

import Control.Monad (unless)
import Data.List (foldl')
import Data.Map.Strict qualified as M
import Data.Set qualified as S
import FRP.Yampa (embed)
import Garden.Change qualified as Change
import Garden.Checkpoint
import Garden.Clock
import Garden.Islands (islandHarbours)
import Garden.Mesh (ornamentGeometry, terrainGeometry)
import Garden.Photo
import Garden.Raycast
import Garden.Render.Invalidation (changedSince, dirtyFor)
import Garden.Rules
import Garden.Signal
import Garden.Soundscape (cueLength, cueSignal)
import Garden.Tour
import Garden.Types
import Garden.World
import System.Exit (exitFailure)
import Test.QuickCheck hiding (label, scale)

main :: IO ()
main = do
  legacy <- readFile "tools/fixtures/garden-v3.txt"
  check "frozen v3 save migrates and survives v4 resaving" $ case decode legacy of
    Right loaded -> normal loaded == normal editedGarden && decode (encode loaded) == Right loaded
    Left _ -> False
  check "skipped render frames retain edits and removal tombstones" invalidationLaw
  changeResult <- quickCheckWithResult stdArgs {maxSuccess = 200} changeLaws
  unless (isSuccess changeResult) exitFailure
  putStrLn ("Authored cells=" <> show (M.size landscape) <> " chunks=" <> show (S.size (S.fromList (map chunkOf (M.keys landscape)))))
  check "screen-right points to negative X" $ let (_, r) = planarBasis 0 in r == V3 (-1) 0 0
  check "positive X ray" (rayCase (V3 0.5 0 0.5) (pi / 2) (Cell 4 1 0) (Cell 3 1 0))
  check "negative X ray" (rayCase (V3 0.5 0 0.5) (-pi / 2) (Cell (-4) 1 0) (Cell (-3) 1 0))
  check "positive Z ray" (rayCase (V3 0.5 0 0.5) 0 (Cell 0 1 4) (Cell 0 1 3))
  check "negative Z ray" (rayCase (V3 0.5 0 0.5) pi (Cell 0 1 (-4)) (Cell 0 1 (-3)))
  check "mine then replace conserves matter" miningLaw
  check "all twelve building materials conserve blocks or gems" (all materialLaw (zip [0 ..] hotbar))
  check "cannot place a block inside the body" bodyPlacement
  check "one-second stall retains all sixty ticks" clockDebt
  check "edges survive a frame without a tick" edgeLaw
  check "Yampa gift envelope expires after 95 semantic ticks" envelopeLaw
  check "checkpoint retains edits and progress" checkpointLaw
  check "truncated checkpoint rejected" (case decode "Checkpoint 2 [" of Left _ -> True; _ -> False)
  check "craft conserves its declared ingredients" craftLaw
  check "restored death respawns and loses inventory" respawnLaw
  check "photo camera axes stay orthonormal across tilt and roll" photoBasisLaw
  check "photo lens and exposure stay bounded under repeated input" photoBoundsLaw
  result <- quickCheckWithResult stdArgs {maxSuccess = 160, maxSize = 100} collisionLaw
  unless (isSuccess result) exitFailure
  result2 <- quickCheckWithResult stdArgs {maxSuccess = 120} replayLaw
  unless (isSuccess result2) exitFailure
  result3 <- quickCheckWithResult stdArgs {maxSuccess = 70} dirtyClosureLaw
  unless (isSuccess result3) exitFailure
  check "all remote islands support landing" remoteLandingLaw
  check "sound effects remain below clipping" soundLaw
  journey <- runJourney 0 initialWorld ""
  check "ordinary inputs complete the authored journey" (worldRestored journey)
  check "player-built lamps survive the return" (worldRevision journey >= 6 && length [() | (_, Luminous) <- M.toList (M.difference (worldCells journey) landscape)] >= 3)
  (pilot, explored) <- runExpedition 0 (Pilot 0 0) journey
  check "fly to all four islands and build on each through ordinary inputs" (expeditionDone pilot && worldRevision explored >= worldRevision journey + 4)
  putStrLn "All garden checks passed."

editedGarden :: World
editedGarden = editCell (Cell 9 30 9) (Just Gold) (editCell (Cell 0 3 (-30)) Nothing initialWorld)

invalidationLaw :: Bool
invalidationLaw =
  changedSince 0 (worldEdits removed) == S.union (dirtyFor a) (dirtyFor b)
    && changedSince 2 (worldEdits removed) == dirtyFor a
    && changedSince 3 (worldEdits removed) == S.empty
    && M.notMember a (worldCells removed)
    && normal restarted == normal initialWorld
    && dirtyFor b `S.isSubsetOf` changedSince 3 (worldEdits restarted)
    && changedSince 0 (worldEdits restarted) == S.union (dirtyFor a) (dirtyFor b)
  where
    a = Cell 100 80 100
    b = Cell (-100) 80 (-100)
    removed = editCell a Nothing (editCell b (Just Gold) (editCell a (Just Pearl) initialWorld))
    restarted = restartWorld removed

changeLaws :: [Int] -> [Int] -> [Int] -> Property
changeLaws xs ys zs =
  conjoin
    [ Change.apply (a <> b) before === Change.apply b (Change.apply a before),
      (a <> b) <> c === a <> (b <> c),
      mempty <> a === a,
      a <> mempty === a,
      Change.apply mempty before === before,
      Change.apply delta before === after,
      Change.between before before === mempty,
      Change.fromEntries (Change.entries a) === a,
      M.keysSet (M.fromList (Change.entries delta)) === changedCells,
      Change.apply (Change.place cell Gold <> Change.remove cell) before === M.delete cell before,
      Change.apply (Change.remove cell <> Change.place cell Gold) before === M.insert cell Gold before
    ]
  where
    cell = Cell 0 0 0
    make = Change.fromEntries . map (\n -> (Cell (n `mod` 7) 0 ((n `div` 7) `mod` 7), if n `mod` 3 == 0 then Nothing else Just (if even n then Pearl else Gold)))
    a = make xs
    b = make ys
    c = make zs
    before = Change.apply c M.empty
    after = Change.apply (a <> b) before
    delta = Change.between before after
    changedCells = M.keysSet (M.filterWithKey (\key _ -> M.lookup key before /= M.lookup key after) (M.union before after))

photoBasisLaw :: Bool
photoBasisLaw =
  and
    [ abs (magnitude r - 1) < 0.0001
        && abs (magnitude u - 1) < 0.0001
        && abs (dot f r) < 0.0001
        && abs (dot f u) < 0.0001
        && abs (dot r u) < 0.0001
    | yaw <- [-3, -1, 0, 1, 3],
      pitch <- [-1.4, -0.3, 0, 0.8, 1.4],
      roll <- [-pi, -0.6, 0, 1, pi],
      let p = (beginPhoto (V3 0 0 0) (V3 0 0 1)) {photoYaw = yaw, photoPitch = pitch},
      let f = photoForward p,
      let (r, u) = photoBasis roll f
    ]

photoBoundsLaw :: Bool
photoBoundsLaw =
  and
    [ photoFov p >= 20 && photoFov p <= 100 && abs (photoExposure p) <= 2 && abs (photoPitch p) <= 1.53
    | sign <- [-1, 1],
      let input = PhotoInput (V3 0 0 0) (0, sign) (100 * sign) sign (100 * sign) (-1) False False False False,
      p <- take 150 (tail (iterate (stepPhoto 0.02 input) (beginPhoto (V3 0 0 0) (V3 0 0 1))))
    ]

runExpedition :: Int -> Pilot -> World -> IO (Pilot, World)
runExpedition n pilot w
  | expeditionDone pilot || n >= 18000 = do
      putStrLn ("Expedition " <> show n <> " " <> show pilot <> " feet=" <> show (playerFeet (worldPlayer w)))
      pure (pilot, w)
  | otherwise = do
      let (nextPilot, input) = expeditionInput pilot w
      unless (nextPilot == pilot) (putStrLn ("Expedition " <> show n <> " " <> show nextPilot <> " feet=" <> show (playerFeet (worldPlayer w))))
      runExpedition (n + 1) nextPilot (fst (advance input w))

dirtyClosureLaw :: Int -> Property
dirtyClosureLaw seed =
  counterexample ("missed cache dependency at " <> show edit) $
    all (\c -> packet before c == packet after c || chunkOf c `S.member` dirtyFor edit) candidates
  where
    edit = Cell (seed `mod` 7 - 3) (seed `mod` 9) ((seed `div` 7) `mod` 7 - 3)
    before =
      M.fromList
        [ (Cell x y z, if (x + z) `mod` 4 == 0 then Moss else Pearl)
        | x <- [-5 .. 5],
          y <- [-2 .. 9],
          z <- [-5 .. 5],
          (x * 31 + y * 11 + z * 17 + seed) `mod` 5 < 2
        ]
    after = if even seed then M.insert edit Luminous before else M.delete edit before
    candidates = M.keys (M.union before after)
    packet cells c = case M.lookup c cells of
      Nothing -> []
      Just m -> terrainGeometry cells [(c, m)] <> ornamentGeometry cells [(c, m)]

remoteLandingLaw :: Bool
remoteLandingLaw = all supports islandHarbours
  where
    supports (_, V3 x h z) =
      let start =
            initialWorld
              { worldJourney = GardenRenewed,
                worldChapter = Homecoming,
                worldPlayer = (worldPlayer initialWorld) {playerFeet = V3 x (h + 8) z, playerMotion = Flying}
              }
          end = iterate (fst . advance idleInput {descendHeld = True}) start !! 120
          feet@(V3 _ y _) = playerFeet (worldPlayer end)
       in y > h - 7
            && y < h + 1
            && bodyClear (worldCells end) feet
            && not (bodyClear (worldCells end) (plus feet (V3 0 (-0.08) 0)))

soundLaw :: Bool
soundLaw =
  all
    (< 0.99)
    [ abs (cueSignal cue channel (fromIntegral i / 16000))
    | cue <- [Mine, Build, Jewel, Offering, Wound, Jump, Strike, Dusk, Wings, Return, Dash],
      channel <- [0, 1],
      i <- [0 .. floor (cueLength cue * 16000) :: Int]
    ]

check :: String -> Bool -> IO ()
check label ok = if ok then putStrLn ("PASS " <> label) else putStrLn ("FAIL " <> label) >> exitFailure

flat :: World
flat =
  initialWorld
    { worldCells = M.fromList [(Cell x 0 z, Pearl) | x <- [-16 .. 16], z <- [-16 .. 16]],
      worldAdversaries = [],
      worldPlayer = (worldPlayer initialWorld) {playerFeet = V3 0.5 1 0.5, playerYaw = 0, playerPitch = 0}
    }

rayCase :: V3 -> Float -> Cell -> Cell -> Bool
rayCase pos yaw hit previous = case raycast w 8 of
  Just h -> hitCell h == hit && hitPrevious h == previous
  _ -> False
  where
    w = flat {worldCells = M.singleton hit Pearl, worldPlayer = (worldPlayer flat) {playerFeet = pos, playerYaw = yaw}}

miningLaw :: Bool
miningLaw = worldCells restored == worldCells original && blocks (worldInventory restored) == blocks (worldInventory original)
  where
    original = flat {worldCells = M.insert (Cell 0 2 3) Gold (M.insert (Cell 0 2 4) Pearl (worldCells flat)), worldPlayer = (worldPlayer flat) {playerSlot = 1}}
    mined = fst (advance idleInput {mineHeld = True} original)
    restored = fst (advance idleInput {placeHeld = True} mined {worldCooldown = 0})

materialLaw :: (Int, Material) -> Bool
materialLaw (slot, m) = worldCells restored == worldCells original && worldInventory restored == worldInventory original
  where
    original = flat {worldCells = M.insert (Cell 0 2 3) m (M.insert (Cell 0 2 4) Pearl (worldCells flat)), worldPlayer = (worldPlayer flat) {playerSlot = slot}}
    mined = fst (advance idleInput {mineHeld = True} original)
    restored = fst (advance idleInput {placeHeld = True} mined {worldCooldown = 0})

bodyPlacement :: Bool
bodyPlacement = worldCells after == worldCells original
  where
    original = flat {worldCells = M.insert (Cell 0 2 1) Pearl (worldCells flat)}
    after = fst (advance idleInput {placeHeld = True} original)

clockDebt :: Bool
clockDebt = length allInputs == 60
  where
    (first, clock) = schedule 1 idleInput emptyClock
    (allInputs, _) = foldl' (\(xs, c) _ -> let (ys, d) = schedule 0 idleInput c in (xs <> ys, d)) (first, clock) [1 .. 12 :: Int]

edgeLaw :: Bool
edgeLaw = null a && length (filter jumpEdge b) == 1 && abs (sum (map lookYaw b) - 0.4) < 0.00001
  where
    (a, c) = schedule 0.001 idleInput {jumpEdge = True, lookYaw = 0.4} emptyClock
    (b, _) = schedule 0.05 idleInput c

envelopeLaw :: Bool
envelopeLaw = case embed lightEnvelope ([Offering], replicate 96 (1 / 60, Just [])) of
  first : rest -> first == 1 && all (>= 0) rest && last rest == 0
  _ -> False

normal :: World -> World
normal w = w {worldRevision = 0, worldEdits = M.empty, worldBursts = []}

checkpointLaw :: Bool
checkpointLaw = case decode (encode w) of Right loaded -> normal loaded == normal w; _ -> False
  where
    w = editCell (Cell 9 30 9) (Just Gold) (editCell (Cell 0 3 (-30)) Nothing initialWorld)

craftLaw :: Bool
craftLaw = M.lookup Jade (gems inv) == Nothing && M.lookup Pearl (blocks inv) == Just 34 && M.lookup Luminous (blocks inv) == Just 12
  where
    w = flat {worldInventory = (worldInventory flat) {gems = M.singleton Jade 1}}
    inv = worldInventory (fst (advance idleInput {craftEdge = True} w))

respawnLaw :: Bool
respawnLaw = worldLife after == 100 && M.null (blocks (worldInventory after)) && worldRestored after
  where
    after = fst (advance idleInput flat {worldLife = 0, worldJourney = GardenRenewed, worldChapter = Homecoming})

collisionLaw :: [Int] -> Property
collisionLaw commands = counterexample (show (playerFeet (worldPlayer end))) $ all safe states
  where
    start = flat {worldCells = M.union (M.fromList [(Cell 3 y z, Gold) | y <- [1 .. 5], z <- [-8 .. 8]]) (worldCells flat)}
    states = take 160 (scanl (\w n -> fst (advance (command n) w)) start commands)
    end = last states
    safe w = bodyClear (worldCells w) (playerFeet (worldPlayer w)) && finiteV (playerFeet (worldPlayer w))
    finiteV (V3 x y z) = all (\v -> not (isNaN v || isInfinite v)) [x, y, z]
    command n = idleInput {moveForward = fromIntegral (n `mod` 3 - 1), moveSide = fromIntegral ((n `div` 3) `mod` 3 - 1), jumpEdge = n `mod` 7 == 0, jumpHeld = n `mod` 2 == 0, dodgeEdge = n `mod` 13 == 0}

replayLaw :: [Bool] -> Bool
replayLaw commands = case decode (encode midway) of
  Right loaded -> normal (run loaded second) == normal uninterrupted
  Left _ -> False
  where
    (first, second) = splitAt 30 (take 80 commands)
    run = foldl' (\w b -> fst (advance idleInput {moveForward = if b then 1 else -1} w))
    midway = run initialWorld first
    uninterrupted = run midway second

runJourney :: Int -> World -> String -> IO World
runJourney n w previous
  | worldRestored w = putStrLn ("Journey returned at tick " <> show n) >> pure w
  | n >= 16000 || worldChapter w == Lost = do
      putStrLn ("Journey stopped at " <> show n <> " " <> tourStage w <> " feet=" <> show (playerFeet (worldPlayer w)) <> " kin=" <> show (worldKin w) <> " inventory=" <> show (worldInventory w))
      pure w
  | otherwise = do
      let stage = tourStage w
      unless (stage == previous) (putStrLn ("Journey " <> show n <> " " <> stage))
      let next = fst (advance (tourInput w) w)
      runJourney (n + 1) next stage
