"use client";

import { X, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";

interface Props {
  scanState: ScanState;
  onClose: () => void;
  onSkipSecondary: () => void;
  isBatch?: boolean;
}

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
            className="w-12 h-12 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center justify-center text-white active:scale-90 transition-all"
          >
            <X size={24} />
          </button>

          <div className="flex flex-col items-end gap-1">
             <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-6 py-2 rounded-full flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#00F5FF] animate-pulse" />
                <span className="text-white font-black text-xs tracking-widest uppercase">
                  {scanState === "scanning-a" ? "Scanning Card No." : 
                   scanState === "scanning-b" ? "Scanning Password" : 
                   scanState === "success" ? "Success" : "Wait"}
                </span>
             </div>
             {amount !== undefined && amount !== "" && (
               <div className="text-[#00F5FF] font-black text-2xl tracking-tighter mt-2 bg-black/60 px-4 py-1 rounded-xl">
                 ${amount}
               </div>
             )}
          </div>
       </div>

       {/* 中央掃描框 */}
       <div className="flex-1 flex items-center justify-center p-12">
         <div className="relative w-full aspect-square max-w-[280px]">
           {/* 四個角落的 L 形 */}
           <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[#00F5FF] rounded-tl-2xl shadow-[-5px_-5px_15px_rgba(0,245,255,0.2)]" />
           <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[#00F5FF] rounded-tr-2xl shadow-[5px_-5px_15px_rgba(0,245,255,0.2)]" />
           <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[#00F5FF] rounded-bl-2xl shadow-[-5px_5px_15px_rgba(0,245,255,0.2)]" />
           <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[#00F5FF] rounded-br-2xl shadow-[5px_5px_15px_rgba(0,245,255,0.2)]" />
           
           {/* 掃描雷射線 */}
           {(scanState === "scanning-a" || scanState === "scanning-b") && (
             <div className="absolute top-0 left-0 w-full h-1 bg-[#00F5FF] shadow-[0_0_15px_#00F5FF] animate-[scan_2.5s_ease-in-out_infinite]" />
           )}
           
           {scanState === "success" && (
             <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-300 pointer-events-auto rounded-3xl">
                <div className="bg-white rounded-full p-4 shadow-2xl animate-in zoom-in duration-500">
                   <CheckCircle2 size={64} className="text-green-500" />
                </div>
             </div>
           )}

           {scanState === "duplicate" && (
             <div className="absolute inset-0 bg-amber-500/10 flex items-center justify-center animate-in shake duration-300">
                <AlertTriangle size={64} className="text-amber-500 fill-white" />
             </div>
           )}
         </div>
       </div>

       {/* 底部控制介面 (成功後顯示) */}
       <div className="p-10 pb-16 z-50 pointer-events-auto">
          {scanState === "success" ? (
             <div className="flex flex-col gap-4 animate-in slide-in-from-bottom duration-500">
                <button 
                  onClick={onNext}
                  className="w-full bg-[#00F5FF] text-gray-900 font-black py-6 rounded-[2rem] text-xl shadow-2xl shadow-[#00F5FF]/30 active:scale-95 transition-all flex items-center justify-center gap-3"
                >
                  <Plus size={24} /> 掃描下一張
                </button>
                <button 
                  onClick={onFinish}
                  className="w-full bg-white/10 hover:bg-white/20 backdrop-blur-md text-white font-black py-4 rounded-[2rem] active:scale-95 transition-all"
                >
                  結束並返回
                </button>
             </div>
          ) : (
            scanState === "scanning-b" && (
              <button 
                onClick={onSkipSecondary}
                className="w-full bg-white/10 backdrop-blur-md text-white font-black py-4 rounded-2xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                只有一個條碼？直接完成
              </button>
            )
          )}
       </div>

       <style jsx global>{`
         @keyframes scan {
           0%, 100% { top: 0%; opacity: 0.5; }
           50% { top: 100%; opacity: 1; }
         }
         @keyframes shake {
           0%, 100% { transform: translateX(0); }
           25% { transform: translateX(-10px); }
           75% { transform: translateX(10px); }
         }
       `}</style>
    </div>
  );
}

