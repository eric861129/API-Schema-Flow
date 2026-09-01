# Stateful Mock Runtime 規格

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 目標

Mock Runtime 應讓前端與 QA 在沒有真實後端時操作具備生命週期的資料：

```text
Create → Read → Update → Delete → Not Found
```

它必須可重現、Session-isolated、Schema-aware、可注入故障，且不依賴特定 HTTP Framework。

## 2. 核心介面

```ts
interface MockRuntime {
  handle(
    request: RuntimeRequest,
    context: RuntimeContext
  ): Promise<RuntimeResponse>
}
```

```ts
interface RuntimeRequest {
  method: string
  url: string
  headers: Record<string, string[]>
  body?: Uint8Array
  contentType?: string
}
```

```ts
interface RuntimeContext {
  projectRevision: number
  sessionId: string
  signal: AbortSignal
  now: () => Date
}
```

```ts
interface RuntimeResponse {
  status: number
  headers: Record<string, string[]>
  body?: Uint8Array
  trace: RuntimeTraceData
  mutations: StateMutation[]
}
```

Adapter 負責將 Fastify/MSW/Fetch 物件轉為上述型別。

## 3. Request Pipeline

```text
Resolve Session
  → Match Operation
  → Parse/Validate Request
  → Resolve Fault Policy
  → Select Explicit Scenario or Resource Handler
  → Read/Mutate State
  → Select Declared Response
  → Generate/Validate Response
  → Apply Delay/Timeout
  → Redact Trace
  → Return
```

## 4. Route Matching

- 使用 OpenAPI Path Template；
- Method Case-insensitive；
- Static Segment 優先於 Parameter Segment；
- 多個同等 Route 衝突為 Error；
- Server Base Path 可設定；
- Query 不參與 Route Selection，但參與 Validation/Filter；
- Trailing Slash Policy 必須固定；
- URL Decode Error 回 400，不得 Crash。

## 5. Resource Discovery

Resource Definition 可來自：

1. 使用者明確設定；
2. `x-schema-flow.mock`；
3. Operation/Path Lifecycle 推導；
4. 無法辨識時退回 Stateless Example Handler。

Generated CRUD 需要至少辨識：

- Resource Type；
- Collection Path；
- Item Path；
- ID Parameter；
- ID Field；
- Request/Response Schema；
- List Envelope；
- Success/Not Found Status。

若信心不足，不得假裝 Stateful；UI 應顯示「Stateless fallback」。

## 6. CRUD 行為

### 6.1 Create

對 Collection POST：

1. Parse Request Body；
2. 依 Request Schema 驗證；
3. Merge Server-generated fields；
4. 產生 deterministic ID；
5. 依 Response Schema 建立 Entity；
6. 寫入 Session Store；
7. 回傳 Spec 宣告的成功 Response。

ID 優先：

1. Response/Resource Config 明確 ID；
2. Schema 中 Resource-specific ID；
3. `id`；
4. UUID/Integer Generator 依型別；
5. 無法推導時要求設定。

### 6.2 List

- 回傳 Session 中該 Resource 全部 Entity；
- 支援基本 `limit`, `offset`, `page`, `pageSize`，只有在 Spec 定義時；
- Filter/Sort 未支援時不得忽略並假裝成功，應 Warning 或依設定採 Lenient；
- List Envelope 依 Response Schema，例如 `{ items, total }`。

### 6.3 Get Item

- 依 Path ID 查找；
- 找到回傳 Entity；
- 找不到回傳 Spec 宣告 404，若未宣告則選擇最接近 4xx 並附 Runtime Warning；
- ID Type 依 Parameter Schema 解析。

### 6.4 Replace

PUT 預設完整取代：

- 保留 Server-managed ID；
- Required Field 缺少時 400/422；
- 不存在 Resource 的 Upsert 行為只有明確設定才允許。

### 6.5 Merge

PATCH 預設 JSON Merge-like 行為，實際 Media Type 若為 JSON Patch 則需獨立支援。不得把兩者混為一談。

### 6.6 Delete

- 成功後移除 Entity；
- 回傳宣告的 200/202/204；
- 重複 Delete 可依設定回 404 或 Idempotent Success；
- 預設依 Spec Example/Status 選擇，無資訊時為 404。

## 7. Store

```ts
interface StateStore {
  getSession(id: string): Promise<MockSession>
  transact<T>(
    id: string,
    fn: (draft: MockSession) => Promise<T>
  ): Promise<{ value: T; revision: number; mutations: StateMutation[] }>
  reset(id: string): Promise<void>
  snapshot(id: string): Promise<MockSnapshot>
  restore(id: string, snapshot: MockSnapshot): Promise<void>
}
```

MVP 使用 In-memory Adapter。

要求：

- 同 Session Mutation 序列化；
- 不同 Session 可平行；
- 每次成功 Mutation 增加 Revision；
- Failed Request 不提交 State；
- Snapshot 有 Project Fingerprint；
- Restore Fingerprint 不符時阻擋或執行明確 Migration；
- Session TTL 可設定。

## 8. Session Isolation

預設 Session Header：

```http
X-Schema-Flow-Session: <session-id>
```

來源優先：

1. Executor 直接 Context；
2. Header；
3. UI 建立的 Default Session；
4. 缺少時自動建立匿名 Session，僅在本機 Interactive Mode。

CI/Headless 必須明確指定 Session 或使用一次性 Session。

Session ID：

- 不包含使用者資訊；
- 有長度與字元限制；
- 不可用於 File Path；
- Trace Export 可 Hash；
- Control Plane 只允許管理已知 Session。

## 9. Deterministic Generation

輸入：

- Project Fingerprint；
- Session Seed；
- Operation Key；
- Resource Type；
- Sequence Number；
- Field Pointer。

Faker 只作為 Value Provider，由 Runtime 傳入 deterministic Random Source。不得直接使用全域 Random。

生成優先順序：

1. User Seed Data；
2. Explicit Example；
3. Schema Default/Const/Enum；
4. Format-aware Generator；
5. Type Generator；
6. 無法安全生成時 Diagnostic。

格式支援至少包含：

- uuid；
- date/date-time；
- email；
- uri；
- hostname；
- ipv4/ipv6；
- int32/int64；
- decimal string（若 Schema 指定）；
- boolean；
- enum。

## 10. Fault Injection

```ts
interface FaultProfile {
  delayMs?: number
  jitterMs?: number
  failureRate?: number
  forcedStatus?: number
  timeout?: boolean
  attemptRules?: {
    attempt: number | { from: number; to: number }
    status?: number
    delayMs?: number
    timeout?: boolean
  }[]
}
```

執行順序：

1. Match Operation/Workflow/Session Policy；
2. Determine Attempt；
3. Deterministic random decision；
4. Apply forced status or timeout；
5. 若 Forced Error，預設不 Mutation；
6. Delay 可在 Response 前套用；
7. Trace 記錄實際套用的 Rule。

限制：

- Delay、Jitter、Timeout 有全域上限；
- Failure Rate 介於 0–1；
- CI 可設定 `--fail-on-random-fault`；
- 相同 Seed 與 Attempt 順序結果一致。

## 11. Explicit Scenario Override

使用者可定義無程式碼 Scenario：

```yaml
mock:
  scenarios:
    - id: payment-declined-once
      operationId: payOrder
      when:
        attempt: 1
      respond:
        status: 402
        body:
          code: CARD_DECLINED
```

MVP 只支援結構化條件與 Response，不執行任意 JS。Scenario 優先於 Generated CRUD，但必須在 UI 顯示 Override。

## 12. Control Plane

建議路徑：

```text
/__schema-flow/health
/__schema-flow/sessions
/__schema-flow/sessions/{id}/reset
/__schema-flow/sessions/{id}/snapshot
/__schema-flow/sessions/{id}/restore
```

要求：

- 預設只在 Loopback；
- 可分離 Port；
- 不受 Mock API CORS 廣泛開放；
- Production/External Bind 時預設停用；
- Snapshot Response 一樣 Redact；
- Path 可設定避免與使用者 API 衝突。

## 13. Validation Modes

- `strict`：Request 不符 Schema 時拒絕；
- `warn`：回應但 Trace 記錄 Warning；
- `off`：只用於特殊相容案例，不是預設。

Response 在開發測試中應永遠進行 Validation；若 Generated Response 不符 Schema，這是 Runtime Bug，回 500 並產生 `MCK-GENERATED-RESPONSE-INVALID`。

## 14. Content Types

MVP 完整支援：

- `application/json`
- `application/*+json`

可支援：

- `application/x-www-form-urlencoded`
- `multipart/form-data` 的簡單欄位

不支援的 Binary/Streaming Content：

- 可從 Explicit Example/File Stub 回傳；
- Generated Handler 必須明確拒絕或採 Stateless；
- 不得把 Binary 當 JSON。

## 15. Trace

Runtime Trace 必須包含：

- Matched Operation；
- Session/Revision；
- Handler Source：scenario/resource/stateless；
- Validation Result；
- Fault Applied；
- Selected Response；
- State Mutations；
- Generator Seed Context；
- Redaction Applied。

不得包含原始 Authorization/Cookie。

## 16. Diagnostics

- `MCK-ROUTE-NOT-MATCHED`
- `MCK-ROUTE-AMBIGUOUS`
- `MCK-REQUEST-INVALID`
- `MCK-RESOURCE-NOT-RECOGNIZED`
- `MCK-ID-FIELD-AMBIGUOUS`
- `MCK-GENERATED-RESPONSE-INVALID`
- `MCK-SESSION-NOT-FOUND`
- `MCK-SNAPSHOT-PROJECT-MISMATCH`
- `MCK-STATE-CONFLICT`
- `MCK-UNSUPPORTED-CONTENT-TYPE`
- `MCK-FAULT-POLICY-INVALID`

## 17. Acceptance Criteria

1. Create 後可 Read；
2. Patch/Put/Delete 行為符合定義；
3. Session 完全隔離；
4. 相同 Seed 可 Replay；
5. Failed Mutation 不提交；
6. Snapshot/Restore 保持 Entity 與 Sequence；
7. Fastify 與 MSW Adapter 對相同 Request 產生等價 Response；
8. Fault Attempt deterministic；
9. Generated Response 必須通過 Schema Validation；
10. Control Plane 外部 Bind 預設停用；
11. 無任意程式碼執行；
12. 500 Operations 下 Route Match 與處理效能達標。
