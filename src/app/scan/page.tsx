"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useScanner } from "@/hooks/useScanner";
import ScannerOverlay from "@/components/ScannerOverlay";
import { useCardStore } from "@/store/useCardStore";
import { ScanLine, ChevronLeft, Layers, Minus } from "lucide-react";
import { useDriveSync } from "@/hooks/useDriveSync";

export default function ScanPage() {
  const router = useRouter();
  const { 
    startScanning, 
    stopScanning, 
    scanState, 
    data, 
    errorMsg, 
    isDualMode, 
    setIsDualMode, 
    resetData,
    skipSecondary 
  } = useScanner("reader-video");
  
  const { addCard, customMerchants } = useCardStore();

  const [isReadyToScan, setIsReadyToScan] = useState(false);
  const [merchant, setMerchant] = useState("7-11");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [amount, setAmount] = useState<number | "">("");
  const [isBatch, setIsBatch] = useState(true);

  // 初始化模式偏好
  useEffect(() => {
    const savedMode = localStorage.getItem("sgcm-scan-mode");
    if (savedMode === "dual") setIsDualMode(true);
    else if (savedMode === "single") setIsDualMode(false);
  }, [setIsDualMode]);

  const handleStart = () => {
    if (!amount || Number(amount) <= 0) {
      alert("請輸入正確的面額！");
      return;
    }
    if (isCustomMode && !merchant.trim()) {
      alert("請輸入商家名稱！");
      return;
    }
    setIsReadyToScan(true);
  };

  // 當商家改變時的智能切換
  const handleMerchantChange = (m: string) => {
    if (m === "其它自訂") {
      setIsCustomMode(true);
      setMerchant("");
    } else {
      setIsCustomMode(false);
      setMerchant(m);
      if (m === "7-11") {
        setIsDualMode(true);
      }
    }
  };

  // 儲存用戶手動切換的偏好
  const toggleDualMode = () => {
    const nextMode = !isDualMode;
    setIsDualMode(nextMode);
    localStorage.setItem("sgcm-scan-mode", nextMode ? "dual" : "single");
  };

  useEffect(() => {
    if (isReadyToScan) {
      startScanning();
    } else {
      stopScanning();
    }
    return () => { stopScanning(); };
  }, [isReadyToScan, startScanning, stopScanning]);

  const { syncImmediately } = useDriveSync();
  const [sessionCards, setSessionCards] = useState<any[]>([]);
  const lastScannedId = useRef<string | null>(null);

  // v1.11.0 自動存檔與 Session 追蹤
  useEffect(() => {
    if (scanState === "success") {
      const rawMerchant = isCustomMode && !merchant.trim() ? "未命名商家" : merchant;
      const cleanMerchant = rawMerchant.trim().replace(/[<>]/g, "").substring(0, 20);

      const generateId = () => {
        if (typeof window !== "undefined" && window.crypto?.randomUUID) {
          return window.crypto.randomUUID();
        }
        return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      };

      const newId = generateId();
      
      // 防止 React StrictMode 或重複觸發
      if (lastScannedId.current === data.primary) return;
      lastScannedId.current = data.primary;

      const newCard = {
        id: newId,
        merchant: cleanMerchant,
        name: cleanMerchant === "7-11" ? "7-11 商品卡" : `${cleanMerchant} 禮物卡`,
        barcode: data.primary || "",
        secondaryBarcode: data.secondary || null,
        amount: Number(amount),
        createdAt: Date.now(),
        deletedAt: null,
        isSynced: false
      };

      const added = addCard(newCard);
      if (added) {
        setSessionCards(prev => [newCard, ...prev]);
        if (syncImmediately) syncImmediately(newCard);
      }
    } else if (scanState === "scanning-a" || scanState === "idle") {
      lastScannedId.current = null; // 重設追蹤
    }
  }, [scanState, addCard, data, merchant, isCustomMode, amount, syncImmediately]);

  const handleFinish = () => {
    stopScanning();
    router.push("/dashboard");
  };

  const handleClose = () => {
    if (isReadyToScan) {
      setIsReadyToScan(false); 
    } else {
      router.back();
    }
  };

  if (!isReadyToScan) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900 font-sans">
         <div className="w-full max-w-sm flex flex-col gap-8 relative">
            <div className="absolute top-[-15%] left-[-15%] w-[50vw] h-[50vw] bg-[#34DA4F]/10 rounded-full blur-[80px] pointer-events-none" />

            <button onClick={() => router.back()} className="self-start text-slate-300 hover:text-slate-900 transition-all p-2 -ml-2 z-10">
              <ChevronLeft size={32} />
            </button>
            
            <div className="text-left z-10">
              <h1 className="text-4xl font-black tracking-tight text-slate-900">批量掃描</h1>
              <p className="text-sm text-[#34DA4F] mt-2 font-black uppercase tracking-[0.4em]">Setup Session</p>
            </div>

            <div className="space-y-6 z-10">
              <div className="flex flex-col gap-3">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">選擇商家</label>
                <div className="flex gap-2 overflow-x-auto pb-4 pt-1 scrollbar-hide snap-x">
                  {["7-11", ...customMerchants, "其它自訂"].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleMerchantChange(m)}
                      className={`shrink-0 px-6 py-4 rounded-[1.5rem] font-black transition-all snap-start border-2 text-sm ${
                        (isCustomMode && m === "其它自訂") || (!isCustomMode && merchant === m)
                          ? "bg-slate-900 text-[#34DA4F] border-slate-900 shadow-xl shadow-slate-900/10" 
                          : "bg-white text-slate-400 border-slate-100 hover:bg-slate-50 shadow-sm"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                
                {isCustomMode && (
                   <input 
                     type="text" 
                     placeholder="請輸入商家名稱..." 
                     value={merchant}
                     onChange={(e) => setMerchant(e.target.value)}
                     className="w-full bg-white border-2 border-slate-100 rounded-[1.5rem] px-6 py-4 text-xl font-black text-slate-900 outline-none focus:border-[#34DA4F] transition-all shadow-sm"
                   />
                )}
              </div>

              <div className="flex flex-col gap-3">
                 <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">卡片面額 (金額)</label>
                 <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-[#34DA4F]">$</span>
                    <input 
                      type="number" 
                      placeholder="500" 
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full bg-white border-2 border-slate-100 rounded-[2rem] pl-12 pr-6 py-6 text-5xl font-black text-slate-900 outline-none focus:border-[#34DA4F] transition-all shadow-sm placeholder:text-slate-50"
                    />
                 </div>
              </div>

              <div className="bg-white p-6 rounded-[2rem] shadow-[0_10px_40px_-10px_rgba(52,199,89,0.1)] border border-slate-100">
                 <div className="flex items-center justify-between">
                    <div>
                       <h3 className="font-black text-slate-800 text-sm">智慧雙條碼模式</h3>
                       <p className="text-[10px] text-slate-400 mt-1 font-bold italic">自動識別卡號與密碼</p>
                    </div>
                    <button 
                      onClick={toggleDualMode}
                      className={`w-14 h-8 rounded-full transition-all relative ${isDualMode ? 'bg-[#34DA4F]' : 'bg-slate-200'}`}
                    >
                       <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform shadow-md ${isDualMode ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                 </div>
              </div>
            </div>

            <button 
              onClick={handleStart}
              className="w-full mt-4 bg-gradient-to-b from-[#5CF777] via-[#34DA4F] to-[#0EBE2C] text-white font-black rounded-full py-6 flex items-center justify-center gap-4 transition-all active:scale-95 shadow-2xl shadow-[#34DA4F]/30 z-10 text-xl uppercase tracking-widest"
            >
              <ScanLine size={32} /> 啟動相機掃描
            </button>

         </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col overflow-hidden">
       {/* 掃描引擎容器 */}
       <div id="reader-video" className="absolute inset-0 w-full h-full object-cover"></div>
       
       {/* 覆蓋層組件 */}
       <ScannerOverlay 
         scanState={scanState} 
         onClose={handleClose} 
         onSkipSecondary={skipSecondary} 
         onFinish={handleFinish}
         amount={amount}
         sessionCards={sessionCards}
       />

       {/* 錯誤恢復介面 */}
       {scanState === "error" && (
         <div className="absolute inset-0 z-[70] bg-slate-900 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
              <ScanLine size={40} className="text-red-500" />
            </div>
            <h2 className="text-white text-2xl font-black mb-2">相機啟動失敗</h2>
            <p className="text-slate-400 text-sm max-w-[240px]">請確認已授權相機權限並重新嘗試</p>
            <div className="flex flex-col w-full gap-4 mt-8 max-w-xs">
              <button 
                onClick={() => startScanning()}
                className="w-full bg-[#34DA4F] text-white font-black py-5 rounded-3xl shadow-xl shadow-[#34DA4F]/20"
              >
                嘗試重啟相機
              </button>
              <button 
                onClick={handleClose}
                className="w-full bg-white/10 text-slate-400 font-bold py-4 rounded-3xl"
              >
                取消並返回
              </button>
            </div>
         </div>
       )}
    </div>
  );
}



