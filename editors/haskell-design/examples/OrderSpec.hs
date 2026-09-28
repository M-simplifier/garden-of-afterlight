module OrderSpec where

import Domain.Order

-- | 確定は冪等ではない。二度目は明示的なエラーになる。
prop_confirmTwice :: OrderId -> Bool
prop_confirmTwice ident =
  case confirm (Order ident Draft) of
    Left _ -> False
    Right order -> confirm order == Left AlreadyConfirmed
