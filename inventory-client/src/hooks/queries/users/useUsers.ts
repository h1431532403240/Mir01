/**
 * 用戶管理相關的 React Query Hooks
 * 
 * 提供完整的用戶 CRUD 操作功能
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/apiClient';
import { parseApiError } from '@/lib/errorHandler';
import { QUERY_KEYS } from '../shared/queryKeys';

// 這些類型現在將由 api.ts 精確提供
type UserQueryParams = import('@/types/api').paths["/api/users"]["get"]["parameters"]["query"];
type CreateUserRequestBody = import('@/types/api').paths["/api/users"]["post"]["requestBody"]["content"]["application/json"];
type UpdateUserRequestBody = import('@/types/api').paths["/api/users/{id}"]["put"]["requestBody"]["content"]["application/json"];
type UserPathParams = import('@/types/api').paths["/api/users/{id}"]["get"]["parameters"]["path"];

/**
 * 獲取用戶列表（高性能版本 - 整合第二階段優化）
 * 
 * 效能優化特性：
 * 1. 利用激進緩存策略（15分鐘 staleTime）
 * 2. 智能查詢鍵結構，支援精確緩存失效
 * 3. 網絡狀態感知，避免離線時的無效請求
 * 4. 背景更新禁用，避免用戶操作被打斷
 */
export function useUsers(filters?: UserQueryParams) {
  return useQuery({
    // 正確的結構：['users', { filter... }]
    // 這是一個扁平陣列，第一項是資源名稱，第二項是參數物件
    queryKey: ['users', filters], 
    
    queryFn: async ({ queryKey }) => {
      const [, queryFilters] = queryKey;
      // 🚀 使用傳入的 UserQueryParams，保持原有格式
      // 注意：UserQueryParams 可能已經包含了 filter[...] 格式
      const queryParams: UserQueryParams = {
        ...(queryFilters as UserQueryParams),
      };
      
      const response = await apiClient.GET('/api/users', {
        params: { query: queryParams },
      });
      
      if (response.error) { 
        throw new Error('獲取用戶列表失敗'); 
      }
      
      // 確保返回資料結構統一，處理 Laravel 分頁結構
      // 分頁響應結構: { data: [...用戶列表], meta: {...分頁資訊} }
      return response.data;
    },
    
    // 🎯 數據精煉廠 - 統一處理用戶數據格式（架構統一升級版）
    select: (response: any) => {
      // 處理可能的巢狀或分頁數據
      const users = response?.data?.data || response?.data || response || [];
      
      // 確保返回的是陣列
      if (!Array.isArray(users)) return { data: [], meta: {} };
      
      // 🔧 數據轉換層：在此處理所有用戶數據的統一格式化
      const processedUsers = users.map((user: any) => {
        // 處理 stores 屬性，確保它總是存在且為陣列
        const stores = user.stores || [];
        const roles = user.roles || [];
        
        return {
          ...user,
          id: user.id || 0,
          name: user.name || '未知用戶',
          username: user.username || 'n/a',
          stores: Array.isArray(stores) ? stores : [],
          roles: Array.isArray(roles) ? roles.map(String) : [] // 確保 roles 是 string[]
        };
      });

      return {
        data: processedUsers,
        meta: response?.data?.meta || {}
      }
    },
    
    // 🚀 體驗優化配置（第二階段淨化行動）
    placeholderData: (previousData) => previousData, // 分頁時保持舊資料，避免載入閃爍
    refetchOnMount: false,       // 依賴全域 staleTime
    refetchOnWindowFocus: false, // 後台管理系統不需要窗口聚焦刷新
  });
}

/**
 * 創建用戶的 Mutation Hook
 * 
 * 🚀 功能：為新增用戶功能提供完整的 API 集成
 * 
 * 功能特性：
 * 1. 類型安全的 API 調用 - 使用生成的類型定義
 * 2. 成功後自動刷新用戶列表 - 「失效並強制重取」標準模式
 * 3. 用戶友善的成功/錯誤通知 - 使用 sonner toast
 * 4. 錯誤處理與訊息解析 - 統一的錯誤處理邏輯
 * 
 * @returns React Query mutation 結果，包含 mutate 函數和狀態
 */
export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (body: CreateUserRequestBody) => {
      const { data, error } = await apiClient.POST('/api/users', { body });
      if (error) { 
        // 使用類型安全的錯誤處理
        const errorMessage = parseApiError(error) || '建立用戶失敗';
        
        throw new Error(errorMessage);
      }
      return data;
    },
    onSuccess: async (data: { data?: { name?: string } }) => {
      // 🚀 「失效並強制重取」標準快取處理模式 - 雙重保險機制
      await Promise.all([
        // 1. 失效所有用戶查詢緩存
        queryClient.invalidateQueries({
          queryKey: ['users'],
          exact: false,
          refetchType: 'active',
        }),
        // 2. 強制重新獲取所有活躍的用戶查詢
        queryClient.refetchQueries({
          queryKey: ['users'],
          exact: false,
        })
      ]);
      
      // 🔔 成功通知 - 提升用戶體驗
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.success('用戶已成功創建', {
          description: `用戶「${data?.data?.name}」已成功加入系統`
        });
      }
    },
    onError: (error) => {
      // 🔴 錯誤處理 - 友善的錯誤訊息
      const errorMessage = parseApiError(error);
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.error('創建失敗', { description: errorMessage });
      }
    },
  });
}

/**
 * 更新用戶的 Mutation Hook
 * 
 * 🔧 功能：為用戶編輯功能提供完整的 API 集成
 * 
 * 功能特性：
 * 1. 類型安全的 API 調用 - 使用生成的類型定義
 * 2. 雙重緩存失效策略 - 同時更新列表和詳情緩存
 * 3. 用戶友善的成功/錯誤通知 - 使用 sonner toast
 * 4. 錯誤處理與訊息解析 - 統一的錯誤處理邏輯
 * 
 * @returns React Query mutation 結果，包含 mutate 函數和狀態
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();
  
  type UpdateUserPayload = {
    path: UserPathParams;
    body: UpdateUserRequestBody;
  };
  
  return useMutation({
    mutationFn: async ({ path, body }: UpdateUserPayload) => {
      const { data, error } = await apiClient.PUT('/api/users/{id}', {
        params: { path },
        body,
      });
      if (error) { 
        // 使用類型安全的錯誤處理
        const errorMessage = parseApiError(error) || '更新用戶失敗';
        throw new Error(errorMessage);
      }
      return data;
    },
    onSuccess: async (data: { data?: { name?: string } }, variables) => {
      // 🚀 「失效並強制重取」標準快取處理模式 - 雙重保險機制
      await Promise.all([
        // 1. 失效所有用戶查詢緩存
        queryClient.invalidateQueries({
          queryKey: ['users'],
          exact: false,
          refetchType: 'active',
        }),
        // 2. 強制重新獲取所有活躍的用戶查詢
        queryClient.refetchQueries({
          queryKey: ['users'],
          exact: false,
        })
      ]);
      
      // 🔔 成功通知 - 提升用戶體驗
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.success('用戶資料已成功更新', {
          description: `用戶「${data?.data?.name}」的資料已更新`
        });
      }
    },
    onError: (error) => {
      // 🔴 錯誤處理 - 友善的錯誤訊息
      const errorMessage = parseApiError(error);
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.error('更新失敗', { description: errorMessage });
      }
    },
  });
}

/**
 * 刪除用戶的 Mutation Hook
 * 
 * 🔥 功能：為用戶刪除功能提供完整的 API 集成
 * 
 * 功能特性：
 * 1. 類型安全的 API 調用 - 使用生成的類型定義
 * 2. 成功後自動刷新用戶列表 - 「失效並強制重取」標準模式
 * 3. 用戶友善的成功/錯誤通知 - 使用 sonner toast
 * 4. 錯誤處理與訊息解析 - 統一的錯誤處理邏輯
 * 
 * @returns React Query mutation 結果，包含 mutate 函數和狀態
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (pathParams: UserPathParams) => {
      const { error } = await apiClient.DELETE('/api/users/{id}', {
        params: { path: pathParams }
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      // 🚀 「失效並強制重取」標準快取處理模式 - 雙重保險機制
      await Promise.all([
        // 1. 失效所有用戶查詢緩存
        queryClient.invalidateQueries({
          queryKey: ['users'],
          exact: false,
          refetchType: 'active',
        }),
        // 2. 強制重新獲取所有活躍的用戶查詢
        queryClient.refetchQueries({
          queryKey: ['users'],
          exact: false,
        })
      ]);
      
      // 🔔 成功通知 - 提升用戶體驗
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.success("用戶已成功刪除");
      }
    },
    onError: (error) => {
      // 🔴 錯誤處理 - 友善的錯誤訊息
      const errorMessage = parseApiError(error);
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.error("刪除失敗", { description: errorMessage });
      }
    },
  });
} 