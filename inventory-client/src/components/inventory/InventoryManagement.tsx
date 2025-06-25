"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useProducts,
  useStores,
  useCategories,
  useInventoryList,
} from "@/hooks/queries/useEntityQueries";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/use-toast";
import { InventoryNestedTable } from "@/components/inventory/InventoryNestedTable";
import { ProductFilters } from "@/types/api-helpers";
import { CategoryNode } from "@/hooks/queries/useEntityQueries";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RotateCw as RefreshIcon,
  Search,
  AlertCircle,
  LogIn,
  Store,
  Tag,
  AlertTriangle,
  PackageX,
  Package,
} from "lucide-react";

import Link from "next/link";
import { InventoryPagination } from "./InventoryPagination";

export function InventoryManagement() {
  const { toast } = useToast();
  const router = useRouter();

  // 篩選器狀態管理
  const [filters, setFilters] = useState<ProductFilters>({});
  const [productNameInput, setProductNameInput] = useState("");
  const [page, setPage] = useState(1);

  // 使用 debounce 優化商品名稱搜尋
  const debouncedProductName = useDebounce(productNameInput, 300);

  // 將 debounced 值同步到 filters
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      product_name: debouncedProductName || undefined,
    }));
  }, [debouncedProductName]);

  // 獲取基礎資料
  const { data: storesResponse, isLoading: isLoadingStores } = useStores();
  const { data: categoriesResponse, isLoading: isLoadingCategories } =
    useCategories();

  // 🎯 標準化數據獲取 - 統一處理 API 回傳的結構化資料
  const stores = storesResponse?.data ?? [];
  const categories = categoriesResponse ?? [];

  // 獲取庫存列表數據
  const {
    data: inventoryData,
    isLoading: isLoadingInventory,
    error: inventoryError,
    refetch: refetchInventory,
  } = useInventoryList({
    store_id: filters.store_id,
    low_stock: filters.low_stock,
    out_of_stock: filters.out_of_stock,
    product_name: filters.product_name,
    page,
    per_page: 15,
  });

  const paginationMeta = inventoryData?.meta;

  const handleRefresh = () => {
    refetchInventory();
    toast({
      title: "重新整理",
      description: "已重新載入庫存資料",
    });
  };

  /**
   * 處理門市篩選變更
   */
  const handleStoreChange = (value: string) => {
    const storeId = value === "all" ? undefined : parseInt(value);
    setFilters((prev) => ({
      ...prev,
      store_id: storeId,
    }));
  };

  /**
   * 處理分類篩選變更
   */
  const handleCategoryChange = (value: string) => {
    const categoryId = value === "all" ? undefined : parseInt(value);
    setFilters((prev) => ({
      ...prev,
      category_id: categoryId,
    }));
  };

  /**
   * 處理低庫存篩選變更
   */
  const handleLowStockChange = (checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      low_stock: checked || undefined,
    }));
  };

  /**
   * 處理缺貨篩選變更
   */
  const handleOutOfStockChange = (checked: boolean) => {
    setFilters((prev) => ({
      ...prev,
      out_of_stock: checked || undefined,
    }));
  };

  /**
   * 重置所有篩選器
   */
  const handleResetFilters = () => {
    setFilters({});
    setProductNameInput("");
  };

  /**
   * 處理商品管理操作
   * @param spuId - 商品 SPU ID
   */
  const handleManageProduct = (spuId: number) => {
    router.push(`/products/${spuId}/edit`);
  };

  /**
   * 處理庫存調整操作
   * @param skuId - SKU ID (變體 ID)
   * @param currentQuantity - 當前庫存數量
   *
   * 現在庫存修改功能已整合到表格中，此函數主要用於資料刷新
   */
  const handleAdjustInventory = (skuId: number, currentQuantity: number) => {
    // 刷新庫存資料
    refetchInventory();
  };

  /**
   * 計算當前篩選器的數量
   */
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.product_name) count++;
    if (filters.store_id) count++;
    if (filters.category_id) count++;
    if (filters.low_stock) count++;
    if (filters.out_of_stock) count++;
    return count;
  };

  // 顯示錯誤狀態
  if (inventoryError) {
    return (
      <div className="space-y-6 p-6" data-oid=".-04wmz">
        {/* 頁面標題區 */}
        <div className="flex flex-col space-y-2" data-oid="h0.7:o3">
          <h1 className="text-2xl font-bold" data-oid="2og_gvh">
            庫存管理
          </h1>
          <p className="text-muted-foreground" data-oid="3rsitfz">
            管理商品庫存數量、監控庫存水位和處理庫存調整
          </p>
        </div>

        <Alert className="mt-4" data-oid="_dvaktu">
          <AlertCircle className="h-4 w-4" data-oid="7wl_3qn" />
          <AlertTitle data-oid="yj7d:ig">載入失敗</AlertTitle>
          <AlertDescription
            className="flex items-center justify-between"
            data-oid="dm6s8jn"
          >
            <span data-oid="lre6tkz">無法載入庫存資料，請稍後再試</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              className="ml-4"
              data-oid="tr1:oni"
            >
              <RefreshIcon className="h-4 w-4 mr-2" data-oid="350ebr1" />
              重試
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" data-oid="d5vc2p0">
      {/* 頁面標題區 */}
      <div
        className="flex items-center justify-between mb-6"
        data-oid="8ntuvk5"
      >
        <div data-oid="9v7p4:8">
          <h1 className="text-2xl font-bold" data-oid="yi:vye.">
            庫存管理
          </h1>
          <p className="text-muted-foreground" data-oid="j0pbezg">
            管理商品庫存數量、監控庫存水位和處理庫存調整
          </p>
        </div>
      </div>

      {/* 篩選器區域 */}
      <Card data-oid="-ko-b5r">
        <CardHeader data-oid=":0dz7b:">
          <CardTitle className="flex items-center gap-2" data-oid="_g5h1:0">
            <Search className="h-5 w-5" data-oid="qbrt94w" />
            篩選器
            {getActiveFiltersCount() > 0 && (
              <Badge variant="secondary" className="ml-2" data-oid="ahsj:i:">
                {getActiveFiltersCount()} 項篩選
              </Badge>
            )}
          </CardTitle>
          <CardDescription data-oid="lczn_kn">
            使用以下篩選器來精確查找您需要的商品和庫存資訊
          </CardDescription>
        </CardHeader>
        <CardContent data-oid="m-i453r">
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
            data-oid="xu851gi"
          >
            {/* 商品名稱搜尋 */}
            <div className="space-y-2" data-oid="awo.bmp">
              <label
                className="text-sm font-medium flex items-center gap-2"
                data-oid="cv1.l8u"
              >
                <Search className="h-4 w-4" data-oid="5vz5jvc" />
                商品名稱
              </label>
              <Input
                placeholder="搜尋商品名稱..."
                value={productNameInput}
                onChange={(e) => setProductNameInput(e.target.value)}
                className="w-full"
                data-oid="ol5lohz"
              />
            </div>

            {/* 門市篩選 */}
            <div className="space-y-2" data-oid="fn4-8om">
              <label
                className="text-sm font-medium flex items-center gap-2"
                data-oid="x339gfg"
              >
                <Store className="h-4 w-4" data-oid="d-bc-l2" />
                門市
              </label>
              <Select
                value={filters.store_id?.toString() || "all"}
                onValueChange={handleStoreChange}
                data-oid="2b4ipyv"
              >
                <SelectTrigger data-oid=":3kj_:6">
                  <SelectValue placeholder="選擇門市" data-oid="ur5q_7u" />
                </SelectTrigger>
                <SelectContent data-oid="pbs_opi">
                  <SelectItem value="all" data-oid="g2w0aoi">
                    所有門市
                  </SelectItem>
                  {stores.map((store) => (
                    <SelectItem
                      key={store.id}
                      value={store.id?.toString() || ""}
                      data-oid="zs0ri06"
                    >
                      {store.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 分類篩選 */}
            <div className="space-y-2" data-oid="hn9q688">
              <label
                className="text-sm font-medium flex items-center gap-2"
                data-oid="xhr.asm"
              >
                <Tag className="h-4 w-4" data-oid="yw4e_oa" />
                分類
              </label>
              <Select
                value={filters.category_id?.toString() || "all"}
                onValueChange={handleCategoryChange}
                data-oid="6.7sgxe"
              >
                <SelectTrigger data-oid="skz0cto">
                  <SelectValue placeholder="選擇分類" data-oid="xdh:lkv" />
                </SelectTrigger>
                <SelectContent data-oid="0nyo-y:">
                  <SelectItem value="all" data-oid="h02dvk4">
                    所有分類
                  </SelectItem>
                  {categories.map((category) => (
                    <SelectItem
                      key={category.id}
                      value={category.id?.toString() || ""}
                      data-oid="lo3fmg7"
                    >
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 低庫存篩選 */}
            <div className="space-y-2" data-oid="3vfj3_l">
              <label
                className="text-sm font-medium flex items-center gap-2"
                data-oid="lv4dpdh"
              >
                <AlertTriangle className="h-4 w-4" data-oid="o1b_swm" />
                庫存狀態
              </label>
              <div className="flex items-center space-x-2" data-oid="udzjsj0">
                <Checkbox
                  id="low-stock"
                  checked={!!filters.low_stock}
                  onCheckedChange={handleLowStockChange}
                  data-oid="82bg.3i"
                />

                <label
                  htmlFor="low-stock"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  data-oid="jmkvdhq"
                >
                  低庫存
                </label>
              </div>
            </div>

            {/* 缺貨篩選 */}
            <div className="space-y-2" data-oid="zk6h.qf">
              <label
                className="text-sm font-medium flex items-center gap-2"
                data-oid="1xmfu.g"
              >
                <PackageX className="h-4 w-4" data-oid="qif.aws" />
                缺貨狀態
              </label>
              <div className="flex items-center space-x-2" data-oid="g4-2g5c">
                <Checkbox
                  id="out-of-stock"
                  checked={!!filters.out_of_stock}
                  onCheckedChange={handleOutOfStockChange}
                  data-oid="p778bd0"
                />

                <label
                  htmlFor="out-of-stock"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  data-oid="uoay6l5"
                >
                  缺貨
                </label>
              </div>
            </div>
          </div>

          {/* 操作按鈕區域 */}
          <div
            className="flex items-center justify-between pt-4"
            data-oid="952wb:t"
          >
            <div className="flex items-center gap-2" data-oid="6tk-hsw">
              <Button
                variant="outline"
                onClick={handleResetFilters}
                data-oid="pe18o71"
              >
                重置篩選
              </Button>
              <Button
                variant="outline"
                onClick={handleRefresh}
                data-oid="sc88spa"
              >
                <RefreshIcon className="h-4 w-4 mr-2" data-oid="i2_d.pi" />
                重新整理
              </Button>
            </div>
            {getActiveFiltersCount() > 0 && (
              <p className="text-sm text-muted-foreground" data-oid="avra.yf">
                找到 {inventoryData?.data?.length || 0} 筆結果
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 商品庫存明細 */}
      <Card data-oid="6m-s12y">
        <CardHeader data-oid="1b.mpwi">
          <CardTitle className="flex items-center gap-2" data-oid="yr8w9zn">
            <Package className="h-5 w-5" data-oid="0gghjwx" />
            商品庫存明細
          </CardTitle>
          <CardDescription data-oid="l1ty3fw">
            按商品分組顯示庫存詳情，支援展開查看各變體的庫存狀況
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0" data-oid="nbsrwna">
          {inventoryError ? (
            <div className="p-6" data-oid="zytsa-l">
              <Alert data-oid="xblfd-d">
                <AlertCircle className="h-4 w-4" data-oid="d8-ozi0" />
                <AlertTitle data-oid="ojqqcwl">載入失敗</AlertTitle>
                <AlertDescription
                  className="flex items-center justify-between"
                  data-oid="l91jjp1"
                >
                  <span data-oid="57gksr0">無法載入庫存資料</span>
                  <Button asChild size="sm" className="ml-4" data-oid="o6e2gev">
                    <Link href="/login" data-oid="sveznxy">
                      <LogIn className="h-4 w-4 mr-2" data-oid="j5f66fa" />
                      立即登入
                    </Link>
                  </Button>
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <InventoryNestedTable
              data={inventoryData?.data || []}
              isLoading={isLoadingInventory}
              onAdjustInventory={handleAdjustInventory}
              onManageProduct={handleManageProduct}
              data-oid="w_tbq6_"
            />
          )}
        </CardContent>
        {inventoryData?.meta && (
          <CardFooter
            className="flex items-center justify-center border-t pt-6"
            data-oid="32-0k6p"
          >
            <InventoryPagination
              meta={{
                current_page: inventoryData.meta.current_page || 1,
                last_page: inventoryData.meta.last_page || 1,
                per_page: inventoryData.meta.per_page || 15,
                total: inventoryData.meta.total || 0,
              }}
              onPageChange={setPage}
              data-oid="ws-kry5"
            />
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
