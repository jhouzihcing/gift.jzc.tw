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
                <div className={`w-2.5 h-2.5 rounded-full ${scanState === "success" ? "bg-[#10b981]" : "bg-red-500 animate-pulse"}`} />
                <span className="text-white font-black text-xs tracking-[0.2em] uppercase">
                  {scanState === "scanning-a" ? "正在掃描卡號" : 
                   scanState === "scanning-b" ? "正在掃描密碼" : 
                   scanState === "success" ? "辨識完成" : "等待中"}
                </span>
             </div>
             {amount !== undefined && amount !== "" && (
               <div className="text-[#10b981] font-black text-3xl tracking-tighter mt-1 bg-slate-900/80 px-6 py-2 rounded-2xl shadow-2xl border border-white/5">
                 ${amount}
               </div>
             )}
          </div>
       </div>

       {/* 中央掃描框 */}
       <div className="flex-1 flex items-center justify-center p-12">
         <div className="relative w-full aspect-square max-w-[300px]">
           {/* 四個角落的 L 形 - 改用可靠綠 */}
           <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-[#10b981] rounded-tl-3xl opacity-50" />
           <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-[#10b981] rounded-tr-3xl opacity-50" />
           <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-[#10b981] rounded-bl-3xl opacity-50" />
           <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-[#10b981] rounded-br-3xl opacity-50" />
           
           {/* 掃描雷射線 - 改用可靠綠 */}
           {(scanState === "scanning-a" || scanState === "scanning-b") && (
             <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#10b981] to-transparent shadow-[0_0_20px_#10b981] animate-[scan_3s_ease-in-out_infinite]" />
           )}
           
           {scanState === "success" && (
             <div className="absolute inset-0 bg-[#10b981]/10 flex items-center justify-center backdrop-blur-sm animate-in fade-in zoom-in duration-500 pointer-events-auto rounded-[3rem]">
                <div className="bg-white rounded-full p-6 shadow-[0_20px_50px_rgba(16,185,129,0.3)] animate-in bounce-in duration-700">
                   <CheckCircle2 size={72} className="text-[#10b981]" />
                </div>
             </div>
           )}

           {scanState === "duplicate" && (
             <div className="absolute inset-0 bg-red-500/10 flex items-center justify-center animate-in shake duration-300 backdrop-blur-sm pointer-events-auto rounded-[3rem]">
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
                  className="w-full bg-[#10b981] text-white font-black py-6 rounded-[2.5rem] text-xl shadow-[0_20px_40px_rgba(16,185,129,0.25)] active:scale-95 transition-all flex items-center justify-center gap-4"
                >
                  <Plus size={28} /> 掃描下一張
                </button>
                <button 
                  onClick={onFinish}
                  className="w-full bg-slate-900 text-[#10b981] font-black py-4 rounded-[2rem] active:scale-95 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  完成並返回
                </button>
             </div>
          ) : (
            scanState === "scanning-b" && (
              <button 
                onClick={onSkipSecondary}
                className="w-full bg-slate-900/60 backdrop-blur-md text-white font-black py-5 rounded-[1.5rem] active:scale-95 transition-all flex items-center justify-center gap-3 border border-white/5"
              >
                只有一個條碼？點此跳過 <Plus size={20} className="rotate-45 text-[#10b981]" />
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


