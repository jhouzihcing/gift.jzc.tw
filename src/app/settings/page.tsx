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
          <section className="bg-gray-900 text-white p-6 rounded-3xl shadow-lg shadow-gray-900/20 flex flex-col gap-1 relative overflow-hidden">
             <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-[#00F5FF]/10 rounded-full blur-2xl pointer-events-none" />
             <div className="flex justify-between items-center z-10">
                <h3 className="text-xs font-bold text-[#00F5FF] uppercase tracking-widest">Google Drive 雲端同步</h3>
                {isSyncing && <div className="w-2 h-2 bg-[#00F5FF] rounded-full animate-ping" />}
             </div>
             <p className="text-lg font-black mt-1 z-10">
               {isSyncing ? "正在同步資料..." : "雲端資料已對齊"}
             </p>
             <p className="text-[10px] text-gray-400 font-medium z-10">
               最後同步時間：{lastSync ? new Date(lastSync).toLocaleString() : "尚未同步"}
             </p>
          </section>

          {/* 用戶資訊區塊 */}
          <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-[#00F5FF]/10 text-[#00c5cc] rounded-full flex items-center justify-center font-bold text-xl">
               {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div>
              <h2 className="font-bold text-lg">{user?.displayName || "Member"}</h2>
              <p className="text-sm text-gray-500 font-medium">{user?.email}</p>
            </div>
          </section>

          {/* 自訂商家管理 */}
          <section>
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
              <Store size={18} /> 自訂商家管理
            </h3>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="例如：家樂福大潤發" 
                  value={newMerchant}
                  onChange={(e) => setNewMerchant(e.target.value)}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-[1rem] px-4 py-3 outline-none focus:border-[#00F5FF] focus:bg-white transition-colors"
                  onKeyDown={(e) => e.key === "Enter" && handleAddMerchant()}
                />
                <button 
                  onClick={handleAddMerchant}
                  className="bg-gray-900 text-white px-5 rounded-[1rem] font-bold active:scale-95 transition-transform flex items-center justify-center shadow-md shadow-gray-900/20"
                >
                  <Plus size={20} />
                </button>
              </div>
              {customMerchants.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {customMerchants.map(m => (
                    <span key={m} className="bg-[#00F5FF]/10 text-[#00c5cc] px-3 py-1.5 rounded-lg text-sm font-bold border border-[#00F5FF]/20">
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 垃圾桶 */}
          <section>
            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2 text-red-500">
              <Trash2 size={18} /> 垃圾桶 (已廢棄)
            </h3>
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col gap-4">
              {trashCards.length === 0 ? (
                <p className="text-gray-400 text-sm font-medium text-center py-4">目前沒有垃圾</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {trashCards.map(card => (
                    <div key={card.id} className="flex justify-between items-center p-3 border border-gray-100 rounded-2xl bg-gray-50">
                      <div className="overflow-hidden">
                        <h4 className="font-bold text-gray-800 truncate">{card.name}</h4>
                        <p className="text-xs text-gray-500 font-mono mt-1 w-[120px] truncate">{card.barcode}</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => restoreFromTrash(card.id)}
                          className="p-2 bg-white rounded-lg text-gray-500 shadow-sm active:scale-95 border border-gray-200"
                          title="復原卡片"
                        >
                           <RotateCcw size={16} />
                        </button>
                        <button 
                          onClick={() => {
                            if (confirm("確定要永久刪除此卡片紀錄嗎？刪除後無法復原。")) {
                              deletePermanently(card.id);
                            }
                          }}
                          className="p-2 bg-red-50 text-red-500 rounded-lg shadow-sm active:scale-95 border border-red-100"
                          title="永久刪除"
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
            className="mt-4 w-full bg-red-50 text-red-600 py-4 rounded-[1.25rem] font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform border border-red-100 shadow-sm"
          >
            <LogOut size={20} /> 登出帳號
          </button>

        </main>
      </div>
    </div>
  );
}
