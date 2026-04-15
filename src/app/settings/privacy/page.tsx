"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ShieldCheck, Database, Code, AlertTriangle, ChevronRight } from "lucide-react";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col font-sans text-gray-900 pb-12">
      <div className="max-w-2xl mx-auto w-full">
        {/* Header */}
        <header className="px-4 py-6 flex items-center gap-4 bg-gray-50 sticky top-0 z-10">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500 active:scale-95 transition-transform">
            <ChevronLeft size={28} />
          </button>
          <h1 className="text-xl font-bold tracking-tight">隱私權與法律條款</h1>
        </header>

        <main className="p-4 flex flex-col gap-8">
          
          {/* 隱私權核心：端對端加密 (v2.0 升級) */}
          <section className="bg-gradient-to-br from-[#34DA4F] via-[#2EB140] to-[#1A8A2A] p-8 rounded-[2.5rem] shadow-[0_20px_50px_rgba(52,218,79,0.2)] text-white relative overflow-hidden">
             <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-10 translate-x-10 blur-3xl" />
             <div className="relative z-10 flex flex-col gap-5">
                <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/30 shadow-inner">
                   <ShieldCheck size={32} />
                </div>
                <div>
                   <h2 className="text-2xl font-black mb-2">最高等級安全防護</h2>
                   <p className="text-xs font-bold text-white/80 uppercase tracking-widest">AES-256-GCM Client-Side Encryption</p>
                </div>
                <div className="space-y-4 font-bold text-sm leading-relaxed text-white/95">
                   <p>本 App 採用「零知識證明 (Zero-Knowledge)」技術架構。您的所有敏感數據（卡號、密碼）在離開您的裝置前，皆已通過 AES-256-GCM 高強度加密。</p>
                   <p>加密金鑰由您的 Google UID 衍生，開發者、伺服器、甚至是 Google 官方皆無法解密偵測您的卡片內容。</p>
                </div>
             </div>
          </section>

          {/* 詳細條款 */}
          <div className="flex flex-col gap-6 px-2">
             
             {/* 1. 雙軌儲存與雙重保險 */}
             <section className="space-y-3">
                <div className="flex items-center gap-2 text-[#34DA4F]">
                   <Database size={18} />
                   <h3 className="font-black uppercase tracking-widest text-xs">雙重保險與數據主權</h3>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-3 text-sm text-slate-600 leading-relaxed font-bold">
                   <p>本程式透過 Google Web 技術，將您的卡片資料以「雙軌制」進行備份同步，確保資料零風險：</p>
                   <div className="flex flex-col gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <p className="flex items-start gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-[#34DA4F] mt-1.5 flex-shrink-0" />
                         <span><strong className="text-slate-800">隱性位置：</strong>存於 Google Drive 的隔離區 <code className="bg-white px-1.5 rounded border">appDataFolder</code>，具有防誤刪特性。</span>
                      </p>
                      <p className="flex items-start gap-2">
                         <span className="w-1.5 h-1.5 rounded-full bg-[#34DA4F] mt-1.5 flex-shrink-0" />
                         <span><strong className="text-slate-800">顯性位置：</strong>於根目錄生成 <code className="bg-white px-1.5 rounded border italic">zc-card 請勿刪除...json</code>，供您隨時查看與手動備份。</span>
                      </p>
                   </div>
                   <p className="text-[#34DA4F]">當其中一個檔案被外力刪除時，系統會自動利用另一端的備份進行「鏡像修復」，確保資產清單始終安全。</p>
                   <p>我們嚴格遵守台灣《個人資料保護法》，除了您的 Email 外，本平台不收集、不儲存任何個人識別資訊 (PII)。</p>
                </div>
             </section>

             {/* 2. 公益開源與技術審查 */}
             <section className="space-y-3">
                <div className="flex items-center gap-2 text-slate-800">
                   <Code size={18} />
                   <h3 className="font-black uppercase tracking-widest text-xs">技術透明度與開源審查</h3>
                </div>
                <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 text-sm text-slate-600 leading-relaxed font-bold">
                   <p>
                      本平台為個人開發之公益專案，<span className="text-slate-900 underline decoration-[#34DA4F] decoration-2">宣告完全不盈利</span>。
                      為追求極致信任，本程式原始碼完全公開於 GitHub 平台上。
                   </p>
                   
                   <div className="bg-slate-50 p-4 rounded-2xl flex flex-col gap-3 border border-slate-100">
                      <p className="text-[11px] text-slate-400 uppercase tracking-tight">您可以親自審查本程式的安全邏輯與加密演算法：</p>
                      <a 
                        href="https://github.com/jhouzihcing/gift.jzc.tw" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center justify-between bg-white px-4 py-3 rounded-xl border border-slate-200 hover:border-[#34DA4F] hover:text-[#34DA4F] transition-all group active:scale-95"
                      >
                         <div className="flex items-center gap-3">
                            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                            <span className="text-xs font-black">jhouzihcing / gift.jzc.tw</span>
                         </div>
                         <ChevronRight size={16} className="text-slate-300 group-hover:text-[#34DA4F]" />
                      </a>
                   </div>
                </div>
             </section>

             {/* 3. 法律免責聲明 */}
             <section className="space-y-3">
                <div className="flex items-center gap-2 text-red-400">
                   <AlertTriangle size={18} />
                   <h3 className="font-black uppercase tracking-widest text-xs">免責事項與法規遵循</h3>
                </div>
                <div className="bg-red-50/30 p-6 rounded-3xl border border-red-50 shadow-sm space-y-3 text-xs text-slate-500 leading-relaxed font-medium">
                   <p>本服務符合 APEC 隱私框架與台灣 PDPA 個資保護規範。然而，您必須理解：</p>
                   <ul className="list-disc pl-4 space-y-2 font-bold text-slate-600">
                      <li>您是資料的唯一持有者。若您忘記 Google 帳號或手機遺失，加密資料將無法復原。</li>
                      <li>本工具僅為管理便利而研發，不對 Google Drive API 的第三方穩定性負責。</li>
                      <li>繼續使用本服務即代表您同意：任何因個人終端安全疏忽導致的損失，開發者不負賠償責任。</li>
                   </ul>
                </div>
             </section>

          </div>

          <p className="text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest mt-4">
             Version 2.4.1 (Double Insurance Edition) • 2026.04
          </p>

        </main>
      </div>
    </div>
  );
}
