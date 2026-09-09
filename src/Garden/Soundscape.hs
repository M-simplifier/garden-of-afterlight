-- | A small deterministic score: glass harmonics above a breathing choir.
-- Signals, envelopes and stereo placement are pure; the host owns the device.
module Garden.Soundscape (Mood (..), ambience, cueSignal, cueLength, wave) where

import Data.ByteString.Builder
import Data.Int (Int16)
import Garden.Types (Cue (..))

data Mood = Sunlit | Veiled deriving (Eq, Show)

type Signal = Double -> Double

ambience :: Mood -> Int -> Signal
ambience mood channel t = edge * (choir + bells + breath)
  where
    side = if channel == 0 then -1 else 1
    edge = min 1 (t / 1.5) * min 1 ((48 - t) / 1.5)
    root = case mood of Sunlit -> 110; Veiled -> 55
    choir =
      sum
        [ 0.045
            / fromIntegral harmonic
            * sin (2 * pi * (root * ratio) * t + side * 0.12 * sin (2 * pi * t / 24))
            * (0.75 + 0.25 * sin (2 * pi * t / 48 + fromIntegral harmonic))
        | (harmonic, ratio) <- zip [1 .. 4 :: Int] [1, 1.5, 2, 3]
        ]
    bells =
      sum
        [ let age = t - fromIntegral i * 3
              frequency = note i
              pan = 0.65 + side * 0.30 * sin (fromIntegral i * 1.7)
           in if age >= 0 && age < 9 then pan * 0.055 * resonance frequency age * exp (-age * 0.64) else 0
        | i <- [0 .. 15 :: Int]
        ]
    note i = case mood of
      Sunlit -> case i `mod` 8 of 0 -> 440; 1 -> 660; 2 -> 550; 3 -> 880; 4 -> 660; 5 -> 990; 6 -> 550; _ -> 440
      Veiled -> case i `mod` 5 of 0 -> 220; 1 -> 311; 2 -> 330; 3 -> 440; _ -> 466
    breath = 0.010 * sin (2 * pi * 41 * t) * sin (2 * pi * 113 * t + side * 0.3) * (0.5 + 0.5 * sin (2 * pi * t / 16))

resonance :: Double -> Signal
resonance hz t =
  min 1 (t / 0.012)
    * (sin (2 * pi * hz * t) + 0.28 * sin (2 * pi * hz * 2.01 * t) * exp (-t * 2) + 0.09 * sin (2 * pi * hz * 4.03 * t) * exp (-t * 5))

cueLength :: Cue -> Double
cueLength cue = case cue of
  Mine -> 0.28
  Build -> 0.38
  Jewel -> 1.4
  Offering -> 2.4
  Wound -> 0.45
  Jump -> 0.38
  Strike -> 0.42
  Dusk -> 3.2
  Wings -> 3.5
  Return -> 4.2
  Dash -> 0.38

cueSignal :: Cue -> Int -> Signal
cueSignal cue channel t = 0.46 * (dry t + 0.19 * delayed 0.12 + 0.09 * delayed 0.29)
  where
    delayed offset = if t >= offset then dry (t - offset) else 0
    dry age = envelope age * body age
    duration = max 0.06 (cueLength cue - 0.29)
    envelope age = min 1 (age / 0.008) * max 0 (1 - age / duration) ^ (2 :: Int)
    pan = if channel == 0 then 0.985 else 1.015
    bell frequencies age = voiced / max 1 weights
      where
        parts = zip [1 :: Int ..] frequencies
        voiced = sum [resonance (f * pan) age / fromIntegral n | (n, f) <- parts]
        weights = sum [1 / fromIntegral n | (n, _) <- parts]
    impact hz age = 0.55 * sin (2 * pi * hz * age) * exp (-age * 12) + 0.18 * noise age * exp (-age * 34)
    noise age = sin (age * 9413) * sin (age * 17331) + 0.4 * sin (age * 31337)
    body age = case cue of
      Mine -> impact 110 age
      Build -> impact 165 age + 0.13 * resonance 660 age
      Jewel -> bell [880, 1320, 1760] age
      Offering -> bell [330, 440, 660, 880] age
      Wound -> impact 73 age + 0.18 * sin (age * 423) * sin (age * 17)
      Jump -> 0.30 * sin (2 * pi * (170 * age + 350 * age * age))
      Dash -> 0.24 * noise age * exp (-age * 7) + 0.2 * sin (2 * pi * (90 * age + 500 * age * age))
      Strike -> impact 82 age + 0.16 * resonance 493 age
      Dusk -> bell [55, 82, 116] age * 0.6
      Wings -> bell [220, 330, 440, 660, 880] age * (0.5 + 0.5 * min 1 (age / 0.8))
      Return -> bell [220, 330, 440, 550, 660, 880] age

-- | Stereo 44.1 kHz PCM. The final clamp protects the device; score tests
-- independently check that authored signals do not rely on clipping.
wave :: Double -> (Int -> Signal) -> Builder
wave duration signal =
  string8 "RIFF"
    <> word32LE (fromIntegral (36 + bytes))
    <> string8 "WAVEfmt "
    <> word32LE 16
    <> word16LE 1
    <> word16LE 2
    <> word32LE 44100
    <> word32LE 176400
    <> word16LE 4
    <> word16LE 16
    <> string8 "data"
    <> word32LE (fromIntegral bytes)
    <> mconcat [int16LE (sample (signal channel (fromIntegral i / 44100))) | i <- [0 .. count - 1], channel <- [0, 1]]
  where
    count = floor (duration * 44100) :: Int
    bytes = count * 4
    sample value = round (max (-1) (min 1 value) * 32760) :: Int16
