"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { useRouter } from "next/navigation";
import { useState, useMemo, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { 
  ChevronLeft, LogOut, Trash2, Plus, Store, RotateCcw, 
  RefreshCw, ShieldCheck, ChevronRight, CheckCircle2, 
  Terminal, AlertTriangle, Zap, Trash
} from "lucide-react";
import { VERSION } from "@/constants/version";
import { deleteDriveFile } from "@/lib/driveFile";

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { 
    cards, cloudFileIds, customMerchants, addCustomMerchant, 
    restoreFromTrash, deletePermanently, syncLogs, setCards 
  } = useCardStore();
  
  const [newMerchant, setNewMerchant] = useState("");
  const [showLogs, setShowLogs] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const trashCards = cards.filter(c => c.deletedAt !== null);
  const activeCards = cards.filter(c => c.deletedAt === null);

  useEffect(() => {
    if (showLogs) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [syncLogs, showLogs]);

  const merchantStats = useMemo(() => {
    const stats: Record<string, number> = {};
    activeCards.forEach(card => {
      stats[card.merchant] = (stats[card.merchant] || 0) + card.amount;
    });

    customMerchants.forEach(m => {
      if (!(m in stats)) stats[m] = 0;
    });

    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  }, [activeCards, customMerchants]);

  const totalBalance = useMemo(() => {
    return activeCards.reduce((sum, c) => sum + c.amount, 0);
  }, [activeCards]);

  const handleAddMerchant = () => {
    if (!newMerchant.trim()) return;
    addCustomMerchant(newMerchant.trim());
    setNewMerchant("");
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  /**
   * 核彈級重設 (Nuclear Reset)
   * 1. 刪除雲端檔案 (隱藏 + 公開)
   * 2. 清空本地 Store
   * 3. 清理快取並重啟
   */
  const handleResetCloudSync = async () => {
    if (!user?.driveToken) return;
    
    const confirmed = window.confirm(
      "⚠️ 警告：這將永久刪除雲端上的所有同步資料，並清空此設備的卡片。此操作無法撤銷。確定要重設嗎？"
    );
    if (!confirmed) return;

    setIsResetting(true);
    try {
      // 1. 刪除雲端檔案
      if (cloudFileIds.hidden) {
        await deleteDriveFile(user.driveToken, cloudFileIds.hidden);
      }
      if (cloudFileIds.visible) {
        await deleteDriveFile(user.driveToken, cloudFileIds.visible);
      }

      // 2. 清除本地快取
      localStorage.clear(); 
      setCards([]);
      
      alert("✅ 雲端資料已清空。即將重新整理頁面...");
      window.location.href = "/"; // 強制回到首頁並重載
    } catch (e: any) {
      alert("❌ 重設失敗: " + e.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col font-sans text-gray-900 pb-12">
      
      <div className="max-w-2xl mx-auto w-full sticky top-0 z-50">
        <header className="px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6 flex items-center gap-4 bg-gray-50/80 backdrop-blur-md">
          <button onClick={() => router.back()} className="p-2 -ml-2 text-gray-500 active:scale-95 transition-transform">
            <ChevronLeft size={28} />
          </button>
          <h1 className="text-xl font-black tracking-tight text-slate-800">設定中心</h1>
        </header>
      </div>

      <main className="p-4 flex flex-col gap-6">
        
        {/* 會員身分卡片 */}
        <section className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#34DA4F]/5 rounded-full blur-2xl -mr-8 -mt-8" />
          <div className="flex items-center gap-4 relative z-10">
             <div className="w-14 h-14 bg-[#34DA4F]/10 text-[#34DA4F] rounded-2xl flex items-center justify-center font-black text-xl border border-[#34DA4F]/10">
                {user?.email?.charAt(0).toUpperCase() || "U"}
             </div>
             <div>
               <h2 className="font-black text-lg text-slate-800">{user?.displayName || "Member"}</h2>
               <p className="text-xs text-slate-400 font-bold">{user?.email}</p>
             </div>
          </div>
          <div className="flex justify-between items-end pt-5 border-t border-slate-50 relative z-10">
             <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">總資產估算</p>
                <p className="text-3xl font-black tracking-tighter text-slate-800">
                   <span className="text-sm font-black mr-1 text-[#34DA4F]">$</span>
                   {totalBalance.toLocaleString()}
                </p>
             </div>
             <div className="text-right">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">持有卡片</p>
                <p className="text-lg font-black text-slate-600">{activeCards.length} <span className="text-[10px] text-slate-300">張</span></p>
             </div>
          </div>
        </section>

        {/* 雲端同步狀態 (v2.24.0 重設工具整合版) */}
        <section className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-5 relative overflow-hidden">
           <div className="flex justify-between items-center z-10">
              <div className="space-y-1">
                 <h3 className="text-[10px] font-black text-[#34DA4F] uppercase tracking-[0.2em]">Synchronization</h3>
                 <div className="flex items-center gap-2">
                    <p className="text-xl font-black text-slate-800">帳號自動同步</p>
                 </div>
              </div>
              <div className="flex gap-2">
                 <div className="px-3 py-1.5 bg-[#34DA4F]/10 text-[#34DA4F] rounded-full border border-[#34DA4F]/10 flex items-center gap-1.5">
                    <CheckCircle2 size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">正常運作</span>
                 </div>
                 <button 
                  onClick={() => setShowLogs(!showLogs)}
                  className="p-3 bg-slate-50 text-slate-400 rounded-2xl border border-slate-100 active:scale-95 transition-all"
                >
                  <Terminal size={18} />
                </button>
              </div>
           </div>

           {showLogs && (
             <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[10px] leading-relaxed max-h-[160px] overflow-y-auto custom-scrollbar">
                   {syncLogs.length === 0 ? (
                      <p className="text-slate-500 italic">連線中...</p>
                   ) : (
                      syncLogs.map((log, i) => (
                        <p key={i} className={log.includes("❌") || log.includes("🔥") ? "text-red-400" : log.includes("✅") ? "text-[#34DA4F]" : "text-slate-400"}>
                          {log}
                        </p>
                      ))
                   )}
                   <div ref={logEndRef} />
                </div>
                
                {/* 開發者測試工具：重設按鈕 */}
                <button 
                  onClick={handleResetCloudSync}
                  disabled={isResetting}
                  className="flex items-center justify-center gap-2 w-full py-4 bg-red-50 text-red-500 rounded-2xl border border-red-100 font-black text-xs uppercase tracking-widest active:scale-95 disabled:opacity-50 transition-all"
                >
                  {isResetting ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Zap size={14} />
                  )}
                  重設雲端同步並清空資料
                </button>
             </div>
           )}

           <div className="flex items-start gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <ShieldCheck size={16} className="text-[#34DA4F] shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-400 font-bold leading-normal italic">
                系統已自動鎖定您的 Google 帳號身分。如果您需要重新開始測試，請點選終端機圖示展開開發者重設選項。
              </p>
           </div>
        </section>

        {/* 商家管理 */}
        <section>
          <h3 className="text-xs font-black text-slate-400 mb-3 px-2 flex items-center gap-2 uppercase tracking-widest leading-none">
            <Store size={14} /> 商家餘額與管理
          </h3>
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-6">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="新增自訂商家..." 
                value={newMerchant}
                onChange={(e) => setNewMerchant(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-[1.2rem] px-4 py-3 text-sm font-bold outline-none focus:border-[#34DA4F] transition-all"
              />
              <button 
                onClick={handleAddMerchant}
                className="bg-slate-800 text-[#34DA4F] px-5 rounded-[1.2rem] font-black active:scale-95 transition-all flex items-center justify-center"
              >
                <Plus size={20} />
              </button>
            </div>
            <div className="flex flex-col gap-2">
               {merchantStats.length === 0 ? (
                 <p className="text-center py-4 text-xs text-slate-300 font-bold uppercase tracking-widest">尚無商家資料</p>
               ) : (
                 merchantStats.map(([name, amount]) => (
                    <div key={name} className="flex justify-between items-center py-4 px-5 bg-slate-50/50 rounded-2xl border border-slate-50">
                       <span className="font-black text-slate-600 text-sm">{name}</span>
                       <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-black text-[#34DA4F]">$</span>
                          <span className="font-black text-slate-800 text-base">{amount.toLocaleString()}</span>
                       </div>
                    </div>
                 ))
               )}
            </div>
          </div>
        </section>

        {/* 資源回收桶 */}
        <section>
          <h3 className="text-xs font-black text-slate-400 mb-3 px-2 flex items-center gap-2 uppercase tracking-widest">
            <Trash2 size={14} /> 已廢棄卡片
          </h3>
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-4">
            {trashCards.length === 0 ? (
              <p className="text-slate-300 text-xs font-bold text-center py-4 uppercase tracking-widest leading-loose">回收桶空空如也</p>
            ) : (
              <div className="flex flex-col gap-3">
                {trashCards.map(card => (
                  <div key={card.id} className="flex justify-between items-center p-4 border border-slate-50 rounded-2xl bg-slate-50/50">
                    <div className="overflow-hidden">
                      <h4 className="font-black text-slate-700 truncate text-sm">{card.merchant} - ${card.amount}</h4>
                      <p className="text-[10px] text-slate-300 font-bold mt-1 truncate">{card.barcode}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => restoreFromTrash(card.id)} className="p-2.5 bg-white rounded-xl text-slate-400 border border-slate-100 active:scale-90 transition-all"><RotateCcw size={16} /></button>
                      <button onClick={() => deletePermanently(card.id)} className="p-2.5 bg-red-50 text-red-500 rounded-xl border border-red-100 active:scale-90 transition-all"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-col gap-3">
           <button 
             onClick={() => router.push("/settings/privacy")}
             className="w-full bg-white px-6 py-5 rounded-[2.2rem] border border-slate-100 shadow-sm flex justify-between items-center active:scale-[0.98] transition-all"
           >
              <div className="flex items-center gap-4">
                 <ShieldCheck size={20} className="text-[#34DA4F]" />
                 <span className="font-black text-sm text-slate-800">隱私權摘要與法律條款</span>
              </div>
              <ChevronRight size={20} className="text-slate-200" />
           </button>
           <button onClick={handleLogout} className="w-full bg-white text-slate-400 py-6 rounded-[2.2rem] font-black flex items-center justify-center gap-2 border border-slate-100 shadow-sm hover:text-red-500 hover:bg-red-50 hover:border-red-100 transition-all active:scale-[0.98]">
             <LogOut size={20} /> 登出帳號
           </button>
        </div>

        <div className="text-center opacity-20 mt-4">
           <p className="text-[10px] font-black tracking-[0.5em] uppercase leading-none">ZJ Card {VERSION}</p>
        </div>
      </main>
    </div>
  );
}
