module HaskellDesign.Project
  ( project, projectTree, sourceSymbols, symbolsTree, renderDesign ) where

import Data.Char (isAlphaNum, isLetter)
import Data.Foldable (toList)
import Data.List (find, foldl', nub)
import qualified Data.Map.Strict as M
import Data.Maybe (fromMaybe, isNothing, maybeToList)
import qualified Data.Sequence as S
import qualified Data.Set as Set
import Data.Text (Text)
import qualified Data.Text as T
import System.FilePath (takeBaseName)
import HaskellDesign.Model
import HaskellDesign.Tree

structural :: Set.Set Text
structural = Set.fromList ["data_type", "newtype", "type_synomym", "type_family", "type_instance", "data_instance", "deriving_instance", "fixity", "role_annotation", "kind_signature", "foreign_import", "foreign_export"]
isComment, isBinding :: Node -> Bool
isComment n = nType n `elem` ["comment", "haddock"]
isBinding n = nType n `elem` ["function", "bind"]
topNodes :: Node -> [Node]
topNodes = concatMap (\n -> if nType n `elem` ["imports", "declarations"] then children n else [n]) . children

normalizeName :: Text -> Text
normalizeName t = case T.stripPrefix "(" t >>= T.stripSuffix ")" of
  Just inner | not (T.any (`elem` [' ', '\t', '\n', '\r']) inner) -> inner
  _ -> t
namesOf :: Node -> [Text]
namesOf n
  | Just ns <- child "names" n = map (normalizeName . nText) (children ns)
  | Just name <- child "name" n = [normalizeName (nText name)]
  | Just op <- find ((== "infix") . nType) (children n) >>= child "operator" = [nText op]
  | Just pat <- child "pattern" n = map nText (descendants ((== "variable") . nType) pat)
  | otherwise = []
references :: Node -> [Reference]
references = map (\n -> Reference (nText n) (nLine n) (nColumn n) Nothing)
  . descendants (\n -> nType n `elem` ["name", "variable", "constructor", "operator"])
stripImplementation :: Node -> Text
stripImplementation n
  | nType n `elem` ["class", "instance"], Just body <- child "declarations" n =
    let kept = filter (\c -> nType c == "signature" || Set.member (nType c) structural || isComment c) (children body)
        before = sliceBefore n body
        header = T.stripEnd (fromMaybe before (T.stripSuffix "where" (T.stripEnd (T.dropWhileEnd (== '{') (T.stripEnd before)))) )
        indent = T.intercalate "\n  " . map T.stripStart . T.lines . T.strip . nText
    in if null kept then header else header <> " where\n" <> T.intercalate "\n" (map (("  " <>) . indent) kept)
  | otherwise = nText n

-- Byte offsets and Text character indexes are deliberately not interchanged.
sliceBefore :: Node -> Node -> Text
sliceBefore outer inner = go (nStart inner - nStart outer) (nText outer)
  where
    go count = T.pack . takeBytes count . T.unpack
    takeBytes _ [] = []
    takeBytes remaining (c:cs)
      | remaining <= 0 = []
      | otherwise = c : takeBytes (remaining - utf8Width c) cs
    utf8Width c | fromEnum c <= 0x7f = 1 | fromEnum c <= 0x7ff = 2 | fromEnum c <= 0xffff = 3 | otherwise = 4

data Projection = Projection
  { pDecls :: S.Seq Declaration, pDocs :: [Text], pSigs :: M.Map Text Int, pPatterns :: M.Map Text Int, pIssues :: [Text] }
emptyProjection :: Projection
emptyProjection = Projection S.empty [] M.empty M.empty []
add :: Node -> Text -> [Text] -> Text -> Projection -> (Int, Projection)
add n kind names text state =
  let index = S.length (pDecls state)
      decl = Declaration (kind <> ":" <> T.intercalate "," names <> ":" <> tshow (nLine n - 1)) names kind (nLine n) (nEndLine n) (T.strip text) (T.intercalate "\n" (pDocs state)) "" False (references n)
  in (index, state { pDecls = pDecls state S.|> decl, pDocs = [] })
adjust :: Int -> (Declaration -> Declaration) -> Projection -> Projection
adjust index f state = state { pDecls = S.adjust' f index (pDecls state) }
tshow :: Show a => a -> Text
tshow = T.pack . show

patternForm :: Node -> (Maybe Node, [Text])
patternForm n =
  let form = find (\c -> nType c `elem` ["signature", "equation"]) (children n)
      names = maybe [] (map nText . descendants (\c -> nType c `elem` ["constructor", "constructor_operator"])) (form >>= child "synonym")
  in (form, names)

project :: Text -> FilePath -> Maybe Verification -> IO Design
project source file verification
  | utf16Length source > 2000000 = pure (Design file (T.pack (takeBaseName file)) (hash source) "" [] [] Unknown [] ["2 MBを超えるファイルは解析対象外です。"] False Nothing "")
  | otherwise = parseSource source >>= pure . projectTree source file verification

projectTree :: Text -> FilePath -> Maybe Verification -> Node -> Design
projectTree source file verification tree =
  let digest = hash source
      proof = verification >>= \v -> if verSourceHash v == digest then Just v else Nothing
      verified = maybe False (isNothing . verError) proof
      inferred = M.fromList [(sigName s, sigType s) | v <- maybeToList proof, s <- verSignatures v]
      top = topNodes tree
      header = maybe "" nText (find ((== "header") . nType) top)
      moduleName = fromMaybe (T.pack (takeBaseName file)) (find ((== "header") . nType) top >>= child "module" >>= pure . nText)
      projection = foldl' (step inferred) emptyProjection top
      identifiers = concatMap (descendants (\n -> nType n `elem` ["name", "variable"])) (filter (\n -> nType n `notElem` ["header", "import"]) top)
      ioNames = ["IO", "MonadIO", "MonadUnliftIO", "unsafePerformIO", "unsafeDupablePerformIO", "unsafeIOToST", "unsafeInterleaveIO"]
      syntaxEvidence = [Evidence (nText n) (nLine n) IOUsed Nothing "ソースの型・制約・式にIOが現れます。" | not verified, n <- identifiers, nText n `elem` ioNames]
      relocate e = e { evidenceLine = maybe (evidenceLine e) nLine (find ((== evidenceName e) . nText) identifiers) }
      evidence = syntaxEvidence ++ maybe [] (map relocate . verEvidence) proof
      issues = ["構文エラー、または未対応の構文があります。表示できた宣言のみを載せています。" | nError tree]
        ++ pIssues projection ++ maybe [] (maybeToList . verError) proof
      status = if verified then maybe Unknown verStatus proof else if any ((== IOUsed) . evidenceStatus) evidence then IOUsed else Unknown
      design = Design file moduleName digest header [nText n | n <- top, nType n == "import"] (toList (pDecls projection)) status evidence (nub issues) verified proof ""
  in design { designText = renderDesign design }

step :: M.Map Text Text -> Projection -> Node -> Projection
step inferred state n
  | isComment n = state { pDocs = pDocs state ++ [nText n] }
  | nType n `elem` ["header", "import"] = state
  | nType n == "pragma" = snd (add n "pragma" [] (nText n) state)
  | nType n == "signature" =
      let names = namesOf n; (index, next) = add n "signature" names (nText n) state
      in next { pSigs = foldl' (\m name -> M.insert name index m) (pSigs next) names }
  | isBinding n = foldl' binding state (nonempty ("binding@" <> tshow (nLine n)) (namesOf n))
  | Set.member (nType n) structural || nType n `elem` ["class", "instance"] =
      let (index, next) = add n (nType n) (namesOf n) (stripImplementation n) state
      in if nType n `elem` ["class", "instance"] then adjust index (\d -> d { declImplementation = nText n }) next else next
  | nType n == "pattern_synonym" =
      let (form, rawNames) = patternForm n
          names = nonempty ("pattern@" <> tshow (nLine n)) rawNames
      in if maybe False ((== "signature") . nType) form
         then let (index, next) = add n "pattern" names (nText n) state
              in next { pPatterns = foldl' (\m name -> M.insert name index m) (pPatterns next) names }
         else case names of
           [] -> state
           name:_ -> let (index, next) = case M.lookup name (pPatterns state) of
                           Just i -> (i, appendDocs i state)
                           Nothing -> let (i, s) = add n "pattern" [name] ("pattern " <> name <> " :: ?  -- 型署名なし・定義を開いて確認") state
                                      in (i, s { pPatterns = M.insert name i (pPatterns s), pIssues = pIssues s ++ ["型署名のないパターンシノニムがあります。元の定義を確認してください。"] })
                     in adjust index (\d -> d { declImplementation = joinBody (declImplementation d) (nText n), declEndLine = nEndLine n }) next
  | otherwise =
      let (index, next) = add n "unrecognised" [] ("-- " <> tshow (nLine n) <> "行目: " <> nType n <> "（ソースで確認）") state
      in (adjust index (\d -> d { declImplementation = nText n }) next) { pIssues = pIssues next ++ [tshow (nLine n) <> "行目の " <> nType n <> " は設計抽出の対象外です。"] }
  where
    binding s name =
      let (index, next) = case M.lookup name (pSigs s) of
            Just i -> (i, appendDocs i s)
            Nothing ->
              let ty = M.lookup name inferred
                  displayed = if validIdentifier name then name else "(" <> name <> ")"
                  (i, s') = add n "signature" [name] (displayed <> " :: " <> fromMaybe "?  -- GHCで型を確認" ty) s
                  enrich d = d { declInferred = maybe False (const True) ty
                    , declReferences = declReferences d ++ [Reference token (declLine d) 0 (Just True) | value <- maybeToList ty, token <- typeTokens value, all ((/= token) . refName) (declReferences d)] }
              in (i, (adjust i enrich s') { pSigs = M.insert name i (pSigs s') })
      in adjust index (\d -> d { declImplementation = joinBody (declImplementation d) (nText n), declEndLine = max (declEndLine d) (nEndLine n) }) next

nonempty :: a -> [a] -> [a]
nonempty fallback [] = [fallback]
nonempty _ xs = xs
joinBody :: Text -> Text -> Text
joinBody old new = if T.null old then new else old <> "\n" <> new
appendDocs :: Int -> Projection -> Projection
appendDocs index s = if null (pDocs s) then s else (adjust index (\d -> d { declDocs = declDocs d <> "\n" <> T.intercalate "\n" (pDocs s) }) s) { pDocs = [] }
validIdentifier :: Text -> Bool
validIdentifier value = case T.uncons value of
  Just (c, rest) -> (isLetter c || c == '_') && T.all (\x -> isAlphaNum x || x `elem` ['_', '\'']) rest
  Nothing -> False
typeTokens :: Text -> [Text]
typeTokens = nub . filter (maybe False (\(c,_) -> c >= 'A' && c <= 'Z') . T.uncons) . T.split (\c -> not (isAlphaNum c || c `elem` ['_', '\'']))

renderDesign :: Design -> Text
renderDesign design = T.intercalate "\n\n" (filter (not . T.null)
  ([designHeader design, T.intercalate "\n" (designImports design)] ++ [T.intercalate "\n" (filter (not . T.null) [declDocs d, declDesign d]) | d <- designDeclarations design])) <> "\n"

sourceSymbols :: Text -> IO [SourceSymbol]
sourceSymbols source
  | utf16Length source > 2000000 = ioError (userError "Source size limit reached (2 MB).")
  | otherwise = symbolsTree <$> parseSource source
symbolsTree :: Node -> [SourceSymbol]
symbolsTree = visit Nothing . topNodes
  where
    visit owner nodes =
      let signatures = M.fromList [(name, n) | n <- nodes, nType n == "signature" || nType n == "pattern_synonym" && maybe False ((== "signature") . nType) (fst (patternForm n)), name <- if nType n == "pattern_synonym" then snd (patternForm n) else namesOf n]
          make n names = SourceSymbol names (nType n) (nLine n) (nEndLine n) owner Nothing (nText n)
          walk (items, grouped) n
            | isComment n || nType n `elem` ["header", "import", "signature"] = (items, grouped)
            | nType n == "pattern_synonym", Just form <- fst (patternForm n), nType form == "signature" = (items, grouped)
            | isBinding n || nType n == "pattern_synonym" =
              let names = if nType n == "pattern_synonym" then snd (patternForm n) else namesOf n
                  key = if null names then "@" <> tshow (nStart n) else T.intercalate "\0" names
              in case M.lookup key grouped of
                Just i -> (S.adjust' (\s -> s { symbolSource = symbolSource s <> "\n" <> nText n, symbolEndLine = nEndLine n }) i items, grouped)
                Nothing ->
                  let sigs = nub [nText sig | name <- names, sig <- maybeToList (M.lookup name signatures)]
                      sigNode = find (\candidate -> any (\name -> maybe False ((== nText candidate) . nText) (M.lookup name signatures)) names) nodes
                      symbol = (make n names) { symbolLine = maybe (nLine n) nLine sigNode, symbolSignature = if null sigs then Nothing else Just (T.intercalate "\n" sigs) }
                  in (items S.|> symbol, M.insert key (S.length items) grouped)
            | otherwise =
              let nested = if nType n `elem` ["class", "instance"] then case child "declarations" n of
                             Just body -> visit (Just (T.strip (sliceBefore n body))) (children body)
                             Nothing -> []
                           else []
              in (items S.>< S.fromList (make n (namesOf n) : nested), grouped)
          (resultItems, resultGroups) = foldl' walk (S.empty, M.empty) nodes
          bound = [name | index <- M.elems resultGroups, symbol <- maybeToList (S.lookup index resultItems), name <- symbolNames symbol]
          signatureNames = nub [name | n <- nodes, name <- if nType n == "signature" then namesOf n else if nType n == "pattern_synonym" then snd (patternForm n) else [], M.member name signatures]
      in toList resultItems ++ [(make n [name]) { symbolKind = "signature" } | name <- signatureNames, name `notElem` bound, n <- maybeToList (M.lookup name signatures)]
