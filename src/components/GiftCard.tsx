"use client";

import Barcode from "react-barcode";

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
  return (
    <div className="relative shrink-0 w-[85vw] max-w-[340px] bg-white rounded-[2.5rem] shadow-[var(--card-shadow)] overflow-hidden flex flex-col items-center p-8 border border-slate-100 snap-center transition-all">
      
      {/* 科技背景紋理 */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" 
           style={{ backgroundImage: 'radial-gradient(#10b981 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

      {/* 頂部裝飾 - 科技感辨識標籤 */}
      <div className="absolute top-0 right-10 flex flex-col items-center">
         <div className="w-[1px] h-6 bg-slate-100" />
         <div className="bg-[#10b981] px-3 py-1 rounded-full shadow-lg shadow-[#10b981]/20">
            <span className="text-[8px] font-black text-white uppercase tracking-tighter">Verified</span>
         </div>
      </div>

      {/* 商家與面額 */}
      <div className="w-full text-center space-y-2 mb-8 relative z-10">
        <h3 className="text-xl font-black text-slate-300 tracking-[0.2em] uppercase">{card.merchant}</h3>
        <div className="flex items-center justify-center gap-1">
          <span className="text-2xl font-black text-[#10b981]">$</span>
          <h2 className="text-6xl font-black text-slate-900 tracking-tighter">
            {card.amount}
          </h2>
        </div>
      </div>

      <div className="w-full h-[1px] bg-slate-50 mb-8 relative" />

      {/* 條碼顯示區 */}
      <div className="w-full flex flex-col gap-10 items-center overflow-hidden relative z-10">
        {/* 條碼 1 */}
        <div className="flex flex-col items-center gap-3 w-full">
          <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">第一段條碼 (卡號)</p>
          <div className="bg-white p-4 border border-slate-100 rounded-[1.5rem] w-full flex justify-center shadow-sm">
            <Barcode 
              value={card.barcode} 
              width={1.5} 
              height={64} 
              fontSize={14}
              margin={0}
              background="transparent"
              fontOptions="bold"
              lineColor="#1e293b"
            />
          </div>
        </div>

        {/* 條碼 2 (如果有) */}
        {card.secondaryBarcode && (
          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">第二段條碼 (密碼)</p>
            <div className="bg-white p-4 border border-slate-100 rounded-[1.5rem] w-full flex justify-center shadow-sm">
              <Barcode 
                value={card.secondaryBarcode} 
                width={1.5} 
                height={64} 
                fontSize={14}
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
      <div className="mt-12 w-full relative z-20">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("這張卡片已耗盡餘額並要移至垃圾桶嗎？")) {
              onDelete(card.id);
            }
          }}
          className="w-full py-5 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-[2rem] font-black transition-all text-xs tracking-[0.15em] uppercase border border-slate-100 active:scale-95 shadow-sm"
        >
          已無餘額 / 刪除卡片
        </button>
      </div>
    </div>
  );
}
