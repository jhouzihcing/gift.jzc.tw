"use client";

import { X, CheckCircle2, ChevronRight } from "lucide-react";
import { ScanState } from "@/hooks/useScanner";

interface Props {
  scanState: ScanState;
  onClose: () => void;
  onSkipSecondary: () => void;
  isBatch?: boolean; // 供內部判斷訊息用
}

export default function ScannerOverlay({ scanState, onClose, onSkipSecondary, isBatch }: Props) {
  const getPromptMessage = () => {
    switch (scanState) {
      case "scanning-a": return "請將第一組條碼 (卡號) 對準框內";
      case "scanning-b": return "請將第二組條碼 (密碼) 對準框內";
      case "success": return isBatch ? "紀錄成功！暫停 1.5 秒換下一張..." : "掃描成功！即將返回...";
      case "error": return "相機啟動異常";
      default: return "相機啟動中...";
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col pointer-events-none">
      <div className="h-32 bg-white flex flex-col items-center justify-end pb-6 pointer-events-auto z-10 transition-colors">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-gray-100 rounded-full text-gray-700 active:scale-95 transition-transform"
        >
          <X size={24} />
        </button>
        <span className="font-bold text-gray-900 text-lg tracking-wide">
          {getPromptMessage()}
        </span>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        <div className="relative w-72 h-32 border-2 border-[#00F5FF] rounded-2xl overflow-hidden shadow-[0_0_0_9999px_rgba(255,255,255,0.92)] transition-all duration-300">
           {scanState !== "success" && (
             <div className="absolute top-0 left-0 w-full h-1 bg-[#00F5FF] shadow-[0_0_12px_#00F5FF] animate-[scan_2s_ease-in-out_infinite]" />
           )}
           
           {scanState === "success" && (
             <div className="absolute inset-0 bg-[#00F5FF]/10 flex items-center justify-center backdrop-blur-sm transition-opacity duration-300">
                <CheckCircle2 size={56} className="text-[#00F5FF] animate-bounce" />
             </div>
           )}
        </div>
      </div>

      <div className="h-40 bg-white pointer-events-auto flex items-center justify-center z-10 px-6">
        {scanState === "scanning-b" ? (
          <button 
            onClick={onSkipSecondary}
            className="w-full flex items-center justify-center gap-2 py-4 bg-gray-900 text-white rounded-2xl font-semibold active:scale-[0.98] transition-all shadow-lg"
          >
            本卡無密碼直接完成 <ChevronRight size={20} />
          </button>
        ) : (
          <p className="text-gray-400 text-sm text-center px-8 leading-relaxed font-medium">
            稍微傾斜卡片確保環境明亮，可避反光。一維條碼請務必水平對齊。
          </p>
        )}
      </div>

      <style>{`
        @keyframes scan {
          0% { transform: translateY(0); }
          50% { transform: translateY(128px); }
          100% { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
