<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class InventoryAdjustmentRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true; // 權限檢查將在控制器中進行
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array|string>
     */
    public function rules(): array
    {
        return [
            'product_variant_id' => ['required', 'integer', 'exists:product_variants,id'],
            'store_id' => ['required', 'integer', 'exists:stores,id'],
            'action' => ['required', 'string', 'in:add,reduce,set'],
            'quantity' => ['required', 'integer', 'min:1'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'metadata' => ['nullable', 'array'],
        ];
    }
    
    /**
     * 獲取驗證錯誤的自定義訊息
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'product_variant_id.required' => '請選擇商品變體',
            'product_variant_id.exists' => '所選商品變體不存在',
            'store_id.required' => '請選擇門市',
            'store_id.exists' => '所選門市不存在',
            'action.required' => '請選擇操作類型',
            'action.in' => '操作類型必須是添加、減少或設定',
            'quantity.required' => '請輸入數量',
            'quantity.integer' => '數量必須為整數',
            'quantity.min' => '數量必須大於0',
        ];
    }
    
    /**
     * 取得請求體參數的文檔
     * 
     * 用於 Scribe API 文檔生成
     * 
     * @return array
     */
    public function bodyParameters(): array
    {
        return [
            'product_variant_id' => [
                'description' => '商品變體ID',
                'example' => 1,
            ],
            'store_id' => [
                'description' => '門市ID',
                'example' => 1,
            ],
            'action' => [
                'description' => '操作類型（add: 添加, reduce: 減少, set: 設定）',
                'example' => 'add',
            ],
            'quantity' => [
                'description' => '數量',
                'example' => 10,
            ],
            'notes' => [
                'description' => '備註（可選）',
                'example' => '週末促銷活動增加庫存',
            ],
            'metadata' => [
                'description' => '額外的元數據（可選）',
                'example' => ['reason' => 'restock'],
            ],
        ];
    }
}
