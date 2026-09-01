# 標準與技術基線

> 狀態：2026-09-01 基準，實作前需重新驗證套件版本  
> 文件版本：0.1.0  
> 最後更新：2026-09-01

## 1. 目的

本文件記錄規格設計當下採用的標準基線，避免將「Parser 可讀」、「本專案正式支援」與「Executor 能完整執行」混為一談。

套件版本屬實作決策，建立 Repo 時應重新鎖定；標準支援聲明則由 Compatibility Tests 與 Support Matrix 決定。

## 2. OpenAPI

### 基準

- OpenAPI Specification 官方最新公開版本：3.2.0；
- MVP 正式支援目標：3.0.x、3.1.x；
- 3.2.x：Compatibility Mode，能解析與保留時不得無聲降級；
- Swagger/OpenAPI 2.0：不列入 MVP 必要支援。

官方來源：

- https://spec.openapis.org/oas/latest.html
- https://spec.openapis.org/oas/v3.2.0.html

### 產品解讀

OpenAPI 是 Operation、Schema、Parameter、Security、Link、Example 與 Server 的主要來源。它通常不能單獨表達完整商業 Workflow，因此不可只靠欄位名稱宣稱已還原正確流程。

OpenAPI Link Object 應轉為 `Declared Edge`，因為它明確描述 Response 與後續 Operation 的關係。Link 不取代完整 Workflow。

## 3. Arazzo

### 基準

- Arazzo Specification 官方最新公開版本：1.1.0；
- 發布日期：2026-05-17；
- MVP 以 Arazzo 作為正式 Workflow 交換格式。

官方來源：

- https://spec.openapis.org/arazzo/latest.html
- https://spec.openapis.org/arazzo/v1.1.0.html
- https://github.com/OAI/Arazzo-Specification

### 產品解讀

Arazzo 用於描述：

- API 呼叫序列；
- Step 間依賴；
- Inputs/Parameters/Request Body；
- Step Outputs；
- Runtime Expression；
- Success Criteria；
- Workflow Outputs。

API Schema Flow 分開聲明：

| 層級 | 意義 |
|---|---|
| Parse | 能讀取欄位並建立語法/結構 Diagnostic |
| Preserve | 即使不能執行，也能在 Project/Round-trip 保留合法內容 |
| Visualize | 能以 Node/Edge/Inspector 呈現 |
| Edit | 能安全修改且不遺失語意 |
| Export | 能輸出合法、可驗證文件 |
| Execute | 能依規格正確執行該能力 |

MVP 不因「能 Parse Arazzo 1.1」就宣稱「完整執行 Arazzo 1.1」。


### 3.1 1.1.0 驗證注意事項

截至本文件日期，Arazzo 官方 Repository 仍有 1.1 規格文字與發布 JSON Schema 可能不一致的公開 Issue，包括 `Expression Type Object.version` 的 Required 定義，以及 `Parameter Object.value` 對一般 Object Literal 的限制。

因此：

- 官方 JSON Schema 不是唯一語意來源；
- Validator 必須同時有 Semantic Checks；
- Verified Exception 需以版本化 Registry 管理；
- 只有上游修正並經 Fixture 驗證後才能移除 Exception；
- Project Export 不得為了迎合已知 Schema 問題而無聲改變使用者資料。

追蹤：

- https://github.com/OAI/Arazzo-Specification/issues/558
- https://github.com/OAI/Arazzo-Specification/issues/559

## 4. OpenAPI Parser

### 第一選擇

`@scalar/openapi-parser`

官方來源：

- https://github.com/scalar/scalar/tree/main/packages/openapi-parser
- https://www.npmjs.com/package/@scalar/openapi-parser

採用理由：

- 支援現代 OpenAPI 版本；
- 可在 Browser/Node 情境使用；
- 能作為 Parse/Dereference 的起點。

架構限制：

- Parser-specific Type 不進入 Domain/Public API；
- Source Pointer、Remote Loader、安全 Budget 由本專案封裝；
- 以 Golden Fixtures 驗證實際語意；
- 若不符合需求，可替換 Adapter。

備選：

- `@apidevtools/swagger-parser`
- 其他通過相同 Parser Contract 的實作

## 5. Canvas 與 Layout

### React Flow

官方來源：

- https://reactflow.dev/
- https://github.com/xyflow/xyflow

用途：

- Custom Node；
- Edge；
- Selection；
- Viewport；
- Keyboard/Accessibility 基礎；
- Mini-map 與互動。

本專案不把 Workflow Domain Model 直接存成 React Flow Node/Edge；UI Adapter 負責轉換。

### ELK.js

官方來源：

- https://github.com/kieler/elkjs

用途：

- Layered/Hierarchical Layout；
- Port-aware Edge Routing；
- 大型 DAG 排版。

本專案以 `GraphLayoutEngine` 封裝，避免 ELK Options 滲透至 Domain。

## 6. Mock Transport

### Fastify

官方來源：

- https://fastify.dev/
- https://github.com/fastify/fastify

角色：真正啟動本機 HTTP Server，供任意 Frontend、CLI 或 Test Client 呼叫。

### MSW

官方來源：

- https://mswjs.io/
- https://github.com/mswjs/msw

角色：在 Browser 或 Node Test Process 中攔截 Request，用於 Playground、Component Test 與 Browser-only Demo。

重要邊界：MSW 的 Node `setupServer` 是 Request Interception，不是建立一個可由外部 Process 存取的獨立 HTTP Server。因此 Fastify/MSW 必須是 Shared Mock Runtime 的不同 Adapter，不可互相取代或混為同一層。

## 7. Package 與 Runtime 基線

實作開始時鎖定：

- Node.js Active LTS；
- pnpm；
- TypeScript；
- React；
- Vite；
- Tailwind CSS；
- Turborepo；
- Fastify；
- MSW；
- React Flow；
- ELK.js；
- Runtime Validator；
- Test Runner/E2E Runner。

每個主要依賴需記錄：

```yaml
name:
version:
license:
source:
reason:
browserImpact:
nodeImpact:
securityNotes:
replacementBoundary:
```

## 8. 格式與協定

- JSON Pointer：依 OpenAPI/Arazzo 使用情境；
- URI/URL：遵守 WHATWG/相關 RFC 的安全解析；
- Date/Time：RFC 3339 UTC；
- HTTP Status/Headers：保留重複 Header 與大小寫語意；
- JSON：UTF-8；
- YAML：只解析安全資料型別，不允許自訂可執行 Tag；
- Markdown：CommonMark-compatible，渲染前 Sanitization；
- Mermaid：輸出 GitHub 可渲染的保守語法子集合。

## 9. Accessibility 與 Security 基線

- Web Accessibility 目標：WCAG 2.2 AA；
- 威脅分類：以 STRIDE 思考，但控制以本專案 Threat Model 為準；
- npm Supply Chain：2FA、Provenance、Frozen Lockfile、Package Content Review；
- Telemetry：預設關閉；
- Remote Ref/Live Host：Allowlist 與 SSRF 防護；
- Arbitrary Code：MVP 禁止。

## 10. 基線更新政策

以下情況更新本文件：

- OpenAPI/Arazzo 發布新版本；
- Parser 或 Runtime Library 改變正式支援；
- 發現標準解讀錯誤；
- Public Support Matrix 改變；
- 主要依賴更換；
- Security Advisory 需要限制版本。

更新標準基線不會自動改變 MVP Scope；需另外更新 PRD、Spec、Tests 與 Release Note。
