"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { ScanLine, CreditCard, Trash2, Store, Settings } from "lucide-react";
import Barcode from "react-barcode";

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
    const list = cards
      .filter((c) => c.deletedAt === null && c.merchant === activeTab)
      .sort((a, b) => a.amount - b.amount);
    
    // 如果目前 Tab 沒資料，且只有點選 7-11，自動切換到有資料的第一個（若有）
    return list;
  }, [cards, activeTab]);

  const merchants = useMemo(() => {
    const defaultMerchants = ["7-11"];
    const existing = cards.filter(c => c.deletedAt === null).map(c => c.merchant);
    return Array.from(new Set([...defaultMerchants, ...existing]));
  }, [cards]);

  if (loading || !user) return <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center font-black tracking-widest text-gray-900 animate-pulse text-lg">LOADING SGCM...</div>;

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
              <div key={card.id} className="relative bg-white rounded-[2rem] shadow-[0_30px_70px_-20px_rgba(0,0,0,0.12)] overflow-hidden flex flex-col items-center p-8 border border-gray-100 transition-all hover:shadow-[0_40px_90px_-20px_rgba(0,0,0,0.2)]">
                 
                 {/* 商家與價格標題 */}
                 <div className="w-full text-center space-y-2 mb-6">
                    <h3 className="text-xl font-black text-gray-400 tracking-widest uppercase">{card.merchant}</h3>
                    <h2 className="text-5xl font-black text-gray-900 tracking-tighter flex items-center justify-center gap-1">
                      <span className="text-xl opacity-30">$</span>{card.amount}
                    </h2>
                 </div>

                 <div className="w-full h-[1px] bg-gray-100 mb-8" />

                 {/* 條碼渲染區域 */}
                 <div className="w-full flex flex-col gap-10 items-center overflow-hidden">
                    <div className="flex flex-col items-center gap-2 w-full">
                       <p className="text-[10px] text-gray-300 font-black uppercase tracking-[0.3em]">Barcode 1</p>
                       <div className="bg-white p-2 border border-gray-50 rounded-lg w-full flex justify-center">
                          <Barcode 
                            value={card.barcode} 
                            width={1.6} 
                            height={60} 
                            fontSize={14}
                            margin={0}
                            background="transparent"
                            fontOptions="bold"
                          />
                       </div>
                    </div>

                    {card.secondaryBarcode && (
                      <div className="flex flex-col items-center gap-2 w-full">
                        <p className="text-[10px] text-gray-300 font-black uppercase tracking-[0.3em]">Barcode 2</p>
                        <div className="bg-white p-2 border border-gray-50 rounded-lg w-full flex justify-center">
                          <Barcode 
                            value={card.secondaryBarcode} 
                            width={1.6} 
                            height={60} 
                            fontSize={14}
                            margin={0}
                            background="transparent"
                            fontOptions="bold"
                          />
                        </div>
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
                   className="mt-12 w-full py-5 bg-[#E30613] text-white font-black rounded-3xl shadow-xl shadow-red-100 active:scale-95 transition-all text-xs tracking-[0.2em] uppercase"
                 >
                   已無餘額 / 刪除卡片
                 </button>
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
