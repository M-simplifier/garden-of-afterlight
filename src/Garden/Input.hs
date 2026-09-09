{-# LANGUAGE PatternSynonyms #-}

module Garden.Input (pollInput, pollPhotoInput, readPresses) where

import Garden.Photo
import Garden.Types
import Raylib.Core
import Raylib.Types

-- Press/release may both arrive between two frames. Consume the backend event
-- queue once, rather than infer a press only from two sampled key states.
readPresses :: IO [KeyboardKey]
readPresses = do
  key <- getKeyPressed
  if key == KeyNull then pure [] else (key :) <$> readPresses

pollPhotoInput :: [KeyboardKey] -> IO PhotoInput
pollPhotoInput pressed = do
  let axis positive negative = do
        a <- isKeyDown positive
        b <- isKeyDown negative
        pure ((if a then 1 else 0) - (if b then 1 else 0))
      edge key = key `elem` pressed
  x <- axis KeyD KeyA
  y <- axis KeySpace KeyLeftControl
  z <- axis KeyW KeyS
  tilt <- axis KeyE KeyQ
  light <- axis KeyUp KeyDown
  fast <- isKeyDown KeyLeftShift
  fine <- isKeyDown KeyLeftAlt
  wheel <- getMouseWheelMove
  Vector2 mx my <- getMouseDelta
  let speed = if fine then 1.5 else if fast then 35 else 9
      direction = V3 x y z
      velocity = scale speed (if magnitude direction > 1 then unit direction else direction)
  pure
    ( PhotoInput
        velocity
        (-mx * 0.0018, -my * 0.0018)
        wheel
        tilt
        light
        ((if edge KeyRight || edge KeyTab then 1 else 0) - (if edge KeyLeft then 1 else 0))
        (edge KeyB)
        (edge KeyV)
        (edge KeyG)
        (edge KeyC)
    )

pollInput :: Bool -> Int -> [KeyboardKey] -> IO Input
pollInput invertY currentSlot pressed = do
  let edge key = pure (key `elem` pressed)
  left <- isKeyDown KeyA
  right <- isKeyDown KeyD
  front <- isKeyDown KeyW
  back <- isKeyDown KeyS
  jump <- edge KeySpace
  jumping <- isKeyDown KeySpace
  descend <- isKeyDown KeyLeftControl
  sprint <- isKeyDown KeyLeftShift
  mining <- isMouseButtonDown MouseButtonLeft
  placing <- isMouseButtonDown MouseButtonRight
  use <- edge KeyF
  charge <- edge KeyQ
  craft <- edge KeyC
  night <- edge KeyN
  dodge <- edge KeyE
  wheel <- getMouseWheelMove
  slots <- traverse edge [KeyOne, KeyTwo, KeyThree, KeyFour, KeyFive, KeySix]
  Vector2 mx my <- getMouseDelta
  let slot = case [n | (n, True) <- zip [0 ..] slots] of
        n : _ -> Just (currentSlot `div` 6 * 6 + n)
        []
          | KeyTab `elem` pressed -> Just ((currentSlot + 6) `mod` length hotbar)
          | wheel /= 0 -> Just ((currentSlot - if wheel > 0 then 1 else -1) `mod` length hotbar)
          | otherwise -> Nothing
      axis a b = (if a then 1 else 0) - (if b then 1 else 0)
  pure
    ( Input
        (axis right left)
        (axis front back)
        (-mx * 0.0018)
        (my * (if invertY then 0.0018 else -0.0018))
        jump
        jumping
        descend
        sprint
        mining
        placing
        use
        charge
        craft
        night
        slot
        dodge
    )
