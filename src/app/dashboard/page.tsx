"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { VERSION } from "@/constants/version";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { ScanLine, CreditCard, Store, Settings, Wallet, TrendingUp } from "lucide-react";
import GiftCard from "@/components/GiftCard";
import Link from "next/link";

export default function Dashboard() {
  const { user, loading, isSyncing, syncError } = useAuthStore();
  const { cards, moveToTrash } = useCardStore();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/");
    }
  }, [user, loading, router]);

  const filteredCards = useMemo(() => {
    return cards
      .filter((c) => c.deletedAt === null)
      .sort((a, b) => a.amount - b.amount);
  }, [cards]);

  // v2.14.0 資產聚合邏輯
  const balanceStats = useMemo(() => {
    const stats: Record<string, number> = {};
    let total = 0;

    filteredCards.forEach(card => {
      stats[card.merchant] = (stats[card.merchant] || 0) + card.amount;
      total += card.amount;
    });

    return {
      total,
      merchants: Object.entries(stats).sort((a, b) => b[1] - a[1]) // 按金額降序
    };
  }, [filteredCards]);

  if (loading || !user) return <div className="h-[100dvh] bg-slate-50 flex flex-col items-center justify-center font-black tracking-widest text-slate-300 animate-pulse">系統加載中...</div>;

  return (
    <div className="h-screen h-[100dvh] bg-slate-50 flex flex-col overflow-hidden text-slate-900 font-sans relative">
      <div className="absolute top-0 left-0 w-full h-[40vh] bg-gradient-to-b from-[#34DA4F]/10 via-transparent to-transparent pointer-events-none" />

      {/* 頂部標題 */}
      <header className="px-6 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-2 grow-0 flex justify-between items-center z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img 
               src="/logo.png" 
               alt="Logo" 
               className="w-full h-full object-contain"
             />
          </div>
          <span className="font-black tracking-tight">ZJ Card</span> 
          <span className="text-[10px] text-slate-300 ml-1 font-black align-top">{VERSION}</span>
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

      {/* v2.14.0 資產概覽區塊 */}
      <section className="px-6 py-4 z-20 shrink-0">
        <div className="bg-white/70 backdrop-blur-xl border border-white rounded-[2rem] p-6 shadow-xl shadow-[#34DA4F]/5 relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-[#34DA4F]/5 rounded-full blur-3xl -mr-10 -mt-10" />
           
           <div className="flex flex-col gap-1 relative z-10">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                 <Wallet size={14} className="text-[#34DA4F]" />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em]">資產總餘額統計</span>
              </div>
              <div className="flex items-baseline gap-1">
                 <span className="text-sm font-black text-[#34DA4F] opacity-60">$</span>
                 <span className="text-4xl font-black tracking-tighter text-slate-900">
                    {balanceStats.total.toLocaleString()}
                 </span>
              </div>
           </div>

           {/* 商家分佈膠囊 */}
           {balanceStats.merchants.length > 0 && (
             <div className="mt-5 flex gap-2 overflow-x-auto scrollbar-hide -mx-2 px-2">
                {balanceStats.merchants.map(([name, amount]) => (
                  <div 
                    key={name}
                    className="shrink-0 bg-slate-900/5 border border-slate-900/5 px-4 py-2 rounded-xl flex items-center gap-2"
                  >
                    <span className="text-[11px] font-black text-slate-600">{name}</span>
                    <span className="text-[11px] font-black text-[#34DA4F]">${amount.toLocaleString()}</span>
                  </div>
                ))}
             </div>
           )}
        </div>
      </section>

      {/* 主要內容區 */}
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
              <div className="shrink-0 w-8 h-1" />
            </div>
            
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

      {/* 底部導覽列 */}
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
