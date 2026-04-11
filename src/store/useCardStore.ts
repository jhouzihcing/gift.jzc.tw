import { create } from "zustand";

export interface Card {
  id: string;
  merchant: string;
  name: string;
  barcode: string; // 第一組條碼
  secondaryBarcode: string | null; // 第二組條碼 (密碼)
  amount: number;
  createdAt: number;
  deletedAt: number | null; // null 代表正常，有時間戳記代表已丟棄至垃圾桶
}

interface CardStore {
  cards: Card[];
  isPro: boolean;
  customMerchants: string[]; // 存放使用者自訂的商家列表
  addCard: (newCard: Card) => boolean;
  setCards: (cards: Card[]) => void;
  setProStatus: (isPro: boolean) => void;
  moveToTrash: (id: string) => void;
  restoreFromTrash: (id: string) => void;
  deletePermanently: (id: string) => void;
  addCustomMerchant: (merchant: string) => void;
}

export const useCardStore = create<CardStore>((set, get) => ({
  cards: [],
  isPro: false,
  customMerchants: [],
  
  addCard: (newCard) => {
    const { cards, isPro } = get();
    
    // 商業邏輯：防呆，檢測是否已經掃過相同的卡片
    const isDuplicate = cards.some(c => c.barcode === newCard.barcode);
    if (isDuplicate) {
      alert("⚠️ 此卡片早已被掃描存檔，請更換下一張！");
      return false; // 拒絕寫入
    }
    
    // 商業邏輯：Freemium 限制只計算「非垃圾桶內」的有效卡片
    const activeCardsCount = cards.filter(c => c.deletedAt === null).length;
    if (!isPro && activeCardsCount >= 25) {
      alert("已達免費版上限 (25張)，請升級 PRO 解鎖無限存取！");
      return false;
    }
    
    set((state) => ({ cards: [...state.cards, newCard] }));
    return true;
  },

  moveToTrash: (id) => {
    set((state) => ({
      cards: state.cards.map(c => c.id === id ? { ...c, deletedAt: Date.now() } : c)
    }));
  },

  restoreFromTrash: (id) => {
    set((state) => ({
      cards: state.cards.map(c => c.id === id ? { ...c, deletedAt: null } : c)
    }));
  },

  deletePermanently: (id) => {
    set((state) => ({
      cards: state.cards.filter(c => c.id !== id)
    }));
  },

  addCustomMerchant: (merchant) => {
    set((state) => {
      // 避免重複新增
      if (state.customMerchants.includes(merchant)) return state;
      return { customMerchants: [...state.customMerchants, merchant] };
    });
  },
  
  setCards: (cards) => set({ cards }),
  setProStatus: (isPro) => set({ isPro }),
}));
