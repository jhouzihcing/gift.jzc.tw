"use client";

import { useState } from "react";
import Barcode from "react-barcode";
import { Maximize2, X } from "lucide-react";

interface GiftCardProps {
  card: {
    id: string;
    merchant: string;
    amount: number;
    barcode: string;
    secondaryBarcode?: string | null;
  };
  onDelete: (id: string) => void;
}

export default function GiftCard({ card, onDelete }: GiftCardProps) {
  const [isFull, setIsFull] = useState(false);

  return (
    <>
      <div className="relative shrink-0 w-[82vw] max-w-[320px] bg-white rounded-[2.5rem] shadow-[var(--card-shadow)] overflow-hidden flex flex-col items-center p-7 border border-slate-100 snap-center transition-all">
        
        {/* 科技背景紋理 - FaceTime Green 版 */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.04]" 
             style={{ backgroundImage: 'radial-gradient(#34c759 1.2px, transparent 1.2px)', backgroundSize: '20px 20px' }} />

        {/* 右上角放大按鈕 */}
        <button 
          onClick={() => setIsFull(true)}
          className="absolute top-6 right-6 p-2 bg-slate-50 text-slate-400 rounded-xl active:scale-90 transition-all z-20 border border-slate-100 shadow-sm"
        >
           <Maximize2 size={18} />
        </button>

        {/* 商家與面額 */}
        <div className="w-full text-center space-y-1 mb-5 relative z-10">
          <h3 className="text-xs font-black text-slate-300 tracking-[0.2em] uppercase">{card.merchant}</h3>
          <div className="flex items-center justify-center gap-0.5">
            <span className="text-lg font-black text-[#34c759]">$</span>
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter">
              {card.amount}
            </h2>
          </div>
        </div>

        <div className="w-full h-[1px] bg-slate-50 mb-6 relative" />

        {/* 條碼顯示區 - 直接在背景上 */}
        <div className="w-full flex flex-col gap-6 items-center overflow-hidden relative z-10">
          {/* 條碼 1 */}
          <div className="flex flex-col items-center gap-2 w-full">
            <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.15em]">第一段條碼 (卡號)</p>
            <div className="w-full flex justify-center">
              <Barcode 
                value={card.barcode} 
                width={1.6} 
                height={70} 
                fontSize={12}
                margin={0}
                background="transparent"
                fontOptions="bold"
                lineColor="#1e293b"
              />
            </div>
          </div>

          {/* 條碼 2 (如果有) */}
          {card.secondaryBarcode && (
            <div className="flex flex-col items-center gap-2 w-full">
              <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.15em]">第二段條碼 (密碼)</p>
              <div className="w-full flex justify-center">
                <Barcode 
                  value={card.secondaryBarcode} 
                  width={1.6} 
                  height={70} 
                  fontSize={12}
                  margin={0}
                  background="transparent"
                  fontOptions="bold"
                  lineColor="#1e293b"
                />
              </div>
            </div>
          )}
        </div>

        {/* 功能按鈕 */}
        <div className="mt-8 w-full relative z-20">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm("這張卡片已耗盡餘額並要移至垃圾桶嗎？")) {
                onDelete(card.id);
              }
            }}
            className="w-full py-4 bg-slate-50 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-[1.5rem] font-black transition-all text-[10px] tracking-[0.1em] uppercase border border-slate-100 active:scale-95"
          >
            已無餘額 / 刪除卡片
          </button>
        </div>
      </div>

      {/* 全螢幕放大 Modal */}
      {isFull && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
           <button 
             onClick={() => setIsFull(false)}
             className="absolute top-10 right-8 p-4 bg-slate-100 text-slate-600 rounded-full active:scale-90 z-[110]"
           >
              <X size={32} />
           </button>
           
           <div className="w-full max-w-md text-center space-y-2 mb-12">
              <p className="text-[#34c759] font-black tracking-[0.5em] uppercase text-xs">Full Screen Scan</p>
              <h2 className="text-4xl font-black text-slate-900">{card.merchant}</h2>
              <p className="text-2xl font-black text-slate-400">${card.amount}</p>
           </div>
           
           <div className="w-full flex flex-col gap-12 items-center">
              <div className="w-full flex flex-col items-center gap-4">
                 <p className="text-xs font-black text-slate-400 tracking-widest uppercase">第一段條碼 (卡號)</p>
                 <Barcode value={card.barcode} width={2.5} height={120} fontSize={16} margin={10} fontOptions="bold" />
              </div>
              
              {card.secondaryBarcode && (
                <div className="w-full flex flex-col items-center gap-4">
                   <p className="text-xs font-black text-slate-400 tracking-widest uppercase">第二段條碼 (密碼)</p>
                   <Barcode value={card.secondaryBarcode} width={2.5} height={120} fontSize={16} margin={10} fontOptions="bold" />
                </div>
              )}
           </div>
           
           <p className="mt-16 text-slate-300 font-bold text-sm tracking-tighter">請向店員出示此畫面進行掃描</p>
        </div>
      )}
    </>
  );
}
