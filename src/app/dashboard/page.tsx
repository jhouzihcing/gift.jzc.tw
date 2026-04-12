"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { ScanLine, CreditCard, Store, Settings, LayoutGrid, Library } from "lucide-react";
import GiftCard from "@/components/GiftCard";
import Link from "next/link";

export default function Dashboard() {
  const { user, loading, isSyncing, syncError } = useAuthStore();
  const { cards, moveToTrash, customMerchants } = useCardStore();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("全部");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const filteredCards = useMemo(() => {
    return cards
      .filter((c) => {
        const isNotDeleted = c.deletedAt === null;
        if (activeTab === "全部") return isNotDeleted;
        return isNotDeleted && c.merchant === activeTab;
      })
      .sort((a, b) => a.amount - b.amount);
  }, [cards, activeTab]);

  const merchants = useMemo(() => {
    const existing = cards.filter(c => c.deletedAt === null).map(c => c.merchant);
    return Array.from(new Set(existing));
  }, [cards]);

  if (loading || !user) return <div className="h-[100dvh] bg-slate-50 flex flex-col items-center justify-center font-black tracking-widest text-slate-300 animate-pulse">系統加載中...</div>;

  return (
    <div className="h-screen h-[100dvh] bg-slate-50 flex flex-col overflow-hidden text-slate-900 font-sans relative">
      <div className="absolute top-0 left-0 w-full h-[60vh] bg-gradient-to-b from-[#34DA4F]/10 via-transparent to-transparent pointer-events-none" />

      {/* 頂部標題 - 縮小版且固定高度 */}
      <header className="px-6 pt-6 pb-2 grow-0 flex justify-between items-center z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img 
               src="/logo.png" 
               alt="Logo" 
               className="w-full h-full object-contain"
             />
          </div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            卡片管家 <span className="text-[10px] text-slate-300 ml-1 font-black align-top">v1.10.0</span>
          </h1>
        </div>
        <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-100 shadow-sm">
           <div className={`w-2 h-2 rounded-full ${
             syncError ? 'bg-red-500 animate-pulse shadow-[0_0_8px_red]' : 
             isSyncing ? 'bg-[#34DA4F] animate-pulse shadow-[0_0_8px_#34DA4F]' : 
             'bg-[#34DA4F]'
           }`} />
           <span className={`text-[9px] font-black uppercase ${syncError ? 'text-red-500' : 'text-slate-400'}`}>
             {syncError ? 'Sync Error' : 'Drive Sync'}
           </span>
        </div>
      </header>

      {/* 商家分類 (Tabs) - 固定高度 */}
      <div className="px-6 py-2 overflow-x-auto whitespace-nowrap scrollbar-hide shrink-0 z-20 border-b border-slate-100/50">
        <div className="flex gap-2">
          {["全部", "7-11", ...customMerchants].map((m) => (
            <button
              key={m}
              onClick={() => setActiveTab(m)}
              className={`px-5 py-2 rounded-full font-black text-xs transition-all flex items-center gap-2 uppercase tracking-widest ${
                activeTab === m 
                  ? 'bg-slate-900 text-[#34DA4F] shadow-lg' 
                  : 'bg-white text-slate-300 border border-slate-100'
              }`}
            >
              <Store size={12} /> {m === "7-11" ? "7-11" : m} 
            </button>
          ))}
        </div>
      </div>

      {/* 主要內容區 - 緊湊排列 */}
      <main className="flex-1 flex flex-col justify-center overflow-hidden relative">
        {filteredCards.length === 0 ? (
          <div className="text-center px-12 animate-in fade-in duration-700">
             <div className="w-20 h-20 bg-white rounded-[2.5rem] shadow-xl border border-slate-50 flex items-center justify-center mx-auto mb-6">
                <Store size={32} className="text-slate-200" />
             </div>
             <h3 className="text-slate-900 font-black text-xl mb-2">尚未存放卡片</h3>
             <p className="text-slate-400 text-sm font-bold leading-relaxed">正式開始管理您的商品卡<br/>點擊下方按鈕啟動相機</p>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col justify-center">
            <div className="flex gap-4 overflow-x-auto px-10 py-1 snap-x snap-mandatory scrollbar-hide">
              {filteredCards.map(card => (
                <GiftCard 
                  key={card.id} 
                  card={card} 
                  onDelete={() => moveToTrash(card.id)}
                />
              ))}
              {/* 終點填充 */}
              <div className="shrink-0 w-8 h-1" />
            </div>
            
            {/* 水平捲動指示 */}
            {filteredCards.length > 1 && (
              <div className="flex justify-center gap-1.5 mt-4 opacity-50">
                 {filteredCards.map((_, i) => (
                   <div key={i} className="w-1 h-1 rounded-full bg-slate-300" />
                 ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* 底部導覽列 - 縮短高度 (h-20) 且純圖標 */}
      <div className="h-20 bg-white/95 backdrop-blur-3xl border-t border-slate-100 shrink-0 z-30 flex justify-between items-center px-16">
        <div className="flex justify-between items-center w-full max-w-md mx-auto relative h-full">
          
          <button className="text-[#34DA4F] active:scale-95 transition-all">
             <CreditCard size={28} strokeWidth={2.5} />
          </button>

          <div className="absolute left-1/2 -translate-x-1/2 -top-4">
             <Link 
               href="/scan"
               className="bg-gradient-to-b from-[#5CF777] via-[#34DA4F] to-[#0EBE2C] text-white w-14 h-14 rounded-full flex items-center justify-center shadow-xl shadow-[#34DA4F]/30 active:scale-90 transition-all border-4 border-white"
             >
               <ScanLine size={28} />
             </Link>
          </div>

          <Link 
            href="/settings"
            className="text-slate-300 hover:text-slate-800 transition-all active:scale-95"
          >
             <Settings size={28} strokeWidth={2} />
          </Link>
        </div>
      </div>
    </div>
  );
}
