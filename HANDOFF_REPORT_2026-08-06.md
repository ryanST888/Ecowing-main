# EcoWing Azure é·ç§»èˆ‡éƒ¨ç½²äº¤æŽ¥å ±å‘Š

æ—¥æœŸï¼š2026-08-06  
å°ˆæ¡ˆï¼š`ryanST888/Ecowing-main`  
æœ¬æ©Ÿè·¯å¾‘ï¼š`D:\Ecowing-main-main\Ecowing-main-orin`  
æ­£å¼ç¶²åŸŸï¼š`ecowing.hk`ã€`www.ecowing.hk`

## 1. æœ€çµ‚æž¶æ§‹

```text
Cloudflare DNS
        |
        v
Azure Container Apps - ecowing-frontend (React/Vite + Nginx)
        |
        v
Azure Container Apps - ecowing-backend (FastAPI)
        |--------------------|
        v                    v
Azure Cosmos DB       Azure Blob Storage
è³‡æ–™èˆ‡ç™»å…¥è³‡æ–™         Report Waste åœ–ç‰‡
```

æ­£å¼ç¶²ç«™å·²ç”± Vercel åˆ‡æ›åˆ° Azureã€‚Vercel èˆ‡ Render è³‡æºä»ä¿ç•™ï¼Œä½†ç›®å‰ä¸å†æ‰¿æ“”æ­£å¼æµé‡ã€‚

## 2. Azure è³‡æº

### å…±ç”¨è¨­å®š

- Resource Groupï¼š`ecowing-storage-rg`
- ä¸»è¦å€åŸŸï¼š`Germany West Central`
- Container Apps Environmentï¼š`ecowing-env`
- Environment Domainï¼š`ashybush-5ee7e402.germanywestcentral.azurecontainerapps.io`
- Environment Static IPï¼š`72.144.81.137`

### å‰ç«¯

- Container Appï¼š`ecowing-frontend`
- FQDNï¼š`ecowing-frontend.ashybush-5ee7e402.germanywestcentral.azurecontainerapps.io`
- Container Portï¼š`80`
- Web Serverï¼šNginx
- ç‹€æ…‹ï¼š`Succeeded`
- æœ€æ–° Revisionï¼š`ecowing-frontend--jw4qj6z`

### å¾Œç«¯

- Container Appï¼š`ecowing-backend`
- FQDNï¼š`ecowing-backend.ashybush-5ee7e402.germanywestcentral.azurecontainerapps.io`
- API Portï¼š`8000`
- æœ€æ–°å·²é…ç½® Revisionï¼š`ecowing-backend--0000006`
- ç‹€æ…‹ï¼š`Succeeded`
- System-assigned Managed Identity Principalï¼š`6d461a2f-1def-4480-9790-eba6a7fd9b50`

### Container Registry

- ACRï¼š`ca63338cd38facr`
- Login Serverï¼š`ca63338cd38facr.azurecr.io`
- SKUï¼šBasic
- Admin userï¼šå·²å•Ÿç”¨
- Imagesï¼š
  - `ecowing-backend:latest`
  - `ecowing-frontend:latest`

ACR Tasks æ›¾è¢«è¨‚é–±æ”¿ç­–ç¦æ­¢ï¼Œå› æ­¤æ”¹ç”¨ GitHub Actions å»ºç½®ä¸¦æŽ¨é€ Docker Imageã€‚

### Cosmos DB

- Accountï¼š`ecowing2026-cosmos`
- Databaseï¼š`ecowing`
- APIï¼šCosmos DB for NoSQL
- Capacityï¼šServerless
- Endpointï¼š`https://ecowing2026-cosmos.documents.azure.com:443/`

| Container | Partition Key | ç”¨é€” |
|---|---|---|
| `reports` | `/user_id` | Report Waste å ±å‘Šã€ä½ç½®ã€AI çµæžœã€åª’é«” URL |
| `profiles` | `/id` | ä½¿ç”¨è€…è³‡æ–™ |
| `auth-identities` | `/login_key` | Emailï¼Google èº«ä»½æ˜ å°„ |
| `auth-sessions` | `/user_id` | Accessï¼Refresh Session |

å¾Œç«¯ Managed Identity å·²ç²å¾— Cosmos DB Built-in Data Contributorï¼ŒScope ç‚ºæ•´å€‹ Cosmos Accountã€‚

### Blob Storage

- Storage Accountï¼š`ecowing2026`
- Containerï¼š`report-images`
- ä½¿ç”¨æ–¹å¼ï¼š`DefaultAzureCredential`
- Storage Providerï¼š`azure`
- ç‰©ä»¶è·¯å¾‘æ ¼å¼ï¼š`report-images/{user_id}/{uuid}.{ext}`

å¾Œç«¯ Managed Identity å·²ç²å¾— `Storage Blob Data Contributor`ï¼ŒScope ç‚ºæ•´å€‹ Storage Accountã€‚

## 3. å¾Œç«¯ç¨‹å¼ä¿®æ”¹

ä¸»è¦æª”æ¡ˆï¼š`backend/main.py`

- å°‡å¯¦éš›è³‡æ–™å„²å­˜å¾ž Supabase æ”¹ç‚º Azure Cosmos DBã€‚
- å°‡åœ–ç‰‡ï¼å½±ç‰‡ä¸Šå‚³å¾žèˆŠæœ¬æ©Ÿæµç¨‹æ”¹ç‚º Azure Blob Storageã€‚
- åŠ å…¥ Emailï¼Password è¨»å†Šèˆ‡ç™»å…¥ã€‚
- Password ä½¿ç”¨ Argon2 é›œæ¹Šï¼Œä¸å„²å­˜æ˜Žæ–‡ã€‚
- åŠ å…¥ EcoWing Access Tokenã€Refresh Tokenã€Session è¼ªæ›¿èˆ‡ Logout æ’¤éŠ·ã€‚
- åŠ å…¥ Google ID Token é©—è­‰ã€‚
- åŠ å…¥ Google èº«ä»½èˆ‡æ—¢æœ‰ Email å¸³æˆ¶çš„é—œè¯ã€‚
- Report Waste çµæžœå¯«å…¥ Cosmos DB `reports`ã€‚
- AI åˆ†æžä½¿ç”¨ Qwen APIï¼Œå¯†é‘°ä»¥ Container App Secret ä¿å­˜ã€‚
- CORS å·²å…è¨±ï¼š
  - `https://ecowing.hk`
  - `https://www.ecowing.hk`
  - æœ¬æ©Ÿ Vite é–‹ç™¼ç¶²å€

### å¾Œç«¯ç’°å¢ƒè®Šæ•¸

å·²é…ç½®çš„æ ¸å¿ƒè®Šæ•¸åŒ…æ‹¬ï¼š

- `AZURE_COSMOS_ENDPOINT`
- `AZURE_COSMOS_DATABASE`
- å››å€‹ Cosmos Container åç¨±
- `STORAGE_PROVIDER=azure`
- `AZURE_STORAGE_AUTH_MODE=default_credential`
- `AZURE_STORAGE_ACCOUNT_URL`
- `AZURE_STORAGE_CONTAINER=report-images`
- `AUTH_JWT_SECRET`ï¼ˆContainer App Secret referenceï¼‰
- `GOOGLE_CLIENT_ID`
- `QWEN_API_KEY`ï¼ˆContainer App Secret referenceï¼‰
- `PUBLIC_BACKEND_URL`
- `FRONTEND_ORIGINS`

å¥åº·æª¢æŸ¥ç›®å‰è¿”å›žï¼š

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

## 4. å‰ç«¯ç¨‹å¼èˆ‡éƒ¨ç½²ä¿®æ”¹

å‰ç«¯ä½¿ç”¨ React + Viteï¼Œæ­£å¼å»ºç½®è¼¸å‡ºç‚º `dist`ã€‚

æ–°å¢žæª”æ¡ˆï¼š

- `Dockerfile.frontend`
  - Node 22 å»ºç½® React
  - Nginx Alpine æä¾›æ­£å¼éœæ…‹ç¶²ç«™
  - å»ºç½®æ™‚æ³¨å…¥ `VITE_API_URL` å’Œ `VITE_GOOGLE_CLIENT_ID`
- `frontend-nginx.conf`
  - SPA fallback è‡³ `index.html`
  - éœæ…‹è³‡ç”¢å¿«å–è¨­å®š
- `.dockerignore`
- `.github/workflows/frontend-container.yml`
  - GitHub Actions å»ºç½®ä¸¦æŽ¨é€ `ecowing-frontend:latest`

å‰ç«¯æ­£å¼ API URLï¼š

```text
https://ecowing-backend.ashybush-5ee7e402.germanywestcentral.azurecontainerapps.io
```

æœ¬æ©Ÿ `VITE_API_URL` å’Œ Google Client ID æ²’æœ‰æäº¤åˆ° GitHubã€‚

## 5. GitHub èˆ‡è‡ªå‹•éƒ¨ç½²

- Repositoryï¼š`ryanST888/Ecowing-main`
- Backend workflowï¼š`.github/workflows/backend-container.yml`
- Frontend workflowï¼š`.github/workflows/frontend-container.yml`
- Frontend deployment PRï¼š`#2`
- Frontend deployment merge commitï¼š`0b53b62bd0465e7ea0ec9cf34d95bfe0613dc234`
- Frontend workflow runï¼š`31067643980`
- å»ºç½®çµæžœï¼š`success`

GitHub Actions ä½¿ç”¨çš„ ACR Secretsï¼š

- `ACR_LOGIN_SERVER`
- `ACR_USERNAME`
- `ACR_PASSWORD`
- `VITE_GOOGLE_CLIENT_ID`

## 6. ç¶²åŸŸåˆ‡æ›çµæžœ

Cloudflare DNS å·²åˆ‡æ›ç‚ºï¼š

```text
ecowing.hk       A      72.144.81.137
www.ecowing.hk   CNAME  ecowing-frontend.ashybush-5ee7e402.germanywestcentral.azurecontainerapps.io
```

Cloudflare è¨˜éŒ„å¿…é ˆä¿æŒ DNS onlyï¼ˆç°è‰²é›²æœµï¼‰ï¼Œä»¥ä¾¿ Azure Managed Certificate çºŒæœŸã€‚

Azure å·²ç¶å®šï¼š

- `ecowing.hk`ï¼š`SniEnabled`
- `www.ecowing.hk`ï¼š`SniEnabled`

å¯¦éš›é©—è­‰çµæžœï¼š

- `https://ecowing.hk/`ï¼šHTTP 200
- `https://www.ecowing.hk/`ï¼šHTTP 200
- Azure backend `/health`ï¼šHTTP 200
- Nginx å›žæ‡‰é¡¯ç¤ºå‰ç«¯ç”± Azure Container App æä¾›

## 7. Google ç™»å…¥ç›®å‰ç‹€æ…‹

Google Client ID å‰å¾Œç«¯ä¸ä¸€è‡´çš„å•é¡Œå·²ä¿®æ­£ï¼Œå¾Œç«¯å·²æ›´æ–°åˆ° `ecowing-backend--0000006`ã€‚

ç›®å‰ç•«é¢é¡¯ç¤ºï¼š

```text
Google account is already linked
```

é€™ä»£è¡¨ Google Token å·²ç¶“é€šéŽé©—è­‰ï¼Œå•é¡Œå·²ç¶“ä¸æ˜¯ Client ID æˆ– OAuth ç¶²åŸŸè¨­å®šã€‚

ç›®å‰çœŸæ­£å•é¡Œæ˜¯å¾Œç«¯ Google å»ºç«‹èº«ä»½æ™‚é‡åˆ° Cosmos `ResourceExists`ï¼ç«¶æ…‹æƒ…æ³ï¼Œç¨‹å¼åœ¨ `backend/main.py` ç´„ç¬¬ 845 è¡Œè¿”å›ž `409 Google account is already linked`ã€‚Email Login å’Œ Email Signup æœ¬èº«æ˜¯åˆ†é–‹çš„ï¼›Google å‰‡æ˜¯å…±ç”¨ `/api/auth/google`ï¼Œç¬¬ä¸€æ¬¡å»ºç«‹ã€ä¹‹å¾Œç™»å…¥ã€‚

### å¾…ä¿®æ­£æ–¹å¼

è®“ `/api/auth/google` åœ¨é‡åˆ°å·²å­˜åœ¨çš„ Google Identity æ™‚æ”¹ç‚ºé‡æ–°è®€å–æ—¢æœ‰ Profile ä¸¦ç™¼å‡º Sessionï¼Œè€Œä¸æ˜¯è¿”å›ž 409ã€‚ä¹Ÿæ‡‰è™•ç†å…©æ¬¡åŒæ™‚è«‹æ±‚çš„ç«¶æ…‹æƒ…æ³ã€‚

## 8. å·²å®Œæˆé©—æ”¶

- [x] Cosmos DB Accountã€Databaseã€å››å€‹ Container
- [x] Cosmos DB Managed Identity æ¬Šé™
- [x] Azure Blob Storage Container
- [x] Blob Managed Identity æ¬Šé™
- [x] Emailï¼Password API
- [x] JWT Accessï¼Refresh Session
- [x] Google OAuth Client è¨­å®š
- [x] Azure Container Apps backend
- [x] Azure Container Apps frontend
- [x] GitHub Actions Docker å»ºç½®
- [x] Cloudflare DNS åˆ‡æ›
- [x] Azure Managed HTTPS Certificates
- [x] æ­£å¼ç¶²åŸŸ HTTP 200
- [x] Backend health å…¨éƒ¨ configured

## 9. å°šæœªå®Œæˆäº‹é …

- [ ] ä¿®æ­£ Google é‡è¤‡é—œè¯æ™‚çš„ 409 éŒ¯èª¤
- [ ] å®Œæˆä¸€æ¬¡ Report Waste çœŸå¯¦ä¸Šå‚³ç«¯åˆ°ç«¯æ¸¬è©¦
- [ ] ç¢ºèª Blob `report-images` å‡ºç¾åœ–ç‰‡
- [ ] ç¢ºèª Cosmos `reports` å‡ºç¾å ±å‘Š Document
- [ ] æ¸¬è©¦å ±å‘Šåˆªé™¤æ™‚ Blob èˆ‡ Cosmos æ˜¯å¦åŒæ™‚åˆªé™¤
- [ ] å®Œå…¨ç§»é™¤ Supabase legacy importã€requirementsã€ç’°å¢ƒè®Šæ•¸èˆ‡æœ¬æ©Ÿ fallback
- [ ] ç¢ºèªæ‰€æœ‰æ­£å¼ä½¿ç”¨è€…çš„ Google OAuth æµç¨‹å¾Œï¼Œå°‡ OAuth App å¾ž Testing ç™¼å¸ƒ
- [ ] ç¢ºèªç„¡éœ€å›žæ»¾å¾Œï¼Œå†åœç”¨æˆ–åˆªé™¤ Vercel èˆ‡ Render
- [ ] WeChat ç™»å…¥å°šæœªå¯¦ä½œ

## 10. é‡è¦ä¿ç•™äº‹é …

- ä¸è¦æäº¤æ ¹ç›®éŒ„ `.env` æˆ– `backend/.env`ã€‚
- `.zcode/` å’Œ `tmp/` æ˜¯æœ¬æ©Ÿå·¥å…·ï¼æš«å­˜è³‡æ–™ï¼Œä¸è¦æäº¤ã€‚
- Google Client Secret ä¸æ‡‰æ”¾å…¥å‰ç«¯ï¼›å‰ç«¯åªéœ€è¦ Client IDã€‚
- Cloud Shell æ˜¯ ephemeral sessionï¼›Shell è®Šæ•¸å’Œæš«å­˜æª”æœƒæ¶ˆå¤±ï¼Œä½† Azure è³‡æºä¸æœƒæ¶ˆå¤±ã€‚
- Vercel DNS å›žæ»¾å€¼ï¼šæ ¹ç¶²åŸŸ `216.198.79.1`ï¼Œ`www` ç‚º `cname.vercel-dns.com`ã€‚

## 11. å»ºè­°å¾ŒçºŒé †åº

1. ä¿®æ­£ Google Identity 409/idempotencyã€‚
2. æ¸¬è©¦ Email Loginã€Google Login å’Œ Report Wasteã€‚
3. æª¢æŸ¥ Blob èˆ‡ Cosmos å ±å‘Šè³‡æ–™ã€‚
4. ç¢ºèªæ­£å¼ç¶²åŸŸç©©å®šé‹ä½œã€‚
5. åœç”¨ Renderï¼Œå†åœç”¨ Vercelã€‚
6. æœ€å¾Œæ¸…ç† Supabase legacy ç¨‹å¼ç¢¼èˆ‡ä¾è³´ã€‚
