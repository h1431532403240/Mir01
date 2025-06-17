'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, CheckCircle, Circle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

// 導入 API Hooks
import { useCreateProduct, useUpdateProduct, useProductDetail, useAttributes } from '@/hooks/queries/useEntityQueries';

// 導入步驟組件
import { 
  Step1_BasicInfo, 
  Step2_DefineSpecs, 
  Step3_ConfigureVariants, 
  Step4_Review 
} from './wizard-steps';

// 導入 API 類型
import type { paths } from '@/types/api';

/**
 * 嚮導表單資料完整結構
 */
export interface WizardFormData {
  // 步驟1：基本資訊
  basicInfo: {
    name: string;
    description: string;
    category_id: number | null;
  };
  
  // 步驟2：規格定義
  specifications: {
    isVariable: boolean;
    selectedAttributes: number[];
    attributeValues: Record<number, string[]>;
  };
  
  // 步驟3：變體配置
  variants: {
    items: Array<{
      key: string;
      options: { attributeId: number; value: string }[];
      sku: string;
      price: string;
    }>;
  };
  
  // 步驟4：確認資訊
  confirmation: {
    reviewed: boolean;
  };
}

/**
 * 步驟配置定義
 */
const STEPS = [
  {
    id: 1,
    title: '基本資訊',
    description: '商品名稱、描述、分類',
    icon: '📋'
  },
  {
    id: 2,
    title: '規格定義',
    description: '屬性選擇與規格管理',
    icon: '⚙️'
  },
  {
    id: 3,
    title: '設定變體',
    description: 'SKU 變體與價格配置',
    icon: '🏷️'
  },
  {
    id: 4,
    title: '預覽確認',
    description: '最終確認與提交',
    icon: '✅'
  }
];

/**
 * 數據轉換函數：將嚮導表單資料轉換為 API 請求格式
 * 
 * @param formData - 嚮導表單資料
 * @param attributesData - 屬性資料（用於屬性值ID映射）
 * @returns API 請求體格式的資料
 */
function transformWizardDataToApiPayload(
  formData: WizardFormData, 
  attributesData?: any
): paths['/api/products']['post']['requestBody']['content']['application/json'] {
  const { basicInfo, specifications, variants } = formData;

  // 如果是單規格商品，創建一個預設變體
  if (!specifications.isVariable) {
    return {
      name: basicInfo.name,
      description: basicInfo.description || null,
      category_id: basicInfo.category_id,
      attributes: [], // 單規格商品沒有屬性
      variants: [{
        sku: `${basicInfo.name.replace(/\s+/g, '-').toUpperCase()}-001`,
        price: 0, // 預設價格，用戶需要後續設定
        attribute_value_ids: []
      }]
    };
  }

  // 多規格商品：需要映射屬性值名稱到ID
  const transformedVariants = variants.items.map(variant => {
    const attributeValueIds: number[] = [];
    
    // 遍歷變體的每個選項，找到對應的屬性值ID
    variant.options.forEach(option => {
      const attribute = attributesData?.data?.find((attr: any) => attr.id === option.attributeId);
      if (attribute) {
        const attributeValue = attribute.values?.find((val: any) => val.value === option.value);
        if (attributeValue) {
          attributeValueIds.push(attributeValue.id);
        }
      }
    });

    return {
      sku: variant.sku,
      price: parseFloat(variant.price) || 0,
      attribute_value_ids: attributeValueIds
    };
  });

  return {
    name: basicInfo.name,
    description: basicInfo.description || null,
    category_id: basicInfo.category_id,
    attributes: specifications.selectedAttributes,
    variants: transformedVariants
  };
}

/**
 * 商品創建/編輯嚮導主組件 Props
 */
interface CreateProductWizardProps {
  /** 商品 ID - 如果提供則為編輯模式，否則為創建模式 */
  productId?: string | number;
}

/**
 * 商品創建/編輯嚮導主組件
 * 
 * 功能特色：
 * - 多步驟流程管理
 * - 進度視覺化指示器  
 * - 支持創建與編輯兩種模式
 * - 步驟間資料傳遞
 * - 表單驗證與導航控制
 * - 統一的用戶體驗流程
 * - 真實 API 整合
 * 
 * @param productId - 商品 ID（編輯模式時使用）
 */
export function CreateProductWizard({ productId }: CreateProductWizardProps = {}) {
  const router = useRouter();
  
  // 判斷是否為編輯模式
  const isEditMode = !!productId;
  
  // API Hooks
  const createProductMutation = useCreateProduct();
  const updateProductMutation = useUpdateProduct();
  const { data: attributesData } = useAttributes();
  
  // 編輯模式：獲取商品詳情
  const { 
    data: productDetail, 
    isLoading: isLoadingProduct,
    error: productError 
  } = useProductDetail(productId);
  
  // 核心狀態：當前步驟
  const [step, setStep] = useState(1);
  
  // 核心狀態：嚮導表單資料聚合
  const [formData, setFormData] = useState<WizardFormData>({
    basicInfo: {
      name: '',
      description: '',
      category_id: null,
    },
    specifications: {
      isVariable: false,
      selectedAttributes: [],
      attributeValues: {},
    },
    variants: {
      items: [],
    },
    confirmation: {
      reviewed: false,
    },
  });
  
  // 提交狀態（使用 mutation 的 isPending 狀態）
  const isSubmitting = createProductMutation.isPending || updateProductMutation.isPending;

  /**
   * 編輯模式：當商品數據加載完成後，預填表單數據
   */
  useEffect(() => {
    if (isEditMode && productDetail?.data) {
      const product = productDetail.data;
      
      // 判斷是否為多規格商品（有屬性或有多個變體）
      const hasAttributes = product.attributes && product.attributes.length > 0;
      const hasMultipleVariants = product.variants && product.variants.length > 1;
      const hasAttributeValues = product.variants?.some(variant => 
        variant.attribute_values && variant.attribute_values.length > 0
      ) || false;
      const isVariable = hasAttributes || hasMultipleVariants || hasAttributeValues;
      
      // 建構屬性值映射（用於變體配置）
      const attributeValues: Record<number, string[]> = {};
      
      if (hasAttributes && product.variants && product.attributes) {
        // 遍歷每個屬性，收集所有可能的屬性值
        product.attributes.forEach((attr: any) => {
          const values = new Set<string>();
          
          // 從現有變體中提取屬性值
          product.variants?.forEach((variant: any) => {
            if (variant.attribute_values) {
              variant.attribute_values.forEach((attrVal: any) => {
                if (attrVal.attribute_id === attr.id) {
                  values.add(attrVal.value);
                }
              });
            }
          });
          
          attributeValues[attr.id] = Array.from(values);
        });
      }
      
      // 建構變體配置數據
      const variantItems = product.variants?.map((variant: any, index: number) => {
        // 從屬性值中建構選項
        const options = variant.attribute_values?.map((attrVal: any) => ({
          attributeId: attrVal.attribute_id,
          value: attrVal.value
        })) || [];
        
        // 確保價格正確轉換：如果有價格就使用實際價格，否則為空字符串
        const priceValue = variant.price !== null && variant.price !== undefined 
          ? variant.price.toString() 
          : '';
        
        return {
          key: `variant-${index}`,
          options,
          sku: variant.sku || '',
          price: priceValue
        };
      }) || [];
      
      // 轉換商品數據為嚮導表單格式
      const transformedData: WizardFormData = {
        basicInfo: {
          name: product.name || '',
          description: product.description || '',
          category_id: product.category_id || null,
        },
        specifications: {
          isVariable: isVariable,
          selectedAttributes: hasAttributes && product.attributes ? product.attributes.map((attr: any) => attr.id) : [],
          attributeValues: attributeValues,
        },
        variants: {
          items: variantItems,
        },
        confirmation: {
          reviewed: false,
        },
      };

      // 調試信息：檢查轉換後的變體數據
      console.log('編輯模式 - 原始產品數據:', product);
      console.log('編輯模式 - 轉換後的變體數據:', variantItems);
      console.log('編輯模式 - 完整轉換數據:', transformedData);
      
      // 預填表單數據
      setFormData(transformedData);
    }
  }, [isEditMode, productDetail]);

  /**
   * 更新表單資料的通用函數
   */
  const updateFormData = <K extends keyof WizardFormData>(
    section: K,
    data: Partial<WizardFormData[K]>
  ) => {
    setFormData(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        ...data,
      },
    }));
  };

  /**
   * 步驟驗證邏輯
   */
  const validateStep = (stepNumber: number): boolean => {
    switch (stepNumber) {
      case 1:
        // 基本資訊驗證：商品名稱必填
        return formData.basicInfo.name.trim().length > 0;
      
      case 2:
        // 規格定義驗證：如果是多規格，必須選擇至少一個屬性
        if (formData.specifications.isVariable) {
          return formData.specifications.selectedAttributes.length > 0;
        }
        return true;
      
      case 3:
        // 變體配置驗證：如果是多規格，必須有變體資料
        if (formData.specifications.isVariable) {
          return formData.variants.items.length > 0;
        }
        return true;
      
      case 4:
        // 預覽確認：檢查是否已確認
        return formData.confirmation.reviewed;
      
      default:
        return true;
    }
  };

  /**
   * 下一步處理
   */
  const handleNextStep = () => {
    if (!validateStep(step)) {
      toast.error('請完成當前步驟的必填資訊');
      return;
    }
    
    if (step < STEPS.length) {
      setStep(step + 1);
      toast.success(`已進入步驟 ${step + 1}`);
    }
  };

  /**
   * 上一步處理
   */
  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  /**
   * 最終提交處理 - 統一 SPU/SKU API 格式版本
   */
  const handleSubmit = async () => {
    if (!validateStep(4)) {
      toast.error('請確認所有資訊無誤');
      return;
    }

    try {
      // 🚀 統一使用新的 SPU/SKU API 格式
      const apiPayload = transformWizardDataToApiPayload(formData, attributesData);
      
      console.log(`${isEditMode ? '編輯' : '創建'}模式 - 轉換後的 API 請求資料：`, apiPayload);
      
      if (isEditMode && productId) {
        // 編輯模式：使用完整的 SPU/SKU 更新 API
        await updateProductMutation.mutateAsync({ 
          id: Number(productId), 
          ...apiPayload 
        });
        
        toast.success('商品更新成功！', {
          description: `商品「${apiPayload.name}」已成功更新，包含 ${apiPayload.variants?.length || 0} 個 SKU 變體。`
        });
      } else {
        // 創建模式：新增商品
        await createProductMutation.mutateAsync(apiPayload);
        
        // 成功訊息在 useCreateProduct 的 onSuccess 中處理
      }
      
      // 成功後跳轉
      router.push('/products');

    } catch (error) {
      // 錯誤處理
      console.error(`商品${isEditMode ? '更新' : '創建'}提交失敗:`, error);
      
      toast.error(`商品${isEditMode ? '更新' : '創建'}失敗`, {
        description: error instanceof Error ? error.message : '請檢查輸入資料並重試'
      });
    }
  };

  /**
   * 渲染當前步驟組件
   */
  const renderCurrentStep = () => {
    const commonProps = {
      formData,
      updateFormData,
    };

    switch (step) {
      case 1:
        return <Step1_BasicInfo {...commonProps} />;
      case 2:
        return <Step2_DefineSpecs {...commonProps} />;
      case 3:
        return <Step3_ConfigureVariants {...commonProps} />;
      case 4:
        return <Step4_Review {...commonProps} />;
      default:
        return <div>未知步驟</div>;
    }
  };

  /**
   * 計算進度百分比
   */
  const progressPercentage = (step / STEPS.length) * 100;

  return (
    <div className="bg-gray-50">
      {/* 頁面標題 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {isEditMode ? '編輯商品' : '新增商品'}
            </h1>
            <p className="text-sm text-gray-600">
              {isEditMode 
                ? '透過嚮導式流程，輕鬆更新您的商品資訊' 
                : '透過嚮導式流程，輕鬆創建您的商品資訊'
              }
            </p>
          </div>
        </div>
      </div>

      {/* 主內容區域：響應式側邊欄 + 內容區 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* 左側邊欄：步驟導航（桌面版）或頂部導航（移動版） */}
          <div className="lg:w-72 lg:flex-shrink-0">
            <Card className="lg:sticky lg:top-6">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="hidden lg:block">創建進度</span>
                  <span className="lg:hidden">步驟 {step} / {STEPS.length}</span>
                  <Badge variant="outline" className="text-xs">
                    {Math.round(progressPercentage)}% 完成
                  </Badge>
                </CardTitle>
                <Progress value={progressPercentage} className="w-full h-2" />
              </CardHeader>
              
              <CardContent className="space-y-3 pt-0">
                {/* 步驟列表 - 移動版只顯示當前和下一步 */}
                <div className="lg:hidden grid grid-cols-2 gap-2 mb-4">
                  {STEPS.map((stepInfo, index) => {
                    const stepNumber = index + 1;
                    const isCompleted = stepNumber < step;
                    const isCurrent = stepNumber === step;
                    
                    return (
                      <div 
                        key={stepInfo.id} 
                        className={`p-2 rounded text-center text-xs ${
                          isCurrent ? 'bg-blue-100 text-blue-700 font-medium' : 
                          isCompleted ? 'bg-green-100 text-green-700' : 
                          'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {stepInfo.title}
                      </div>
                    );
                  })}
                </div>
                
                {/* 步驟列表 - 桌面版完整顯示 */}
                <div className="hidden lg:block space-y-2">
                {STEPS.map((stepInfo, index) => {
                  const stepNumber = index + 1;
                  const isCompleted = stepNumber < step;
                  const isCurrent = stepNumber === step;
                  
                  return (
                    <div 
                      key={stepInfo.id} 
                      className={`flex items-start space-x-3 p-2.5 rounded-md transition-colors ${
                        isCurrent ? 'bg-blue-50 border border-blue-200' : 
                        isCompleted ? 'bg-green-50 border border-green-200' : 
                        'bg-gray-50 border border-gray-200'
                      }`}
                    >
                      {/* 步驟圖標 */}
                      <div className="flex-shrink-0 mt-1">
                        {isCompleted ? (
                          <CheckCircle className="h-6 w-6 text-green-500" />
                        ) : isCurrent ? (
                          <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
                            <span className="text-white text-sm font-medium">{stepNumber}</span>
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-gray-300 flex items-center justify-center">
                            <span className="text-gray-600 text-sm font-medium">{stepNumber}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* 步驟資訊 */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium ${
                          isCurrent ? 'text-blue-700' : 
                          isCompleted ? 'text-green-700' : 
                          'text-gray-500'
                        }`}>
                          {stepInfo.title}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {stepInfo.description}
                        </div>
                        
                        {/* 當前步驟標示 */}
                        {isCurrent && (
                          <div className="flex items-center mt-2 text-xs text-blue-600">
                            <div className="h-1.5 w-1.5 bg-blue-600 rounded-full mr-2 animate-pulse"></div>
                            進行中
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右側主內容區 */}
          <div className="flex-1 min-w-0">
            {/* 內容卡片 */}
            <Card>
              <CardContent className="p-6">
                {/* 當前步驟內容 */}
                <div>
                  {renderCurrentStep()}
                </div>
              </CardContent>
            </Card>

            {/* 底部導航控制 */}
            <div className="mt-4 flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
              <Button
                variant="outline"
                onClick={handlePrevStep}
                disabled={step === 1 || isSubmitting}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>上一步</span>
              </Button>

              <div className="text-sm text-gray-500">
                步驟 {step} / {STEPS.length}
              </div>

              {step < STEPS.length ? (
                <Button
                  onClick={handleNextStep}
                  disabled={!validateStep(step) || isSubmitting}
                  className="flex items-center space-x-2"
                >
                  <span>下一步</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={!validateStep(step) || isSubmitting}
                  className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>
                    {isSubmitting 
                      ? (isEditMode ? '更新中...' : '創建中...') 
                      : (isEditMode ? '完成更新' : '完成創建')
                    }
                  </span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 