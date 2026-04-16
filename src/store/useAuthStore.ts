import { create } from "zustand";

interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  driveToken?: string | null;
}

interface AuthStore {
  user: User | null;
  loading: boolean;
  isSyncing: boolean;
  lastSync: number | null;
  syncError: boolean;
  // v2.20.0: 手動金鑰覆蓋
  syncOverrideUid: string | null;
  
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setSyncStatus: (isSyncing: boolean, lastSync: number | null) => void;
  setSyncError: (error: boolean) => void;
  setSyncOverrideUid: (uid: string | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  isSyncing: false,
  lastSync: null,
  syncError: false,
  syncOverrideUid: typeof window !== "undefined" ? localStorage.getItem("zj_card_uid_override") : null,

  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setSyncStatus: (isSyncing, lastSync) => set({ isSyncing, lastSync }),
  setSyncError: (error) => set({ syncError: error }),
  
  setSyncOverrideUid: (uid) => {
    if (uid) {
      localStorage.setItem("zj_card_uid_override", uid);
    } else {
      localStorage.removeItem("zj_card_uid_override");
    }
    set({ syncOverrideUid: uid });
  },
}));
