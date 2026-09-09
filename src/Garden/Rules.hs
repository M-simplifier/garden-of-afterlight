module Garden.Rules (advance, bonded, sheltered, lampNear, canCallNight) where

import Data.List (minimumBy)
import Data.Map.Strict qualified as M
import Data.Ord (comparing)
import Garden.Raycast
import Garden.Types
import Garden.World

advance :: Input -> World -> (World, [Cue])
advance input before
  | worldChapter before == Lost = (before, [])
  | otherwise =
      let Tick oldTick = worldTick before
          tick = Tick (oldTick + 1)
          base = before {worldTick = tick, worldCooldown = max 0 (worldCooldown before - 1), worldBursts = filter (\b -> tickAge tick (burstBorn b) < 90) (worldBursts before)}
          (moved, moveCues) = movement input base
          timed = passingTime moved
          (acted, actionCues) = action input timed
          (threatened, enemyCues) = enemiesAdvance acted
          (settled, phaseCues) = settle threatened
          cues = moveCues <> actionCues <> enemyCues <> phaseCues
       in (settled, cues)

movement :: Input -> World -> (World, [Cue])
movement input w = (if dashStart then emit Dash feet changed else changed, [Jump | launch] <> [Dash | dashStart])
  where
    changed = w {worldPlayer = next}
    p = worldPlayer w
    feet@(V3 x y z) = playerFeet p
    yaw = playerYaw p + lookYaw input
    pitch = clamp (-1.45) 1.45 (playerPitch p + lookPitch input)
    (f, r) = planarBasis yaw
    desired = plus (scale (moveForward input) f) (scale (moveSide input) r)
    desiredClamped = scale (1 / max 1 (magnitude desired)) desired
    speed = if worldFlight w && playerMotion p == Flying then if sprintHeld input then 17 else 10 else if sprintHeld input then 7.8 else 5.0
    target = scale speed desiredClamped
    acceleration = if magnitude desired > 0 then 46 else 62
    dashStart = dodgeEdge input && playerDashCooldown p == 0
    dashTicks = if dashStart then 10 else max 0 (playerDashTicks p - 1)
    dashDirection = if dashStart then if magnitude desired > 0 then unit desired else f else playerDashDirection p
    velocity = if dashTicks > 0 then scale 17 dashDirection else approach (acceleration * fixedDt) (playerVelocity p) target
    V3 vx _ vz = velocity
    grounded = not (bodyClear (worldCells w) (plus feet (V3 0 (-0.055) 0)))
    coyote = if grounded then 7 else max 0 (playerCoyote p - 1)
    buffered = if jumpEdge input then 8 else max 0 (playerJumpBuffer p - 1)
    flying = worldFlight w && (playerMotion p == Flying || jumpHeld input)
    launch = not flying && coyote > 0 && buffered > 0
    initialVy = case playerMotion p of Airborne v -> v; _ -> 0
    vy = if launch then 8.7 else initialVy - (if jumpHeld input && initialVy > 0 then 17 else 25) * fixedDt
    groundMove candidate current
      | bodyClear cells candidate = candidate
      | grounded && bodyClear cells (plus candidate (V3 0 1.02 0)) = plus candidate (V3 0 1.02 0)
      | otherwise = current
    cells = worldCells w
    afterX = groundMove (V3 (x + vx * fixedDt) y z) feet
    V3 xx yy _ = afterX
    planar = groundMove (V3 xx yy (z + vz * fixedDt)) afterX
    vertical = if flying then ((if jumpHeld input then 1 else 0) - (if descendHeld input then 1 else 0)) * speed * fixedDt else vy * fixedDt
    finalFeet = moveVertical cells planar vertical
    blockedVertical = abs (distance planar finalFeet - abs vertical) > 0.001
    landed = vertical < 0 && blockedVertical
    newMotion | flying = Flying | landed = Grounded | blockedVertical = Airborne 0 | otherwise = Airborne vy
    next =
      p
        { playerFeet = finalFeet,
          playerYaw = yaw,
          playerPitch = pitch,
          playerMotion = newMotion,
          playerSlot = maybe (playerSlot p) (clamp 0 (length hotbar - 1)) (slotEdge input),
          playerVelocity = velocity,
          playerCoyote = if launch then 0 else coyote,
          playerJumpBuffer = if launch then 0 else buffered,
          playerDashTicks = dashTicks,
          playerDashCooldown = if dashStart then 65 else max 0 (playerDashCooldown p - 1),
          playerDashDirection = dashDirection
        }

approach :: Float -> V3 -> V3 -> V3
approach amount current target = let delta = minus target current; n = magnitude delta in if n <= amount then target else plus current (scale (amount / n) delta)

moveVertical :: M.Map Cell Material -> V3 -> Float -> V3
moveVertical cells feet delta = walk steps feet
  where
    steps = max 1 (ceiling (abs delta / 0.18) :: Int)
    increment = V3 0 (delta / fromIntegral steps) 0
    walk 0 p = p
    walk n p
      | bodyClear cells candidate = walk (n - 1) candidate
      | otherwise = fit 9 p candidate
      where
        candidate = plus p increment
    fit :: Int -> V3 -> V3 -> V3
    fit 0 safe _ = safe
    fit n safe blocked =
      let mid = scale 0.5 (plus safe blocked)
       in if bodyClear cells mid then fit (n - 1) mid blocked else fit (n - 1) safe mid

passingTime :: World -> World
passingTime w
  | worldRestored w = w {worldVeil = max 0 (worldVeil w - 0.004)}
  | otherwise = w {worldVeil = veil, worldChapter = chapter, worldLife = max 0 (worldLife w - drain)}
  where
    veil = clamp 0 1 (worldVeil w + if worldChosenCycle w then 0.00085 else 1 / (60 * 1100))
    chapter | veil >= 0.74 = Nightfall | veil >= 0.4 = LongDusk | otherwise = FirstLight
    drain = (if chapter == Nightfall then 0.18 else 0.045) * fixedDt

action :: Input -> World -> (World, [Cue])
action input w
  | chargeEdge input = useCharge w
  | craftEdge input = craftLamp w
  | callNightEdge input && canCallNight w = (announce SkyChanging (w {worldJourney = NightInvited, worldVeil = max 0.4 (worldVeil w)}), [Dusk])
  | interactEdge input = interactNearby w
  | worldCooldown w > 0 = (w, [])
  | mineHeld input = case aimedEnemy w of
      Just enemy -> attack enemy w
      Nothing -> mine w
  | placeHeld input = place w
  | otherwise = (w, [])

mine :: World -> (World, [Cue])
mine w = case raycast w 7 of
  Nothing -> (w, [])
  Just hit ->
    let material = hitMaterial hit
        inv = worldInventory w
        (newInv, cue, notice) = case material of
          Ore g -> (inv {gems = M.insertWith (+) g 1 (gems inv)}, Jewel, Found g)
          m -> (inv {blocks = M.insertWith (+) m 1 (blocks inv)}, Mine, NoNotice)
        next = emit cue (center (hitCell hit)) (editCell (hitCell hit) Nothing w {worldInventory = newInv, worldCooldown = 12})
     in (if notice == NoNotice then next else announce notice next, [cue])

place :: World -> (World, [Cue])
place w = case raycast w 7 of
  Nothing -> (w, [])
  Just hit
    | hitPrevious hit == hitCell hit || hitPrevious hit `elem` bodyCells (playerFeet (worldPlayer w)) -> (announce CannotBuild w, [])
    | M.member (hitPrevious hit) (worldCells w) -> (w, [])
    | materialCount inv m <= 0 -> (announce (NeedMaterial m) w, [])
    | otherwise -> (emit Build (center (hitPrevious hit)) $ editCell (hitPrevious hit) (Just m) w {worldInventory = consume m inv, worldCooldown = 13}, [Build])
    where
      m = slotMaterial (playerSlot (worldPlayer w))
      inv = worldInventory w
      consume (Ore g) inventory = inventory {gems = decrement g (gems inventory)}
      consume material inventory = inventory {blocks = decrement material (blocks inventory)}

interactNearby :: World -> (World, [Cue])
interactNearby w = case nearby of
  [] -> (w, [])
  ks -> let k = minimumBy (comparing (distance feet . kinPosition)) ks in interactKin k w
  where
    feet = playerFeet (worldPlayer w); nearby = filter ((< 4) . distance feet . kinPosition) (worldKin w)

interactKin :: Kin -> World -> (World, [Cue])
interactKin k w
  | worldChapter w == Nightfall && kinBond k >= 2 && not (kinSheltered k) && lampNear w (kinPosition k) =
      let changed = replaceKin (k {kinSheltered = True}) w
          takeFlight = all kinSheltered (worldKin changed)
          next =
            changed
              { worldLife = min 100 (worldLife w + 22),
                worldJourney = if takeFlight then Lightborne else worldJourney w,
                worldAdversaries =
                  worldAdversaries w
                    <> [ Adversary (10 + i) pos 3 0 100 SkyMoth
                       | takeFlight,
                         (i, pos) <- zip [0 ..] [V3 (-12) 27 42, V3 14 39 58, V3 (-15) 56 60, V3 12 68 52]
                       ]
              }
       in (emit Offering (kinPosition k) (announce (if takeFlight then FlightGranted else KinSaved) next), if takeFlight then [Offering, Wings] else [Offering])
  | otherwise = case pickGem of
      Nothing -> (announce (NeedGem (kinGem k)) w, [])
      Just g ->
        let changed = replaceKin (k {kinBond = kinBond k + if g == kinGem k then 2 else 1}) w
            next = changed {worldInventory = inv {gems = decrement g (gems inv), charges = charges inv + 1}, worldLife = min 100 (worldLife w + 14)}
         in (emit Offering (kinPosition k) (announce (GiftAccepted g) next), [Offering])
  where
    inv = worldInventory w
    pickGem = case [g | g <- kinGem k : filter (/= kinGem k) [Jade, Rose, Azure, Honey], M.findWithDefault 0 g (gems inv) > 0] of g : _ -> Just g; [] -> Nothing

replaceKin :: Kin -> World -> World
replaceKin k w = w {worldKin = map (\old -> if kinId old == kinId k then k else old) (worldKin w)}

decrement :: (Ord a) => a -> M.Map a Int -> M.Map a Int
decrement key = M.update (\n -> if n <= 1 then Nothing else Just (n - 1)) key

craftLamp :: World -> (World, [Cue])
craftLamp w = case [g | g <- [Jade, Rose, Azure, Honey], M.findWithDefault 0 g (gems inv) > 0] of
  g : _
    | M.findWithDefault 0 Pearl (blocks inv) >= 2 ->
        (announce Crafted w {worldInventory = inv {gems = decrement g (gems inv), blocks = M.insertWith (+) Luminous 4 (decrement Pearl (decrement Pearl (blocks inv)))}}, [Jewel])
  _ -> (announce NeedCraft w, [])
  where
    inv = worldInventory w

useCharge :: World -> (World, [Cue])
useCharge w
  | charges inv > 0 && worldLife w < 98 = (announce LightUsed w {worldInventory = inv {charges = charges inv - 1}, worldLife = min 100 (worldLife w + 38)}, [Offering])
  | otherwise = (w, [])
  where
    inv = worldInventory w

bonded :: World -> Int
bonded = length . filter ((>= 2) . kinBond) . worldKin

sheltered :: World -> Int
sheltered = length . filter kinSheltered . worldKin

canCallNight :: World -> Bool
canCallNight w = bonded w == 3 && not (worldChosenCycle w) && not (worldRestored w)

lampNear :: World -> V3 -> Bool
lampNear w (V3 x y z) =
  any
    (\c -> M.lookup c (worldCells w) == Just Luminous)
    [Cell a b c | a <- [floor x - 4 .. floor x + 4], c <- [floor z - 4 .. floor z + 4], b <- [floor y - 2 .. floor y + 3]]

attack :: Adversary -> World -> (World, [Cue])
attack enemy w = (emit Strike (plus (adversaryPosition enemy) (V3 0 1 0)) w {worldAdversaries = survivors, worldCooldown = 18}, [Strike])
  where
    damage = case playerMotion (worldPlayer w) of Airborne _ -> 2; _ -> 1
    hit a
      | adversaryId a == adversaryId enemy =
          let knocked = plus (adversaryPosition a) (scale 0.8 (unit (minus (adversaryPosition a) (playerFeet (worldPlayer w)))))
           in a
                { adversaryHealth = adversaryHealth a - damage,
                  adversaryWindup = 0,
                  adversaryCooldown = 55,
                  adversaryPosition = if bodyClear (worldCells w) knocked then knocked else adversaryPosition a
                }
      | otherwise = a
    survivors = filter ((> 0) . adversaryHealth) (map hit (worldAdversaries w))

enemiesAdvance :: World -> (World, [Cue])
enemiesAdvance w
  | worldRestored w = (w {worldAdversaries = []}, [])
  | otherwise = (damaged {worldAdversaries = map fst updates}, [Wound | hits > 0])
  where
    feet = playerFeet (worldPlayer w)
    protected = worldChapter w == Nightfall && lampNear w feet
    updates = map stepEnemy (worldAdversaries w)
    hits :: Int
    hits = sum (map snd updates)
    damaged = if hits == 0 then w else emit Wound feet w {worldLife = max 0 (worldLife w - fromIntegral hits * 12)}
    stepEnemy a
      | adversaryWindup a > 0 =
          let timer = adversaryWindup a - 1; hitNow = timer == 0 && distance feet pos < radius && not protected && playerDashTicks (worldPlayer w) == 0
           in (a {adversaryWindup = timer, adversaryCooldown = if timer == 0 then 100 else adversaryCooldown a}, if hitNow then 1 else 0)
      | d < radius - 0.1 && cool == 0 && not protected = (a {adversaryWindup = windup}, 0)
      | (d < 13 || worldChapter w == Nightfall) && d > radius - 0.8 && not protected =
          let V3 ax ay az = pos
              V3 px py pz = feet
              v = unit (V3 (px - ax) (if aerial then py - ay else 0) (pz - az))
              candidate = plus pos (scale (fixedDt * pace) v)
              ground = groundBelow (worldCells w) (plus candidate (V3 0 1.1 0))
              V3 nx _ nz = candidate
              next
                | aerial = if bodyClear (worldCells w) candidate then candidate else pos
                | ground > (-10) && abs (ground - ay) < 1.2 && bodyClear (worldCells w) (V3 nx ground nz) = V3 nx ground nz
                | otherwise = pos
           in (a {adversaryPosition = next, adversaryCooldown = cool}, 0)
      | otherwise = (a {adversaryCooldown = cool}, 0)
      where
        pos = adversaryPosition a
        d = distance feet pos
        cool = max 0 (adversaryCooldown a - 1)
        aerial = adversaryKind a == SkyMoth
        (pace, radius, windup) = case adversaryKind a of
          Wanderer -> (2.6, 2.9, 38)
          Custodian -> (1.8, 3.9, 58)
          Skitter -> (4.2, 2.4, 25)
          SkyMoth -> (5.4, 3.1, 44)

settle :: World -> (World, [Cue])
settle w
  | y < (-64) =
      ( announce
          Welcome
          w
            { worldPlayer = p {playerFeet = V3 0.5 4.05 (-39.5), playerMotion = Grounded, playerVelocity = V3 0 0 0},
              worldLife = if worldRestored w then 100 else max 1 (worldLife w - 12),
              worldInventory = if worldRestored w then Inventory M.empty M.empty 0 else worldInventory w
            },
        [Wound]
      )
  | worldLife w <= 0 && worldRestored w = (announce Returned w {worldLife = 100, worldPlayer = p {playerFeet = V3 0.5 4.05 (-31.5), playerMotion = Grounded, playerVelocity = V3 0 0 0, playerDashTicks = 0}, worldInventory = Inventory M.empty M.empty 0}, [Return])
  | worldLife w <= 0 = (announce Slain w {worldChapter = Lost}, [])
  | worldFlight w && not (worldRestored w) && y > 64 && distance (V3 x 54 z) (V3 0 54 54) < 12 =
      (emit Return (eye p) $ announce Returned w {worldJourney = GardenRenewed, worldChapter = Homecoming, worldLife = 100, worldPlayer = p {playerFeet = V3 0.5 7 46, playerMotion = Grounded, playerVelocity = V3 0 0 0, playerYaw = pi, playerPitch = 0.05, playerDashTicks = 0}}, [Return])
  | otherwise = (w, [])
  where
    p = worldPlayer w; V3 x y z = playerFeet p

emit :: Cue -> V3 -> World -> World
emit cue origin w = w {worldBursts = take 24 (Burst origin cue (worldTick w) : worldBursts w)}

announce :: Notice -> World -> World
announce notice w = let Tick t = worldTick w in w {worldNotice = notice, worldNoticeUntil = Tick (t + 260)}
