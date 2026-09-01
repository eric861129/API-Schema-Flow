# 核心 Domain Model 規格

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 目的

Domain Model 是 Web、CLI、Inference、Mock、Execution 與 Export 的共同語言。它必須：

- 與 OpenAPI/Arazzo 語意對齊；
- 不依賴任何 Parser 或 UI Framework；
- 可序列化、版本化與 Migration；
- 保留來源 Pointer 與 Evidence；
- 支援 deterministic hashing；
- 清楚區分「規格事實、使用者決策、系統推導、執行觀察」。

以下 TypeScript 僅表達資料契約，不代表最終檔案切分。

## 2. 基礎識別

```ts
type ProjectId = string
type SourceId = string
type OperationKey = string
type WorkflowId = string
type StepId = string
type EdgeId = string
type SessionId = string
type RunId = string
type JsonPointer = string
```

### 2.1 Stable ID 規則

Operation Stable Key：

```text
sha256(sourceCanonicalId + "\n" + methodUpper + "\n" + normalizedPath)
```

顯示可使用短前綴，但持久化必須保留完整或足以防碰撞的值。

規則：

- Path 保留 Template 名稱，不把 `{reservationId}` 與 `{id}` 視為同一 Operation；
- Server URL 不進入 Operation Key，避免環境切換改變 ID；
- Source Canonical ID 由 Project Source ID 決定，不使用暫時檔案路徑；
- `operationId` 可變且非必要，不能作為唯一 Stable ID；
- 使用者重新命名 Source 時需有 Migration Map。

## 3. Project

```ts
interface ProjectSnapshot {
  schemaVersion: 1
  projectId: ProjectId
  name: string
  revision: number
  contentHash: string
  sources: SourceDescription[]
  operations: ApiOperation[]
  workflows: WorkflowDefinition[]
  edges: FlowEdge[]
  mock: MockProjectConfig
  layout: LayoutState
  redaction: RedactionPolicy
  metadata: ProjectMetadata
}
```

Invariants：

- `contentHash` 不包含 `updatedAt`；
- 所有 Edge Source/Target 必須能解析到 Operation 或 Workflow Step；
- Accepted Workflow 不得引用 Rejected Candidate；
- Secret 值不得進入 Project Snapshot；
- `schemaVersion` 變更需 Migration。

## 4. Source

```ts
interface SourceDescription {
  id: SourceId
  type: 'openapi' | 'arazzo'
  displayName: string
  location: SourceLocation
  canonicalUri?: string
  specificationVersion: string
  fingerprint: string
  retrieval: RetrievalMetadata
  diagnostics: Diagnostic[]
  extensions?: Record<string, unknown>
}
```

`location` 可為 File、URL、Inline、Browser File Handle。序列化時不得保存無法安全重開的臨時 Object；應保存相對位置或要求重新選擇。

## 5. API Operation

```ts
interface ApiOperation {
  key: OperationKey
  sourceId: SourceId
  method: string
  path: string
  operationId?: string
  summary?: string
  description?: string
  tags: string[]
  parameters: ApiParameter[]
  requestBodies: MediaTypeSchema[]
  responses: ApiResponse[]
  security: SecurityRequirement[]
  examples: ApiExample[]
  links: DeclaredOperationLink[]
  sourcePointer: JsonPointer
  support: FeatureSupport
}
```

### 5.1 Parameter

```ts
interface ApiParameter {
  name: string
  location: 'path' | 'query' | 'querystring' | 'header' | 'cookie'
  required: boolean
  schema?: NormalizedSchema
  contentType?: string
  sourcePointer: JsonPointer
}
```

Header 比對時名稱 Case-insensitive，但原始拼字需保留以供顯示與 Export。

### 5.2 Schema

```ts
interface NormalizedSchema {
  schemaId: string
  dialect?: string
  types: string[]
  format?: string
  required: string[]
  properties: Record<string, NormalizedSchema>
  items?: NormalizedSchema
  enum?: unknown[]
  const?: unknown
  defaultValue?: unknown
  examples: unknown[]
  nullable: boolean
  readOnly: boolean
  writeOnly: boolean
  sourceRef?: SourceReference
  unsupportedKeywords: string[]
}
```

Normalizer 不應嘗試完整重寫 JSON Schema 語意。對組合、條件與動態 Reference：

- 保留原始 Schema Fragment；
- 提供常用投影供 Inspector、Generation 與 Matching；
- 無法安全判斷時回傳 `compatibility=unknown`，不得假設相容。

## 6. Flow Graph

```ts
interface FlowGraph {
  nodes: FlowNode[]
  edges: FlowEdge[]
}
```

Node 種類：

```ts
type FlowNode =
  | EndpointNode
  | WorkflowNode
  | GroupNode
  | ExternalNode
```

MVP 主要操作 EndpointNode 與 Workflow Step View；GroupNode 是 UI/Graph 結構，不代表可執行 API。

## 7. Edge

```ts
interface FlowEdge {
  id: EdgeId
  source: EdgeEndpoint
  target: EdgeEndpoint
  provenance: 'declared' | 'manual' | 'inferred' | 'observed'
  status: 'candidate' | 'accepted' | 'rejected'
  mappings: DataMapping[]
  confidence?: number
  evidence: Evidence[]
  createdBy: 'import' | 'rule-engine' | 'user' | 'trace-import'
  decision?: EdgeDecision
  sourceStandardRef?: SourceStandardRef
}
```

### 7.1 Provenance 與 Status Invariants

- `declared` 由標準文件匯入，預設 `accepted`，但使用者可在 Project View 中停用；不得改寫原始 Source；
- `manual` 只能由使用者建立，預設 `accepted`；
- `inferred` 初始一定為 `candidate`；
- `observed` 初始可為 `candidate`，Observation Count 不是正確性的保證；
- `rejected` Edge 保留 Rule/Hash，用於避免每次重新推薦；
- `confidence` 只適用 Inferred/Observed，不適用 Declared 真實性排序。

### 7.2 Data Mapping

```ts
interface DataMapping {
  source: ValueSelector
  target: ValueTarget
  transform?: BuiltInTransform
  compatibility: 'compatible' | 'coercible' | 'unknown' | 'incompatible'
}
```

`ValueSelector`：

- Response Body JSON Pointer；
- Response Header；
- Request Input；
- Workflow Input；
- Previous Step Output；
- Literal（不得是 Secret）。

`ValueTarget`：

- Path、Query、Querystring、Header、Cookie；
- Request Body JSON Pointer；
- Workflow Input。

MVP Transform 僅允許內建、可序列化、可預測的轉換，例如 String interpolation、Prefix、Array first item。不得執行任意程式碼。

## 8. Evidence

```ts
interface Evidence {
  ruleId: string
  kind:
    | 'exact-name'
    | 'normalized-name'
    | 'schema-compatible'
    | 'resource-pattern'
    | 'security-propagation'
    | 'openapi-link'
    | 'arazzo'
    | 'manual'
    | 'observed'
  weight: number
  message: string
  sourcePointer?: string
  targetPointer?: string
  details?: Record<string, string | number | boolean>
}
```

Evidence Message 必須可供 UI 直接理解，例如：

> Response `reservationId` 與 Target Path Parameter `id` 型別皆為 `string`，且 Source/Target 位於相同 `/reservations` Resource。

不得只顯示「AI 判斷相關」。

## 9. Workflow

```ts
interface WorkflowDefinition {
  id: WorkflowId
  source: 'arazzo' | 'generated' | 'manual'
  summary?: string
  description?: string
  inputs?: NormalizedSchema
  steps: WorkflowStep[]
  outputs: Record<string, ValueSelector>
  executionProfile: ExecutionProfile
  preservation: RoundTripPreservation
}
```

```ts
interface WorkflowStep {
  id: StepId
  operation: OperationReference
  parameters: StepParameter[]
  requestBody?: StepRequestBody
  successCriteria: Criterion[]
  onSuccess: StepAction[]
  onFailure: StepAction[]
  outputs: Record<string, ValueSelector>
  timeoutMs?: number
  dependsOn: StepReference[]
  support: FeatureSupport
}
```

MVP Executor 只執行 `support.execution === 'supported'` 的 Workflow。含 Unsupported Step 的 Workflow 可視覺化，但執行前必須阻擋。

## 10. Mock Model

```ts
interface MockSession {
  id: SessionId
  seed: string
  revision: number
  createdAt: string
  expiresAt?: string
  resources: Record<string, ResourceCollection>
  scenarioState: Record<string, unknown>
  attemptCounters: Record<string, number>
}
```

```ts
interface ResourceCollection {
  resourceType: string
  idField: string
  entities: Record<string, JsonValue>
  nextSequence: number
}
```

```ts
interface FaultProfile {
  delayMs?: number
  jitterMs?: number
  failureRate?: number
  forcedStatus?: number
  timeout?: boolean
  attempts?: AttemptFaultRule[]
}
```

State Mutation：

```ts
interface StateMutation {
  revisionBefore: number
  revisionAfter: number
  resourceType: string
  entityId?: string
  operation: 'create' | 'replace' | 'merge' | 'delete' | 'reset' | 'restore'
  patch?: JsonPatchOperation[]
}
```

## 11. Trace Model

```ts
interface TraceRun {
  id: RunId
  projectRevision: number
  workflowId: WorkflowId
  mode: 'mock' | 'live'
  sessionId?: SessionId
  seed?: string
  inputs: RedactedValue
  startedAt: string
  completedAt?: string
  status: 'running' | 'passed' | 'failed' | 'cancelled'
  steps: TraceStep[]
  diagnostics: Diagnostic[]
}
```

```ts
interface TraceStep {
  stepId: StepId
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped'
  attempts: TraceAttempt[]
  outputs: Record<string, RedactedValue>
}
```

每個 Attempt 記錄 Timing、Redacted Request/Response、Criteria、Fault、Retry Decision 與 State Mutations。

## 12. Diagnostics

Diagnostic 是資料的一部分，不是 Console Side Effect。任何 Package 可回傳 Diagnostics，但 Code 必須由 Namespace 管理。

Diagnostic 可附：

- 原始 Source ID/Pointer；
- 對應 Operation/Workflow/Step；
- 可執行建議；
- 是否阻擋 Export/Execution；
- 文件連結的 Stable Slug。

## 13. Serialization

- JSON 為 Project Snapshot 的 canonical format；
- Key 排序與 Array 排序規則固定；
- Unknown Extension 保留在明確 Namespace；
- `undefined` 不得序列化；
- Date 以 UTC ISO 8601；
- Number 不得以 NaN/Infinity；
- Map/Set 必須轉換為穩定 Array/Object；
- Hash 前先執行 Canonicalization；
- Secret Value 在進入 Snapshot 前即被替換為 Environment Reference 或 Redacted Marker。

## 14. Migration

```ts
interface ProjectMigration {
  from: number
  to: number
  migrate(input: unknown): MigrationResult
}
```

規則：

- 每個 Schema Version 都有向下一版 Migration；
- Migration 不得需要 Network；
- Migration 前保留原檔；
- Lossy Migration 必須阻擋並要求使用者確認；
- v1.0 前仍需測試最早公開 Project Schema 到最新版的升級。
