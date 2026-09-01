# Flow Inference Engine 規格

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 目標

Flow Inference Engine 從 OpenAPI 的 Operation、Schema、Security 與 Resource Pattern 產生「可能存在的資料依賴」。它不是商業流程真相來源。

核心承諾：

- Deterministic；
- Explainable；
- Reviewable；
- Benchmarkable；
- Conservative。

## 2. 非目標

- 不自動決定完整商業流程；
- 不以 LLM 回答取代規則證據；
- 不自動 Accept；
- 不僅因兩邊都有 `id` 就連線；
- 不建立無法指出 Source/Target Pointer 的 Edge；
- 不跨越型別明顯不相容的欄位。

## 3. 輸入與輸出

```ts
interface InferenceInput {
  projectRevision: number
  operations: ApiOperation[]
  declaredEdges: FlowEdge[]
  decisions: EdgeDecision[]
  config: InferenceConfig
}
```

```ts
interface InferenceCandidate {
  id: string
  source: ValueSelector
  target: ValueTarget
  sourceOperation: OperationKey
  targetOperation: OperationKey
  score: number
  confidence: number
  evidence: Evidence[]
  blockers: Evidence[]
  status: 'candidate'
}
```

相同 Input、Config 與 Rule Version 必須產生相同 Candidate ID、Score 與排序。

## 4. Pipeline

```text
Index Operations and Fields
  → Generate Plausible Source/Target Pairs
  → Apply Hard Constraints
  → Run Independent Evidence Rules
  → Aggregate Score
  → Apply Penalties
  → Compute Confidence Band
  → Merge Duplicates
  → Apply Past Accept/Reject Decisions
  → Rank and Return
```

## 5. Candidate 空間控制

不得對所有 Response Field 與所有 Request Field 做無界 O(n²) 比較。先使用索引縮小範圍：

- Normalized Name Index；
- Type/Format Index；
- Resource Segment Index；
- Security Scheme Index；
- Tag/Service Index；
- Operation Lifecycle Index；
- OpenAPI Link/Arazzo Reference Index。

設定最大 Candidate Count、每個 Target 的 Top-K 與單次推導時間。

## 6. 名稱正規化

正規化步驟：

1. Unicode Normalization；
2. Case folding；
3. camelCase、PascalCase、snake_case、kebab-case 分詞；
4. 移除常見包裝詞：`data`, `result`, `payload`，但保留原始 Pointer；
5. Singular/Plural 的保守處理；
6. ID Alias：`reservationId`, `reservation_id`, `reservation-id`；
7. 不把所有 `id` 自動映射到任意 Resource。

例：

```text
reservation_id → ["reservation", "id"]
reservationId  → ["reservation", "id"]
id             → ["id"]
```

## 7. Hard Constraints

以下情況直接阻擋 Candidate：

- Source/Target Operation 相同且沒有明確 Lifecycle 意義；
- Schema Types 明確不相容且無內建 Coercion；
- Target Parameter 是 Path Required，但 Source 可能為 Array/Object 且未定義 Selector；
- Source 欄位 `writeOnly`；
- Target 欄位 `readOnly` 且位於 Request；
- Secret/Password 欄位被建議到非安全 Target；
- 已存在同 Mapping 的 Declared/Manual Edge；
- 使用者已 Reject 相同 Rule Version/Source/Target Fingerprint；
- 形成不允許的立即 Cycle。

## 8. Evidence Rules

初始 Rule Catalog：

| Rule ID | Evidence | 建議權重 |
|---|---|---:|
| `INF-NAME-EXACT` | 完整欄位名稱相同 | +25 |
| `INF-NAME-NORMALIZED` | 分詞後名稱相同 | +18 |
| `INF-RESOURCE-ID` | `reservationId` 對應 `/reservations/{id}` | +25 |
| `INF-SCHEMA-TYPE` | JSON Schema Type 相容 | +12 |
| `INF-SCHEMA-FORMAT` | UUID、date-time 等 Format 相同 | +10 |
| `INF-RESOURCE-PATH` | Source/Target 屬相同 Resource | +15 |
| `INF-LIFECYCLE-CREATE-READ` | POST Collection → GET Item | +20 |
| `INF-LIFECYCLE-CREATE-UPDATE` | POST Collection → PUT/PATCH Item | +15 |
| `INF-AUTH-BEARER` | Token Response → Bearer Header | +30 |
| `INF-TAG-SAME` | Operation 共享 Tag | +4 |
| `INF-OPERATION-NAME` | Operation ID 語意相關 | +6 |
| `INF-GENERIC-ID` | 只有 `id` 相同 | +3，且設 High-confidence 上限 |
| `INF-TYPE-COERCION` | 可安全 String/Number Coerce | -5 |
| `INF-INCOMPATIBLE` | 明確不相容 | Block |
| `INF-CROSS-RESOURCE` | 無其他證據的跨 Resource | -20 |
| `INF-CYCLE-RISK` | 形成可疑 Cycle | -25 |

權重只是初始設定，必須由 Benchmark 校正，不能視為固定真理。

## 9. Confidence

Score 先經規則上限與 Sigmoid/分段映射轉為 0–1 Confidence。顯示 Band：

- `0.90–1.00`：High；
- `0.75–0.89`：Medium；
- `0.60–0.74`：Low，預設收合；
- `< 0.60`：不顯示，除非 Debug。

特殊限制：

- 只有 Generic `id`、Tag 或 Operation Name 時，Confidence 不得超過 0.59；
- Auth Token Rule 仍需確認 Target Security/Header；
- High 只代表規則信心，不代表商業流程一定正確；
- UI 必須顯示「Candidate」而非「Detected Truth」。

## 10. Declared 與 Inferred 合併

優先順序：

1. Arazzo；
2. OpenAPI Link；
3. Manual；
4. Accepted Inferred；
5. Candidate Inferred；
6. Observed。

若 Inferred 與 Declared Mapping 相同，Candidate 不重複顯示，可附為額外 Evidence。若衝突，顯示 Conflict，不得覆寫 Declared。

## 11. Review Decision

```ts
interface EdgeDecision {
  candidateFingerprint: string
  action: 'accept' | 'reject' | 'edit'
  ruleSetVersion: string
  decidedAt: string
  editedMapping?: DataMapping[]
}
```

規則：

- Reject 決策在 Source/Target Schema Fingerprint 未變時持續有效；
- Schema 改變後可重新推薦，但標示 Previous Rejection；
- Accept 後形成正式 Edge，保留原 Evidence；
- Edit 後 Provenance 為 `manual`，並保留 `derivedFromCandidateId`；
- Batch Accept 只允許 High Band，仍需顯示清單與總數。

## 12. Auth 推導

MVP 支援：

- Login Response Token → Bearer Header；
- API Key Input → Security Scheme Header/Query；
- Cookie-based Session 只能在明確 Set-Cookie/Requirement 存在時建議。

不得：

- 把 Password、Refresh Token 任意傳給非安全欄位；
- 在 Trace/Export 顯示 Token 值；
- 僅看到欄位名 `token` 就向所有 Header 建議。

## 13. Resource Lifecycle 推導

辨識：

```text
POST   /resources
GET    /resources
GET    /resources/{id}
PUT    /resources/{id}
PATCH  /resources/{id}
DELETE /resources/{id}
```

Path Segment、Schema Title/Reference、Response Shape 與 ID Field 共同決定 Resource。Nested Resource 如 `/users/{userId}/orders/{orderId}` 必須分別處理 Parent/Child ID。

## 14. Arrays 與 Selector

若 Source 是 Array，系統不得默認第一筆，除非：

- OpenAPI/Arazzo 明確 Selector；
- 使用者在 Mapping Editor 選擇 `first`, `index`, 或 filter；
- Rule 只提出「需要 Selector」的 Candidate，不可直接 Accepted。

MVP 可提供內建 Selector：

- `first`
- `index(n)`
- JSON Pointer
- Header
- Literal interpolation

JSONPath 需另行 Feature Gate。

## 15. Benchmark Dataset

每個案例包含：

```ts
interface LabeledInferenceCase {
  id: string
  sourceFixture: string
  expectedPositiveMappings: MappingLabel[]
  expectedNegativeMappings: MappingLabel[]
  notes: string
}
```

資料集至少涵蓋：

- Exact ID；
- Aliased ID；
- Generic ID False Positive；
- Auth Token；
- Nested Resource；
- Array Selector；
- Type Mismatch；
- Cross-service Same Name；
- Pagination Cursor；
- Multiple Candidate IDs；
- Duplicate Operation ID；
- OpenAPI Link 覆蓋。

指標：

- High-confidence Precision；
- Medium Precision；
- Recall；
- False Positive by Rule；
- Candidate Count；
- Runtime。

Release Gate 以 High Precision 為主。

## 16. 可觀察性

Debug Report 可包含：

- Rule Version；
- Candidate pair count；
- Index sizes；
- Rule hit counts；
- Score distribution；
- Rejection/block reasons；
- Timing。

不得包含完整 Secret、Payload 或未遮罩內部 URL；本機 Debug 可由使用者明確選擇增加內容。

## 17. 未來 LLM Integration

若未來加入 LLM：

- 只能成為 `evidence.kind=semantic-suggestion`；
- 不得繞過 Candidate Review；
- 必須顯示 Provider、Model、Prompt Policy 與資料是否離開本機；
- 預設關閉；
- 不得把 LLM Score 與 deterministic Confidence 混成不可解釋數字；
- 必須能在沒有 LLM 時完整使用核心產品。

## 18. Acceptance Criteria

1. 相同輸入輸出一致；
2. 每個 Candidate 有 Evidence 與 Pointer；
3. Generic `id` 不會形成 High；
4. Declared Edge 不重複；
5. Reject 決策可在重跑後保留；
6. Schema 變更會使舊 Decision 進入 Review；
7. High-confidence Benchmark Precision ≥ 85%；
8. Inference 能在 500 Operations 規模內達成 NFR；
9. Rule Failure 不造成整體 Import 失敗；
10. UI 能逐條說明分數來源。
