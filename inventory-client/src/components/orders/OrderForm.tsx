"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormControl,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusCircle, Trash2, ImageIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Image from "next/image";
import { CustomerSelector } from "./CustomerSelector";
import { CustomerForm } from "@/components/customers/CustomerForm";

import { ProductSelector, type Variant } from "@/components/ui/ProductSelector";
import { useCreateCustomer } from "@/hooks/queries/useEntityQueries";
import { Customer, ProductVariant, OrderFormData } from "@/types/api-helpers";
import { useAppFieldArray } from "@/hooks/useAppFieldArray"; // 🎯 使用專案標準化的 Hook

// 使用 Zod 提前定義表單驗證規則
const orderFormSchema = z.object({
  customer_id: z.number().min(1, "必須選擇一個客戶"),
  shipping_address: z.string().min(1, "運送地址為必填"),
  payment_method: z.string().min(1, "必須選擇付款方式"),
  order_source: z.string().min(1, "必須選擇客戶來源"),
  shipping_status: z.string(),
  payment_status: z.string(),
  shipping_fee: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  discount_amount: z.number().min(0).optional(),
  notes: z.string().optional(),
  // ... 其他主體字段
  items: z
    .array(
      z.object({
        id: z.number().optional(), // 🎯 訂單項目 ID（編輯模式使用）
        product_variant_id: z.number().nullable(), // 允許訂製商品
        is_stocked_sale: z.boolean(),
        status: z.string(),
        quantity: z.number().min(1, "數量至少為 1"),
        price: z.number().min(0, "價格不能為負"),
        product_name: z.string().min(1, "商品名稱為必填"),
        sku: z.string().min(1, "SKU 為必填"),
        custom_specifications: z.record(z.string()).optional(), // 訂製規格
        imageUrl: z.string().optional().nullable(), // 🎯 商品圖片 URL
        // ... 其他項目字段
      }),
    )
    .min(1, "訂單至少需要一個品項"),
});

export type OrderFormValues = z.infer<typeof orderFormSchema>;

interface OrderFormProps {
  initialData?: Partial<OrderFormValues>;
  onSubmit: (values: OrderFormValues) => void;
  isSubmitting: boolean;
}

export function OrderForm({
  initialData,
  onSubmit,
  isSubmitting,
}: OrderFormProps) {
  const [isCustomerDialogOpen, setIsCustomerDialogOpen] = useState(false);
  const createCustomerMutation = useCreateCustomer();

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: initialData || {
      shipping_status: "pending",
      payment_status: "pending",
      shipping_fee: 0,
      tax: 0,
      discount_amount: 0,
      items: [], // 預設為空的項目列表
    },
  });

  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // 當 initialData 變更時，重置表單
  useEffect(() => {
    if (initialData) {
      form.reset(initialData);
    }
  }, [initialData, form]);

  // 初始化 useFieldArray 來管理 items 字段
  const { fields, append, remove, update, replace } = useAppFieldArray({
    control: form.control,
    name: "items",
  });

  // 🎯 計算已選中的標準品項 ID（用於同步 ProductSelector 的狀態）
  const selectedVariantIds = useMemo(
    () =>
      fields
        .map((field) => field.product_variant_id)
        .filter((id): id is number => id !== null && id !== undefined),
    [fields],
  );

  // 處理從 ProductSelector 回傳的選擇結果
  const handleProductSelect = (selectedVariants: Variant[]) => {
    // 🎯 智能合併策略：將新選擇的品項與現有品項合併
    const currentItems = fields;
    const mergedItems = [...currentItems];

    selectedVariants.forEach((variant) => {
      // 檢查這個 variant 是否已存在於表單中
      const existingIndex = currentItems.findIndex(
        (item) => item.product_variant_id === Number(variant.id),
      );

      if (existingIndex !== -1) {
        // 如果已存在，保留原有的數量和其他資訊
        // 只更新價格（以防價格有變動）
        update(existingIndex, {
          ...currentItems[existingIndex],
          price: Number(variant.price) || 0,
        });
      } else {
        // 如果不存在，新增到列表
        append({
          // 明確不包含 id 欄位（新品項沒有 order_item_id）
          product_variant_id: Number(variant.id),
          is_stocked_sale: true,
          status: "pending",
          quantity: 1, // 新增的品項數量預設為 1
          price: Number(variant.price) || 0,
          product_name: variant.productName
            ? `${variant.productName} - ${variant.specifications}`
            : variant.specifications || `商品 ${variant.sku}`, // 確保永遠有值
          sku: variant.sku || `SKU-${variant.id}`, // 確保永遠有值
          custom_specifications: undefined,
          imageUrl: variant.imageUrl || null, // 🎯 加入商品圖片 URL
        });
      }
    });

    // 關閉選擇器
    setIsSelectorOpen(false);
  };

  // 處理新增訂製商品
  const handleAddCustomItem = (item: any) => {
    // `append` 函式來自於你已有的 `useFieldArray` hook
    append({
      // 明確不包含 id 欄位
      product_variant_id: item.product_variant_id, // 這裡會是 null
      is_stocked_sale: false, // 訂製商品通常不是庫存銷售
      status: "pending",
      quantity: item.quantity,
      price: item.price,
      product_name: item.custom_product_name, // 使用訂製名稱
      sku: item.sku,
      custom_specifications: item.custom_specifications, // 儲存訂製規格
      imageUrl: item.imageUrl || null, // 🎯 訂製商品預設沒有圖片
    });
    // 關閉選擇器 Modal
    setIsSelectorOpen(false);
  };

  function handleSubmit(values: OrderFormValues) {
    // 轉換表單數據為 API 期望的格式
    const orderData: OrderFormValues = {
      ...values,
      items: values.items.map((item) => ({
        ...item,
        custom_specifications: item.custom_specifications
          ? item.custom_specifications
          : undefined,
      })),
    };

    // 直接調用從 props 傳入的 onSubmit 函數
    onSubmit(orderData);
  }

  const handleAddNewCustomer = () => {
    setIsCustomerDialogOpen(true);
  };

  const handleCustomerCreated = (newCustomer: Customer) => {
    // 自動選中新創建的客戶
    if (newCustomer.id) {
      form.setValue("customer_id", newCustomer.id);
      form.setValue("shipping_address", newCustomer.contact_address || "");
    }
    setIsCustomerDialogOpen(false);
  };

  // 實時價格計算
  const items = form.watch("items");
  const shippingFee = form.watch("shipping_fee") || 0;
  const tax = form.watch("tax") || 0;
  const discountAmount = form.watch("discount_amount") || 0;

  // 計算小計
  const subtotal =
    items?.reduce((acc, item) => {
      // 🎯 使用 ?? 正確處理 price 的 undefined 狀態
      const itemTotal = (item.price ?? 0) * (item.quantity || 0);
      return acc + itemTotal;
    }, 0) || 0;

  // 計算總計
  const grandTotal = Math.max(0, subtotal + shippingFee + tax - discountAmount);

  return (
    <>
      <Form {...form} data-oid="2qearfy">
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
          data-oid="1jju5h2"
        >
          {/* --- 頂層按鈕區 --- */}
          <div className="flex items-center gap-4" data-oid="g.bndxn">
            <h1 className="flex-1 text-2xl font-semibold" data-oid="2zjh7lu">
              {initialData ? "編輯訂單" : "新增訂單"}
            </h1>
            <Button type="submit" disabled={isSubmitting} data-oid="-8.tv:d">
              {isSubmitting ? "儲存中..." : "儲存訂單"}
            </Button>
          </div>

          {/* --- 🎯 新的雙欄式網格佈局 --- */}
          <div className="space-y-6" data-oid="whho-p2">
            <div className="grid gap-6 md:grid-cols-3" data-oid="69w:2a5">
              {/* === 左側主欄 (互動核心) === */}
              <div className="md:col-span-2 space-y-6" data-oid="yexk73i">
                {/* --- 訂單品項卡片 --- */}
                <Card data-oid="r:eyvn.">
                  <CardHeader
                    className="flex flex-row items-center justify-between"
                    data-oid="s4kmpia"
                  >
                    <CardTitle data-oid="wskk3hq">訂單品項</CardTitle>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        setIsSelectorOpen(true);
                      }}
                      data-oid="y757y-5"
                    >
                      <PlusCircle className="h-4 w-4 mr-2" data-oid="fh8.qql" />
                      新增項目
                    </Button>
                  </CardHeader>
                  <CardContent data-oid="sr_05fm">
                    {fields.length > 0 ? (
                      <div className="text-sm" data-oid="5dkv44b">
                        <Table data-oid="3su5q7t">
                          <TableHeader data-oid="-vb7lws">
                            <TableRow
                              className="border-b hover:bg-transparent"
                              data-oid="xk5ho75"
                            >
                              <TableHead
                                className="w-2/5 px-4 h-12 text-left align-middle font-medium text-muted-foreground"
                                data-oid="5e4u3-b"
                              >
                                商品資訊
                              </TableHead>
                              <TableHead
                                className="w-[100px] px-4 h-12 text-left align-middle font-medium text-muted-foreground"
                                data-oid="mcm4vhj"
                              >
                                單價
                              </TableHead>
                              <TableHead
                                className="w-[80px] px-4 h-12 text-left align-middle font-medium text-muted-foreground"
                                data-oid="q59ir4d"
                              >
                                數量
                              </TableHead>
                              <TableHead
                                className="w-[100px] px-4 h-12 text-left align-middle font-medium text-muted-foreground"
                                data-oid="4j8d86s"
                              >
                                小計
                              </TableHead>
                              <TableHead
                                className="w-[60px] px-4 h-12 text-left align-middle font-medium text-muted-foreground"
                                data-oid="frbsr12"
                              >
                                操作
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody data-oid="48od5qz">
                            {fields.map((field, index) => {
                              const quantity =
                                form.watch(`items.${index}.quantity`) || 0;
                              const price =
                                form.watch(`items.${index}.price`) ?? 0;
                              const subtotal = quantity * price;

                              return (
                                <TableRow
                                  key={field.key}
                                  className="hover:bg-muted/50"
                                  data-oid="nbwi9.8"
                                >
                                  <TableCell
                                    className="px-3 py-2 align-middle"
                                    data-oid="8gxszeh"
                                  >
                                    <div
                                      className="flex items-center gap-3"
                                      data-oid="r18ukm6"
                                    >
                                      {/* --- 🎯 新增的圖片/佔位符 --- */}
                                      <div
                                        className="h-12 w-12 flex-shrink-0 bg-muted rounded-md flex items-center justify-center overflow-hidden"
                                        data-oid="wg-5ail"
                                      >
                                        {field.imageUrl ? (
                                          <Image
                                            src={field.imageUrl}
                                            alt={
                                              form.watch(
                                                `items.${index}.product_name`,
                                              ) || "Product Image"
                                            }
                                            width={48}
                                            height={48}
                                            className="h-full w-full object-cover"
                                            data-oid="jsyc:1d"
                                          />
                                        ) : (
                                          <ImageIcon
                                            className="h-6 w-6 text-muted-foreground"
                                            data-oid="tuw3xsf"
                                          />
                                        )}
                                      </div>

                                      {/* --- 原有的文字資訊區 --- */}
                                      <div
                                        className="min-w-0"
                                        data-oid="gt-pug3"
                                      >
                                        <div
                                          className="font-medium text-gray-900 dark:text-gray-50 truncate"
                                          data-oid="-fij1:u"
                                        >
                                          {form.watch(
                                            `items.${index}.product_name`,
                                          )}
                                        </div>
                                        <div
                                          className="text-xs text-gray-500 dark:text-gray-400"
                                          data-oid="bv3x3-n"
                                        >
                                          SKU:{" "}
                                          {form.watch(`items.${index}.sku`)}
                                        </div>
                                        {field.product_variant_id === null && (
                                          <div
                                            className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-1"
                                            data-oid="pdt8_oy"
                                          >
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                              data-oid="56aypb:"
                                            >
                                              訂製
                                            </Badge>
                                            <span
                                              className="truncate"
                                              data-oid="qiy5cny"
                                            >
                                              {field.custom_specifications &&
                                                Object.entries(
                                                  field.custom_specifications,
                                                )
                                                  .map(([k, v]) => `${k}: ${v}`)
                                                  .join("; ")}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell
                                    className="px-3 py-2 align-middle"
                                    data-oid="krx:n1_"
                                  >
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.price`}
                                      render={({ field }) => (
                                        <FormItem data-oid="gl:tldc">
                                          <FormControl data-oid="kxl3hjh">
                                            <Input
                                              type="number"
                                              step="0.01"
                                              min="0"
                                              className="w-full"
                                              placeholder="0.00"
                                              value={
                                                field.value?.toString() || ""
                                              }
                                              onChange={(e) => {
                                                const value = e.target.value;
                                                if (value === "") {
                                                  field.onChange(0);
                                                } else {
                                                  const parsedValue =
                                                    parseFloat(value);
                                                  if (!isNaN(parsedValue)) {
                                                    field.onChange(parsedValue);
                                                  }
                                                }
                                              }}
                                              onBlur={field.onBlur}
                                              name={field.name}
                                              ref={field.ref}
                                              data-oid="j22hxp_"
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                      data-oid="enrvcgt"
                                    />
                                  </TableCell>
                                  <TableCell
                                    className="px-3 py-2 align-middle"
                                    data-oid="5uop0.n"
                                  >
                                    <FormField
                                      control={form.control}
                                      name={`items.${index}.quantity`}
                                      render={({ field }) => (
                                        <FormItem data-oid="p5b:zlw">
                                          <FormControl data-oid="7o2utpc">
                                            <Input
                                              type="number"
                                              min="1"
                                              className="w-full"
                                              {...field}
                                              onChange={(e) =>
                                                field.onChange(
                                                  parseInt(e.target.value) || 1,
                                                )
                                              }
                                              data-oid=".wx5:53"
                                            />
                                          </FormControl>
                                        </FormItem>
                                      )}
                                      data-oid="utb_-af"
                                    />
                                  </TableCell>
                                  <TableCell
                                    className="px-3 py-2 align-middle font-mono"
                                    data-oid="kuwcuu8"
                                  >
                                    ${subtotal.toFixed(2)}
                                  </TableCell>
                                  <TableCell
                                    className="px-3 py-2 align-middle"
                                    data-oid="emrmfww"
                                  >
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => remove(index)}
                                      data-oid="57ef58v"
                                    >
                                      <Trash2
                                        className="h-4 w-4 text-muted-foreground hover:text-destructive"
                                        data-oid="k_ob6ms"
                                      />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div
                        className="p-8 border-2 border-dashed rounded-lg text-center"
                        data-oid="2:fywmz"
                      >
                        <div className="space-y-4" data-oid="_j9mwvp">
                          <h3
                            className="text-lg font-medium text-muted-foreground"
                            data-oid="hpgrv-2"
                          >
                            📦 尚未添加任何項目
                          </h3>
                          <p
                            className="text-muted-foreground"
                            data-oid="xr_2phv"
                          >
                            點擊「新增項目」按鈕來選擇商品
                          </p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* --- 價格計算摘要卡片 --- */}
                <Card data-oid="oa_yy3b">
                  <CardHeader data-oid="4.-x3c4">
                    <CardTitle data-oid="8x-hwhe">價格摘要</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4" data-oid="w76o7ik">
                    {/* 運費、稅金、折扣輸入欄位 */}
                    <div
                      className="grid grid-cols-1 md:grid-cols-3 gap-4"
                      data-oid="niytcc-"
                    >
                      <FormField
                        control={form.control}
                        name="shipping_fee"
                        render={({ field }) => (
                          <FormItem data-oid="f:a0qz5">
                            <FormLabel data-oid="10j14c4">運費</FormLabel>
                            <FormControl data-oid="q8z-hbt">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                data-oid="6h:1djs"
                              />
                            </FormControl>
                            <FormMessage data-oid="6v9q4oh" />
                          </FormItem>
                        )}
                        data-oid="-69yyk0"
                      />

                      <FormField
                        control={form.control}
                        name="tax"
                        render={({ field }) => (
                          <FormItem data-oid="8tlibbs">
                            <FormLabel data-oid="4und0ch">稅金</FormLabel>
                            <FormControl data-oid="mwzr6b8">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                data-oid="rkjlwjk"
                              />
                            </FormControl>
                            <FormMessage data-oid="hfzdgn7" />
                          </FormItem>
                        )}
                        data-oid="mtv34mc"
                      />

                      <FormField
                        control={form.control}
                        name="discount_amount"
                        render={({ field }) => (
                          <FormItem data-oid="qejkqms">
                            <FormLabel data-oid="r6l6c81">折扣金額</FormLabel>
                            <FormControl data-oid="_g6bpo:">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                {...field}
                                onChange={(e) =>
                                  field.onChange(
                                    parseFloat(e.target.value) || 0,
                                  )
                                }
                                data-oid="d:d5fjn"
                              />
                            </FormControl>
                            <FormMessage data-oid="jirqh:4" />
                          </FormItem>
                        )}
                        data-oid="_l-_okf"
                      />
                    </div>

                    {/* 價格計算明細 */}
                    <div
                      className="bg-muted/50 rounded-lg p-4 space-y-2"
                      data-oid="a04q4m7"
                    >
                      <div
                        className="flex justify-between text-sm"
                        data-oid="seh7d7c"
                      >
                        <span data-oid="sgl2o3i">小計：</span>
                        <span className="font-medium" data-oid="20yzdtx">
                          ${subtotal.toFixed(2)}
                        </span>
                      </div>

                      {shippingFee > 0 && (
                        <div
                          className="flex justify-between text-sm"
                          data-oid="f8q4gwc"
                        >
                          <span data-oid="byqt5e_">運費：</span>
                          <span className="font-medium" data-oid="rg_s2-e">
                            ${shippingFee.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {tax > 0 && (
                        <div
                          className="flex justify-between text-sm"
                          data-oid="sjf874t"
                        >
                          <span data-oid="-nk43sc">稅金：</span>
                          <span className="font-medium" data-oid="7n:-fa_">
                            ${tax.toFixed(2)}
                          </span>
                        </div>
                      )}

                      {discountAmount > 0 && (
                        <div
                          className="flex justify-between text-sm text-green-600"
                          data-oid="sm4kxem"
                        >
                          <span data-oid="g.r--cu">折扣：</span>
                          <span className="font-medium" data-oid="_wo:se_">
                            -${discountAmount.toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div
                        className="flex justify-between text-lg font-bold border-t pt-2"
                        data-oid="est:atu"
                      >
                        <span data-oid="l-3un4b">總計：</span>
                        <span className="text-primary" data-oid="-kgmyw6">
                          ${grandTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* === 右側邊欄 (資訊配置) === */}
              <div className="md:col-span-1" data-oid="x3h2ajm">
                {/* --- 訂單資訊整合卡片 --- */}
                <Card data-oid="l2631d.">
                  <CardHeader data-oid="j.6df__">
                    <CardTitle data-oid="hzkgxes">訂單資訊</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6" data-oid="g3p_6or">
                    <div className="space-y-6" data-oid="v40goby">
                      {/* === 客戶資訊區塊 === */}
                      <div className="space-y-4" data-oid="-akja5t">
                        <div
                          className="text-sm font-medium text-muted-foreground"
                          data-oid="i0hyl1l"
                        >
                          客戶資訊
                        </div>

                        {/* 選擇客戶 */}
                        <FormField
                          control={form.control}
                          name="customer_id"
                          render={({ field }) => (
                            <FormItem
                              className="flex flex-col"
                              data-oid="ts_i8od"
                            >
                              <FormLabel data-oid=".5_xy.b">選擇客戶</FormLabel>
                              <CustomerSelector
                                selectedCustomerId={field.value}
                                onSelectCustomer={(customer) => {
                                  if (customer) {
                                    form.setValue("customer_id", customer.id!);
                                    form.setValue(
                                      "shipping_address",
                                      customer.contact_address || "",
                                    );
                                  }
                                }}
                                onAddNewCustomer={handleAddNewCustomer}
                                data-oid="n45tg5k"
                              />

                              <FormMessage data-oid="rfcse-z" />
                            </FormItem>
                          )}
                          data-oid="qkzh2az"
                        />

                        {/* 運送地址 */}
                        <FormField
                          control={form.control}
                          name="shipping_address"
                          render={({ field }) => (
                            <FormItem data-oid="mm4a-q:">
                              <FormLabel data-oid=":drid.t">運送地址</FormLabel>
                              <FormControl data-oid="30o3bqf">
                                <Textarea
                                  placeholder="請輸入運送地址..."
                                  className="resize-none min-h-[80px]"
                                  {...field}
                                  data-oid=":75oxzg"
                                />
                              </FormControl>
                              <FormMessage data-oid="a5uvahc" />
                            </FormItem>
                          )}
                          data-oid="nv76y1w"
                        />
                      </div>

                      {/* 分隔線 */}
                      <div className="border-t" data-oid="-1-zpwy"></div>

                      {/* === 付款與來源資訊區塊 === */}
                      <div className="space-y-4" data-oid="qbv.rb7">
                        <div
                          className="text-sm font-medium text-muted-foreground"
                          data-oid="zom.7q:"
                        >
                          付款與來源
                        </div>

                        {/* 付款方式 */}
                        <FormField
                          control={form.control}
                          name="payment_method"
                          render={({ field }) => (
                            <FormItem data-oid="72b6q7n">
                              <FormLabel data-oid="ewyp2jb">付款方式</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                data-oid="aaf6o91"
                              >
                                <FormControl data-oid="9yigp6g">
                                  <SelectTrigger data-oid="ux6h3l-">
                                    <SelectValue
                                      placeholder="選擇付款方式"
                                      data-oid="_h-joxr"
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent data-oid="fe-0o8l">
                                  <SelectItem value="現金" data-oid="l5.s3e:">
                                    現金
                                  </SelectItem>
                                  <SelectItem value="轉帳" data-oid="z.7tfbj">
                                    轉帳
                                  </SelectItem>
                                  <SelectItem value="刷卡" data-oid="fk.lwst">
                                    刷卡
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage data-oid="yjm97np" />
                            </FormItem>
                          )}
                          data-oid="71pug8:"
                        />

                        {/* 客戶來源 */}
                        <FormField
                          control={form.control}
                          name="order_source"
                          render={({ field }) => (
                            <FormItem data-oid="qzvadog">
                              <FormLabel data-oid="ecq334a">客戶來源</FormLabel>
                              <Select
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                data-oid="zoo.u2p"
                              >
                                <FormControl data-oid="wmfysp3">
                                  <SelectTrigger data-oid="fwh:lwr">
                                    <SelectValue
                                      placeholder="選擇客戶來源"
                                      data-oid="o5nvo1o"
                                    />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent data-oid="m82lkag">
                                  <SelectItem
                                    value="現場客戶"
                                    data-oid="w.lajws"
                                  >
                                    現場客戶
                                  </SelectItem>
                                  <SelectItem
                                    value="網站客戶"
                                    data-oid="5rp.z5o"
                                  >
                                    網站客戶
                                  </SelectItem>
                                  <SelectItem
                                    value="LINE客戶"
                                    data-oid="w.ke13t"
                                  >
                                    LINE客戶
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage data-oid="u9y796b" />
                            </FormItem>
                          )}
                          data-oid="r8kkdk0"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* --- 訂單備註卡片（獨立於主要網格） --- */}
            <Card data-oid="pkbm2gu">
              <CardHeader data-oid="r-qldnp">
                <CardTitle data-oid="jlp.to.">訂單備註</CardTitle>
              </CardHeader>
              <CardContent data-oid="_5s786p">
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem data-oid="-lmr59r">
                      <FormControl data-oid="_8tccdq">
                        <Textarea
                          placeholder="輸入此訂單的內部備註..."
                          className="resize-none min-h-[100px]"
                          {...field}
                          data-oid="299gg7p"
                        />
                      </FormControl>
                      <FormMessage data-oid="o1:_bzj" />
                    </FormItem>
                  )}
                  data-oid="t:obs9l"
                />
              </CardContent>
            </Card>
          </div>
        </form>
      </Form>

      {/* 新增客戶對話框 */}
      <Dialog
        open={isCustomerDialogOpen}
        onOpenChange={setIsCustomerDialogOpen}
        data-oid="3z_37q8"
      >
        <DialogContent className="max-w-2xl" data-oid="rikiu:o">
          <DialogHeader data-oid="sv5r8g2">
            <DialogTitle data-oid="e8jwg9s">新增客戶</DialogTitle>
          </DialogHeader>
          <CustomerForm
            isSubmitting={createCustomerMutation.isPending}
            onSubmit={(customerData) => {
              createCustomerMutation.mutate(customerData, {
                onSuccess: (data) => {
                  handleCustomerCreated(data?.data || {});
                },
              });
            }}
            data-oid="97j:5lc"
          />
        </DialogContent>
      </Dialog>

      {/* 商品選擇對話框 */}
      <ProductSelector
        open={isSelectorOpen}
        onOpenChange={setIsSelectorOpen}
        onSelect={handleProductSelect}
        onCustomItemAdd={handleAddCustomItem}
        multiple={true}
        selectedIds={selectedVariantIds}
        data-oid="ubkz0f3"
      />
    </>
  );
}
