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
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setSyncStatus: (isSyncing: boolean, lastSync: number | null) => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: true,
  isSyncing: false,
  lastSync: null,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setSyncStatus: (isSyncing, lastSync) => set({ isSyncing, lastSync }),
}));
