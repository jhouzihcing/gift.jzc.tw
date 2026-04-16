"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { useRouter } from "next/navigation";
import { useState, useMemo, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { 
  ChevronLeft, LogOut, Trash2, Plus, Store, RotateCcw, 
  RefreshCw, ShieldCheck, ChevronRight, Code, Database, 
  CloudDownload, AlertCircle, EyeOff, Terminal, Info
} from "lucide-react";
import { VERSION } from "@/constants/version";
import { readDriveDB, getOrCreateDriveFile } from "@/lib/driveFile";

export default function SettingsPage() {
  const router = useRouter();
  const { user, isSyncing, lastSync, setSyncStatus, setSyncError } = useAuthStore();
  const { 
    cards, cloudFileIds, customMerchants, addCustomMerchant,
    restoreFromTrash, deletePermanently, setCards, setCloudFileIds,
    syncLogs, addSyncLog
  } = useCardStore();
  
  const [newMerchant, setNewMerchant] = useState("");
  const [isOverwriting, setIsOverwriting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
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

  // v2.19.0: 強制同步校對 (AppData 優先 + 詳細日誌)
  const handleForceCloudRestore = async () => {
    if (!user?.driveToken || !user?.uid) return;
    if (!confirm("⚠️ 這將強制優先從隱藏空間抓取資料，並覆蓋現有的手機資料，確定執行？")) return;

    setIsOverwriting(true);
    setShowLogs(true);
    setSyncStatus(true, lastSync);
    addSyncLog("🚨 啟動手動強制校驗流程...");

    try {
      addSyncLog("🔍 開始全域 ID 重新偵測...");
      const hid = await getOrCreateDriveFile(user.driveToken, user.uid, 'appDataFolder', addSyncLog);
      const vid = await getOrCreateDriveFile(user.driveToken, user.uid, 'drive', addSyncLog);
      setCloudFileIds({ visible: vid, hidden: hid });

      addSyncLog("📥 正在強行讀取 AppData 資料庫...");
      let primarySource = await readDriveDB(user.driveToken, hid, user.uid, addSyncLog);
      
      if (primarySource.db.cards.length === 0) {
         addSyncLog("ℹ️ AppData 無資料，嘗試轉向顯性空間備援...");
         try {
           const legacy = await readDriveDB(user.driveToken, vid, user.uid, addSyncLog);
           if (legacy.db.cards.length > 0) primarySource = legacy;
         } catch (e) {
           addSyncLog("⚠️ 顯性空間讀取失敗。");
         }
      }

      const syncedCards = primarySource.db.cards.map(c => ({ ...c, isSynced: true }));
      setCards(syncedCards);
      
      if (primarySource.db.customMerchants) {
        primarySource.db.customMerchants.forEach(m => addCustomMerchant(m));
      }

      addSyncLog("🎉 強制校對成功，本地資料已與雲端同步。");
      alert("🎉 雲端資料已成功載入！");
    } catch (err: any) {
      addSyncLog(`❌ 強制校對失敗: ${err.message || "未知原因"}`);
      alert("❌ 校對失敗，請查看執行日誌。");
      setSyncError(true);
    } finally {
      setIsOverwriting(false);
      setSyncStatus(false, Date.now());
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("已複製到剪貼簿！");
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

        {/* 同步穩定性診斷 (v2.19.0 同步日誌版) */}
        <section className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-5 relative overflow-hidden">
           <div className="flex justify-between items-start z-10">
              <div className="space-y-1">
                 <h3 className="text-[10px] font-black text-[#34DA4F] uppercase tracking-[0.2em]">Diagnostic Console</h3>
                 <div className="flex items-center gap-2">
                    <p className="text-xl font-black text-slate-800">同步執行偵測日誌</p>
                 </div>
              </div>
              <div className="flex gap-2">
                 <button 
                  onClick={() => setShowLogs(!showLogs)}
                  className={`p-3 rounded-2xl border shadow-sm flex items-center justify-center transition-all ${showLogs ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                >
                  <Terminal size={20} />
                </button>
                 <button 
                  onClick={handleForceCloudRestore}
                  disabled={isOverwriting || isSyncing}
                  className="p-3 bg-red-50 text-red-500 rounded-2xl border border-red-100 shadow-sm flex items-center justify-center active:scale-90 transition-all disabled:opacity-30"
                >
                  <CloudDownload size={20} />
                </button>
              </div>
           </div>

           {/* 日誌主控台 */}
           {showLogs && (
             <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[10px] leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar border border-slate-800 shadow-inner">
                <div className="flex items-center gap-2 text-[#34DA4F] mb-3 pb-2 border-b border-white/10 opacity-80">
                   <div className="w-2 h-2 rounded-full bg-[#34DA4F] animate-pulse" />
                   <span className="font-black uppercase tracking-widest">Real-time Sync Log</span>
                </div>
                {syncLogs.length === 0 ? (
                   <p className="text-slate-500 italic">尚未產生診斷日誌...</p>
                ) : (
                   <div className="flex flex-col gap-1.5">
                      {syncLogs.map((log, i) => (
                        <p key={i} className={log.includes("❌") || log.includes("🔥") ? "text-red-400" : log.includes("✅") ? "text-[#34DA4F]" : "text-slate-300"}>
                          {log}
                        </p>
                      ))}
                      <div ref={logEndRef} />
                   </div>
                )}
             </div>
           )}
           
           <div className="space-y-3 pt-2 border-t border-slate-50 relative z-10 text-[10px] font-bold">
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5"><EyeOff size={12} className="text-[#34DA4F]" /> HIDDEN ID</span>
                <span onClick={() => cloudFileIds.hidden && copyToClipboard(cloudFileIds.hidden)} className="font-mono cursor-pointer truncate max-w-[140px] text-slate-300 hover:text-slate-500">{cloudFileIds.hidden || "對齊中..."}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5"><Code size={12} /> DEVICE UID</span>
                <span className="font-mono text-slate-200">{user?.uid ? `${user.uid.slice(0, 6)}...${user.uid.slice(-4)}` : "連結中..."}</span>
              </div>
           </div>

           <div className="flex items-start gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <Info size={16} className="text-[#34DA4F] shrink-0 mt-0.5" />
              <p className="text-[10px] text-slate-400 font-bold leading-normal italic">
                如果您無法同步，請展開終端機圖示將執行日誌截圖傳給開發團隊，我們能精準鎖定加密金鑰或雲端搜尋是否異常。
              </p>
           </div>
        </section>

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

        <section>
          <h3 className="text-xs font-black text-slate-400 mb-3 px-2 flex items-center gap-2 uppercase tracking-widest">
            <Trash2 size={14} /> 已廢棄卡片
          </h3>
          <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-4">
            {trashCards.length === 0 ? (
              <p className="text-slate-300 text-xs font-bold text-center py-4 uppercase tracking-widest leading-loose">資料清理中</p>
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
