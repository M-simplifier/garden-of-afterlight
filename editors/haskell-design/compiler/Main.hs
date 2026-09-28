{-# LANGUAGE LambdaCase #-}
-- This helper uses the GHC 9.6 API. It typechecks and desugars; it never runs main.
module Main where

import GHC hiding (exprType)
import GHC.Builtin.Names (ioTyConName)
import GHC.Builtin.Types.Prim (statePrimTyCon, realWorldTyCon)
import GHC.Core
import GHC.Core.DataCon
import GHC.Core.Class (ClassATItem(..), classATItems)
import GHC.Core.Coercion.Axiom (coAxiomBranches, fromBranches, coAxBranchRHS)
import GHC.Core.FamInstEnv (fi_fam, famInstRHS, reduceTyFamApp_maybe)
import GHC.Core.Reduction (reductionReducedType)
import Language.Haskell.Syntax.Basic (Role(..))
import GHC.Core.TyCo.Rep (Type(..), Scaled(..))
import GHC.Core.TyCon
import GHC.Core.Type
import GHC.Core.Utils (exprType)
import GHC.Driver.Session
import GHC.Driver.Flags
import qualified GHC.LanguageExtensions.Type as LangExt
import GHC.Driver.Env (hsc_logger, hscEPS)
import GHC.Unit.External (eps_fam_inst_env)
import GHC.Tc.Types (tcg_fam_inst_env)
import GHC.Types.Name hiding (varName)
import GHC.Types.Var
import GHC.Types.Id (isImplicitId)
import GHC.Types.Basic (Origin(..))
import GHC.Unit.Module.ModGuts
import GHC.Unit.Module.Graph
import GHC.Utils.Outputable (ppr)
import GHC.Driver.Ppr (showSDoc)
import Control.Exception (SomeException, displayException, try)
import Control.Monad (forM, unless, when)
import Control.Monad.IO.Class
import Data.Char (ord)
import Data.Data (Data, cast, gmapQ)
import Data.List (find, nub)
import Data.Maybe (catMaybes)
import Numeric (showHex)
import System.Directory (canonicalizePath)
import System.Environment (getArgs)
import System.Exit (exitFailure)
import System.IO (hPutStrLn, hSetEncoding, stdout, stderr, utf8)

-- Find concrete IO, not a proof that every instantiation is pure. Abstract
-- effects and unavailable family reductions add no evidence of their own.
-- Bound recursive expansion and stop as soon as an IO occurrence is found.
containsIO :: (TyCon -> Bool) -> (TyCon -> [Type] -> Maybe Type) -> Int -> [TyCon] -> Type -> Bool
containsIO inspectFields reduceFamily depth seen ty
  | depth <= 0 = False
  | Just expanded <- coreView ty = containsIO inspectFields reduceFamily (depth - 1) seen expanded
  | otherwise = case ty of
      TyConApp tc args
        | tyConName tc == ioTyConName -> True
        | tc == statePrimTyCon && any isRealWorld args -> True
        | Just reduced <- reduceFamily tc args -> any recurse args || recurse reduced
        | otherwise -> any recurse args || fields tc args
      AppTy a b -> recurse a || recurse b
      ForAllTy _ body -> recurse body
      FunTy _ _ a b -> recurse a || recurse b
      CastTy a _ -> recurse a
      _ -> False
  where
    isRealWorld (TyConApp tc _) = tc == realWorldTyCon
    isRealWorld _ = False
    recurse = containsIO inspectFields reduceFamily (depth - 1) seen
    fields tc args
      | tc `elem` seen || isFamilyTyCon tc = False
      -- Library abstractions such as Aeson's pure Encoding carry IO in their
      -- private builder representation. Inspect source-module fields; imported
      -- abstractions are inspected only through their API types.
      -- Class dictionaries expose public methods and superclasses, including
      -- MonadIO through constraint aliases, so inspect those across this boundary.
      | not (inspectFields tc), Nothing <- tyConClass_maybe tc = False
      | isAlgTyCon tc && length args >= length (tyConTyVars tc) =
          let subst = substTyWith (tyConTyVars tc) (take (length (tyConTyVars tc)) args)
          in or [ containsIO inspectFields reduceFamily (depth - 1) (tc:seen) (subst arg)
                | dc <- tyConDataCons tc, Scaled _ arg <- dataConOrigArgTys dc ]
      | otherwise = False

-- Inspect unoptimised Core so IO in non-exported helpers and expressions counts.
coreTypes :: CoreExpr -> [Type]
coreTypes e = case e of
  Var v -> [varType v]
  Lit _ -> []
  App f x -> exprType e : coreTypes f ++ coreTypes x
  Lam b x -> varType b : coreTypes x
  Let b x -> concatMap (coreTypes . snd) (flattenBinds [b]) ++ coreTypes x
  Case x b _ alts -> varType b : coreTypes x ++ concatMap (\(Alt _ bs rhs) -> map varType bs ++ coreTypes rhs) alts
  Cast x _ -> exprType e : coreTypes x
  Tick _ x -> coreTypes x
  Type t -> [t]
  Coercion _ -> []

bindingHasIO :: (Type -> Bool) -> Id -> CoreExpr -> Bool
bindingHasIO inspect ident body = inspect (varType ident) || any inspect (coreTypes body)

-- Keep evidence from dead local bindings as well: desugaring can discard them.
typedIds :: Data a => a -> [Id]
typedIds node = case cast node of
  Just v -> [v | isId v]
  Nothing -> concat (gmapQ typedIds node)

-- GHC copies imported instance defaults into this module during desugaring,
-- including their compulsory unfoldings. Their generated bodies are library
-- implementation, not source expressions. Use the AST origin (never a name
-- prefix) to distinguish them from user-written instance methods such as $c==.
generatedBindings :: Data a => a -> [Name]
generatedBindings node = case (cast node :: Maybe (HsBind GhcTc)) of
  Just FunBind{fun_id = L _ ident, fun_matches = MG{mg_ext = ext}}
    | mg_origin ext == Generated -> [varName ident]
  Just (XHsBindsLR AbsBinds{abs_exports = exports, abs_binds = binds}) ->
    let names = generatedBindings binds
    in names ++ [varName (abe_poly e) | e <- exports, varName (abe_mono e) `elem` names]
  _ -> concat (gmapQ generatedBindings node)

js :: String -> String
js s = '"' : concatMap escape s ++ "\""
  where
    escape '"' = "\\\""
    escape '\\' = "\\\\"
    escape '\n' = "\\n"
    escape '\r' = "\\r"
    escape '\t' = "\\t"
    escape c | ord c < 32 = let h = showHex (ord c) "" in "\\u" ++ replicate (4 - length h) '0' ++ h
             | otherwise = [c]

obj :: [(String, String)] -> String
obj pairs = "{" ++ comma [js k ++ ":" ++ v | (k,v) <- pairs] ++ "}"
arr :: [String] -> String
arr xs = "[" ++ comma xs ++ "]"
comma :: [String] -> String
comma [] = ""
comma [x] = x
comma (x:xs) = x ++ "," ++ comma xs

location :: Name -> Int
location n = case nameSrcSpan n of RealSrcSpan s _ -> srcSpanStartLine s; _ -> 1
label :: Name -> String
label = occNameString . nameOccName
statusName :: Bool -> String
statusName True = "io"
statusName False = "pure"

analyse :: FilePath -> [FilePath] -> [String] -> IO [String]
analyse libdir files options = runGhc (Just libdir) $ do
  defaults <- getSessionDynFlags
  logger <- hsc_logger <$> getSession
  -- Analyse unoptimised source code without optional library unfoldings.
  -- Compulsory instance-default copies are distinguished by AST origin below.
  (flags, leftovers, _) <- parseDynamicFlags logger defaults (map noLoc (options ++ ["-O0", "-fignore-interface-pragmas", "-fno-code", "-fno-defer-type-errors", "-fno-defer-typed-holes", "-fno-defer-out-of-scope-variables"]))
  unless (null leftovers) $ liftIO $ fail "Unrecognised GHC options"
  _ <- setSessionDynFlags flags { ghcLink = NoLink, verbosity = 0 }
  targets <- mapM (\file -> guessTarget file Nothing Nothing) files
  setTargets targets
  -- A proof can be reused only when all mutable home-module inputs are tracked.
  -- CPP, custom preprocessors and plugins can read arbitrary non-.hs inputs.
  let untracked df = xopt LangExt.Cpp df || xopt LangExt.TemplateHaskell df || xopt LangExt.QuasiQuotes df || gopt Opt_Pp df || not (null (pluginModNames df)) || not (null (externalPluginSpecs df))
      rejectUntracked dfs = when (any untracked dfs) $
        liftIO $ fail "CPP・Template Haskell・QuasiQuotes・独自プリプロセッサ・コンパイラプラグインを使うソース依存があります。この版では入力の変更を追跡できないため、GHCの確認結果を保持しません。設計ビューは利用できます。"
  rejectUntracked [flags]
  graph <- depanal [] False
  rejectUntracked (map ms_hspp_opts (mgModSummaries graph))
  -- A module pragma can override the no-defer flags. Do not publish type
  -- information that GHC accepted by postponing errors until runtime.
  when (any (\s -> any (\flag -> gopt flag (ms_hspp_opts s)) [Opt_DeferTypeErrors, Opt_DeferTypedHoles, Opt_DeferOutOfScopeVariables]) (mgModSummaries graph)) $
    liftIO $ fail "エラーを実行時まで延期する設定があるため、型情報を解析できません。"
  -- An ANN pragma can evaluate code even without TemplateHaskell enabled.
  forM (mgModSummaries graph) $ \summary -> do
    parsed <- parseModule summary
    let annotation (L _ AnnD{}) = True
        annotation _ = False
    when (any annotation (hsmodDecls (unLoc (pm_parsed_source parsed)))) $
      liftIO $ fail "ANNアノテーションの評価は実行しません。設計ビューは利用できます。"
  result <- load LoadAllTargets
  case result of Failed -> liftIO $ fail "GHC could not typecheck the module"; Succeeded -> pure ()
  forM files $ \file -> do
    wanted <- liftIO $ canonicalizePath file
    matches <- forM (mgModSummaries graph) $ \summary -> do
      path <- liftIO $ traverse canonicalizePath (ml_hs_file (ms_location summary))
      pure $ if path == Just wanted then Just summary else Nothing
    summary <- case catMaybes matches of
      s:_ -> pure s
      [] -> liftIO $ fail "GHC did not load the requested source file"
    typed <- parseModule summary >>= typecheckModule
    desugared <- desugarModule typed
    env <- getSession
    external <- liftIO $ hscEPS env
    info <- getModuleInfo (ms_mod summary) >>= maybe (liftIO $ fail "No module information") pure
    dflags <- getSessionDynFlags
    let rendered = showSDoc dflags { pprCols = 100000 } . ppr
        local v = nameModule_maybe (varName v) == Just (ms_mod summary) && not (isImplicitId v) && take 1 (label (varName v)) /= "$"
        ids = [v | AnId v <- modInfoTyThings info, local v]
        signatures = [obj [("name", js (label (varName v))), ("type", js (rendered (varType v))), ("line", show (location (varName v)))] | v <- ids]
        binds = flattenBinds (mg_binds (coreModule desugared))
        homeModules = map ms_mod (mgModSummaries graph)
        familyEnvs = (eps_fam_inst_env external, tcg_fam_inst_env (fst (tm_internals_ typed)))
        reduceFamily tc args
          | isFamilyTyCon tc = reductionReducedType <$> reduceTyFamApp_maybe familyEnvs Nominal tc args
          | otherwise = Nothing
        inspectFields tc = maybe False (`elem` homeModules) (nameModule_maybe (tyConName tc))
        inspect = containsIO inspectFields reduceFamily 48 []
        generated = generatedBindings (tm_typechecked_source typed)
        -- Check every binding's type, and all bodies originating in this source,
        -- including user-written instance methods with generated Core names.
        checks = [(v, if varName v `elem` generated then inspect (varType v) else bindingHasIO inspect v rhs) | (v,rhs) <- binds]
        tycons = mg_tcs (coreModule desugared)
        constructors = [dataConWrapId dc | tc <- tycons, isAlgTyCon tc, dc <- tyConDataCons tc]
        declared = [(v, inspect (varType v)) | v <- ids ++ constructors]
        typeBodies = [(tyConName tc, rhs) | tc <- tycons, Just rhs <- [synTyConRhs_maybe tc]]
                  ++ [(tyConName tc, coAxBranchRHS branch) | tc <- tycons, Just axiom <- [isClosedSynFamilyTyConWithAxiom_maybe tc], branch <- fromBranches (coAxiomBranches axiom)]
                  ++ [(fi_fam inst, famInstRHS inst) | inst <- mg_fam_insts (coreModule desugared)]
                  ++ [(tyConName tc, rhs) | cls <- tycons, Just c <- [tyConClass_maybe cls], ATI tc (Just (rhs, _)) <- classATItems c]
        aliases = [(name, rhs, inspect rhs) | (name, rhs) <- typeBodies]
        sourceIO = [v | v <- typedIds (tm_typechecked_source typed), inspect (varType v)]
        overall = any snd (checks ++ declared) || any (\(_,_,found) -> found) aliases || not (null sourceIO)
        reasons = nub ([obj [("name", js (label (varName v))), ("line", show (location (varName v))), ("status", js "io"), ("type", js (rendered (varType v)))] | (v,found) <- checks ++ declared ++ [(v, True) | v <- sourceIO], found]
                    ++ [obj [("name", js (label n)), ("line", show (location n)), ("status", js "io"), ("type", js (rendered rhs))] | (n,rhs,found) <- aliases, found])
        reachable seen s
          | ms_mod s `elem` seen = []
          | otherwise = s : concat [reachable (ms_mod s : seen) dep | dep <- mgModSummaries graph, moduleName (ms_mod dep) `elem` map (unLoc . snd) (ms_textual_imps s ++ ms_srcimps s)]
        dependencies = [f | s <- reachable [] summary, Just f <- [ml_hs_file (ms_location s)]]
    pure $ obj [("status", js (statusName overall)), ("signatures", arr signatures), ("evidence", arr reasons), ("dependencies", arr (map js dependencies))]

main :: IO ()
main = do
  -- The JSON protocol and diagnostics are UTF-8, including on Windows hosts.
  hSetEncoding stdout utf8
  hSetEncoding stderr utf8
  args <- getArgs
  let run libdir files options batch = do
        result <- try (analyse libdir files options) :: IO (Either SomeException [String])
        case result of
          Right output -> putStrLn (if batch then arr output else head output)
          Left err -> hPutStrLn stderr (displayException err) >> exitFailure
  case args of
    "--batch":libdir:rest -> case break (== "--") rest of
      (files, _:options) | not (null files) -> run libdir files options True
      _ -> fail "Batch mode requires FILE ... -- GHC_OPTIONS"
    libdir:file:options -> run libdir [file] options False
    _ -> hPutStrLn stderr "Usage: haskell-design-ghc LIBDIR FILE [GHC_OPTION ...]" >> exitFailure
