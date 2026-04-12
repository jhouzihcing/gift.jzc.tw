"use client";

import { signIn } from "next-auth/react";
import { useAuthStore } from "@/store/useAuthStore";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <main className="flex-1 flex flex-col items-center justify-center p-6 min-h-[100dvh] bg-slate-50 text-slate-900 relative overflow-hidden">
      
      {/* 裝飾背景 - 綠色系 */}
      <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-[#34DA4F]/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] bg-[#5CF777]/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="z-10 flex flex-col items-center w-full max-w-sm gap-12 text-center bg-white/70 p-10 rounded-[2.5rem] border border-white shadow-2xl backdrop-blur-2xl">
        
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-[1.5rem] flex items-center justify-center mb-8 shadow-2xl relative overflow-hidden bg-white border border-slate-100 p-2">
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img 
               src="/logo.png" 
               alt="SGCM Logo" 
               className="w-full h-full object-cover rounded-xl"
             />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">
            智慧商品卡管家
          </h1>
          <p className="text-sm text-slate-400 mt-3 font-bold uppercase tracking-widest">
            Smart Gift Card Manager
          </p>
        </div>

        <div className="w-full space-y-6 pt-4">
          <button 
            onClick={handleGoogleLogin}
            disabled={isLoggingIn}
            className="w-full bg-white text-slate-900 font-black rounded-3xl py-5 flex items-center justify-center gap-4 transition-all hover:bg-slate-50 active:scale-95 shadow-xl shadow-slate-900/10 disabled:opacity-50 group border border-slate-100"
          >
            {isLoggingIn ? (
              "身分驗證中..."
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>使用 Google 帳號登入</span>
              </>
            )}
          </button>
        </div>

      </div>

      {/* 底部隱私條款提示 - 改為標準 Link 以利 Google 爬蟲掃描 */}
      <div className="absolute bottom-10 left-0 w-full text-center px-6">
         <div className="flex flex-col items-center gap-2">
           <p className="text-[10px] text-slate-300 font-bold leading-relaxed max-w-xs mx-auto">
             登入即代表您同意本程式之 
             <Link href="/settings/privacy" className="text-slate-400 underline underline-offset-4 ml-1 hover:text-[#34DA4F] transition-colors">
                隱私權政策與法律條款
             </Link>
           </p>
           <p className="text-[10px] text-slate-200 font-medium">
             本程式不保存個人資料，數據存儲於您的 Google Drive。
           </p>
         </div>
      </div>
    </main>
  );
}
