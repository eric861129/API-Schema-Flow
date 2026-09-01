# 名詞表

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01

本文件統一 API Schema Flow 的產品、標準與工程用語。程式碼 Public Type 與 UI 文案應盡可能遵守本表。

| 名詞 | 定義 |
|---|---|
| API Schema Flow | 本專案名稱；把 OpenAPI/Arazzo 轉成可視化、可執行、可模擬 Workflow 的 Local-first Workbench。 |
| OpenAPI Document | 描述 HTTP API Surface 的 OpenAPI 文件。 |
| Arazzo Document | 描述 API 呼叫序列、依賴、輸入、輸出與條件的 Workflow 文件。 |
| Source | 一份本機或遠端 OpenAPI/Arazzo 原始文件及其來源資訊。 |
| Source Pointer | 指回原始文件位置的 JSON Pointer、行列或 URI Fragment。 |
| Normalized Model | 將不同 OpenAPI 版本與 Parser 輸出轉換後的內部版本無關模型。 |
| Operation | Method + Path 對應的一次 API 操作。 |
| Operation Key | 在 Project 中穩定識別 Operation 的 Key，優先使用來源與 Method/Path，不只依賴可能重複的 `operationId`。 |
| Endpoint Node | 畫布上代表一個 Operation 的節點。 |
| Workflow | 為完成目的而排列、映射並驗證的一組 Steps。 |
| Step | Workflow 中的一次 Operation 呼叫或受支援 Action。 |
| Edge | Node/Step 間的方向性關係。 |
| Mapping | 將上游值放入下游 Path、Query、Header、Cookie 或 Body 的定義。 |
| Declared Edge | 由 Arazzo 或 OpenAPI Link 明確宣告的關係。 |
| Manual Edge | 使用者直接建立或修改的關係。 |
| Inferred Edge | 工具依規則建議、但尚未由使用者接受的關係。 |
| Observed Edge | 未來由 Trace、HAR、Proxy 或 Telemetry 證據建立的關係；不屬 MVP。 |
| Provenance | Edge 的來源類型、來源文件與產生方法。 |
| Candidate | 尚未被使用者接受的推導結果。 |
| Evidence | 支持某個 Candidate 的可讀與可機器處理證據。 |
| Confidence | 推導模型對 Candidate 的相對信心分數；不是事實機率。 |
| Decision | 使用者對 Candidate 的 `accepted`、`rejected` 或 `edited` 結果。 |
| Rule | 產生或調整 Candidate 分數的確定性推導邏輯。 |
| Resource | Mock Runtime 管理的一類 Entity 集合。 |
| Entity | Resource 中的一筆狀態化資料。 |
| Resource Lifecycle | Create、List、Read、Update、Delete 與狀態轉換行為。 |
| Stateful Mock | 後續回應會受先前 Request 所造成 State Mutation 影響的 Mock。 |
| Mock Runtime | 協定中立、負責 Route、State、Fault 與 Response 的核心。 |
| Adapter | 把 Framework/Transport 請求轉成核心介面的薄層，例如 Fastify 或 MSW。 |
| Session | 隔離 Store、Seed、ID Sequence、Fault Counter 與 Trace 的執行範圍。 |
| Seed | 讓 Fake Data、Random Failure 與 ID Generation 可重現的初始值。 |
| Snapshot | 某 Session 在特定時間的可驗證 State 表示。 |
| Fault Profile | Delay、Jitter、Forced Status、Failure Rate、Timeout 等錯誤注入設定。 |
| Scenario | 一組可重現的 Seed、Fault、Inputs 與預期結果。 |
| Workflow Executor | 解析 Arazzo 支援子集合並逐步建構/發送 Request 的元件。 |
| Runtime Expression | Arazzo/OpenAPI 用來引用 Input、Request、Response、Step Output 等值的表達式。 |
| Transport | Executor 發送 Request 的抽象，可指向 Mock 或 Live HTTP。 |
| Live Execution | 對真實 API Host 發送 Request；預設關閉。 |
| Run | 一次 Workflow 執行實例。 |
| Attempt | 某 Step 的一次實際發送；Retry 會產生多個 Attempts。 |
| Trace Event | Run 中的結構化事件，例如 Step Started、Response Received、State Mutated。 |
| Run Report | 可持久化、已遮罩的 Run 摘要與事件資料。 |
| Diagnostic | 具有穩定 Code、Severity、位置與建議的問題描述。 |
| Redaction | 在呈現或持久化前移除/替換 Secret 的處理。 |
| Project | 將 Sources、Graph、Decisions、Layout、Mock 與執行設定組合的版本化文件。 |
| Execution Profile | 本工具對 Arazzo 的實際可執行功能子集合。 |
| Parse Support | 能讀取、驗證、保留並顯示某標準欄位。 |
| Execution Support | 能正確執行某標準欄位的語意；與 Parse Support 分開聲明。 |
| Compatibility Mode | 可解析較新規格並保留內容，但不保證所有新增語意都已完整正規化或執行。 |
| Round-trip Preservation | 匯入後再匯出仍保留不支援但合法的內容，且不無聲丟失。 |
| Deterministic | 在相同輸入、設定、Seed 與版本下產生相同可觀察結果。 |
| Flow-aware Diff | 從 API Schema 變更追蹤至 Mapping、Step 與 Workflow 影響的分析。 |
| Vertical Slice | 從匯入到 Export 的一條完整可使用路徑，而不是各模組只有骨架。 |
| Local-first | 核心能力在本機完成，不要求把規格或 Trace 上傳至雲端。 |
| Control Plane | 啟停、Reset、Snapshot、Fault 等管理能力。 |
| Data Plane | 一般前端/測試程式呼叫的 Mock API。 |
| Golden Fixture | 固定輸入與經審查預期輸出的測試資料。 |
| ADR | Architecture Decision Record，記錄重要架構選擇、理由與後果。 |
| MVP | 能完成正式定義垂直旅程並通過 Release Gate 的第一個可用版本，不等於 Demo。 |

## 用語限制

- 不以「AI」稱呼確定性 Inference Rule；
- 不把 Candidate 稱為已發現的商業流程；
- 不把 MSW Adapter 稱為真正的獨立 HTTP Server；
- 不把 Parse Support 寫成完整 Execution Support；
- 不把 Static Example Mock 稱為 Stateful Mock；
- 不把 Confidence 當成可校準的成功機率，除非未來有正式模型與驗證；
- 不在功能仍屬 Roadmap 時使用現在式宣稱已提供。
