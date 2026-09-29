module HaskellDesign.Scope (discover, within, readSource, sourceFiles, configurationFiles, fingerprint) where

import Control.Monad (filterM, forM, forM_, when)
import qualified Data.ByteString as B
import Data.Foldable (toList)
import Data.IORef
import Data.List (nub, sort, isPrefixOf)
import Data.Maybe (maybeToList)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as E
import Data.Text.Encoding.Error (lenientDecode)
import Distribution.PackageDescription
import Distribution.PackageDescription.Parsec (parseGenericPackageDescriptionMaybe)
import qualified Distribution.ModuleName as Module
import Distribution.Utils.Path (getSymbolicPath)
import System.Directory
import System.FilePath
import System.IO (withBinaryFile, IOMode(ReadMode))
import HaskellDesign.Model (hash)

-- Callers canonicalize paths first. Reject unresolved parent segments as well.
within :: FilePath -> FilePath -> Bool
within root file = let relative = makeRelative root file in not (isAbsolute relative) && ".." `notElem` splitDirectories relative
readSource :: FilePath -> IO Text
readSource file = withBinaryFile file ReadMode $ \handle -> do
  bytes <- B.hGet handle 2000001
  when (B.length bytes > 2000000) $ ioError (userError "Source size limit reached (2 MB per file).")
  pure (E.decodeUtf8With lenientDecode bytes)
excluded :: FilePath -> Bool
excluded name = "." `isPrefixOf` name || name `elem` ["node_modules", "vendor", "third_party", "dist", "build", "target", "coverage", "fixtures"] || "dist-" `isPrefixOf` name

-- One traversal budget across the entire tree, including nested directories.
-- Hidden compiler settings are included; hidden directories are never traversed.
walk :: (FilePath -> Bool) -> (FilePath -> Bool) -> Bool -> Int -> FilePath -> IO ([FilePath], Bool)
walk keep allowed rejectLinks limit root = do
  state <- newIORef (0 :: Int, 0 :: Int, [], False)
  let go dir = do
        entries <- sort <$> listDirectory dir
        forM_ entries $ \name -> do
          (visited, count, found, cut) <- readIORef state
          if cut then pure () else if visited >= 10000 || count > limit
            then writeIORef state (visited, count, found, True)
            else do
              writeIORef state (visited + 1, count, found, cut)
              let file = dir </> name
              link <- pathIsSymbolicLink file
              directory <- doesDirectoryExist file
              when (link && rejectLinks && keep file) $ ioError (userError ("Linked compiler settings are unsupported: " ++ file))
              when (not link && allowed file) $
                if directory then when (not (excluded name)) (go file)
                else when (keep file && (rejectLinks || not ("." `isPrefixOf` name))) $ modifyIORef' state (\(v,c,fs,k) -> (v,c+1,file:fs,k))
  exists <- doesDirectoryExist root
  when exists (go root)
  (_, count, found, cut) <- readIORef state
  pure (sort found, cut || count > limit)

sourceFiles :: FilePath -> IO [FilePath]
sourceFiles root = do
  (files, cut) <- walk ((== ".hs") . takeExtension) (const True) False 5000 root
  if cut then ioError (userError "Source discovery limit reached while checking dependencies.") else pure files
configurationFiles :: FilePath -> IO [FilePath]
configurationFiles root = do
  (files, cut) <- walk isConfig (const True) True 5000 root
  if cut then ioError (userError "Configuration discovery limit reached.") else pure files
  where isConfig file = let name = takeFileName file in takeExtension name == ".cabal" || "cabal.project" `isPrefixOf` name
                          || ".ghc.environment." `isPrefixOf` name || name `elem` [".haskell-design.json", "stack.yaml", "stack.yaml.lock", "hie.yaml"]
fingerprint :: FilePath -> IO Text
fingerprint root = do
  sources <- sourceFiles root
  configs <- configurationFiles root
  values <- forM (sources ++ configs) $ \file -> do
    size <- getFileSize file
    when (size > 2000000) $ ioError (userError "Dependency exceeds the 2 MB file limit.")
    digest <- hash <$> readSource file
    pure (T.pack file <> "\0" <> digest)
  pure (hash (T.intercalate "\0" values))

-- A root package owns its source scope: nested editor/tool packages are separate
-- projects. With no root package, discover ordinary nested packages instead.
discover :: FilePath -> Maybe [FilePath] -> [FilePath] -> Int -> IO ([FilePath], Bool, [Text])
discover root include exclude limit = do
  entries <- sort <$> listDirectory root
  let local = [root </> name | name <- entries, takeExtension name == ".cabal"]
  (packages, packagesCut) <- if null local then walk ((== ".cabal") . takeExtension) (const True) True 5000 root else pure (local, False)
  parsed <- if maybe False (const True) include then pure [] else mapM packageSources packages
  let rawRoots = maybe (if null packages then [root] else concatMap (\(r,_,_) -> r) parsed) id include
      rawDeclared = if maybe False (const True) include then [] else concatMap (\(_,f,_) -> f) parsed
      allowed file = within root file && not (any (`within` file) exclude)
  roots <- mapM canonicalizePath (nub rawRoots)
  declared <- mapM canonicalizePath (nub rawDeclared)
  let external = ["Cabal source path is outside the project: " <> T.pack p | p <- roots ++ declared, not (within root p)]
  walked <- mapM (walk ((== ".hs") . takeExtension) allowed False limit) (filter allowed roots)
  declaredExisting <- filterM doesFileExist (filter allowed declared)
  let found = sort (nub (concatMap fst walked ++ declaredExisting))
  pure (take limit found, packagesCut || any snd walked || length found > limit, concatMap (\(_,_,issues) -> issues) parsed ++ external)

packageSources :: FilePath -> IO ([FilePath], [FilePath], [Text])
packageSources file = do
  link <- pathIsSymbolicLink file
  when link $ ioError (userError ("Linked Cabal file is unsupported: " ++ file))
  size <- getFileSize file
  when (size > 2000000) $ ioError (userError "Cabal file exceeds the 2 MB limit.")
  parsed <- parseGenericPackageDescriptionMaybe <$> B.readFile file
  case parsed of
    Nothing -> pure ([], [], ["Cannot parse Cabal file " <> T.pack file <> "; use explicit --include directories."])
    Just package -> do
      let library c = component (map libBuildInfo (toList c)) (concatMap exposedModules (toList c)) []
          exe c = component (map buildInfo (toList c)) [] (map modulePath (toList c))
          test c = component (map testBuildInfo (toList c)) [m | x <- toList c, TestSuiteLibV09 _ m <- [testInterface x]] [p | x <- toList c, TestSuiteExeV10 _ p <- [testInterface x]]
          bench c = component (map benchmarkBuildInfo (toList c)) [] [p | x <- toList c, BenchmarkExeV10 _ p <- [benchmarkInterface x]]
          foreignLib c = component (map foreignLibBuildInfo (toList c)) [] []
          pairs = map library (maybeToList (condLibrary package) ++ map snd (condSubLibraries package))
            ++ map (exe . snd) (condExecutables package) ++ map (test . snd) (condTestSuites package)
            ++ map (bench . snd) (condBenchmarks package) ++ map (foreignLib . snd) (condForeignLibs package)
          component infos exposed mains =
            let dirs = nub (concatMap (map getSymbolicPath . hsSourceDirs) infos)
                -- A conditional hs-source-dirs does not erase the component's
                -- implicit "." in branches where that condition is false.
                implicitRoot = case infos of [] -> True; base:_ -> null (hsSourceDirs base)
                roots = nub (dirs ++ ["." | implicitRoot])
                generated = concatMap autogenModules infos
                modules = filter (`notElem` generated) (exposed ++ concatMap otherModules infos)
                here = takeDirectory file
            in ([normalise (here </> dir) | dir <- roots, normalise dir /= "."],
                [normalise (here </> name) | any ((== ".") . normalise) roots, name <- map ((<.> "hs") . Module.toFilePath) modules ++ filter ((== ".hs") . takeExtension) mains])
      pure (concatMap fst pairs, concatMap snd pairs, [])
