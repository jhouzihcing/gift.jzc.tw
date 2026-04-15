# 更新日誌 (Changelog)

## [2.3.0] - 2026-04-15
### 🛡️ 數據救援與同步引擎硬化
#### 數據救援 (Recovery)
- **救援模式開通**：暫時恢復 `drive.file` 權限並重啟遷移邏輯，協助受影響用戶找回遺失資料。

#### 同步加固 (Harden)
- **防止靜默覆寫**：重構 `readDriveDB`，加密或讀取失敗時改為強行中斷同步並報錯，徹底防止空白資料庫被寫回雲端。
- **衝突保護 (ETag)**：實作 Google Drive `ETag` 版本控制，在寫入時強制檢查版本一致性（If-Match），防止多端操作時發生資料覆蓋。

#### 改良與優化 (Improvements)
- **手動重水合 (Rehydration)**：優化登入後的本地解密流程，確保金鑰就緒後自動載入卡片。
- **本地持久化加密**：實作 `localStorage` 等級的 AES-256-GCM 加密。

---

## [2.2.0] - 2026-04-15
### 💎 體驗優化與權限極簡化
#### 介面優化 (UX/UI)
- **修復 iPhone Safe Area**：針對 PWA 模式實作 `safe-area-inset-top` 保護，解決頂部標題與系統時間/電池欄位重疊之問題。
- **PWA 正式更名**：更新 `manifest.json` 配置，將 PWA 名稱從「智慧管家」全面統一為 **ZJ Card**。

#### 權限與資安 (Privacy & Security)
- <span className="font-black tracking-tight">ZJ Card</span> <span className="text-[10px] text-slate-300 ml-1 font-black align-top">v2.3.0</span>
- **代碼精簡**：移除 v1 搬遷遷移邏輯，精簡 Drive 同步核心，提升系統穩定性。

---

## [2.1.0] - 2026-04-15
### 🌟 ZJ Card 品牌化與安全升級

#### 品牌與介面 (Branding & UI)
- **全面品牌重塑**：更名為 ZJ Card • 奇蹟卡 <span className="text-[10px] text-slate-300 ml-1 font-black align-top">v2.3.0</span>
- **Slogan 更新**：定義為「專屬於您的奇蹟卡管家」。
- **介面去 7-11 化**：在品牌標語與標題中移除特定商家字樣，維持品牌獨立性。
- **功能預留**：將「自訂商家」恢復為「待開發」狀態，保留未來擴充空間。

#### 安全性 (Security)
- **AES-256-GCM 加密**：實作用戶端端對端加密，涵蓋雲端同步與「本地快取 (LocalStorage)」。
- **隱藏儲存空間**：遷移至 Google Drive `appDataFolder`。檔案在雲端 UI 中不可見，徹底防止意外刪除。
- **全路徑零知識**：您的卡片資料不論在雲端或本地設備皆為加密狀態。開發端無從獲取、解析或存取。

#### 同步與效能 (Sync)
- **自動遷移機制**：支援將 v1.x 的明文資料庫自動升級、加密並轉存至新空間。
- **掃描加速**：優化 Setup Session 流程，預設鎖定 7-11 掃描模式，減少點擊次數。

#### 法律與合規 (Legal)
- **隱私權政策升級**：針對台灣個資法 (PDPA) 進行條文優化。
- **技術透明度**：在 App 內提供 GitHub 原始碼連結，支援全球技術審查。

---

## [1.12.0] - 2026-04-12
### 🚀 基礎功能完備
- 實作 Google Drive JSON 即時同步。
- 支援批量卡片掃描與面額預設。
- 垃圾桶機制與 15 天自動清理。
