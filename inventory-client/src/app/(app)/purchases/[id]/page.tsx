'use client'

import { useParams, useRouter } from 'next/navigation'
import { usePurchase } from '@/hooks/queries/useEntityQueries'
import { 
  PURCHASE_STATUS_LABELS, 
  PURCHASE_STATUS_COLORS, 
  getPurchasePermissions,
  type PurchaseStatus 
} from '@/types/purchase'
import { format } from 'date-fns'
import { zhTW } from 'date-fns/locale'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowLeft,
  Edit,
  Package,
  Store,
  Calendar,
  User,
  Truck,
  Receipt,
  Hash,
  DollarSign
} from 'lucide-react'

export default function PurchaseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const purchaseId = params.id as string

  const { data: purchase, isLoading, error } = usePurchase(purchaseId)

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
            <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-48 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !purchase) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-destructive mb-4">找不到進貨單</h1>
          <p className="text-muted-foreground mb-6">
            進貨單不存在或已被刪除
          </p>
          <Button onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
        </div>
      </div>
    )
  }

  const purchaseData = purchase as any
  const permissions = getPurchasePermissions(purchaseData.status as PurchaseStatus)

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="space-y-6">
        {/* 頁面標題區 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-7 w-7 text-blue-600" />
                進貨單詳情
              </h1>
              <p className="text-muted-foreground">
                查看進貨單的完整資訊和商品項目
              </p>
            </div>
          </div>
          
          {permissions.canModify && (
            <Button onClick={() => router.push(`/purchases/${purchaseId}/edit`)}>
              <Edit className="h-4 w-4 mr-2" />
              編輯
            </Button>
          )}
        </div>

        {/* 基本資訊卡片 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Hash className="h-5 w-5" />
                  {purchaseData.order_number}
                </CardTitle>
                <CardDescription>
                  進貨單編號和基本資訊
                </CardDescription>
              </div>
              <Badge className={PURCHASE_STATUS_COLORS[purchaseData.status as PurchaseStatus]}>
                {PURCHASE_STATUS_LABELS[purchaseData.status as PurchaseStatus]}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Store className="h-4 w-4" />
                  <span>門市</span>
                </div>
                <p className="font-medium">{purchaseData.store?.name || '未知門市'}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>進貨日期</span>
                </div>
                <p className="font-medium">
                  {purchaseData.purchased_at 
                    ? format(new Date(purchaseData.purchased_at), 'yyyy年MM月dd日', { locale: zhTW })
                    : '未設定'
                  }
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Truck className="h-4 w-4" />
                  <span>運費</span>
                </div>
                <p className="font-medium">
                  NT$ {Number(purchaseData.shipping_cost || 0).toLocaleString()}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  <span>總金額</span>
                </div>
                <p className="font-medium text-lg">
                  NT$ {Number(purchaseData.total_amount || 0).toLocaleString()}
                </p>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>建立時間</span>
                </div>
                <p className="text-sm">
                  {purchaseData.created_at 
                    ? format(new Date(purchaseData.created_at), 'yyyy年MM月dd日 HH:mm', { locale: zhTW })
                    : '未知'
                  }
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>最後更新</span>
                </div>
                <p className="text-sm">
                  {purchaseData.updated_at 
                    ? format(new Date(purchaseData.updated_at), 'yyyy年MM月dd日 HH:mm', { locale: zhTW })
                    : '未知'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 商品項目列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              商品項目
            </CardTitle>
            <CardDescription>
              共 {purchaseData.items?.length || 0} 項商品
            </CardDescription>
          </CardHeader>
          <CardContent>
            {purchaseData.items && purchaseData.items.length > 0 ? (
              <div className="space-y-4">
                {purchaseData.items.map((item: any, index: number) => (
                  <div key={item.id || index} className="border rounded-lg p-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <h4 className="font-medium">
                          {item.product_name || '未知商品'}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          SKU: {item.sku || '未知'}
                        </p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">數量</p>
                        <p className="font-medium">{item.quantity || 0}</p>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">進貨價</p>
                        <p className="font-medium">
                          NT$ {Number(item.cost_price || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <Separator className="my-3" />

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">小計：</span>
                        <span className="font-medium ml-2">
                          NT$ {((item.quantity || 0) * (item.cost_price || 0)).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">攤銷運費：</span>
                        <span className="font-medium ml-2">
                          NT$ {Number(item.allocated_shipping_cost || 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">總成本：</span>
                        <span className="font-medium ml-2">
                          NT$ {Number(item.total_cost_price || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* 總計 */}
                <div className="border-t pt-4">
                  <div className="flex justify-end">
                    <div className="text-right space-y-2">
                      <div className="text-sm text-muted-foreground">
                        商品總計: NT$ {(
                          purchaseData.items.reduce((sum: number, item: any) => 
                            sum + ((item.quantity || 0) * (item.cost_price || 0)), 0
                          )
                        ).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        運費: NT$ {Number(purchaseData.shipping_cost || 0).toLocaleString()}
                      </div>
                      <div className="text-lg font-semibold">
                        總金額: NT$ {Number(purchaseData.total_amount || 0).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                此進貨單沒有商品項目
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 