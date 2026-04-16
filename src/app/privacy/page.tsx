"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ShieldCheck, Database, Code, AlertTriangle, Globe, Lock, Share2, Trash2, Gavel, HeartHandshake, Eye, ShieldAlert, Copyright, Github, ExternalLink } from "lucide-react";
import Link from "next/link";

/**
 * ZJ Card Privacy Policy & Legal Disclaimer Page (v2.30.0)
 * ─────────────────────────────────────────────
 * Layout: 
 *   Top -> Main Chinese version for local users (Large/Clear).
 *   Bottom -> Dedicated English version for Google Verification (Small/Formal).
 */
export default function PrivacyPage() {
  const router = useRouter();
  const githubUrl = "https://github.com/jhouzihcing/gift.jzc.tw";

  return (
    <div className="min-h-[100dvh] bg-white flex flex-col font-sans text-gray-900 pb-24">
      
      <div className="max-w-3xl mx-auto w-full">
        {/* Header */}
        <header className="px-6 py-8 flex items-center justify-between border-b border-gray-100 sticky top-0 bg-white/80 backdrop-blur-md z-50">
          <div className="flex items-center gap-4">
             <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-400 hover:text-gray-600 transition-colors">
                <ChevronLeft size={24} />
             </button>
             <h1 className="text-xl font-black tracking-tight text-slate-800">隱私權政策與法律聲明</h1>
          </div>
          <div className="bg-[#34DA4F]/10 text-[#34DA4F] px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
             v2.30.0
          </div>
        </header>

        <main className="p-6 md:p-10 flex flex-col gap-16">
          
          {/* ============================================================
              CHINESE VERSION (FOR USERS) - LARGE & CLEAR
              ============================================================ */}
          <div className="flex flex-col gap-12">
            
            <section className="space-y-4 text-center md:text-left">
               <h2 className="text-4xl font-black text-slate-900 leading-tight">ZJ Card 禮物卡管家</h2>
               <div className="p-6 bg-[#34DA4F]/5 rounded-[2rem] border border-[#34DA4F]/10 space-y-4">
                  <p className="text-[#1A8A2A] font-black text-base leading-relaxed">
                     本程式為「完全免費、開源且不盈利」之公益專案。
                     我們深知個資安全的重要性，因此採用了最嚴格的加密技術，確保您的資料主權始終掌握在自己手中。
                  </p>
                  
                  {/* v2.30.0 GitHub Link */}
                  <div className="flex flex-col md:flex-row gap-3 pt-2">
                     <Link 
                       href={githubUrl}
                       target="_blank"
                       className="flex items-center justify-center gap-2 bg-slate-900 text-white px-5 py-3 rounded-2xl font-black text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-slate-200"
                     >
                        <Github size={18} />
                        開源專案程式碼 (GitHub)
                        <ExternalLink size={14} className="opacity-50" />
                     </Link>
                     <div className="flex items-center justify-center md:justify-start gap-2 text-[10px] text-[#1A8A2A]/60 font-black uppercase tracking-tighter">
                        <Copyright size={12} />
                        品牌標誌、名稱及網域歸開發者所有。
                     </div>
                  </div>
               </div>
            </section>

            {/* 中文：1. 資料存取 */}
            <section className="space-y-4">
               <div className="flex items-center gap-3 text-blue-600">
                  <Eye size={24} />
                  <h3 className="text-xl font-black tracking-tight">1. 資料存取與透明度</h3>
               </div>
               <div className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <p className="text-slate-600 font-bold leading-relaxed">
                    本程式僅存取您的 <span className="text-slate-900">Google 主要電子郵件</span> 用於辨識身分，並使用 <span className="text-slate-900">Google 雲端硬碟空間</span> 來同步您的禮物卡餘額與條碼資訊。
                  </p>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    同步檔案存放於 Google Drive 的隱藏隔離區 (appDataFolder) 以及根目錄。這些資料完全存在於您的雲端帳號中，開發者無法直接存取。
                  </p>
               </div>
            </section>

            {/* 中文：2. 資料用途與加密 */}
            <section className="space-y-4">
               <div className="flex items-center gap-3 text-[#34DA4F]">
                  <ShieldCheck size={24} />
                  <h3 className="text-xl font-black tracking-tight">2. 資料安全與加密儲存</h3>
               </div>
               <div className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm space-y-4 text-slate-600 font-bold">
                  <p>所有禮物卡資料在離開您的手機前，皆已通過 <span className="text-slate-900 underline decoration-[#34DA4F] decoration-2 underline-offset-4">AES-256-GCM 高強度加密</span>。</p>
                  <p>
                    加密密鑰是依據您的 Google 身分於本機生成；即使 Google 官方或開發者獲取了檔案，在沒有您身分授權的情況下也無法解讀內容。這意味著我們絕對不會、也無法讀取您的禮物卡細節。
                  </p>
               </div>
            </section>

            {/* 中文：3. 絕不分享宣告 */}
            <section className="space-y-4">
               <div className="flex items-center gap-3 text-orange-500">
                  <Share2 size={24} />
                  <h3 className="text-xl font-black tracking-tight">3. 數據主權與不分享宣告</h3>
               </div>
               <div className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm text-slate-600 font-bold leading-relaxed">
                  本程式絕對不會將您的資料分享給任何第三方。您的數據不是我們的產品，這是一份屬於您的加密數位資產。
               </div>
            </section>

            {/* 中文：4. 刪除與保留 */}
            <section className="space-y-4">
               <div className="flex items-center gap-3 text-red-500">
                  <Trash2 size={24} />
                  <h3 className="text-xl font-black tracking-tight">4. 刪除政策：您的遺忘權</h3>
               </div>
               <div className="bg-white p-7 rounded-3xl border border-slate-100 shadow-sm space-y-3 font-bold text-slate-600">
                  <p>您隨時擁有徹底刪除所有資料的權利。您可以透過設定中的「核彈級重設」功能，一鍵清除所有雲端同步檔與本地快取。</p>
                  <p className="text-xs text-slate-400 font-medium">註：回收桶內的卡片將在 15 天後自動永久清除。</p>
               </div>
            </section>

            {/* 中文：5. 法律免責聲明 */}
            <section className="space-y-4">
               <div className="flex items-center gap-3 text-indigo-700">
                  <ShieldAlert size={24} />
                  <h3 className="text-xl font-black tracking-tight">5. 免責聲明：請理性使用</h3>
               </div>
               <div className="bg-red-50/50 p-8 rounded-3xl border border-red-100 space-y-4">
                  <p className="text-sm text-slate-700 leading-relaxed font-black">
                     本程式以「現狀 (As Is)」提供。作為個人公益專案，開發者對於下列情況不負法律責任：
                  </p>
                  <ul className="list-disc pl-5 space-y-2 text-xs text-slate-500 font-bold">
                     <li>個人 Google 帳號安全性疏忽導致的資料外洩。</li>
                     <li>因個人操作或裝置損毀導致的禮物卡價值損失。</li>
                     <li>Google Drive 雲端服務中斷導致的功能異常。</li>
                  </ul>
                  <p className="text-[10px] text-red-400 font-bold italic">
                    * 繼續使用即代表您同意上述條款，並承擔相關工具之使用風險。
                  </p>
               </div>
            </section>

          </div>

          <div className="h-px bg-slate-100 my-4" />

          {/* ============================================================
              ENGLISH VERSION (FOR GOOGLE VERIFICATION) - SMALL & FORMAL
              ============================================================ */}
          <section className="space-y-8 opacity-60 hover:opacity-100 transition-opacity">
             <div className="flex flex-col gap-2">
                <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                   <Globe size={14} /> Formal Privacy Policy (English Version for Google Review)
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">This section fulfills the Google OAuth verification requirements.</p>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-[11px] leading-relaxed text-slate-500 font-medium border-t border-slate-50 pt-8">
                
                <div className="space-y-2">
                   <h4 className="font-black text-slate-700 uppercase tracking-tight">1. Data Accessed</h4>
                   <p>ZJ Card accesses your Google primary email for verification and Google Drive storage (appDataFolder and specific root files) for user-controlled synchronization.</p>
                </div>

                <div className="space-y-2">
                   <h4 className="font-black text-slate-700 uppercase tracking-tight">2. Data Usage</h4>
                   <p>User data is used solely to store and sync an encrypted JSON backup of the user’s gift card list. Processing is done client-side. No data is used for unauthorized purposes.</p>
                </div>

                <div className="space-y-2">
                   <h4 className="font-black text-slate-700 uppercase tracking-tight">3. Data Sharing</h4>
                   <p>We do NOT share your data with any third parties. All Google user data remains within the user's personal cloud environment and local device.</p>
                </div>

                <div className="space-y-2">
                   <h4 className="font-black text-slate-700 uppercase tracking-tight">4. Storage & Protection</h4>
                   <p>All sensitive information is encrypted via high-strength AES-256-GCM before upload. The developer cannot decrypt any user data.</p>
                </div>

                <div className="space-y-2">
                   <h4 className="font-black text-slate-700 uppercase tracking-tight">5. Retention & Deletion</h4>
                   <p>Data exists as long as the user maintains it. Users can delete all cloud sync files and local records using the "Nuclear Reset" tool in settings.</p>
                </div>

                <div className="space-y-2">
                   <h4 className="font-black text-slate-700 uppercase tracking-tight">6. Non-Profit Disclaimer</h4>
                   <p>This software is a non-profit, <Link href={githubUrl} target="_blank" className="underline">open-source</Link> personal project. Brand logos, names, and the domain are owned by the developer. It is provided "AS IS".</p>
                </div>

             </div>
          </section>

          <footer className="pt-10 border-t border-slate-100 text-center flex flex-col items-center gap-4">
             <div className="flex flex-col items-center gap-2 text-slate-300 font-black text-[10px] uppercase tracking-widest leading-loose">
                <div className="flex items-center gap-2">
                   <HeartHandshake size={14} className="text-[#34DA4F]" />
                   ZJ Card公益開發小組 • Version 2.30.0
                </div>
                <div className="opacity-50 text-[9px] tracking-widest mt-2 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                   最後更新時間 Last Updated: 2026-04-16 23:38:00
                </div>
             </div>
          </footer>

        </main>
      </div>
    </div>
  );
}
