# OGSM 部署與環境管理

紀錄三環境(開發 / 測試 / 正式)的網址、資料庫對應，以及未來功能迭代要走的完整流程。

## Vercel 專案資訊

- Team: `riku-ship-its-projects`
- Project: `ogsm-vercel`(注意:帳號下還有一個舊專案 `ogsm-main`,**不是**目前實際使用的部署目標,本機 repo 已 `vercel link` 改連到 `ogsm-vercel`,不要被舊專案的環境變數設定混淆)

## 三環境總覽

| 環境 | 用途 | 網址 | 資料庫 | 畫面標示 |
|---|---|---|---|---|
| 開發 (Development) | 本機改 code、即時測試 | `http://localhost:8765`(或任一本機靜態伺服器埠號) | Staging(測試庫) | 左下角藍色小角色 + 「開發環境」牌子 |
| 測試 (Preview) | 推上雲端、給別人 review | 每次部署網址不同,見下方「如何取得網址」 | Staging(測試庫) | 左下角橘色小角色 + 「測試環境」牌子 |
| 正式 (Production) | 真實使用者用的版本 | `https://ogsm-vercel.vercel.app` | Production(正式庫) | 無標示 |

### 如何取得最新的 Preview 網址

```bash
vercel          # 在專案根目錄執行,部署一次 Preview,終端機會印出網址
vercel ls       # 列出所有部署記錄與網址
```

或到 Vercel Dashboard → `ogsm-vercel` 專案 → **Deployments** → 篩選 `Preview`,點最新一筆即可看到網址、並可直接 Visit。

### 資料庫憑證放哪裡

- 本機:`config.js`(已加入 `.gitignore`,不會上 GitHub),裡面是 Staging 庫的 URL/Key
- Preview / Production:不寫在程式碼裡,放在 Vercel 後台 **Project → Settings → Environment Variables**,依環境(Preview / Production)各自綁定 Staging / Production 的 Supabase URL、Key。`vercel.json` 的 `buildCommand` 會在每次部署時動態讀出對應環境變數,寫成雲端的 `config.js`

## 環境判斷機制(`APP_ENV`)

`vercel.json` 的 buildCommand 會額外寫入 Vercel 自動提供的系統變數 `VERCEL_ENV`(`production` / `preview` / `development`)成為 `config.js` 裡的 `APP_ENV`。本機的 `config.js` 則手動寫 `APP_ENV = 'development'`。`script.js` 依 `APP_ENV` 決定要不要顯示左下角的小角色標示(正式環境不顯示)。

## 未來修改 / 迭代的完整流程

```
[1] 本機開發
     在 localhost 改 index.html / style.css / script.js,
     用 Staging 庫測試,確認功能正常
       ↓
[2] git push 到非 main 分支
     觸發(或手動執行 `vercel`)Preview 部署
     套用 Staging 庫的環境變數
       ↓
[3] 測試環境驗證
     打開 Preview 網址實際操作,確認資料、互動皆正常
     (Preview 預設有 Vercel SSO 保護,只有登入 Vercel 帳號的人能看)
       ↓
[4] 確認沒問題 → merge 進 main
     觸發 Vercel 自動重新部署 Production
     套用 Production 庫的環境變數
       ↓
[5] 正式環境驗證
     打開 https://ogsm-vercel.vercel.app 確認改動生效
     只做「讀取」確認,不要在正式環境手動建測試資料
```

### 注意事項

- 改樣式只動 `style.css`、改邏輯只動 `script.js`、改頁面結構只動 `index.html`,規則見 `CLAUDE.md`
- 不要把 Supabase URL / anon key 寫進任何會被 commit 的檔案,只能放在本機 `config.js`(gitignored)或 Vercel 環境變數後台
- Staging 庫目前只有 Table 結構,沒有正式資料,測試環境看到資料是空的是正常現象
