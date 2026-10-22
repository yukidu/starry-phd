# 星格宇宙 · 正式發版與還原

網站：https://persona.starry.phd/

| 還原代碼 | Cloudflare Version ID | 內容 |
|---|---|---|
| **SP-20261023-02** | `742545fa-41c3-40f8-ac39-f41f1e1de120` | 現行正式版，修正圖鑑分類排版 |
| SP-20261023-01 | `4b899eba-43ae-40bc-959b-a367e95c9e57` | 初版公開體驗 |

Cloudflare Worker 名稱：`starry-persona`，Domain：`persona.starry.phd`。

若需回復先前版本，於 Cloudflare Workers 的 Deployments / Versions 選擇上方 Version ID，以 100% 流量重新部署；驗證 `/health` 及實際頁面，記錄最新部署與 GitHub 對應版本。

代碼僅為版本識別，不是密碼，也不是網站上的輸入碼。不可刪除舊 Worker 版本。
