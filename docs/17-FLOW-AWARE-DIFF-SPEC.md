# Flow-aware OpenAPI Diff 規格

> 狀態：Post-MVP 規格草案，MVP 僅預留資料模型  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow Post-MVP

## 1. 狀態

本功能屬 **Post-MVP**。MVP Domain Model、Stable Pointer、Edge Mapping、Workflow Reference 與 Project Revision 必須預先保留所需資料，但不阻擋第一版發布。

## 2. 目標

一般 OpenAPI Diff 會指出欄位新增、刪除或型別改變；Flow-aware Diff 進一步回答：

> 這個變更會影響哪些 Workflow、Step、Data Mapping、Mock Scenario 與測試？

## 3. Inputs

```ts
interface FlowDiffInput {
  baseOpenApi: SourceSet
  headOpenApi: SourceSet
  project?: ProjectSnapshot
  workflows?: WorkflowDefinition[]
  policy: DiffPolicy
}
```

Project 提供 Accepted/Declared Mapping。沒有 Project 時仍可做一般 Operation/Schema Diff，但無法宣稱完整 Workflow Impact。

## 4. Pipeline

```text
Normalize Base
  → Normalize Head
  → Match Sources/Operations/Schemas
  → Compute Structural Changes
  → Classify Compatibility
  → Resolve Changed Value Selectors/Targets
  → Traverse Accepted Workflow Graph
  → Rank Impacts
  → Export Report
```

## 5. Operation Matching

優先：

1. Stable explicit mapping；
2. Operation ID（唯一且未變）；
3. Method + Path；
4. Rename Candidate（只作提示，不自動視為同一）；
5. 使用者 Mapping。

Path Parameter Rename 可能影響 Pointer 與 Arazzo Parameter；不得僅因結構相同就靜默合併。

## 6. Change Types

### 6.1 Breaking

範例：

- 移除被使用的 Operation；
- 移除 Required Response Field，而該欄位供下游 Mapping；
- 改變 Field Type/Format 為不相容；
- 新增 Required Request Field，沒有 Workflow Input/Mapping；
- 移除 Response Status/Content Type；
- Security Requirement 變嚴格；
- Path/Parameter Rename 使 Reference 無法解析。

### 6.2 Potentially Breaking

- Enum 收窄；
- String Format 改變；
- Optional Field 移除但 Workflow 有使用；
- Array Item Schema 改變；
- Server/Base Path 改變；
- Response Example 改變；
- Description 顯示 Deprecation。

### 6.3 Non-breaking

- 新增 Optional Response Field；
- 新增 Operation；
- 新增可選 Parameter；
- 擴大 Enum；
- 補充 Example/Description。

實際相容性受 OpenAPI 版本與 HTTP 語意影響，Policy 必須可設定。

## 7. Workflow Impact

```ts
interface WorkflowImpact {
  workflowId: string
  severity: 'breaking' | 'potential' | 'informational'
  affectedSteps: StepImpact[]
  affectedMappings: MappingImpact[]
  transitiveDepth: number
  explanation: string[]
}
```

例：

```text
response.reservationId removed
  → breaks mapping to GET /reservations/{id}
  → affects workflow createReservation step getReservation
  → invalidates mock scenario reservation-created
```

只追蹤：

- Declared；
- Manual；
- Accepted Inferred；
- 可選 Observed。

Candidate Edge 不應提高正式 Impact Severity，但可列在「Possible Impact」。

## 8. Transitive Impact

限制深度與 Cycle Detection。直接 Mapping 是最高證據；Transitive Impact 必須顯示路徑：

```text
POST /reservations response.id
  → workflow output reservationId
  → POST /payments body.reservationId
  → GET /payments/{id}
```

不得只顯示「3 個流程受影響」而無法追溯。

## 9. Mock Impact

檢查：

- Resource ID Field 改變；
- List Envelope 改變；
- Response Schema 與 Seed Data 不符；
- Status Code 移除；
- Fault Scenario Target Operation 不存在；
- Snapshot Project Fingerprint 不相容。

## 10. Output

### 10.1 Markdown

適合 PR Comment：

```markdown
## API Schema Flow Impact

**Breaking changes:** 2  
**Affected workflows:** 3

### `createReservation`

- `create` output `/reservationId` was removed.
- Breaks mapping to `getReservation` path parameter `id`.
```

### 10.2 JSON

包含 Stable Schema Version，供 CI 解析。

### 10.3 SARIF（後續）

將 Source Pointer 對應到 OpenAPI/Arazzo Line，供 GitHub Code Scanning 顯示。

## 11. CI Policy

設定：

```yaml
diff:
  failOn:
    - breaking
  includeCandidates: false
  maxTransitiveDepth: 10
```

Exit：

- 無阻擋：0；
- Policy 違反：1；
- Input/Tool Error：沿用 CLI Exit Code。

## 12. Rename Handling

系統可提出 Rename Candidate，但需要：

- 相同 Method/相似 Path；
- Schema 高度相似；
- Operation ID/Description Evidence；
- 使用者或 CI Mapping File 確認。

未確認前，同時視為 Remove + Add，避免漏報 Breaking Change。

## 13. Limitations

- OpenAPI 無法表達所有 Runtime Behavior；
- Accepted Workflow 之外的隱含依賴可能未被追蹤；
- Consumer 實作可能依賴未宣告欄位；
- Regex/Free-form Payload 難以判斷；
- Server-side semantic behavior 改變不一定反映在 Spec。

報告必須標示「spec-level impact」，不宣稱完整 Production Impact。

## 14. Acceptance Criteria

1. 被 Mapping 使用的 Response Field 移除可追到 Workflow；
2. 新 Required Request Field 無 Mapping 時標示 Breaking；
3. Candidate 不影響正式 Severity；
4. Transitive Path 可顯示；
5. Cycle 不造成無限遍歷；
6. Rename 未確認時不靜默合併；
7. JSON Output deterministic；
8. Markdown 可直接貼入 PR；
9. Mock Seed/Scenario Impact 可列出；
10. Report 標示限制與 Source Fingerprint。
