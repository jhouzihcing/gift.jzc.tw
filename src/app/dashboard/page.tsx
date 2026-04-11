"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { ScanLine, CreditCard, Trash2, Store, Settings } from "lucide-react";

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

  if (loading || !user) return <div className="min-h-[100dvh] bg-white flex items-center justify-center font-black tracking-widest text-gray-900 animate-pulse text-lg">LOADING...</div>;

  return (
    <div className="min-h-[100dvh] bg-white pb-32 relative text-gray-900 font-sans">
      
      {/* 頂部標題 */}
      <header className="px-8 py-10 flex justify-between items-center z-10 relative max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-xl border-4 border-white">
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img 
               src="/Users/jzc/.gemini/antigravity/brain/b0535309-6f2e-417d-8b38-9ea5d992d19c/sgcm_logo_v116_1775877006501_1775925585422.png" 
               alt="卡片管家 Logo" 
               className="w-full h-full object-cover"
             />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tighter text-gray-900">卡片管家</h1>
            <p className="text-[10px] text-gray-400 font-black tracking-[0.2em] mt-1 uppercase opacity-60">Smart Gift Card Butler</p>
          </div>
        </div>
      </header>

      {/* 商家分類捲動條 (Tabs) */}
      <div className="px-8 pb-4 overflow-x-auto whitespace-nowrap scrollbar-hide sticky top-0 bg-white/80 backdrop-blur-xl z-20 pt-2 border-b border-gray-100">
        <div className="flex gap-2 max-w-4xl mx-auto">
          {merchants.map((m) => (
            <button
              key={m}
              onClick={() => setActiveTab(m)}
              className={`px-6 py-3 rounded-full font-black text-xs transition-all flex items-center gap-2 uppercase tracking-widest ${
                activeTab === m 
                  ? 'bg-gray-900 text-[#00F5FF] shadow-2xl shadow-gray-900/20' 
                  : 'bg-gray-100 text-gray-400 border border-transparent hover:bg-gray-200'
              }`}
            >
              <Store size={14} /> {m} 
            </button>
          ))}
        </div>
      </div>

      {/* 主要卡片區 */}
      <main className="px-8 pt-10 max-w-4xl mx-auto">
        {displayCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-32 text-gray-400">
            <CreditCard size={80} strokeWidth={1} className="opacity-10 mb-8" />
            <p className="font-black text-xl text-gray-900 tracking-tight">空空如也</p>
            <p className="text-xs mt-2 font-bold text-gray-400">目前沒有 {activeTab} 的有效卡片</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-10">
            {displayCards.map((card) => (
              <div key={card.id} className="relative bg-white rounded-[1.5rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] overflow-hidden flex flex-col items-center p-8 border border-gray-100 transition-all hover:-translate-y-2 hover:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.15)]">
                 
                 {/* 商家與價格標題 */}
                 <div className="w-full text-center space-y-4 mb-6">
                    <h3 className="text-2xl font-black text-gray-800 tracking-tight">{card.merchant}</h3>
                    <h2 className="text-4xl font-black text-gray-900 tracking-tighter">${card.amount}</h2>
                 </div>

                 <div className="w-full h-[1px] bg-gray-100 mb-8" />

                 {/* 條碼區域 */}
                 <div className="w-full flex flex-col gap-6 items-center">
                    <div className="space-y-1 text-center">
                       <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">條碼 1</p>
                       <p className="text-xl font-bold font-mono tracking-widest text-gray-900">{card.barcode}</p>
                    </div>

                    {card.secondaryBarcode && (
                      <div className="space-y-1 text-center">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">條碼 2</p>
                        <p className="text-xl font-bold font-mono tracking-widest text-gray-900">{card.secondaryBarcode}</p>
                      </div>
                    )}
                 </div>

                 {/* 已無餘額按鈕 */}
                 <button
                   onClick={() => {
                     if (confirm("這張卡片已耗盡餘額並要移至垃圾桶嗎？")) {
                       moveToTrash(card.id);
                     }
                   }}
                   className="mt-10 w-full py-4 bg-[#E30613] text-white font-black rounded-full shadow-lg shadow-red-200 active:scale-95 transition-all text-sm tracking-widest"
                 >
                   已無餘額
                 </button>

                 <div className="absolute top-0 right-0 w-24 h-24 bg-gray-50/50 rounded-bl-[4rem] -z-10" />
              </div>
            ))}
          </div>
        )}
      </main>



      {/* 底部導航列 (Bottom Navigation Bar) */}
      <div className="fixed bottom-0 w-full bg-white/90 backdrop-blur-2xl border-t border-gray-100 pb-safe z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
        <div className="flex justify-between items-center px-8 h-20 max-w-md mx-auto relative">
          
          {/* 左側：禮物卡管家 (首頁) */}
          <button className="flex flex-col items-center justify-center gap-1 text-[#00c5cc] active:scale-95 transition-transform w-[4.5rem]">
             <CreditCard size={24} strokeWidth={2.5} />
             <span className="text-[10px] font-bold mt-1">卡管家</span>
          </button>

          {/* 中央：懸浮掃描按鈕 (浮出設計) */}
          <div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-5">
             <button 
               onClick={() => router.push("/scan")}
               className="pointer-events-auto bg-gray-900 text-white w-[4.5rem] h-[4.5rem] rounded-full flex items-center justify-center shadow-xl shadow-gray-900/30 active:scale-[0.9] transition-transform border-4 border-white"
             >
               <ScanLine size={28} />
             </button>
          </div>

          {/* 右側：設定中心 */}
          <button 
            onClick={() => router.push("/settings")}
            className="flex flex-col items-center justify-center gap-1 text-gray-400 hover:text-gray-800 transition-colors active:scale-95 w-[4.5rem]"
          >
             <Settings size={24} strokeWidth={2} />
             <span className="text-[10px] font-bold mt-1">設定</span>
          </button>
          
        </div>
      </div>
    </div>
  );
}
