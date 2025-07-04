import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/apiClient';
import { parseApiError } from '@/lib/errorHandler';
import { ProductFilters, ProductItem, ProductVariant } from '@/types/api-helpers';
import { QUERY_KEYS } from '../shared/queryKeys';

/**
 * API Hooks - 商品管理
 * 使用生成的 API 類型定義進行類型安全的資料操作
 */

/**
 * 商品列表查詢 Hook - 架構升級版（標準化作戰單位 #2）
 * 
 * 功能特性：
 * 1. 支援完整的後端篩選參數（product_name, store_id, category_id, low_stock, out_of_stock）
 * 2. 智能查詢鍵結構，支援所有篩選參數的精確緩存
 * 3. 向後相容舊版 search 參數
 * 4. 高效能緩存策略，減少不必要的 API 請求
 * 5. 🎯 資料精煉廠 - 在源頭處理所有數據轉換和類型安全
 * 6. 🚫 根除 any 類型 - 確保產品數據的純淨契約
 * 
 * @param filters - 篩選參數物件，包含所有可用的篩選條件
 * @returns React Query 查詢結果，返回處理乾淨、類型完美的 ProductItem 陣列
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
            // 修正：使用 Spatie QueryBuilder 的格式
            if (filters.search) queryParams['filter[search]'] = filters.search;
            if (filters.page !== undefined) queryParams.page = filters.page;
            if (filters.per_page !== undefined) queryParams.per_page = filters.per_page;

            const { data, error } = await apiClient.GET('/api/products', {
                params: { 
                    query: Object.keys(queryParams).length > 0 ? queryParams : undefined 
                }
            });
            
            if (error) {
                const errorMessage = parseApiError(error);
                throw new Error(errorMessage || '獲取商品列表失敗');
            }

            // queryFn 依然返回完整的 response，數據轉換交給 select 處理
            return data;
        },
        
        // 🎯 數據精煉廠 - 商品數據的完美轉換
        select: (response: any) => {
            // 1. 解包：處理分頁或普通陣列數據結構
            const products = response?.data?.data || response?.data || [];
            if (!Array.isArray(products)) return [];

            // 2. 進行所有必要的數據轉換和類型安全處理
            return products.map((apiProduct: any) => ({
                // 📋 基本商品資訊
                id: apiProduct.id || 0,
                name: apiProduct.name || '未命名商品',
                description: apiProduct.description || null,
                category_id: apiProduct.category_id || null,
                created_at: apiProduct.created_at || '',
                updated_at: apiProduct.updated_at || '',
                
                // 🖼️ 圖片處理 - 確保圖片 URL 的完整性
                image_urls: apiProduct.image_urls ? {
                    original: apiProduct.image_urls.original || null,
                    thumb: apiProduct.image_urls.thumb || null,
                    medium: apiProduct.image_urls.medium || null,
                    large: apiProduct.image_urls.large || null,
                } : null,
                
                // 🏷️ 分類資訊處理（雙格式支援）
                category: apiProduct.category ? {
                    id: apiProduct.category.id || 0,
                    name: apiProduct.category.name || '未分類',
                    description: apiProduct.category.description || null,
                } : null,
                
                // 🎯 向前相容：為 ProductSelector 等元件提供簡化格式
                categoryName: apiProduct.category?.name || '未分類', // 字串格式的分類名稱
                mainImageUrl: (apiProduct.image_urls?.original || 'https://via.placeholder.com/300x300').replace('localhost', '127.0.0.1'), // 主圖 URL - 替換為 IPv4
                
                // 🎯 變體(SKU)數據的深度清理
                variants: apiProduct.variants?.map((variant: any) => {
                    // 處理屬性值
                    const attributeValues = variant.attribute_values?.map((attrValue: any) => ({
                        id: attrValue.id || 0,
                        value: attrValue.value || '',
                        attribute_id: attrValue.attribute_id || 0,
                        attribute: attrValue.attribute ? {
                            id: attrValue.attribute.id || 0,
                            name: attrValue.attribute.name || '',
                        } : null,
                    })) || [];
                    
                    // 處理庫存
                    const inventoryList = variant.inventory?.map((inv: any) => ({
                        id: inv.id || 0,
                        quantity: parseInt(inv.quantity || '0', 10), // 字串轉整數
                        low_stock_threshold: parseInt(inv.low_stock_threshold || '0', 10),
                        store: inv.store ? {
                            id: inv.store.id || 0,
                            name: inv.store.name || '未知門市',
                        } : null,
                    })) || [];
                    
                    // 計算總庫存
                    const totalStock = inventoryList.reduce((sum: number, inv: any) => sum + inv.quantity, 0);
                    
                    // 組合規格描述
                    const specifications = attributeValues
                        .map((av: any) => av.value)
                        .filter(Boolean)
                        .join(' / ') || '標準規格';
                    
                    return {
                        id: variant.id || 0,
                        sku: variant.sku || 'N/A',
                        price: parseFloat(variant.price || '0'), // 字串轉數值
                        product_id: variant.product_id || apiProduct.id,
                        created_at: variant.created_at || '',
                        updated_at: variant.updated_at || '',
                        // 如果變體有自己的圖片，也進行 URL 替換
                        imageUrl: variant.image_url ? variant.image_url.replace('localhost', '127.0.0.1') : undefined,
                        
                        // 為 ProductSelector 添加必要欄位
                        specifications: specifications,
                        stock: totalStock,
                        productName: apiProduct.name, // 添加商品名稱到變體中
                        
                        // 保留原始數據
                        attribute_values: attributeValues,
                        inventory: inventoryList,
                    };
                }) || [],
                
                // 💰 價格範圍統計（基於變體價格計算）
                price_range: (() => {
                    const prices = apiProduct.variants?.map((v: any) => parseFloat(v.price || '0')).filter((p: number) => p > 0) || [];
                    if (prices.length === 0) return { min: 0, max: 0, count: 0 };
                    
                    return {
                        min: Math.min(...prices),
                        max: Math.max(...prices),
                        count: prices.length,
                    };
                })(),
                
                // 🏷️ 屬性列表處理
                attributes: apiProduct.attributes?.map((attr: any) => ({
                    id: attr.id || 0,
                    name: attr.name || '',
                    type: attr.type || '',
                    description: attr.description || null,
                })) || [],
            }));
        },
        
        // 🚀 體驗優化配置
        placeholderData: (previousData) => previousData, // 篩選時保持舊資料，避免載入閃爍
        refetchOnMount: false,       // 依賴全域 staleTime
        refetchOnWindowFocus: false, // 後台管理系統不需要窗口聚焦刷新
        staleTime: 1 * 60 * 1000,   // 1 分鐘緩存，平衡體驗與資料新鮮度
        retry: 2, // 失敗時重試 2 次
    });
}

/**
 * 處理過的商品數據結構 - 保證類型完整性（零容忍版本）
 */
export interface ProcessedProduct {
    id: number;
    name: string;
    description: string | null;
    category_id: number | null;
    category?: any;
    attributes: Array<ProcessedProductAttribute>;
    variants: Array<ProcessedProductVariant>;
    image_url?: string;
    thumbnail_url?: string;
    has_image: boolean;
    image_urls?: any;
    created_at: string;
    updated_at: string;
    [key: string]: any;
}

/**
 * 商品屬性類型定義
 */
export interface ProcessedProductAttribute {
    id: number;
    name: string;
    [key: string]: any;
}

/**
 * 商品變體類型定義
 */
export interface ProcessedProductVariant {
    id: number;
    sku: string;
    price: number;
    attribute_values?: Array<ProcessedProductAttributeValue>;
    [key: string]: any;
}

/**
 * 屬性值類型定義
 */
export interface ProcessedProductAttributeValue {
    id: number;
    attribute_id: number;
    value: string;
    [key: string]: any;
}

/**
 * 商品詳情查詢 Hook - 權威數據源（已統一）
 * 
 * 🚀 此 Hook 是獲取商品詳情的唯一權威來源，提供完整且類型安全的商品資訊：
 * 1. SPU 基本資訊 (name, description, category)
 * 2. 商品屬性列表 (attributes) - 總是包含
 * 3. 所有 SKU 變體詳情 (variants with attribute values) - 總是包含
 * 4. 圖片資訊 (image_urls, has_image)
 * 5. 完整的類型安全保證
 * 
 * @param productId - 商品 ID
 * @returns React Query 查詢結果，返回 ProcessedProduct 類型
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
                const errorMessage = parseApiError(error);
                throw new Error(errorMessage || '獲取商品詳情失敗');
            }

            return data;
        },
        // 🎯 數據精煉廠 - 確保類型完整性和數據一致性
        select: (response: any): ProcessedProduct | null => {
            const rawProduct = response?.data;
            
            if (!rawProduct) {
                return null; // 返回 null 而不是拋出錯誤，讓組件層處理
            }
            
            // 確保 attributes 總是存在且為陣列
            const attributes = Array.isArray(rawProduct.attributes) 
                ? rawProduct.attributes 
                : [];
            
            // 確保 variants 總是存在且為陣列
            const variants = Array.isArray(rawProduct.variants) 
                ? rawProduct.variants 
                : [];
            
            // 返回完整且類型安全的商品數據
            return {
                id: rawProduct.id || 0,
                name: rawProduct.name || '',
                description: rawProduct.description || null,
                category_id: rawProduct.category_id || null,
                category: rawProduct.category,
                attributes: attributes.map((attr: unknown): ProcessedProductAttribute => {
                    const a = attr as Record<string, any>;
                    return {
                        id: a?.id || 0,
                        name: a?.name || '',
                        ...a
                    };
                }),
                variants: variants.map((variant: unknown): ProcessedProductVariant => {
                    const v = variant as Record<string, any>;
                    return {
                        id: v?.id || 0,
                        sku: v?.sku || '',
                        price: v?.price || 0,
                        attribute_values: Array.isArray(v?.attribute_values) 
                            ? v.attribute_values.map((av: unknown): ProcessedProductAttributeValue => {
                                const a = av as Record<string, any>;
                                return {
                                    id: a?.id || 0,
                                    attribute_id: a?.attribute_id || 0,
                                    value: a?.value || '',
                                    ...a
                                };
                            })
                            : [],
                        ...v
                    };
                }),
                image_url: rawProduct.image_url,
                thumbnail_url: rawProduct.thumbnail_url,
                has_image: rawProduct.has_image || false,
                image_urls: rawProduct.image_urls,
                created_at: rawProduct.created_at || '',
                updated_at: rawProduct.updated_at || '',
                ...rawProduct
            };
        },
        enabled: !!numericId, // 只有當有效的 ID 存在時才執行查詢
        staleTime: 5 * 60 * 1000, // 5 分鐘緩存時間，編輯期間避免重複請求
        retry: 2, // 失敗時重試 2 次
    });
}

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
                const errorMessage = parseApiError(error);
                throw new Error(errorMessage);
            }
            
            return data;
        },
        onSuccess: async (data: { data?: { name?: string } }) => {
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
                const errorMessage = parseApiError(error);
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
                // 使用統一的錯誤解析器
                const errorMessage = parseApiError(error) || '刪除商品失敗';
                throw new Error(errorMessage);
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
                }),
                // 3. 移除特定商品的快取
                queryClient.removeQueries({ queryKey: QUERY_KEYS.PRODUCT(id) })
            ]);
            
            // 顯示成功訊息
            if (typeof window !== 'undefined') {
                const { toast } = require('sonner');
                toast.success('商品刪除成功！', {
                    description: '商品已成功刪除，商品列表已自動更新。'
                });
            }
        },
        onError: (error) => {
            // 錯誤處理並顯示錯誤訊息
            if (typeof window !== 'undefined') {
                const { toast } = require('sonner');
                toast.error('商品刪除失敗', {
                    description: error.message || '請檢查並重試。'
                });
            }
        },
    });
}

/**
 * 批量刪除商品的 Hook
 * 
 * @returns React Query 變更結果
 */
export function useDeleteMultipleProducts() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: { ids: number[] }) => {
            const { data, error } = await apiClient.DELETE('/api/products/batch' as any, {
                body: payload
            } as any);
            
            if (error) {
                const errorMessage = parseApiError(error);
                throw new Error(errorMessage || '批量刪除商品失敗');
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
            
            // 顯示成功訊息
            if (typeof window !== 'undefined') {
                const { toast } = require('sonner');
                toast.success('批量刪除成功！', {
                    description: `已成功刪除 ${data?.data?.deleted_count || 0} 個商品。`
                });
            }
        },
        onError: (error) => {
            // 錯誤處理並顯示錯誤訊息
            if (typeof window !== 'undefined') {
                const { toast } = require('sonner');
                toast.error('批量刪除失敗', {
                    description: error.message || '請檢查並重試。'
                });
            }
        },
    });
}

/**
 * 商品變體查詢 Hook
 * 
 * @param params - 查詢參數
 * @param options - 查詢選項
 * @returns React Query 查詢結果
 */
export function useProductVariants(params: {
    product_id?: number;
    product_name?: string;
    sku?: string;
    page?: number;
    per_page?: number;
} = {}, options?: { enabled?: boolean }) {
    return useQuery({
        queryKey: [...QUERY_KEYS.PRODUCT_VARIANTS, params],
        queryFn: async () => {
            // 構建查詢參數
            const queryParams: Record<string, any> = {};
            
            if (params.product_id) queryParams.product_id = params.product_id;
            if (params.product_name) queryParams.product_name = params.product_name;
            if (params.sku) queryParams.sku = params.sku;
            if (params.page) queryParams.page = params.page;
            if (params.per_page) queryParams.per_page = params.per_page;

            const { data, error } = await apiClient.GET('/api/product-variants' as any, {
                params: { 
                    query: Object.keys(queryParams).length > 0 ? queryParams : undefined 
                }
            } as any);
            
            if (error) {
                const errorMessage = parseApiError(error);
                throw new Error(errorMessage || '獲取商品變體失敗');
            }

            return data;
        },
        enabled: options?.enabled !== false,
        staleTime: 2 * 60 * 1000, // 2 分鐘緩存時間
        retry: 2,
    });
}

/**
 * 商品變體詳情查詢 Hook
 * 
 * @param id - 變體 ID
 * @returns React Query 查詢結果
 */
export function useProductVariantDetail(id: number) {
    return useQuery({
        queryKey: [...QUERY_KEYS.PRODUCT_VARIANT(id), 'detail'],
        queryFn: async () => {
            const { data, error } = await apiClient.GET('/api/product-variants/{id}' as any, {
                params: { path: { id } }
            } as any);
            
            if (error) {
                const errorMessage = parseApiError(error);
                throw new Error(errorMessage || '獲取變體詳情失敗');
            }

            return data;
        },
        staleTime: 5 * 60 * 1000, // 5 分鐘緩存時間
        retry: 2,
    });
}

/**
 * 商品圖片上傳 Hook
 * 
 * @returns React Query 變更結果
 */
type UploadProductImagePayload = {
    productId: number;
    image: File;
};

export function useUploadProductImage() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ productId, image }: UploadProductImagePayload) => {
            const formData = new FormData();
            formData.append('image', image);

            const { data, error } = await apiClient.POST('/api/products/{id}/image' as any, {
                params: { path: { id: productId } },
                body: formData
            } as any);
            
            if (error) {
                const errorMessage = parseApiError(error);
                throw new Error(errorMessage || '上傳圖片失敗');
            }
            
            return data;
        },
        onSuccess: async (data, variables) => {
            // 失效相關的快取
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCT(variables.productId) }),
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PRODUCTS })
            ]);
            
            // 顯示成功訊息
            if (typeof window !== 'undefined') {
                const { toast } = require('sonner');
                toast.success('圖片上傳成功！', {
                    description: '商品圖片已更新。'
                });
            }
        },
        onError: (error) => {
            // 錯誤處理並顯示錯誤訊息
            if (typeof window !== 'undefined') {
                const { toast } = require('sonner');
                toast.error('圖片上傳失敗', {
                    description: error.message || '請檢查圖片格式並重試。'
                });
            }
        },
    });
} 