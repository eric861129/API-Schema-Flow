# 文件索引

> 狀態：草案，待專案負責人審閱  
> 文件版本：0.1.0  
> 最後更新：2026-09-01  
> 適用範圍：API Schema Flow MVP

## 1. 文件目的

這個資料夾是一套可直接放入 API Schema Flow Repo 的開工前文件。文件以「產品決策、架構邊界、可驗收規格、開源治理」為主，避免把尚未驗證的想法寫成已完成能力。

所有文件目前皆屬 **Owner Review Draft**。專案負責人確認後：

1. 將採納的 ADR 狀態改為 `Accepted`；
2. 完成 [Open Decisions](25-OPEN-DECISIONS.md) 的最終選擇；
3. 依 [Implementation Readiness Checklist](30-IMPLEMENTATION-READINESS-CHECKLIST.md) 建立 Repo；
4. 再將 Roadmap 拆成可執行的 Issue 與 Milestone。

## 2. 閱讀順序

### A. 先確認產品方向

1. [Product Vision](01-PRODUCT-VISION.md)
2. [PRD](02-PRD.md)
3. [MVP Scope and Acceptance](03-MVP-SCOPE-AND-ACCEPTANCE.md)
4. [Personas and Use Cases](04-PERSONAS-AND-USE-CASES.md)
5. [Success Metrics](05-SUCCESS-METRICS.md)

### B. 再確認系統設計

1. [System Architecture](06-SYSTEM-ARCHITECTURE.md)
2. [Domain Model](07-DOMAIN-MODEL.md)
3. [OpenAPI Ingestion](08-OPENAPI-INGESTION-SPEC.md)
4. [Arazzo Workflow](09-ARAZZO-WORKFLOW-SPEC.md)
5. [Flow Inference](10-FLOW-INFERENCE-SPEC.md)
6. [Stateful Mock Runtime](11-STATEFUL-MOCK-RUNTIME-SPEC.md)
7. [Execution and Live Trace](12-EXECUTION-AND-LIVE-TRACE-SPEC.md)

### C. 確認操作介面與輸出

1. [Web App UX](13-WEB-APP-UX-SPEC.md)
2. [CLI](14-CLI-SPEC.md)
3. [Project Configuration](15-PROJECT-CONFIG-SPEC.md)
4. [Export](16-EXPORT-SPEC.md)
5. [Flow-aware Diff](17-FLOW-AWARE-DIFF-SPEC.md)

### D. 確認品質、風險與維運

1. [Non-functional Requirements](18-NON-FUNCTIONAL-REQUIREMENTS.md)
2. [Security Threat Model](19-SECURITY-THREAT-MODEL.md)
3. [Test Strategy](20-TEST-STRATEGY.md)
4. [Release and Versioning](21-RELEASE-AND-VERSIONING.md)
5. [Repository Structure](22-REPOSITORY-STRUCTURE.md)
6. [Requirements Traceability](23-REQUIREMENTS-TRACEABILITY.md)

### E. 審查最終決策與開源準備

1. [Glossary](24-GLOSSARY.md)
2. [Open Decisions](25-OPEN-DECISIONS.md)
3. [End-to-end Example](26-END-TO-END-EXAMPLE.md)
4. [Open-source Governance](27-OPEN-SOURCE-GOVERNANCE.md)
5. [Standards Baseline](28-STANDARDS-BASELINE.md)
6. [Demo and Launch Plan](29-DEMO-AND-LAUNCH-PLAN.md)
7. [Implementation Readiness Checklist](30-IMPLEMENTATION-READINESS-CHECKLIST.md)

## 3. ADR

| ADR | 決策 |
|---|---|
| [ADR-0001](adr/0001-ARAZZO-FIRST.md) | 以 Arazzo 作為正式 Workflow 交換格式 |
| [ADR-0002](adr/0002-NORMALIZED-DOMAIN-MODEL.md) | 核心採自有 Normalized Domain Model |
| [ADR-0003](adr/0003-SHARED-MOCK-RUNTIME.md) | Mock Runtime 與 HTTP/Interception Adapter 分離 |
| [ADR-0004](adr/0004-EVIDENCE-BASED-INFERENCE.md) | 推導必須保留 Evidence、Confidence 與人工審核 |
| [ADR-0005](adr/0005-LOCAL-FIRST.md) | MVP 採 Local-first、No Telemetry by Default |

## 4. Root 文件

| 文件 | 用途 |
|---|---|
| `README.md` | 英文公開入口 |
| `README.zh-TW.md` | 繁中公開入口 |
| `ROADMAP.md` | 成果導向 Milestones |
| `CONTRIBUTING.md` | 貢獻流程與 Package Boundary |
| `SECURITY.md` | 漏洞回報與安全政策 |
| `CODE_OF_CONDUCT.md` | 社群行為規範 |
| `CHANGELOG.md` | 版本變更紀錄 |
| `FILE-MANIFEST.md` | 文件用途、行數與交付雜湊清單 |

## 5. 文件狀態規則

- **Draft**：內容完整，但尚未由 Owner 接受。
- **Accepted**：已成為目前專案基準；改動需更新文件或 ADR。
- **Superseded**：已被新文件或 ADR 取代，保留歷史。
- **Deprecated**：仍可讀，但不應用於新實作。

## 6. 規範用語

文件中的 `MUST`、`MUST NOT`、`SHOULD`、`SHOULD NOT`、`MAY` 分別表示必要、禁止、建議、不建議與可選。中文段落也會使用「必須、不得、應、可」表達同樣強度。

## 7. 一致性原則

- PRD 定義「為什麼」與「做什麼」；
- Spec 定義「可觀察行為、邊界與驗收」；
- ADR 定義「為什麼選擇此設計」；
- Roadmap 定義「先後順序與離開條件」；
- Issue 才定義「單次實作工作」；
- 文件若與已接受 ADR 衝突，以最新 Accepted ADR 為準。
