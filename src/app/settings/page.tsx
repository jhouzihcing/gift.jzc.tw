"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronLeft, LogOut, Trash2, Plus, Store, RotateCcw, CloudSync, RefreshCw, ShieldCheck, ChevronRight } from "lucide-react";
import { useDriveSync } from "@/hooks/useDriveSync";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isSyncing, lastSync } = useAuthStore();
  const { cards, customMerchants, addCustomMerchant, restoreFromTrash, deletePermanently } = useCardStore();
  
  // v1.3.0 同步鉤子
  const sync = useDriveSync();
  
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
      
      {/* Header - Fixed & Sticky */}
      <div className="max-w-2xl mx-auto w-full sticky top-0 z-50">
        <header className="px-4 py-6 flex items-center gap-4 bg-gray-50/80 backdrop-blur-md border-b border-transparent">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500 active:scale-95 transition-transform">
            <ChevronLeft size={28} />
          </button>
          <h1 className="text-xl font-black tracking-tight text-slate-800">設定中心</h1>
        </header>
      </div>

        <main className="p-4 flex flex-col gap-6">
          
          {/* 雲端同步狀態區塊 (v1.3.0 升級) */}
          <section className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-5 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-[#34DA4F]/5 rounded-full -translate-y-12 translate-x-12 blur-2xl" />
             
             <div className="flex justify-between items-start z-10">
                <div className="space-y-1">
                   <h3 className="text-[10px] font-black text-[#34DA4F] uppercase tracking-[0.2em]">Google Drive 實時大數據</h3>
                   <div className="flex items-center gap-2">
                      <p className="text-2xl font-black text-slate-800">
                        {isSyncing ? "數據對話中..." : "雲端試算表已對齊"}
                      </p>
                      {isSyncing && <RefreshCw size={18} className="text-[#34DA4F] animate-spin" />}
                   </div>
                </div>
                {!isSyncing && (
                  <button 
                    onClick={() => window.location.reload()} 
                    className="p-3 bg-slate-50 text-[#34DA4F] rounded-2xl active:scale-90 transition-all border border-slate-100 shadow-sm"
                    title="重新初始化同步"
                  >
                    <CloudSync size={20} />
                  </button>
                )}
             </div>

             <div className="flex flex-col gap-1 z-10">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                   最後同步：{lastSync ? new Date(lastSync).toLocaleString() : "尚未同步"}
                </p>
                <p className="text-[9px] text-slate-300 font-bold italic">
                   * 垃圾桶卡片將於 15 天後自動永久消失
                </p>
             </div>
          </section>

          {/* 用戶資訊區塊 */}
          <section className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-[#34DA4F]/10 text-[#34DA4F] rounded-full flex items-center justify-center font-black text-xl border border-[#34DA4F]/20">
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
                  className="flex-1 bg-slate-50 border border-slate-100 rounded-[1rem] px-4 py-3 text-sm font-bold outline-none focus:border-[#34DA4F] focus:bg-white transition-all"
                  onKeyDown={(e) => e.key === "Enter" && handleAddMerchant()}
                />
                <button 
                  onClick={handleAddMerchant}
                  className="bg-slate-900 text-[#34DA4F] px-5 rounded-[1rem] font-black active:scale-95 transition-all flex items-center justify-center shadow-lg shadow-slate-900/10"
                >
                  <Plus size={20} />
                </button>
              </div>
              {customMerchants.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {customMerchants.map(m => (
                    <span key={m} className="bg-[#34DA4F]/5 text-[#34DA4F] px-4 py-2 rounded-xl text-xs font-black border border-[#34DA4F]/10">
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

          {/* 系統與法律 */}
          <section>
            <h3 className="text-xs font-black text-slate-400 mb-3 px-2 flex items-center gap-2 uppercase tracking-widest">
               安全與法律
            </h3>
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
               <button 
                 onClick={() => router.push("/settings/privacy")}
                 className="w-full px-6 py-5 flex justify-between items-center active:bg-slate-50 transition-all"
               >
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center">
                       <ShieldCheck size={20} />
                    </div>
                    <div className="text-left">
                       <p className="font-black text-sm text-slate-800">隱私權摘要與法律條款</p>
                       <p className="text-[10px] text-slate-300 font-bold uppercase">Privacy & Legal</p>
                    </div>
                 </div>
                 <ChevronRight size={20} className="text-slate-300" />
               </button>
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
  );
}
