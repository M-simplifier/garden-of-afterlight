{-# LANGUAGE ScopedTypeVariables #-}
module Main (main) where

import Control.Exception (SomeException, displayException, try)
import Data.Aeson
import Data.Aeson.Types (parseEither)
import qualified Data.ByteString as B
import qualified Data.ByteString.Lazy as L
import Data.Text (Text)
import qualified Data.Text.Encoding as E
import GHC.IO.Encoding (setLocaleEncoding)
import System.Environment (getArgs, getExecutablePath)
import System.Exit (exitFailure)
import System.FilePath ((</>), takeDirectory)
import System.IO
import HaskellDesign.Project
import HaskellDesign.Reader

handle :: FilePath -> Value -> IO Value
handle helper value = case parseEither (withObject "request" $ \o -> (,,,,) <$> o .:? "command" .!= ("project" :: Text) <*> o .:? "source" .!= "" <*> o .:? "file" .!= "Main.hs" <*> o .:? "verification" <*> o .:? "request") value of
  Left e -> ioError (userError e)
  Right (command, source, file, proof, request) -> case command of
    "project" -> toJSON <$> project source file proof
    "symbols" -> toJSON <$> sourceSymbols source
    "read" -> maybe (ioError (userError "Missing read request")) (fmap toJSON . readPage helper) request
    _ -> ioError (userError "Unknown native command")

respond :: FilePath -> B.ByteString -> IO ()
respond helper input = do
  let request = eitherDecodeStrict' input
      requestId = case request >>= parseEither (withObject "request" (.:? "id")) of Right x -> x; Left _ -> Nothing :: Maybe Value
  outcome <- try $ if B.length input > 16000000 then ioError (userError "Request exceeds 16 MB.") else either (ioError . userError) (handle helper) request
  let output = case outcome of
        Right result -> object ["id" .= requestId, "result" .= result]
        Left (err :: SomeException) -> object ["id" .= requestId, "error" .= displayException err]
  L.hPut stdout (encode output <> "\n")
  hFlush stdout

main :: IO ()
main = do
  setLocaleEncoding utf8
  hSetBinaryMode stdin True
  hSetBinaryMode stdout True
  args <- getArgs
  helper <- (\p -> takeDirectory p </> ".." </> "compiler" </> "Main.hs") <$> getExecutablePath
  let loop = do
        done <- hIsEOF stdin
        if done then pure () else B.hGetLine stdin >>= respond helper >> loop
      run = case args of
        ["--serve"] -> loop
        ["--rpc"] -> B.getContents >>= respond helper
        _ | null args || "--help" `elem` args -> B.putStr (E.encodeUtf8 helpText)
        _ -> case parseArguments args of
          Left err -> ioError (userError err)
          Right (request, json) -> do
            page <- readPage helper request
            if json then L.hPut stdout (encode page <> "\n") else B.putStr (E.encodeUtf8 (pageText page))
  outcome <- try run
  case outcome of
    Right () -> pure ()
    Left (err :: SomeException) -> hPutStrLn stderr (displayException err) >> exitFailure
