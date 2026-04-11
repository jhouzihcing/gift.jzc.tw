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
    const defaultMerchants = ["7-11", "全家"];
    const existing = cards.filter(c => c.deletedAt === null).map(c => c.merchant);
    return Array.from(new Set([...defaultMerchants, ...existing]));
  }, [cards]);

  if (loading || !user) return <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center font-bold tracking-widest text-[#00F5FF] animate-pulse">載入中...</div>;

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-32 relative text-gray-900 font-sans">
      
      {/* 頂部標題 */}
      <header className="px-6 py-6 flex justify-between items-center bg-gray-50 z-10 relative max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">我的卡包</h1>
          <p className="text-sm text-gray-500 font-medium tracking-wide mt-1">Hello, {user.displayName || "使用者"}</p>
        </div>
      </header>

      {/* 商家分類捲動條 (Tabs) */}
      <div className="px-6 pb-4 overflow-x-auto whitespace-nowrap scrollbar-hide sticky top-0 bg-gray-50/90 backdrop-blur-xl z-20 pt-2 border-b border-gray-200/50">
        <div className="flex gap-2 max-w-4xl mx-auto">
          {merchants.map((m) => (
            <button
              key={m}
              onClick={() => setActiveTab(m)}
              className={`px-5 py-2.5 rounded-full font-bold text-sm transition-all flex items-center gap-2 ${
                activeTab === m 
                  ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20' 
                  : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              <Store size={16} className={activeTab === m ? "text-[#00F5FF]" : "opacity-50"} /> {m} 
            </button>
          ))}
        </div>
      </div>

      {/* 主要卡片區 */}
      <main className="px-6 pt-6 max-w-4xl mx-auto">
        {displayCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center mt-20 text-gray-400">
            <CreditCard size={64} strokeWidth={1} className="opacity-30 mb-6" />
            <p className="font-semibold text-lg text-gray-500">目前沒有 {activeTab} 的有效卡片</p>
            <p className="text-sm mt-2">快去為這個商家建檔吧！</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayCards.map((card) => (
              <div key={card.id} className="relative bg-white p-5 rounded-[1.5rem] shadow-sm border border-gray-100 flex flex-col justify-between transition-transform overflow-hidden group hover:shadow-md">
                 
                 {/* 視覺裝飾光暈 */}
                 <div className="absolute top-[-20%] right-[-10%] w-24 h-24 bg-[#00F5FF]/10 rounded-full blur-2xl pointer-events-none" />

                 <div className="flex justify-between items-start z-10">
                   <div className="w-12 h-12 rounded-[1rem] bg-gray-50 flex items-center justify-center border border-gray-100">
                      <CreditCard size={24} className="text-gray-300" />
                   </div>
                   <h2 className="text-3xl font-black text-gray-900 tracking-tighter">
                     <span className="text-sm font-bold text-gray-400 mr-1">$</span>
                     {card.amount}
                   </h2>
                 </div>
                 
                 <div className="mt-6 z-10">
                   <h3 className="font-bold text-gray-800 leading-tight">{card.name}</h3>
                   <div className="flex justify-between items-end mt-2">
                     <p className="text-xs font-mono bg-gray-50 px-2 py-1 rounded inline-block text-gray-400 truncate max-w-[150px] border border-gray-100">
                       {card.barcode}
                     </p>
                     
                     <button
                       onClick={() => {
                         if (confirm("這張卡片裡面的餘額已經確定用完了嗎？")) {
                           moveToTrash(card.id);
                         }
                       }}
                       className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90 bg-white shadow-sm border border-transparent hover:border-red-100"
                       title="移至垃圾桶"
                     >
                       <Trash2 size={18} />
                     </button>
                   </div>
                 </div>
                 
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
