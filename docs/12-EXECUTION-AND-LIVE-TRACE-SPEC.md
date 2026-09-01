# Workflow Execution 與 Live Trace 規格

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 目標

Executor 將可執行的 Arazzo Workflow 轉成具備輸入驗證、資料傳遞、HTTP 呼叫、成功判斷、有限重試與可觀察 Trace 的執行計畫。

Executor 不依賴 UI，也不預設只執行 Mock。相同核心可使用：

- Mock Transport；
- Live HTTP Transport；
- Test Transport。

## 2. Execution Profile

MVP 支援：

- OpenAPI Source；
- 同步 Ordered Steps；
- `operationId` / `operationPath`；
- Workflow Inputs；
- Parameters；
- JSON Request Body；
- Step/Workflow Outputs；
- Simple Success Criteria；
- Timeout；
- `onFailure: end`；
- Bounded `retry`；
- Explicit Cancellation。

MVP 不執行：

- AsyncAPI `send`/`receive`；
- Arbitrary Parallel Graph；
- `goto`；
- Callback/Webhook Wait；
- Retry 指向另一 Workflow/Step；
- XPath/不受限 JSONPath；
- Arbitrary Script Transform。

## 3. 執行前 Validation

```text
Resolve Workflow
  → Validate Inputs Schema
  → Resolve Every Operation
  → Analyze Feature Support
  → Build Dependency Graph
  → Detect Cycle/Forward Reference
  → Validate Runtime Expressions
  → Validate Required Parameter Coverage
  → Select Server/Transport
  → Produce Execution Plan
```

所有 Blocking Diagnostic 必須一次列出，不應只修一個再發現下一個。

## 4. Execution Plan

```ts
interface ExecutionPlan {
  projectRevision: number
  workflowId: string
  steps: PlannedStep[]
  dependencies: PlannedDependency[]
  mode: 'mock' | 'live'
  targetServers: string[]
  supportProfile: string
}
```

Plan 產生後應 Immutable。執行中 Project 改變不影響既有 Run；新 Run 使用新 Revision。

## 5. Step Lifecycle

```text
pending
  → resolving
  → ready
  → running attempt
  → evaluating
  → passed
  → failed
  → retry-wait
  → running attempt ...
```

Terminal：

- passed；
- failed；
- skipped；
- cancelled。

每個狀態轉換產生 Trace Event。

## 6. Value Resolution

Context Scope：

```ts
interface ExecutionContext {
  inputs: JsonValue
  steps: Record<string, StepExecutionState>
  workflows: Record<string, WorkflowExecutionState>
  environment: SecretProvider
  currentRequest?: ExecutableRequest
  currentResponse?: ExecutableResponse
}
```

規則：

- Workflow Input 先通過 JSON Schema Validation；
- Pure Runtime Expression 保留原始 Type；
- Interpolation 才轉 String；
- Missing Optional Value 可不注入；
- Missing Required Value 在發送前 Error；
- Secret Provider 只回傳執行期值，不寫入 Trace；
- Array Selector 未定義時不得默認第一個元素。

## 7. Request Construction

順序：

1. Resolve Operation；
2. Determine Server；
3. Resolve Path Parameters；
4. Serialize Query/Querystring；
5. Add Header/Cookie；
6. Resolve Request Body；
7. Apply Security Provider；
8. Validate Request；
9. Redact Trace Copy；
10. Send。

Security Input 的優先順序：

1. Explicit Run Secret Binding；
2. Environment Variable；
3. Interactive Prompt（只在 TTY/UI）；
4. 缺少時阻擋。

不得從 Project JSON 讀出明文 Secret。

## 8. Transport

```ts
interface RequestTransport {
  id: string
  capabilities: TransportCapabilities
  send(
    request: ExecutableRequest,
    context: TransportContext
  ): Promise<ExecutableResponse>
}
```

### 8.1 Mock Transport

把 Request 傳給 Mock Runtime，帶 Session、Seed 與 Attempt。

### 8.2 Live HTTP Transport

- 必須明確 Opt-in；
- Run 前顯示 Host 與 Method Summary；
- 支援 Allowed Host Policy；
- Redirect 有上限且不可意外將 Authorization 傳到不同 Origin；
- TLS Error 不可自動忽略；
- 支援 Proxy 僅在明確設定；
- Response Size 有上限；
- Live Mode 預設不允許 Mutation Operation，除非 `--allow-write` 或 UI Confirmation。

### 8.3 Dry-run Transport

只輸出將發送的 Redacted Request，不連線。適合審查 Mapping 與 Secret Coverage。

## 9. Success Criteria

預設成功：

- 有 Success Criteria：全部 Criteria 通過；
- 無 Criteria：HTTP Status 2xx/3xx 是否算成功依 Arazzo/OpenAPI Profile；MVP 預設 2xx；
- Network Error、Timeout 或 Request Validation Error 為失敗。

Simple Criterion Evaluation：

- 型別感知比較；
- 不做寬鬆 JavaScript coercion；
- `null` 與 missing 分開；
- Header Case-insensitive；
- Evaluation Error 本身造成 Step Failure 並附 Diagnostic。

## 10. Outputs

Step 通過後擷取 Outputs。若 Output Expression 失敗：

- Required Output：Step Failure；
- Optional Output：Warning，值為 Missing；
- 是否 Required 由 Mapping/下游 Dependency 決定；
- Output 進入 Trace 前先 Redact；
- 下游使用 Secret Output 時，Trace 只顯示 Marker。

## 11. Retry

```text
attempt fails
  → evaluate onFailure in order
  → matching retry?
      → check retry limit
      → compute delay
      → wait with cancellation
      → next attempt
  → matching end?
      → fail workflow
  → no action
      → fail workflow
```

硬限制：

- Global Max Attempts；
- Global Max Total Retry Duration；
- Retry-After 上限；
- 不允許負數；
- 每次 Attempt 使用相同 Step Input Snapshot，除非明確重新解析 Runtime Expression；
- Mock Fault Attempt Counter 與 Executor Attempt 一致。

## 12. Timeout 與 Cancellation

- Step Timeout 使用 AbortSignal；
- Transport 必須尊重 Cancellation；
- Retry Wait 可取消；
- Workflow Cancellation 對未開始 Step 標記 skipped/cancelled；
- Timeout 後晚到 Response 不得提交 Mock Mutation；
- UI 關閉頁面可提示正在執行，但不能留下無主 Process。

## 13. Trace Event Model

```ts
type TraceEvent =
  | { type: 'run.started'; runId: string; at: string }
  | { type: 'step.started'; stepId: string; at: string }
  | { type: 'attempt.started'; stepId: string; attempt: number; at: string }
  | { type: 'request.resolved'; request: RedactedRequest }
  | { type: 'response.received'; response: RedactedResponse }
  | { type: 'criterion.evaluated'; result: CriterionResult }
  | { type: 'output.extracted'; name: string; value: RedactedValue }
  | { type: 'state.mutated'; mutation: StateMutation }
  | { type: 'retry.scheduled'; delayMs: number; reason: string }
  | { type: 'step.completed'; status: string; durationMs: number }
  | { type: 'run.completed'; status: string; durationMs: number }
```

Event 有 monotonic sequence number。Wall-clock 用於顯示，Duration 使用 monotonic clock。

## 14. Live Trace UI Contract

UI 必須能：

- 將 Current Step 高亮；
- 只在真正收到 Event 時播放 Edge Animation；
- 顯示 Attempt Timeline；
- 顯示 Request/Response 摘要與 Redaction；
- 顯示 Output Mapping；
- 顯示 State Before/After Diff；
- 顯示 Retry 與 Fault Source；
- 暫停動畫但不中斷執行；
- Respect `prefers-reduced-motion`，改用 Border/Status Update；
- 匯出 JSON Report。

動畫不得成為唯一狀態表達。

## 15. Run Report

```ts
interface RunReport {
  reportVersion: 1
  toolVersion: string
  projectFingerprint: string
  projectRevision: number
  workflowId: string
  mode: 'mock' | 'live'
  seed?: string
  sessionHash?: string
  inputs: RedactedValue
  startedAt: string
  durationMs: number
  status: string
  steps: TraceStep[]
  diagnostics: Diagnostic[]
  redactionSummary: RedactionSummary
}
```

Report 不包含：

- 明文 Token/Cookie/API Key；
- 未經設定允許的完整 Request/Response Body；
- 本機絕對檔案路徑；
- 使用者名稱或 Home Directory；
- Secret Environment Variable 值。

## 16. Failure Semantics

- Import/Validation Failure：Run 不建立或狀態為 blocked；
- Request Construction Failure：Step failed，未發送；
- Network/Runtime Failure：Attempt failed；
- Criteria Failure：Attempt failed；
- Output Failure：Step failed；
- Unsupported Feature：Run blocked；
- User Cancellation：Run cancelled；
- Internal Bug：Run failed + stable Internal Diagnostic，Debug Bundle 可選。

## 17. Diagnostics

- `EXE-WORKFLOW-NOT-EXECUTABLE`
- `EXE-INPUT-INVALID`
- `EXE-REQUIRED-VALUE-MISSING`
- `EXE-OPERATION-NOT-RESOLVED`
- `EXE-REQUEST-SERIALIZATION-UNSUPPORTED`
- `EXE-LIVE-WRITE-NOT-ALLOWED`
- `EXE-HOST-NOT-ALLOWED`
- `EXE-REDIRECT-POLICY-BLOCKED`
- `EXE-TIMEOUT`
- `EXE-CRITERION-FAILED`
- `EXE-OUTPUT-RESOLUTION-FAILED`
- `EXE-RETRY-LIMIT`
- `EXE-CANCELLED`

## 18. Acceptance Criteria

1. Supported Workflow 可由 UI 與 CLI 產生相同結果；
2. Input Validation 發送前完成；
3. Runtime Expression Type 保留；
4. Missing Required Mapping 阻擋；
5. Timeout 能取消 Transport 且不提交晚到 Mutation；
6. Retry 有界並可追蹤；
7. Live Write 需要明確允許；
8. Redirect 不外洩 Authorization；
9. Trace Event 順序穩定；
10. Reduce Motion 下仍可理解狀態；
11. Run Report 完整 Redact；
12. Unsupported Arazzo Feature 在 Run 前列出。
