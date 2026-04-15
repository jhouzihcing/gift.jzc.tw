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
    async jwt({ token, account }) {
      // 第一次登入時儲存 access_token 及 refresh_token
      if (account) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: Date.now() + (Number(account.expires_in) || 3600) * 1000,
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
      (session as any).uid = token.sub; // 傳給前端作為 AES 金鑰種子
      (session as any).error = token.error; // 傳遞給前端以偵測刷新失敗
      return session;
    },
  },
  session: { strategy: "jwt" },
});
