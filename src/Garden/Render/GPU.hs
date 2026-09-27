{-# LANGUAGE CPP #-}
{-# LANGUAGE PatternSynonyms #-}
-- | Small, exception-safe GPU boundary; no garden state or rendering policy.
module Garden.Render.GPU (loadCheckedShader, withShader, colorTarget, depthTarget, releaseTarget, bindTexture, blit, releaseAll) where

import Control.Exception (bracket, bracket_, bracketOnError, finally, mask_)
import Control.Monad (unless, when)
import Foreign (free, malloc, nullPtr, poke)
import Raylib.Core
import Raylib.Core.Textures (drawTexturePro)
import Raylib.Internal.Foreign (Freeable (rlFreeDependents))
import Raylib.Internal (WindowResources, managed)
import Raylib.Types
import Raylib.Util.RLGL

loadCheckedShader :: WindowResources -> Maybe FilePath -> FilePath -> IO Shader
loadCheckedShader window vertex fragment = mask_ $
  bracketOnError (managed window (loadShader vertex (Just fragment))) (`unloadShader` window) $ \shader -> do
    valid <- isShaderValid shader
    fallback <- rlGetShaderIdDefault
    unless (valid && shader'id shader /= fallback) (ioError (userError ("Shader rejected: " <> fragment)))
    pure shader

-- h-raylib 5.6's shaderMode frees shader.locs before EndShaderMode. Keep the
-- complete borrowed Shader alive until the queued batch has been flushed.
withShader :: Shader -> IO a -> IO a
withShader shader action =
  bracket (bracketOnError malloc free (\ptr -> poke ptr shader >> pure ptr))
    (\ptr -> rlFreeDependents shader ptr `finally` free ptr)
    (\ptr -> bracket_ (c'beginShaderMode ptr) endShaderMode action)

-- A framebuffer owns its depth attachment; rlUnloadFramebuffer deletes it.
-- Color attachments are released separately, including a failed allocation.
releaseTarget :: RenderTexture -> IO ()
releaseTarget target = do
  when (texture'id (renderTexture'texture target) /= 0) (rlUnloadTexture (texture'id (renderTexture'texture target)))
  rlUnloadFramebuffer (renderTexture'id target)

colorTarget :: Bool -> Bool -> (Int, Int) -> IO RenderTexture
colorTarget hdr sampledDepth (width, height) = mask_ $
  bracketOnError rlLoadFramebuffer rlUnloadFramebuffer $ \identifier -> do
    let format = if hdr then PixelFormatUncompressedR16G16B16A16 else PixelFormatUncompressedR8G8B8A8
    bracketOnError (fromIntegral <$> c'rlLoadTexture nullPtr (fromIntegral width) (fromIntegral height) (fromIntegral (fromEnum format)) 1) rlUnloadTexture $ \color -> do
      rlFramebufferAttach identifier color RLAttachmentColorChannel0 RLAttachmentTexture2D 0
      -- Even color-only passes have a renderbuffer: raylib's teardown queries
      -- a real depth attachment on WebGL, and no useless depth texture is kept.
      depth <- rlLoadTextureDepth width height (not sampledDepth)
      rlFramebufferAttach identifier depth RLAttachmentDepth (if sampledDepth then RLAttachmentTexture2D else RLAttachmentRenderBuffer) 0
      configure color 9729
      valid <- rlFramebufferComplete identifier
      rlDisableFramebuffer
      unless valid (ioError (userError "Render target is incomplete"))
      pure (RenderTexture identifier (Texture color width height 1 format) (Texture depth width height 1 PixelFormatUncompressedR32))

depthTarget :: Int -> IO RenderTexture
depthTarget size = mask_ $
  bracketOnError rlLoadFramebuffer rlUnloadFramebuffer $ \identifier -> do
    depth <- rlLoadTextureDepth size size False
    rlFramebufferAttach identifier depth RLAttachmentDepth RLAttachmentTexture2D 0
    configure depth 9728
    valid <- rlFramebufferComplete identifier
    rlDisableFramebuffer
    unless valid (ioError (userError "Shadow target is incomplete"))
    pure (RenderTexture identifier (Texture 0 size size 1 PixelFormatUncompressedR8G8B8A8) (Texture depth size size 1 PixelFormatUncompressedR32))

configure :: Integer -> Int -> IO ()
configure texture filtering = do
  rlTextureParameters texture RLTextureParamMinFilter filtering
  rlTextureParameters texture RLTextureParamMagFilter filtering
  rlTextureParameters texture RLTextureParamWrapS 33071
  rlTextureParameters texture RLTextureParamWrapT 33071

bindTexture :: Int -> Texture -> IO ()
bindTexture slot texture = do
  rlActiveTextureSlot slot
  rlEnableTexture (texture'id texture)
  rlActiveTextureSlot 0

blit :: RenderTexture -> (Int, Int) -> IO ()
blit target (width, height) = drawTexturePro tex
  (Rectangle 0 0 (fromIntegral (texture'width tex)) (negate (fromIntegral (texture'height tex))))
  (Rectangle 0 0 (fromIntegral width) (fromIntegral height)) (Vector2 0 0) 0 (Color 255 255 255 255)
  where tex = renderTexture'texture target

releaseAll :: [IO ()] -> IO ()
releaseAll = foldr finally (pure ())
