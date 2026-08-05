# EcoWing Azure 遷移與登入功能交接報告

**日期：** 2026-08-05

**專案：** `ryanST888/Ecowing-main`

**本機路徑：** `D:\Ecowing-main-main\Ecowing-main-orin`

**狀態：** 本機前後端可運行；Azure Cosmos DB、Azure Blob Storage、電郵登入及 Google 登入已接通

## 1. 今日完成內容

1. 將主要資料儲存由 Supabase 遷移至 Azure Cosmos DB。
2. 建立 Cosmos DB Database 與四個 Container。
3. 配置後端 Cosmos DB 資料角色權限。
4. 建立無需電郵驗證的電郵／密碼註冊與登入。
5. 建立 EcoWing JWT Access Token、Refresh Token、Session 輪替及撤銷。
6. 完成 Google OAuth 登入及相同電郵帳戶連結。
7. 將 Report Waste 媒體上傳流程接到 Azure Blob Storage。
8. 將 Report Waste 報告內容寫入 Azure Cosmos DB。
9. 修改前端登入介面、Google 按鈕與 Token 自動刷新。
10. 修正本機 `localhost`／`127.0.0.1` CORS 問題。
11. 完成桌面、手機、深色及淺色模式測試。

## 2. 目前架構

```text
React / Vite 前端
        |
        | EcoWing Access Token
        v
FastAPI 後端
   |-- 電郵／密碼驗證（Argon2）
   |-- Google ID Token 驗證
   |-- EcoWing JWT Access / Refresh Token
   |
   |-- Azure Cosmos DB
   |     |-- reports
   |     |-- profiles
   |     |-- auth-identities
   |     `-- auth-sessions
   |
   `-- Azure Blob Storage
         `-- report-images/{user_id}/{uuid}.{ext}
```

目前沒有使用 Microsoft Entra External ID Tenant。Google 負責證明用戶身分，成功後由 EcoWing 後端發出自己的 Token。

## 3. Azure Cosmos DB

- Resource Group：`ecowing-storage-rg`
- Cosmos DB Account：`ecowing2026-cosmos`
- Region：`Germany West Central`
- API：Cosmos DB for NoSQL
- Capacity mode：Serverless
- Database：`ecowing`
- Provisioning state：`Succeeded`
- 最低 TLS：`TLS 1.2`

| Container | Partition Key | 用途 |
|---|---|---|
| `reports` | `/user_id` | 報告、位置、AI 分析及媒體 URL |
| `profiles` | `/id` | 用戶資料 |
| `auth-identities` | `/login_key` | 電郵與 Google 身分映射 |
| `auth-sessions` | `/user_id` | Refresh Session、輪替及撤銷 |

後端 Principal 已獲授 Cosmos DB Built-in Data Contributor 角色，Scope 為整個 Cosmos DB Account。

## 4. Azure Blob Storage

- Storage Account：`ecowing2026`
- Container：`report-images`
- 驗證方式：`DefaultAzureCredential`
- Provider：`STORAGE_PROVIDER=azure`

2026-08-05 檢查結果：

- Container 數量：1
- Blob 數量：0
- 已使用容量：0 bytes

目前只完成 Google 登入測試，尚未正式提交 Report Waste 測試圖片，所以容器仍為空。

## 5. 認證功能

### 電郵／密碼

- 電郵註冊不需要驗證郵件。
- 密碼使用 Argon2 Hash，不儲存明文。
- 支援電郵登入。
- 支援 Access Token、Refresh Token、Token 輪替及 Logout 撤銷。
- Profile、Identity、Session 全部儲存在 Cosmos DB。

### Google 登入

- Google Cloud Project：`EcoWing2026`
- OAuth Client：Web application
- OAuth App：Testing 模式
- 使用者電郵已加入 Test users。
- 真實 Google 登入已測試成功。

JavaScript Origins：

```text
http://localhost:5173
http://127.0.0.1:5173
https://ecowing.hk
https://www.ecowing.hk
```

後端 Endpoint：

```text
POST /api/auth/google
```

Google 登入成功後，新用戶會建立 Profile 和 Identity；若相同已驗證電郵已存在，會把 Google 身分連結至原帳戶。

## 6. Report Waste 資料流程

前端選擇媒體後呼叫：

```text
POST /api/detect
```

後端流程：

1. 驗證 Access Token。
2. 驗證檔案大小及真實格式。
3. 上傳媒體到 Azure Blob Storage。
4. Blob 路徑：`report-images/{user_id}/{uuid}.{ext}`。
5. 將 Blob URL 返回前端。
6. 圖片進入 AI 分析；影片標記為人工審核證據。

用戶確認報告後呼叫：

```text
POST /api/reports
```

最終資料流向：

- 圖片／影片：Azure Blob Storage
- 報告文字、位置、狀態、AI 結果：Cosmos DB `reports`

## 7. 主要程式修改

| 檔案 | 修改內容 |
|---|---|
| `backend/main.py` | Cosmos、Blob、電郵登入、Google 登入、JWT Session、Report CRUD |
| `backend/requirements.txt` | Azure、JWT、Argon2、Google 驗證依賴 |
| `backend/.env.example` | Azure、Cosmos、JWT、Google 設定範例 |
| `backend/DEPLOY.md` | Azure 部署與權限說明 |
| `services/apiService.ts` | Auth API、Google 登入、Logout、Token Refresh、401 Retry |
| `App.tsx` | 登入 UI、Google 按鈕及 Logout |
| `index.tsx` | Google OAuth Provider |
| `components/RF2.tsx` | Report Waste 認證 API 與報告儲存 |
| `index.css` | Google iframe 響應式限制 |
| `package.json` | 加入 `@react-oauth/google` |
| `.env.example` | 前端 API URL 與 Google Client ID 範例 |
| `README.md` | 更新 Azure 架構說明 |

## 8. 測試結果

### 後端

- Python 語法檢查通過。
- 依賴載入通過。
- Cosmos DB 四個 Container 配置成功。
- 無效 Google Token 正確返回 `401`。
- Google 新用戶流程通過。
- 相同電郵帳戶連結流程通過。
- Uvicorn 本機啟動成功。

健康檢查結果：

```json
{
  "status": "ok",
  "database_provider": "azure_cosmos",
  "cosmos_db": "configured",
  "auth_provider": "azure_cosmos_jwt",
  "authentication": "configured",
  "google_login": "configured",
  "storage_provider": "azure",
  "storage_auth": "default_credential",
  "media_storage": "configured"
}
```

### 前端

- `npm run build` 通過。
- Google 官方按鈕正常顯示及可操作。
- 深色及淺色模式通過。
- 390 × 844 手機尺寸通過。
- Login Dialog 沒有水平溢出。
- 真實 Google Test User 登入成功。
- CORS 修正後沒有 `Failed to fetch` 錯誤。

已知非阻斷項目：

- Build 有既有的 `heic2any` 大型 Chunk Warning。
- 開發模式中 Google SDK 可能顯示重複 initialize Warning，但不影響登入。

## 9. 本機啟動

後端：

```powershell
cd D:\Ecowing-main-main\Ecowing-main-orin\backend
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

健康檢查：`http://127.0.0.1:8000/health`

前端：

```powershell
cd D:\Ecowing-main-main\Ecowing-main-orin
npm run dev -- --host 127.0.0.1 --port 5173
```

瀏覽地址：`http://127.0.0.1:5173`

## 10. 尚未完成事項

### P0：真實 Report Waste 端到端測試

1. 使用已登入帳戶提交一張測試圖片。
2. 確認 Blob 出現在 `report-images/{user_id}/`。
3. 確認 Blob URL 可由前端顯示。
4. 確認 Cosmos DB `reports` 出現 Document。
5. 測試刪除報告時 Blob 和 Cosmos Document 同時刪除。

### P0：完全移除 Supabase

Supabase 已不是實際 Provider，但仍有 legacy 程式：

- `backend/main.py` 仍有 Supabase import、初始化及 legacy helper。
- `backend/requirements.txt` 仍有 `supabase` 套件。
- `backend/.env.example` 仍有 Supabase 變數。
- Azure 上傳失敗時仍會退回 `backend/uploads`。

建議移除所有 Supabase 程式與本機 fallback；Azure 上傳失敗時直接返回錯誤。

### P1：正式部署

- 將 FastAPI 後端部署到 Azure。
- 啟用 Managed Identity 並配置 Blob/Cosmos 角色。
- 設置正式 `PUBLIC_BACKEND_URL`。
- 前端 API URL 指向正式 Azure 後端。
- 驗證 `ecowing.hk` 與 `www.ecowing.hk` CORS。
- 驗證 Blob 讀取策略。

### P1：Google OAuth 發佈

Google App 目前為 Testing 模式，只允許 Test users。正式開放前需要完成 Consent Screen 並 Publish App。

### P2：WeChat 登入

WeChat OAuth 尚未開始，建議待 Azure 正式部署和 Google 登入穩定後實作。

## 11. 注意事項

1. 不要 Commit 根目錄 `.env` 或 `backend/.env`。
2. Google Client Secret 不應放進 Vite 前端；前端只需要 Client ID。
3. `reports` 的 Partition Key 是 `/user_id`。
4. Storage 容器目前為 0 bytes，交接後應優先完成上傳測試。
5. `.zcode/` 與 `tmp/` 是本機工具／臨時輸出，不應加入版本控制。

## 12. 交接驗收清單

- [x] 電郵註冊及登入
- [x] Google Test User 登入
- [x] Access / Refresh Token
- [x] Logout Session 撤銷
- [x] Cosmos DB 四個 Container
- [x] Cosmos DB 權限
- [x] Azure Blob Storage 配置
- [x] 前端 Production Build
- [x] Desktop / Mobile 登入 UI
- [ ] 真實 Report Waste 上傳
- [ ] Cosmos Report 寫入／刪除端到端測試
- [ ] 完全移除 Supabase
- [ ] 移除本機媒體 fallback
- [ ] Azure 正式部署
- [ ] Google OAuth Publish
- [ ] WeChat 登入
