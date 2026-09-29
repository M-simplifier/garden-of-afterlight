{-# LANGUAGE ScopedTypeVariables #-}
module HaskellDesign.Reader (ReadRequest(..), Command(..), ReadPage(..), readPage, helpText, parseArguments) where

import Control.Exception (IOException, displayException, try)
import Control.Monad (foldM, forM, unless, when)
import Data.Aeson
import qualified Data.ByteString.Lazy as L
import Data.List (find)
import Data.Maybe (fromMaybe, isJust, maybeToList)
import Data.String (fromString)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as E
import System.Directory
import System.FilePath
import Text.Read (readMaybe)
import HaskellDesign.Model
import HaskellDesign.Project
import HaskellDesign.Scope
import HaskellDesign.Tree (utf16Length)
import HaskellDesign.Verify (verify)

data Command = Map | Outline | Show deriving (Eq, Show)
commandText :: Command -> Text
commandText Map = "map"
commandText Outline = "outline"
commandText Show = "show"
instance ToJSON Command where toJSON = String . commandText
instance FromJSON Command where
  parseJSON = withText "Command" $ \s -> case s of
    "map" -> pure Map; "outline" -> pure Outline; "show" -> pure Show
    _ -> fail "Commands: map, outline, show."

data ReadRequest = ReadRequest
  { rCommand :: Command, rRoot :: FilePath, rModule :: Maybe Text, rFile :: Maybe FilePath, rSymbol :: Maybe Text, rLine :: Maybe Int
  , rInclude :: Maybe [FilePath], rExclude :: [FilePath], rDocs :: Bool, rContext :: Bool
  , rMaxChars :: Int, rMaxFiles :: Int, rOffset :: Int, rSnapshot :: Maybe Text
  , rInfer :: Bool, rTrusted :: Bool, rGhcPath :: Maybe FilePath, rCacheDir :: Maybe FilePath
  } deriving Show
instance FromJSON ReadRequest where
  parseJSON = withObject "ReadRequest" $ \o -> ReadRequest
    <$> o .: "command" <*> o .:? "root" .!= "." <*> o .:? "module" <*> o .:? "file" <*> o .:? "symbol" <*> o .:? "line"
    <*> o .:? "include" <*> o .:? "exclude" .!= [] <*> o .:? "docs" .!= False <*> o .:? "context" .!= False
    <*> o .:? "maxChars" .!= 16000 <*> o .:? "maxFiles" .!= 500 <*> o .:? "offset" .!= 0 <*> o .:? "snapshot"
    <*> o .:? "infer" .!= False <*> o .:? "trusted" .!= False <*> o .:? "ghcPath" <*> o .:? "cacheDir"

data Document = Document { docFile :: FilePath, docRelative :: Text, docSource :: Text, docDesign :: Design }
data Coverage = Coverage Int Int Int Int Bool
instance ToJSON Coverage where
  toJSON (Coverage files declarations sourceLines sourceChars truncated) = object
    ["files" .= files, "declarations" .= declarations, "sourceLines" .= sourceLines, "sourceChars" .= sourceChars, "discoveryTruncated" .= truncated]
data Cursor = Cursor Int Text
instance ToJSON Cursor where toJSON (Cursor offset snapshot) = object ["offset" .= offset, "snapshot" .= snapshot]
data Blocked = Blocked Int Int
instance ToJSON Blocked where
  toJSON (Blocked offset minimumChars) = object ["offset" .= offset, "minimumChars" .= minimumChars,
    "hint" .= ("One complete declaration exceeds the budget. Raise maxChars or request a smaller symbol." :: Text)]
data ReadPage = ReadPage
  { pageCommand :: Command, pageSnapshot :: Text, pageText :: Text, pageCoverage :: Coverage, pageIssueCount :: Int
  , pageNext :: Maybe Cursor, pageBlocked :: Maybe Blocked, pageMatches :: Maybe Int }
instance ToJSON ReadPage where
  toJSON p = object $ ["schema" .= (1 :: Int), "command" .= pageCommand p, "snapshot" .= pageSnapshot p, "text" .= pageText p,
    "coverage" .= pageCoverage p, "issueCount" .= pageIssueCount p]
    ++ ["next" .= c | c <- maybeToList (pageNext p)] ++ ["blocked" .= b | b <- maybeToList (pageBlocked p)] ++ ["matches" .= n | n <- maybeToList (pageMatches p)]

failure :: String -> IO a
failure = ioError . userError
tshow :: Show a => a -> Text
tshow = T.pack . show
lineCount :: Text -> Int
lineCount t = if T.null t then 0 else length (T.splitOn "\n" (fromMaybe t (T.stripSuffix "\n" t)))
unix :: FilePath -> Text
unix = T.pack . map (\c -> if isPathSeparator c then '/' else c)
joinNonempty :: Text -> [Text] -> Text
joinNonempty sep = T.intercalate sep . filter (not . T.null)
shortDiagnostic :: Text -> Text
shortDiagnostic t = if utf16Length t > 800 then T.take 400 t <> " [diagnostic shortened; inspect this file]" else t

readPage :: FilePath -> ReadRequest -> IO ReadPage
readPage helper r = do
  mapM_ (\(name, value, lo, hi) -> unless (value >= lo && value <= hi) $ failure (name ++ " must be an integer from " ++ show lo ++ " to " ++ show hi ++ "."))
    ([("maxFiles", rMaxFiles r, 1, 5000), ("maxChars", rMaxChars r, 1024, 2000000), ("offset", rOffset r, 0, 1000000)] ++ [("line", n, 1, 10000000) | n <- maybeToList (rLine r)])
  when (rOffset r > 0 && not (isJust (rSnapshot r))) $ failure "Continuation requires --snapshot from the previous page."
  when (rInfer r && (rCommand r /= Outline || not (rTrusted r) || not (isJust (rFile r) || isJust (rModule r)))) $
    failure "Inference runs GHC: use outline with trusted: true and select a file or module. The default overview only parses source."
  when (rCommand r == Show && not (isJust (rSymbol r) || isJust (rLine r))) $
    failure "show requires a symbol or source line. Add module/file when a name is ambiguous."
  root <- canonicalizePath =<< makeAbsolute (rRoot r)
  let inside p = do
        resolved <- canonicalizePath (if isAbsolute p then p else root </> p)
        unless (within root resolved) $ failure ("Outside project: " ++ p)
        pure resolved
  include <- traverse (mapM inside) (rInclude r)
  exclude <- mapM inside (rExclude r)
  (files, truncated, scopeIssues) <- case rFile r of
    Just p -> do file <- inside p; pure ([file], False, [])
    Nothing -> discover root include exclude (rMaxFiles r)
  (reversed, readIssues, inputs, _) <- foldM (readOne root) ([], [("scope", scopeIssues) | not (null scopeIssues)], [], 0 :: Integer) files
  documents <- forM (reverse reversed) $ \doc -> if not (rInfer r) then pure doc else do
    proof <- verify root (docFile doc) (docSource doc) helper (rGhcPath r) (rCacheDir r)
    design <- project (docSource doc) (docFile doc) (Just proof)
    pure doc { docDesign = design }
  let view = E.decodeUtf8 (L.toStrict (encode (root, rCommand r, rModule r, rSymbol r, rLine r, rDocs r, rContext r, rInfer r, truncated)))
      snapshot = T.take 20 (hash (T.intercalate "\0" (reverse inputs ++ [view] ++ [hash (designText (docDesign d) <> T.intercalate "\0" (designIssues (docDesign d))) | d <- documents])))
      issues = reverse readIssues ++ [(docRelative d, designIssues (docDesign d)) | d <- documents, not (null (designIssues (docDesign d)))]
      count = sum (map (length . designDeclarations . docDesign) documents)
      coverage = Coverage (length documents) count (sum (map (lineCount . docSource) documents)) (sum (map (utf16Length . docSource) documents)) truncated
  when (maybe False (/= snapshot) (rSnapshot r)) $ failure "Source snapshot or view options changed. Start again at offset 0; do not combine pages from different snapshots."
  (content, matches) <- if rCommand r == Show then showChunks r documents else pure (concatMap (outlineChunks r) documents, Nothing)
  let chunks = content ++ ["NO MATCHING SOURCE FILES. Check the module/file filter and include paths." | null documents && rCommand r /= Show]
        ++ ["WARNING " <> file <> ": " <> T.intercalate "\n" (map shortDiagnostic messages) | (file, messages) <- issues]
      heading = "# " <> commandText (rCommand r) <> " | snapshot " <> snapshot <> "\n# " <> tshow (length documents) <> " files, " <> tshow count <> " declarations; saved source only; private declarations included.\n"
        <> (if rCommand r == Outline then "# Bodies hidden; ? means no type available. Syntax/type contracts do not establish runtime behavior.\n" else "")
        <> (if truncated then "# WARNING: file discovery limit reached; narrow scope or raise --max-files.\n" else "")
        <> (if null issues then "" else "# WARNING: " <> tshow (length issues) <> " files have parsing/reading/inference issues; diagnostics follow the source entries.\n")
  paginate r (ReadPage (rCommand r) snapshot "" coverage (length issues) Nothing Nothing matches) heading chunks
  where
    readOne root (docs, issues, inputs, total) file = do
      actual <- canonicalizePath file
      unless (within root actual) $ failure ("Linked file outside project: " ++ file)
      let name = unix (makeRelative root file)
      result <- try $ do
        size <- getFileSize file
        when (size > 2000000 || total + size > 64000000) $ failure "Source size limit reached (2 MB per file / 64 MB total). Narrow the scope."
        source <- readSource file
        when (utf16Length source > 2000000) $ failure "Source size limit reached."
        design <- project source file Nothing
        pure (source, design, size)
      case result of
        Left (err :: IOException) -> let message = T.pack (displayException err) in pure (docs, (name, [message]):issues, ("unreadable:" <> message):name:inputs, total)
        Right (source, design, size) ->
          let matches = maybe True (\m -> designModule design == m || rCommand r /= Show && not (rInfer r) && (m <> ".") `T.isPrefixOf` designModule design) (rModule r)
          in pure (if matches then Document file name source design : docs else docs, issues, designSourceHash design:name:inputs, total + size)

outlineChunks :: ReadRequest -> Document -> [Text]
outlineChunks r doc
  | rCommand r == Map = [docRelative doc <> " -> " <> designModule design <> " (" <> tshow (length (designDeclarations design)) <> " declarations; " <> tshow (lineCount (docSource doc)) <> " source lines)"]
  | otherwise = T.strip ("## " <> designModule design <> " | " <> docRelative doc <> "\n" <> designHeader design)
      : [T.intercalate "\n" (designImports design) | rContext r, not (null (designImports design))]
      ++ [joinNonempty "\n" (["[" <> tshow (declLine d) <> "] " <> visible d] ++ [declDocs d | rDocs r]) | d <- designDeclarations design]
  where
    design = docDesign doc
    visible d = if declKind d == "pragma" && take 1 (T.words (T.strip (T.drop 3 (declDesign d)))) /= ["LANGUAGE"]
      then "-- pragma; inspect with show --file " <> docRelative doc <> " --line " <> tshow (declLine d) else declDesign d

showChunks :: ReadRequest -> [Document] -> IO ([Text], Maybe Int)
showChunks r documents = do
  candidates <- fmap concat $ forM documents $ \doc -> do
    symbols <- sourceSymbols (docSource doc)
    let name = fmap (\s -> fromMaybe s (T.stripPrefix "(" s >>= T.stripSuffix ")")) (rSymbol r)
    pure [(doc, symbol) | symbol <- symbols, maybe True (`elem` symbolNames symbol) name, maybe True (== symbolLine symbol) (rLine r)]
  let chunks = case candidates of
        [(doc, symbol)] -> let design = docDesign doc in
          ["## " <> designModule design <> " | " <> docRelative doc <> ":" <> tshow (symbolLine symbol) <> "-" <> tshow (symbolEndLine symbol) <> maybe "" ("\n-- In " <>) (symbolOwner symbol)]
          ++ [joinNonempty "\n" (designHeader design:designImports design) | rContext r]
          ++ [declDocs d | rDocs r, not (isJust (symbolOwner symbol)), d <- maybeToList (find (any (`elem` symbolNames symbol) . declNames) (designDeclarations design)), not (T.null (declDocs d))]
          ++ [joinNonempty "\n" (maybeToList (symbolSignature symbol) ++ [symbolSource symbol])]
        [] -> ["NOT FOUND: use map/outline to check the saved source names and scope."]
        _ -> "AMBIGUOUS: choose --file, --symbol and/or --line from these candidates; no implementation selected."
          : [docRelative doc <> ":" <> tshow (symbolLine symbol) <> " " <> designModule (docDesign doc) <> " " <> T.intercalate ", " (symbolNames symbol) <> maybe "" (\o -> " [" <> o <> "]") (symbolOwner symbol) | (doc, symbol) <- candidates]
  pure (chunks, Just (length candidates))

-- A cursor counts complete syntax units, never fragments. Long module headers
-- remain ordinary units; continuation context is capped independently.
paginate :: ReadRequest -> ReadPage -> Text -> [Text] -> IO ReadPage
paginate r result heading chunks = do
  when (rOffset r > length chunks) $ failure "Offset is past the end of this result."
  let offset = rOffset r
      remaining = drop offset chunks
      context = if offset == 0 || maybe False (T.isPrefixOf "## ") (safeHead remaining) then ""
        else maybe "" (\c -> let label = head (T.splitOn "\n" c) in (if utf16Length label > 180 then T.take 80 label <> " [context shortened]" else label) <> "\n") (find (T.isPrefixOf "## ") (reverse (take offset chunks)))
      start = heading <> context
      reserve = 180
      fit (size, kept) chunk = if size + utf16Length chunk + 2 + reserve <= rMaxChars r then Just (size + utf16Length chunk + 2, chunk:kept) else Nothing
      consume state [] = (state, [])
      consume state remainingChunks@(c:cs) = maybe (state, remainingChunks) (\nextState -> consume nextState cs) (fit state c)
      ((_, reversed), rest) = consume (utf16Length start, []) remaining
      index = offset + length reversed
      next = [Cursor index (pageSnapshot result) | not (null rest)]
      minimumChars = utf16Length start + maybe 0 utf16Length (safeHead rest) + reserve + 2
      blocked = [Blocked offset minimumChars | index == offset, not (null rest)]
      tailText = if null rest then "# END\n" else "# NEXT --offset " <> tshow index <> " --snapshot " <> pageSnapshot result <> "\n"
        <> (if null blocked then "" else "# This complete item needs --max-chars " <> tshow minimumChars <> ". Nothing was cut inside it.\n")
      body = start <> T.concat [c <> "\n\n" | c <- reverse reversed] <> tailText
  when (utf16Length body > rMaxChars r) $ failure "Output heading exceeds maxChars; raise the budget."
  pure result { pageText = body, pageNext = safeHead next, pageBlocked = safeHead blocked }
  where safeHead [] = Nothing; safeHead (x:_) = Just x

helpText :: Text
helpText = T.unlines
  [ "Haskell Design reader (native; saved files, no editor required)"
  , "  haskell-design map --root PATH"
  , "  haskell-design outline --root PATH [--module Garden.Change]"
  , "  haskell-design show --root PATH --module Garden.Change --symbol apply"
  , "Filters: --file PATH, --module NAMESPACE, --symbol NAME, --line NUMBER"
  , "Scope:   --include DIR (repeatable), --exclude DIR (repeatable), --max-files NUMBER"
  , "Output:  --max-chars NUMBER (default 16000), --offset NUMBER --snapshot HASH, --json"
  , "Details: --docs, --context, --infer --trusted (GHC 9.6.x; outline with file/exact module), --ghc PATH, --cache-dir PATH"
  , "The syntax view needs neither Node nor GHC. Read NEXT cursors and warnings before claiming whole-project coverage. No source is modified." ]

parseArguments :: [String] -> Either String (ReadRequest, Bool)
parseArguments [] = Left "Commands: map, outline, show."
parseArguments (command:args) = do
  arguments <- go args [] [] [] False
  let (fields, includes, excludes, json) = arguments
      scope = ["include" .= includes | not (null includes)] ++ ["exclude" .= excludes | not (null excludes)]
  case fromJSON (object ("command" .= command : scope ++ reverse fields)) of Error err -> Left err; Success request -> Right (request, json)
  where
    go [] fields includes excludes json = Right (fields, includes, excludes, json)
    go (arg:rest) fields includes excludes json
      | arg == "--json" = go rest fields includes excludes True
      | arg `elem` ["--docs", "--context", "--infer", "--trusted"] = go rest (fromStringKey (drop 2 arg) .= True : fields) includes excludes json
      | Just key <- lookup arg stringKeys = value rest $ \v more -> go more (fromStringKey key .= v : fields) includes excludes json
      | Just key <- lookup arg numberKeys = value rest $ \v more -> case readMaybe v :: Maybe Int of
          Nothing -> Left (key ++ " must be an integer.")
          Just number -> go more (fromStringKey key .= number : fields) includes excludes json
      | arg == "--include" = value rest $ \v more -> go more fields (includes ++ [v]) excludes json
      | arg == "--exclude" = value rest $ \v more -> go more fields includes (excludes ++ [v]) json
      | otherwise = Left ("Unknown option: " ++ arg)
      where value [] _ = Left ("Missing value for " ++ arg)
            value (v:more) f | "--" `T.isPrefixOf` T.pack v = Left ("Missing value for " ++ arg)
                             | otherwise = f v more
    stringKeys = [("--root", "root"), ("--file", "file"), ("--module", "module"), ("--symbol", "symbol"), ("--snapshot", "snapshot"), ("--ghc", "ghcPath"), ("--cache-dir", "cacheDir")]
    numberKeys = [("--line", "line"), ("--offset", "offset"), ("--max-chars", "maxChars"), ("--max-files", "maxFiles")]
    fromStringKey = fromString
