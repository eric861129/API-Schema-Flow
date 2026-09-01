# Product Vision

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 一句話定位

> **API Schema Flow 是 OpenAPI 的可執行工作流程層：它讓團隊看見 API 如何串接、確認資料如何傳遞，並在真實後端尚未完成前執行具有狀態的流程。**

英文定位：

> **The executable workflow layer for OpenAPI.**

## 2. 問題陳述

大型前後端或微服務系統常以 OpenAPI 描述個別端點，但端點清單不足以表達完整使用者任務。團隊仍需透過口頭說明、Wiki、Postman Collection、測試碼與經驗拼湊下列資訊：

- 端點的執行先後；
- Response 欄位如何映射到下游 Path、Query、Header 或 Body；
- Token、Resource ID 與狀態如何延續；
- 哪些 API 共同構成登入、預約、結帳或取消流程；
- API 變更會破壞哪些 Workflow；
- 後端未完成時如何提供可連續操作的 Mock Environment。

結果是前端等待後端、QA 難以重現情境、新成員不易理解系統，且 API 變更通常只在整合後才被發現。

## 3. 產品信念

### 3.1 規格不應只描述「有什麼」

好的 API 文件也應說明「如何完成一件事」。Arazzo 提供標準化 Workflow 表達；工具應優先採用標準，而非建立封閉格式。

### 3.2 自動推導應該協助決策，不應偽裝成事實

OpenAPI 缺少完整商業意圖。系統可以提出候選關係，但必須顯示 Evidence、Confidence 與來源，並保留人工確認。

### 3.3 Mock 的價值在於生命週期，而不是隨機 JSON

前端真正需要的是「建立後能查到、更新後狀態會變、刪除後回 404」的可預期環境，而非每次都回傳互不相干的 Faker 資料。

### 3.4 視覺化必須可執行

拓撲圖不是裝飾。每個 Node、Edge、Mapping、Workflow Step 與 Trace Event 都應對應到可驗證的資料模型與執行行為。

### 3.5 Local-first 是預設信任模型

API 規格與 Trace 可能包含內部路徑、Schema、Secret 與業務資訊。MVP 應在本機完成解析、Mock 與視覺化，沒有預設上傳與 Telemetry。

## 4. 目標使用者

- 前端工程師：在後端未完成前取得可連續操作的 API；
- 後端工程師：檢查規格是否足以支撐實際流程；
- QA／測試工程師：建立可重現的多步情境與錯誤注入；
- 架構師／Tech Lead：理解跨服務依賴與變更影響；
- 新進工程師：透過 Workflow 而非端點清單理解系統；
- 開源維護者：提供互動式、可執行的 API 使用範例。

## 5. 核心價值主張

### 5.1 Understand

把端點、Schema、Security 與 Link 轉換為可搜尋、可分組、可追溯的拓撲。

### 5.2 Confirm

將推導出的關係視為 Candidate，讓使用者接受、拒絕或修改 Mapping。

### 5.3 Execute

把 Accepted Flow 轉為 Arazzo Workflow，對 Mock 或明確允許的 Live Server 執行。

### 5.4 Simulate

以 Session-isolated Stateful Runtime 模擬 Resource Lifecycle、延遲、429、500、Timeout 與 Retry。

### 5.5 Protect

後續透過 Flow-aware Diff 指出 API 變更影響的 Workflow、Step 與 Mapping。

## 6. 差異化

API Schema Flow 的核心組合不是單一功能，而是完整閉環：

```text
OpenAPI
  → Normalize
  → Declared + Inferred Dependencies
  → Human Review
  → Arazzo
  → Stateful Mock
  → Workflow Execution
  → Live Trace
  → Change Impact
```

市場上已有 API Visualizer、Mock Server、Workflow Runner 與 Diff Tool；本專案的價值是讓它們共享同一個 Versioned Domain Model，並提供低摩擦的本機體驗。

## 7. North-star Outcome

> 使用者能在五分鐘內，從一份既有 OpenAPI 文件完成「看懂流程、確認一條資料依賴、啟動 Mock、建立並查回一筆資料、匯出 Arazzo」。

這個 Outcome 比 Star、頁面停留時間或節點動畫更能代表實際價值。

## 8. 產品原則

1. **Standards first**：Arazzo、OpenAPI Link、JSON Schema 與標準 Runtime Expression 優先。
2. **Evidence over magic**：每個推導都能解釋。
3. **Local by default**：不要求帳號、不預設上傳。
4. **Deterministic core**：相同輸入、設定與 Seed 產生相同結果。
5. **Adapters at the edge**：框架只存在於邊界。
6. **Vertical slices**：每個 Milestone 都能從匯入走到可觀察輸出。
7. **Honest compatibility**：解析、視覺化與執行支援分開聲明。
8. **Safe failure**：不支援時提供可定位的 Diagnostic，而不是靜默忽略。

## 9. 非目標

- 取代完整 API Client 或 Postman；
- 成為生產 API Gateway、Service Mesh 或 Observability Backend；
- 從欄位名稱自動「理解」所有商業流程；
- 在 MVP 執行任意 JavaScript、外部二進位或 Plug-in；
- 提供雲端多人協作、帳號、Billing 與企業權限；
- 第一版支援所有 AsyncAPI、Webhook、Callback 與 Arazzo 分支語意；
- 用華麗動畫掩蓋不可靠的資料模型。
