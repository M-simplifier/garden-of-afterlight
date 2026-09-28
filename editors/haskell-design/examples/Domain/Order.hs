module Domain.Order where

-- | 注文が取りうる状態。
data OrderStatus = Draft | Confirmed | Cancelled
  deriving (Eq, Show)

newtype OrderId = OrderId Int
  deriving (Eq, Show)

data Order = Order
  { orderId :: OrderId
  , status :: OrderStatus
  } deriving (Eq, Show)

data ConfirmError = AlreadyConfirmed | AlreadyCancelled
  deriving (Eq, Show)

-- | 下書きの注文を確定する。確定済みの注文は再確定できない。
confirm :: Order -> Either ConfirmError Order
confirm order = case status order of
  Draft -> Right order { status = Confirmed }
  Confirmed -> Left AlreadyConfirmed
  Cancelled -> Left AlreadyCancelled

-- | 型を省略した関数も、GHCで確認すると推論型が見える。
isDraft order = status order == Draft
