# Arazzo Workflow 支援規格

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 核心決策

Arazzo 是 API Schema Flow 的正式 Workflow 交換格式。自訂 `x-schema-flow-*` 只用於標準未涵蓋的 UI Layout、Mock Behavior 與工具 Metadata，不得重複定義呼叫順序、Step Inputs/Outputs 或標準 Runtime Expression。

## 2. 標準基準

MVP 基準：Arazzo Specification 1.1.x。

支援聲明拆成三層：

1. **Parse/Preserve**：能否讀取並不遺失欄位；
2. **Visualize/Edit**：能否在 UI 正確呈現與修改；
3. **Execute**：是否由 MVP Executor 實際執行。

工具不得只寫「支援 Arazzo」而不說明層級。


### 2.1 規格文字與官方 JSON Schema 的優先順序

驗證不能只依賴單一 JSON Schema。Arazzo 1.1.0 發布後，官方 Issue 已記錄規格文字與 1.1 JSON Schema 之間的潛在不一致，例如：

- `Expression Type Object.version` 在規格文字中可省略並使用預設值，但目前 Schema 仍將其列為 Required；
- `Parameter Object.value` 的 Schema 可能意外排除一般 Object Literal。

因此 MVP 驗證器採：

1. 官方規格文字作為語意基準；
2. 官方 JSON Schema 作為結構驗證的重要輸入；
3. 另加 Semantic Validator 與 Compatibility Exception Registry；
4. 每個 Exception 必須引用上游 Issue、受影響版本、測試與移除條件；
5. 不得為了通過 Schema 而改寫使用者原本合法的語意。

相關上游追蹤：

- https://github.com/OAI/Arazzo-Specification/issues/558
- https://github.com/OAI/Arazzo-Specification/issues/559

## 3. MVP Support Profile

| Feature | Parse/Preserve | Visualize/Edit | Execute |
|---|---:|---:|---:|
| `info` | Yes | Yes | N/A |
| OpenAPI `sourceDescriptions` | Yes | Yes | Yes |
| Arazzo nested source | Yes | Read-only | No |
| AsyncAPI source | Yes | Read-only | No |
| Workflow `inputs` | Yes | Yes | Yes |
| Ordered synchronous `steps` | Yes | Yes | Yes |
| `operationId` | Yes | Yes | Yes |
| `operationPath` | Yes | Yes | Yes |
| `workflowId` step | Yes | Read-only | Limited/No in MVP |
| Parameters | Yes | Yes | Yes |
| Request Body | Yes | Yes | JSON and supported media |
| Step Outputs | Yes | Yes | Yes |
| Workflow Outputs | Yes | Yes | Yes |
| Simple Success Criteria | Yes | Yes | Yes |
| Regex/JSONPath/XPath Criteria | Yes | Read-only or limited | Feature-gated |
| `onFailure: end` | Yes | Yes | Yes |
| `onFailure: retry` | Yes | Yes | Yes, bounded |
| `goto` | Yes | Visualize | No in initial MVP |
| `dependsOn` | Yes | Yes | Sequential dependency validation |
| Async `send`/`receive` | Yes | Visualize | No |
| Components | Yes | Partial | Supported objects only |
| Unknown Extensions | Yes | Inspector | No semantic execution |

任何 Workflow 只要包含不可執行的必要 Feature，Run 前必須列出所有 Blocking Diagnostics。

## 4. Import

Pipeline：

```text
Load
  → Detect Arazzo Version
  → Schema Validation
  → Resolve Source Descriptions
  → Parse Runtime Expressions
  → Map Workflows/Steps
  → Resolve Operations
  → Compute Feature Support
  → Merge with Project Graph
```

### 4.1 Source Description

- `name` 作為 Arazzo Scope Key；
- `url` 依 Arazzo Base URI 規則解析；
- Source 可對應已載入 Project Source，避免重複讀取；
- Fingerprint 不同時提示 Source Drift；
- 多個 Source 中的 Operation ID 必須消除歧義；
- `operationPath` 應保留原始 Reference。

### 4.2 Workflow ID 與 Step ID

- Case-sensitive；
- 在各自 Scope 內唯一；
- 不合法 ID 阻擋 Export；
- UI 顯示名稱可另存，但標準 ID 必須穩定；
- Rename 必須更新所有 Runtime Expression 與 Dependency Reference。

## 5. Runtime Expression

Parser 應建立 AST，而非在執行時以字串切割：

```ts
type RuntimeExpression =
  | InputsExpression
  | StepsOutputExpression
  | RequestExpression
  | ResponseExpression
  | StatusCodeExpression
  | SourceDescriptionExpression
  | WorkflowExpression
  | LiteralInterpolation
```

要求：

- Parse Error 指向欄位位置；
- Expression Reference 建立隱式 Dependency；
- Forward Reference 在順序模式中阻擋執行；
- Interpolation 保留 Value Type：純 Expression 不強制轉 String，嵌入字串才轉為 String；
- Header 名稱依 HTTP 規則 Case-insensitive。

## 6. Graph Mapping

### 6.1 Workflow → Graph

- 每個 Step 對應 Operation Node 的 Workflow Instance；
- Step 順序形成 Control Edge；
- Output Reference 形成 Data Edge；
- `dependsOn` 形成 Dependency Edge；
- `onSuccess`/`onFailure` 形成 Control Branch；
- UI 可切換「Operation Topology」與「Workflow Instance」視圖。

同一 Operation 出現在不同 Step 時，不應只用一個 Step Node，否則 Trace 無法區分。

### 6.2 Graph → Arazzo

只有 Accepted Mapping 可產生 Arazzo。

生成規則：

- 使用者選定 Entry Step 或明確排序；
- 若 Graph 不是單一路徑，必須要求建立多 Workflow 或選擇支援的控制結構；
- Candidate Edge 不輸出；
- Manual/Accepted Inferred Mapping 轉為 Step Parameter、Request Body 或 Output；
- 必須生成合法 Workflow/Step ID；
- 未能無損表達時阻擋並提供原因。

## 7. 執行順序

MVP 同步模式：

- `steps` Array 順序是預設執行順序；
- Step Output Reference 建立隱式前置依賴；
- `dependsOn` 必須被滿足；
- Executor 不自動平行化；
- Forward Reference、Cycle 或缺少 Step 產生 Error；
- Async Action 不進入執行計畫。

## 8. Criteria

初始 Executor 支援 Simple Criteria 的安全子集合：

- `$statusCode` 比較；
- Request/Response Header；
- JSON Pointer 取得的 Scalar；
- `==`, `!=`, `<`, `<=`, `>`, `>=`；
- `&&` 的全部條件語意由 Criteria Array 表達，不在字串內執行任意語言。

Regex、JSONPath、XPath 需要個別安全 Library、Timeout 與資源限制，在支援前標記為 Preserve-only 或 Feature-gated。

## 9. Retry

支援 `onFailure` 中的 `retry`：

- `retryLimit` 有全域硬上限；
- `retryAfter` 有最大等待限制；
- 合法 `Retry-After` Header 可覆蓋，但仍受硬上限；
- 每個 Attempt 進入 Trace；
- Cancellation 立即終止等待；
- 不支援 Retry 指向 Workflow/Step 時，在執行前阻擋；
- 無限 Loop 防護是必需。

## 10. Round-trip

Project 保存：

- Parsed Semantic Model；
- Original Field Order/Comments 能力若 Parser 支援；
- Unknown Extensions；
- Unsupported-but-valid Fields；
- Source Formatting Metadata。

Export Modes：

- `canonical`：穩定排序，適合版本控制；
- `preserve`：盡量保留原始格式；
- `generated`：由 Accepted Graph 建立新文件。

若 `preserve` 無法無損，必須先產生 Warning 並允許改用 `canonical`，不得靜默丟欄位。

## 11. `x-schema-flow` Extension

允許範圍：

```yaml
x-schema-flow:
  layout:
    x: 420
    y: 180
    collapsed: false
  mock:
    delayMs: 800
    failureRate: 0.1
  metadata:
    labels:
      - onboarding
```

禁止：

```yaml
x-schema-flow:
  next: /reservations
  outputMappings: ...
```

呼叫順序與資料傳遞應使用 Arazzo 或 OpenAPI Link。

## 12. 範例

```yaml
arazzo: 1.1.0
info:
  title: Reservation workflows
  version: 0.1.0
sourceDescriptions:
  - name: reservationApi
    url: ./openapi.yaml
    type: openapi
workflows:
  - workflowId: createReservation
    inputs:
      type: object
      required: [username, password]
      properties:
        username:
          type: string
        password:
          type: string
    steps:
      - stepId: login
        operationId: login
        requestBody:
          contentType: application/json
          payload:
            username: $inputs.username
            password: $inputs.password
        successCriteria:
          - condition: $statusCode == 200
        outputs:
          token: $response.body#/token
      - stepId: listSpaces
        operationId: listAvailableSpaces
        parameters:
          - name: Authorization
            in: header
            value: Bearer {$steps.login.outputs.token}
        successCriteria:
          - condition: $statusCode == 200
        outputs:
          spaceId: $response.body#/0/id
      - stepId: create
        operationId: createReservation
        parameters:
          - name: Authorization
            in: header
            value: Bearer {$steps.login.outputs.token}
        requestBody:
          contentType: application/json
          payload:
            spaceId: $steps.listSpaces.outputs.spaceId
        successCriteria:
          - condition: $statusCode == 201
        outputs:
          reservationId: $response.body#/id
    outputs:
      reservationId: $steps.create.outputs.reservationId
```

## 13. Diagnostics

- `ARZ-UNSUPPORTED-VERSION`
- `ARZ-SOURCE-NOT-FOUND`
- `ARZ-OPERATION-NOT-FOUND`
- `ARZ-OPERATION-AMBIGUOUS`
- `ARZ-RUNTIME-EXPRESSION-INVALID`
- `ARZ-FORWARD-REFERENCE`
- `ARZ-DEPENDENCY-CYCLE`
- `ARZ-EXECUTION-FEATURE-UNSUPPORTED`
- `ARZ-LOSSY-EXPORT-BLOCKED`
- `ARZ-RETRY-LIMIT-EXCEEDED`

## 14. Acceptance Criteria

1. 合法 Arazzo 1.1.x 可 Parse 與 Visualize；
2. Unsupported Async Step 被 Preserve 且 Run 前阻擋；
3. Output Reference 轉為 Data Edge；
4. Step Rename 更新所有 Reference；
5. Simple Criteria、Timeout、Bounded Retry 可執行；
6. Import/Export 不遺失未知 Extension；
7. 多 Source Operation 歧義有明確 Error；
8. Candidate Inference 不會自動寫入 Arazzo；
9. Generated Arazzo 通過官方 Schema 與 Semantic Validation；若命中已驗證的規格／Schema 不一致，必須由版本化 Compatibility Exception 明確說明。
