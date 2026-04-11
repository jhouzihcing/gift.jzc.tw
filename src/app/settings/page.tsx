"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronLeft, LogOut, Trash2, Plus, Store, RotateCcw } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isSyncing, lastSync } = useAuthStore();
  const { cards, customMerchants, addCustomMerchant, restoreFromTrash, deletePermanently } = useCardStore();
  
  const [newMerchant, setNewMerchant] = useState("");

  const trashCards = cards.filter(c => c.deletedAt !== null);

  const handleAddMerchant = () => {
    if (!newMerchant.trim()) return;
    addCustomMerchant(newMerchant.trim());
    setNewMerchant("");
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col font-sans text-gray-900 pb-12">
      
      {/* Header */}
      <div className="max-w-2xl mx-auto w-full">
        <header className="px-4 py-6 flex items-center gap-4 bg-gray-50 sticky top-0 z-10">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500 active:scale-95 transition-transform">
            <ChevronLeft size={28} />
          </button>
          <h1 className="text-xl font-bold tracking-tight">個人設定中心</h1>
        </header>

        <main className="p-4 flex flex-col gap-6">
          
          {/* 雲端同步狀態區塊 */}
          <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-1 relative overflow-hidden">
             <div className="flex justify-between items-center z-10">
                <h3 className="text-[10px] font-black text-[#34c759] uppercase tracking-[0.2em]">Google Drive 雲端同步</h3>
                {isSyncing && <div className="w-2 h-2 bg-[#34c759] rounded-full animate-ping" />}
             </div>
             <p className="text-xl font-black mt-2 text-slate-800 z-10">
               {isSyncing ? "正在同步資料..." : "雲端資料已對齊"}
             </p>
             <p className="text-[10px] text-slate-400 font-bold z-10 uppercase mt-1">
               最後同步：{lastSync ? new Date(lastSync).toLocaleString() : "尚未同步"}
             </p>
          </section>

          {/* 用戶資訊區塊 */}
          <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-[#34c759]/10 text-[#34c759] rounded-full flex items-center justify-center font-black text-xl border border-[#34c759]/20">
               {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div>
              <h2 className="font-black text-lg text-slate-800">{user?.displayName || "Member"}</h2>
              <p className="text-xs text-slate-400 font-bold">{user?.email}</p>
            </div>
          </section>

          {/* 自訂商家管理 */}
          <section>
            <h3 className="text-xs font-black text-slate-400 mb-3 px-2 flex items-center gap-2 uppercase tracking-widest">
              <Store size={14} /> 自訂商家管理
            </h3>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="例如：家樂福、全聯" 
                  value={newMerchant}
                  onChange={(e) => setNewMerchant(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-100 rounded-[1rem] px-4 py-3 text-sm font-bold outline-none focus:border-[#34c759] focus:bg-white transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleAddMerchant()}
                />
                <button 
                  onClick={handleAddMerchant}
                  className="bg-slate-900 text-[#34c759] px-5 rounded-[1rem] font-black active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-slate-900/10"
                >
                  <Plus size={20} />
                </button>
              </div>
              {customMerchants.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {customMerchants.map(m => (
                    <span key={m} className="bg-[#34c759]/5 text-[#34c759] px-4 py-2 rounded-xl text-xs font-black border border-[#34c759]/10">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 垃圾桶 */}
          <section>
            <h3 className="text-xs font-black text-slate-400 mb-3 px-2 flex items-center gap-2 uppercase tracking-widest">
              <Trash2 size={14} /> 已廢棄卡片
            </h3>
            <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col gap-4">
              {trashCards.length === 0 ? (
                <p className="text-slate-300 text-xs font-bold text-center py-4 uppercase tracking-widest">目前沒有垃圾</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {trashCards.map(card => (
                    <div key={card.id} className="flex justify-between items-center p-4 border border-slate-50 rounded-2xl bg-slate-50/50">
                      <div className="overflow-hidden">
                        <h4 className="font-black text-slate-700 truncate text-sm">{card.merchant} - ${card.amount}</h4>
                        <p className="text-[10px] text-slate-300 font-bold mt-1 truncate">{card.barcode}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => restoreFromTrash(card.id)}
                          className="p-2.5 bg-white rounded-xl text-slate-400 shadow-sm active:scale-95 border border-slate-100"
                        >
                           <RotateCcw size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm("確定要永久刪除此卡片紀錄嗎？刪除後無法復原。")) {
                              deletePermanently(card.id);
                            }
                          }}
                          className="p-2.5 bg-red-50 text-red-500 rounded-xl shadow-sm active:scale-95 border border-red-100"
                        >
                           <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 帳號登出 */}
          <button 
            onClick={handleLogout}
            className="mt-4 w-full bg-white text-slate-400 py-5 rounded-[2rem] font-black flex items-center justify-center gap-2 active:scale-[0.98] transition-all border border-slate-100 shadow-sm hover:text-red-500 hover:bg-red-50 hover:border-red-100"
          >
            <LogOut size={20} /> 登出帳號
          </button>

        </main>
      </div>
    </div>
  );
}
