# 星格宇宙 Starry Persona

正式網址：https://persona.starry.phd/

## 目前正式發行
- **代碼**：`SP-20261023-02`（Cloudflare 版本 `742545fa-41c3-40f8-ac39-f41f1e1de120`）
- **Worker**：`starry-persona`，與其餘繁星網站獨立部署
- **範圍**：原創 60 題、5 級回答、16 顆星球與四星域圖鑑、手機介面與 PWA
- **資料保存**：僅瀏覽器本機，沒有後端或會員登入；不可宣稱可跨裝置同步。
- **免責**：自我探索用，非官方 MBTI® 或 PersonalityKey、非心理診斷。

## 原始碼
`src/` 是可維護的來源，`worker.js` 是打包生成的部署檔，**勿直接編輯**。

```bash
cd apps/starry-persona
npm test
npm run build
```

每次修改必須同步提交更新後的 `worker.js`；PR 的專用 GitHub Actions 將檢查題庫、計分邏輯和打包一致性。

## 發布與安全
以 GitHub branch → PR → 自動測試 → 合併 main → Cloudflare Production → 正式網址驗證進行。
目前 Cloudflare 正式發布透過已連線的 API，**尚未設定 GitHub 到 Cloudflare 的自動發布金鑰**。未驗證 production 前不可稱正式上線。
查看 `DEPLOYMENTS.md` 保留的版本與還原紀錄。

## 待開發
Google/Apple/Starry ID 登入、跨裝置同步、完整且人工審核的 96 章故事及原創插圖、獨立 GitHub Repository（目前位於既有 repo 的獨立專案子目錄）、持續部署金鑰配置。
