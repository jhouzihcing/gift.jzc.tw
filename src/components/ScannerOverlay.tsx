"use client";

import { X, CheckCircle2, AlertTriangle, ChevronRight } from "lucide-react";

interface Props {
  scanState: ScanState;
  onClose: () => void;
  onSkipSecondary: () => void;
  isBatch?: boolean;
}

export default function ScannerOverlay({ scanState, onClose, onSkipSecondary, isBatch }: Props) {
  const getPromptMessage = () => {
    switch (scanState) {
      case "scanning-a": return "請將條碼對準框內";
      case "scanning-b": return "請將第二組條碼 (密碼) 對準框內";
      case "success": return isBatch ? "紀錄成功！即將換下一張..." : "掃描成功！即將返回...";
      case "duplicate": return "重複掃描！請換另一組條碼";
      case "error": return "相機啟動異常";
      default: return "相機啟動中...";
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col pointer-events-none">
      <div className="h-32 bg-white flex flex-col items-center justify-end pb-8 pointer-events-auto z-10">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-gray-50 rounded-full text-gray-400 active:scale-95 transition-all"
        >
          <X size={24} />
        </button>
        <span className={`font-bold text-lg tracking-wide transition-colors ${scanState === "duplicate" ? "text-amber-500" : "text-gray-900"}`}>
          {getPromptMessage()}
        </span>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        <div className={`relative w-72 h-32 border-2 rounded-2xl overflow-hidden shadow-[0_0_0_9999px_rgba(255,255,255,0.95)] transition-all duration-300 ${
           scanState === "success" ? "border-green-500 bg-green-500/10" : 
           scanState === "duplicate" ? "border-amber-500 bg-amber-500/10" : 
           "border-[#00F5FF] bg-black/5"
        }`}>
           {(scanState === "scanning-a" || scanState === "scanning-b") && (
             <div className="absolute top-0 left-0 w-full h-1 bg-[#00F5FF] shadow-[0_0_15px_#00F5FF] animate-[scan_2.5s_ease-in-out_infinite]" />
           )}
           
           {scanState === "success" && (
             <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center backdrop-blur-sm animate-in fade-in duration-300">
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

      <div className="h-44 bg-white pointer-events-auto flex items-center justify-center z-10 px-8">
        {scanState === "scanning-b" ? (
          <button 
            onClick={onSkipSecondary}
            className="w-full flex items-center justify-center gap-2 py-4 bg-gray-900 text-white rounded-2xl font-bold active:scale-[0.98] transition-all shadow-xl shadow-gray-900/20"
          >
            本卡無密碼直接完成 <ChevronRight size={20} />
          </button>
        ) : (
          <p className="text-gray-400 text-xs text-center leading-relaxed font-semibold">
            {scanState === "duplicate" ? "請確保您掃描的是卡片上的另一組條碼" : "稍微傾斜卡片確保環境明亮，可避反光。"}
          </p>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(128px); }
          100% { transform: translateY(0); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}

