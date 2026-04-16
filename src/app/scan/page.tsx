"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useScanner } from "@/hooks/useScanner";
import ScannerOverlay from "@/components/ScannerOverlay";
import { useCardStore } from "@/store/useCardStore";
import { ScanLine, ChevronLeft, Layers, Minus, Plus, Lock } from "lucide-react";
import { SCANNER_PROFILES } from "@/constants/scannerProfiles";

export default function ScanPage() {
  const router = useRouter();
  const { addCard, customMerchants, cards } = useCardStore();

  const [isReadyToScan, setIsReadyToScan] = useState(false);
  const [merchant, setMerchant] = useState("7-11");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [amount, setAmount] = useState<number | "">("");

  // v2.13.0 根據商家選擇動態決定掃描設定檔
  const activeProfile = useMemo(() => {
    if (merchant === "7-11") return SCANNER_PROFILES["7-11"];
    // 其它自訂商家統一使用通用模式
    return SCANNER_PROFILES["Generic"];
  }, [merchant]);

  const { 
    startScanning, 
    stopScanning, 
    scanState, 
    data, 
    errorMsg, 
    isDualMode, 
    setIsDualMode, 
    skipSecondary 
  } = useScanner("reader-video", activeProfile);
  
  // v2.29.0 初始化模式偏好：預設為開啟 (dual)
  useEffect(() => {
    const savedMode = localStorage.getItem("sgcm-scan-mode");
    if (savedMode === "single") {
      setIsDualMode(false);
    } else {
      // 預設 (null) 或手動設定為 dual 均開啟
      setIsDualMode(true);
    }
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

  const handleMerchantChange = (m: string) => {
    if (m === "其它自訂") {
       // v2.29.0 暫時鎖定該路徑 (雖然按鈕已 disabled，此處為保險)
       return;
    } else {
      setIsCustomMode(false);
      setMerchant(m);
      if (m === "7-11") {
        setIsDualMode(true);
      }
    }
  };

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

  const [sessionStartTime] = useState(Date.now());
  const lastScannedId = useRef<string | null>(null);

  const sessionCards = useMemo(() => {
    return cards
      .filter(c => c.createdAt >= sessionStartTime && !c.deletedAt)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [cards, sessionStartTime]);

  useEffect(() => {
    if (scanState === "success" || scanState === "cooldown") {
      if (!data.primary) return;
      
      const rawMerchant = isCustomMode && !merchant.trim() ? "未命名商家" : merchant;
      const cleanMerchant = rawMerchant.trim().replace(/[<>]/g, "").substring(0, 20);

      const generateId = () => {
        if (typeof window !== "undefined" && window.crypto?.randomUUID) {
          return window.crypto.randomUUID();
        }
        return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      };

      const newId = generateId();
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
        status: "Active" as any,
        isSynced: false
      };

      addCard(newCard);
    } else if (scanState === "scanning-a" || scanState === "idle") {
      lastScannedId.current = null;
    }
  }, [scanState, addCard, data, merchant, isCustomMode, amount]);

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
      <div className="min-h-[100dvh] bg-slate-50 flex flex-col items-center justify-center px-6 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top))] text-slate-900 font-sans">
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
                <div className="flex justify-between items-center px-1">
                   <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">選擇存檔商家</label>
                   <span className="text-[9px] text-[#34DA4F] font-black">{merchant === "7-11" ? "7-11 專家模式" : "通用模式"}</span>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-4 pt-1 scrollbar-hide snap-x">
                  <button
                    onClick={() => handleMerchantChange("7-11")}
                    className={`shrink-0 px-6 py-4 rounded-[1.5rem] font-black transition-all snap-start border-2 text-sm ${merchant === "7-11" ? 'bg-slate-900 text-[#34DA4F] border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}
                  >
                    7-11
                  </button>

                  {customMerchants.map((m) => (
                    <button
                      key={m}
                      onClick={() => handleMerchantChange(m)}
                      className={`shrink-0 px-6 py-4 rounded-[1.5rem] font-black transition-all snap-start border-2 text-sm ${merchant === m ? 'bg-slate-900 text-[#34DA4F] border-slate-900 shadow-xl' : 'bg-white text-slate-400 border-slate-100'}`}
                    >
                      {m}
                    </button>
                  ))}

                  {/* v2.29.0 鎖定按鈕 */}
                  <button
                    disabled
                    className="shrink-0 px-6 py-4 rounded-[1.5rem] font-black transition-all snap-start border-2 border-dashed border-slate-200 text-slate-300 text-[10px] flex items-center gap-1.5 opacity-60 cursor-not-allowed"
                  >
                    <Lock size={12} /> 自訂商家 (待開發)
                  </button>
                </div>

                {isCustomMode && (
                   <input 
                     type="text" 
                     placeholder="輸入商家名稱..." 
                     value={merchant}
                     onChange={(e) => setMerchant(e.target.value)}
                     className="w-full bg-white border-2 border-[#34DA4F]/20 rounded-2xl px-6 py-4 text-slate-900 font-bold outline-none focus:border-[#34DA4F] transition-all"
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
                 <div className="items-center justify-between flex">
                    <div>
                       <h3 className="font-black text-slate-800 text-sm">智慧雙條碼模式</h3>
                       <p className="text-[10px] text-slate-400 mt-1 font-bold italic">
                          {activeProfile.id === "7-11" ? "自動識別卡號與密碼" : "自訂掃描模式"}
                       </p>
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
       <div id="reader-video" className="absolute inset-0 w-full h-full object-cover"></div>
       <ScannerOverlay 
         scanState={scanState} 
         onClose={handleClose} 
         onSkipSecondary={skipSecondary} 
         onFinish={handleFinish}
         amount={amount}
         sessionCards={sessionCards}
       />
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
