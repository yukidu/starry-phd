# 繁星感恩日記 Gratitude Starry

每天寫下三件感恩的人、事、物，可各自附上壓縮照片或影片，並產生可分享的銀河卡片。預設完全私密。

## 架構

- 前端：React + TypeScript + Vite、行動優先、PWA（未安裝 Capacitor）。
- API：獨立 Cloudflare Worker；日記資料：獨立 D1 `gratitude-starry-db`；私人影像：獨立 R2 `gratitude-starry-media`。
- 會員：中央 Starry ID 的 **會員資訊只讀查驗**。會員須先於 `id.starry.phd` 註冊；不建立第二份會員資料。
- 鑑別：由 Starry ID `id.starry.phd/auth/gratitude` 完成 Google 登入，中央核發限時一次性驗證碼（ticket），本站驗證並銷毀後才核發本站 HttpOnly cookie；查核中央會員 `active` 與個別 App 禁止／核准權限（2026-10-18 後的新會員需中央授權）；每次 API 再查核中央帳號狀態。未登入時不提供任何雲端日記 API。
- 付費：只有內部 `entitlements` 控制的 `pro` 方案能用 1080p（尚未接收付款）；未購買／未核准一律 480p。
- 分享：匯出 PNG 卡片；不會對外公開原始日記或影片連結。

## 可立即操作的功能

- 每天 3 件文字記錄，含語音轉文字（依瀏覽器支援情況）、自動儲存、日期切換及歷史日記。
- 逐件獨立選擇照片或影片；瀏覽器端重新編碼成 480p（尊榮 1080p），只儲存壓縮後資料。
- 影片上限：免費 15 秒、尊榮 30 秒；瀏覽器若不能保留影片聲音，**拒絕上傳**，不會悄悄丟棄原始音訊。
- 文字尚未登入時僅有此裝置草稿；影像必須登入後才能保存於雲端。
- 卡片分享為圖片，不等同於可播放影片的公開卡片連結。

## 上線前必做（不達標不得宣稱正式上線）

1. **GitHub**：由擁有人新建獨立 repo `yukidu/gratitude-starry`，匯入本程式；main／PR／CI 建置通過。當前 GitHub 連接工具無法建立新 repo。
2. **共用會員登入**：已改由原有 `https://id.starry.phd` 登入，不需另外新增 Google OAuth 來源；Starry ID 的 SSO/權限新增修改在 [PR #508](https://github.com/yukidu/Echo-Starry/pull/508)，為 Draft，尚未合併或部署，需通過 CI 與實際跨網域驗證。
3. **Cloudflare**：專屬 D1 `gratitude-starry-db`、R2 `gratitude-starry-media` 已建立，已寫入 `wrangler.jsonc` 並執行 migration；尚未部署 Worker。
4. **中央資料**：需待 PR #508 驗收後，讓 `gratitude-starry` 出現在 Starry ID 可核准 App 清單，並由中央管理員核准 2026-10-18 後新註冊會員的 App 使用權限；在測試帳號實測登入／登出／停權；驗證 2 位不同帳號互相無法存取日記／影像。
5. **媒體服務**：目前影片時長與解析度在客戶端處理，後端限制大小、宣告尺寸與時長，但未做可信任的後端解碼覆核。若要公開提供有商業收費的影音服務，上線前應採用可驗證實際輸出畫質的轉碼後端（例如 Cloudflare Stream 或安全轉碼佇列），並完成費用上限設定。
6. **部署**：`npm install` 產生 `package-lock.json`，通過 `npm test`、`npm run build` 與 Worker TS 檢查；建立 Preview 域名驗收，再合併 main、正式 Cloudflare Deploy、檢驗 `https://gratitude.starry.phd/api/health` 及登入後完整操作。
7. **PWA**：在 iOS Safari、Android Chrome 驗證登入、錄音/語音、影像壓縮、卡片分享與重新整理；離線情況下僅允許草稿，不得聲稱雲端同步完成。

## 本機開發

```
npm install
npm test
npm run build
npx wrangler d1 migrations apply gratitude-starry-db --local
npm run dev:worker
npm run dev
```

Vite 開發伺服器連至 `http://localhost:8787` Worker API；本機環境安全 Cookie (`Secure`) 需要 HTTPS 才能完整實測登入。

## 備份、撤銷與維護

- 程式回復：GitHub main 前一個已驗收 commit SHA，再執行 Cloudflare Production rollback。
- 資料庫 migration 須提前備份並設計安全回退，**不可**回滾程式時直接清空會員資料。
- R2 記錄永不公開綁定域名；只有通過本人帳號驗證才可讀取。
- 付款功能尚未啟用，內部 `pro` 權限不可經公開 API 更新。
- 未完成 GitHub CI / SSO / 影音可信壓縮覆核前，不能認定整套 App 為已正式上線。

## 2026-10-23 開發驗證結果

- `npm test`：17/17 項通過（使用模擬資料庫與儲存環境，非端到端真人登入測試）。
- TypeScript 程式語法檢查：7/7 檔案通過。
- Cloudflare D1 四個日記資料表已建立；R2 專用 Bucket 已建立；但未建立 Worker 與自訂網域。
- `npm run build` 與 Cloudflare 真正線上功能驗證：未執行完成；缺少可安裝依賴的開發環境、GitHub 新 Repo 建立能力；Starry ID 的 PR #508 尚未合併。
- Source archive 僅為開發交接成果，不代表可直接投入商用的完整驗收版本。

## 2026-10-23 SSO 更新

- 不再於感恩日記網域直接要求 Google token；登入頁統一使用 `https://id.starry.phd/auth/gratitude`。
- 日記登入交換 Starry ID 限時一次性 ticket，並以 `sessionStorage` 啟動標記防止外來登入網址植入；callback 禁止快取。
- 中央 SSO/可核准 App 名單更新在 [PR #508](https://github.com/yukidu/Echo-Starry/pull/508)，僅草稿，未合併。
- 照片新增伺服器對 JPEG 實際尺寸覆核；影片仍需可信轉碼驗證，不可作為完整商用上線驗收。
- 因本工具環境不能連線 npm registry，沒有完成實際 npm 安裝、前端 Build 和真機驗證。
