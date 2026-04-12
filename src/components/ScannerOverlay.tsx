"use client";

import { X, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import { ScanState } from "@/hooks/useScanner";

interface ScannerOverlayProps {
  scanState: ScanState;
  onClose: () => void;
  onSkipSecondary: () => void;
  onNext?: () => void;
  onFinish?: () => void;
  amount?: number | "";
}

export default function ScannerOverlay({ 
  scanState, 
  onClose, 
  onSkipSecondary, 
  onNext,
  onFinish,
  amount
}: ScannerOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col overflow-hidden">
       
       {/* v1.6.2 全透明設計：不使用任何背景遮罩 */}

       {/* 頂部控制欄 - 更加精簡透明 */}
       <div className="p-10 flex justify-between items-start pointer-events-auto z-20">
          <button 
            onClick={onClose}
            className="w-14 h-14 bg-black/20 backdrop-blur-xl border border-white/10 rounded-[1.5rem] flex items-center justify-center text-white active:scale-90 transition-all shadow-xl"
          >
            <X size={28} />
          </button>

          <div className="flex flex-col items-end gap-2">
             <div className="bg-black/20 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${scanState === "success" ? "bg-[#34DA4F]" : "bg-[#34DA4F] animate-pulse"}`} />
                <span className="text-white font-black text-[10px] tracking-[0.2em] uppercase">
                  {scanState === "scanning-a" ? "卡號偵測中" : 
                   scanState === "scanning-b" ? "密碼偵測中" : 
                   scanState === "success" ? "完成" : "等待"}
                </span>
             </div>
             {amount !== undefined && amount !== "" && (
                <div className="text-[#34DA4F] font-black text-2xl tracking-tighter mt-1 bg-black/20 backdrop-blur-md px-5 py-2 rounded-2xl border border-white/5">
                  ${amount}
                </div>
             )}
          </div>
       </div>

       {/* 唯一對準框架 - v1.10.0 雙路齊發模式 */}
       <div className="flex-1 flex items-center justify-center z-10 p-12">
          <div className="relative w-[360px] h-[200px]">
            {/* 四個角落的標記 - 針對橫向長條進行極致對位 */}
            <div className="absolute top-0 left-0 w-12 h-10 border-t-[4px] border-l-[4px] border-white rounded-tl-2xl drop-shadow-md" />
            <div className="absolute top-0 right-0 w-12 h-10 border-t-[4px] border-r-[4px] border-white rounded-tr-2xl drop-shadow-md" />
            <div className="absolute bottom-0 left-0 w-12 h-10 border-b-[4px] border-l-[4px] border-white rounded-bl-2xl drop-shadow-md" />
            <div className="absolute bottom-0 right-0 w-12 h-10 border-b-[4px] border-r-[4px] border-white rounded-br-2xl drop-shadow-md" />
            
            {scanState === "success" && (
              <div className="absolute inset-0 bg-[#34DA4F]/10 flex items-center justify-center backdrop-blur-sm animate-in fade-in zoom-in duration-500 pointer-events-auto rounded-[2rem]">
                 <div className="bg-white rounded-full p-4 shadow-2xl animate-in bounce-in duration-700">
                    <CheckCircle2 size={48} className="text-[#34DA4F]" />
                 </div>
              </div>
            )}

            {scanState === "duplicate" && (
              <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center animate-in shake duration-300 backdrop-blur-sm pointer-events-auto rounded-[2rem]">
                 <div className="bg-white rounded-full p-4 shadow-2xl animate-in bounce-in duration-700">
                    <AlertTriangle size={48} className="text-red-500" />
                 </div>
              </div>
            )}
          </div>
       </div>

       {/* 底部控制介面 (成功後顯示) */}
       <div className="p-10 pb-20 z-30 pointer-events-auto">
          {scanState === "success" ? (
             <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-[50px] duration-700">
                <button 
                  onClick={onNext}
                  className="w-full bg-gradient-to-b from-[#5CF777] via-[#34DA4F] to-[#0EBE2C] text-white font-black py-6 rounded-full text-xl shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-4"
                >
                  <Plus size={28} /> 掃描下一張
                </button>
                <button 
                  onClick={onFinish}
                  className="w-full bg-slate-900 text-[#34DA4F] font-black py-6 rounded-full active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-lg shadow-2xl"
                >
                  結束掃描
                </button>
             </div>
          ) : (
            scanState === "scanning-b" && (
              <button 
                onClick={onSkipSecondary}
                className="w-full bg-slate-900/60 backdrop-blur-md text-white font-black py-5 rounded-3xl active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/5"
              >
                跳過密碼掃描 <Plus size={20} className="rotate-45 text-[#34DA4F]" />
              </button>
            )
          )}
       </div>

       <style jsx global>{`
         @keyframes shake {
           0%, 100% { transform: translateX(0); }
           25% { transform: translateX(-15px); }
           75% { transform: translateX(15px); }
         }
       `}</style>
    </div>
  );
}
