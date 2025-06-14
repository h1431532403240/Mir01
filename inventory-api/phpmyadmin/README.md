# phpMyAdmin Docker 部署指南

本文檔說明如何在 Laravel Sail 環境中部署和使用 phpMyAdmin。

## 🚀 快速開始

### 1. 一鍵部署

在 `inventory-api` 目錄下執行：

```bash
# 啟動 phpMyAdmin（自動檢查並啟動 MySQL）
./deploy-phpmyadmin.sh start
```

### 2. 訪問 phpMyAdmin

部署完成後，訪問：
- **URL**: http://localhost:8080
- **伺服器**: mysql
- **用戶名**: sail
- **密碼**: password

## 📋 功能特色

### 🔧 技術配置
- **基於官方 phpMyAdmin Docker 映像**
- **與 Laravel Sail 完美整合**
- **支援繁體中文介面**
- **優化記憶體和效能設定**
- **啟用語法高亮和行號顯示**

### 🛡️ 安全性設定
- **Cookie 認證模式**
- **雙因子認證支援**
- **SSL 連接支援**
- **隱藏 PHP 版本資訊**
- **關閉版本檢查提升隱私**

### 💾 資料持久化
- **Session 資料持久化存儲**
- **支援檔案上傳和匯出**
- **SQL 查詢歷史記錄**

## 🛠️ 管理命令

### 基本操作

```bash
# 啟動服務
./deploy-phpmyadmin.sh start

# 停止服務
./deploy-phpmyadmin.sh stop

# 重啟服務
./deploy-phpmyadmin.sh restart

# 查看狀態
./deploy-phpmyadmin.sh status

# 查看日誌
./deploy-phpmyadmin.sh logs

# 清理服務
./deploy-phpmyadmin.sh cleanup

# 顯示幫助
./deploy-phpmyadmin.sh help
```

### 直接使用 Docker Compose

```bash
# 啟動 phpMyAdmin（需先啟動 MySQL）
docker compose up -d mysql phpmyadmin

# 查看服務狀態
docker compose ps

# 查看日誌
docker compose logs phpmyadmin

# 停止服務
docker compose stop phpmyadmin

# 移除服務
docker compose down phpmyadmin
```

## ⚙️ 配置說明

### 環境變數配置

在 `.env` 檔案中可以設定：

```env
# phpMyAdmin 設定
PHPMYADMIN_PORT=8080    # 訪問端口，預設 8080
```

### 自定義配置

phpMyAdmin 的自定義配置位於 `phpmyadmin/config.user.inc.php`，包含：

#### 介面設定
- 預設語言：繁體中文
- 主題：pmahomme
- 顯示 PHP 資訊和統計
- 語法高亮和行號顯示

#### 效能設定
- 記憶體限制：1024M
- 執行時間：600秒
- 每頁顯示：50筆記錄
- 查詢歷史：100筆

#### 安全性設定
- Cookie 有效期：1小時
- 雙因子認證支援
- 關閉錯誤報告
- 關閉版本檢查

## 🔧 故障排除

### 常見問題

#### 1. 無法訪問 phpMyAdmin
```bash
# 檢查服務狀態
./deploy-phpmyadmin.sh status

# 查看詳細日誌
./deploy-phpmyadmin.sh logs
```

#### 2. MySQL 連接失敗
```bash
# 確認 MySQL 服務運行
docker compose ps mysql

# 檢查 MySQL 健康狀態
docker compose exec mysql mysqladmin ping -p
```

#### 3. 端口衝突
修改 `.env` 檔案中的 `PHPMYADMIN_PORT` 設定：
```env
PHPMYADMIN_PORT=8081  # 更改為其他端口
```

#### 4. 配置檔案錯誤
檢查 `phpmyadmin/config.user.inc.php` 語法：
```bash
# 檢查 PHP 語法
php -l phpmyadmin/config.user.inc.php
```

### 重置配置

如果需要重置為預設配置：

```bash
# 停止服務
./deploy-phpmyadmin.sh stop

# 刪除配置檔案
rm -f phpmyadmin/config.user.inc.php

# 重新生成配置（運行部署腳本會自動檢查）
./deploy-phpmyadmin.sh start
```

## 📁 檔案結構

```
inventory-api/
├── docker-compose.yml                 # Docker Compose 配置
├── .env                              # 環境變數
├── deploy-phpmyadmin.sh              # 部署管理腳本
└── phpmyadmin/
    ├── README.md                     # 本說明文檔
    └── config.user.inc.php           # phpMyAdmin 自定義配置
```

## 🔗 網路配置

phpMyAdmin 使用 Docker 內部網路與 MySQL 通信：

- **網路名稱**: sail
- **MySQL 主機**: mysql（Docker 服務名）
- **phpMyAdmin 端口映射**: 主機:8080 → 容器:80

## 📊 資源需求

### 記憶體使用
- **phpMyAdmin 容器**: ~100-200MB
- **PHP 記憶體限制**: 1024M
- **上傳檔案限制**: 300M

### 存儲空間
- **映像大小**: ~150MB
- **Session 存儲**: 最小使用量
- **日誌檔案**: 根據使用情況

## 🚧 注意事項

1. **僅用於開發環境**：此配置針對開發環境優化，生產環境需要額外的安全設定
2. **備份重要資料**：執行資料庫操作前請先備份
3. **防火牆設定**：確保 8080 端口未被防火牆阻擋
4. **Docker 資源**：確保 Docker 有足夠的記憶體和存儲空間

## 🆘 技術支援

如遇問題，請檢查：

1. **Docker 服務狀態**
2. **端口是否被佔用**
3. **網路連接正常**
4. **日誌檔案錯誤訊息**

---

**版本**: 1.0  
**最後更新**: 2024年  
**相容性**: Laravel Sail, Docker Compose v2+  
**作者**: AI Assistant 