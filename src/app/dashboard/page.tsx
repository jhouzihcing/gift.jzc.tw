"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { ScanLine, CreditCard, Store, Settings } from "lucide-react";
import GiftCard from "@/components/GiftCard";

export default function Dashboard() {
  const { user, loading } = useAuthStore();
  const { cards, moveToTrash } = useCardStore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("7-11");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const displayCards = useMemo(() => {
    return cards
      .filter((c) => c.deletedAt === null && c.merchant === activeTab)
      .sort((a, b) => a.amount - b.amount);
  }, [cards, activeTab]);

  const merchants = useMemo(() => {
    const defaultMerchants = ["7-11"];
    const existing = cards.filter(c => c.deletedAt === null).map(c => c.merchant);
    return Array.from(new Set([...defaultMerchants, ...existing]));
  }, [cards]);

  if (loading || !user) return <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center font-black tracking-widest text-slate-300 animate-pulse">系統加載中...</div>;

  return (
    <div className="min-h-[100dvh] bg-slate-50 pb-32 relative text-slate-900 font-sans overflow-x-hidden">
      
      {/* 科技背景紋理 (全路徑) */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.02] z-0" 
           style={{ backgroundImage: 'linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

      {/* 頂部標題 */}
      <header className="px-8 py-10 flex justify-between items-center z-10 relative max-w-4xl mx-auto">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[1.5rem] overflow-hidden shadow-2xl border-4 border-white">
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img 
               src="/Users/jzc/.gemini/antigravity/brain/b0535309-6f2e-417d-8b38-9ea5d992d19c/sgcm_logo_v116_1775877006501_1775925585422.png" 
               alt="卡片管家 Logo" 
               className="w-full h-full object-cover"
             />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-slate-900">卡片管家</h1>
            <p className="text-[10px] text-[#10b981] font-black tracking-[0.4em] mt-1 uppercase opacity-80">Secured Digital Wallet</p>
          </div>
        </div>
      </header>

      {/* 商家分類 (Tabs) */}
      <div className="px-8 pb-4 overflow-x-auto whitespace-nowrap scrollbar-hide sticky top-0 bg-slate-50/80 backdrop-blur-2xl z-20 pt-2 border-b border-slate-100">
        <div className="flex gap-2 max-w-4xl mx-auto">
          {merchants.map((m) => (
            <button
              key={m}
              onClick={() => setActiveTab(m)}
              className={`px-7 py-3 rounded-full font-black text-xs transition-all flex items-center gap-2 uppercase tracking-widest ${
                activeTab === m 
                  ? 'bg-slate-900 text-[#10b981] shadow-xl shadow-slate-900/10' 
                  : 'bg-white text-slate-400 border border-slate-100'
              }`}
            >
              <Store size={14} /> {m === "7-11" ? "統一超商" : m} 
            </button>
          ))}
        </div>
      </div>

      {/* 主要卡片區 - 改為水平滑動 */}
      <main className="pt-10 max-w-4xl mx-auto relative z-10 px-4">
        {displayCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-32 px-4">
            <div className="w-24 h-24 bg-white rounded-[2rem] flex items-center justify-center shadow-inner mb-6 border border-slate-100">
              <CreditCard size={40} className="text-slate-100" />
            </div>
            <p className="font-black text-xl text-slate-300 tracking-tight">目前沒有儲存卡片</p>
            <p className="text-[10px] mt-2 font-black text-slate-400 uppercase tracking-[0.3em] opacity-60">點擊下方按鈕啟動掃描</p>
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-6 px-4 pb-12 scrollbar-hide">
            {/* 左側保留一點邊距 */}
            <div className="shrink-0 w-2" />
            
            {displayCards.map((card) => (
              <GiftCard key={card.id} card={card} onDelete={moveToTrash} />
            ))}
            
            {/* 右側保留一點邊距 */}
            <div className="shrink-0 w-2" />
          </div>
        )}
        
        {displayCards.length > 0 && (
           <div className="flex justify-center gap-1.5 mt-2 opacity-20">
              <div className="w-8 h-1 bg-[#10b981] rounded-full" />
              <div className="w-2 h-1 bg-slate-300 rounded-full" />
              <div className="w-2 h-1 bg-slate-300 rounded-full" />
           </div>
        )}
      </main>

      {/* 底部導航列 */}
      <div className="fixed bottom-0 w-full bg-white/95 backdrop-blur-3xl border-t border-slate-100 pb-safe z-30 shadow-[0_-20px_50px_rgba(0,0,0,0.03)]">
        <div className="flex justify-between items-center px-10 h-20 max-w-md mx-auto relative">
          
          <button className="flex flex-col items-center justify-center gap-1 text-[#10b981] active:scale-95 transition-all w-[4.5rem]">
             <CreditCard size={24} strokeWidth={2.5} />
             <span className="text-[10px] font-black mt-1 tracking-tighter">我的卡包</span>
          </button>

          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-5">
             <button 
               onClick={() => router.push("/scan")}
               className="pointer-events-auto bg-[#10b981] text-white w-[4.5rem] h-[4.5rem] rounded-[1.75rem] flex items-center justify-center shadow-2xl shadow-[#10b981]/30 active:scale-90 transition-all border-4 border-white"
             >
               <ScanLine size={32} />
             </button>
          </div>

          <button 
            onClick={() => router.push("/settings")}
            className="flex flex-col items-center justify-center gap-1 text-slate-300 hover:text-slate-800 transition-all active:scale-95 w-[4.5rem]"
          >
             <Settings size={22} strokeWidth={2} />
             <span className="text-[10px] font-black mt-1 tracking-tighter">設定中心</span>
          </button>
          
        </div>
      </div>
    </div>
  );
}
