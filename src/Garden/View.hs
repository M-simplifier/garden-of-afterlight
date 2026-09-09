{-# LANGUAGE StrictData #-}

module Garden.View (SceneView (..), KinView (..), EnemyView (..), Target (..), project, gemName, kinName, regionName, materialName, uiCorpus) where

import Data.Map.Strict (Map)
import Data.Map.Strict qualified as M
import Garden.Islands (islandHarbours)
import Garden.Raycast
import Garden.Rules (bonded, canCallNight, lampNear, sheltered)
import Garden.Types
import Garden.World (bodyCells)

data KinView = KinView V3 Gem Int Bool deriving (Eq, Show)

data EnemyView = EnemyView V3 Int Int Threat deriving (Eq, Show)

data Target = NoTarget | TerrainTarget Cell Cell Material Bool | EnemyTarget deriving (Eq, Show)

data SceneView = SceneView
  { sceneCells :: Map Cell Material,
    sceneRevision :: Int,
    sceneEdits :: Map Cell Int,
    sceneEye :: V3,
    sceneForward :: V3,
    sceneFeet :: V3,
    sceneTime :: Float,
    sceneVeil :: Float,
    sceneChapter :: Chapter,
    sceneLife :: Float,
    sceneKin :: [KinView],
    sceneEnemies :: [EnemyView],
    sceneBursts :: [Burst],
    sceneTarget :: Target,
    sceneSlots :: [(Material, Int)],
    sceneSelection :: Int,
    sceneGems :: [(Gem, Int)],
    sceneCharges :: Int,
    sceneBonded :: Int,
    sceneSheltered :: Int,
    sceneFlight :: Bool,
    sceneObjective :: String,
    sceneHint :: String,
    sceneNotice :: String,
    sceneSpeed :: Float,
    sceneDashRecovery :: Float
  }
  deriving (Eq, Show)

project :: World -> SceneView
project w =
  SceneView
    { sceneCells = (worldCells w),
      sceneRevision = (worldRevision w),
      sceneEdits = (worldEdits w),
      sceneEye = (eye p),
      sceneForward = (forward p),
      sceneFeet = (playerFeet p),
      sceneTime = (fromIntegral (unTick (worldTick w)) / 60),
      sceneVeil = (worldVeil w),
      sceneChapter = (worldChapter w),
      sceneLife = (worldLife w),
      sceneKin = [KinView (kinPosition k) (kinGem k) (kinBond k) (kinSheltered k) | k <- worldKin w],
      sceneEnemies = [EnemyView (adversaryPosition a) (adversaryHealth a) (adversaryWindup a) (adversaryKind a) | a <- worldAdversaries w],
      sceneBursts = (worldBursts w),
      sceneTarget = target,
      sceneSlots = slots,
      sceneSelection = (playerSlot p),
      sceneGems = [(g, M.findWithDefault 0 g (gems inv)) | g <- [Jade, Rose, Azure, Honey]],
      sceneCharges = (charges inv),
      sceneBonded = (bonded w),
      sceneSheltered = (sheltered w),
      sceneFlight = (worldFlight w),
      sceneObjective = objective,
      sceneHint = hint,
      sceneNotice = notice,
      sceneSpeed = (magnitude (playerVelocity p)),
      sceneDashRecovery = fromIntegral (playerDashCooldown p) / 65
    }
  where
    p = worldPlayer w
    inv = worldInventory w
    slots = [(m, materialCount inv m) | m <- take 6 (drop (playerSlot p `div` 6 * 6) hotbar)]
    target = case aimedEnemy w of
      Just _ -> EnemyTarget
      Nothing -> case raycast w 7 of
        Nothing -> NoTarget
        Just h ->
          TerrainTarget
            (hitCell h)
            (hitPrevious h)
            (hitMaterial h)
            (M.notMember (hitPrevious h) (worldCells w) && hitPrevious h `notElem` bodyCells (playerFeet p))
    near = [k | k <- worldKin w, distance (playerFeet p) (kinPosition k) < 4]
    hint = case near of
      k : _
        | worldChapter w == Nightfall && kinBond k >= 2 && not (kinSheltered k) ->
            if lampNear w (kinPosition k) then "F  この灯りの下へ迎え入れる" else "灯りを近くに置くと、この子を守れる"
      k : _ -> "F  宝石を贈る  ·  好物は" <> gemName (kinGem k)
      [] -> case target of
        EnemyTarget -> "左クリック  核を打つ  ·  E  予兆から回避"
        TerrainTarget _ _ (Ore g) _ -> "左クリック  " <> gemName g <> "を採る"
        TerrainTarget _ _ _ _ -> "左クリック  採掘     右クリック  置く"
        NoTarget -> if worldFlight w then "SPACE  上昇   CTRL  下降   SHIFT  加速" else "WASD  歩く   SPACE  跳ぶ   SHIFT  走る"
    objective
      | worldRestored w = "帰還の庭  ·  空の島へ、あなたの居場所を広げる"
      | worldFlight w = "環の光へ  ·  回廊の手前から、空へ上昇する"
      | worldChapter w == Nightfall = "灯りを置き、三者を守る  " <> show (sheltered w) <> " / 3"
      | canCallNight w = "灯りを用意したら N  ·  夜の訪れを受け入れる"
      | otherwise = "宝石を贈り、三者と結ぶ  " <> show (bonded w) <> " / 3"
    notice = if worldTick w < worldNoticeUntil w then noticeText (worldNotice w) else ""

gemName :: Gem -> String
gemName Jade = "翠晶"; gemName Rose = "薔薇晶"; gemName Azure = "蒼晶"; gemName Honey = "蜜晶"

kinName :: Gem -> String
kinName Jade = "鼓動を聴く者"
kinName Rose = "ひかりを編む者"
kinName Azure = "遠空を憶う者"
kinName Honey = "余光を抱く者"

regionName :: SceneView -> String
regionName view = case [name | (name, pos) <- islandHarbours, distance (sceneFeet view) pos < 48] of
  name : _ -> name
  [] -> "余光の庭"

materialName :: Material -> String
materialName Pearl = "白石"; materialName Foundation = "深層石"; materialName Gold = "金縁石"; materialName Moss = "苔石"; materialName Leaves = "光葉"; materialName Bark = "樹幹"; materialName Water = "水晶硝子"; materialName Luminous = "灯花"; materialName (Ore g) = gemName g

noticeText :: Notice -> String
noticeText Welcome = "ここでは、宝石が言葉になる。"
noticeText (Found g) = gemName g <> "を得た。庭にいる誰かへ。"
noticeText (NeedGem g) = "この子は" <> gemName g <> "を待っている。"
noticeText (GiftAccepted Jade) = "翠晶に触れた枝が、あなたの鼓動を覚えた。"
noticeText (GiftAccepted Rose) = "ひらいた冠から、あたたかい光がこぼれる。"
noticeText (GiftAccepted Azure) = "静かな面の奥で、青い記憶が灯った。"
noticeText (GiftAccepted Honey) = "蜜色の石を抱き、そっと光を差し出した。"
noticeText LightUsed = "生命の光が、からだに戻る。"
noticeText KinSaved = "ひとつの命が、あなたの灯りを覚えた。"
noticeText FlightGranted = "守った光が翼になる。SPACE で空へ。"
noticeText SkyChanging = "庭が、長い夜へと息をひそめた。"
noticeText Returned = "空は戻った。あなたが置いたものも、ここにある。"
noticeText CannotBuild = "からだと重なる場所には置けない。"
noticeText Crafted = "白石と宝石から、灯花を四つ編んだ。"
noticeText NeedCraft = "C  灯花を編む：白石 2 ＋ 宝石 1"
noticeText (NeedMaterial m) = materialName m <> "が足りない。左クリックで採ってくる。"
noticeText Slain = "光が尽きた。R で新しい旅へ。"
noticeText RecordRecovered = "読めない記録を別に保管し、新しい庭を開きました。"
noticeText NoNotice = ""

uiCorpus :: String
uiCorpus =
  concat (map noticeText [Welcome, Found Jade, Found Rose, Found Azure, Found Honey, NeedGem Jade, NeedGem Rose, NeedGem Azure, NeedGem Honey, GiftAccepted Jade, LightUsed, KinSaved, FlightGranted, SkyChanging, Returned, CannotBuild, Crafted, NeedCraft, Slain, NoNotice])
    <> "余光の庭生命灯り宝石を贈り三者と結ぶ好物は採る白石深層石金縁石苔石光葉樹幹水晶硝子灯花この灯りの下へ迎え入れる近くに置くと子を守れる左クリック右核を打つ赤い予兆から離れる採掘置く歩く跳ぶ走る上昇下降加速帰還この世界でいつまでも暮らす環聖域上空飛び上がる灯り用意したら夜訪受け入れる設定一時停止旅を続ける記録して終了新しい旅視点の上下反転音量操作案内保存しました読込新規再開生命光の記憶息贈り物聴く者主聖域灯花を編む白石宝石消費光を使う撮影表示非表示操作マウスホイール切替戻る解像度記録リセット"
