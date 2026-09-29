{-# LANGUAGE ScopedTypeVariables #-}
module HaskellDesign.Verify (verify) where

import Control.Exception (IOException, SomeException, displayException, try)
import Control.Monad (unless, when, forM)
import Data.Aeson
import Data.Aeson.Types (parseEither)
import qualified Data.ByteString as B
import Data.List (sortOn)
import Data.Maybe (fromMaybe)
import Data.Ord (Down(..))
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as E
import System.Directory
import System.Exit (ExitCode(..))
import System.FilePath
import System.Info (os)
import System.IO.Temp (withTempDirectory)
import System.Process
import System.Timeout (timeout)
import HaskellDesign.Model
import HaskellDesign.Scope

failure :: String -> IO a
failure = ioError . userError

data Component = Component FilePath [String] (Maybe String)
instance FromJSON Component where
  parseJSON = withObject "component" $ \o -> Component <$> o .: "path" <*> o .:? "ghcOptions" .!= [] <*> o .:? "unsupportedReason"
data Config = Config (Maybe FilePath) [String] [Component]
instance FromJSON Config where
  parseJSON = withObject ".haskell-design.json" $ \o -> do
    version <- o .: "version"
    unless (version == (1 :: Int)) $ fail "Expected .haskell-design.json version 1."
    Config <$> o .:? "ghcPath" <*> o .:? "ghcOptions" .!= [] <*> o .:? "components" .!= []

compilerOptions :: FilePath -> FilePath -> IO (Maybe FilePath, [String])
compilerOptions root file = do
  let path = root </> ".haskell-design.json"
  exists <- doesFileExist path
  Config ghc options components <- if not exists then pure (Config Nothing [] []) else do
    link <- pathIsSymbolicLink path
    when link $ failure "Linked compiler configuration is unsupported."
    size <- getFileSize path
    when (size > 2000000) $ failure "Compiler configuration exceeds the 2 MB limit."
    either failure pure . eitherDecodeStrict' =<< B.readFile path
  resolved <- forM components $ \(Component prefix args reason) -> do
    p <- canonicalizePath (if isAbsolute prefix then prefix else root </> prefix)
    unless (within root p) $ failure "Component path is outside project."
    pure (p, args, reason)
  let matches = sortOn (Down . length . (\(p,_,_) -> p)) [c | c@(p,_,_) <- resolved, within p file]
  args <- case matches of
    (_,_,Just reason):_ -> failure reason
    (_,extra,Nothing):_ -> pure extra
    [] | not (null components) -> failure ".haskell-design.json: no compiler component matches this file. Add its folder to components."
    [] -> pure []
  pure (fmap (\g -> if any isPathSeparator g && not (isAbsolute g) then root </> g else g) ghc, options ++ args)

run :: FilePath -> FilePath -> [String] -> Int -> IO Text
run root binary args seconds = do
  result <- timeout (seconds * 1000000) (readCreateProcessWithExitCode (proc binary args) { cwd = Just root } "")
  case result of
    Nothing -> failure "GHC verification timed out."
    Just (code, output, errors)
      | length output > 8000000 || length errors > 8000000 -> failure "GHC output exceeded the 8 MB limit."
      | code == ExitSuccess -> pure (T.pack output)
      | otherwise -> failure (take 12000 (if null errors then output else errors))

helper :: FilePath -> FilePath -> FilePath -> Maybe FilePath -> IO (FilePath, String)
helper root ghc source cacheDir = do
  version <- T.strip <$> run root ghc ["--numeric-version"] 15
  unless ("9.6." `T.isPrefixOf` version) $ failure ("GHC " ++ T.unpack version ++ ": verification supports GHC 9.6.x. Syntax reading remains available.")
  libdir <- T.strip <$> run root ghc ["--print-libdir"] 15
  content <- readSource source
  base <- maybe (getXdgDirectory XdgCache "haskell-design") pure cacheDir
  cache <- makeAbsolute (base </> T.unpack (T.take 20 (hash (T.intercalate "\0" [version, libdir, content]))))
  let binary = cache </> if os == "mingw32" then "verify.exe" else "verify"
  exists <- doesFileExist binary
  unless exists $ do
    createDirectoryIfMissing True cache
    withTempDirectory cache "build-" $ \temp -> do
      let target = temp </> takeFileName binary
      _ <- run root ghc ["-package", "ghc", "-O0", "-outputdir", temp, "-o", target, source] 60
      published <- try (renameFile target binary)
      case published of
        Right () -> pure ()
        Left (err :: IOException) -> do
          wonElsewhere <- doesFileExist binary
          unless wonElsewhere (failure (displayException err))
  pure (binary, T.unpack libdir)

-- The caller has already checked --infer --trusted and exact file/module scope.
-- Accept a proof only if every mutable dependency belongs to the unchanged
-- source/config snapshot. The GHC helper rejects CPP, TH, ANN and plugins.
verify :: FilePath -> FilePath -> Text -> FilePath -> Maybe FilePath -> Maybe FilePath -> IO Verification
verify root file source helperSource ghcPath cacheDir = do
  let initial = Verification Unknown (hash source) [] [] Nothing Nothing Nothing
  result <- try $ do
    saved <- readSource file
    unless (hash saved == hash source) $ failure "Source changed before verification. Read it again."
    before <- fingerprint root
    (configured, options) <- compilerOptions root file
    let ghc = fromMaybe (fromMaybe "ghc" ghcPath) configured
    (binary, libdir) <- helper root ghc helperSource cacheDir
    let includes = ["-i" ++ root </> p | p <- ["", "src", "app", "test", "tests"]]
    output <- run root binary (libdir:file:includes ++ options) 30
    value <- either failure pure (eitherDecodeStrict' (E.encodeUtf8 output))
    (status, signatures, evidence, dependencies) <- either failure pure $ parseEither (withObject "GHC result" $ \o ->
      (,,,) <$> o .: "status" <*> o .: "signatures" <*> o .: "evidence" <*> o .:? "dependencies" .!= []) value
    unless (status `elem` [Pure, IOUsed]) $ failure "Invalid GHC verification response."
    files <- sourceFiles root >>= mapM canonicalizePath
    deps <- mapM (canonicalizePath . (root </>)) dependencies
    unless (all (`elem` files) deps) $ failure "Source dependencies are outside the workspace analysis scope. Open their common parent folder."
    configs <- configurationFiles root
    after <- fingerprint root
    final <- hash <$> readSource file
    unless (before == after && final == hash source) $ failure "Source or configuration changed during verification. Read it again."
    pure initial { verStatus = status, verSignatures = signatures, verEvidence = map reason evidence, verDependencies = Just (deps ++ configs), verWorkspaceHash = Just before }
  case result of
    Right proof -> pure proof
    Left (err :: SomeException) -> pure initial { verError = Just (T.take 12000 (T.pack (displayException err))) }
  where reason e = e { evidenceReason = "GHCが推論した型・式にIOが現れます。", evidenceName = if "$" `T.isPrefixOf` evidenceName e then "インスタンス・生成された定義" else evidenceName e }
