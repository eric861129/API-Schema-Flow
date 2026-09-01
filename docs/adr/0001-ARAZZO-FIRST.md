# ADR-0001：以 Arazzo 作為正式 Workflow 交換格式

- 狀態：Proposed
- 日期：2026-09-01
- 決策者：Project Owner
- 影響範圍：Workflow、Import、Export、Execution、UI、CLI
- 相關文件：[Arazzo Workflow Spec](../09-ARAZZO-WORKFLOW-SPEC.md)

## Context

OpenAPI 能描述 API Operations、Schema、Security 與 Link，但通常不完整描述多步 API Workflow。專案需要一個可版本控制、可交換、可驗證的格式，表達：

- Step 順序；
- 上游輸出至下游輸入的 Mapping；
- Workflow Inputs/Outputs；
- Success Criteria；
- Operation Reference；
- 執行與文件化所需的依賴。

自行建立 `x-flow-next`、`x-flow-group` 或封閉 DSL 雖容易開始，卻會增加學習、維護、整合與遷移成本。

## Decision

API Schema Flow 將 Arazzo 1.1.x 作為正式 Workflow 交換格式。

優先順序：

1. Arazzo 明確宣告；
2. OpenAPI Link Object；
3. 使用者建立的 Manual Mapping；
4. 工具產生、等待審核的 Inferred Candidate；
5. 未來由 Trace 取得的 Observed Evidence。

自訂 Extension 只保存 Arazzo 不負責的產品資訊，例如：

- Canvas Position；
- Group 展開狀態；
- Mock Fault Profile；
- Inference Decision Metadata；
- UI Preference。

本專案必須分開聲明 Parse、Preserve、Visualize、Edit、Export 與 Execute 支援。MVP Executor 只執行文件化的同步 OpenAPI Execution Profile，不能把 Arazzo 1.1 Parse Support 宣稱為完整執行支援。

## Consequences

### Positive

- 使用正式、跨工具標準；
- Workflow 可進入版本控制；
- 可與其他 Arazzo Validator/Runner/Editor 互通；
- 不必為基本 Step/Mapping 重新設計語法；
- 有利於未來 Flow-aware Diff 與 CI。

### Negative

- Executor 需要正確處理 Runtime Expression 與 Support Matrix；
- Arazzo 生態仍在成長，工具相容性需持續驗證；
- 部分視覺化/Mock 設定仍需要非標準 Project Metadata；
- 匯入合法但未支援執行的文件時，UI 必須清楚區分。

### Risks

- 將專案綁在錯誤或過度狹窄的規格解讀；
- Round-trip 時遺失未知欄位；
- 使用者誤解為完整 Arazzo Runtime。

控制：

- Golden/Conformance Fixtures；
- Unknown Field Preservation；
- Execution Capability Analysis；
- Unsupported Feature 在發送 Request 前阻擋；
- Standards Baseline 定期更新。

## Alternatives Considered

### 自訂 Workflow DSL

拒絕。短期簡單，但形成封閉格式與遷移成本。

### 只使用 OpenAPI Link Object

拒絕作為唯一格式。Link 適合表達 Operation 關聯，但不足以表示完整 Workflow Inputs、Steps、Criteria 與 Outputs。

### 只在 UI 儲存 Graph JSON

拒絕。Graph JSON 可作 Project State，但不應取代標準 Workflow Artifact。

### Postman Collection

拒絕作為核心交換格式。它可作未來 Exporter，但產品的標準與 Vendor-neutral 定位應以 OpenAPI/Arazzo 為主。

## Acceptance

此 ADR 接受後：

- Arazzo Spec 成為 Workflow 語意來源；
- PRD/README 使用「Arazzo-first」；
- 不新增重複 Arazzo 核心能力的自訂 DSL；
- Execution Support Matrix 是 Release Gate；
- Arazzo Export Round-trip 有自動測試。
