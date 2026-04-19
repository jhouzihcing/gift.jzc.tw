# 🤝 貢獻指南 (Contributing Guidelines)

感謝您對 **ZJ Card** 感興趣！我們非常歡迎社群的參與與貢獻。為了確保社群環境健康且專案品質穩定，請在參與前參考以下指南。

## 📜 行為準則 (Code of Conduct)
參與本專案即表示您同意遵守以下準則：
- 尊重他人，不論其背景、經驗與觀點。
- 給予建設性的回饋，避免攻擊性言論。
- 共同維護一個充滿善意與包容性的環境。

## 🐛 回報問題 (Reporting Bugs)
如果您發現了 Bug，請在 [GitHub Issues](https://github.com/jhouzihcing/gift.jzc.tw/issues) 中提交。為幫助我們快速修復，請包含以下資訊：
- **問題描述**：發生了什麼事？預期的結果是什麼？
- **重現步驟**：請提供詳細的步驟。
- **環境資訊**：作業系統、瀏覽器版本、裝置型號等。
- **截圖/螢幕錄影**：如果可能，請提供視覺化參考。

## ✨ 提出新功能 (Feature Requests)
我們隨時歡迎新想法！
- 請先搜尋現有的 Issues，檢查是否已有人提出類似想法。
- 如果沒有，請開啟一個新的「Feature Request」Issue，並詳細描述該功能的使用情境與效益。

## 🛠️ 開發流程 (Development Process)

### 1. 本地開發設定
本專案採用 **Next.js 15** 與 **Tailwind CSS v4**。
```bash
# 複製專案
git clone https://github.com/jhouzihcing/gift.jzc.tw.git
cd gift.jzc.tw

# 安裝依賴
npm install

# 啟動開發伺服器
npm run dev
```

### 2. 分支規範
- 所有的修改都應該在從 `main` 分支出來的獨立 Feature Branch 上進行。
- 命名建議：`feat/your-feature-name` 或 `fix/bug-description`。

### 3. 提交 PR (Pull Request)
- 提交前請確保程式碼風格一致且通過本地編譯。
- 執行測試：`npm test` (如果有的話)。
- PR 描述應包含修改內容、目的以及相關的 Issue 編號。
- 所有的 PR 都需要通過代碼審查能力合併。

### 4. 資安規範
- **請勿** 提交包含敏感資訊（如 API Keys, Secrets）的程式碼。
- 如果發現資安漏洞，請參考 [SECURITY.md](SECURITY.md) 的 私下通報流程，切勿直接公開 Issue。

## 📝 授權 (License)
參與本專案的貢獻將自動依據本專案的 **MIT License** 授權。

---

再次感謝您的協助，讓 ZJ Card 變得更好！🚀
