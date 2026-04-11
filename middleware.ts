export { auth as middleware } from "@/auth";

// 設定 Middleware 排除靜態檔案與 PWA 資源，僅對 API 與主要頁面生效
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json|icons).*)"],
};
