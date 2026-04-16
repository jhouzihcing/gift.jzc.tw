import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * 使用 refresh_token 取得新的 access_token
 */
async function refreshAccessToken(token: any) {
  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.AUTH_GOOGLE_ID!,
        client_secret: process.env.AUTH_GOOGLE_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshedTokens = await response.json();
    if (!response.ok) throw new Error(refreshedTokens.error || "Token refresh failed");

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      // 若後端回傳新 refresh_token 則更新，否則沿用舊的
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
      accessTokenExpires: Date.now() + (refreshedTokens.expires_in ?? 3600) * 1000,
    };
  } catch (error) {
    console.error("[Auth] RefreshAccessToken error:", error);
    return { ...token, error: "RefreshAccessTokenError" };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      authorization: {
        params: {
          scope: "openid email profile https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // 第一次登入或刷新時儲存必要資訊
      if (account && profile) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: Date.now() + (Number(account.expires_in) || 3600) * 1000,
          // v2.21.0: 強制鎖定 providerAccountId 為絕對穩定的 UID
          uid: (profile as any).sub || account.providerAccountId,
        };
      }

      // Token 仍有效，直接回傳
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Token 已過期，自動刷新
      console.log("[Auth] Access token expired. Refreshing...");
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      // 確保跨裝置一致性
      (session as any).uid = token.uid || token.sub; 
      (session as any).error = token.error; 
      return session;
    },
  },
  session: { strategy: "jwt" },
});
