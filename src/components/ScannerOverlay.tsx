"use client";

import { X, CheckCircle2, AlertTriangle, Plus } from "lucide-react";

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
    <div className="absolute inset-0 pointer-events-none flex flex-col">
       
       {/* 頂部控制欄 */}
       <div className="p-10 flex justify-between items-start pointer-events-auto">
          <button 
            onClick={onClose}
            className="w-14 h-14 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-[1.5rem] flex items-center justify-center text-white active:scale-90 transition-all shadow-2xl"
          >
            <X size={28} />
          </button>

          <div className="flex flex-col items-end gap-2">
             <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${scanState === "success" ? "bg-[#34c759]" : "bg-[#34c759] animate-pulse"}`} />
                <span className="text-white font-black text-[10px] tracking-[0.2em] uppercase">
                  {scanState === "scanning-a" ? "正在掃描卡號" : 
                   scanState === "scanning-b" ? "正在掃描密碼" : 
                   scanState === "success" ? "辨識完成" : "等待啟動"}
                </span>
             </div>
             {amount !== undefined && amount !== "" && (
               <div className="text-[#34c759] font-black text-3xl tracking-tighter mt-1 bg-slate-900/80 px-6 py-2 rounded-2xl shadow-2xl border border-white/5">
                 ${amount}
               </div>
             )}
          </div>
       </div>

       {/* 中央掃描框 - 改為圓形風格 */}
       <div className="flex-1 flex items-center justify-center p-12">
         <div className="relative w-full aspect-square max-w-[280px]">
           {/* 四個角落的弧形 - 營造圓形感 */}
           <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[#34c759] rounded-tl-[3rem] opacity-60" />
           <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-[#34c759] rounded-tr-[3rem] opacity-60" />
           <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-[#34c759] rounded-bl-[3rem] opacity-60" />
           <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[#34c759] rounded-br-[3rem] opacity-60" />
           
           {/* 輔助圓環 */}
           <div className="absolute inset-0 border border-white/5 rounded-full" />
           
           {/* 掃描雷射線 - FaceTime Green */}
           {(scanState === "scanning-a" || scanState === "scanning-b") && (
             <div className="absolute top-1/2 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-[#34c759] to-transparent shadow-[0_0_20px_#34c759] animate-[scan_2.5s_ease-in-out_infinite] -translate-y-1/2" />
           )}
           
           {scanState === "success" && (
             <div className="absolute inset-0 bg-[#34c759]/10 flex items-center justify-center backdrop-blur-sm animate-in fade-in zoom-in duration-500 pointer-events-auto rounded-full">
                <div className="bg-white rounded-full p-6 shadow-[0_20px_50px_rgba(52,199,89,0.3)] animate-in bounce-in duration-700">
                   <CheckCircle2 size={72} className="text-[#34c759]" />
                </div>
             </div>
           )}

           {scanState === "duplicate" && (
             <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center animate-in shake duration-300 backdrop-blur-sm pointer-events-auto rounded-full">
                <div className="bg-white rounded-full p-6 shadow-2xl animate-in bounce-in duration-700">
                   <AlertTriangle size={72} className="text-red-500" />
                </div>
             </div>
           )}
         </div>
       </div>

       {/* 底部控制介面 (成功後顯示) */}
       <div className="p-10 pb-20 z-50 pointer-events-auto">
          {scanState === "success" ? (
             <div className="flex flex-col gap-4 animate-in slide-in-from-bottom-[50px] duration-700">
                <button 
                  onClick={onNext}
                  className="w-full bg-gradient-to-b from-[#34c759] to-[#28cd41] text-white font-black py-6 rounded-full text-xl shadow-[0_20px_40px_rgba(52,199,89,0.25)] active:scale-95 transition-all flex items-center justify-center gap-4"
                >
                  <Plus size={28} /> 掃描下一張
                </button>
                <button 
                  onClick={onFinish}
                  className="w-full bg-slate-900 text-[#34c759] font-black py-4 rounded-full active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-[10px]"
                >
                  完成並返回
                </button>
             </div>
          ) : (
            scanState === "scanning-b" && (
              <button 
                onClick={onSkipSecondary}
                className="w-full bg-slate-900/60 backdrop-blur-md text-white font-black py-5 rounded-3xl active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/5"
              >
                跳過密碼掃描 <Plus size={20} className="rotate-45 text-[#34c759]" />
              </button>
            )
          )}
       </div>

       <style jsx global>{`
         @keyframes scan {
           0%, 100% { top: 5%; opacity: 0.3; }
           50% { top: 95%; opacity: 1; }
         }
         @keyframes shake {
           0%, 100% { transform: translateX(0); }
           25% { transform: translateX(-15px); }
           75% { transform: translateX(15px); }
         }
       `}</style>
    </div>
  );
}


