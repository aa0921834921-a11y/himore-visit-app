# 哈鏌業務拜訪紀錄 App(POC|Android+網頁版)

業務端 14 個畫面加上簡易管理後台。同一套程式碼提供兩種使用方式:

| 方式 | 適合 | 怎麼取得 |
|---|---|---|
| **網頁版** | 先試用、給大家看畫面;手機瀏覽器直接開,可「加到主畫面」 | 上傳 GitHub 後自動部署到 GitHub Pages |
| **Android APK** | 正式給業務安裝試用(背景錄音、錄音檔存在手機) | 在 GitHub 上按一下按鈕自動打包 |

> POC 設定:**資料只存在各自的手機(或瀏覽器)裡、AI 為模擬版**。之後接上伺服器與正式 AI 服務時,只需替換兩個地方(見第六節)。

---

## 一、上傳到 GitHub(第一次)

1. 到 GitHub 建立一個新的 Repository,例如 `himore-visit-app`(Public 或 Private 皆可;Private 使用 GitHub Pages 需付費方案)。
2. 在電腦上把這個資料夾推上去(需先安裝 [Git](https://git-scm.com/)):

   ```bash
   cd himore-app
   git init
   git add .
   git commit -m "哈鏌業務拜訪紀錄 POC"
   git branch -M main
   git remote add origin https://github.com/<你的帳號>/himore-visit-app.git
   git push -u origin main
   ```

   不熟指令也可以用 [GitHub Desktop](https://desktop.github.com/) 選這個資料夾上傳。
   **注意**:一定要包含隱藏資料夾 `.github`(裡面是自動部署與打包的設定);用網頁拖曳上傳時常會漏掉它。

## 二、網頁版(手機瀏覽器使用)

1. GitHub 專案頁 → **Settings → Pages** → Source 選 **GitHub Actions**(只要設定一次)。
2. 每次推送到 `main` 分支會自動部署;到 **Actions** 分頁看到「部署網頁版」打勾即完成(約 3–5 分鐘)。
3. 網址:`https://<你的帳號>.github.io/himore-visit-app/`
   - 手機用 Chrome 開啟 → 右上選單 → **加到主畫面**,之後就像 App 一樣從桌面開啟。
   - 錄音需要 HTTPS,GitHub Pages 已是 HTTPS,第一次錄音時允許麥克風即可。

網頁版的限制:資料存在該手機的瀏覽器裡(清除瀏覽器資料會一併刪除);錄音重新整理後無法回放;不能在背景或鎖定螢幕時錄音。正式給業務用建議安裝 APK。

## 三、打包 Android APK

**方法一(手動打包)**
1. GitHub 專案頁 → **Actions** → 左側「打包 Android APK」→ 右側 **Run workflow**。
2. 約 15–25 分鐘完成,點進該次執行,頁面最下方 **Artifacts** 下載 `himore-visit-apk`(zip,解開就是 APK)。

**方法二(發版本)**
推送版本標籤,會自動建立 Release 並附上 APK,適合發給業務下載:

```bash
git tag v0.1.0
git push origin v0.1.0
```

**安裝到手機**:把 APK 傳到 Android 手機(LINE、Email、Google 雲端硬碟皆可)→ 點開 → 允許「安裝不明來源的應用程式」→ 安裝。

**簽章**:沒有設定時使用測試簽章,可以安裝試用,但不能上架 Google Play,而且之後改用正式簽章時需先移除舊版再安裝。要用正式簽章,先產生金鑰:

```bash
keytool -genkeypair -v -keystore himore.keystore -alias himore -keyalg RSA -keysize 2048 -validity 10000
base64 -w 0 himore.keystore > keystore.txt   # macOS 用:base64 -i himore.keystore -o keystore.txt
```

再到 GitHub 專案 → **Settings → Secrets and variables → Actions** 新增四個 Secret:

| 名稱 | 內容 |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | keystore.txt 的內容 |
| `ANDROID_KEYSTORE_PASSWORD` | 建立金鑰時設定的密碼 |
| `ANDROID_KEY_ALIAS` | `himore` |
| `ANDROID_KEY_PASSWORD` | 金鑰密碼 |

金鑰檔與密碼請妥善保存,遺失後就無法更新已安裝的 App。

> 另一種打包方式是 Expo 官方的 EAS 雲端服務(`eas.json` 已設定好 `preview` 產生 APK):`npx eas-cli@latest build -p android --profile preview`,需要免費的 Expo 帳號。

---

## 四、示範帳號(密碼皆為 `1234`)

| 帳號 | 姓名 | 角色 |
|---|---|---|
| `wang` | 王大明 | 業務(今天已安排 3 場拜訪) |
| `lin` | 林志偉 | 業務 |
| `admin` | 陳美玲 | 管理者(進入管理後台;電腦瀏覽器開網頁版最好用) |

示範資料的日期會自動對齊「今天」。要重來:管理後台 → 系統設定 → 重設為示範資料。正式試用前可在同一頁關閉「示範模式」。

**建議試用路線**
1. 以 `wang` 登入 → 首頁點「宏昇塑膠」→ 拜訪前簡報 → 開始記錄。
2. 選「文字輸入」→「填入示範內容」→ 完成 → 看處理中四個階段。
3. 確認頁:點黃底晶片核對原文、處理紅色「AI 不確定」、逐張確認偏好與避免事項 → 確認並入庫。
4. 首頁「待確認 1 筆」(永群精密):必答題未處理時「確認並入庫」會鎖定。
5. 登出改用 `admin` → 拜訪紀錄與匯出 → 下載 CSV。

---

## 五、本機開發

需要 [Node.js](https://nodejs.org/) 22。

```bash
npm install
npx expo start          # 手機安裝 Expo Go 掃 QR Code 即可預覽(前景錄音可測)
npx expo start --web    # 電腦瀏覽器預覽
npm run typecheck       # 型別檢查
npm run lint            # 程式碼檢查
```

`android/` 資料夾由 `expo prebuild` 自動產生,不需要上傳到 GitHub(已列在 `.gitignore`)。App 名稱、圖示、啟動畫面、套件名稱 `com.himore.visitpoc` 都在 `app.json`。

---

## 六、之後要接的地方

| 項目 | 現況 | 要改的地方 |
|---|---|---|
| AI 服務(轉文字、整理、題庫比對) | 模擬版:文字與打字內容依規則整理;錄音的逐字稿為固定示範內容 | 新增實作 `AiService` 介面的檔案,在 `src/services/ai/index.ts` 切換 |
| 伺服器與資料共用 | 資料只存在各自的裝置,手機之間不互通 | `src/store/store.ts` 的存取層改為呼叫後端 API;上傳步驟在 `src/services/processing.ts` |
| 登入驗證 | 帳號密碼存在本機,僅供示範 | 改由伺服器驗證 |
| 推播通知 | 以 App 內提示代替 | 接上伺服器後加入系統推播 |
| ERP 拋送 | 後台手動下載 CSV | 串接方式尚待決定 |
| 標誌 | 依官網截圖重製的暫用版 | 以官方檔案覆蓋 `assets/ui/brand/logo_white.png`、`assets/icon.png`、`assets/android-icon-*.png` |

## 七、畫面與檔案對照

| 編號 | 畫面 | 檔案 |
|---|---|---|
| S01 | 登入、首次設定 | `src/app/login.tsx`、`src/app/onboarding.tsx` |
| S02 | 首頁 | `src/app/(tabs)/home.tsx` |
| S03 | 開始記錄(含原 S07 補充資訊) | `src/app/record/start.tsx` |
| S04 | 錄音同意、錄音 | `src/app/record/consent.tsx`、`src/app/record/recording.tsx` |
| S05 | 業務口述 | `src/app/record/dictate.tsx` |
| S06 | 文字輸入 | `src/app/record/text.tsx` |
| S08 | 處理中 | `src/app/visit/[id]/processing.tsx` |
| S09 | 確認與編輯 | `src/app/visit/[id]/confirm.tsx` |
| S10 | 完成 | `src/app/visit/[id]/done.tsx` |
| S12 | 偏好與避免事項 | `src/components/PrefSheet.tsx` |
| S13 | 客戶清單 | `src/app/(tabs)/customers.tsx` |
| S14 | 客戶檔案、拜訪詳情 | `src/app/customer/[id]/index.tsx`、`src/app/visit/[id]/index.tsx` |
| S16 | 拜訪前簡報 | `src/app/customer/[id]/briefing.tsx` |
| S18 | 我的與設定 | `src/app/(tabs)/me.tsx` |
| B1–B5 | 客戶管理、題庫與題組、拜訪安排、拜訪紀錄與匯出、使用狀況與帳號 | `src/app/admin/*.tsx` |
| — | 系統設定、稽核紀錄 | `src/app/admin/settings.tsx` |

素材(A–G 類)在 `assets/ui/`,編號對照在 `src/assets.ts`。

| 設定檔 | 用途 |
|---|---|
| `.github/workflows/deploy-web.yml` | 推送到 main 時部署網頁版到 GitHub Pages |
| `.github/workflows/build-apk.yml` | 打包 Android APK(手動或推送版本標籤) |
| `app.config.js` | 網頁版部署在子路徑(`/<專案名稱>/`)時的網址設定 |
| `scripts/use-release-signing.js` | 有設定正式簽章時,打包改用正式簽章 |


## 本機 AI 伺服器(POC)

`local-ai-server/` 是可以在自己電腦(NVIDIA 顯示卡)執行的 AI 伺服器:Breeze ASR 語音轉文字 + Ollama 開源語言模型分析,全部免費、資料不出電腦。
安裝與使用方式見 [local-ai-server/README.md](local-ai-server/README.md)。App 在「我的 → AI 伺服器」或後台「系統設定」填入網址與金鑰即可切換;沒填就使用模擬 AI。
