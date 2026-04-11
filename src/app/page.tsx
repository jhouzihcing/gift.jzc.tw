"use client";

import { signIn } from "next-auth/react";
import { useAuthStore } from "@/store/useAuthStore";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuthStore();
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // 如果已經登入，直接跳轉到 Dashboard
  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      // 使用 NextAuth 的 signIn，會自動去跑我們在 auth.ts 設定好的流程
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (error) {
      console.error("登入失敗:", error);
      alert("登入過程中發生錯誤，請稍後再試。");
      setIsLoggingIn(false);
    }
  };

  if (loading) return null;

  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 min-h-[100dvh] bg-gray-50 text-gray-900 relative overflow-hidden">
      
      <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] bg-[#00F5FF]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="z-10 flex flex-col items-center w-full max-w-sm gap-12 text-center bg-white/60 p-10 rounded-[2rem] border border-gray-100 shadow-xl backdrop-blur-xl">
        
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-gray-900 rounded-[1.25rem] flex items-center justify-center mb-6 shadow-lg shadow-gray-900/20">
            <CreditCard size={32} className="text-[#00F5FF]" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            智慧商品卡管家
          </h1>
          <p className="text-sm text-gray-500 mt-3 font-medium">
            安全地保存與管理你的實體卡片
          </p>
        </div>

        <div className="w-full space-y-4 pt-4">
          <button 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-gray-900 text-white font-bold rounded-2xl py-4 flex items-center justify-center transition-all hover:bg-gray-800 active:scale-95 shadow-md disabled:opacity-50"
          >
            {isLoggingIn ? "身分驗證中..." : "👉 使用 Google 帳號登入"}
          </button>
        </div>

      </div>
    </main>
  );
}
