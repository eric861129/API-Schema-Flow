# 產品需求文件（PRD）

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 文件摘要

API Schema Flow 將 OpenAPI/Arazzo 轉換為可互動的 API Workflow Workspace。MVP 必須完成一條端到端垂直流程：匯入規格、建立拓撲、審核依賴、啟動 Stateful Mock、執行 Workflow、查看 Trace、匯出標準文件。

## 2. 背景與機會

OpenAPI 主要描述 API Surface。即使端點定義完整，跨端點資料傳遞與商業流程仍常散落在文件、測試碼與人員知識中。前端開發因缺乏可連續操作的後端而阻塞；QA 難以快速建立狀態與錯誤情境；架構審查也難以直接判斷欄位變更的下游影響。

Arazzo 已提供描述 API 呼叫序列與依賴的正式規格，因此本專案應將 OpenAPI 與 Arazzo 組合，而非使用封閉的 Workflow DSL。

## 3. 產品目標

| ID | 目標 | 成功判斷 |
|---|---|---|
| GOAL-001 | 降低理解 API 流程的時間 | 使用者可由拓撲與 Inspector 找出一條完整流程 |
| GOAL-002 | 降低前端等待後端的時間 | 可在本機以 Stateful Mock 完成 CRUD 流程 |
| GOAL-003 | 提升流程文件的可維護性 | Accepted Flow 可輸出 Arazzo 並進入版本控制 |
| GOAL-004 | 提高自動推導可信度 | 每個 Candidate Edge 皆有 Evidence、Confidence、Status |
| GOAL-005 | 建立未來變更影響分析基礎 | Domain Model 能追蹤 Operation、Field Mapping 與 Workflow |
| GOAL-006 | 保護內部 API 資訊 | 預設 Local-first、No Telemetry、Sensitive Data Redaction |

## 4. 非目標

- GOAL-NO-001：MVP 不提供 Cloud Workspace 或多人即時協作。
- GOAL-NO-002：MVP 不提供完整 API Gateway、Production Proxy 或 Service Mesh。
- GOAL-NO-003：MVP 不執行任意使用者 JavaScript。
- GOAL-NO-004：MVP 不宣稱能從 OpenAPI 自動還原正確商業流程。
- GOAL-NO-005：MVP 不完整執行 AsyncAPI 與 Arazzo 非同步 Action。
- GOAL-NO-006：MVP 不將 PDF、Postman Collection 與 AI 推導列為必要交付。

## 5. 使用者旅程

### Journey A：前端工程師建立預約頁面

1. 匯入 `openapi.yaml`；
2. 看到 Login、Spaces、Reservations Operations；
3. 審核 `token → Authorization`、`spaceId → requestBody.spaceId`；
4. 接受候選 Edge；
5. 啟動 Mock Session；
6. 建立 Reservation；
7. 用回傳 ID 查詢同一筆資料；
8. 將 Workflow 匯出成 Arazzo 並提交至 Repo。

### Journey B：QA 驗證錯誤處理

1. 開啟既有 Arazzo Workflow；
2. 將 Create Reservation 設定為 800 ms Delay；
3. 將第一次呼叫設定為 429；
4. 執行 Workflow；
5. 檢查 Retry 與最終成功；
6. 匯出 Run Report，供 Issue 附件使用。

### Journey C：Tech Lead 審查 API 變更

1. 載入 Base 與 Head OpenAPI；
2. 系統找出被刪除或改型的 Response Field；
3. 由 Field Mapping 反查受影響 Workflow；
4. 產生 Markdown/JSON Impact Report。

Journey C 屬 Post-MVP，但 Domain Model 必須在 MVP 就保留所需關係。

## 6. 功能需求

### 6.1 OpenAPI 匯入

| ID | Priority | 需求 |
|---|---|---|
| FR-IMP-001 | Must | 匯入本機 YAML/JSON 檔案 |
| FR-IMP-002 | Must | 匯入 HTTP/HTTPS URL，受安全政策限制 |
| FR-IMP-003 | Must | 解析跨檔 `$ref` 並保留來源位置 |
| FR-IMP-004 | Must | 將 Parser 結果轉為版本無關 Normalized Model |
| FR-IMP-005 | Must | 顯示具 Source Pointer 的 Error/Warning/Info |
| FR-IMP-006 | Should | 支援 Drag-and-drop |
| FR-IMP-007 | Should | 對重複 Operation ID、無法解析 Reference 與不支援版本提供修復建議 |

### 6.2 視覺化拓撲

| ID | Priority | 需求 |
|---|---|---|
| FR-VIS-001 | Must | 每個 Operation 以 Endpoint Node 呈現 |
| FR-VIS-002 | Must | ELK 計算 Layered Layout，使用者可重新排版 |
| FR-VIS-003 | Must | 依 Tag、Service、Workflow 或 Resource 分組 |
| FR-VIS-004 | Must | Inspector 顯示 Parameters、Request Body、Responses、Security、Examples |
| FR-VIS-005 | Must | 搜尋 Method、Path、Operation ID、Tag 與 Schema Field |
| FR-VIS-006 | Must | Edge 顯示 Provenance、Mapping 與 Status |
| FR-VIS-007 | Should | 儲存使用者位置與收合狀態，不污染 Arazzo 標準欄位 |

### 6.3 Workflow 與依賴

| ID | Priority | 需求 |
|---|---|---|
| FR-WKF-001 | Must | 匯入並驗證 Arazzo 1.1.x |
| FR-WKF-002 | Must | 解析 OpenAPI Link 為 Declared Edge |
| FR-WKF-003 | Must | 使用者可建立、刪除與修改 Manual Edge |
| FR-WKF-004 | Must | Accepted Graph 可輸出為 Arazzo |
| FR-WKF-005 | Must | 匯入時保留不執行但合法的 Arazzo 欄位 |
| FR-WKF-006 | Must | 執行支援層級必須在 UI 與 CLI 明確呈現 |
| FR-WKF-007 | Should | 支援 Workflow Inputs、Outputs 與 Success Criteria 編輯 |

### 6.4 Flow Inference

| ID | Priority | 需求 |
|---|---|---|
| FR-INF-001 | Must | 從 Response Field 找出可能的 Path/Query/Header/Body Target |
| FR-INF-002 | Must | 每個結果包含 Rule ID、Evidence、Score 與 Source/Target Pointer |
| FR-INF-003 | Must | Candidate 預設不進入正式 Workflow |
| FR-INF-004 | Must | 使用者可 Accept、Reject、Edit |
| FR-INF-005 | Must | 相同輸入與設定產生相同 Candidate 與排序 |
| FR-INF-006 | Must | Generic `id` 不得單獨形成 High-confidence Edge |
| FR-INF-007 | Should | 支援 Auth Token、Resource Lifecycle、名稱正規化與 Schema Compatibility Rules |
| FR-INF-008 | Should | 可輸出匿名化 Inference Quality Report |

### 6.5 Stateful Mock

| ID | Priority | 需求 |
|---|---|---|
| FR-MCK-001 | Must | 依 Operation 與 Schema 建立 In-memory CRUD Behavior |
| FR-MCK-002 | Must | POST 建立的 Entity 可由後續 GET 取得 |
| FR-MCK-003 | Must | PUT/PATCH 更新 State；DELETE 後 GET 回應已宣告的 Not Found Status |
| FR-MCK-004 | Must | 每個 Session 的 Store、ID Sequence 與 Fault State 隔離 |
| FR-MCK-005 | Must | 支援 Seed、Reset、Snapshot、Restore |
| FR-MCK-006 | Must | 支援 Fixed Delay、Jitter、Forced Status、Failure Rate、Timeout |
| FR-MCK-007 | Must | 核心 Runtime 不依賴 Fastify 或 MSW |
| FR-MCK-008 | Should | 支援 List Pagination 的基本推導 |
| FR-MCK-009 | Should | 支援 User-defined Seed Data，但不得含未遮罩 Secret |

### 6.6 Workflow Execution 與 Trace

| ID | Priority | 需求 |
|---|---|---|
| FR-EXE-001 | Must | 執行同步 OpenAPI Arazzo Steps |
| FR-EXE-002 | Must | 解析 Inputs、Parameters、Request Body 與 Step Outputs |
| FR-EXE-003 | Must | 支援 Timeout、Cancellation 與有限 Retry |
| FR-EXE-004 | Must | 每個 Step 產生開始、完成、失敗與輸出事件 |
| FR-EXE-005 | Must | Trace 顯示 Duration、Status、Mapping、Redacted Request/Response、State Mutation |
| FR-EXE-006 | Must | 不支援的 Arazzo Feature 必須在執行前阻擋並列出 Diagnostic |
| FR-EXE-007 | Should | Live Server 執行需明確 Opt-in，且顯示目標 Host |
| FR-EXE-008 | Should | Run Report 可重現 Seed、Inputs 與 Project Revision |

### 6.7 CLI 與 Export

| ID | Priority | 需求 |
|---|---|---|
| FR-CLI-001 | Must | 提供 `open`、`validate`、`infer`、`mock`、`run`、`export` |
| FR-CLI-002 | Must | 支援人類可讀與 `--json` 輸出 |
| FR-CLI-003 | Must | Exit Code 穩定且有文件 |
| FR-EXP-001 | Must | Arazzo Export deterministic 且不輸出 Secret |
| FR-EXP-002 | Must | Mermaid Export 可在 GitHub Markdown 呈現 |
| FR-EXP-003 | Must | JSON Run Report 含版本與 Redaction Metadata |
| FR-EXP-004 | Should | Project JSON 可保存 UI Layout、Accepted/Rejected Decisions 與 Mock Config |

### 6.8 Flow-aware Diff

| ID | Priority | 需求 |
|---|---|---|
| FR-DIF-001 | Post-MVP | 比較兩份 Normalized OpenAPI |
| FR-DIF-002 | Post-MVP | 由 Field Mapping 反查受影響 Workflow |
| FR-DIF-003 | Post-MVP | 輸出 Markdown、JSON 與 CI-friendly Result |
| FR-DIF-004 | Post-MVP | 區分 Breaking、Potentially Breaking、Non-breaking 與 Documentation-only |

## 7. 非功能需求摘要

- NFR-PERF：500 Operations 的匯入與第一版 Layout 必須在互動可接受時間內完成；
- NFR-SEC：Local-only bind、Redaction、Remote Ref Policy、Markdown Sanitization；
- NFR-REL：相同輸入與 Seed 行為可重現；
- NFR-ACC：鍵盤可達、Reduce Motion、非顏色唯一編碼；
- NFR-MNT：核心 Package Coverage 與明確 Dependency Direction；
- NFR-PORT：支援主要桌面作業系統與 Active LTS Node.js。

完整指標見 [18-NON-FUNCTIONAL-REQUIREMENTS.md](18-NON-FUNCTIONAL-REQUIREMENTS.md)。

## 8. 優先級

### Must

完成 Import → Review → Mock → Run → Export 的垂直流程。

### Should

明顯提升可用性，但不阻擋第一個可用 Release，例如 Drag-and-drop、基本 Pagination、MSW Playground。

### Could

PDF、Postman Export、Observed Trace、Plugin、Persistence。

### Will Not in MVP

Cloud Collaboration、Arbitrary Script、Full AsyncAPI、AI-only Inference。

## 9. 主要風險

| 風險 | 影響 | 對策 |
|---|---|---|
| OpenAPI 無法表達商業意圖 | 推導誤判 | Candidate + Evidence + Human Review |
| Stateful CRUD 過度泛化 | Mock 行為不可信 | 支援層級、Explicit Override、Fixture Tests |
| Arazzo 功能範圍快速膨脹 | Executor 難以完成 | 定義 MVP Execution Profile |
| 大型圖難以閱讀 | 視覺化失效 | Group、Filter、Progressive Disclosure、Worker Layout |
| URL/$ref 造成 SSRF | 安全風險 | Local/Cloud 不同 Policy、Private Network Block |
| Secret 進入 Trace/Export | 資料外洩 | Header/Field Redaction、No Persistence by Default |
| 工具變成另一個 Postman | 失焦 | 嚴格 Non-goals 與 Roadmap Gate |

## 10. MVP Release Gate

只有在下列條件全部成立時，才可稱為 MVP：

1. Reservation Vertical Slice 通過；
2. High-confidence Inference Precision 達標；
3. Session Isolation 與 Secret Redaction 有自動測試；
4. Arazzo 支援矩陣與 Unsupported Diagnostics 完整；
5. CLI、Web 與 Export 使用相同 Domain Model；
6. README 的 Quickstart 能由全新環境重現；
7. 安全政策、License 與貢獻文件完成；
8. 沒有宣稱未實作或僅實驗性的功能。
