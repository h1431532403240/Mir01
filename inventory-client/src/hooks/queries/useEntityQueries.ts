import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/apiClient';
import { parseApiErrorMessage } from '@/types/error';
import { CreateStoreRequest, UpdateStoreRequest, ProductFilters, CustomerFilters, Customer } from '@/types/api-helpers';

/**
 * API Hooks - 商品管理
 * 使用生成的 API 類型定義進行類型安全的資料操作
 */

/**
 * 查詢金鑰定義
 * 
 * 統一管理所有 React Query 的查詢金鑰，
 * 確保快取鍵值的一致性和可維護性
 */
export const QUERY_KEYS = {
    PRODUCTS: ['products'] as const,
    PRODUCT: (id: number) => ['products', id] as const,
    USERS: ['users'] as const,
    USER: (id: number) => ['users', id] as const,
    CUSTOMERS: ['customers'] as const,
    CUSTOMER: (id: number) => ['customers', id] as const,
    CATEGORIES: ['categories'] as const,
    ATTRIBUTES: ['attributes'] as const,
};

/**
 * 商品列表查詢 Hook（完整篩選版本 - TD-004 解決方案）
 * 
 * 功能特性：
 * 1. 支援完整的後端篩選參數（product_name, store_id, category_id, low_stock, out_of_stock）
 * 2. 智能查詢鍵結構，支援所有篩選參數的精確緩存
 * 3. 向後相容舊版 search 參數
 * 4. 高效能緩存策略，減少不必要的 API 請求
 * 
 * @param filters - 篩選參數物件，包含所有可用的篩選條件
 * @returns React Query 查詢結果
 */
export function useProducts(filters: ProductFilters = {}) {
    return useQuery({
        queryKey: [...QUERY_KEYS.PRODUCTS, filters],
        queryFn: async () => {
            // 構建查詢參數，移除 undefined 值
            const queryParams: Record<string, string | number | boolean> = {};
            
            if (filters.product_name) queryParams.product_name = filters.product_name;
            if (filters.store_id !== undefined) queryParams.store_id = filters.store_id;
            if (filters.category_id !== undefined) queryParams.category_id = filters.category_id;
            if (filters.low_stock !== undefined) queryParams.low_stock = filters.low_stock;
            if (filters.out_of_stock !== undefined) queryParams.out_of_stock = filters.out_of_stock;
            if (filters.search) queryParams.search = filters.search; // 向後相容性
            if (filters.page !== undefined) queryParams.page = filters.page;
            if (filters.per_page !== undefined) queryParams.per_page = filters.per_page;

            const { data, error } = await apiClient.GET('/api/products', {
                params: { 
                    query: Object.keys(queryParams).length > 0 ? queryParams : undefined 
                }
            });
            
            if (error) {
                throw new Error('獲取商品列表失敗');
            }

            return data;
        },
        
        // 🚀 體驗優化配置
        placeholderData: (previousData) => previousData, // 篩選時保持舊資料，避免載入閃爍
        refetchOnMount: false,       // 依賴全域 staleTime
        refetchOnWindowFocus: false, // 後台管理系統不需要窗口聚焦刷新
        staleTime: 1 * 60 * 1000,   // 1 分鐘緩存，平衡體驗與資料新鮮度
    });
}

/**
 * 單個商品查詢 Hook
 * 
 * @param id - 商品 ID
 * @returns React Query 查詢結果
 */
export function useProduct(id: number) {
    return useQuery({
        queryKey: QUERY_KEYS.PRODUCT(id),
        queryFn: async () => {
            const { data, error } = await apiClient.GET('/api/products/{id}', {
                params: { path: { id } }
            });
            
            if (error) {
                throw new Error('獲取商品失敗');
            }
            return data;
        },
        enabled: !!id, // 只有當 id 存在時才執行查詢
    });
}

/**
 * 商品詳情查詢 Hook - 專為編輯功能設計
 * 
 * 此 Hook 專門用於商品編輯嚮導，提供完整的商品資訊：
 * 1. SPU 基本資訊 (name, description, category)
 * 2. 商品屬性列表 (attributes)
 * 3. 所有 SKU 變體詳情 (variants with attribute values)
 * 4. 庫存資訊 (inventory per store)
 * 
 * @param productId - 商品 ID
 * @returns React Query 查詢結果，包含完整的商品結構
 */
export function useProductDetail(productId: number | string | undefined) {
    // 確保 productId 是有效的數字
    const numericId = productId ? Number(productId) : undefined;
    
    return useQuery({
        queryKey: [...QUERY_KEYS.PRODUCT(numericId!), 'detail'],
        queryFn: async () => {
            if (!numericId) {
                throw new Error('商品 ID 無效');
            }

            const { data, error } = await apiClient.GET('/api/products/{id}', {
                params: { path: { id: numericId } }
            });
            
            if (error) {
                const errorMessage = parseApiErrorMessage(error);
                throw new Error(errorMessage || '獲取商品詳情失敗');
            }

            return data;
        },
        enabled: !!numericId, // 只有當有效的 ID 存在時才執行查詢
        staleTime: 5 * 60 * 1000, // 5 分鐘緩存時間，編輯期間避免重複請求
        retry: 2, // 失敗時重試 2 次
    });
}

// 商品創建端點暫時未定義 - 等待後端實現

// 導入由 openapi-typescript 生成的精確類型
type CreateProductRequestBody = import('@/types/api').paths["/api/products"]["post"]["requestBody"]["content"]["application/json"];

/**
 * 創建商品的 Hook (SPU/SKU 架構)
 * 
 * 支援完整的 SPU/SKU 商品創建流程：
 * 1. 創建 SPU (Standard Product Unit) - 標準商品單位
 * 2. 關聯商品屬性 (attributes)
 * 3. 創建 SKU 變體 (variants) - 庫存保管單位
 * 4. 自動初始化所有門市的庫存記錄
 * 
 * @returns React Query 變更結果
 */
export function useCreateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (productData: CreateProductRequestBody) => {
            const { data, error } = await apiClient.POST('/api/products', {
                body: productData
            });
            
            if (error) {
                const errorMessage = parseApiErrorMessage(error);
                throw new Error(errorMessage);
            }
            
            return data;
        },
        onSuccess: async (data) => {
            // 🚀 「失效並強制重取」標準快取處理模式 - 雙重保險機制
            await Promise.all([
                // 1. 失效所有商品查詢緩存
                queryClient.invalidateQueries({
                    queryKey: QUERY_KEYS.PRODUCTS,
                    exact: false,
                    refetchType: 'active',
                }),
                // 2. 強制重新獲取所有活躍的商品查詢
                queryClient.refetchQueries({
                    queryKey: QUERY_KEYS.PRODUCTS,
                    exact: false,
                })
            ]);
            
            // 使用 toast 顯示成功訊息
            if (typeof window !== 'undefined') {
                const { toast } = require('sonner');
                toast.success('商品創建成功！', {
                    description: `商品「${data?.data?.name}」已成功創建，商品列表已自動更新。`
                });
            }
        },
        onError: (error) => {
            // 錯誤處理並顯示錯誤訊息
            if (typeof window !== 'undefined') {
                const { toast } = require('sonner');
                toast.error('商品創建失敗', {
                    description: error.message || '請檢查輸入資料並重試。'
                });
            }
        },
    });
}

/**
 * 創建單規格商品的 Hook (v3.0 雙軌制 API)
 * 
 * 專門用於單規格商品的快速創建，無需處理複雜的 SPU/SKU 屬性結構。
 * 此 Hook 使用簡化的 API 端點，後端會自動處理標準屬性的創建和關聯。
 * 
 * 支援功能：
 * 1. 簡化的商品創建流程（只需 name, sku, price 等基本資訊）
 * 2. 後端自動處理 SPU/SKU 架構轉換
 * 3. 自動創建標準屬性和屬性值
 * 4. 自動初始化所有門市的庫存記錄
 * 
 * @returns React Query 變更結果
 */
export function useCreateSimpleProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (productData: {
            name: string;
            sku: string;
            price: number;
            category_id?: number | null;
            description?: string;
        }) => {
            const { data, error } = await apiClient.POST('/api/products/simple', {
                body: productData
            });
            
            if (error) {
                const errorMessage = parseApiErrorMessage(error);
                throw new Error(errorMessage);
            }
            
            return data;
        },
        onSuccess: async (data) => {
            // 🚀 「失效並強制重取」標準快取處理模式 - 雙重保險機制
            await Promise.all([
                // 1. 失效所有商品查詢緩存
                queryClient.invalidateQueries({
                    queryKey: QUERY_KEYS.PRODUCTS,
                    exact: false,
                    refetchType: 'active',
                }),
                // 2. 強制重新獲取所有活躍的商品查詢
                queryClient.refetchQueries({
                    queryKey: QUERY_KEYS.PRODUCTS,
                    exact: false,
                })
            ]);
            
            // 使用 toast 顯示成功訊息
            if (typeof window !== 'undefined') {
                const { toast } = require('sonner');
                toast.success('單規格商品創建成功！', {
                    description: `商品「${data?.data?.name}」已成功創建，商品列表已自動更新。`
                });
            }
        },
        onError: (error) => {
            // 錯誤處理並顯示錯誤訊息
            if (typeof window !== 'undefined') {
                const { toast } = require('sonner');
                toast.error('單規格商品創建失敗', {
                    description: error.message || '請檢查輸入資料並重試。'
                });
            }
        },
    });
}

// 導入由 openapi-typescript 生成的精確類型
type UpdateProductRequestBody = import('@/types/api').paths["/api/products/{id}"]["put"]["requestBody"]["content"]["application/json"];

/**
 * 更新商品的 Hook (SPU/SKU 架構升級版)
 * 
 * 支援完整的 SPU/SKU 商品更新流程：
 * 1. 更新 SPU (Standard Product Unit) - 標準商品單位
 * 2. 重新關聯商品屬性 (attributes)
 * 3. 智能 SKU 變體管理 (variants) - 新增/修改/刪除
 * 4. 自動同步所有門市的庫存記錄
 * 
 * @returns React Query 變更結果
 */
export function useUpdateProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ id, ...productData }: { id: number } & UpdateProductRequestBody) => {
            const { data, error } = await apiClient.PUT('/api/products/{id}', {
                params: { path: { id } },
                body: productData
            });
            
            if (error) {
                const errorMessage = parseApiErrorMessage(error);
                throw new Error(errorMessage || '更新商品失敗');
            }
            
            return data;
        },
        onSuccess: async (data, variables) => {
            // 🚀 「失效並強制重取」標準快取處理模式 - 雙重保險機制
            await Promise.all([
                // 1. 失效所有商品查詢緩存
                queryClient.invalidateQueries({
                    queryKey: QUERY_KEYS.PRODUCTS,
                    exact: false,
                    refetchType: 'active',
                }),
                // 2. 強制重新獲取所有活躍的商品查詢
                queryClient.refetchQueries({
                    queryKey: QUERY_KEYS.PRODUCTS,
                    exact: false,
                }),
                // 3. 單個實體詳情頁的快取處理
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCT(variables.id) }),
                queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.PRODUCT(variables.id), 'detail'] })
            ]);
            
            // 🎯 在 Hook 層級不顯示 toast，讓組件層級處理
            // 這樣可以提供更靈活的用戶反饋控制
        },
        onError: (error) => {
            // 錯誤處理並顯示錯誤訊息
            if (typeof window !== 'undefined') {
                const { toast } = require('sonner');
                toast.error('商品更新失敗', {
                    description: error.message || '請檢查輸入資料並重試。'
                });
            }
        },
    });
}

/**
 * 刪除商品的 Hook
 * 
 * @returns React Query 變更結果
 */
export function useDeleteProduct() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: number) => {
            const { data, error } = await apiClient.DELETE('/api/products/{id}', {
                params: { path: { id } }
            });
            
            if (error) {
                throw new Error('刪除商品失敗');
            }
            
            return data;
        },
        onSuccess: async (data, id) => {
            // 🚀 「失效並強制重取」標準快取處理模式 - 雙重保險機制
            await Promise.all([
                // 1. 失效所有商品查詢緩存
                queryClient.invalidateQueries({
                    queryKey: QUERY_KEYS.PRODUCTS,
                    exact: false,
                    refetchType: 'active',
                }),
                // 2. 強制重新獲取所有活躍的商品查詢
                queryClient.refetchQueries({
                    queryKey: QUERY_KEYS.PRODUCTS,
                    exact: false,
                })
            ]);
            
            // 移除已刪除商品的快取
            queryClient.removeQueries({ queryKey: QUERY_KEYS.PRODUCT(id) });
        },
    });
}

// 導入由 openapi-typescript 生成的精確類型
// 舊的批量刪除類型定義已移除，將在 API 契約同步後重新生成

/**
 * 批量刪除商品的 Mutation (戰術升級版 - 使用 POST 方法)
 * 
 * 功能說明：
 * 1. 使用語義更明確的 POST /api/products/batch-delete 端點
 * 2. 統一參數名為 ids，提供更直觀的 API 介面
 * 3. 返回 204 No Content，符合 RESTful 設計標準
 * 4. 自動失效相關查詢緩存，確保資料一致性
 */
export function useDeleteMultipleProducts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { ids: number[] }) => {
      // 轉換數字陣列為字串陣列（根據 API 規格要求）
      const { error } = await apiClient.POST('/api/products/batch-delete', {
        body: { ids: body.ids.map(id => id.toString()) },
      });

      if (error) {
        const errorMessage = (error as { detail?: string[] })?.detail?.[0] || '刪除商品失敗';
        throw new Error(errorMessage);
      }
    },
    onSuccess: async (data, variables) => {
      // 🚀 「失效並強制重取」標準快取處理模式 - 雙重保險機制
      await Promise.all([
        // 1. 失效所有商品查詢緩存
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.PRODUCTS,
          exact: false,
          refetchType: 'active',
        }),
        // 2. 強制重新獲取所有活躍的商品查詢
        queryClient.refetchQueries({
          queryKey: QUERY_KEYS.PRODUCTS,
          exact: false,
        })
      ]);
      
      // 移除已刪除商品的快取
      variables.ids.forEach(id => {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.PRODUCT(id) });
      });
    },
  });
}

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
      // 移除 include=stores 參數，降低後端負載（按照淨化行動要求）
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
    
    // 🚀 體驗優化配置（第二階段淨化行動）
    placeholderData: (previousData) => previousData, // 分頁時保持舊資料，避免載入閃爍
    refetchOnMount: false,       // 依賴全域 staleTime
    refetchOnWindowFocus: false, // 後台管理系統不需要窗口聚焦刷新
  });
}

/**
 * 獲取單一客戶詳情的 Query Hook
 * 
 * 🎯 戰術功能：為編輯功能提供完整的客戶資料查詢
 * 
 * 功能特性：
 * 1. 條件性查詢 - 只有當 customerId 有效時才觸發 API 請求
 * 2. 智能緩存策略 - 使用客戶 ID 作為唯一緩存鍵
 * 3. 類型安全的 API 調用 - 使用生成的類型定義
 * 4. 錯誤處理與訊息解析 - 統一的錯誤處理邏輯
 * 5. 支援完整的客戶資訊與地址列表
 * 
 * @param customerId - 客戶 ID，為 null 時不觸發查詢
 * @returns React Query 查詢結果，包含客戶詳情數據
 */
export function useCustomerDetail(customerId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.CUSTOMER(customerId!), // 使用 ['customers', customerId] 作為唯一鍵
    queryFn: async () => {
      if (!customerId) return null; // 如果沒有 ID，則不執行查詢
      
      const { data, error } = await apiClient.GET('/api/customers/{id}', {
        params: { path: { id: customerId } },
      });
      
      if (error) {
        const errorMessage = parseApiErrorMessage(error);
        throw new Error(errorMessage || '獲取客戶詳情失敗');
      }
      
      return data;
    },
    enabled: !!customerId, // 只有在 customerId 存在時，此查詢才會被觸發
    staleTime: 5 * 60 * 1000, // 5 分鐘緩存時間，編輯期間避免重複請求
    retry: 2, // 失敗時重試 2 次
  });
}

/**
 * 創建客戶的 Mutation Hook
 * 
 * 🚀 戰術功能：為「新增客戶」按鈕提供完整的 API 集成
 * 
 * 功能特性：
 * 1. 類型安全的 API 調用 - 使用生成的類型定義
 * 2. 成功後自動刷新客戶列表 - 「失效並強制重取」標準模式
 * 3. 用戶友善的成功/錯誤通知 - 使用 sonner toast
 * 4. 錯誤處理與訊息解析 - 統一的錯誤處理邏輯
 * 5. 支援完整的客戶資訊與地址管理
 * 
 * @returns React Query mutation 結果，包含 mutate 函數和狀態
 */
export function useCreateCustomer() {
  const queryClient = useQueryClient();
  
  // 使用 API 生成的類型定義
  type CreateCustomerRequestBody = import('@/types/api').paths['/api/customers']['post']['requestBody']['content']['application/json'];
  
  return useMutation({
    mutationFn: async (customerData: CreateCustomerRequestBody) => {
      const { data, error } = await apiClient.POST('/api/customers', {
        body: customerData,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      // 🚀 「失效並強制重取」標準快取處理模式 - 雙重保險機制
      await Promise.all([
        // 1. 失效所有客戶查詢緩存
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.CUSTOMERS,
          exact: false,
          refetchType: 'active',
        }),
        // 2. 強制重新獲取所有活躍的客戶查詢
        queryClient.refetchQueries({
          queryKey: QUERY_KEYS.CUSTOMERS,
          exact: false,
        })
      ]);
      
      // 🔔 成功通知 - 提升用戶體驗
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.success('客戶已成功創建', {
          description: `客戶「${data?.data?.name}」已成功加入系統`
        });
      }
    },
    onError: (error) => {
      // 🔴 錯誤處理 - 友善的錯誤訊息
      const errorMessage = parseApiErrorMessage(error);
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.error('創建失敗', { description: errorMessage });
      }
    },
  });
}

/**
 * 刪除客戶的 Mutation Hook
 * 
 * 🔥 戰術功能：為操作列的刪除按鈕裝填真正的彈藥
 * 
 * 功能特性：
 * 1. 類型安全的 API 調用 - 使用生成的類型定義
 * 2. 成功後自動刷新客戶列表 - 「失效並強制重取」標準模式
 * 3. 用戶友善的成功/錯誤通知 - 使用 sonner toast
 * 4. 錯誤處理與訊息解析 - 統一的錯誤處理邏輯
 * 
 * @returns React Query mutation 結果，包含 mutate 函數和狀態
 */
export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (customerId: number) => {
      const { error } = await apiClient.DELETE('/api/customers/{id}', {
        params: { path: { id: customerId } }
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      // 🚀 「失效並強制重取」標準快取處理模式 - 雙重保險機制
      await Promise.all([
        // 1. 失效所有客戶查詢緩存
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.CUSTOMERS,
          exact: false,
          refetchType: 'active',
        }),
        // 2. 強制重新獲取所有活躍的客戶查詢
        queryClient.refetchQueries({
          queryKey: QUERY_KEYS.CUSTOMERS,
          exact: false,
        })
      ]);
      
      // 🔔 成功通知 - 提升用戶體驗
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.success("客戶已成功刪除");
      }
    },
    onError: (error) => {
      // 🔴 錯誤處理 - 友善的錯誤訊息
      const errorMessage = parseApiErrorMessage(error);
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.error("刪除失敗", { description: errorMessage });
      }
    },
  });
}

// ==================== 客戶管理系統 (CUSTOMER MANAGEMENT) ====================

/**
 * 客戶查詢參數類型
 */
type CustomerQueryParams = {
  search?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  per_page?: number;
};

/**
 * 獲取客戶列表 Hook
 * 
 * @param filters - 篩選參數
 * @returns React Query 查詢結果
 */
export function useCustomers(filters?: CustomerFilters) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CUSTOMERS, filters],
    queryFn: async ({ queryKey }) => {
      const [, queryFilters] = queryKey;
      const queryParams: CustomerQueryParams = {
        ...(queryFilters as CustomerFilters),
      };
      
      const response = await apiClient.GET('/api/customers', {
        params: { query: queryParams },
      });
      
      if (response.error) {
        throw new Error('獲取客戶列表失敗');
      }
      
      return response.data;
    },
    
    // 🚀 體驗優化配置
    placeholderData: (previousData) => previousData, // 篩選時保持舊資料，避免載入閃爍
    refetchOnMount: false,       // 依賴全域 staleTime
    refetchOnWindowFocus: false, // 後台管理系統不需要窗口聚焦刷新
    staleTime: 1 * 60 * 1000,   // 1 分鐘緩存，平衡體驗與資料新鮮度
  });
}

/**
 * 更新客戶的 Mutation Hook
 * 
 * 🔧 戰術功能：為客戶編輯功能提供完整的 API 集成
 * 
 * 功能特性：
 * 1. 類型安全的 API 調用 - 使用生成的類型定義
 * 2. 雙重緩存失效策略 - 同時更新列表和詳情緩存
 * 3. 用戶友善的成功/錯誤通知 - 使用 sonner toast
 * 4. 錯誤處理與訊息解析 - 統一的錯誤處理邏輯
 * 5. 支援完整的客戶資訊與地址管理更新
 * 
 * @returns React Query mutation 結果，包含 mutate 函數和狀態
 */
export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  
  // 使用 API 生成的類型定義
  type UpdateCustomerRequestBody = import('@/types/api').paths['/api/customers/{id}']['put']['requestBody']['content']['application/json'];
  type UpdateCustomerPayload = {
    id: number;
    data: UpdateCustomerRequestBody;
  };
  
  return useMutation({
    mutationFn: async ({ id, data }: UpdateCustomerPayload) => {
      const { data: responseData, error } = await apiClient.PUT('/api/customers/{id}', {
        params: { path: { id } },
        body: data,
      });
      if (error) throw error;
      return responseData;
    },
    onSuccess: async (data, variables) => {
      // 🚀 「失效並強制重取」標準快取處理模式 - 雙重保險機制
      await Promise.all([
        // 1. 失效所有客戶查詢緩存
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.CUSTOMERS,
          exact: false,
          refetchType: 'active',
        }),
        // 2. 強制重新獲取所有活躍的客戶查詢
        queryClient.refetchQueries({
          queryKey: QUERY_KEYS.CUSTOMERS,
          exact: false,
        }),
        // 3. 單個客戶詳情頁的快取處理
        queryClient.invalidateQueries({ 
          queryKey: QUERY_KEYS.CUSTOMER(variables.id),
          refetchType: 'active' 
        }),
        queryClient.refetchQueries({ 
          queryKey: QUERY_KEYS.CUSTOMER(variables.id)
        })
      ]);
      
      // 🔔 成功通知 - 提升用戶體驗
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.success('客戶資料已成功更新', {
          description: `客戶「${data?.data?.name}」的資料已更新`
        });
      }
    },
    onError: (error) => {
      // 🔴 錯誤處理 - 友善的錯誤訊息
      const errorMessage = parseApiErrorMessage(error);
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.error('更新失敗', { description: errorMessage });
      }
    },
  });
}

// ==================== 屬性管理系統 (ATTRIBUTE MANAGEMENT) ====================

/**
 * 獲取屬性列表
 */
export function useAttributes() {
  return useQuery({
    queryKey: QUERY_KEYS.ATTRIBUTES,
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/attributes');
      if (error) {
        throw new Error('獲取屬性列表失敗');
      }
      return data;
    },
  });
}

/**
 * 創建屬性
 */
export function useCreateAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string }) => {
      const { data, error } = await apiClient.POST('/api/attributes', {
        body,
      });
      if (error) {
        const errorMessage = parseApiErrorMessage(error) || '建立屬性失敗';
        throw new Error(errorMessage);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTRIBUTES });
    },
  });
}

/**
 * 更新屬性的 Mutation
 * 
 * @returns React Query 變更結果
 * 
 * 功能說明：
 * 1. 接收屬性更新資料（路徑參數和請求體）
 * 2. 發送 PUT 請求到 /api/attributes/{id} 端點
 * 3. 支援更新屬性名稱
 * 4. 處理業務邏輯驗證錯誤（如重複名稱檢查）
 * 5. 成功後自動無效化屬性列表快取
 */
export function useUpdateAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { id: number; body: { name: string } }) => {
      const { data, error } = await apiClient.PUT('/api/attributes/{id}', {
        params: { path: { id: variables.id } },
        body: variables.body,
      });
      if (error) { 
        throw new Error(Object.values(error).flat().join('\n') || '更新屬性失敗'); 
      }
      return data;
    },
    onSuccess: () => {
      // 無效化屬性快取，觸發重新獲取更新後的屬性列表
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTRIBUTES });
    },
  });
}

/**
 * 刪除屬性的 Mutation
 * 
 * @returns React Query 變更結果
 * 
 * 功能說明：
 * 1. 接收要刪除的屬性 ID 路徑參數
 * 2. 發送 DELETE 請求到 /api/attributes/{id} 端點
 * 3. 執行刪除操作，會級聯刪除所有相關的屬性值
 * 4. 注意：如果有商品變體正在使用此屬性，刪除可能會失敗
 * 5. 成功後自動無效化屬性列表快取
 */
export function useDeleteAttribute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pathParams: AttributePathParams) => {
      const { error } = await apiClient.DELETE('/api/attributes/{id}', {
        params: { path: pathParams },
      });
      if (error) { 
        throw new Error('刪除屬性失敗'); 
      }
    },
    onSuccess: () => {
      // 無效化屬性快取，觸發重新獲取刪除後的屬性列表
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTRIBUTES });
    },
  });
}

// 導入屬性值管理的精確類型定義
type CreateAttributeValueRequestBody = import('@/types/api').paths["/api/attributes/{attribute_id}/values"]["post"]["requestBody"]["content"]["application/json"];
type UpdateAttributeValueRequestBody = import('@/types/api').paths["/api/values/{id}"]["put"]["requestBody"]["content"]["application/json"];
type AttributeValuePathParams = import('@/types/api').paths["/api/values/{id}"]["get"]["parameters"]["path"];

/**
 * 為指定屬性建立新屬性值的 Mutation
 */
export function useCreateAttributeValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { attributeId: number; body: CreateAttributeValueRequestBody }) => {
      const { data, error } = await apiClient.POST('/api/attributes/{attribute_id}/values', {
        params: { path: { attribute_id: variables.attributeId, attribute: variables.attributeId } },
        body: variables.body,
      });
      if (error) { throw new Error(Object.values(error).flat().join('\n') || '新增選項失敗'); }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTRIBUTES });
    },
  });
}

/**
 * 更新屬性值的 Mutation
 */
export function useUpdateAttributeValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: { valueId: number; body: UpdateAttributeValueRequestBody }) => {
      const { data, error } = await apiClient.PUT('/api/values/{id}', {
        params: { path: { id: variables.valueId, value: variables.valueId } },
        body: variables.body,
      });
      if (error) { throw new Error(Object.values(error).flat().join('\n') || '更新選項失敗'); }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTRIBUTES });
    },
  });
}

/**
 * 刪除屬性值的 Mutation
 */
export function useDeleteAttributeValue() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (valueId: number) => {
      const { error } = await apiClient.DELETE('/api/values/{id}', {
        params: { path: { id: valueId, value: valueId } },
      });
      if (error) { throw new Error('刪除選項失敗'); }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ATTRIBUTES });
    },
  });
}

// ==================== 庫存管理系統 (INVENTORY MANAGEMENT) ====================

/**
 * 獲取庫存列表查詢
 * 
 * 支援多種篩選條件：
 * - 門市篩選
 * - 低庫存警示
 * - 缺貨狀態
 * - 商品名稱搜尋
 * - 分頁控制
 */
export function useInventoryList(params: {
  store_id?: number;
  low_stock?: boolean;
  out_of_stock?: boolean;
  product_name?: string;
  page?: number;
  per_page?: number;
} = {}) {
  return useQuery({
    queryKey: ['inventory', 'list', params],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/inventory', {
        params: { query: params },
      });
      if (error) {
        // 簡化錯誤處理，避免型別問題
        const errorString = String(error);
        if (errorString.includes('401') || errorString.includes('Unauthorized')) {
          throw new Error('請先登入以查看庫存資料');
        }
        throw new Error('獲取庫存列表失敗，請檢查網路連線或稍後再試');
      }
      return data;
    },
    staleTime: 1000 * 60 * 2, // 2 分鐘內保持新鮮（庫存變化較頻繁）
    retry: (failureCount, error) => {
      // 認證錯誤不重試
      if (error.message?.includes('請先登入')) {
        return false;
      }
      return failureCount < 3;
    },
  });
}

/**
 * 獲取單個庫存詳情
 */
export function useInventoryDetail(id: number) {
  return useQuery({
    queryKey: ['inventory', 'detail', id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/inventory/{id}', {
        params: { path: { id: id.toString() } },
      });
      if (error) {
        throw new Error('獲取庫存詳情失敗');
      }
      return data;
    },
    enabled: !!id,
  });
}

/**
 * 庫存調整 Mutation
 * 
 * 支援三種調整模式：
 * - add: 增加庫存
 * - reduce: 減少庫存
 * - set: 設定庫存為指定數量
 */
export function useInventoryAdjustment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (adjustment: {
      product_variant_id: number;
      store_id: number;
      action: 'add' | 'reduce' | 'set';
      quantity: number;
      notes?: string;
      metadata?: Record<string, never> | null;
    }) => {
      const { data, error } = await apiClient.POST('/api/inventory/adjust', {
        body: adjustment,
      });
      if (error) {
        throw new Error('庫存調整失敗');
      }
      return data;
    },
    onSuccess: () => {
      // 無效化所有庫存相關的快取
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

/**
 * 獲取庫存交易歷史
 */
export function useInventoryHistory(params: {
  id: number;
  start_date?: string;
  end_date?: string;
  type?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ['inventory', 'history', params],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/inventory/{id}/history', {
        params: { 
          path: { id: params.id },
          query: {
            start_date: params.start_date,
            end_date: params.end_date,
            type: params.type,
            per_page: params.per_page,
            page: params.page,
          }
        },
      });
      if (error) {
        throw new Error('獲取庫存歷史失敗');
      }
      return data;
    },
    enabled: !!params.id,
  });
}

/**
 * 獲取特定 SKU 的所有庫存歷史記錄
 */
export function useSkuInventoryHistory(params: {
  sku: string;
  store_id?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
  per_page?: number;
  page?: number;
}) {
  return useQuery({
    queryKey: ['inventory', 'sku-history', params],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/inventory/sku/{sku}/history', {
        params: { 
          path: { sku: params.sku },
          query: {
            store_id: params.store_id ? parseInt(params.store_id) : undefined,
            type: params.type,
            start_date: params.start_date,
            end_date: params.end_date,
            per_page: params.per_page,
            page: params.page,
          }
        },
      });
      if (error) {
        throw new Error('獲取 SKU 庫存歷史失敗');
      }
      return data;
    },
    enabled: !!params.sku,
  });
}

// ==================== 庫存轉移管理 (INVENTORY TRANSFERS) ====================

/**
 * 獲取庫存轉移列表
 */
export function useInventoryTransfers(params: {
  from_store_id?: number;
  to_store_id?: number;
  status?: string;
  start_date?: string;
  end_date?: string;
  product_name?: string;
  per_page?: number;
  page?: number;
} = {}) {
  return useQuery({
    queryKey: ['inventory', 'transfers', params],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/inventory/transfers', {
        params: { query: params },
      });
      if (error) {
        throw new Error('獲取庫存轉移列表失敗');
      }
      return data;
    },
  });
}

/**
 * 獲取單個庫存轉移詳情
 */
export function useInventoryTransferDetail(id: number) {
  return useQuery({
    queryKey: ['inventory', 'transfer', id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/inventory/transfers/{id}', {
        params: { path: { id: id.toString() } },
      });
      if (error) {
        throw new Error('獲取庫存轉移詳情失敗');
      }
      return data;
    },
    enabled: !!id,
  });
}

/**
 * 創建庫存轉移
 */
export function useCreateInventoryTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transfer: {
      from_store_id: number;
      to_store_id: number;
      product_variant_id: number;
      quantity: number;
      notes?: string;
      status?: string;
    }) => {
      const { data, error } = await apiClient.POST('/api/inventory/transfers', {
        body: transfer,
      });
      if (error) {
        throw new Error('創建庫存轉移失敗');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'transfers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'list'] });
    },
  });
}

/**
 * 更新庫存轉移狀態
 */
export function useUpdateInventoryTransferStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      id: number;
      status: string;
      notes?: string;
    }) => {
      const { data, error } = await apiClient.PATCH('/api/inventory/transfers/{id}/status', {
        params: { path: { id: params.id } },
        body: { status: params.status, notes: params.notes },
      });
      if (error) {
        throw new Error('更新轉移狀態失敗');
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'transfers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'transfer', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'list'] });
    },
  });
}

/**
 * 取消庫存轉移
 */
export function useCancelInventoryTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: number; reason: string }) => {
      const { data, error } = await apiClient.PATCH('/api/inventory/transfers/{id}/cancel', {
        params: { path: { id: params.id } },
        body: { reason: params.reason },
      });
      if (error) {
        throw new Error('取消庫存轉移失敗');
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'transfers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'transfer', variables.id] });
    },
  });
}

// ==================== 門市管理系統 (STORE MANAGEMENT) ====================

/**
 * 獲取門市列表
 */
export function useStores(params: {
  name?: string;
  status?: string;
  page?: number;
  per_page?: number;
} = {}) {
  return useQuery({
    queryKey: ['stores', params],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/stores');
      if (error) {
        throw new Error('獲取門市列表失敗');
      }
      return data;
    },
    staleTime: 1000 * 60 * 10, // 10 分鐘內保持新鮮（門市資訊變化較少）
  });
}

/**
 * 獲取單個門市詳情
 */
export function useStore(id: number) {
  return useQuery({
    queryKey: ['stores', id],
    queryFn: async () => {
      const { data, error } = await apiClient.GET('/api/stores/{id}', {
        params: { path: { id } },
      });
      if (error) {
        throw new Error('獲取門市詳情失敗');
      }
      return data;
    },
    enabled: !!id,
  });
}

/**
 * 創建門市
 */
export function useCreateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (store: CreateStoreRequest) => {
      const { data, error } = await apiClient.POST('/api/stores', {
        body: store,
      });
      if (error) {
        throw new Error('創建門市失敗');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
}

/**
 * 更新門市
 */
export function useUpdateStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: number; data: UpdateStoreRequest }) => {
      const { data, error } = await apiClient.PUT('/api/stores/{id}', {
        params: { path: { id: params.id } },
        body: params.data,
      });
      if (error) {
        throw new Error('更新門市失敗');
      }
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      queryClient.invalidateQueries({ queryKey: ['stores', variables.id] });
    },
  });
}

/**
 * 刪除門市
 */
export function useDeleteStore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await apiClient.DELETE('/api/stores/{id}', {
        params: { path: { id } },
      });
      if (error) {
        throw new Error('刪除門市失敗');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
    },
  });
}

// ==================== 商品變體管理 (PRODUCT VARIANTS) ====================

/**
 * 獲取商品變體列表
 */
export function useProductVariants(params: {
  product_id?: number;
  product_name?: string;
  sku?: string;
  page?: number;
  per_page?: number;
} = {}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['product-variants', params],
    queryFn: async () => {
      try {
        const response = await apiClient.GET('/api/products/variants', {
          params: { query: params },
        });
      }
    },
    onError: (error) => {
      // 🔴 錯誤處理 - 友善的錯誤訊息
      const errorMessage = parseApiErrorMessage(error);
      if (typeof window !== 'undefined') {
        const { toast } = require('sonner');
        toast.error('更新失敗', { description: errorMessage });
      }
    },
  });
}

// ==================== 進貨管理系統 (PURCHASE MANAGEMENT) ====================

/**
 * 進貨管理相關類型定義
 */
export interface PurchaseItemRequest {
  product_variant_id: number;
  quantity: number;
  unit_price: number;
  cost_price: number;
}

export interface PurchaseRequest {
  store_id: number;
  order_number: string;
  purchased_at?: string;
  shipping_cost: number;
  items: PurchaseItemRequest[];
}

/**
 * 創建進貨單
 */
export function useCreatePurchase() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (purchaseData: PurchaseRequest) => {
      const { data, error } = await apiClient.POST('/api/purchases', {
        body: purchaseData as any, // 暫時使用 any 來繞過型別錯誤
      });
      
      if (error) {
        throw new Error(parseApiErrorMessage(error));
      }
      
      return data;
    },
    onSuccess: () => {
      // 刷新庫存資料
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['product-variants'] });
    },
  });
}