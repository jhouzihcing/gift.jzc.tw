import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { encryptText, decryptText } from "@/lib/crypto";
import { useAuthStore } from "./useAuthStore";

export type CardStatus = "Active" | "Trashed" | "Empty";

export interface Card {
  id: string;
  merchant: string;
  name: string;
  barcode: string;
  secondaryBarcode: string | null;
  amount: number;
  createdAt: number;
  deletedAt: number | null;
  status: CardStatus;
  isSynced?: boolean;
}

interface CardStore {
  cards: Card[];
  isPro: boolean;
  isInitialized: boolean;
  customMerchants: string[];
  cloudFileIds: { visible: string | null; hidden: string | null };
  
  // v2.12.0 極速閃電佇列
  syncQueue: string[];
  isGlobalSyncing: boolean;

  // v2.19.0 同步日誌偵測
  syncLogs: string[];
  
  addCard: (newCard: Card) => boolean;
  setCards: (cards: Card[]) => void;
  setProStatus: (isPro: boolean) => void;
  moveToTrash: (id: string) => void;
  restoreFromTrash: (id: string) => void;
  deletePermanently: (id: string) => void;
  addCustomMerchant: (merchant: string) => void;
  markCardSynced: (id: string, isSynced: boolean) => void;
  setGlobalSyncing: (isSyncing: boolean) => void;
  removeFromQueue: (ids: string[]) => void;
  finishInitialization: () => void;
  setCloudFileIds: (ids: { visible: string | null; hidden: string | null }) => void;
  addSyncLog: (msg: string) => void;
}

export const useCardStore = create<CardStore>()(
  persist(
    (set, get) => ({
      cards: [],
      isPro: false,
      isInitialized: false,
      customMerchants: [],
      syncQueue: [],
      isGlobalSyncing: false,
      cloudFileIds: { visible: null, hidden: null },
      syncLogs: [],

      addSyncLog: (msg) => {
        const timestamp = new Date().toLocaleTimeString('zh-TW', { hour12: false });
        set((state) => ({ 
          syncLogs: [`[${timestamp}] ${msg}`, ...state.syncLogs].slice(0, 50) 
        }));
      },

      setCloudFileIds: (ids) => set({ cloudFileIds: ids }),

      finishInitialization: () => set({ isInitialized: true }),

      setGlobalSyncing: (isSyncing) => set({ isGlobalSyncing: isSyncing }),

      removeFromQueue: (ids) => set((state) => ({
        syncQueue: state.syncQueue.filter(id => !ids.includes(id))
      })),

      addCard: (newCard) => {
        const { cards, isPro } = get();
        const isDuplicate = cards.some(c => c.barcode === newCard.barcode);
        if (isDuplicate) {
          alert("⚠️ 此卡片早已被掃描存檔，請更換下一張！");
          return false;
        }

        const activeCardsCount = cards.filter(c => c.deletedAt === null).length;
        if (!isPro && activeCardsCount >= 25) {
          alert("已達免費版上限 (25張)，請升級 PRO 解鎖無限存取！");
          return false;
        }

        const cardWithStatus = { ...newCard, status: "Active" as CardStatus, isSynced: false };
        set((state) => ({ 
          cards: [...state.cards, cardWithStatus],
          syncQueue: [...state.syncQueue, newCard.id]
        }));
        return true;
      },

      moveToTrash: (id) => {
        set((state) => ({
          cards: state.cards.map(c => 
            c.id === id ? { ...c, deletedAt: Date.now(), status: "Trashed" as CardStatus, isSynced: false } : c
          ),
          syncQueue: Array.from(new Set([...state.syncQueue, id]))
        }));
      },

      restoreFromTrash: (id) => {
        set((state) => ({
          cards: state.cards.map(c => 
            c.id === id ? { ...c, deletedAt: null, status: "Active" as CardStatus, isSynced: false } : c
          ),
          syncQueue: Array.from(new Set([...state.syncQueue, id]))
        }));
      },

      deletePermanently: (id) => {
        set((state) => ({
          cards: state.cards.filter(c => c.id !== id),
          syncQueue: state.syncQueue.filter(qid => qid !== id)
        }));
      },

      addCustomMerchant: (merchant) => {
        set((state) => {
          if (state.customMerchants.includes(merchant)) return state;
          return { customMerchants: [...state.customMerchants, merchant] };
        });
      },

      markCardSynced: (id, isSynced) => {
        set((state) => ({
          cards: state.cards.map(c => c.id === id ? { ...c, isSynced } : c)
        }));
      },

      setCards: (cards) => set({ cards }),
      setProStatus: (isPro) => set({ isPro }),
    }),
    {
      name: "sgcm-cards-v1",
      storage: createJSONStorage(() => ({
        getItem: async (name) => {
          const value = localStorage.getItem(name);
          if (!value) return null;
          if (!value.includes(".")) return value;
          const uid = useAuthStore.getState().user?.uid;
          if (!uid) return null;
          try {
            return await decryptText(value, uid);
          } catch (e) {
            console.error("[Storage] 本地解密失敗:", e);
            return null;
          }
        },
        setItem: async (name, value) => {
          const uid = useAuthStore.getState().user?.uid;
          if (!uid) return;
          try {
            const encrypted = await encryptText(value, uid);
            localStorage.setItem(name, encrypted);
          } catch (e) {
            console.error("[Storage] 本地加密失敗:", e);
          }
        },
        removeItem: (name) => localStorage.removeItem(name),
      })),
      partialize: (state) => ({
        cards: state.cards,
        isPro: state.isPro,
        customMerchants: state.customMerchants,
      }),
    }
  )
);
