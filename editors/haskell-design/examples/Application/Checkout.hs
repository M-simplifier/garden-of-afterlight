module Application.Checkout where

import Control.Monad.Trans.Reader (ReaderT, ask)
import Control.Monad.IO.Class (liftIO)
import Domain.Order

data Env = Env { saveOrder :: Order -> IO () }
type App = ReaderT Env IO

-- | 注文を確定し、保存する。
checkout :: Order -> App (Either ConfirmError Order)
checkout order = do
  env <- ask
  case confirm order of
    Left err -> pure (Left err)
    Right confirmed -> do
      liftIO (saveOrder env confirmed)
      pure (Right confirmed)
