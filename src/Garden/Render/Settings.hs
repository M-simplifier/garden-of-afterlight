-- | Pure presentation policy. No host handles, environment reads or game rules.
module Garden.Render.Settings
  ( RenderQuality (..), ShadowQuality (..), CloudQuality (..), OcclusionQuality (..),
    RenderSettings (..), RenderPlan (..), preset, nextQuality, qualityName,
    renderPlan, parseSettings, setOption
  ) where

import Text.Read (readMaybe)

data RenderQuality = FullQuality | BalancedQuality | LightQuality deriving (Eq, Show, Enum, Bounded)
data ShadowQuality = NoShadows | SoftShadows | FineShadows deriving (Eq, Show)
data CloudQuality = ClearSky | SoftClouds | SculptedClouds deriving (Eq, Show)
data OcclusionQuality = NoOcclusion | ContactOcclusion | FineOcclusion deriving (Eq, Show)
data RenderSettings = RenderSettings
  { renderQuality :: !RenderQuality, resolutionPercent :: !Int,
    shadows :: !ShadowQuality, clouds :: !CloudQuality,
    occlusion :: !OcclusionQuality, bloom :: !Bool
  } deriving (Eq, Show)

-- All allocations and loop budgets are derived here; disabled effects have no
-- render target. Dimensions use ceiling division, including odd window sizes.
data RenderPlan = RenderPlan
  { sceneSize :: !(Int, Int), skySize :: !(Int, Int), shadowSize :: !(Maybe (Int, Int)),
    effectsSize :: !(Maybe (Int, Int)), bloomSize :: !(Maybe (Int, Int)),
    cloudSteps :: !Int, occlusionSamples :: !Int
  } deriving (Eq, Show)

preset :: RenderQuality -> RenderSettings
preset FullQuality = RenderSettings FullQuality 100 FineShadows SculptedClouds FineOcclusion True
preset BalancedQuality = RenderSettings BalancedQuality 75 SoftShadows SoftClouds ContactOcclusion True
preset LightQuality = RenderSettings LightQuality 50 NoShadows ClearSky NoOcclusion False

nextQuality :: RenderQuality -> RenderQuality
nextQuality FullQuality = BalancedQuality
nextQuality BalancedQuality = LightQuality
nextQuality LightQuality = FullQuality

qualityName :: RenderQuality -> String
qualityName FullQuality = "高画質"
qualityName BalancedQuality = "標準"
qualityName LightQuality = "軽量"

renderPlan :: (Int, Int) -> RenderSettings -> RenderPlan
renderPlan (screenW, screenH) settings = RenderPlan size (divide 2 size) shadow effect glow steps samples
  where
    percent = max 25 (min 100 (resolutionPercent settings))
    requestedW = max 1 (toInteger screenW) * toInteger percent
    requestedH = max 1 (toInteger screenH) * toInteger percent
    divisor = max 100 ((max requestedW requestedH + 4095) `div` 4096)
    size = (fromInteger ((requestedW + divisor - 1) `div` divisor), fromInteger ((requestedH + divisor - 1) `div` divisor))
    divide n (w, h) = ((w + n - 1) `div` n, (h + n - 1) `div` n)
    shadow = case shadows settings of NoShadows -> Nothing; SoftShadows -> Just (1024, 1024); FineShadows -> Just (4096, 2048)
    steps = case clouds settings of ClearSky -> 0; SoftClouds -> 12; SculptedClouds -> 24
    samples = case occlusion settings of NoOcclusion -> 0; ContactOcclusion -> 8; FineOcclusion -> 16
    effect = if samples == 0 then Nothing else Just (divide 2 size)
    glow = if bloom settings then Just (divide 4 size) else Nothing

-- One parser serves native environment overrides and browser controls. Invalid
-- values are rejected rather than silently selecting an expensive preset.
setOption :: String -> String -> RenderSettings -> Either String RenderSettings
setOption key value settings = case (key, value) of
  ("quality", "high") -> Right (preset FullQuality)
  ("quality", "balanced") -> Right (preset BalancedQuality)
  ("quality", "light") -> Right (preset LightQuality)
  ("scale", _) | Just n <- readMaybe value, n >= 25, n <= 100 -> Right settings {resolutionPercent = n}
  ("shadows", "off") -> Right settings {shadows = NoShadows}
  ("shadows", "soft") -> Right settings {shadows = SoftShadows}
  ("shadows", "fine") -> Right settings {shadows = FineShadows}
  ("clouds", "off") -> Right settings {clouds = ClearSky}
  ("clouds", "soft") -> Right settings {clouds = SoftClouds}
  ("clouds", "fine") -> Right settings {clouds = SculptedClouds}
  ("ao", "off") -> Right settings {occlusion = NoOcclusion}
  ("ao", "soft") -> Right settings {occlusion = ContactOcclusion}
  ("ao", "fine") -> Right settings {occlusion = FineOcclusion}
  ("bloom", "on") -> Right settings {bloom = True}
  ("bloom", "off") -> Right settings {bloom = False}
  _ -> Left ("Unknown render option: " <> key <> "=" <> value)

parseSettings :: [(String, String)] -> Either String RenderSettings
parseSettings = foldl apply (Right (preset FullQuality))
  where apply previous (key, value) = previous >>= setOption key value
