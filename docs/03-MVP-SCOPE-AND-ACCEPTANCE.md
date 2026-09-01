# MVP 範圍與驗收規格

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. MVP 定義

MVP 不是所有規劃功能的縮小版，而是一條完整、可信、可展示的垂直切片：

```text
OpenAPI Import
  → Normalized Graph
  → Declared/Inferred Edge Review
  → Accepted Workflow
  → Stateful Mock Session
  → Workflow Run
  → Live Trace
  → Arazzo/Mermaid Export
```

任何缺少其中一段的版本只能稱為 Prototype 或 Milestone Preview。

## 2. 支援矩陣

| 項目 | MVP 支援 |
|---|---|
| OpenAPI 3.0.x | Supported |
| OpenAPI 3.1.x | Supported |
| OpenAPI 3.2.x | Compatibility Profile；可解析核心 HTTP Operation，未支援功能產生 Diagnostic |
| Swagger 2.0 | Parser 可辨識時提示轉換；不列入正式驗收 |
| Arazzo 1.1.x Import | Supported |
| Arazzo 1.1.x Visualization | Supported |
| Arazzo Sync OpenAPI Execution | Supported Subset |
| Arazzo AsyncAPI Action | Visualize/Preserve Only |
| OpenAPI Link | Supported |
| Callback/Webhook Execution | Not in MVP |
| Stateful CRUD | Supported for recognized resource patterns |
| Arbitrary Resolver Script | Not in MVP |
| Fastify Adapter | Must |
| MSW Adapter | Should；可在 M5 完成 |
| PDF Export | Not in MVP |
| Flow-aware Diff | Post-MVP |

## 3. 必要使用情境

### AC-MVP-001：匯入與瀏覽

**Given** 一份包含 Login、Spaces、Reservations 的 OpenAPI 3.1 YAML  
**When** 使用者在 Web 或 CLI 匯入  
**Then**

- 所有合法 Operations 轉為穩定 Node；
- `$ref` 被解析，但仍能追蹤原始 Source Pointer；
- Error、Warning、Info 可在 Diagnostic Panel 查看；
- 使用者可搜尋 `/reservations` 並開啟 Request/Response Inspector。

### AC-MVP-002：Declared Dependency

**Given** Response 中存在 OpenAPI Link  
**When** 解析完成  
**Then**

- 產生 `provenance=declared` Edge；
- 顯示 Target Operation 與 Parameter Mapping；
- 不以 Confidence Score 降低其權威性；
- Link 無法解析時產生 Error，不得靜默略過。

### AC-MVP-003：Inferred Dependency Review

**Given** `POST /reservations` 回傳 `reservationId`，且 `GET /reservations/{id}` 需要 String Path Parameter  
**When** Inference 執行  
**Then**

- 產生 Candidate Edge；
- Evidence 至少包含名稱相似、Schema 相容與 Resource Pattern；
- 使用者可 Accept、Reject 或將 Mapping 改為其他 Pointer；
- 未 Accept 前不得進入 Exported Workflow。

### AC-MVP-004：Stateful Create and Read

**Given** 空白 Mock Session  
**When**

1. 執行 `POST /reservations`；
2. Runtime 產生 ID 並回傳成功；
3. 執行 `GET /reservations/{id}`；

**Then**

- 第二次請求取得同一 Entity；
- Entity 符合宣告的 Response Schema；
- Trace 顯示 Create Mutation 與 Read；
- 不同 Session 使用相同 ID 也不得共享資料。

### AC-MVP-005：Update and Delete

**Given** 已存在一筆 Reservation  
**When** 執行 PATCH 後再 DELETE  
**Then**

- PATCH 只合併提供的欄位；
- GET 回傳更新值；
- DELETE 後 GET 回傳 OpenAPI 已宣告的 404 或最接近的 Client Error；
- State Revision 依序增加。

### AC-MVP-006：Fault Injection

**Given** Create Reservation 設定第一次回 429、後續正常  
**When** Workflow 有符合條件的有限 Retry  
**Then**

- 第一次 Step Failure 可見；
- Retry 次數與 Delay 符合設定；
- 最終成功時 Trace 保留每次 Attempt；
- 超過 Retry Limit 時 Workflow 失敗，不得無限重試。

### AC-MVP-007：Arazzo Round-trip

**Given** 一份落在 MVP Execution Profile 的 Arazzo 文件  
**When** Import → Visual Edit → Export  
**Then**

- Workflow ID、Step Order、Inputs、Parameters、Request Body、Outputs 與支援的 Criteria 語意不變；
- 不影響執行的 Formatting 可被重新整理；
- 不支援但合法的欄位被 Preserve 或以明確 Lossy Export Warning 阻擋。

### AC-MVP-008：Deterministic Export

**Given** 相同 Project Revision  
**When** 連續匯出 Arazzo、Mermaid 與 Project JSON  
**Then**

- Byte-level Output 在排除 Timestamp 後一致；
- 順序穩定；
- 不包含 Authorization、Cookie、API Key 或使用者標記為 Secret 的值。

### AC-MVP-009：CLI Parity

**Given** 一份可在 UI 執行的 Project  
**When** 透過 CLI `validate`、`run`、`export`  
**Then**

- 使用相同 Validation 與 Execution Core；
- JSON Output 可被 CI 解析；
- Exit Code 符合 CLI Spec；
- 錯誤訊息包含 Code、Message 與 Source Location。

### AC-MVP-010：安全預設

**When** 使用者沒有額外設定  
**Then**

- Web 與 Mock Server 只綁定 `127.0.0.1`；
- 不傳送 Telemetry；
- Remote Ref 遵守大小、Timeout、Redirect 與 Private Network Policy；
- Rendered Markdown 經 Sanitization；
- Run Report 自動 Redact 敏感 Header。

## 4. 明確排除

MVP 不驗收：

- 多人同時編輯；
- 雲端 Project 儲存；
- Production Traffic Proxy；
- 任意 JavaScript Mock Script；
- WebSocket、Kafka、MQTT；
- 完整 AsyncAPI Execution；
- PDF、Postman 或 Insomnia Export；
- AI 推導；
- Database Persistence；
- OpenTelemetry Trace Import；
- GitHub PR Comment Bot。

## 5. 參考 Demo Fixture

MVP 以「空間預約」作為主要 Golden Path：

```text
POST /auth/login
  → GET /spaces/available
  → POST /reservations
  → GET /reservations/{id}
  → PATCH /reservations/{id}
  → DELETE /reservations/{id}
```

至少再提供：

- Petstore：驗證通用 Resource Pattern；
- E-commerce Checkout：驗證 Token、Cart、Order、Payment 與 Fault；
- Multi-file API：驗證 Remote/Relative `$ref` 與多 Source Description。

## 6. Release Candidate Checklist

- 所有 AC-MVP 測試自動化；
- 主要 Browser 與作業系統通過；
- 500 Operation 效能基準達標；
- 無 Critical/High 已知安全問題；
- npm Package 可重現安裝；
- README 由全新環境驗證；
- License、Security、Contribution 與 Changelog 完成；
- Unsupported Features 在 UI、CLI 與文件一致。
