{-# LANGUAGE DeriveAnyClass #-}
module HaskellDesign.Model where

import Data.Aeson
import qualified Data.ByteString as B
import qualified Crypto.Hash.SHA256 as SHA256
import Data.Char (toLower)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as E
import GHC.Generics (Generic)
import Numeric (showHex)

data Status = Pure | IOUsed | Unknown deriving (Eq, Show)
instance ToJSON Status where
  toJSON Pure = String "pure"
  toJSON IOUsed = String "io"
  toJSON Unknown = String "unknown"
instance FromJSON Status where
  parseJSON = withText "Status" $ \s -> case s of
    "pure" -> pure Pure; "io" -> pure IOUsed; "unknown" -> pure Unknown
    _ -> fail "Unknown analysis status"

jsonOptions :: Int -> Options
jsonOptions prefix = defaultOptions { fieldLabelModifier = lower . drop prefix, omitNothingFields = True }
  where lower [] = []; lower (c:cs) = toLower c : cs

data Evidence = Evidence { evidenceName :: Text, evidenceLine :: Int, evidenceStatus :: Status, evidenceType :: Maybe Text, evidenceReason :: Text } deriving (Eq, Show, Generic)
instance ToJSON Evidence where toJSON = genericToJSON (jsonOptions 8)
instance FromJSON Evidence where
  parseJSON = withObject "Evidence" $ \o -> Evidence <$> o .: "name" <*> o .: "line" <*> o .: "status" <*> o .:? "type" <*> o .:? "reason" .!= ""
data Reference = Reference { refName :: Text, refLine :: Int, refColumn :: Int, refInferred :: Maybe Bool } deriving (Eq, Show, Generic)
instance ToJSON Reference where toJSON = genericToJSON (jsonOptions 3)
data Declaration = Declaration
  { declId :: Text, declNames :: [Text], declKind :: Text, declLine :: Int, declEndLine :: Int
  , declDesign :: Text, declDocs :: Text, declImplementation :: Text, declInferred :: Bool, declReferences :: [Reference]
  } deriving (Eq, Show, Generic)
instance ToJSON Declaration where toJSON = genericToJSON (jsonOptions 4)
data Signature = Signature { sigName :: Text, sigType :: Text, sigLine :: Int } deriving (Eq, Show, Generic)
instance ToJSON Signature where toJSON = genericToJSON (jsonOptions 3)
instance FromJSON Signature where parseJSON = genericParseJSON (jsonOptions 3)
data Verification = Verification
  { verStatus :: Status, verSourceHash :: Text, verSignatures :: [Signature], verEvidence :: [Evidence]
  , verError :: Maybe Text, verWorkspaceHash :: Maybe Text, verDependencies :: Maybe [FilePath]
  } deriving (Eq, Show, Generic)
instance ToJSON Verification where toJSON = genericToJSON (jsonOptions 3)
instance FromJSON Verification where parseJSON = genericParseJSON (jsonOptions 3)
data Design = Design
  { designFile :: FilePath, designModule :: Text, designSourceHash :: Text, designHeader :: Text
  , designImports :: [Text], designDeclarations :: [Declaration], designStatus :: Status
  , designEvidence :: [Evidence], designIssues :: [Text], designVerified :: Bool
  , designVerification :: Maybe Verification, designText :: Text
  } deriving (Eq, Show, Generic)
instance ToJSON Design where toJSON = genericToJSON (jsonOptions 6)
data SourceSymbol = SourceSymbol
  { symbolNames :: [Text], symbolKind :: Text, symbolLine :: Int, symbolEndLine :: Int
  , symbolOwner :: Maybe Text, symbolSignature :: Maybe Text, symbolSource :: Text
  } deriving (Eq, Show, Generic)
instance ToJSON SourceSymbol where toJSON = genericToJSON (jsonOptions 6)

hash :: Text -> Text
hash = T.pack . concatMap byteHex . B.unpack . SHA256.hash . E.encodeUtf8
  where byteHex n = let s = showHex n "" in if length s == 1 then '0':s else s
