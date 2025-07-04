# Docker 部署檔案結構說明

本文檔說明專案中 Docker 部署相關的檔案結構和用途。

## 📁 檔案結構

```
Mir01/
├── docker-compose.yml           # Docker Compose 配置
├── docker-env-example          # 環境變數範例
├── deploy.sh                   # 部署輔助腳本
├── Docker部署指南.md           # 詳細部署指南
│
├── inventory-api/              # 後端 API
│   ├── Dockerfile             # 後端 Docker 映像配置
│   ├── .dockerignore          # Docker 構建忽略規則
│   ├── env.example            # 後端環境變數範例
│   └── docker/                # Docker 相關配置
│       ├── nginx/
│       │   └── default.conf   # Nginx 配置
│       ├── supervisor/
│       │   └── supervisord.conf # Supervisor 配置
│       └── entrypoint.sh      # 容器啟動腳本
│
└── inventory-client/           # 前端應用
    ├── Dockerfile             # 前端 Docker 映像配置
    ├── .dockerignore          # Docker 構建忽略規則
    └── env.example            # 前端環境變數範例
```

## 🚀 快速開始

### 1. 準備環境變數
```bash
cp docker-env-example .env
# 編輯 .env 檔案，填入實際配置
```

### 2. 初始化部署（第一次）
```bash
./deploy.sh init
```

### 3. 更新部署
```bash
./deploy.sh update
```

## 🔧 主要配置檔案說明

### docker-compose.yml
- 定義所有服務（MySQL、Redis、API、Frontend、phpMyAdmin）
- 設定服務間的網路連接
- 管理資料卷持久化
- 配置健康檢查

### Dockerfile（前端）
- 使用多階段構建優化映像大小
- 基於 Node.js 20 Alpine
- 啟用 Next.js standalone 模式
- 使用非 root 用戶運行

### Dockerfile（後端）
- 基於 PHP 8.2-FPM
- 整合 Nginx 和 Supervisor
- 包含所有必要的 PHP 擴展
- 自動執行 Laravel 優化

### deploy.sh
提供以下功能：
- `init` - 初始化部署
- `up` - 啟動服務
- `down` - 停止服務
- `logs` - 查看日誌
- `backup` - 備份資料庫
- `restore` - 恢復資料庫
- `update` - 更新部署
- `status` - 檢查狀態

## 🌐 域名配置

### 生產環境
- 前端：https://los.lomis.com.tw
- 後端：https://api.lomis.com.tw

### 本地開發
- 前端：http://localhost:3000
- 後端：http://localhost:8080
- phpMyAdmin：http://localhost:8888（開發環境）

## 🔒 安全注意事項

1. **環境變數**
   - 永遠不要將 .env 檔案提交到版本控制
   - 使用強密碼
   - 定期更新密鑰

2. **網路安全**
   - 使用 HTTPS（SSL/TLS）
   - 配置適當的 CORS 策略
   - 限制資料庫端口訪問

3. **容器安全**
   - 使用非 root 用戶運行應用
   - 定期更新基礎映像
   - 最小化映像大小

## 📊 監控和維護

### 查看日誌
```bash
# 所有服務
./deploy.sh logs

# 特定服務
./deploy.sh logs api
./deploy.sh logs frontend
```

### 備份資料庫
```bash
./deploy.sh backup
```

### 清理資源
```bash
# 清理未使用的映像
docker image prune -a

# 清理所有未使用資源
docker system prune -a
```

## 🐛 常見問題

### 1. 端口衝突
如果端口已被佔用，修改 .env 檔案中的端口設定：
```env
API_PORT=8081
FRONTEND_PORT=3001
```

### 2. 權限問題
確保 storage 目錄有正確的權限：
```bash
docker-compose exec api chown -R www-data:www-data storage bootstrap/cache
```

### 3. 資料庫連接失敗
檢查 MySQL 容器是否正常運行：
```bash
docker-compose ps mysql
docker-compose logs mysql
```

## 📚 相關文檔

- [Docker部署指南.md](Docker部署指南.md) - 詳細部署步驟
- [部署指南.md](部署指南.md) - 總體部署概覽
- [README.md](README.md) - 專案說明

---

最後更新：2024年12月 