import { auth } from "../auth";
import { NextResponse } from "next/server";

/**
 * 高性能認證中間件（第五階段：中間件優化版本）
 * 
 * 🚀 核心性能優化：
 * 1. 精確路由匹配 - 減少不必要的認證檢查
 * 2. 智能重定向策略 - 避免多次重定向循環
 * 3. 靜態資源快速通道 - 零延遲處理靜態檔案
 * 4. 邊緣運算最佳化 - 充分利用 Edge Runtime 性能
 * 5. 網絡請求最小化 - 減少認證相關的網絡開銷
 * 
 * 🎯 專為解決「中間件開銷」問題設計：
 * - 消除冗餘的認證檢查
 * - 優化公開路由處理
 * - 智能快取友好設計
 * - 錯誤處理性能優化
 * 
 * 技術亮點：
 * - 使用 NextResponse.next() 最小化處理開銷
 * - 路徑匹配算法優化
 * - 重定向邏輯簡化
 */
export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;
  const isLoggedIn = !!req.auth;
  
  // 🚀 第一層優化：靜態資源和 API 路由快速通道
  // 這些路由完全跳過認證檢查，實現零延遲
  if (
    pathname.startsWith('/_next') ||      // Next.js 內部資源
    pathname.startsWith('/api') ||        // API 路由（有自己的認證）
    pathname.includes('.') ||             // 所有帶副檔名的靜態檔案
    pathname === '/favicon.ico' ||        // 網站圖標
    pathname === '/robots.txt' ||         // 搜尋引擎爬蟲檔案
    pathname === '/manifest.json'         // PWA 清單檔案
  ) {
    return NextResponse.next();
  }

  // 🎯 第二層優化：精確的公開路由處理
  // 定義明確的公開路由清單，避免模糊匹配
  const publicRoutes = ['/login'];
  const isPublicRoute = publicRoutes.includes(pathname);

  // 🔥 第三層優化：智能登入頁面邏輯（與 Auth.js 修復相容）
  if (pathname === '/login') {
    if (isLoggedIn) {
      // 🔧 修復：已登入用戶訪問登入頁 → 重定向到儀表板
      // 由於 Auth.js 的 authorized 回調已簡化，這裡需要處理重定向
      return NextResponse.redirect(new URL('/dashboard', nextUrl));
    }
    // 未登入用戶訪問登入頁 → 允許
    return NextResponse.next();
  }

  // ⚡ 第四層優化：根路徑智能處理
  if (pathname === '/') {
    if (isLoggedIn) {
      // 已登入用戶訪問根路徑 → 重定向到儀表板
      return NextResponse.redirect(new URL('/dashboard', nextUrl));
    } else {
      // 未登入用戶訪問根路徑 → 重定向到登入頁
      return NextResponse.redirect(new URL('/login', nextUrl));
    }
  }

  // 🛡️ 第五層優化：受保護路由的精簡檢查
  if (!isLoggedIn && !isPublicRoute) {
    // 未登入用戶訪問受保護路由 → 重定向到登入頁
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  // 🎊 最終層：允許通過，最小化處理開銷
  return NextResponse.next();
});

/**
 * 中間件匹配器配置（高性能版本）
 * 
 * 🚀 優化策略：
 * 1. 更精確的排除模式 - 減少中間件調用次數
 * 2. 性能友好的正則表達式 - 降低匹配開銷
 * 3. 靜態資源完全跳過 - 零中間件開銷
 * 
 * 排除項目（完全不經過中間件）：
 * - /_next/* - Next.js 所有內部資源和靜態檔案
 * - /api/* - API 路由（Laravel 後端處理認證）
 * - 所有帶副檔名的檔案 (*.js, *.css, *.png, *.ico 等)
 * 
 * 包含項目（需要認證檢查）：
 * - 所有頁面路由 (/dashboard, /users, /products 等)
 * - 根路徑 (/)
 * - 登入頁面 (/login) - 需要重定向邏輯
 */
export const config = {
  matcher: [
    /*
     * 匹配所有路徑，除了：
     * - /_next (Next.js 內部檔案)
     * - /api (API 路由)
     * - 所有帶副檔名的檔案
     */
    '/((?!_next|api|.*\\.).*)',
  ],
}; 