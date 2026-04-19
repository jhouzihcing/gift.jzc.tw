<div align="center">

# 💎 ZJ Card (JZC Design)
### 全方位的超商卡片管理與加密同步工具
*An exquisite & secure card manager built for privacy and convenience.*

[![CI/CD Build](https://github.com/jhouzihcing/gift.jzc.tw/actions/workflows/ci.yml/badge.svg)](https://github.com/jhouzihcing/gift.jzc.tw/actions/workflows/ci.yml)
[![Security: CodeQL](https://github.com/jhouzihcing/gift.jzc.tw/actions/workflows/codeql-analysis.yml/badge.svg)](https://github.com/jhouzihcing/gift.jzc.tw/actions/workflows/codeql-analysis.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/jhouzihcing/gift.jzc.tw/badge)](https://securityscorecards.dev/viewer/?uri=github.com/jhouzihcing/gift.jzc.tw)

<br />

### 💖 贊助開發者 (Support)
本專案為 **非營利性質的公益開發**，旨在提供免費且安全的工具。<br />
維護伺服器與持續開發仍需一定的成本，非常需要大家的支持與鼓勵！

<br />

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/jzc0220)
&nbsp;&nbsp;&nbsp;&nbsp;
[![Sinopac](https://img.shields.io/badge/永豐銀行-贊助支持-red?style=for-the-badge&logo=SinoPac)](https://gift.jzc.tw)
<br />
*(永豐銀行申請中)*

</div>

---

## 📖 專案簡介 (Introduction)
**ZJ Card** 是一款基於 **Next.js 15** 開發的高性能 Web 應用，專為超商愛好者設計。我們致力於將您的禮物卡、條碼集中管理，並透過 **Google Drive** 實現跨裝置加密同步。

> [!IMPORTANT]
> **隱私第一 (Privacy First)**：所有敏感數據在同步前均經過 Web Crypto API 本地加密，確保除了您之外，沒有任何人（包括雲端空間提供者）能讀取您的內容。

## ✨ 核心特色 (Key Features)

- 🔒 **端到端加密**：使用軍事級加密技術保護您的卡片資料。
- ☁️ **雲端同步**：無縫接軌 Google Drive，換手機也不怕資料遺失。
- 🏪 **超商最優化**：預設為 7-11 等主流商家開發，具備餘額統計與優先顯示功能。
- 📱 **PWA 支持**：可安裝至手機桌面，享受如原生 APP 般的流暢操作體驗。
- 🗑️ **回收機制**：貼心的回收桶設計，防止誤刪珍貴條碼。
- 🛡️ **資安硬化**：深度整合 GitHub Actions、CodeQL 與 OpenSSF 安全規範。

## 🛠️ 技術棧 (Tech Stack)

| 類別 | 選擇 |
| :--- | :--- |
| **Framework** | ![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js) |
| **State** | ![Zustand](https://img.shields.io/badge/Zustand-latest-brown?style=flat-square) |
| **Security** | ![NextAuth](https://img.shields.io/badge/Next--Auth-v5-blue?style=flat-square) |
| **Styling** | ![Tailwind CSS](https://img.shields.io/badge/Tailwind--CSS-v4-38B2AC?style=flat-square&logo=tailwind-css) |
| **Testing** | ![Vitest](https://img.shields.io/badge/Vitest-latest-yellow?style=flat-square&logo=vitest) |

## 🚀 快速開始 (Getting Started)

```bash
# 安裝相依套件
npm install

# 啟動開發伺服器
npm run dev
```

## 🤝 貢獻與安全 (Security & Contributing)
發現漏洞或有新想法？請參閱我們的 [SECURITY.md](SECURITY.md) 了解漏洞回報流程。

## 🔐 簽署與驗證 (Signing & Verification)

本專案的所有版本發行均透過 [Sigstore Cosign](https://github.com/sigstore/cosign) 進行加密簽署。您可以透過以下指令驗證下載的成品：

```bash
# 下載 .tar.gz, .sig 與 .pem 檔案後
cosign verify-blob source.tar.gz \
  --signature source.tar.gz.sig \
  --certificate source.tar.gz.pem \
  --certificate-identity-regexp "https://github.com/jhouzihcing/gift.jzc.tw/.github/workflows/release.yml@refs/tags/v.*" \
  --certificate-oidc-issuer "https://token.actions.githubusercontent.com"
```

## 💬 聯繫與回饋 (Feedback)
如果您有任何功能許願、建議或發現錯誤，歡迎加入我們的 LINE 官方帳號與我們聯絡：

- **LINE 官方帳號**：[點擊加入好友](https://line.me/R/ti/p/@300dqnfz) (或搜尋 `@300dqnfz`)

## ⚠️ 版權聲明 (Legal Notice)
本專案的原始碼以 **MIT License** 授權開源。然而，**"ZJ Card" 品牌名稱、專案標誌 (Logo) 以及 UI/UX 視覺設計**之相關智慧財產權，皆歸原作者 ([JZC Design](https://jzc.tw)) 所有。

- 您可以自由分叉 (Fork) 並修改程式碼供個人或非商業使用。
- **未經正式授權，禁止將本專案之標誌、品牌名稱或視覺設計用於任何商業行為、營利目的或誤導性的衍生專案。**

---
<div align="center">
Made with ❤️ by JZC Design
</div>
