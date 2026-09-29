{-# LANGUAGE ForeignFunctionInterface #-}
module HaskellDesign.Tree
  ( Node (..), parseSource, child, children, descendants, utf16Length ) where

import Control.Exception (bracket)
import Control.Monad (forM, unless)
import qualified Data.ByteString as B
import Data.Maybe (listToMaybe)
import Data.Text (Text)
import qualified Data.Text as T
import qualified Data.Text.Encoding as E
import Foreign
import Foreign.C

data Parser
data Tree
data CNode
foreign import ccall unsafe "ts_parser_new" newParser :: IO (Ptr Parser)
foreign import ccall unsafe "ts_parser_delete" deleteParser :: Ptr Parser -> IO ()
foreign import ccall unsafe "ts_parser_set_timeout_micros" setTimeoutMicros :: Ptr Parser -> Word64 -> IO ()
foreign import ccall safe "ts_parser_parse_string" parse :: Ptr Parser -> Ptr Tree -> CString -> CUInt -> IO (Ptr Tree)
foreign import ccall unsafe "ts_tree_delete" deleteTree :: Ptr Tree -> IO ()
foreign import ccall unsafe "hd_set_language" setLanguage :: Ptr Parser -> IO CBool
foreign import ccall unsafe "hd_node_size" nodeSize :: IO CSize
foreign import ccall unsafe "hd_root" rootNode :: Ptr Tree -> Ptr CNode -> IO ()
foreign import ccall unsafe "hd_count" count :: Ptr CNode -> IO CUInt
foreign import ccall unsafe "hd_child" namedChild :: Ptr CNode -> CUInt -> Ptr CNode -> IO ()
foreign import ccall unsafe "hd_field" fieldName :: Ptr CNode -> CUInt -> IO CString
foreign import ccall unsafe "hd_type" nodeType :: Ptr CNode -> IO CString
foreign import ccall unsafe "hd_start" start :: Ptr CNode -> IO CUInt
foreign import ccall unsafe "hd_end" end :: Ptr CNode -> IO CUInt
foreign import ccall unsafe "hd_line" line :: Ptr CNode -> IO CUInt
foreign import ccall unsafe "hd_end_line" endLine :: Ptr CNode -> IO CUInt
foreign import ccall unsafe "hd_column" column :: Ptr CNode -> IO CUInt
foreign import ccall unsafe "hd_error" hasError :: Ptr CNode -> IO CBool

-- Text slices are lazy and backed by immutable input, never by a C tree handle.
-- Position columns use UTF-16 units to match VS Code and the existing protocol.
data Node = Node
  { nType :: !Text, nStart :: !Int, nEnd :: !Int
  , nLine :: !Int, nEndLine :: !Int, nColumn :: Int
  , nText :: Text, nError :: !Bool, nChildren :: [(Maybe Text, Node)] }

utf16Length :: Text -> Int
utf16Length = T.foldl' (\n c -> n + if fromEnum c > 0xffff then 2 else 1) 0
children :: Node -> [Node]
children = map snd . nChildren
child :: Text -> Node -> Maybe Node
child key = fmap snd . listToMaybe . filter ((== Just key) . fst) . nChildren
descendants :: (Node -> Bool) -> Node -> [Node]
descendants match node = [node | match node] ++ concatMap (descendants match) (children node)

parseSource :: Text -> IO Node
parseSource source = bracket newParser deleteParser $ \parser -> do
  unless (parser /= nullPtr) $ ioError (userError "Could not allocate Haskell parser.")
  valid <- setLanguage parser
  unless (valid /= 0) $ ioError (userError "Tree-sitter grammar ABI mismatch.")
  setTimeoutMicros parser 5000000
  let bytes = E.encodeUtf8 source
  B.useAsCStringLen bytes $ \(input, len) -> bracket (parse parser nullPtr input (fromIntegral len)) deleteTree $ \tree -> do
    unless (tree /= nullPtr) $ ioError (userError "Could not parse Haskell source.")
    size <- fromIntegral <$> nodeSize
    allocaBytes size $ \root -> rootNode tree root >> copyNode bytes size root

copyNode :: B.ByteString -> Int -> Ptr CNode -> IO Node
copyNode bytes size node = do
  kind <- nodeType node >>= B.packCString >>= pure . E.decodeUtf8
  first <- fromIntegral <$> start node
  lastByte <- fromIntegral <$> end node
  row <- (+1) . fromIntegral <$> line node
  lastRow <- (+1) . fromIntegral <$> endLine node
  col <- fromIntegral <$> column node
  broken <- (/=0) <$> hasError node
  total <- fromIntegral <$> count node
  nested <- forM [0 .. total - 1 :: Int] $ \index -> do
    field <- fieldName node (fromIntegral index)
    name <- if field == nullPtr then pure Nothing else Just . E.decodeUtf8 <$> B.packCString field
    value <- allocaBytes size $ \out -> namedChild node (fromIntegral index) out >> copyNode bytes size out
    pure (name, value)
  pure Node { nType = kind, nStart = first, nEnd = lastByte, nLine = row, nEndLine = lastRow
    , nColumn = utf16Length (E.decodeUtf8 (B.take col (B.drop (first - col) bytes)))
    , nText = E.decodeUtf8 (B.take (lastByte - first) (B.drop first bytes)), nError = broken, nChildren = nested }
