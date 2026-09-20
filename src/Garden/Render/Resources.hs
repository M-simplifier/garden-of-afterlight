{-# LANGUAGE CPP #-}
{-# LANGUAGE PatternSynonyms #-}

module Garden.Render.Resources
  ( Resources (..),
    PreparedModel,
    acquireResources,
    releaseResources,
    withResources,
    ChunkLoading,
    beginChunkLoading,
    stepChunkLoading,
    chunkLoadingProgress,
    syncChunks,
    renderTarget,
    drawPrepared,
    drawRelic,
    withShader,
    textAt,
    textWidth,
    uniform,
    toRay,
    toColor,
  )
where

import Control.Exception (bracket, bracket_, bracketOnError, evaluate, finally, mask, mask_, onException)
import Control.Monad (forM_, unless)
import Data.Char (ord)
import Data.IORef
import Data.Map.Strict qualified as M
import Data.Set qualified as S
import Foreign (Ptr, castPtr, free, malloc, peek, poke, with, withArrayLen)
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
import Raylib.Internal.Foreign (Freeable (rlFreeDependents), c'free)
import Raylib.Types hiding (Material)
import Raylib.Types qualified as RL
import Raylib.Util.Math (matrixIdentity)

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
withResources window = bracket (acquireResources window) releaseResources

-- | Ownership may span host callbacks. Release before closing the window.
-- Managed GPU objects and native borrows are both unwound on partial failure.
acquireResources :: WindowResources -> IO Resources
acquireResources window = mask_ $ do
  cleanupRef <- newIORef []
  let own action release = do
        value <- action
        modifyIORef' cleanupRef (release value :)
        pure value
      shader action = own (managed window action) (`unloadShader` window)
      geometry worldShader shape = own (prepareGeometry window worldShader shape) (releaseModels window)
  ( do
      worldShader <- shader (loadShader (Just "assets/shaders/voxel.vs") (Just "assets/shaders/voxel.fs"))
#if defined(wasm32_HOST_ARCH)
      -- raylib's default screen vertex shader is ES 100, even on WebGL 2.
      let screenVertex = Just "assets/shaders/screen.vs"
#else
      let screenVertex = Nothing
#endif
      skyShader <- shader (loadShader screenVertex (Just "assets/shaders/sky.fs"))
      postShader <- shader (loadShader screenVertex (Just "assets/shaders/post.fs"))
      mapM_ (\s -> isShaderValid s >>= \ok -> unless ok (fail "A garden shader did not compile")) [worldShader, skyShader, postShader]
      glyphs <- readFile "assets/fonts/glyphs.txt"
      let codepoints = S.toAscList (S.fromList ([32 .. 126] <> filter (>= 32) (map ord (glyphs <> uiCorpus))))
      font <- own (managed window (loadFontEx "assets/fonts/NotoSansCJKjp-Regular.otf" 48 (Just codepoints))) (`unloadFont` window)
      validFont <- isFontValid font
      unless validFont (fail "The Japanese font could not be loaded")
      _ <- setTextureFilter (font'texture font) TextureFilterBilinear
      preparedFont <- own (bracketOnError malloc free (\fp -> poke fp font >> pure (PreparedFont font fp))) releaseFontBorrow
      chunks <- newIORef (-1, M.empty)
      kin <- traverse (geometry worldShader . kinSculpture) (M.fromList [(g, g) | g <- [Jade, Rose, Azure, Honey]])
      enemy <- traverse (geometry worldShader . enemySculpture) (M.fromList [(k, k) | k <- [Wanderer .. SkyMoth]])
      w <- getScreenWidth
      h <- getScreenHeight
      target <- own (loadRenderTexture w h) (`unloadRenderTexture` window)
      _ <- setTextureFilter (renderTexture'texture target) TextureFilterBilinear
      targetRef <- newIORef (w, h, target)
      lights <- newIORef []
      relic <- geometry worldShader relicGeometry
      pure (Resources window worldShader skyShader postShader preparedFont chunks kin enemy targetRef lights relic)
    ) `onException` (readIORef cleanupRef >>= releaseAll)

releaseResources :: Resources -> IO ()
releaseResources resources = mask_ $ do
  (_, chunks) <- readIORef (resourceChunks resources)
  (_, _, target) <- readIORef (resourceTarget resources)
  let window = resourceWindow resources
      PreparedFont font _ = resourceFont resources
  releaseAll
    [ releaseModels window (concat (M.elems chunks <> M.elems (resourceKin resources) <> M.elems (resourceEnemy resources) <> [resourceRelic resources])),
      releaseFontBorrow (resourceFont resources),
      unloadFont font window,
      unloadRenderTexture target window,
      unloadShader (resourcePost resources) window,
      unloadShader (resourceSky resources) window,
      unloadShader (resourceShader resources) window
    ]

releaseFontBorrow :: PreparedFont -> IO ()
releaseFontBorrow (PreparedFont font ptr) = rlFreeDependents font ptr `finally` free ptr

releaseModels :: WindowResources -> [PreparedModel] -> IO ()
releaseModels window = releaseAll . map (releaseModel window)

releaseAll :: [IO ()] -> IO ()
releaseAll = foldr finally (pure ())

acquireMany :: (a -> IO b) -> (b -> IO ()) -> [a] -> IO [b]
acquireMany _ _ [] = pure []
acquireMany acquire release (value : rest) =
  bracketOnError (acquire value) release $ \resource ->
    (resource :) <$> acquireMany acquire release rest

prepareGeometry :: WindowResources -> Shader -> Geometry -> IO [PreparedModel]
prepareGeometry window shader = acquireMany (prepareModel window shader) (releaseModel window) . groupsOf 24000

groupsOf :: Int -> [a] -> [[a]]
groupsOf _ [] = []
groupsOf n xs = let (a, b) = splitAt n xs in a : groupsOf n b

prepareModel :: WindowResources -> Shader -> Geometry -> IO PreparedModel
prepareModel window shader geometry = mask_ $ do
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
  bracketOnError (uploadMesh mesh False) (`unloadMesh` window) $ \uploaded -> do
    material <- loadMaterialDefault
    -- Match raylib's LoadModelFromMesh initialization directly, avoiding a
    -- second marshal/readback of every uploaded vertex just to wrap the mesh.
    let styled =
          Model
            { model'transform = matrixIdentity,
              model'meshes = [uploaded],
              model'materials = [material {material'shader = shader}],
              model'meshMaterial = [0],
              model'boneCount = 0,
              model'bones = Nothing,
              model'bindPose = Nothing
            }
    bracketOnError malloc free $ \ptr -> do
      poke ptr styled
      ( do
          -- The native borrow owns the CPU arrays needed by raylib. Retaining a
          -- second boxed vertex list makes major GC scan the garden on an edit.
          -- Release only needs the mesh count and GPU handles.
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
        ) `onException` rlFreeDependents styled ptr

releaseModel :: WindowResources -> PreparedModel -> IO ()
releaseModel window (PreparedModel model ptr) = do
  -- Only the mesh's GPU handles are owned here; material resources are borrowed.
  (rlFreeDependents model ptr `finally` free ptr)
    `finally` forM_ (model'meshes model) (`unloadMesh` window)

drawPrepared :: PreparedModel -> V3 -> Float -> Float -> Color -> IO ()
drawPrepared (PreparedModel _ ptr) position yaw size tint =
  with (toRay position) $ \p -> with (Vector3 0 1 0) $ \axis -> with (Vector3 size size size) $ \s -> with tint $ \c -> c'drawModelEx ptr p axis (realToFrac yaw) s c

drawRelic :: PreparedModel -> Float -> IO ()
drawRelic (PreparedModel _ ptr) time =
  with (Vector3 0 62 54) $ \p -> with (Vector3 0 0 1) $ \axis -> with (Vector3 0.48 0.48 0.48) $ \s -> with (Color 255 255 255 255) $ \c ->
    c'drawModelEx ptr p axis (realToFrac (sin (time * 0.04) * 12)) s c

-- BeginShaderMode retains shader.locs until EndShaderMode flushes the batch.
-- h-raylib 5.6's shaderMode frees that array immediately after begin returns.
withShader :: Shader -> IO a -> IO a
withShader shader action =
  bracket
    (bracketOnError malloc free (\ptr -> poke ptr shader >> pure ptr))
    (\ptr -> rlFreeDependents shader ptr `finally` free ptr)
    (\ptr -> bracket_ (c'beginShaderMode ptr) endShaderMode action)

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
  c'free (castPtr ptr)
  pure width

-- Initial uploads may span callbacks. Each completed chunk immediately belongs
-- to Resources, so cancellation releases even a partly constructed garden.
-- Start once with freshly acquired Resources; do not call syncChunks until done.
data ChunkLoading = ChunkLoading !Resources !SceneView !Int !(IORef (Int, [(Chunk, [(Cell, Material)])]))

beginChunkLoading :: Resources -> SceneView -> IO ChunkLoading
beginChunkLoading resources view = do
  let grouped = M.fromListWith (<>) [(chunkOf cell, [(cell, material)]) | (cell, material) <- M.toList (sceneCells view)]
  total <- evaluate (M.size grouped)
  pending <- newIORef (0, M.toList grouped)
  pure (ChunkLoading resources view total pending)

chunkLoadingProgress :: ChunkLoading -> IO (Int, Int)
chunkLoadingProgress (ChunkLoading _ _ total pending) = do
  (done, _) <- readIORef pending
  pure (done, total)

-- At least one chunk is processed; a single chunk is the indivisible upload.
-- The time budget bounds batches rather than assuming identical chunk costs.
stepChunkLoading :: Double -> ChunkLoading -> IO Bool
stepChunkLoading budget (ChunkLoading resources view _ pending) = mask_ $ do
  began <- getTime
  let advance = do
        (done, remaining) <- readIORef pending
        case remaining of
          [] -> do
            modifyIORef' (resourceChunks resources) (\(_, chunks) -> (sceneRevision view, chunks))
            writeIORef (resourceLights resources) (sceneLights view)
            pure True
          (key, contents) : rest -> do
            -- Keep acquisition and ownership registration in one masked span.
            models <- prepareChunk resources view contents
            modifyIORef' (resourceChunks resources) (\(revision, chunks) -> (revision, M.insert key models chunks))
            writeIORef pending (done + 1, rest)
            now <- getTime
            if null rest || now - began < max 0.001 budget then advance else pure False
  advance

prepareChunk :: Resources -> SceneView -> [(Cell, Material)] -> IO [PreparedModel]
prepareChunk resources view contents =
  prepareGeometry (resourceWindow resources) (resourceShader resources)
    (terrainGeometry (sceneCells view) contents <> ornamentGeometry (sceneCells view) contents)

sceneLights :: SceneView -> [V3]
sceneLights view = M.elems (M.fromList [((x `div` 3, y `div` 3, z `div` 3), center cell) | (cell@(Cell x y z), Luminous) <- M.toList (sceneCells view)])

syncChunks :: Resources -> SceneView -> IO ()
syncChunks resources view = mask $ \restore -> do
  (revision, old) <- readIORef (resourceChunks resources)
  if revision == sceneRevision view
    then pure ()
    else do
      let grouped = M.fromListWith (<>) [(chunkOf c, [(c, m)]) | (c, m) <- M.toList (sceneCells view)]
          rebuild = revision < 0 || sceneRevision view < revision
          changed = if rebuild then M.keys (M.union grouped (M.map (const []) old)) else S.toList (changedSince revision (sceneEdits view))
          entries key = if rebuild then M.findWithDefault [] key grouped else chunkEntries key (sceneCells view)
          prepare key = do
            models <- prepareChunk resources view (entries key)
            pure (key, models)
      -- Prepare the entire replacement before publishing it or releasing old
      -- meshes. A failed upload leaves the currently owned map intact.
      fresh <- restore (acquireMany prepare (releaseModels window . snd) changed)
      let new = M.union (M.fromList fresh) old
      writeIORef (resourceChunks resources) (sceneRevision view, new)
      writeIORef (resourceLights resources) (sceneLights view)
      releaseModels window (concatMap (\key -> M.findWithDefault [] key old) changed)
  where
    window = resourceWindow resources

chunkEntries :: Chunk -> M.Map Cell Material -> [(Cell, Material)]
chunkEntries (cx, cy, cz) cells = [(c, m) | x <- [cx * 4 .. cx * 4 + 3], y <- [cy * 8 .. cy * 8 + 7], z <- [cz * 4 .. cz * 4 + 3], let c = Cell x y z, Just m <- [M.lookup c cells]]

renderTarget :: Resources -> Int -> Int -> IO RenderTexture
renderTarget resources width height = mask_ $ do
  (w, h, old) <- readIORef (resourceTarget resources)
  if (w, h) == (width, height)
    then pure old
    else do
      fresh <- bracketOnError (loadRenderTexture width height) (`unloadRenderTexture` resourceWindow resources) $ \target -> do
        _ <- setTextureFilter (renderTexture'texture target) TextureFilterBilinear
        pure target
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
