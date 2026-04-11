"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useScanner } from "@/hooks/useScanner";
import ScannerOverlay from "@/components/ScannerOverlay";
import { useCardStore } from "@/store/useCardStore";
import { ScanLine, ChevronLeft, Layers, Minus } from "lucide-react";

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
    resetScanner,
    skipSecondary 
  } = useScanner("reader-video");
  
  const { addCard, customMerchants } = useCardStore();

  const [isReadyToScan, setIsReadyToScan] = useState(false);
  const [merchant, setMerchant] = useState("7-11");
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [amount, setAmount] = useState<number | "">("");
  const [isBatch, setIsBatch] = useState(true);

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

  useEffect(() => {
    if (isReadyToScan) {
      startScanning();
    } else {
      stopScanning();
    }
    return () => { stopScanning(); };
  }, [isReadyToScan, startScanning, stopScanning]);

  useEffect(() => {
    if (scanState === "success") {
      const finalMerchant = isCustomMode && !merchant.trim() ? "未命名商家" : merchant;
      addCard({
        id: crypto.randomUUID(),
        merchant: finalMerchant,
        name: finalMerchant === "7-11" ? "統一超商商品卡" : `${finalMerchant} 禮物卡`,
        barcode: data.primary || "",
        secondaryBarcode: data.secondary || null,
        amount: Number(amount),
        createdAt: Date.now(),
        deletedAt: null,
      });

      if (isBatch) {
        // 連續掃描模式：不重啟硬體，只重置辨識狀態
        const timer = setTimeout(() => { resetScanner(); }, 1800);
        return () => clearTimeout(timer);
      } else {
        // 單張掃描模式：關閉相機並返回
        const timer = setTimeout(() => {
          stopScanning();
          router.push("/dashboard");
        }, 1800);
        return () => clearTimeout(timer);
      }
    }
  }, [scanState, addCard, data, router, isBatch, merchant, isCustomMode, amount, resetScanner, stopScanning]);

  const handleClose = () => {
    if (isReadyToScan) {
      setIsReadyToScan(false); 
    } else {
      router.back();
    }
  };

  if (!isReadyToScan) {
    return (
      <div className="min-h-[100dvh] bg-white flex flex-col items-center justify-center p-6 text-gray-900 font-sans">
         <div className="w-full max-w-sm flex flex-col gap-6 relative">
            {/* 背景霓虹光暈 */}
            <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#00F5FF]/5 rounded-full blur-3xl pointer-events-none" />

            <button onClick={() => router.back()} className="self-start text-gray-400 hover:text-gray-900 transition-colors p-2 -ml-2 z-10">
              <ChevronLeft size={32} />
            </button>
            
            <div className="text-left z-10">
              <h1 className="text-3xl font-black tracking-tight text-gray-900">準備掃描</h1>
              <p className="text-sm text-gray-500 mt-2 font-semibold">設定商家與掃描模式</p>
            </div>

            <div className="space-y-5 z-10">
              <div className="flex flex-col gap-3">
                <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">選擇商家</label>
                <div className="flex gap-3 overflow-x-auto pb-4 pt-1 scrollbar-hide snap-x">
                  {["7-11", ...customMerchants, "其它自訂"].map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        if (m === "其它自訂") {
                          setIsCustomMode(true);
                          setMerchant("");
                        } else {
                          setIsCustomMode(false);
                          setMerchant(m);
                        }
                      }}
                      className={`shrink-0 px-6 py-4 rounded-3xl font-black transition-all snap-start border-2 text-sm ${
                        (isCustomMode && m === "其它自訂") || (!isCustomMode && merchant === m)
                          ? "bg-gray-900 text-[#00F5FF] border-gray-900 shadow-xl shadow-gray-900/10" 
                          : "bg-white text-gray-400 border-gray-100 hover:bg-gray-50 shadow-sm"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                
                {isCustomMode && (
                   <input 
                     type="text" 
                     placeholder="輸入自訂商家名稱..." 
                     value={merchant}
                     onChange={(e) => setMerchant(e.target.value)}
                     className="w-full bg-white border border-gray-200 rounded-[2rem] px-6 py-5 text-xl font-bold text-gray-900 outline-none focus:border-[#00F5FF] focus:ring-4 focus:ring-[#00F5FF]/5 shadow-sm transition-all"
                   />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="flex flex-col gap-2">
                   <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">卡片面額</label>
                   <input 
                     type="number" 
                     placeholder="500" 
                     value={amount}
                     onChange={(e) => setAmount(Number(e.target.value))}
                     className="w-full bg-white border border-gray-200 rounded-[2rem] px-6 py-5 text-xl font-bold text-gray-900 outline-none focus:border-[#00F5FF] focus:ring-4 focus:ring-[#00F5FF]/5 shadow-sm transition-all"
                   />
                 </div>
                 
                 <div className="flex flex-col gap-2">
                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">掃描模式</label>
                    <button 
                      onClick={() => setIsDualMode(!isDualMode)}
                      className={`w-full h-full flex items-center justify-center gap-2 rounded-[2rem] border-2 transition-all font-bold ${
                        isDualMode ? "bg-[#00F5FF]/10 border-[#00F5FF] text-[#00c5cc]" : "bg-gray-50 border-gray-100 text-gray-500"
                      }`}
                    >
                      {isDualMode ? <Layers size={20}/> : <Minus size={20}/>}
                      {isDualMode ? "雙條碼" : "單條碼"}
                    </button>
                 </div>
              </div>

              <div className="flex items-center justify-between bg-gray-50 p-5 rounded-[2.5rem] mt-4 border border-gray-100">
                 <div>
                    <h3 className="font-black text-gray-800">連續掃描模式</h3>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-bold">成功後直接進入下一張</p>
                 </div>
                 <label className="relative inline-flex items-center cursor-pointer">
                   <input type="checkbox" checked={isBatch} onChange={(e) => setIsBatch(e.target.checked)} className="sr-only peer" />
                   <div className="w-14 h-7 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-7 after:transition-all peer-checked:bg-gray-900 shadow-inner"></div>
                 </label>
              </div>
            </div>

            <button 
              onClick={handleStart}
              className="w-full mt-8 bg-gray-900 text-white font-black rounded-[2.5rem] py-6 flex items-center justify-center gap-3 transition-all hover:bg-gray-800 active:scale-95 shadow-2xl shadow-gray-900/20 z-10 text-lg"
            >
              <ScanLine size={28} className="text-[#00F5FF]" /> 開啟相機掃描
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
         isBatch={isBatch} 
       />

       {/* 錯誤恢復介面 */}
       {scanState === "error" && (
         <div className="absolute inset-0 z-[70] bg-gray-900 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
              <ScanLine size={32} className="text-red-500" />
            </div>
            <h2 className="text-white text-xl font-black mb-2">相機啟動失敗</h2>
            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
              {errorMsg || "這可能是因為相機權限被拒絕，或是其他應用程式正在佔用相機。"}
            </p>
            <div className="flex flex-col w-full gap-3">
              <button 
                onClick={() => startScanning()}
                className="w-full bg-[#00F5FF] text-gray-900 font-black py-4 rounded-2xl active:scale-95 transition-all"
              >
                嘗試重新啟動
              </button>
              <button 
                onClick={handleClose}
                className="w-full bg-white/10 text-white font-bold py-4 rounded-2xl active:scale-95 transition-all"
              >
                返回設定
              </button>
            </div>
         </div>
       )}
       
       {/* 頂部狀態顯示 (浮動在 Overlay 之上) */}
       {scanState !== "error" && (
         <div className="absolute top-10 left-0 right-0 px-6 z-[60] flex justify-between items-center pointer-events-none">
            <div className="hidden md:block" />
            <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-6 py-2 rounded-full flex items-center gap-3 shadow-2xl">
               <div className={`w-2 h-2 rounded-full ${scanState === "success" ? "bg-green-500" : "bg-red-500 animate-pulse"}`} />
               <span className="text-white font-black text-xs tracking-tighter uppercase">
                 {scanState === "success" ? "Success" : isDualMode ? "Dual Scan Mode" : "Single Scan Mode"}
               </span>
            </div>
            <div className="hidden md:block" />
         </div>
       )}
    </div>
  );
}

