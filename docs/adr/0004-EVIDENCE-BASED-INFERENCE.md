# ADR-0004：採用可解釋、需人工審核的依賴推導

- 狀態：Proposed
- 日期：2026-09-01
- 決策者：Project Owner
- 影響範圍：Inference、Workflow、UI、Export、Metrics
- 相關文件：[Flow Inference Spec](../10-FLOW-INFERENCE-SPEC.md)

## Context

OpenAPI 描述 API Surface，但欄位名稱與 Schema 相似不一定代表真正商業流程。例如 `id` 可能同時是 User、Order、Payment 或 Notification ID。工具若直接把所有相似欄位連成正式 Workflow，會產生錯誤信任與難以閱讀的 Graph。

但完全不推導又失去產品的核心價值：幫助使用者快速找出可能的資料依賴。

## Decision

所有自動推導結果都是 `Candidate`，具備：

- Rule ID；
- Source/Target Pointer；
- Evidence；
- Score Breakdown；
- Confidence Band；
- Ambiguity/Penalty；
- Engine Version；
- Stable Candidate ID；
- Status：Candidate/Accepted/Rejected/Edited。

規則優先為確定性、可測試的 Heuristics：

- OpenAPI Link；
- Security Propagation；
- Exact/Normalized Name；
- Schema Compatibility；
- Resource Lifecycle；
- Path/Operation Context；
- Required Target；
- Generic Name Penalty；
- Ambiguity Penalty。

即使 High-confidence，也不得自動寫入 Accepted Workflow。使用者接受、拒絕或修改後，Decision 才成為 Project Artifact。Export 只包含 Accepted/Manual/Declared 關係。

未來導入 ML/LLM 時，也必須輸出同等 Evidence 與人工審核，不得取代這個治理模型。

## Consequences

### Positive

- 使用者知道為什麼有這條線；
- 錯誤推導不會默默污染 Workflow；
- 可建立 Benchmark 與 Regression；
- Reject/Edit 也是改善規則的重要訊號；
- UI 可區分 Declared、Manual、Inferred、Observed；
- 有利於變更影響與審計。

### Negative

- 多一步人工操作；
- 初次使用者可能期待「全自動」；
- Evidence/Scoring/Decision Model 增加資料結構；
- Benchmark 需要持續維護；
- Confidence 不能簡化成真實成功率。

### Risks

- Score 看似精確但未校準；
- Candidate 過多造成審核疲勞；
- 使用者因 High 標籤盲目接受；
- 規則版本升級後排序改變。

控制：

- 使用 Band + Evidence，不只顯示小數；
- Generic ID 上限；
- Group/Deduplicate/Suppress；
- Project 保存 Rule Engine Version；
- Re-run 顯示新增/消失/變動 Candidate；
- High-confidence Precision 是 Release Gate；
- 文件明示 Confidence 是相對分數。

## Alternatives Considered

### 自動接受高分 Edge

拒絕。沒有足夠商業語意，風險大於省下的一次點擊。

### 只做手動畫線

拒絕。缺少產品差異與快速理解價值。

### 使用 LLM 直接生成 Workflow

不列入 MVP。可能有幫助，但不可驗證、成本/隱私/重現性問題尚未解決。

### 只顯示 Score，不顯示 Evidence

拒絕。無法審核，也無法改善規則。

## Acceptance

- Candidate 預設不 Export；
- 每個 Candidate 有至少一個 Evidence；
- Generic `id` Negative/Ambiguous Fixture 通過；
- Accept/Reject/Edit 可持久化；
- 同一輸入與 Engine Version 結果 Deterministic；
- Benchmark 公開且不含私有規格；
- README 不宣稱自動理解所有商業流程。
