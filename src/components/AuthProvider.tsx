"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useDriveSync } from "@/hooks/useDriveSync";

function SessionSync() {
  const { data: session, status } = useSession();
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  
  // 啟動雲端同步機制
  useDriveSync();

  useEffect(() => {
    if (status === "loading") {
      setLoading(true);
      return;
    }

    if (session) {
      setUser({
        uid: (session.user as any)?.id || session.user?.email || "unknown",
        email: session.user?.email || null,
        displayName: session.user?.name || null,
        driveToken: (session as any).accessToken || null,
      });
    } else {
      setUser(null);
    }
  }, [session, status, setUser, setLoading]);

  return null;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SessionSync />
      {children}
    </SessionProvider>
  );
}
