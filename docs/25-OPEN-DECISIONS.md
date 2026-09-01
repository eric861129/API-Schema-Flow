# 開工前決策清單

> 狀態：待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：建立 Repository 與第一個 Implementation Plan 之前

## 1. 使用方式

本文件不是未完成需求清單，而是將必須由 Owner 明確接受或修改的選擇集中呈現。每項都已提供建議預設值；若沒有異議，可直接採用建議，不需要重新設計整套方案。

決策完成後：

1. 在「Owner Decision」填入採用內容；
2. 將相關 ADR 狀態改為 `Accepted`；
3. 更新 README/PRD 中受影響的文字；
4. 對會改變實作順序的項目更新 Roadmap；
5. 通過 [Implementation Readiness Checklist](30-IMPLEMENTATION-READINESS-CHECKLIST.md)。

## 2. 必須在建立 Repo 前確認

### OD-001：專案名稱與 Package Scope

**建議預設**

- 品牌名稱：`API Schema Flow`
- GitHub Repository：`api-schema-flow`
- CLI Binary：`schema-flow`
- npm Scope：`@api-schema-flow/*`

**理由**

名稱已能表達 API、Schema 與 Flow，但 `schema-flow` 可能與其他生態名稱重疊。正式建立前應查核 GitHub、npm、網域與主要搜尋結果，避免商標或套件混淆。

**Owner Decision**

```text
採用建議預設；若名稱檢查發現明顯衝突，CLI 優先改為 api-schema-flow。
```

### OD-002：License

**建議預設：Apache License 2.0**

**理由**

- 對企業採用友善；
- 含明確 Patent Grant；
- 允許商業與內部使用；
- 適合作為開發工具與可嵌入核心套件。

**替代方案**

- MIT：更短、更熟悉，但專利條款較弱；
- MPL-2.0：要求修改檔案保持開源，可能降低部分企業採用；
- AGPL-3.0：不符合目前希望廣泛整合與採用的定位。

**Owner Decision**

```text
採用 Apache-2.0；建立 Repo 時加入完整 LICENSE 與必要 NOTICE。
```

### OD-003：DCO 或 CLA

**建議預設：DCO，不要求 CLA**

貢獻者以 Signed-off-by 表示有權提交內容。只有未來成立公司、需要重授權或導入雙授權時才重新評估 CLA。

**Owner Decision**

```text
採用 DCO；PR 檢查 Signed-off-by，初期提供友善修正指引。
```

### OD-004：公開文件語言

**建議預設**

- `README.md`：英文；
- `README.zh-TW.md`：繁體中文；
- 核心技術規格：第一版繁中；
- Public API、CLI、Diagnostic、Code Comment：英文；
- 穩定後把最重要規格整理成英文公開文件。

**理由**

保留作者產出效率，同時讓國際使用者能從 README、CLI 與 API 進入專案。

**Owner Decision**

```text
採用建議預設。
```

## 3. 必須在 M0/M1 前確認

### OD-005：OpenAPI 支援聲明

**建議預設**

- OpenAPI 3.0.x：正式支援；
- OpenAPI 3.1.x：正式支援；
- OpenAPI 3.2.x：Compatibility Mode，解析、保留並對未知語意給 Diagnostic；
- Swagger/OpenAPI 2.0：不列入 MVP Must，可由 Parser 讀取時標示 Experimental。

**Owner Decision**

```text
採用建議預設；不以 Parser 能讀取等同完整產品支援。
```

### OD-006：Arazzo 支援聲明

**建議預設**

- Arazzo 1.1.x：Parse、Validate、Visualize、Preserve；
- MVP Executor：只執行文件化的同步 OpenAPI Execution Profile；
- 非同步 Action、複雜 Control Flow 與未支援 Runtime Expression：Fail Before Send；
- Export 只對可完整表示的 Accepted Graph 提供成功結果。

**Owner Decision**

```text
採用建議預設。
```

### OD-007：Parser 選型

**建議預設**

第一個 OpenAPI Parser Adapter 使用 `@scalar/openapi-parser`，但核心只依賴自有 Adapter Interface 與 Normalized Model。

**退出條件**

若在 Golden Fixtures 發現下列任一問題，改評估替代 Parser 或雙 Parser 驗證：

- Source Pointer 無法滿足 Diagnostic；
- Dereference 行為無法安全限制；
- 重要版本語意遺失；
- Browser/Node Bundle 成本不可接受；
- License 或維護風險改變。

**Owner Decision**

```text
採用 Scalar Adapter 作為第一版，不把其 Type 暴露為 Public API。
```

### OD-008：Runtime Validation Library

**建議預設**

以能同時提供 Runtime Validation、Type Inference 與 JSON Schema Export 的方案為優先；選型由 M0 Spike 比較 Bundle Size、Error Quality、Recursive Schema 與 Browser/Node 支援後決定。

**已鎖定的架構要求**

- Domain Type 不與單一 Validator 深度綁定；
- Config/Project/Report 都能以 JSON Schema 驗證；
- Diagnostic 轉換層統一。

**Owner Decision**

```text
執行小型技術 Spike 後在 M0 以 ADR 補上具體 Library；不影響文件中的資料契約。
```

### OD-009：Package 發布方式

**建議預設**

- MVP 前採 Fixed Version Group；
- 先發布 CLI 與必要核心套件；
- UI/App 不急著拆成可公開 Library；
- 使用 Changesets；
- npm Provenance 與 2FA。

**Owner Decision**

```text
採用建議預設。
```

## 4. 必須在 M2/M3 前確認

### OD-010：Inference 高信心門檻

**建議預設**

- `high`: Score ≥ 0.85 且沒有 Ambiguity Penalty；
- `medium`: 0.60–0.849；
- `low`: < 0.60；
- Generic `id` 單一證據的上限為 Medium；
- 所有 Candidate 仍需人工接受，不因 High 自動進入 Workflow。

實際門檻須由公開 Benchmark 校準，不能只憑直覺固定。

**Owner Decision**

```text
採用作為初始門檻；M2 Benchmark 可調整並記錄版本。
```

### OD-011：Mock Resource 推導範圍

**建議預設**

MVP 自動 Stateful CRUD 只處理可高可信識別的 Resource Pattern：

```text
POST   /resources
GET    /resources
GET    /resources/{id}
PUT    /resources/{id}
PATCH  /resources/{id}
DELETE /resources/{id}
```

對 Nested Resource、Composite Key、Soft Delete、Command Endpoint 只提供 Explicit Override 或 Static Example，不猜測完整生命週期。

**Owner Decision**

```text
採用建議預設。
```

### OD-012：State Persistence

**建議預設**

- Runtime State 預設只在記憶體；
- 使用者可主動 Snapshot；
- Web 的自動恢復只保存 Layout/Decision，不保存 Request Body 或 Secret；
- Durable Database 不屬 MVP。

**Owner Decision**

```text
採用建議預設。
```

### OD-013：MSW Adapter 優先級

**建議預設**

Fastify Adapter 是 MVP 的 Must，因為 CLI 與任意前端程式都能呼叫真正的本機 HTTP Server。MSW Adapter 在核心 Runtime 穩定後列為 Should；若時程壓力高，可移至 Post-MVP。

**Owner Decision**

```text
Fastify 為 Must；MSW 為 Should，不阻擋 MVP。
```

### OD-014：Web 持久化

**建議預設**

Project 透過顯式 Save/Load File 管理；Browser IndexedDB 只做非敏感 Autosave，並可一鍵清除。正式多人 Workspace 不屬 MVP。

**Owner Decision**

```text
採用建議預設。
```

## 5. 必須在 M4/M5 前確認

### OD-015：Live API Execution

**建議預設**

MVP 可提供 Experimental Live Transport，但：

- 預設關閉；
- 每個 Project 明確 Opt-in；
- Host Allowlist；
- 顯示 Side-effect 警告；
- CI 必須明確 Flag；
- Credential 只由執行環境提供，不存入 Project；
- README 不把它列為核心 Demo。

若安全控制未完成，MVP 只執行 Mock Transport。

**Owner Decision**

```text
以安全門檻決定；未通過即延後，不降低安全要求。
```

### OD-016：Retry 預設

**建議預設**

- GET/HEAD/OPTIONS 可依狀態碼與設定 Retry；
- 非 Idempotent Method 預設不 Retry；
- Arazzo/Project 明確宣告 Idempotency 或使用者確認後才例外；
- `Retry-After` 在可解析時優先；
- 最大 Attempts 與總 Timeout 有上限。

**Owner Decision**

```text
採用建議預設。
```

### OD-017：匯出格式

**建議預設的 MVP Must**

- Arazzo YAML；
- Mermaid Markdown；
- Project JSON；
- JSON Run Report。

Markdown Summary 可為 Should。PDF、Postman Collection 與 HAR 不阻擋 MVP。

**Owner Decision**

```text
採用建議預設。
```

### OD-018：Demo 部署

**建議預設**

- GitHub Pages 或 Vercel 部署 Static Playground；
- 只含公開 Synthetic Fixtures；
- 使用 MSW 或內嵌 Runtime，不要求雲端 API；
- 不允許任意 Remote URL Import，或採嚴格 Proxy/Policy；
- 不保存使用者內容。

**Owner Decision**

```text
採用靜態、無帳號、無持久化版本。
```

## 6. 明確延後的決策

下列項目不應阻擋 MVP，也不應在開工時投入設計：

- Cloud Sync 與多人協作；
- AI/LLM Inference；
- Plugin Marketplace；
- Arbitrary Script Sandbox；
- AsyncAPI 完整執行；
- Kubernetes/Enterprise Deployment；
- Postman/Insomnia 完整替代；
- PDF 報告設計系統；
- 商業定價與 Hosted Service；
- Observed Flow 的資料收集方式。

需要啟動其中任一項前，先建立獨立 Product Spec、Threat Model 與 ADR。

## 7. Owner 最終核准摘要

文件審查時只需確認以下摘要是否成立：

```text
1. 名稱：API Schema Flow；CLI schema-flow。
2. License：Apache-2.0；貢獻採 DCO。
3. 標準：OpenAPI 3.0/3.1 正式、3.2 Compatibility；Arazzo 1.1 Parse 完整、Executor 為文件化子集合。
4. 架構：Normalized Domain Model、Evidence-based Inference、Shared Mock Runtime、Fastify Adapter、Local-first。
5. MVP：Import → Review → Stateful Mock → Execute → Trace → Export。
6. 安全：No Telemetry、Loopback Bind、Secret Redaction、Remote Ref Policy、No Arbitrary Code。
7. 延後：Cloud、AI、PDF、Postman、Full AsyncAPI、Plugin。
```

上述七點接受後，文件包可作為第一份 Implementation Plan 的輸入。
