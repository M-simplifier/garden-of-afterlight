{-# LANGUAGE PatternSynonyms #-}

module Garden.Render.Resources
  ( Resources (..),
    PreparedModel,
    withResources,
    syncChunks,
    renderTarget,
    drawPrepared,
    drawRelic,
    textAt,
    textWidth,
    uniform,
    toRay,
    toColor,
  )
where

import Control.Exception (bracket, evaluate, onException)
import Control.Monad (forM_, unless)
import Data.Char (ord)
import Data.IORef
import Data.List (nub)
import Data.Map.Strict qualified as M
import Data.Set qualified as S
import Foreign (Ptr, free, malloc, peek, poke, with, withArrayLen)
import Foreign.C.String (withCString)
import Foreign.C.Types (CInt)
import Garden.Mesh
import Garden.Render.Invalidation (changedSince)
import Garden.Types (Cell (..), Chunk, Gem (..), Material (..), Threat (..), V3 (..), center)
import Garden.View (SceneView (..), uiCorpus)
import Garden.World (chunkOf)
import Raylib.Core
import Raylib.Core.Models
import Raylib.Core.Text
import Raylib.Core.Textures
import Raylib.Internal (WindowResources, managed)
import Raylib.Internal.Foreign (Freeable (rlFreeDependents))
import Raylib.Types hiding (Material)
import Raylib.Types qualified as RL

data PreparedModel = PreparedModel !Model !(Ptr Model)

data PreparedFont = PreparedFont !Font !(Ptr Font)

data Resources = Resources
  { resourceWindow :: WindowResources,
    resourceShader :: Shader,
    resourceSky :: Shader,
    resourcePost :: Shader,
    resourceFont :: PreparedFont,
    resourceChunks :: IORef (Int, M.Map Chunk [PreparedModel]),
    resourceKin :: M.Map Gem [PreparedModel],
    resourceEnemy :: M.Map Threat [PreparedModel],
    resourceTarget :: IORef (Int, Int, RenderTexture),
    resourceLights :: IORef [V3],
    resourceRelic :: [PreparedModel]
  }

withResources :: WindowResources -> (Resources -> IO a) -> IO a
withResources window = bracket acquire release
  where
    acquire = do
      worldShader <- managed window (loadShader (Just "assets/shaders/voxel.vs") (Just "assets/shaders/voxel.fs"))
      skyShader <- managed window (loadShader Nothing (Just "assets/shaders/sky.fs"))
      postShader <- managed window (loadShader Nothing (Just "assets/shaders/post.fs"))
      mapM_ (\s -> isShaderValid s >>= \ok -> unless ok (fail "A garden shader did not compile")) [worldShader, skyShader, postShader]
      glyphs <- readFile "assets/fonts/glyphs.txt"
      font <- managed window (loadFontEx "assets/fonts/NotoSansCJKjp-Regular.otf" 48 (Just (nub ([32 .. 126] <> filter (>= 32) (map ord (glyphs <> uiCorpus))))))
      validFont <- isFontValid font
      unless validFont (fail "The Japanese font could not be loaded")
      _ <- setTextureFilter (font'texture font) TextureFilterBilinear
      fp <- malloc
      poke fp font
      chunks <- newIORef (-1, M.empty)
      kin <- traverse (prepareGeometry worldShader . kinSculpture) (M.fromList [(g, g) | g <- [Jade, Rose, Azure, Honey]])
      enemy <- traverse (prepareGeometry worldShader . enemySculpture) (M.fromList [(k, k) | k <- [Wanderer .. SkyMoth]])
      w <- getScreenWidth
      h <- getScreenHeight
      target <- loadRenderTexture w h
      _ <- setTextureFilter (renderTexture'texture target) TextureFilterBilinear
      targetRef <- newIORef (w, h, target)
      lights <- newIORef []
      relic <- prepareGeometry worldShader relicGeometry
      pure (Resources window worldShader skyShader postShader (PreparedFont font fp) chunks kin enemy targetRef lights relic)
    release resources = do
      (_, chunks) <- readIORef (resourceChunks resources)
      mapM_ (mapM_ (releaseModel window)) (M.elems chunks <> M.elems (resourceKin resources) <> M.elems (resourceEnemy resources) <> [resourceRelic resources])
      let PreparedFont f fp = resourceFont resources
      rlFreeDependents f fp
      free fp
      (_, _, rt) <- readIORef (resourceTarget resources)
      unloadRenderTexture rt window

prepareGeometry :: Shader -> Geometry -> IO [PreparedModel]
prepareGeometry shader = traverse (prepareModel shader) . groupsOf 24000

groupsOf :: Int -> [a] -> [[a]]
groupsOf _ [] = []
groupsOf n xs = let (a, b) = splitAt n xs in a : groupsOf n b

prepareModel :: Shader -> Geometry -> IO PreparedModel
prepareModel shader geometry = do
  let mesh =
        Mesh
          { mesh'vertexCount = length geometry,
            mesh'triangleCount = length geometry `div` 3,
            mesh'vertices = [toRay p | Vertex p _ _ _ <- geometry],
            mesh'texcoords = Nothing,
            mesh'texcoords2 = Nothing,
            mesh'normals = [toRay n | Vertex _ n _ _ <- geometry],
            mesh'tangents = Nothing,
            mesh'colors = Just [toColor c emissionValue | Vertex _ _ c emissionValue <- geometry],
            mesh'indices = Nothing,
            mesh'animVertices = Nothing,
            mesh'animNormals = Nothing,
            mesh'boneIds = Nothing,
            mesh'boneWeights = Nothing,
            mesh'boneMatrices = Nothing,
            mesh'boneCount = 0,
            mesh'vaoId = 0,
            mesh'vboId = Nothing
          }
  uploaded <- uploadMesh mesh False
  model <- loadModelFromMesh uploaded
  let styled = model {model'materials = [m {material'shader = shader} | m <- model'materials model]}
  ptr <- malloc
  poke ptr styled `onException` free ptr
  -- The native borrow owns the CPU arrays needed by raylib. Retaining a second
  -- boxed Haskell vertex list makes major GC scan the whole garden on an edit.
  -- Release only needs the mesh count and GPU handles (Mesh.free ignores value).
  vao <- evaluate (mesh'vaoId uploaded)
  buffers <- evaluate (mesh'vboId uploaded)
  mapM_ (mapM_ evaluate) buffers
  compact <-
    evaluate
      mesh
        { mesh'vertexCount = 0,
          mesh'triangleCount = 0,
          mesh'vertices = [],
          mesh'normals = [],
          mesh'colors = Nothing,
          mesh'vaoId = vao,
          mesh'vboId = buffers
        }
  let metadata = styled {model'meshes = [compact]}
  pure (PreparedModel metadata ptr)

releaseModel :: WindowResources -> PreparedModel -> IO ()
releaseModel window (PreparedModel model ptr) = do
  rlFreeDependents model ptr
  free ptr
  -- loadModelFromMesh borrows raylib's default material; only own the mesh.
  forM_ (model'meshes model) (`unloadMesh` window)

drawPrepared :: PreparedModel -> V3 -> Float -> Float -> Color -> IO ()
drawPrepared (PreparedModel _ ptr) position yaw size tint =
  with (toRay position) $ \p -> with (Vector3 0 1 0) $ \axis -> with (Vector3 size size size) $ \s -> with tint $ \c -> c'drawModelEx ptr p axis (realToFrac yaw) s c

drawRelic :: PreparedModel -> Float -> IO ()
drawRelic (PreparedModel _ ptr) time =
  with (Vector3 0 62 54) $ \p -> with (Vector3 0 0 1) $ \axis -> with (Vector3 0.48 0.48 0.48) $ \s -> with (Color 255 255 255 255) $ \c ->
    c'drawModelEx ptr p axis (realToFrac (sin (time * 0.04) * 12)) s c

textAt :: Resources -> String -> Float -> Float -> Float -> Color -> IO ()
textAt resources text x y size color =
  let PreparedFont _ fontPtr = resourceFont resources
   in withArrayLen (map (fromIntegral . ord) text :: [CInt]) $ \count cp ->
        with (Vector2 x y) $ \position -> with color $ \tint ->
          c'drawTextCodepoints fontPtr cp (fromIntegral count) position (realToFrac size) 1 tint

textWidth :: Resources -> String -> Float -> IO Float
textWidth resources value size = do
  let PreparedFont _ fontPtr = resourceFont resources
  ptr <- withCString value (\s -> c'measureTextEx fontPtr s (realToFrac size) 1)
  Vector2 width _ <- peek ptr
  free ptr
  pure width

syncChunks :: Resources -> SceneView -> IO ()
syncChunks resources view = do
  (revision, old) <- readIORef (resourceChunks resources)
  if revision == sceneRevision view
    then pure ()
    else do
      let grouped = M.fromListWith (<>) [(chunkOf c, [(c, m)]) | (c, m) <- M.toList (sceneCells view)]
          rebuild = revision < 0 || sceneRevision view < revision
          changed = if rebuild then M.keys (M.union grouped (M.map (const []) old)) else S.toList (changedSince revision (sceneEdits view))
          entries key = if rebuild then M.findWithDefault [] key grouped else chunkEntries key (sceneCells view)
      new <- foldChunks entries old changed
      writeIORef (resourceChunks resources) (sceneRevision view, new)
      writeIORef
        (resourceLights resources)
        ( M.elems
            ( M.fromList
                [((x `div` 3, y `div` 3, z `div` 3), center c) | (c@(Cell x y z), Luminous) <- M.toList (sceneCells view)]
            )
        )
  where
    foldChunks _ current [] = pure current
    foldChunks entries current (key : rest) = do
      let contents = entries key
          geometry = terrainGeometry (sceneCells view) contents <> ornamentGeometry (sceneCells view) contents
      fresh <- prepareGeometry (resourceShader resources) geometry
      mapM_ (releaseModel (resourceWindow resources)) (M.findWithDefault [] key current)
      foldChunks entries (M.insert key fresh current) rest

chunkEntries :: Chunk -> M.Map Cell Material -> [(Cell, Material)]
chunkEntries (cx, cy, cz) cells = [(c, m) | x <- [cx * 4 .. cx * 4 + 3], y <- [cy * 8 .. cy * 8 + 7], z <- [cz * 4 .. cz * 4 + 3], let c = Cell x y z, Just m <- [M.lookup c cells]]

renderTarget :: Resources -> Int -> Int -> IO RenderTexture
renderTarget resources width height = do
  (w, h, old) <- readIORef (resourceTarget resources)
  if (w, h) == (width, height)
    then pure old
    else do
      fresh <- loadRenderTexture width height
      _ <- setTextureFilter (renderTexture'texture fresh) TextureFilterBilinear
      writeIORef (resourceTarget resources) (width, height, fresh)
      unloadRenderTexture old (resourceWindow resources)
      pure fresh

uniform :: Resources -> Shader -> String -> ShaderUniformData -> IO ()
uniform resources shader name value = setShaderValue shader name value (resourceWindow resources)

toRay :: V3 -> RL.Vector3
toRay (V3 x y z) = Vector3 x y z

toColor :: RGB -> Float -> Color
toColor (RGB r g b) a = Color (channel r) (channel g) (channel b) (channel a)
  where
    channel = round . (* 255) . max 0 . min 1
