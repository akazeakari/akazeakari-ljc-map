# 配置说明

## Google Maps API 設置

要使用街景功能，你需要設置 Google Maps API 密鑰。

### 1. 獲取 API 密鑰

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 創建或選擇一個項目
3. 啟用以下 API：
   - **Maps JavaScript API** (必需)
   - **Street View Static API** (必需)
   - **Places API** (可選，用於地點搜索)

4. 前往 `APIs & Services > Credentials`
5. 點擊 `Create Credentials > API Key`
6. 複製生成的 API 密鑰

### 2. 配置環境變量

在項目根目錄 (`map/`) 下創建 `.env.local` 文件：

```bash
# 在 map/ 目錄下創建 .env.local 文件
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your_actual_api_key_here
```

### 3. 重啟開發服務器

```bash
npm run dev
# 或
bun run dev
```

## 常見問題

### 街景顯示黑色
1. 檢查 API 密鑰是否正確配置
2. 確認已啟用 Maps JavaScript API 和 Street View Static API
3. 檢查瀏覽器控制台是否有錯誤信息
4. 某些位置可能沒有街景數據

### API 配額限制
- Google Maps API 有免費配額限制
- 超出限制後可能需要付費
- 建議設置使用限制和預算警告

### 安全性
- API 密鑰應該設置 HTTP 引用來源限制
- 不要將 API 密鑰提交到公共代碼庫 