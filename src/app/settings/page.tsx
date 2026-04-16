"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { useCardStore } from "@/store/useCardStore";
import { useRouter } from "next/navigation";
import { useState, useMemo, useRef, useEffect } from "react";
import { signOut } from "next-auth/react";
import { 
  ChevronLeft, LogOut, Trash2, Plus, Store, RotateCcw, 
  RefreshCw, ShieldCheck, ChevronRight, Code, Database, 
  CloudDownload, AlertCircle, EyeOff, Terminal, Info, Key,
  XCircle, CheckCircle2
} from "lucide-react";
import { VERSION } from "@/constants/version";
import { readDriveDB, getOrCreateDriveFile } from "@/lib/driveFile";
import { getKeyHash } from "@/lib/crypto";

export default function SettingsPage() {
  const router = useRouter();
  const { 
    user, isSyncing, lastSync, setSyncStatus, setSyncError, 
    syncOverrideUid, setSyncOverrideUid 
  } = useAuthStore();
  const { 
    cards, cloudFileIds, customMerchants, addCustomMerchant,
    restoreFromTrash, deletePermanently, setCards, setCloudFileIds,
    syncLogs, addSyncLog
  } = useCardStore();
  
  const [newMerchant, setNewMerchant] = useState("");
  const [isOverwriting, setIsOverwriting] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [showKeyTool, setShowKeyTool] = useState(false);
  const [manualUid, setManualUid] = useState("");
  const [currentKeyHash, setCurrentKeyHash] = useState("計算中...");
  
  const logEndRef = useRef<HTMLDivElement>(null);

  const trashCards = cards.filter(c => c.deletedAt !== null);
  const activeCards = cards.filter(c => c.deletedAt === null);

  useEffect(() => {
    if (showLogs) {
      logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [syncLogs, showLogs]);

  useEffect(() => {
    const fetchHash = async () => {
      const uid = syncOverrideUid || user?.uid;
      if (uid) {
        const hash = await getKeyHash(uid);
        setCurrentKeyHash(hash);
      }
    };
    fetchHash();
  }, [syncOverrideUid, user?.uid]);

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

  const handleApplyManualUid = () => {
    if (!manualUid.trim()) return;
    setSyncOverrideUid(manualUid.trim());
    setManualUid("");
    alert("🔐 已套用自訂金鑰！系統將重新載入雲端資料。");
    window.location.reload();
  };

  const clearManualUid = () => {
    setSyncOverrideUid(null);
    alert("🔄 已恢復使用系統預設金鑰。");
    window.location.reload();
  };

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/" });
  };

  const handleForceCloudRestore = async () => {
    const uid = syncOverrideUid || user?.uid;
    if (!user?.driveToken || !uid) return;
    if (!confirm("⚠️ 這將強制優先從隱藏空間抓取資料，並覆蓋現有的手機資料，確定執行？")) return;

    setIsOverwriting(true);
    setShowLogs(true);
    setSyncStatus(true, lastSync);
    addSyncLog("🚨 啟動手動強制校驗流程...");

    try {
      addSyncLog("🔍 開始全域 ID 重新偵測...");
      const hid = await getOrCreateDriveFile(user.driveToken, uid, 'appDataFolder', addSyncLog);
      const vid = await getOrCreateDriveFile(user.driveToken, uid, 'drive', addSyncLog);
      setCloudFileIds({ visible: vid, hidden: hid });

      addSyncLog("📥 正在強行讀取 AppData 資料庫...");
      let primarySource = await readDriveDB(user.driveToken, hid, uid, addSyncLog);
      
      if (primarySource.db.cards.length === 0) {
         addSyncLog("ℹ️ AppData 無資料，嘗試轉向顯性空間備援...");
         try {
           const legacy = await readDriveDB(user.driveToken, vid, uid, addSyncLog);
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

        {/* 同步日誌與金鑰診斷 (v2.20.0 Key Harmony) */}
        <section className="bg-white p-7 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col gap-5 relative overflow-hidden">
           <div className="flex justify-between items-start z-10">
              <div className="space-y-1">
                 <h3 className="text-[10px] font-black text-[#34DA4F] uppercase tracking-[0.2em]">Sync Diagnostic Engine</h3>
                 <div className="flex items-center gap-2">
                    <p className="text-xl font-black text-slate-800">執行日誌與金鑰校對</p>
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
                  onClick={() => setShowKeyTool(!showKeyTool)}
                  className={`p-3 rounded-2xl border shadow-sm flex items-center justify-center transition-all ${showKeyTool ? 'bg-[#34DA4F] text-white border-[#34DA4F]' : 'bg-slate-50 text-slate-400 border-slate-100'}`}
                >
                  <Key size={20} />
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

           {/* 金鑰校對工具 */}
           {showKeyTool && (
             <div className="bg-[#34DA4F]/5 rounded-2xl p-5 border border-[#34DA4F]/10 flex flex-col gap-4">
                <div className="flex justify-between items-center mb-1">
                   <div className="flex items-center gap-2">
                      <ShieldCheck size={16} className="text-[#34DA4F]" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Key Hash Fingerprint</span>
                   </div>
                   <span className="font-mono text-xs font-black text-[#34DA4F] bg-white px-3 py-1 rounded-full border border-[#34DA4F]/20">[{currentKeyHash}]</span>
                </div>
                
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed px-1">
                   若兩台手機的 [Key Hash] 不同，則無法互通讀取。請複製原設備的 UID 並在下方貼上套用。
                </p>

                <div className="relative group">
                   <input 
                      type="text"
                      placeholder="貼上原設備的 UID..."
                      value={manualUid}
                      onChange={(e) => setManualUid(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-[10px] font-mono outline-none focus:border-[#34DA4F] transition-all pr-20"
                   />
                   <button 
                      onClick={handleApplyManualUid}
                      className="absolute right-2 top-2 bottom-2 bg-slate-800 text-white px-3 rounded-lg text-[10px] font-black flex items-center gap-1 active:scale-95 transition-all"
                   >
                     套用
                   </button>
                </div>

                {syncOverrideUid && (
                   <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-red-100">
                      <div className="flex items-center gap-2">
                         <AlertCircle size={14} className="text-red-500" />
                         <span className="text-[10px] font-black text-red-500 tracking-tight">正使用手動覆蓋金鑰運作中</span>
                      </div>
                      <button onClick={clearManualUid} className="text-[10px] font-black text-slate-400 underline underline-offset-2">清除</button>
                   </div>
                )}
             </div>
           )}

           {/* 日誌主控台 */}
           {showLogs && (
             <div className="bg-slate-900 rounded-2xl p-4 font-mono text-[10px] leading-relaxed max-h-[300px] overflow-y-auto custom-scrollbar border border-slate-800 shadow-inner">
                <div className="flex items-center gap-2 text-[#34DA4F] mb-3 pb-2 border-b border-white/10 opacity-80">
                   <div className="w-2 h-2 rounded-full bg-[#34DA4F] animate-pulse" />
                   <span className="font-black uppercase tracking-widest">Diagnostic Console</span>
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
                <span className="flex items-center gap-1.5"><EyeOff size={12} className="text-[#34DA4F]" /> DEVICE UID (COPY)</span>
                <span onClick={() => user?.uid && copyToClipboard(user.uid)} className="font-mono cursor-pointer truncate max-w-[140px] text-slate-300 hover:text-slate-500 underline underline-offset-4 decoration-slate-100">{user?.uid ? `${user.uid.slice(0, 8)}...` : "讀取中..."}</span>
              </div>
              <div className="flex justify-between items-center text-slate-400">
                <span className="flex items-center gap-1.5"><Database size={12} /> CLOUD HIDDEN ID</span>
                <span className="font-mono text-slate-200 truncate max-w-[140px]">{cloudFileIds.hidden || "連結中..."}</span>
              </div>
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
