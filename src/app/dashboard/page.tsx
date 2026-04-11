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

      {/* 頂部標題 - 縮小版 */}
      <header className="px-6 py-6 flex justify-between items-center z-10 relative max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg border-2 border-white">
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img 
               src="/Users/jzc/.gemini/antigravity/brain/b0535309-6f2e-417d-8b38-9ea5d992d19c/sgcm_logo_v116_1775877006501_1775925585422.png" 
               alt="卡片管家 Logo" 
               className="w-full h-full object-cover"
             />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-slate-900 leading-none">卡片管家</h1>
            <p className="text-[8px] text-[#34c759] font-black tracking-[0.3em] mt-0.5 uppercase opacity-80">Digital Wallet</p>
          </div>
        </div>
      </header>

      {/* 商家分類 (Tabs) */}
      <div className="px-6 pb-4 overflow-x-auto whitespace-nowrap scrollbar-hide sticky top-0 bg-slate-50/80 backdrop-blur-2xl z-20 pt-2 border-b border-slate-100">
        <div className="flex gap-2 max-w-4xl mx-auto">
          {merchants.map((m) => (
            <button
              key={m}
              onClick={() => setActiveTab(m)}
              className={`px-5 py-2.5 rounded-full font-black text-xs transition-all flex items-center gap-2 uppercase tracking-widest ${
                activeTab === m 
                  ? 'bg-slate-900 text-[#34c759] shadow-lg shadow-slate-900/10' 
                  : 'bg-white text-slate-400 border border-slate-100'
              }`}
            >
              <Store size={12} /> {m === "7-11" ? "7-11" : m} 
            </button>
          ))}
        </div>
      </div>

      {/* 主要卡片區 - 改為水平滑動 */}
      <main className="pt-8 max-w-4xl mx-auto relative z-10 px-0">
        {displayCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-32 px-6">
            <div className="w-20 h-20 bg-white rounded-[1.75rem] flex items-center justify-center shadow-inner mb-6 border border-slate-100">
              <CreditCard size={32} className="text-slate-100" />
            </div>
            <p className="font-black text-lg text-slate-300 tracking-tight">目前沒有儲存卡片</p>
          </div>
        ) : (
          <div className="flex overflow-x-auto snap-x snap-mandatory gap-5 px-6 pb-12 scrollbar-hide">
            {displayCards.map((card) => (
              <GiftCard key={card.id} card={card} onDelete={moveToTrash} />
            ))}
            {/* 右側保留一點邊距讓最後一張能置中 */}
            <div className="shrink-0 w-4" />
          </div>
        )}
        
        {displayCards.length > 0 && (
           <div className="flex justify-center gap-1.5 mt-2 opacity-30">
              <div className="w-6 h-1 bg-[#34c759] rounded-full" />
              <div className="w-1.5 h-1 bg-slate-200 rounded-full" />
              <div className="w-1.5 h-1 bg-slate-200 rounded-full" />
           </div>
        )}
      </main>

      {/* 底部導航列 */}
      <div className="fixed bottom-0 w-full bg-white/95 backdrop-blur-3xl border-t border-slate-100 pb-safe z-30 shadow-[0_-20px_50px_rgba(0,0,0,0.02)]">
        <div className="flex justify-between items-center px-12 h-20 max-w-md mx-auto relative">
          
          <button className="flex flex-col items-center justify-center gap-1 text-[#34c759] active:scale-95 transition-all w-12">
             <CreditCard size={22} strokeWidth={2.5} />
             <span className="text-[10px] font-black mt-1">卡片</span>
          </button>

          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-6">
             <button 
               onClick={() => router.push("/scan")}
               className="pointer-events-auto bg-gradient-to-b from-[#34c759] to-[#28cd41] text-white w-[4.2rem] h-[4.2rem] rounded-full flex items-center justify-center shadow-xl shadow-[#34c759]/30 active:scale-90 transition-all border-4 border-white"
             >
               <ScanLine size={30} />
             </button>
          </div>

          <button 
            onClick={() => router.push("/settings")}
            className="flex flex-col items-center justify-center gap-1 text-slate-300 hover:text-slate-800 transition-all active:scale-95 w-12"
          >
             <Settings size={22} strokeWidth={2} />
             <span className="text-[10px] font-black mt-1">設定</span>
          </button>
          
        </div>
      </div>
    </div>
  );
}
