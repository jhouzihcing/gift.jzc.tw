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
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setSyncStatus: (isSyncing: boolean, lastSync: number | null) => void;
  setSyncError: (error: boolean) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  isSyncing: false,
  lastSync: null,
  syncError: false,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setSyncStatus: (isSyncing, lastSync) => set({ isSyncing, lastSync }),
  setSyncError: (error) => set({ syncError: error }),
}));
