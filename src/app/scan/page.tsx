"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useScanner } from "@/hooks/useScanner";
import ScannerOverlay from "@/components/ScannerOverlay";
import { useCardStore } from "@/store/useCardStore";
import { ScanLine, ChevronLeft } from "lucide-react";

export default function ScanPage() {
  const router = useRouter();
  const { startScanning, stopScanning, scanState, data, errorMsg } = useScanner("reader-video");
  
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
      const isSuccess = addCard({
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
        const timer = setTimeout(() => { startScanning(); }, 1500);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          if (isSuccess) router.push("/dashboard");
          else setIsReadyToScan(false); 
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [scanState, addCard, data, router, isBatch, merchant, isCustomMode, amount, startScanning]);

  const handleClose = () => {
    if (isReadyToScan) {
      setIsReadyToScan(false); 
    } else {
      router.back();
    }
  };

  if (!isReadyToScan) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center p-6 text-gray-900 font-sans">
         <div className="w-full max-w-sm flex flex-col gap-6 relative">
           {/* 背景霓虹光暈 */}
           <div className="absolute top-[-20%] left-[-20%] w-[50vw] h-[50vw] bg-[#00F5FF]/10 rounded-full blur-3xl pointer-events-none" />

           <button onClick={() => router.back()} className="self-start text-gray-400 hover:text-gray-900 transition-colors p-2 -ml-2 z-10">
             <ChevronLeft size={32} />
           </button>
           
           <div className="text-left mt-2 mb-4 z-10">
             <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">準備掃描</h1>
             <p className="text-sm text-gray-500 mt-2 font-medium">請先選擇商家與面額，再開啟鏡頭</p>
           </div>

           <div className="space-y-4 z-10">
             <div className="flex flex-col gap-2">
               <label className="text-sm font-bold text-gray-700 ml-1">選擇商家</label>
               <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scrollbar-hide snap-x">
                 {["7-11", "全家", "星巴克", "大潤發", ...customMerchants, "其它自訂"].map((m) => (
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
                     className={`shrink-0 px-5 py-3 rounded-2xl font-bold transition-all snap-start border-2 ${
                       (isCustomMode && m === "其它自訂") || (!isCustomMode && merchant === m)
                         ? "bg-gray-900 text-[#00F5FF] shadow-lg shadow-gray-900/20 border-[#00F5FF]" 
                         : "bg-white text-gray-500 border-transparent hover:bg-gray-50 shadow-sm"
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
                    className="w-full mt-2 bg-white border border-gray-200 rounded-2xl px-4 py-4 text-lg font-bold text-gray-900 outline-none focus:border-[#00F5FF] focus:ring-4 focus:ring-[#00F5FF]/10 shadow-sm transition-all"
                  />
               )}
             </div>

             <div className="flex flex-col gap-2">
               <label className="text-sm font-bold text-gray-700 ml-1">卡片面額</label>
               <input 
                 type="number" 
                 placeholder="例如：500" 
                 value={amount}
                 onChange={(e) => setAmount(Number(e.target.value))}
                 className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-4 text-lg font-bold text-gray-900 outline-none focus:border-[#00F5FF] focus:ring-4 focus:ring-[#00F5FF]/10 shadow-sm placeholder:text-gray-300 transition-all"
               />
             </div>

             <div className="flex items-center justify-between bg-white border border-gray-100 p-4 rounded-2xl shadow-sm mt-4">
                <div>
                   <h3 className="font-bold text-gray-800">連續掃描模式</h3>
                   <p className="text-xs text-gray-500 mt-1 font-medium">開啟後掃描成功不會跳轉，可直接掃下一張</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={isBatch} onChange={(e) => setIsBatch(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#00c5cc]"></div>
                </label>
             </div>
           </div>

           <button 
             onClick={handleStart}
             className="w-full mt-6 bg-gray-900 text-white font-bold rounded-2xl py-4 flex items-center justify-center gap-2 transition-all hover:bg-gray-800 active:scale-95 shadow-lg shadow-gray-900/20 z-10"
           >
             <ScanLine size={24} className="text-[#00F5FF]" /> 啟動相機掃描
           </button>

         </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
       <header className="absolute top-0 w-full p-4 flex justify-between items-center z-20">
         <button onClick={handleClose} className="text-white p-2 bg-black/40 rounded-full backdrop-blur-md border border-white/10 shadow-md">
           <ChevronLeft size={28} />
         </button>
         <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full font-bold text-sm tracking-wide shadow-lg">
            {isCustomMode && !merchant ? "自訂商家" : merchant} - ${amount}
         </div>
         <div className="w-10"></div>
       </header>

       <div className="relative flex-1 bg-black overflow-hidden">
         <div id="reader-video" className="w-full h-full object-cover relative z-10 mix-blend-screen scale-[1.3] translate-y-12 rounded-[2rem] overflow-hidden"></div>
         {(scanState === "scanning" || scanState === "success") && (
            <div className="absolute inset-x-0 bottom-32 z-30 pointer-events-none">
              <ScannerOverlay state={scanState} isBatch={isBatch} errorMsg={errorMsg} />
            </div>
         )}
         
         {/* Scan overlay bounds */}
         <div className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-center items-center">
            <div className={`w-[85%] max-w-sm h-32 border-2 rounded-xl transition-colors duration-300 ${scanState === "success" ? "border-green-400 bg-green-400/20" : "border-[#00F5FF]/50 bg-[#00F5FF]/5"}`}>
               <div className="w-full h-full relative">
                 <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-white opacity-80 -translate-x-1 -translate-y-1"></div>
                 <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-white opacity-80 translate-x-1 -translate-y-1"></div>
                 <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-white opacity-80 -translate-x-1 translate-y-1"></div>
                 <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-white opacity-80 translate-x-1 translate-y-1"></div>
                 
                 {scanState === "scanning" && (
                   <div className="absolute top-1/2 left-0 w-full h-[2px] bg-red-500 shadow-[0_0_10px_red] animate-pulse"></div>
                 )}
               </div>
            </div>
         </div>

       </div>
    </div>
  );
}
