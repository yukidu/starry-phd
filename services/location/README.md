# Starry Location Service（Geoapify Free）

> 狀態：程式及**模擬/離線測試**。本服務未部署、未接入正式 RecordNote / Starry ID；尚未使用真實 Geoapify API Key，不能宣稱十班坑真實結果已驗證。不得直接將此分支合併後部署。

## 與現有系統的分工

- 位於現有 `yukidu/starry-phd` 的 `services/location/` 獨立目錄，不更動目前的首頁、Starry ID、RecordNote 正式 Worker、D1、R2、會員或舊音檔。
- 獨立 Cloudflare Worker `starry-location-service`，單個 SQLite Durable Object（`starry-location-global-v1`）同時負責地名中央快取與全 Starry App 的原子 24h quota；沒有新增 D1/KV/下載地理圖資。
- 每款 App 使用自己的合法 Starry ID Bearer token；Server 驗證 ES256+JWKS、`app_id` 白名單、`aud`/`iss`/時間，以及 `GET /v1/me` 活躍 Session。不共用會員資料庫、session 或 token secret；中央 DO 不記會員 ID。
- 單次 Geoapify `GET /v1/geocode/reverse?format=json&lang=zh&limit=1`；不呼叫 Places、AI 或其他 geocoding。只有明確定位同意下的主動要求才執行。

## API 規格（準備稿，未部署）

`POST /v1/location/reverse`（Bearer token、JSON）：

```json
{"lat":24.59939,"lon":120.77734,"accuracy_m":5,"captured_at_ms":1793970900000,"location_consent":true}
```

- 呼叫時必須把 `captured_at_ms` 換成實際 GPS 定位完成時的 UTC 毫秒，5 分鐘以前或明顯未來的座標會拒絕。
- 回傳例如 `{ "ok": true, "label": "...", "level": "locality", "status": "fresh", "cache": "provider|central|device", "reference": {"lat": ..., "lon": ...}, "attribution": {...}, "expires_at_ms": ... }`。上面的十班坑座標是**唯一核准的真實地點驗收座標**，並不代表預期地名已由 Geoapify 證實。
- API 不允許自動探測 GPS；呼叫端必須先取得 GPS 權限、使用者對地名反查的同意，且明確需要地名。錄音開始／暫停／結束／播放／列表不能觸發此 API；當時辨識完成的地名由錄音自己保存，不在日後播放時重算。
- `POST /v1/location/reverse` 在 cache hit、停用、429 或 24h quota exhausted 仍不會額外向 Geoapify 查詢；有 stale cache 時以 `status=stale` 表明不是現行核實地名。
- `GET /v1/location/admin/status`、`PUT /v1/location/admin/stop` 需 `LOCATION_ADMIN_IDS` 中的本人 Starry ID；停止格式 `{ "stopped": true, "confirm": "STOP_GEOAPIFY" }`。數據含每 App 已預留 external credits、近 24h 合計、中央 cache 命中粗估。**沒有**預先建立的管理 UI，僅受保護管理 API。
- `GET /health` 沒有使用者資訊；不能用它當作完整外部 API 健康狀態的證據。

## 快取、額度與安全

- 客戶端 `src/client.mjs` 採 `createLocationClient({storage,query})`；Web 可用 `browserIndexedDbAdapter()`，Expo 需自行傳入具持久化能力的 `AsyncStorage` 相容介面。每個原生 App 的本地沙箱並不跨 App 共用，本方案以中央快取負責跨 App 重用。
- Client **不會**啟動 `watchPosition`、麥克風或排程定位。僅在 caller 主動 `resolve(fix,{consent:true})` 時查詢；GPS 低精度、過期、超過 100m 或無信任行政邊界時採保守條件。Haversine 真距離比較；定位誤差計入重用半徑。細地標 15m、村里／聚落 20m、較粗行政層級最高 100m，均會減去雙方 GPS 誤差。
- 中央使用 1000 倍度數的格網作查詢索引，取得附近 5×5 候選後**仍重新計算距離**；不假定格網命中就是同地名。正式地圖邊界未提供時，**不能證明**村里交界未跨越；測試中只驗證保守近似。
- 30 天行政 TTL / 7 天聚落、地標 TTL；15 分鐘 negative cache；到期只做 stale 標註，不自動突發刷新；可由使用者主動 `refresh:true`，但不得突破 quota。中央最多保留 4,500 筆可重用候選，滿額後刪較舊資料。Client 最多 200 筆並可手動清除。
- 原子 quota 控制在單一 DO：每次**對外請求前**先在 SQLite 記錄 `1 credit`（包含逾時／失敗的保守預留），rolling 24h 最多 2,500。只支援單次 reverse；若以後增加 API，必須重新確認每 API 成本並修改 ledger，不能沿用一律 1 credit。
- 每分鐘最多 20 個外部查詢（獨立於快取）；同一六位小數座標、同語言同時要求合併成一個 Promise。Geoapify 401/403/429 導致持續停止請求；除非經授權處理故障，不會因內部 24h 重置自動解除這個停用。
- 此額度只涵蓋本 DO 真正發出的請求；**不能阻止使用同一 Geoapify project/key 的其他外部程式**消耗官方 3,000 credits。維持 free plan、禁付費升級與跨服務獨占金鑰/專案必須由業主在平台確認。監控的 `credits_reserved_rolling24h` **不是** Geoapify 官方計費讀數。Free plan 的供應商 soft limit 不能當付費硬上限。
- 不儲存跨 App 使用者軌跡、user_id、原始 JWT、錄音資訊或原始 GPS 請求日誌；中央表只存地理來源參考座標、地名、查詢日期與 app 事件級的總計。請注意：GPS 位置本身仍可能屬個資，需評估必要性、保留及刪除政策。
- Geoapify 免費方案要求 Geoapify 與 OSM 署名及其來源署名；`attribution` 包含固定連結及 datasource 欄位，**每一個 App 都要在地名旁顯示**，cache 命中時也不能移除。
- Geoapify `lang=zh` **不能保證全部中文字是台灣繁體**。真實測試後，若有簡體字，應另接離線繁體轉換套件/在地化審核（不得新增其他 geocoding/AI API）；未驗證前不得宣稱已達成繁體一致性。

## 安全設定（尚未操作 Cloudflare，沒有金鑰存入 GitHub）

在 Cloudflare 的 **Starry 帳戶**建立/核准獨立 Worker `starry-location-service` 與 SQLite Durable Object binding，僅進行 staging；不觸碰 `recordnote`、`recordnote-web`、`starry-id` 或任何正式 D1。

1. 先審核 `wrangler.jsonc` 的 Worker 名稱、SQLite DO class/migration 與雲端免費額度。此檔**沒有**網域 routes、Secrets 或正式啟用開關，預設 `GEOAPIFY_ENABLED=false`。
2. 進入 Cloudflare → Workers & Pages → 選該 Worker → Settings → Variables and Secrets → Add → **Secret**，名稱填 `GEOAPIFY_API_KEY`，值在 Cloudflare 畫面貼入，**不可在聊天、GitHub、URL、測試紀錄貼金鑰**。Secret 不應用 plain text 變數，之後必要時更換/撤銷。未建立此 Worker 時，不要把金鑰放到 RecordNote 或 Starry ID Worker。
3. `LOCATION_ADMIN_IDS` 必須由業主授權綁定之 Starry ID，不得以 UI flag 或 email 代替管理員驗證。驗證 Google/Apple 登入 token 簽章與 Session、Workers Service Binding 到 Starry ID 是否可用。
4. Staging 先以模擬 provider（不耗 credits）、專用測試會員，測試失敗/併發/停用/備援；再由業主核准建立正式資源、填入 secret、開啟 `GEOAPIFY_ENABLED=true` 並驗證唯一十班坑座標。僅在供應商專案用量、付費方案、key 限制都確認後才能開始對外測試。
5. 上線前需確認 RecordNote 改用中央 API（原先 NLSC endpoint 仍在正式 Worker）且**不破壞舊錄音**，新錄音 GPS/地名只在使用者明確授權下保存。完整 RecordNote 正式 Worker 需先同步成 GitHub 可重現基線，避免錯誤覆蓋。

## 已驗證與未驗證（CI gate）

本機 `node --test tests/*.test.mjs`；使用 Node 22 的 `node:sqlite` 模擬 SQLite Durable Object，並 mock Geoapify，無須金鑰及出站網路。

- [x] 14 項本地模擬測試：單次請求、20 次同地點（模擬從 20 次降至 1 次，**95% 理論節省**）、2 App 快取、12 個同位置同時請求去重、rolling 24h 2,500 上限、逾額時快取持續可用、429 後阻擋、離線客戶端跨重啟資料留存、GPS 精度拒絕、行政與聚落重用距離、負面快取、來源署名、未授權請求拒絕。
- [ ] 實際 Cloudflare DO/staging 請求、Starry ID 真實 token / Service Binding 驗證。
- [ ] Geoapify **真實**反查 `24.59939,120.77734`；不能把 mock 的「苗栗縣後龍鎮龍坑里・十班坑附近」當作供應商實證。
- [ ] 真實 GPS 漂移、村里邊界、建築物、Android/iOS、RecordNote 過程不觸發 API 的真機檢驗。
- [ ] 比較真實 Geoapify credits／Cloudflare Workers、Durable Objects 成本與原本 RecordNote 實際外部查詢量；**目前沒有真實流量節省數據**。
- [ ] 傳統／簡體地名的一致性與實際 datasource 署名；跨全 App 共享 key 的來源盤點。
- [ ] 正式管理 UI、第三方異常告警、實機定位請求節流等產品接線；此版本只有受保護管理 API/被動快取 client。

## 不可移除的發布限制

不得自動部署／切換 DNS、不得修改 Starry ID D1、RecordNote 正式資料、舊音檔或原 R2，未完成真平台驗證不可宣稱已上線。保持本功能 PR 為 Draft，需核對 GitHub CI、Cloudflare 版本與回退點及業主核准。

### 失敗防抖修訂

若 Geoapify 網路斷線或 5xx，本服務進入 60 秒短期後退期間，避免多個地點立即重複外呼。401／403／429 仍為持續阻擋；只有受認證管理員確認供應商狀態後，才能以 `PUT /v1/location/admin/provider-reset` 搭配 `{ "confirm": "RESET_GEOAPIFY_BLOCK" }` 清除供應商停用。此操作**不會**取消緊急 STOP 開關，也不會清除 24h credit 已預留數字。
