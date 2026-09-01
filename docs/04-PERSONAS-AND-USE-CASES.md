# Personas 與 Use Cases

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. Persona P1：前端工程師

### 背景

需要在後端尚未完成、測試環境不穩定或資料難以建立時，持續開發 UI 與錯誤處理。

### Jobs to be Done

- 當我取得 OpenAPI 時，我想快速知道完成一個畫面需要哪些 API；
- 當後端尚未完成時，我想建立、查詢、更新同一筆 Mock 資料；
- 當 API 回 429、500 或 Timeout 時，我想驗證 Loading、Retry 與 Error State；
- 當規格變更時，我想知道哪些前端流程需要調整。

### 成功體驗

不閱讀大量 Wiki，也能在五分鐘內啟動 Mock、建立 Resource 並查回資料。

### 主要需求

FR-IMP、FR-VIS、FR-INF、FR-MCK、FR-EXE。

## 2. Persona P2：後端工程師

### 背景

維護 OpenAPI 與實際服務，希望規格不只通過 Validation，也能描述可用流程。

### Jobs to be Done

- 驗證 Response 是否提供下游需要的欄位；
- 檢查 OpenAPI Link 與 Arazzo 是否可解析；
- 以 Mock/Runner 驗證 Workflow Contract；
- 在 PR 前發現 Breaking Workflow Mapping。

### 成功體驗

可以用 CLI 在 CI 驗證規格、Arazzo 與 Golden Workflow，不需開啟 UI。

### 主要需求

FR-WKF、FR-CLI、FR-EXP、未來 FR-DIF。

## 3. Persona P3：QA／測試工程師

### 背景

需要建立多步情境、邊界狀態與可重現錯誤，而不是只測單一 Endpoint。

### Jobs to be Done

- 建立登入後才可執行的完整流程；
- 固定 Seed 與 Inputs，重現相同結果；
- 注入特定 Attempt 的 429、500 或 Timeout；
- 保存 Snapshot 與 Run Report；
- 比較成功與失敗路徑。

### 成功體驗

一個 Issue 可附上 Project Revision、Seed、Inputs 與 Run Report，其他人能重現。

### 主要需求

FR-MCK、FR-EXE、FR-EXP。

## 4. Persona P4：Tech Lead／架構師

### 背景

負責跨團隊 API 設計、依賴關係與變更風險。

### Jobs to be Done

- 以 Service、Tag、Resource、Workflow 觀看大型拓撲；
- 區分正式宣告與系統推導的關係；
- 找出高耦合 Operation 與共享欄位；
- 評估 API 變更影響的 Workflow；
- 要求團隊將流程保存為標準文件。

### 成功體驗

能從圖形追溯到 OpenAPI Pointer、Arazzo Step 與 Git 內文件，而非只有 Screenshot。

### 主要需求

FR-VIS、FR-WKF、FR-INF、未來 FR-DIF。

## 5. Persona P5：新進工程師

### 背景

不熟悉既有服務與隱含流程。

### Jobs to be Done

- 找出常見任務的起點與順序；
- 理解 Token、ID 與 Status 如何傳遞；
- 用安全的 Mock Environment 練習；
- 從 Trace 了解一次完整執行。

### 成功體驗

可以透過三個預載 Workflow 完成系統導覽，不需先知道所有端點。

### 主要需求

FR-VIS、FR-EXE、文件與 Demo。

## 6. Persona P6：開源專案維護者

### 背景

希望 API 使用範例可執行、可視覺化、可版本控制。

### Jobs to be Done

- 提供免安裝 Playground；
- 將典型流程放在 Arazzo；
- 用 README GIF 讓新使用者快速理解；
- 在 CI 驗證範例仍可執行。

### 成功體驗

使用者在建立 Issue 前，就能用 Playground 重現預期流程。

## 7. Anti-personas

MVP 不為以下需求最佳化：

- 需要 Enterprise API Gateway、Rate Limit Enforcement 或 Production Routing 的平台團隊；
- 需要無限規模持久化與多人權限的雲端測試平台；
- 需要任意程式碼 Plug-in 的高度客製 Service Virtualization；
- 只想查看靜態 Swagger Reference、完全不需要 Workflow 的使用者。

這些使用者可以受益於部分 Export，但不應主導 MVP 範圍。

## 8. Use Case Matrix

| Use Case | P1 | P2 | P3 | P4 | P5 | P6 | MVP |
|---|---:|---:|---:|---:|---:|---:|---|
| 匯入 OpenAPI | ● | ● | ○ | ● | ○ | ● | Yes |
| 查看拓撲 | ● | ● | ○ | ● | ● | ● | Yes |
| 審核 Inference | ● | ● | ○ | ● | ○ | ● | Yes |
| Stateful CRUD | ● | ○ | ● | ○ | ● | ● | Yes |
| Fault Injection | ● | ○ | ● | ○ | ○ | ○ | Yes |
| Arazzo Export | ○ | ● | ● | ● | ○ | ● | Yes |
| CLI CI Validation | ○ | ● | ● | ● | ○ | ● | Yes |
| Flow-aware Diff | ● | ● | ● | ● | ○ | ● | Post-MVP |
| Cloud Collaboration | ○ | ○ | ○ | ● | ○ | ● | No |

`●` 表示主要需求，`○` 表示次要受益。
