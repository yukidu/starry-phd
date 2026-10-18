# Starry 生態系：共用「大閃電充電」特效 v1

這是獨立、可複製到其他 Starry App 的前端元件。來源：**starry-battery-charge-v1.js**。不包含 Starry ID 登入、API、會員庫存或獎勵演算法。

## 移植到其他 App（Web / PWA）

1. 將根目錄的 `starry-battery-charge-v1.js` 複製到新 App，並在你的主程式之前載入：
   ```html
   <script src="/starry-battery-charge-v1.js" defer></script>
   ```
   若新 App 有自己的打包流程，可把該檔案放進既有 JavaScript 打包清單，無須另開 API。
2. 在電池圖示的父元素設定 `position:relative`、`overflow:visible`，並執行：
   ```js
   const batteryIcon = document.querySelector('#battery-icon');
   const bolt = window.StarryBatteryCharge.mount(batteryIcon);
   ```
3. 在**該 App 已決定應顯示充電回饋**的事件處理中執行：
   ```js
   function onBatteryReward() {
     window.StarryBatteryCharge.flash(bolt);
   }
   ```

## API

- `mount(hostElement)`：插入金綠色閃電 SVG，回傳 SVG 元素。
- `flash(boltElement)`：閃電動畫（預設 540ms），重複觸發自動取消上一段，不會堆疊。偏好減少動態的用戶改成 220ms 透明度閃爍。
- `remove(boltElement)`：清除動畫及元件，用於 App 畫面離開。
- `version`：共用元件版號。

目前效果寬 124px、高 144px（原繁星艦長為 62 × 72px），只影響電池圖示附近，以 CSS transform 與 opacity 播放。動畫**不會加電池、也不呼叫 Starry ID**；電池認列及去重一律由 App 自己的伺服器規則決定。

## 生態系維護原則

各 App 各自引用**同一版本**檔案，不要在每個 App 再複製貼上閃電動畫程式邏輯。以後修改外觀，先更新這一個共用檔案的版本，再逐一在其他 App 檢查、測試、部署；絕不共用私密會員資料庫或修改原有獎勵 API。

本次 #64 **只在繁星艦長接入此元件**，其他 App 尚未修改。
