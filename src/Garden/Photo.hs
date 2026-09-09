module Garden.Photo
  ( Photo (..),
    Grade (..),
    PhotoInput (..),
    beginPhoto,
    stepPhoto,
    photoForward,
    photoBasis,
    gradeName,
  )
where

import Garden.Types

data Grade = Original | Amber | Moon | Silver deriving (Eq, Show, Enum, Bounded)

-- A photograph has its own camera; it cannot write a position into the world.
data Photo = Photo
  { photoEye :: V3,
    photoYaw :: Float,
    photoPitch :: Float,
    photoRoll :: Float,
    photoFov :: Float,
    photoExposure :: Float,
    photoGrade :: Grade,
    photoBloom :: Bool,
    photoVignette :: Bool,
    photoGrid :: Bool,
    photoCinema :: Bool
  }
  deriving (Eq, Show)

data PhotoInput = PhotoInput
  { photoMove :: V3,
    photoLook :: (Float, Float),
    photoZoom :: Float,
    photoTilt :: Float,
    photoLight :: Float,
    photoGradeStep :: Int,
    toggleBloom :: Bool,
    toggleVignette :: Bool,
    toggleGrid :: Bool,
    toggleCinema :: Bool
  }
  deriving (Eq, Show)

beginPhoto :: V3 -> V3 -> Photo
beginPhoto position (V3 x y z) = Photo position (atan2 x z) (asin (clamp (-1) 1 y)) 0 68 0 Original True True True False

photoForward :: Photo -> V3
photoForward p = V3 (sin (photoYaw p) * cos (photoPitch p)) (sin (photoPitch p)) (cos (photoYaw p) * cos (photoPitch p))

photoBasis :: Float -> V3 -> (V3, V3)
photoBasis roll f@(V3 x _ z) = (plus (scale (cos roll) r) (scale (sin roll) u), plus (scale (cos roll) u) (scale (-sin roll) r))
  where
    r = unit (V3 (-z) 0 x)
    u = cross r f
    cross (V3 a b c) (V3 d e g) = V3 (b * g - c * e) (c * d - a * g) (a * e - b * d)

stepPhoto :: Float -> PhotoInput -> Photo -> Photo
stepPhoto elapsed input p =
  p
    { photoEye = plus (photoEye p) (scale dt travel),
      photoYaw = photoYaw p + dx,
      photoPitch = clamp (-1.53) 1.53 (photoPitch p + dy),
      photoRoll = clamp (-pi) pi (photoRoll p + photoTilt input * dt * 0.7),
      photoFov = clamp 20 100 (photoFov p - photoZoom input * 3),
      photoExposure = clamp (-2) 2 (photoExposure p + photoLight input * dt),
      photoGrade = toEnum ((fromEnum (photoGrade p) + photoGradeStep input) `mod` 4),
      photoBloom = photoBloom p /= toggleBloom input,
      photoVignette = photoVignette p /= toggleVignette input,
      photoGrid = photoGrid p /= toggleGrid input,
      photoCinema = photoCinema p /= toggleCinema input
    }
  where
    dt = clamp 0 0.05 elapsed
    (dx, dy) = photoLook input
    V3 side rise advance = photoMove input
    (right, _) = photoBasis 0 (photoForward p)
    travel = plus (plus (scale side right) (V3 0 rise 0)) (scale advance (photoForward p))

gradeName :: Grade -> String
gradeName Original = "原色"
gradeName Amber = "琥珀"
gradeName Moon = "月光"
gradeName Silver = "銀塩"
